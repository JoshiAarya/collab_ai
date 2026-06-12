import express from 'express';
import { authenticate } from '../middleware/auth.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import documentService from '../services/documentService.js';
import summaryService from '../services/summaryService.js';
import aiService from '../services/aiService.js';
import Decision from '../models/Decision.js';
import crypto from 'crypto';
import connectionManager from '../services/connectionManager.js';
import { dashboardCache } from '../utils/ttlCache.js';

import { validate } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create project
router.post('/', validate('createProject'), async (req, res) => {
  try {
    const { title, problemStatement } = req.body;

    if (!title || !problemStatement) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title and problem statement required' 
      });
    }

    const project = await projectService.createProject(
      title, 
      problemStatement, 
      req.user.userId
    );

    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user's projects
router.get('/', async (req, res) => {
  try {
    const projects = await projectService.getUserProjects(req.user.userId);
    res.json({ success: true, projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project by ID
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Check membership
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const project = await projectService.getProjectById(projectId);
    res.json({ success: true, project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join project via invite code
router.post('/join', validate('joinProject'), async (req, res) => {
  try {
    const { inviteCode, discussionId } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code required' });
    }

    const project = await projectService.joinProject(inviteCode, req.user.userId);
    
    let alreadyMember = false;
    let addedToDiscussion = false;
    
    // Check if user was already a member
    const isMember = await projectService.isProjectMember(project._id, req.user.userId);
    if (isMember) {
      alreadyMember = true;
    }
    
    // If discussionId is provided, also join that specific discussion —
    // but only if it belongs to the project the invite code is for.
    if (discussionId) {
      try {
        const discussion = await discussionService.getDiscussionById(discussionId);
        if (discussion && discussion.projectId.toString() === project._id.toString()) {
          await discussionService.joinDiscussion(discussionId, req.user.userId);
          addedToDiscussion = true;
        }
      } catch (discussionError) {
        console.error('Failed to join discussion:', discussionError);
      }
    }
    
    res.json({ 
      success: true, 
      project, 
      discussionId,
      alreadyMember,
      addedToDiscussion
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Preview invite info (without joining)
router.post('/invite-preview', async (req, res) => {
  try {
    const { inviteCode, discussionId } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code required' });
    }

    // Find project by invite code
    const Project = (await import('../models/Project.js')).default;
    const project = await Project.findOne({ inviteCode }).lean();
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Invalid invite code' });
    }

    // Check if user is already a member
    const isMember = await projectService.isProjectMember(project._id, req.user.userId);
    
    let discussionInfo = null;
    if (discussionId) {
      const discussion = await discussionService.getDiscussionById(discussionId);
      if (discussion && discussion.projectId.toString() === project._id.toString()) {
        discussionInfo = {
          id: discussion._id,
          title: discussion.title,
          isParticipant: discussion.participants.some(p => p.toString() === req.user.userId.toString())
        };
      }
    }

    res.json({
      success: true,
      project: {
        id: project._id,
        title: project.title,
        memberCount: project.members?.length || 0
      },
      isMember,
      discussion: discussionInfo
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Send project invite email
router.post('/:projectId/invite-email', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    // Check if requester is project owner or member
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Get project details
    const project = await projectService.getProjectById(projectId);
    
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;
    
    // Send email
    await emailService.sendProjectInvite({
      to: email,
      inviterName: req.user.username,
      projectTitle: project.title,
      inviteCode: project.inviteCode
    });

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending project invite email:', error);
    res.status(500).json({ success: false, error: 'Failed to send invitation email' });
  }
});

// Update project stage
router.patch('/:projectId/stage', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { stage } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update stage' });
    }

    const project = await projectService.updateProjectStage(projectId, stage);
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update project (general)
router.put('/:projectId', validate('updateProject'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeLLM, stage } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update project' });
    }

    const updates = {};
    if (activeLLM) updates.activeLLM = activeLLM;
    if (stage) updates.stage = stage;

    const project = await projectService.updateProject(projectId, updates);
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update LLM configuration
router.put('/:projectId/llm', validate('updateLLM'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { activeLLM } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can update LLM' });
    }

    const project = await projectService.updateProject(projectId, { activeLLM });
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Save API key for provider
router.post('/:projectId/api-key', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { provider, apiKey } = req.body;

    // Check if owner
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can set API keys' });
    }

    if (!provider || !apiKey) {
      return res.status(400).json({ success: false, error: 'Provider and API key required' });
    }

    // Store API key in project's apiKeys map
    const project = await projectService.setProjectApiKey(projectId, provider, apiKey);
    res.json({ success: true, message: 'API key saved successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get project discussions
router.get('/:projectId/discussions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const discussions = await discussionService.getProjectDiscussions(projectId);

    // Attach latest summary metadata to each non-main discussion so the
    // frontend can show stale indicators without extra round-trips.
    const enriched = await Promise.all(discussions.map(async (disc) => {
      if (disc.isMain) return disc;
      const latestSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
      const latest = latestSummaries[0] || null;
      return {
        ...disc,
        latestSummary: latest ? {
          _id: latest._id,
          createdAt: latest.createdAt,
          messageCountAtSummary: latest.messageCountAtSummary || 0
        } : null
      };
    }));

    res.json({ success: true, discussions: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create parallel discussion
router.post('/:projectId/discussions', validate('createDiscussion'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, description } = req.body;
    const name = title || req.body.name; // Fallback for backwards compatibility

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    // Get project to find owner
    const project = await projectService.getProjectById(projectId);
    
    const discussion = await discussionService.createDiscussion(
      projectId,
      name || 'New Discussion',
      description,
      req.user.userId,
      project.ownerId
    );

    res.json({ success: true, discussion });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get discussion messages (paginated — pass ?before=<messageId> for older pages)
router.get('/:projectId/discussions/:discussionId/messages', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { before } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion || discussion.projectId.toString() !== projectId) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }

    const messages = await discussionService.getMessagesBefore(discussionId, before, limit);
    res.json({ success: true, messages, hasMore: messages.length === limit });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Invite member to discussion
router.post('/:projectId/discussions/:discussionId/invite', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { userId } = req.body;

    // Check if requester is in the discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }

    // Check if requester is project owner OR discussion participant
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    const isParticipant = discussion.participants.some(
      p => p.toString() === req.user.userId.toString()
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ success: false, error: 'Not authorized to invite members' });
    }

    // Check if invitee is project member
    const isMember = await projectService.isProjectMember(projectId, userId);
    if (!isMember) {
      return res.status(400).json({ success: false, error: 'User is not a project member' });
    }

    // Add to discussion
    await discussionService.joinDiscussion(discussionId, userId);

    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Send discussion invite email
router.post('/:projectId/discussions/:discussionId/invite-email', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { email, discussionTitle } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }

    // Check if requester is in the discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }

    // Check if requester is project owner OR discussion participant
    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    const isParticipant = discussion.participants.some(
      p => p.toString() === req.user.userId.toString()
    );

    if (!isOwner && !isParticipant) {
      return res.status(403).json({ success: false, error: 'Not authorized to send invites' });
    }

    // Get project details
    const project = await projectService.getProjectById(projectId);
    
    // Import email service
    const emailService = (await import('../services/emailService.js')).default;
    
    // Send email with invite code and discussion ID
    await emailService.sendDiscussionInvite({
      to: email,
      inviterName: req.user.username,
      projectTitle: project.title,
      discussionTitle: discussionTitle || discussion.title,
      inviteCode: project.inviteCode,
      discussionId
    });

    res.json({ success: true, message: 'Invitation sent successfully' });
  } catch (error) {
    console.error('Error sending discussion invite email:', error);
    res.status(500).json({ success: false, error: 'Failed to send invitation email' });
  }
});

// Get project documents
router.get('/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const documents = await documentService.getProjectDocuments(projectId);
    res.json({ success: true, documents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint: Get document chunks with embeddings
router.get('/:projectId/documents/:documentId/chunks', async (req, res) => {
  try {
    const { projectId, documentId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    // Document must belong to this project
    const Document = (await import('../models/Document.js')).default;
    const doc = await Document.findOne({ _id: documentId, projectId }).select('_id').lean();
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const chunks = await documentService.getDocumentChunks(documentId);
    res.json({ success: true, chunks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload document for context
router.post('/:projectId/documents', validate('uploadDocument'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { title, content, fileType } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    // Normalize fileType to match enum values
    let normalizedFileType = 'text';
    if (fileType) {
      if (fileType.includes('pdf')) {
        normalizedFileType = 'pdf';
      } else {
        normalizedFileType = 'text';
      }
    }

    const document = await documentService.uploadDocument(
      projectId,
      title,
      content,
      normalizedFileType,
      req.user.userId
    );

    res.json({ success: true, document });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete document (project owner or the uploader)
router.delete('/:projectId/documents/:documentId', async (req, res) => {
  try {
    const { projectId, documentId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const document = await documentService.getDocumentById(documentId);
    if (!document || document.projectId.toString() !== projectId) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    const isUploader = document.uploadedBy?._id?.toString() === req.user.userId.toString();
    if (!isOwner && !isUploader) {
      return res.status(403).json({ success: false, error: 'Only the owner or uploader can delete this document' });
    }

    await documentService.deleteDocument(documentId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get project summaries
router.get('/:projectId/summaries', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const summaries = await summaryService.getProjectSummaries(projectId);
    res.json({ success: true, summaries });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate summary for discussion
router.post('/:projectId/discussions/:discussionId/summarize', async (req, res) => {
  try {
    const { projectId, discussionId } = req.params;
    const { customPrompt } = req.body; // Optional custom instructions

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    // Prevent summarizing the main discussion
    const discussion = await discussionService.getDiscussionById(discussionId);
    if (!discussion) {
      return res.status(404).json({ success: false, error: 'Discussion not found' });
    }
    if (discussion.isMain) {
      return res.status(400).json({ success: false, error: 'Cannot summarize the main thread' });
    }

    const project = await projectService.getProjectById(projectId);
    const summaryContent = await aiService.generateSummary(
      projectId,
      discussionId,
      project.activeLLM,
      customPrompt
    );

    // Capture message count at time of summarization
    const messageCountAtSummary = discussion.messageCount || 0;

    const summary = await summaryService.createSummary(
      projectId,
      discussionId,
      summaryContent,
      'discussion',
      project.activeLLM.provider,
      messageCountAtSummary
    );

    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update/regenerate summary with custom prompt
router.put('/:projectId/discussions/:discussionId/summaries/:summaryId', async (req, res) => {
  try {
    const { projectId, discussionId, summaryId } = req.params;
    const { customPrompt } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    if (!customPrompt) {
      return res.status(400).json({ success: false, error: 'Custom prompt required' });
    }

    const project = await projectService.getProjectById(projectId);
    
    // Get existing summary — must belong to this project
    const existingSummary = await summaryService.getSummaryById(summaryId);
    if (!existingSummary || existingSummary.projectId.toString() !== projectId) {
      return res.status(404).json({ success: false, error: 'Summary not found' });
    }

    // Regenerate with custom prompt
    const newContent = await aiService.regenerateSummary(
      projectId,
      discussionId,
      existingSummary.content,
      customPrompt,
      project.activeLLM
    );

    // Update the summary
    const updatedSummary = await summaryService.updateSummary(summaryId, newContent);

    res.json({ success: true, summary: updatedSummary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete summary
router.delete('/:projectId/discussions/:discussionId/summaries/:summaryId', async (req, res) => {
  try {
    const { projectId, summaryId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const summary = await summaryService.getSummaryById(summaryId);
    if (!summary || summary.projectId.toString() !== projectId) {
      return res.status(404).json({ success: false, error: 'Summary not found' });
    }

    await summaryService.deleteSummary(summaryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Add to project memory (optimistic — saves immediately, normalizes async)
router.post('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { messageId } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const Message = (await import('../models/Message.js')).default;

    // Message must belong to this project; derive discussionId from the
    // message itself rather than trusting the request body.
    const message = await Message.findOne({ _id: messageId, projectId });
    if (!message) return res.status(404).json({ success: false, error: 'Message not found' });
    const discussionId = message.discussionId;

    const existingDecision = await Decision.findOne({ sourceMessageId: messageId });
    if (existingDecision) {
      return res.json({ success: true, decision: existingDecision, message: 'Already saved' });
    }

    // Save immediately with raw text
    const decision = await Decision.create({
      projectId,
      text: message.text,
      rationale: '',
      proposedBy: { userId: message.userId, username: message.user },
      sourceMessageId: messageId,
      discussionId
    });

    // Broadcast to discussion that this message was saved
    connectionManager.broadcastToDiscussion(discussionId, {
      type: 'message-saved',
      messageId: messageId
    });

    dashboardCache.invalidate(projectId);

    // Respond instantly
    res.json({ success: true, decision });

    // Background: normalize via LLM, then embed the decision
    (async () => {
      try {
        const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
        const project = await projectService.getProjectById(projectId);
        const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.\nSpeaker: ${message.user}\nRaw message: "${message.text}"\n\nWrite a single clean declarative statement capturing the decision made. Rules:\n- Start with a verb or technology name\n- Maximum 15 words\n- Never use first person\n- Never quote the raw text verbatim\n- If the message contains a clear reason, extract it as rationale separately\n\nReturn ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}\nRationale can be empty string if no clear reason given.`;

        const crypto = await import('crypto');
        const llmConfig = project.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };
        const selectedModel = AIOrchestrator.selectModel(llmConfig);
        const response = await AIOrchestrator.callProvider({
          requestId: crypto.randomUUID(), 
          provider: selectedModel.provider,
          model: selectedModel.model, 
          prompt, 
          systemPrompt: 'You are an AI decision extractor.',
          projectId, 
          userId: req.user.userId, 
          maxTokens: 1024
        });
        const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        await Decision.findByIdAndUpdate(decision._id, { text: parsed.text, rationale: parsed.rationale || '' });
      } catch (e) {
        console.warn('[decision-normalize] Background normalization failed:', e.message);
      }
      // Embed the decision for semantic retrieval
      try {
        const EmbeddingService = (await import('../core/embeddings/EmbeddingService.js')).default;
        const updatedDecision = await Decision.findById(decision._id);
        const textToEmbed = updatedDecision.text + (updatedDecision.rationale ? '. ' + updatedDecision.rationale : '');
        const embedding = await EmbeddingService.embedText(textToEmbed);
        if (embedding) {
          await Decision.findByIdAndUpdate(decision._id, { embedding, embeddingStatus: 'done' });
          console.log('[decision-embed] Decision embedded successfully:', decision._id);
        }
      } catch (e) {
        await Decision.findByIdAndUpdate(decision._id, { embeddingStatus: 'failed' });
        console.warn('[decision-embed] Embedding failed:', e.message);
      }
    })();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get decision log
router.get('/:projectId/decisions', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const Decision = (await import('../models/Decision.js')).default;
    const decisions = await Decision.find({ projectId }).sort({ timestamp: -1 });

    res.json({ success: true, decisions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Intelligence dashboard — entity knowledge graph + project state
router.get('/:projectId/dashboard', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const cached = dashboardCache.get(projectId);
    if (cached) {
      return res.json({ success: true, dashboard: cached, cached: true });
    }

    const Topic = (await import('../models/Topic.js')).default;
    const Blocker = (await import('../models/Blocker.js')).default;
    const ActionItem = (await import('../models/ActionItem.js')).default;
    const ProjectState = (await import('../models/ProjectState.js')).default;

    const [projectState, topics, blockers, actionItems, decisions] = await Promise.all([
      ProjectState.findOne({ projectId }).lean(),
      Topic.find({ projectId, status: 'stable' }).sort({ occurrenceCount: -1 }).lean(),
      Blocker.find({ projectId, resolved: false }).sort({ occurrenceCount: -1, raisedAt: -1 }).lean(),
      ActionItem.find({ projectId, status: 'open' }).sort({ occurrenceCount: -1 }).lean(),
      Decision.find({ projectId }).sort({ timestamp: -1 }).lean()
    ]);

    // Surface rule: blockers shown when occurrenceCount >= 2 OR severity high.
    const surfacedBlockers = blockers.filter(b => b.occurrenceCount >= 2 || b.severity === 'high');

    const dashboard = {
      projectState: projectState || {
        stage: 'ideation', momentum: 'stable',
        openBlockerCount: 0, unresolvedActionCount: 0, activeTopicCount: 0, decisionCount: decisions.length
      },
      topics,
      blockers: surfacedBlockers,
      actionItems,
      decisions
    };

    dashboardCache.set(projectId, dashboard);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// After any knowledge-graph mutation, refresh the ProjectState rollup
// (non-blocking — the response shouldn't wait on it).
function refreshProjectState(projectId) {
  dashboardCache.invalidate(projectId);
  import('../core/intelligence/KnowledgeAggregator.js')
    .then(({ default: aggregator }) => aggregator.recomputeProjectState(projectId))
    .catch(err => console.warn('[project-state] Recompute failed:', err.message));
}

// Resolve or reopen a blocker
router.patch('/:projectId/blockers/:blockerId', async (req, res) => {
  try {
    const { projectId, blockerId } = req.params;
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) return res.status(403).json({ success: false, error: 'Not a project member' });

    const resolved = req.body.resolved !== false; // default: resolve

    const Blocker = (await import('../models/Blocker.js')).default;
    const blocker = await Blocker.findOneAndUpdate(
      { _id: blockerId, projectId },
      { resolved },
      { new: true }
    );
    if (!blocker) return res.status(404).json({ success: false, error: 'Blocker not found' });

    refreshProjectState(projectId);
    res.json({ success: true, blocker });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark an action item done or reopen it
router.patch('/:projectId/action-items/:actionId', async (req, res) => {
  try {
    const { projectId, actionId } = req.params;
    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) return res.status(403).json({ success: false, error: 'Not a project member' });

    const status = req.body.status === 'open' ? 'open' : 'done';

    const ActionItem = (await import('../models/ActionItem.js')).default;
    const item = await ActionItem.findOneAndUpdate(
      { _id: actionId, projectId },
      { status },
      { new: true }
    );
    if (!item) return res.status(404).json({ success: false, error: 'Action item not found' });

    refreshProjectState(projectId);
    res.json({ success: true, actionItem: item });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete a knowledge artifact (wrong extractions shouldn't be permanent)
const ARTIFACT_MODELS = {
  decisions: '../models/Decision.js',
  blockers: '../models/Blocker.js',
  'action-items': '../models/ActionItem.js',
  topics: '../models/Topic.js'
};

for (const [resource, modelPath] of Object.entries(ARTIFACT_MODELS)) {
  router.delete(`/:projectId/${resource}/:artifactId`, async (req, res) => {
    try {
      const { projectId, artifactId } = req.params;
      const isMember = await projectService.isProjectMember(projectId, req.user.userId);
      if (!isMember) return res.status(403).json({ success: false, error: 'Not a project member' });

      const Model = (await import(modelPath)).default;
      const deleted = await Model.findOneAndDelete({ _id: artifactId, projectId });
      if (!deleted) return res.status(404).json({ success: false, error: 'Not found' });

      refreshProjectState(projectId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
}

// Leave project (members only — the owner must delete or transfer instead)
router.post('/:projectId/leave', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (isOwner) {
      return res.status(400).json({ success: false, error: 'The owner cannot leave their own project. Delete it instead.' });
    }

    await projectService.removeMember(projectId, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove a member (owner only, not themselves)
router.delete('/:projectId/members/:memberId', async (req, res) => {
  try {
    const { projectId, memberId } = req.params;

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only the owner can remove members' });
    }

    if (memberId === req.user.userId.toString()) {
      return res.status(400).json({ success: false, error: 'Owner cannot remove themselves' });
    }

    const isMember = await projectService.isProjectMember(projectId, memberId);
    if (!isMember) {
      return res.status(404).json({ success: false, error: 'User is not a project member' });
    }

    await projectService.removeMember(projectId, memberId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete project and everything in it (owner only)
router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only the owner can delete the project' });
    }

    await projectService.deleteProject(projectId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

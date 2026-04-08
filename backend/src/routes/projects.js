import express from 'express';
import { authenticate } from '../middleware/auth.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import documentService from '../services/documentService.js';
import summaryService from '../services/summaryService.js';
import aiService from '../services/aiService.js';
import ProjectInsights from '../models/ProjectInsights.js';
import StrategicSignalEngine from '../core/intelligence/StrategicSignalEngine.js';
// Entity knowledge model
import Topic from '../models/Topic.js';
import Decision from '../models/Decision.js';
import Blocker from '../models/Blocker.js';
import ActionItem from '../models/ActionItem.js';
import ProjectState from '../models/ProjectState.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Create project
router.post('/', async (req, res) => {
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
router.post('/join', async (req, res) => {
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
    
    // If discussionId is provided, also join that specific discussion
    if (discussionId) {
      try {
        await discussionService.joinDiscussion(discussionId, req.user.userId);
        addedToDiscussion = true;
        console.log(`User ${req.user.userId} joined discussion ${discussionId}`);
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
      if (discussion) {
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
router.patch('/:projectId', async (req, res) => {
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
router.put('/:projectId/llm', async (req, res) => {
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
router.post('/:projectId/discussions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

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

    const chunks = await documentService.getDocumentChunks(documentId);
    res.json({ success: true, chunks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload document
router.post('/:projectId/documents', async (req, res) => {
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

    // Trigger intelligence pipeline on the summary content so parallel discussion
    // ideas enter the knowledge model only when explicitly promoted via summary.
    try {
      const InsightExtractor = (await import('../core/intelligence/InsightExtractor.js')).default;
      const KnowledgeAggregator = (await import('../core/intelligence/KnowledgeAggregator.js')).default;
      const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;

      const llmConfig = project.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };
      const extracted = await InsightExtractor.extractFromMessage({
        projectId,
        discussionId,
        messageId: summary._id,
        text: summaryContent,
        username: 'Thread Summary',
        isAI: false,
        llmConfig,
        callProvider: AIOrchestrator.callProvider.bind(AIOrchestrator),
        bypassRateLimit: true
      });

      await KnowledgeAggregator.mergeInsights({
        projectId,
        discussionId,
        extracted: { ...extracted, messageId: summary._id }
      });
    } catch (pipelineErr) {
      // Non-critical — summary is already saved
      console.warn('Pipeline on summary failed (non-critical):', pipelineErr.message);
    }

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
    
    // Get existing summary
    const existingSummary = await summaryService.getSummaryById(summaryId);
    if (!existingSummary) {
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

    await summaryService.deleteSummary(summaryId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Force-refresh dashboard: re-runs extraction on main thread, then returns fresh dashboard
router.post('/:projectId/dashboard/refresh', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can refresh dashboard' });
    }

    const project = await projectService.getProjectById(projectId);
    const discussions = await discussionService.getProjectDiscussions(projectId);
    const mainDiscussion = discussions.find(d => d.isMain);

    if (mainDiscussion) {
      try {
        const InsightExtractor = (await import('../core/intelligence/InsightExtractor.js')).default;
        const KnowledgeAggregator = (await import('../core/intelligence/KnowledgeAggregator.js')).default;
        const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;

        const llmConfig = project.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };
        const extracted = await InsightExtractor.forceExtractForProject({
          projectId,
          discussionId: mainDiscussion._id,
          llmConfig,
          callProvider: AIOrchestrator.callProvider.bind(AIOrchestrator)
        });

        await KnowledgeAggregator.mergeInsights({
          projectId,
          discussionId: mainDiscussion._id,
          extracted
        });
      } catch (pipelineErr) {
        console.warn('Force extraction failed (non-critical):', pipelineErr.message);
      }
    }

    // Return fresh dashboard after extraction
    const result = await buildDashboardResponse(projectId);
    return res.json({ success: true, dashboard: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get dashboard insights (owner only)
// Reads from entity model if available, falls back to ProjectInsights, then LLM.
router.get('/:projectId/dashboard', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const dashboard = await buildDashboardResponse(projectId);
    return res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Shared dashboard builder — used by both GET and POST /refresh
// ---------------------------------------------------------------------------
async function buildDashboardResponse(projectId) {
    // --- Shared metrics (always computed regardless of source) ---
    const [discussions, documents] = await Promise.all([
      discussionService.getProjectDiscussions(projectId),
      documentService.getProjectDocuments(projectId)
    ]);

    // Load all messages once to avoid repeated queries
    const allDiscMessages = await Promise.all(
      discussions.map(d => discussionService.getDiscussionMessages(d._id))
    );

    let totalMessages = 0;
    const activityByDay = Array(7).fill(0);
    const participantStats = {};
    const discussionStats = [];
    let userMessages = 0;
    let aiMessages = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    discussions.forEach((disc, i) => {
      const messages = allDiscMessages[i];
      totalMessages += messages.length;
      discussionStats.push({ title: disc.title, count: messages.length, isMain: disc.isMain });

      messages.forEach(msg => {
        if (msg.isAI) aiMessages++;
        else userMessages++;

        const msgDate = new Date(msg.timestamp);
        if (msgDate >= sevenDaysAgo) {
          const daysAgo = Math.floor((Date.now() - msgDate.getTime()) / 86400000);
          if (daysAgo < 7) activityByDay[6 - daysAgo]++;
        }

        const username = msg.user?.username || msg.user || 'Unknown';
        if (!msg.isAI && username !== 'Unknown') {
          participantStats[username] = (participantStats[username] || 0) + 1;
        }
      });
    });

    const topParticipants = Object.entries(participantStats)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topDiscussions = [...discussionStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sharedMetrics = {
      totalMessages,
      activeDiscussions: discussions.length,
      documentCount: documents.length,
      activity: activityByDay,
      participants: topParticipants,
      discussionBreakdown: topDiscussions,
      messageTypes: { user: userMessages, ai: aiMessages }
    };

    // Strategic signals — always computed
    const signals = await StrategicSignalEngine.generateSignals({ projectId });

    // --- Route to correct data source ---
    const hasEntityModel = await ProjectState.exists({ projectId });

    if (hasEntityModel) {
      return buildEntityDashboard(projectId, sharedMetrics, signals);
    }

    // Legacy: ProjectInsights
    const insights = await ProjectInsights.findOne({ projectId }).lean();
    if (insights) {
      return buildLegacyDashboard(insights, sharedMetrics, signals);
    }

    // Last resort: LLM generation
    const project = await projectService.getProjectById(projectId);
    const llmInsights = await aiService.generateDashboardInsights(projectId, project.activeLLM);
    return buildLLMDashboard(llmInsights, sharedMetrics, signals);
}

// ---------------------------------------------------------------------------
// Entity model dashboard builder
// ---------------------------------------------------------------------------
async function buildEntityDashboard(projectId, sharedMetrics, signals) {
  const [projectState, topics, decisions, blockers, actionItems, supersededDecisions] = await Promise.all([
    ProjectState.findOne({ projectId }).lean(),
    Topic.find({ projectId, status: 'stable' }).sort({ count: -1 }).limit(8).lean(),
    Decision.find({ projectId, status: 'active', needsHumanValidation: { $ne: true } }).sort({ occurrenceCount: -1, createdAt: -1 }).limit(12).lean(),
    // Show all unresolved blockers — single-instance ones from summaries are real and must be visible
    Blocker.find({ projectId, resolved: false }).sort({ severity: -1, occurrenceCount: -1, createdAt: -1 }).limit(10).lean(),
    ActionItem.find({ projectId, status: { $ne: 'completed' } }).sort({ occurrenceCount: -1, createdAt: -1 }).limit(10).lean(),
    Decision.find({ projectId, status: 'superseded' }).sort({ updatedAt: -1 }).limit(5).lean()
  ]);

  // Build topic name lookup for enrichment
  const topicNameMap = {};
  topics.forEach(t => { topicNameMap[t._id.toString()] = t.name; });

  const now = Date.now();

  // Enrich decisions with topicName + rationale
  const enrichedDecisions = decisions.map(d => ({
    text: d.text,
    rationale: d.rationale || '',
    topicId: d.topicId,
    topicName: d.topicId ? (topicNameMap[d.topicId.toString()] || '') : '',
    timestamp: d.timestamp,
    proposedBy: d.proposedBy?.username || null
  }));

  // Enrich blockers with daysOpen + topicName
  const enrichedBlockers = blockers.map(b => ({
    text: b.text,
    severity: b.severity,
    resolved: b.resolved,
    topicName: b.topicId ? (topicNameMap[b.topicId.toString()] || '') : '',
    daysOpen: b.raisedAt
      ? Math.floor((now - new Date(b.raisedAt).getTime()) / 86400000)
      : 0,
    proposedBy: b.proposedBy?.username || null
  }));

  // Enrich action items with assignee
  const enrichedActions = actionItems.map(a => ({
    text: a.text,
    status: a.status,
    assignee: a.assignee || null,
    topicName: a.topicId ? (topicNameMap[a.topicId.toString()] || '') : '',
    proposedBy: a.proposedBy?.username || null
  }));

  // Enrich superseded decisions with what replaced them
  const enrichedSuperseded = await Promise.all(supersededDecisions.map(async d => {
    let supersededByText = null;
    if (d.supersededBy) {
      const newDecision = await Decision.findById(d.supersededBy).select('text').lean();
      supersededByText = newDecision?.text || null;
    }
    return {
      text: d.text,
      supersededByText,
      timestamp: d.timestamp,
      topicName: d.topicId ? (topicNameMap[d.topicId.toString()] || '') : ''
    };
  }));

  return {
    source: 'entity-model',
    topics: topics.map(t => ({ name: t.name, count: t.count })),
    decisions: enrichedDecisions.map(d => d.text),
    openQuestions: enrichedBlockers.filter(b => !b.resolved).map(b => b.text),
    actionItems: enrichedActions.filter(a => a.status !== 'completed').map(a => a.text),
    stage: projectState?.stage || 'ideation',
    projectSummary: projectState?.summary || '',
    lastUpdated: projectState?.lastUpdated || null,
    enrichedDecisions,
    enrichedBlockers,
    enrichedActions,
    enrichedSuperseded,
    projectState: projectState ? {
      stage: projectState.stage,
      stageReason: projectState.stageReason,
      summary: projectState.summary,
      momentum: projectState.momentum,
      openBlockerCount: projectState.openBlockerCount,
      unresolvedActionCount: projectState.unresolvedActionCount,
      activeTopicCount: projectState.activeTopicCount,
      lastDecisionAt: projectState.lastDecisionAt
    } : null,
    signals,
    ...sharedMetrics
  };
}

// ---------------------------------------------------------------------------
// Legacy ProjectInsights dashboard builder (unchanged behaviour)
// ---------------------------------------------------------------------------
function buildLegacyDashboard(insights, sharedMetrics, signals) {
  const filterGarbage = (items) => {
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const text = (typeof item === 'string' ? item : item?.text || '').toLowerCase().trim();
      if (!text || text.length < 10) return false;
      const garbage = ['none', 'none mentioned', 'no blockers', 'n/a', 'invalid token', 'access denied', 'discuss', 'decide on'];
      return !garbage.some(g => text.includes(g));
    });
  };

  return {
    source: 'persistent',
    topics: insights.topics.map(t => t.name).slice(0, 8),
    decisions: filterGarbage(insights.decisions.map(d => d.text)).slice(0, 8),
    openQuestions: filterGarbage(insights.blockers.filter(b => !b.resolved).map(b => b.text)).slice(0, 8),
    actionItems: filterGarbage(insights.actionItems.filter(a => a.status !== 'completed').map(a => a.text)).slice(0, 8),
    projectSummary: insights.projectSummary || '',
    stage: insights.stage || 'ideation',
    lastUpdated: insights.lastUpdated,
    signals,
    ...sharedMetrics
  };
}

// ---------------------------------------------------------------------------
// LLM fallback dashboard builder (first-time, no data)
// ---------------------------------------------------------------------------
function buildLLMDashboard(llmInsights, sharedMetrics, signals) {
  const filterGarbage = (items) => {
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const text = (typeof item === 'string' ? item : '').toLowerCase().trim();
      return text && text.length >= 10;
    });
  };

  return {
    source: 'llm-generated',
    topics: filterGarbage(llmInsights.topics || []).slice(0, 8),
    decisions: filterGarbage(llmInsights.decisions || []).slice(0, 8),
    openQuestions: filterGarbage(llmInsights.blockers || []).slice(0, 8),
    actionItems: filterGarbage(llmInsights.nextSteps || []).slice(0, 8),
    projectSummary: llmInsights.projectSummary || '',
    stage: llmInsights.stage || 'ideation',
    signals,
    ...sharedMetrics
  };
}

export default router;

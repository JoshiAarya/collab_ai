import express from 'express';
import { authenticate } from '../middleware/auth.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import documentService from '../services/documentService.js';
import summaryService from '../services/summaryService.js';
import aiService from '../services/aiService.js';
import ProjectInsights from '../models/ProjectInsights.js';
import StrategicSignalEngine from '../core/intelligence/StrategicSignalEngine.js';

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
    res.json({ success: true, discussions });
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

    const project = await projectService.getProjectById(projectId);
    const summaryContent = await aiService.generateSummary(
      projectId,
      discussionId,
      project.activeLLM,
      customPrompt
    );

    const summary = await summaryService.createSummary(
      projectId,
      discussionId,
      summaryContent,
      'discussion',
      project.activeLLM.provider
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
// Get dashboard insights (owner only)
// PHASE 3: Now uses persistent ProjectInsights with LLM fallback
// PHASE 5: Now includes strategic signals
router.get('/:projectId/dashboard', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can view dashboard' });
    }

    // Get stats
    const discussions = await discussionService.getProjectDiscussions(projectId);
    const documents = await documentService.getProjectDocuments(projectId);
    
    let totalMessages = 0;
    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id);
      totalMessages += messages.length;
    }

    // PHASE 3: Try to get persistent insights first
    let insights = await ProjectInsights.findOne({ projectId }).lean();

    // PHASE 5: Generate strategic signals (computed dynamically)
    const signals = await StrategicSignalEngine.generateSignals({ projectId });

    // Calculate activity for last 7 days and participant contributions
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activityByDay = Array(7).fill(0);
    const participantStats = {};
    const discussionStats = [];
    
    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id);
      const discMessageCount = messages.length;
      
      discussionStats.push({
        title: disc.title,
        count: discMessageCount,
        isMain: disc.isMain
      });
      
      messages.forEach(msg => {
        // Activity by day
        const msgDate = new Date(msg.timestamp);
        if (msgDate >= sevenDaysAgo) {
          const daysAgo = Math.floor((Date.now() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
          if (daysAgo < 7) {
            activityByDay[6 - daysAgo]++;
          }
        }
        
        // Participant contributions
        const username = msg.user?.username || msg.user || 'Unknown';
        if (!msg.isAI && username !== 'Unknown') {
          participantStats[username] = (participantStats[username] || 0) + 1;
        }
      });
    }
    
    const topParticipants = Object.entries(participantStats)
      .map(([username, count]) => ({ username, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const topDiscussions = discussionStats
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Calculate message type breakdown
    let userMessages = 0;
    let aiMessages = 0;
    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id);
      messages.forEach(msg => {
        if (msg.isAI) aiMessages++;
        else userMessages++;
      });
    }
    
    // Filter function for cleaning up insights
    const filterGarbage = (items) => {
      if (!items || !Array.isArray(items)) return [];
      return items.filter(item => {
        const text = (typeof item === 'string' ? item : item.text || '').toLowerCase().trim();
        if (!text || text.length < 10) return false;
        const garbage = ['none', 'none mentioned', 'no blockers', 'n/a', 'invalid token', 'access denied', 'discuss', 'decide on'];
        return !garbage.some(g => text.includes(g));
      });
    };

    if (insights) {
      // Use persistent insights (fast, deterministic)
      const dashboard = {
        totalMessages,
        activeDiscussions: discussions.length,
        documentCount: documents.length,
        topics: insights.topics.map(t => t.name).slice(0, 8) || [],
        decisions: filterGarbage(insights.decisions.map(d => d.text)).slice(0, 8) || [],
        openQuestions: filterGarbage(insights.blockers.filter(b => !b.resolved).map(b => b.text)).slice(0, 8) || [],
        actionItems: filterGarbage(insights.actionItems.filter(a => a.status !== 'completed').map(a => a.text)).slice(0, 8) || [],
        projectSummary: insights.projectSummary || '',
        lastUpdated: insights.lastUpdated,
        source: 'persistent',
        signals,
        activity: activityByDay,
        stage: insights.stage || 'ideation',
        participants: topParticipants,
        discussionBreakdown: topDiscussions,
        messageTypes: { user: userMessages, ai: aiMessages }
      };

      res.json({ success: true, dashboard });
    } else {
      // Fallback to LLM generation (first time or no data yet)
      const project = await projectService.getProjectById(projectId);
      const llmInsights = await aiService.generateDashboardInsights(projectId, project.activeLLM);
      
      const dashboard = {
        totalMessages,
        activeDiscussions: discussions.length,
        documentCount: documents.length,
        topics: filterGarbage(llmInsights.topics || []).slice(0, 8),
        decisions: filterGarbage(llmInsights.decisions || []).slice(0, 8),
        openQuestions: filterGarbage(llmInsights.blockers || []).slice(0, 8),
        actionItems: filterGarbage(llmInsights.nextSteps || []).slice(0, 8),
        projectSummary: llmInsights.projectSummary || '',
        source: 'llm-generated',
        signals,
        activity: activityByDay,
        stage: llmInsights.stage || 'ideation',
        participants: topParticipants,
        discussionBreakdown: topDiscussions,
        messageTypes: { user: userMessages, ai: aiMessages }
      };

      res.json({ success: true, dashboard });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

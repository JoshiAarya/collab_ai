import express from 'express';
import { authenticate } from '../middleware/auth.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import documentService from '../services/documentService.js';
import summaryService from '../services/summaryService.js';
import aiService from '../services/aiService.js';

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
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ success: false, error: 'Invite code required' });
    }

    const project = await projectService.joinProject(inviteCode, req.user.userId);
    res.json({ success: true, project });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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

    const isParticipant = discussion.participants.some(
      p => p.toString() === req.user.userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Not a discussion participant' });
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

// Upload document
router.post('/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, content, type } = req.body;

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const document = await documentService.uploadDocument(
      projectId,
      name,
      content,
      type || 'text',
      req.user.userId
    );

    res.json({ success: true, document });
  } catch (error) {
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

    const isMember = await projectService.isProjectMember(projectId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Not a project member' });
    }

    const project = await projectService.getProjectById(projectId);
    const summaryContent = await aiService.generateSummary(
      projectId,
      discussionId,
      project.activeLLM
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

// Get dashboard insights (owner only)
router.get('/:projectId/dashboard', async (req, res) => {
  try {
    const { projectId } = req.params;

    const isOwner = await projectService.isProjectOwner(projectId, req.user.userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Only owner can view dashboard' });
    }

    const project = await projectService.getProjectById(projectId);
    const insights = await aiService.generateDashboardInsights(projectId, project.activeLLM);
    
    // Get stats
    const discussions = await discussionService.getProjectDiscussions(projectId);
    const documents = await documentService.getProjectDocuments(projectId);
    
    let totalMessages = 0;
    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id);
      totalMessages += messages.length;
    }

    const dashboard = {
      totalMessages,
      activeDiscussions: discussions.length,
      documentCount: documents.length,
      topics: insights.topics || [],
      decisions: insights.decisions || [],
      openQuestions: insights.blockers || [],
      suggestedNextSteps: insights.nextSteps?.join(', ') || 'Continue collaboration'
    };

    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

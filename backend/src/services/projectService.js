import Project from '../models/Project.js';
import Discussion from '../models/Discussion.js';
import User from '../models/User.js';
import crypto from 'crypto';

class ProjectService {
  // Create new project
  async createProject(title, problemStatement, ownerId) {
    try {
      const inviteCode = crypto.randomBytes(4).toString('hex');

      const project = new Project({
        title: title.trim(),
        problemStatement,
        ownerId,
        members: [{
          userId: ownerId,
          role: 'owner'
        }],
        inviteCode,
        activeLLM: {
          provider: 'server',
          model: 'llama-3.1-8b-instant'
        }
      });

      await project.save();

      // Create main discussion
      const mainDiscussion = new Discussion({
        projectId: project._id,
        title: 'Main Discussion',
        description: 'Primary project discussion',
        isMain: true,
        participants: [ownerId]
      });

      await mainDiscussion.save();

      // Add project to user
      await User.findByIdAndUpdate(ownerId, {
        $addToSet: { projects: project._id }
      });

      return project;
    } catch (error) {
      console.error('Error creating project:', error);
      throw error;
    }
  }

  // Get project by ID
  async getProjectById(projectId) {
    try {
      const project = await Project.findById(projectId)
        .populate('ownerId', 'username email')
        .populate('members.userId', 'username email')
        .lean();
      return project;
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  }

  // Get user's projects
  async getUserProjects(userId) {
    try {
      const projects = await Project.find({
        'members.userId': userId
      })
      .populate('ownerId', 'username email')
      .populate('members.userId', 'username email')
      .sort({ updatedAt: -1 })
      .lean();

      return projects;
    } catch (error) {
      console.error('Error getting user projects:', error);
      return [];
    }
  }

  // Join project via invite code
  async joinProject(inviteCode, userId) {
    try {
      const project = await Project.findOne({ inviteCode });

      if (!project) {
        throw new Error('Invalid invite code');
      }

      // Check if already a member
      const isMember = project.members.some(
        m => m.userId.toString() === userId.toString()
      );

      if (isMember) {
        return project;
      }

      // Add member
      project.members.push({
        userId,
        role: 'member'
      });

      await project.save();

      // Add project to user
      await User.findByIdAndUpdate(userId, {
        $addToSet: { projects: project._id }
      });

      // Add to main discussion only (not all discussions)
      await Discussion.findOneAndUpdate(
        { projectId: project._id, isMain: true },
        { $addToSet: { participants: userId } }
      );

      return project;
    } catch (error) {
      console.error('Error joining project:', error);
      throw error;
    }
  }

  // Update project stage
  async updateProjectStage(projectId, stage) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        { stage },
        { new: true }
      );
      return project;
    } catch (error) {
      console.error('Error updating project stage:', error);
      throw error;
    }
  }

  // Update active LLM
  async updateActiveLLM(projectId, llmConfig) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        { activeLLM: llmConfig },
        { new: true }
      );
      return project;
    } catch (error) {
      console.error('Error updating LLM:', error);
      throw error;
    }
  }

  // Update project (general)
  async updateProject(projectId, updates) {
    try {
      const project = await Project.findByIdAndUpdate(
        projectId,
        updates,
        { new: true }
      ).populate('ownerId', 'username email');
      return project;
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  }

  // Check if user is project member
  async isProjectMember(projectId, userId) {
    try {
      const project = await Project.findById(projectId);
      if (!project) return false;

      return project.members.some(
        m => m.userId.toString() === userId.toString()
      );
    } catch (error) {
      return false;
    }
  }

  // Check if user is project owner
  async isProjectOwner(projectId, userId) {
    try {
      const project = await Project.findById(projectId);
      if (!project) return false;

      return project.ownerId.toString() === userId.toString();
    } catch (error) {
      return false;
    }
  }
}

export default new ProjectService();

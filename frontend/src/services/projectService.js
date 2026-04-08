/**
 * Project Service
 * Handles all project-related API operations
 */

import apiService from './api.js';
import config from '../config/index.js';

class ProjectService {
  /**
   * Get user's projects
   */
  async getProjects() {
    return await apiService.get(config.api.projects.list);
  }

  /**
   * Create new project
   */
  async createProject(title, problemStatement) {
    return await apiService.post(config.api.projects.create, {
      title,
      problemStatement
    });
  }

  /**
   * Get project by ID
   */
  async getProject(projectId) {
    return await apiService.get(config.api.projects.get(projectId));
  }

  /**
   * Update project
   */
  async updateProject(projectId, updates) {
    return await apiService.put(config.api.projects.update(projectId), updates);
  }

  /**
   * Join project with invite code
   */
  async joinProject(inviteCode) {
    return await apiService.post(config.api.projects.join, { inviteCode });
  }

  /**
   * Update project stage
   */
  async updateStage(projectId, stage) {
    return await apiService.patch(config.api.projects.update(projectId), { stage });
  }

  /**
   * Update active LLM
   */
  async updateLLM(projectId, llmConfig) {
    return await apiService.patch(config.api.projects.update(projectId), {
      activeLLM: llmConfig
    });
  }

  /**
   * Get project discussions
   */
  async getDiscussions(projectId) {
    return await apiService.get(config.api.projects.discussions(projectId));
  }

  /**
   * Create discussion
   */
  async createDiscussion(projectId, title, description, parentDiscussionId = null) {
    return await apiService.post(config.api.discussions.create(projectId), {
      title,
      description,
      parentDiscussionId
    });
  }

  /**
   * Get discussion messages
   */
  async getMessages(projectId, discussionId, limit = 50) {
    return await apiService.get(
      `${config.api.discussions.messages(projectId, discussionId)}?limit=${limit}`
    );
  }

  /**
   * Get project documents
   */
  async getDocuments(projectId) {
    return await apiService.get(config.api.projects.documents(projectId));
  }

  /**
   * Upload document
   */
  async uploadDocument(projectId, title, content, fileType = 'text') {
    return await apiService.post(config.api.documents.upload(projectId), {
      title,
      content,
      fileType
    });
  }

  /**
   * Delete document
   */
  async deleteDocument(projectId, documentId) {
    return await apiService.delete(config.api.documents.delete(projectId, documentId));
  }

  /**
   * Generate summary
   */
  async generateSummary(projectId, discussionId) {
    return await apiService.post(config.api.projects.summary(projectId), {
      discussionId
    });
  }

  /**
   * Get pending signals
   */
  async getPendingSignals(projectId) {
    const res = await apiService.get(`/api/projects/${projectId}/signals/pending`);
    return res.signals;
  }

  /**
   * Confirm pending signal
   */
  async confirmSignal(projectId, signalId) {
    return await apiService.post(`/api/projects/${projectId}/signals/${signalId}/confirm`);
  }

  /**
   * Dismiss pending signal
   */
  async dismissSignal(projectId, signalId) {
    return await apiService.post(`/api/projects/${projectId}/signals/${signalId}/dismiss`);
  }
}

export default new ProjectService();

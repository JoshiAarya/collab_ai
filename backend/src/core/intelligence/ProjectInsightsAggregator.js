/**
 * ProjectInsightsAggregator - PHASE 3
 * Incrementally merges extracted insights into persistent storage
 * Handles deduplication and aggregation logic
 */

import ProjectInsights from '../../models/ProjectInsights.js';
import logger from '../../utils/logger.js';

class ProjectInsightsAggregator {
  /**
   * Merge extracted insights into project intelligence
   * @param {Object} params - Merge parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.discussionId - Discussion ID
   * @param {Object} params.extracted - Extracted insights structure
   */
  async mergeInsights({ projectId, discussionId, extracted }) {
    try {
      logger.ai('Merging insights', {
        projectId,
        discussionId,
        topicsCount: extracted.topics?.length || 0,
        decisionsCount: extracted.decisions?.length || 0,
        blockersCount: extracted.blockers?.length || 0,
        actionItemsCount: extracted.actionItems?.length || 0
      });

      // Get or create project insights document
      let insights = await ProjectInsights.findOne({ projectId });

      if (!insights) {
        insights = new ProjectInsights({
          projectId,
          topics: [],
          decisions: [],
          blockers: [],
          actionItems: []
        });
      }

      // Merge topics (increment count if exists, add if new)
      this.mergeTopics(insights, extracted.topics);

      // Merge decisions (deduplicate)
      this.mergeDecisions(insights, extracted.decisions, discussionId);

      // Merge blockers (deduplicate)
      this.mergeBlockers(insights, extracted.blockers, discussionId);

      // Merge action items (deduplicate)
      this.mergeActionItems(insights, extracted.actionItems, discussionId);

      // Update timestamp
      insights.lastUpdated = new Date();

      // Save
      await insights.save();

      logger.ai('Insights merged successfully', {
        projectId,
        totalTopics: insights.topics.length,
        totalDecisions: insights.decisions.length,
        totalBlockers: insights.blockers.length,
        totalActionItems: insights.actionItems.length
      });

    } catch (error) {
      logger.error('Failed to merge insights', {
        projectId,
        discussionId,
        error: error.message,
        stack: error.stack
      });
      // Don't throw - this is non-critical
    }
  }

  /**
   * Merge topics - increment count if exists, add if new
   */
  mergeTopics(insights, newTopics) {
    if (!newTopics || newTopics.length === 0) return;

    newTopics.forEach(topicName => {
      const normalized = this.normalizeText(topicName);
      if (!normalized) return;

      // Find existing topic (case-insensitive)
      const existing = insights.topics.find(
        t => this.normalizeText(t.name) === normalized
      );

      if (existing) {
        // Increment count
        existing.count += 1;
      } else {
        // Add new topic
        insights.topics.push({
          name: topicName.trim(),
          count: 1
        });
      }
    });
  }

  /**
   * Merge decisions - deduplicate by normalized text
   */
  mergeDecisions(insights, newDecisions, discussionId) {
    if (!newDecisions || newDecisions.length === 0) return;

    newDecisions.forEach(decisionText => {
      const normalized = this.normalizeText(decisionText);
      if (!normalized) return;

      // Check if similar decision already exists
      const isDuplicate = insights.decisions.some(
        d => this.normalizeText(d.text) === normalized
      );

      if (!isDuplicate) {
        insights.decisions.push({
          text: decisionText.trim(),
          discussionId,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Merge blockers - deduplicate by normalized text
   */
  mergeBlockers(insights, newBlockers, discussionId) {
    if (!newBlockers || newBlockers.length === 0) return;

    newBlockers.forEach(blockerText => {
      const normalized = this.normalizeText(blockerText);
      if (!normalized) return;

      // Check if similar blocker already exists (only check unresolved)
      const isDuplicate = insights.blockers.some(
        b => !b.resolved && this.normalizeText(b.text) === normalized
      );

      if (!isDuplicate) {
        insights.blockers.push({
          text: blockerText.trim(),
          severity: this.inferSeverity(blockerText),
          resolved: false,
          discussionId,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Merge action items - deduplicate by normalized text
   */
  mergeActionItems(insights, newActionItems, discussionId) {
    if (!newActionItems || newActionItems.length === 0) return;

    newActionItems.forEach(actionText => {
      const normalized = this.normalizeText(actionText);
      if (!normalized) return;

      // Check if similar action item already exists (only check open/in-progress)
      const isDuplicate = insights.actionItems.some(
        a => a.status !== 'completed' && this.normalizeText(a.text) === normalized
      );

      if (!isDuplicate) {
        insights.actionItems.push({
          text: actionText.trim(),
          status: 'open',
          discussionId,
          timestamp: new Date()
        });
      }
    });
  }

  /**
   * Normalize text for comparison (lowercase, trim, remove punctuation)
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Infer severity from blocker text (simple heuristic)
   */
  inferSeverity(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('critical') || lowerText.includes('urgent') || lowerText.includes('blocking')) {
      return 'high';
    }
    
    if (lowerText.includes('minor') || lowerText.includes('small')) {
      return 'low';
    }
    
    return 'medium';
  }
}

export default new ProjectInsightsAggregator();

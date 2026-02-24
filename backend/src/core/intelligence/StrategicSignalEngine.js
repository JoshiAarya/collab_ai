/**
 * StrategicSignalEngine - PHASE 5
 * Derives high-level project intelligence signals from existing data
 * Deterministic, explainable, cheap to compute
 * No LLM calls, no persistence, no autonomy
 */

import logger from '../../utils/logger.js';
import ProjectInsights from '../../models/ProjectInsights.js';
import discussionService from '../../services/discussionService.js';

class StrategicSignalEngine {
  /**
   * Generate strategic signals for a project
   * Computed dynamically on dashboard load
   */
  async generateSignals({ projectId }) {
    const startTime = Date.now();
    const signals = [];

    try {
      // Load project insights
      const insights = await ProjectInsights.findOne({ projectId });
      
      if (!insights) {
        logger.debug('No insights found for signal generation', { projectId });
        return [];
      }

      // Load discussion metrics
      const discussions = await discussionService.getProjectDiscussions(projectId);
      const metrics = await this.computeMetrics(projectId, discussions);

      // Evaluate signal conditions
      signals.push(...this.evaluateDecisionDrift(insights));
      signals.push(...this.evaluateBlockerStagnation(insights));
      signals.push(...this.evaluateTopicFragmentation(insights, discussions));
      signals.push(...this.evaluateMomentumDrop(insights, metrics));

      const duration = Date.now() - startTime;
      
      logger.debug('Strategic signals generated', {
        projectId,
        signalCount: signals.length,
        durationMs: duration
      });

      return signals;

    } catch (error) {
      logger.error('Signal generation failed', {
        projectId,
        error: error.message
      });
      // Silent failure - return empty signals
      return [];
    }
  }

  /**
   * Compute project metrics for signal evaluation
   */
  async computeMetrics(projectId, discussions) {
    let totalMessages = 0;
    let recentMessages = 0;
    let previousMessages = 0;
    
    const now = Date.now();
    const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000);

    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id, 200);
      totalMessages += messages.length;
      
      // Count recent messages (last 5 days)
      recentMessages += messages.filter(m => 
        new Date(m.timestamp).getTime() > fiveDaysAgo
      ).length;
      
      // Count previous period messages (5-10 days ago) for baseline
      previousMessages += messages.filter(m => {
        const time = new Date(m.timestamp).getTime();
        return time > tenDaysAgo && time <= fiveDaysAgo;
      }).length;
    }

    return {
      discussionCount: discussions.length,
      totalMessages,
      recentMessages,
      previousMessages
    };
  }

  /**
   * 1️⃣ Decision Drift Signal (CORRECTED)
   * Topics discussed frequently but no decision recorded
   * Uses keyword overlap instead of naive string.includes()
   */
  evaluateDecisionDrift(insights) {
    const signals = [];
    const { topics, decisions } = insights;

    if (!topics || topics.length === 0) return signals;

    // Find topics with count >= 5
    const frequentTopics = topics.filter(t => t.count >= 5);

    if (frequentTopics.length === 0) return signals;

    // Extract keywords from decisions for matching
    const decisionKeywords = (decisions || []).map(d => 
      this.extractKeywords(d.text)
    );

    frequentTopics.forEach(topic => {
      const topicKeywords = this.extractKeywords(topic.name);
      
      // Check if any decision has keyword overlap with topic
      const hasRelatedDecision = decisionKeywords.some(dKeywords => 
        this.hasKeywordOverlap(topicKeywords, dKeywords)
      );

      if (!hasRelatedDecision) {
        signals.push({
          type: 'decision_drift',
          severity: 'medium',
          message: `Topic '${topic.name}' discussed frequently but no decision recorded.`,
          topic: topic.name
        });
      }
    });

    return signals;
  }

  /**
   * Extract keywords from text (normalize and split)
   */
  extractKeywords(text) {
    if (!text || typeof text !== 'string') return [];
    
    return text
      .toLowerCase()
      .replace(/[.,!?;:]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out short words
  }

  /**
   * Check if two keyword sets have overlap (at least 1 common keyword)
   */
  hasKeywordOverlap(keywords1, keywords2) {
    if (!keywords1.length || !keywords2.length) return false;
    
    const set1 = new Set(keywords1);
    return keywords2.some(k => set1.has(k));
  }

  /**
   * 2️⃣ Blocker Stagnation Signal
   * Unresolved blockers older than 3 days
   */
  evaluateBlockerStagnation(insights) {
    const signals = [];
    const { blockers } = insights;

    if (!blockers || blockers.length === 0) return signals;

    const now = Date.now();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const fiveDays = 5 * 24 * 60 * 60 * 1000;

    blockers.forEach(blocker => {
      // Skip if resolved
      if (blocker.resolved) return;

      const age = now - new Date(blocker.timestamp).getTime();
      const daysOpen = Math.floor(age / (24 * 60 * 60 * 1000));

      if (age > threeDays) {
        const severity = age > fiveDays ? 'high' : 'medium';
        
        signals.push({
          type: 'blocker_stagnation',
          severity,
          message: `Blocker '${blocker.text}' unresolved for ${daysOpen} days.`,
          blocker: blocker.text,
          daysOpen
        });
      }
    });

    return signals;
  }

  /**
   * 3️⃣ Topic Fragmentation Signal (CORRECTED)
   * Same topic appears in >= 3 DISTINCT discussions without unified decision
   * Counts distinct discussionIds, not just mention count
   */
  evaluateTopicFragmentation(insights, discussions) {
    const signals = [];
    const { topics, decisions, blockers, actionItems } = insights;

    if (!topics || topics.length === 0 || discussions.length < 3) {
      return signals;
    }

    // Build map of topics to distinct discussionIds
    const topicDiscussions = new Map();

    // Track from decisions
    (decisions || []).forEach(d => {
      if (d.discussionId) {
        const keywords = this.extractKeywords(d.text);
        keywords.forEach(kw => {
          if (!topicDiscussions.has(kw)) {
            topicDiscussions.set(kw, new Set());
          }
          topicDiscussions.get(kw).add(d.discussionId.toString());
        });
      }
    });

    // Track from blockers
    (blockers || []).forEach(b => {
      if (b.discussionId) {
        const keywords = this.extractKeywords(b.text);
        keywords.forEach(kw => {
          if (!topicDiscussions.has(kw)) {
            topicDiscussions.set(kw, new Set());
          }
          topicDiscussions.get(kw).add(b.discussionId.toString());
        });
      }
    });

    // Track from action items
    (actionItems || []).forEach(a => {
      if (a.discussionId) {
        const keywords = this.extractKeywords(a.text);
        keywords.forEach(kw => {
          if (!topicDiscussions.has(kw)) {
            topicDiscussions.set(kw, new Set());
          }
          topicDiscussions.get(kw).add(a.discussionId.toString());
        });
      }
    });

    // Check each topic for fragmentation
    topics.forEach(topic => {
      const topicKeywords = this.extractKeywords(topic.name);
      
      // Count distinct discussions for this topic
      const discussionSet = new Set();
      topicKeywords.forEach(kw => {
        if (topicDiscussions.has(kw)) {
          topicDiscussions.get(kw).forEach(discId => discussionSet.add(discId));
        }
      });

      const distinctDiscussions = discussionSet.size;

      // Signal if topic appears in >= 3 distinct discussions
      if (distinctDiscussions >= 3) {
        // Check if unified decision exists
        const decisionKeywords = (decisions || []).map(d => 
          this.extractKeywords(d.text)
        );
        
        const hasUnifiedDecision = decisionKeywords.some(dKeywords => 
          this.hasKeywordOverlap(topicKeywords, dKeywords)
        );

        if (!hasUnifiedDecision) {
          signals.push({
            type: 'topic_fragmentation',
            severity: 'medium',
            message: `Topic '${topic.name}' spread across ${distinctDiscussions} discussions without unified decision.`,
            topic: topic.name,
            discussionCount: distinctDiscussions
          });
        }
      }
    });

    return signals;
  }

  /**
   * 4️⃣ Momentum Drop Signal (CORRECTED)
   * No new decisions + decreasing activity compared to baseline
   * Uses relative comparison instead of static threshold
   */
  evaluateMomentumDrop(insights, metrics) {
    const signals = [];
    const { decisions } = insights;

    const now = Date.now();
    const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);

    // Check if any recent decisions
    const recentDecisions = (decisions || []).filter(d => {
      const decisionTime = new Date(d.timestamp).getTime();
      return decisionTime > fiveDaysAgo;
    });

    // Compare recent activity to previous baseline
    const { recentMessages, previousMessages } = metrics;
    
    // Calculate activity drop percentage
    const baseline = previousMessages || 1; // Avoid division by zero
    const dropPercentage = ((baseline - recentMessages) / baseline) * 100;

    // Signal if:
    // 1. No recent decisions AND
    // 2. Activity dropped by >= 50% compared to baseline OR absolute activity < 5
    const significantDrop = dropPercentage >= 50 || recentMessages < 5;

    if (recentDecisions.length === 0 && significantDrop) {
      signals.push({
        type: 'momentum_drop',
        severity: 'low',
        message: `Project momentum decreasing. No decisions in 5 days and activity dropped ${Math.round(dropPercentage)}%.`
      });
    }

    return signals;
  }
}

export default new StrategicSignalEngine();

import logger from '../../utils/logger.js';
import { normalizeText } from '../../utils/normalizeText.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import VectorStore from '../vector/VectorStore.js';
import Topic from '../../models/Topic.js';
import Blocker from '../../models/Blocker.js';
import ActionItem from '../../models/ActionItem.js';
import Decision from '../../models/Decision.js';
import ProjectState from '../../models/ProjectState.js';
import Message from '../../models/Message.js';

const SIMILARITY_THRESHOLD = 0.80;
const TOPIC_STABLE_AT = 3;
const TOPIC_PARK_AFTER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * KnowledgeAggregator
 * --------------------
 * Merges freshly extracted insights into the project's knowledge graph and
 * recomputes ProjectState. Dedup follows a three-step ladder per artifact:
 *   1. Substring containment (normalized text) → merge
 *   2. Embedding cosine similarity >= 0.80    → merge
 *   3. No match                               → create new
 *
 * On merge: occurrenceCount++, supportingMessageIds grows, lastSeenAt updated.
 */
class KnowledgeAggregator {
  /**
   * @param {Object} params
   * @param {Object} params.insights - { decisions, blockers, actionItems, topics }
   * @param {string} params.projectId
   * @param {Array<string>} params.windowMessageIds
   */
  async mergeInsights({ insights, projectId, windowMessageIds = [] }) {
    if (!insights) return;

    try {
      await this._mergeTopics(projectId, insights.topics || [], windowMessageIds);
      await this._mergeBlockers(projectId, insights.blockers || [], windowMessageIds);
      await this._mergeActionItems(projectId, insights.actionItems || [], windowMessageIds);
      await this._mergeDecisions(projectId, insights.decisions || [], windowMessageIds);

      await this.recomputeProjectState(projectId);
    } catch (error) {
      logger.warn('Knowledge aggregation failed', { projectId, error: error.message });
    }
  }

  /**
   * Embed a piece of text, failing soft to null.
   */
  async _embed(text) {
    try {
      return await EmbeddingService.embedText(text);
    } catch {
      return null;
    }
  }

  /**
   * Find an existing artifact that matches `text` via substring containment or
   * embedding similarity. Returns the matched document or null.
   */
  _findMatch(existing, text, embedding, textField) {
    const norm = normalizeText(text);

    // Step 1: substring containment (either direction).
    for (const doc of existing) {
      const docNorm = normalizeText(doc[textField] || '');
      if (!docNorm) continue;
      if (docNorm === norm || docNorm.includes(norm) || norm.includes(docNorm)) {
        return doc;
      }
    }

    // Step 2: embedding similarity.
    if (Array.isArray(embedding)) {
      let best = null;
      let bestSim = SIMILARITY_THRESHOLD;
      for (const doc of existing) {
        if (!Array.isArray(doc.embedding) || doc.embedding.length === 0) continue;
        const sim = VectorStore.cosineSimilarity(embedding, doc.embedding);
        if (sim >= bestSim) {
          bestSim = sim;
          best = doc;
        }
      }
      if (best) return best;
    }

    return null;
  }

  async _mergeTopics(projectId, topics, windowMessageIds) {
    if (topics.length === 0) return;
    const existing = await Topic.find({ projectId });

    for (const t of topics) {
      const embedding = await this._embed(t.name);
      const match = this._findMatch(existing, t.name, embedding, 'name');

      if (match) {
        match.occurrenceCount += 1;
        match.lastSeenAt = Date.now();
        match.supportingMessageIds = this._mergeIds(match.supportingMessageIds, windowMessageIds);
        if (match.status !== 'stable' && match.occurrenceCount >= TOPIC_STABLE_AT) {
          match.status = 'stable';
        }
        if (match.status === 'parked') match.status = 'stable';
        await match.save();
      } else {
        const doc = await Topic.create({
          projectId,
          name: t.name,
          normalizedName: normalizeText(t.name),
          embedding: embedding || undefined,
          occurrenceCount: 1,
          status: 'candidate',
          supportingMessageIds: windowMessageIds
        });
        existing.push(doc);
      }
    }
  }

  async _mergeBlockers(projectId, blockers, windowMessageIds) {
    if (blockers.length === 0) return;
    const existing = await Blocker.find({ projectId, resolved: false });

    for (const b of blockers) {
      const embedding = await this._embed(b.text);
      const match = this._findMatch(existing, b.text, embedding, 'text');

      if (match) {
        match.occurrenceCount += 1;
        match.lastSeenAt = Date.now();
        match.supportingMessageIds = this._mergeIds(match.supportingMessageIds, windowMessageIds);
        // Severity only ever escalates.
        if (this._severityRank(b.severity) > this._severityRank(match.severity)) {
          match.severity = b.severity;
        }
        await match.save();
      } else {
        const doc = await Blocker.create({
          projectId,
          text: b.text,
          severity: b.severity,
          embedding: embedding || undefined,
          occurrenceCount: 1,
          supportingMessageIds: windowMessageIds
        });
        existing.push(doc);
      }
    }
  }

  async _mergeActionItems(projectId, actionItems, windowMessageIds) {
    if (actionItems.length === 0) return;
    const existing = await ActionItem.find({ projectId, status: 'open' });

    for (const a of actionItems) {
      const embedding = await this._embed(a.text);
      const match = this._findMatch(existing, a.text, embedding, 'text');

      if (match) {
        match.occurrenceCount += 1;
        match.lastSeenAt = Date.now();
        match.supportingMessageIds = this._mergeIds(match.supportingMessageIds, windowMessageIds);
        await match.save();
      } else {
        const doc = await ActionItem.create({
          projectId,
          text: a.text,
          embedding: embedding || undefined,
          occurrenceCount: 1,
          supportingMessageIds: windowMessageIds
        });
        existing.push(doc);
      }
    }
  }

  /**
   * Auto-extracted decisions are merged with a needsHumanValidation-style guard:
   * they only join the graph if they don't already exist. Manually bookmarked
   * decisions (created via the /decisions route) remain authoritative.
   */
  async _mergeDecisions(projectId, decisions, windowMessageIds) {
    if (decisions.length === 0) return;
    const existing = await Decision.find({ projectId });

    for (const d of decisions) {
      const embedding = await this._embed(d.text);
      const match = this._findMatch(existing, d.text, embedding, 'text');

      if (match) {
        // Already captured (possibly manually). Don't overwrite human-authored text.
        continue;
      }

      const doc = await Decision.create({
        projectId,
        text: d.text,
        rationale: d.rationale || '',
        proposedBy: { username: 'CollabAI' },
        embedding: embedding || undefined,
        embeddingStatus: embedding ? 'done' : 'pending'
      });
      existing.push(doc);
    }
  }

  _mergeIds(existingIds = [], newIds = []) {
    const set = new Set((existingIds || []).map(id => id.toString()));
    for (const id of newIds) set.add(id.toString());
    return Array.from(set);
  }

  _severityRank(s) {
    return { low: 1, medium: 2, high: 3 }[s] || 2;
  }

  /**
   * Rebuild the ProjectState rollup: stage, momentum, counts, and the
   * pinnedContext string injected into every AI system prompt.
   */
  async recomputeProjectState(projectId) {
    // Park stale topics before counting.
    const parkCutoff = Date.now() - TOPIC_PARK_AFTER_MS;
    await Topic.updateMany(
      { projectId, status: 'stable', lastSeenAt: { $lt: parkCutoff } },
      { $set: { status: 'parked' } }
    );

    const [stableTopics, openBlockers, openActions, decisions] = await Promise.all([
      Topic.find({ projectId, status: 'stable' }).sort({ occurrenceCount: -1 }).limit(10).lean(),
      Blocker.find({ projectId, resolved: false }).sort({ occurrenceCount: -1, raisedAt: -1 }).lean(),
      ActionItem.find({ projectId, status: 'open' }).sort({ occurrenceCount: -1 }).lean(),
      Decision.find({ projectId }).sort({ timestamp: -1 }).limit(10).lean()
    ]);

    // Blockers surface when occurrenceCount >= 2 OR severity === 'high'.
    const surfacedBlockers = openBlockers.filter(b => b.occurrenceCount >= 2 || b.severity === 'high');

    // Stage inference.
    let stage = 'ideation';
    if (surfacedBlockers.length > 0) stage = 'blocked';
    else if (decisions.length > 0 || openActions.length > 0) stage = 'discussion';

    const momentum = await this._computeMomentum(projectId);

    const pinnedContext = this._buildPinnedContext({
      decisions, blockers: surfacedBlockers, topics: stableTopics, actions: openActions
    });

    await ProjectState.findOneAndUpdate(
      { projectId },
      {
        projectId,
        stage,
        momentum,
        openBlockerCount: surfacedBlockers.length,
        unresolvedActionCount: openActions.length,
        activeTopicCount: stableTopics.length,
        decisionCount: decisions.length,
        pinnedContext,
        lastUpdated: Date.now()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.ai('ProjectState recomputed', {
      projectId, stage, momentum,
      blockers: surfacedBlockers.length, actions: openActions.length, topics: stableTopics.length
    });
  }

  /**
   * Momentum from 7-day vs prior-7-day message volume.
   */
  async _computeMomentum(projectId) {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    try {
      const [recent, prior] = await Promise.all([
        Message.countDocuments({ projectId, timestamp: { $gte: now - week } }),
        Message.countDocuments({ projectId, timestamp: { $gte: now - 2 * week, $lt: now - week } })
      ]);
      if (recent > prior * 1.2) return 'rising';
      if (recent < prior * 0.8) return 'falling';
      return 'stable';
    } catch {
      return 'stable';
    }
  }

  /**
   * ~100-token neutral summary of the project's top knowledge, injected into
   * every AI system prompt so the assistant stays grounded.
   */
  _buildPinnedContext({ decisions, blockers, topics, actions }) {
    const parts = [];
    if (topics.length > 0) {
      parts.push('Active topics: ' + topics.slice(0, 5).map(t => t.name).join(', ') + '.');
    }
    if (decisions.length > 0) {
      parts.push('Key decisions: ' + decisions.slice(0, 4).map(d => d.text).join('; ') + '.');
    }
    if (blockers.length > 0) {
      parts.push('Open blockers: ' + blockers.slice(0, 3).map(b => b.text).join('; ') + '.');
    }
    if (actions.length > 0) {
      parts.push('Pending actions: ' + actions.slice(0, 3).map(a => a.text).join('; ') + '.');
    }
    return parts.join(' ');
  }
}

export default new KnowledgeAggregator();

/**
 * KnowledgeAggregator
 * Entity-aware knowledge model aggregator.
 * Validation already done by InsightExtractor before entities reach here.
 * Responsibilities: noise filter, semantic dedup, severity inference, upserts, ProjectState recompute.
 */

import Topic from '../../models/Topic.js';
import Decision from '../../models/Decision.js';
import Blocker from '../../models/Blocker.js';
import ActionItem from '../../models/ActionItem.js';
import ProjectState from '../../models/ProjectState.js';
import Message from '../../models/Message.js';
import Project from '../../models/Project.js';
import EmbeddingService from '../embeddings/EmbeddingService.js';
import { normalizeText, normalizeTopicName, normalizeActionVerb, normalizeDecisionText } from '../../utils/normalizeText.js';
import logger from '../../utils/logger.js';

// Semantic duplicate threshold for decisions/blockers/actions
const SEMANTIC_DUPLICATE_THRESHOLD = 0.75;
// Topic dedup threshold — low because 8B models generate name variations for the same area
// (e.g. "Code execution security" vs "Container Isolation" vs "Code Execution Isolation")
const TOPIC_SEMANTIC_THRESHOLD = 0.72;

const NOISE_PATTERNS = new Set([
  "we don't have that information", "we dont have that information",
  "not sure", "unknown", "none", "no blockers", "none mentioned",
  "no blockers mentioned", "lets take a closer look", "let's take a closer look",
  "we should think about it", "we should think about this",
  "n/a", "tbd", "to be determined", "need to check",
  "need to investigate", "will look into it", "will look into this"
]);

const PLACEHOLDER_BLOCKERS = new Set([
  'none mentioned', 'no blockers', 'none', 'n/a', 'no blockers mentioned'
]);

class KnowledgeAggregator {
  async mergeInsights({ projectId, discussionId, extracted }) {
    try {
      const windowMessageIds = extracted.windowMessageIds || (extracted.messageId ? [extracted.messageId] : []);
      logger.ai('AGGREGATION_STARTED', {
        projectId, discussionId,
        messageId: extracted.messageId || null,
        windowMessages: windowMessageIds.length,
        topics: extracted.topics?.length || 0,
        decisions: extracted.decisions?.length || 0,
        blockers: extracted.blockers?.length || 0,
        actionItems: extracted.actionItems?.length || 0
      });
      const aggStart = Date.now();
      // Build username→userId map once for the whole aggregation pass
      const memberMap = await this._buildMemberMap(projectId);
      const topicMap = await this._upsertTopics(projectId, discussionId, extracted.topics || []);
      const blockerMap = await this._upsertBlockers(projectId, discussionId, extracted.blockers || [], topicMap, windowMessageIds, memberMap);
      await this._upsertDecisions(projectId, discussionId, extracted.messageId || null, extracted.decisions || [], topicMap, blockerMap, windowMessageIds, extracted.source, memberMap);
      await this._upsertActionItems(projectId, discussionId, extracted.actionItems || [], topicMap, blockerMap, windowMessageIds, memberMap);
      await this._applySupersessions(projectId, extracted.supersessions || []);
      // Only recompute project state when we actually have new entities — skip on empty extraction (rate-gated)
      const hasEntities = (extracted.topics?.length || 0) + (extracted.decisions?.length || 0) + (extracted.blockers?.length || 0) + (extracted.actionItems?.length || 0) + (extracted.supersessions?.length || 0) > 0;
      if (hasEntities) {
        await this._recomputeProjectState(projectId);
      }
      logger.ai('AGGREGATION_COMPLETE', { projectId, ms: Date.now() - aggStart });
    } catch (error) {
      logger.error('KnowledgeAggregator: merge failed (non-critical)', { projectId, error: error.message });
    }
  }

  // Build a map of lowercase username → userId from project members
  async _buildMemberMap(projectId) {
    try {
      const project = await Project.findById(projectId).select('members').populate('members.userId', 'username').lean();
      const map = {};
      for (const m of project?.members || []) {
        const username = m.userId?.username;
        const userId = m.userId?._id;
        if (username && userId) {
          map[username.toLowerCase()] = userId;
        }
      }
      return map;
    } catch (_) { return {}; }
  }

  // Resolve a proposedBy username string to { userId, username } using the member map
  _resolveProposedBy(username, memberMap) {
    if (!username) return { userId: null, username: null };
    // Reject generic fallbacks the LLM sometimes returns
    const GENERIC = new Set(['user', 'unknown', 'system', 'collabai', 'assistant', '', 'thread summary', 'system_summary']);
    if (GENERIC.has(username.toLowerCase())) return { userId: null, username: null };
    const userId = memberMap[username.toLowerCase()] || null;
    return { userId, username };
  }

  // --- Shared filters (noise + semantic dedup) ---

  _passesNoiseFilter(text, type, projectId, discussionId) {
    const normalized = normalizeText(text);
    if (NOISE_PATTERNS.has(normalized)) {
      logger.ai('ENTITY_NOISE_FILTERED', { type, text: text.substring(0, 60), projectId, discussionId });
      return false;
    }
    const fillerWords = ['yes', 'no', 'ok', 'okay', 'sure', 'maybe', 'perhaps', 'possibly'];
    if (fillerWords.includes(normalized)) {
      logger.ai('ENTITY_NOISE_FILTERED', { type, text: text.substring(0, 60), reason: 'filler', projectId, discussionId });
      return false;
    }
    return true;
  }

  async _isSemanticDuplicate(text, existingEmbeddings, type, projectId) {
    if (!existingEmbeddings?.length) return false;
    try {
      const queryEmb = await EmbeddingService.embedText(text);
      for (const emb of existingEmbeddings) {
        const score = this._cosineSimilarity(queryEmb, emb);
        if (score >= SEMANTIC_DUPLICATE_THRESHOLD) {
          logger.ai('ENTITY_SEMANTIC_DUPLICATE', { type, text: text.substring(0, 60), similarity: score.toFixed(4), projectId });
          return true;
        }
      }
    } catch (err) {
      logger.debug('Semantic duplicate check failed', { error: err.message });
    }
    return false;
  }

  _cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i]; }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  // Returns { matched: true, index, score } or { matched: false }
  // existingEmbeddings: array of { emb, id, text } objects
  async _findSemanticMatch(normalizedText, existingItems, type, projectId) {
    if (!existingItems?.length) return { matched: false };
    try {
      const queryEmb = await EmbeddingService.embedText(normalizedText);
      let best = { matched: false, score: 0 };
      for (const item of existingItems) {
        if (!item.emb) continue;
        const score = this._cosineSimilarity(queryEmb, item.emb);
        if (score >= SEMANTIC_DUPLICATE_THRESHOLD && score > best.score) {
          best = { matched: true, score, id: item.id, text: item.text, emb: item.emb };
        }
      }
      if (best.matched) {
        logger.ai('ENTITY_SEMANTIC_MATCH', { type, incoming: normalizedText.substring(0, 60), matched: best.text?.substring(0, 60), similarity: best.score.toFixed(4), projectId });
      }
      return best;
    } catch (err) {
      logger.debug('Semantic match check failed', { error: err.message });
      return { matched: false };
    }
  }

  // Normalize artifact text into neutral, concise, system-level engineering statements.
  // Applied on create AND merge — this is the single source of truth for text quality.
  //
  // Rules:
  //   1. Strip first-person / conversational prefixes
  //   2. Strip inline filler words
  //   3. Capitalize result
  //   4. Never change meaning, never add new ideas
  _normalizeArtifactText(text) {
    if (!text) return text;

    // Step 1: strip leading conversational prefixes (greedy, handles chained forms)
    // e.g. "We'll use X" → "use X", "Let's go with Y" → "go with Y", "I think we should Z" → "Z"
    const PREFIX = /^(i think\s+)?(we('ll| will| are going to| have decided| decided| chose| are using| should| can| need to| want to)?|let'?s|i('ll| will| think)?|going with|decided (to|on)|probably should|we've (chosen|agreed|decided)|our (approach|plan|solution) (is|will be))\s+/i;
    let result = text.trim();
    // Apply up to 2 times to handle "I think we'll use X"
    result = result.replace(PREFIX, '').trim();
    result = result.replace(PREFIX, '').trim();
    // Strip orphaned leading "to " left by "decided to ..." patterns
    result = result.replace(/^to\s+/i, '').trim();

    // Step 2: strip inline filler words that add no meaning
    const FILLERS = /\b(just|basically|kind of|kinda|sort of|probably|maybe|perhaps|actually|really|very|quite|fairly|rather|simply|honestly|essentially|literally|totally|definitely|certainly|obviously)\b\s*/gi;
    result = result.replace(FILLERS, '').trim();

    // Step 3: collapse multiple spaces
    result = result.replace(/\s{2,}/g, ' ').trim();

    // Step 4: capitalize first letter
    if (result.length > 0) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    return result || text; // fall back to original if result is empty
  }

  // Pick the canonical (better) text between two candidates, then normalize.
  // Prefers: longer + more descriptive version after stripping fillers.
  _canonicalize(textA, textB) {
    const cleanA = this._normalizeArtifactText(textA);
    const cleanB = this._normalizeArtifactText(textB);
    // Prefer the longer cleaned version (more descriptive)
    const best = cleanA.length >= cleanB.length ? cleanA : cleanB;
    return best || cleanA || cleanB;
  }

  async _upsertTopics(projectId, discussionId, topics) {
    const topicMap = {};
    // Load existing topic embeddings once for semantic dedup
    let existingTopicEmbs = null;

    for (const t of topics) {
      if (!t?.name) continue;
      const normalizedName = normalizeTopicName(t.name);
      if (!normalizedName) continue;

      try {
        // Generate embedding first — needed for both dedup and storage
        let embedding = null;
        try { embedding = await EmbeddingService.embedText(t.name); } catch (_) {}

        // Semantic dedup against existing topics (lower threshold than decisions)
        if (embedding && existingTopicEmbs === null) {
          const existingTopics = await Topic.find({ projectId }).select('_id name embedding').lean();
          existingTopicEmbs = existingTopics.filter(et => et.embedding?.length).map(et => ({ id: et._id, emb: et.embedding }));
        }
        if (embedding && existingTopicEmbs?.length) {
          let isDup = false;
          for (const et of existingTopicEmbs) {
            const score = this._cosineSimilarity(embedding, et.emb);
            if (score >= TOPIC_SEMANTIC_THRESHOLD) {
              // Increment count on the existing topic instead of creating a new one
              const updated = await Topic.findByIdAndUpdate(et.id, {
                $inc: { count: 1 }, $set: { lastSeenAt: new Date() }, $addToSet: { sourceDiscussionIds: discussionId }
              }, { new: true }).lean();
              if (updated) {
                topicMap[normalizedName] = updated._id;
                // Step 5: promote to stable when count >= 2 (independently extracted twice = real)
                if (updated.count >= 2 && updated.status === 'candidate') {
                  await Topic.findByIdAndUpdate(updated._id, { $set: { status: 'stable' } });
                  logger.ai('TOPIC_PROMOTED_STABLE', { name: updated.name, count: updated.count, projectId });
                }
              }
              logger.ai('ENTITY_SEMANTIC_DUPLICATE', { type: 'topic', text: t.name, similarity: score.toFixed(4), projectId });
              isDup = true;
              break;
            }
          }
          if (isDup) continue;
        }

        const existing = await Topic.findOne({ projectId, normalizedName }).lean();
        const topic = await Topic.findOneAndUpdate(
          { projectId, normalizedName },
          { $set: { name: t.name.trim(), lastSeenAt: new Date(), ...(embedding && { embedding }) }, $inc: { count: 1 }, $addToSet: { sourceDiscussionIds: discussionId }, $setOnInsert: { firstSeenAt: new Date(), status: 'candidate' } },
          { upsert: true, new: true }
        );
        // Step 5: promote to stable when count >= 2 (independently extracted twice = real)
        if (topic.count >= 2 && topic.status === 'candidate') {
          await Topic.findByIdAndUpdate(topic._id, { $set: { status: 'stable' } });
          logger.ai('TOPIC_PROMOTED_STABLE', { name: t.name, count: topic.count, projectId });
        }
        topicMap[normalizedName] = topic._id;
        // Add to local cache for subsequent topics in this batch
        if (embedding && existingTopicEmbs) existingTopicEmbs.push({ id: topic._id, emb: embedding });

        if (existing) { logger.ai('ENTITY_DUPLICATE_SKIPPED', { type: 'topic', name: t.name, projectId }); }
        else { logger.ai('ENTITY_UPSERT_TOPIC', { name: t.name, normalizedName, projectId, discussionId }); }
      } catch (err) { logger.debug('Topic upsert failed', { name: t.name, error: err.message }); }
    }
    return topicMap;
  }

  // --- Blockers (Steps 3,4,5,6) ---

  async _upsertBlockers(projectId, discussionId, blockers, topicMap, windowMessageIds = [], memberMap = {}) {
    const blockerMap = {};
    const BLOCKER_CLUSTER_THRESHOLD = 0.80;
    let existingBlockers = null;
    let existingEmbs = null;

    for (const b of blockers) {
      if (!b?.text) continue;
      const norm = normalizeText(b.text);
      if (!norm) continue;
      if (PLACEHOLDER_BLOCKERS.has(norm)) { logger.ai('ENTITY_SKIPPED_PLACEHOLDER_BLOCKER', { projectId, discussionId, text: b.text }); continue; }
      if (!this._passesNoiseFilter(b.text, 'blocker', projectId, discussionId)) continue;

      if (existingEmbs === null) {
        existingBlockers = await Blocker.find({ projectId, resolved: false }).select('_id text').lean();
        existingEmbs = [];
        for (const eb of existingBlockers) {
          try { existingEmbs.push({ id: eb._id, text: eb.text, emb: await EmbeddingService.embedText(eb.text) }); } catch (_) {}
        }
      }

      // Cluster similar blockers — merge into existing instead of creating new
      let clustered = false;
      if (existingEmbs.length) {
        try {
          const queryEmb = await EmbeddingService.embedText(b.text);
          for (const eb of existingEmbs) {
            const score = this._cosineSimilarity(queryEmb, eb.emb);
            if (score >= BLOCKER_CLUSTER_THRESHOLD) {
              await Blocker.findByIdAndUpdate(eb.id, {
                $inc: { occurrenceCount: 1 },
                $set: { lastSeenAt: new Date() },
                $addToSet: { supportingMessageIds: { $each: windowMessageIds } }
              });
              blockerMap[norm] = eb.id;
              logger.ai('BLOCKER_CLUSTERED', { existing: eb.text.substring(0, 60), incoming: b.text.substring(0, 60), similarity: score.toFixed(4), projectId });
              clustered = true;
              break;
            }
          }
        } catch (_) {}
      }
      if (clustered) continue;

      const severity = this._inferBlockerSeverity(b.text, b.severity);
      const topicId = b.topicHint ? (topicMap[normalizeTopicName(b.topicHint)] || null) : null;
      try {
        const cleanText = this._normalizeArtifactText(b.text.trim());
        const blocker = await Blocker.findOneAndUpdate(
          { projectId, text: cleanText, resolved: false },
          {
            $set: { severity, discussionId, raisedAt: new Date(), ...(topicId && { topicId }) },
            $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
            $setOnInsert: { occurrenceCount: 1, proposedBy: this._resolveProposedBy(b.proposedBy, memberMap) }
          },
          { upsert: true, new: true }
        );
        blockerMap[norm] = blocker._id;
        logger.ai('ENTITY_UPSERT_BLOCKER', { text: cleanText.substring(0, 80), severity, projectId, discussionId });
      } catch (err) { logger.debug('Blocker upsert failed', { text: b.text, error: err.message }); }
    }
    return blockerMap;
  }

  _inferBlockerSeverity(text, llmSeverity) {
    const lower = text.toLowerCase();
    // High: system failure, deployment blocking, data corruption, impossible to proceed
    // Must be explicit — do NOT trust LLM "high" without pattern confirmation
    const highPatterns = [
      'blocking', 'blocked', 'crash', 'crashing', 'failing', 'failed',
      'unusable', 'impossible', 'cannot deploy', 'deployment blocked', 'data corruption',
      'data loss', 'out of disk', 'out of memory', 'service down', 'unavailable'
    ];
    if (highPatterns.some(p => lower.includes(p))) return 'high';
    // Low: minor inconvenience, cleanup, refactor, nice-to-have
    const lowPatterns = [
      'minor', 'cleanup', 'refactor', 'nice to have', 'would be nice',
      'eventually', 'optional', 'low priority', 'inconvenience'
    ];
    if (lowPatterns.some(p => lower.includes(p))) return 'low';
    // Medium: performance, scaling, complexity, auth friction, storage concerns
    const mediumPatterns = [
      'slow', 'too slow', 'complex', 'hard to', 'difficult', 'large memory', 'high memory',
      'inconsistent', 'unreliable', 'flaky', 'intermittent', 'not ready', 'pending',
      'captcha', 'won\'t scale', 'wont scale', 'doesn\'t scale', 'doesnt scale',
      'memory usage', 'hitting the ceiling', 'expire', 'expir',
      'forbidden', '403', 'performance', 'storage', 'constraint', 'limit', 'too slow'
    ];
    if (mediumPatterns.some(p => lower.includes(p))) return 'medium';
    // Default to medium — do NOT blindly trust LLM high severity
    return llmSeverity === 'low' ? 'low' : 'medium';
  }

  // Substring containment dedup — runs BEFORE embedding comparison.
  // Returns { isDuplicate, existing } where existing is the matched normalized string.
  _isSubstringDuplicate(normalizedNew, existingNormalized) {
    for (const existing of existingNormalized) {
      if (!existing) continue;
      if (existing.includes(normalizedNew) || normalizedNew.includes(existing)) {
        return { isDuplicate: true, existing };
      }
    }
    return { isDuplicate: false };
  }

  // Rejects low-level implementation details that should never be stored as decisions.
  // Architecture/technology signals always pass through regardless of verb.
  _isLowLevelImplementationDecision(text) {
    const lower = text.toLowerCase().trim();
    // Always keep: technology choices, architecture signals
    const ARCH_SIGNALS = [
      'use ', 'adopt ', 'store ', 'switch to ', 'standardize on ', 'deploy ',
      'migrate to ', 'meilisearch', 'playwright', 'postgres', 'redis', 'kafka',
      's3', 'mongodb', 'elasticsearch', 'pinecone', 'supabase', 'firebase',
      'residential prox', 'proxy rotation', 'cron', 'queue', 'cache'
    ];
    if (ARCH_SIGNALS.some(s => lower.includes(s))) return false;
    // Reject: low-level implementation verbs at the start of the statement
    const LOW_LEVEL = /^(we('ll| will| should)?\s+)?(hash|map|parse|transform|update|check|loop|filter|append|strip|trim|encode|decode|serialize|deserialize|sanitize|format|convert|extract|split|join|merge|sort|index|log|print|debug|mock|stub)\s+/i;
    return LOW_LEVEL.test(lower);
  }

  // Reclassify clear implementation steps (add/build/implement X) as action items.
  // Also catches "use a/an X" patterns which describe techniques, not technology choices.
  // "Use residential proxies" → decision (concrete tech choice, no article)
  // "Use a pool of browser contexts" → action (describes a technique with indefinite article)
  // "Use a cron job" → action (describes a mechanism, not a technology choice)
  _isImplementationAction(text) {
    const lower = text.toLowerCase().trim();
    // "use a/an X" = implementation technique, not a technology choice → action
    if (/^use an?\s+/i.test(lower)) return true;
    // Only explicit architectural choice verbs (no article) save a statement from reclassification
    const CHOICE_VERBS = ['use ', 'adopt ', 'store ', 'switch to ', 'standardize on ', 'deploy ', 'migrate to '];
    if (CHOICE_VERBS.some(s => lower.startsWith(s))) return false;
    const IMPL_VERBS = /^(we('ll| will| should)?\s+)?(add|implement|create|set up|setup|build|write|configure|fix|update|refactor|connect|enable|install)\s+/i;
    return IMPL_VERBS.test(lower);
  }

  async _upsertDecisions(projectId, discussionId, messageId, decisions, topicMap, blockerMap, windowMessageIds = [], source = 'user', memberMap = {}) {
    const topicCount = Object.keys(topicMap).length;
    let topicsWithEmbeddings = null;
    // existingItems: { id, text, norm, emb, needsHumanValidation }[]  — loaded once per call
    let existingItems = null;
    let existingNorms = null;

    const reclassifiedActions = [];

    for (const d of decisions) {
      if (!d?.text) continue;
      const norm = normalizeText(d.text);
      if (!norm || norm.length < 10) { logger.ai('ENTITY_SKIPPED_SHORT_DECISION', { projectId, discussionId, messageId, text: d.text }); continue; }
      if (!this._passesNoiseFilter(d.text, 'decision', projectId, discussionId)) continue;
      if (this._isLowLevelImplementationDecision(d.text)) { logger.ai('DECISION_REJECTED_LOW_LEVEL', { text: d.text.substring(0, 80), projectId }); continue; }
      if (this._isImplementationAction(d.text)) {
        logger.ai('DECISION_RECLASSIFIED_ACTION', { text: d.text.substring(0, 80), projectId });
        reclassifiedActions.push({ text: d.text, status: 'open', topicHint: d.topicHint || '', blockerHint: '' });
        continue;
      }

      // AI → Human validation rule:
      // Decisions from AI extraction are stored but flagged as needsHumanValidation.
      // They are hidden from the dashboard until a human message validates them.
      const isAISource = source === 'ai';

      const decisionNorm = normalizeDecisionText(d.text);

      // Load existing decisions once — as rich objects for merge
      if (existingItems === null) {
        const docs = await Decision.find({ projectId, status: 'active' }).select('_id text needsHumanValidation').lean();
        existingItems = [];
        existingNorms = [];
        for (const doc of docs) {
          const n = normalizeDecisionText(doc.text);
          existingNorms.push(n);
          let emb = null;
          try { emb = await EmbeddingService.embedText(n); } catch (_) {}
          existingItems.push({ id: doc._id, text: doc.text, norm: n, emb, needsHumanValidation: doc.needsHumanValidation });
        }
      }

      // Step 1: substring containment → merge
      const substringCheck = this._isSubstringDuplicate(decisionNorm, existingNorms);
      if (substringCheck.isDuplicate) {
        const match = existingItems.find(e => e.norm === substringCheck.existing);
        if (match) {
          const canonical = this._canonicalize(match.text, d.text);
          const update = {
            $set: { text: canonical, timestamp: new Date() },
            $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
            $inc: { occurrenceCount: 1 }
          };
          // Human message validates a previously AI-only decision
          if (!isAISource && match.needsHumanValidation) {
            update.$set.needsHumanValidation = false;
            logger.ai('DECISION_HUMAN_VALIDATED', { canonical: canonical.substring(0, 60), projectId });
          }
          // Use findOneAndUpdate by text when id is null (same-batch insert)
          if (match.id) {
            await Decision.findByIdAndUpdate(match.id, update);
          } else {
            await Decision.findOneAndUpdate({ projectId, text: match.text }, update);
          }
          logger.ai('ENTITY_MERGED', { type: 'decision', canonical: canonical.substring(0, 60), projectId });
          match.text = canonical;
          if (!isAISource) match.needsHumanValidation = false;
        }
        continue;
      }

      // Step 2: semantic similarity ≥ 0.80 → merge
      const semanticMatch = await this._findSemanticMatch(decisionNorm, existingItems, 'decision', projectId);
      if (semanticMatch.matched) {
        const canonical = this._canonicalize(semanticMatch.text, d.text);
        const update = {
          $set: { text: canonical, timestamp: new Date() },
          $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
          $inc: { occurrenceCount: 1 }
        };
        if (!isAISource && semanticMatch.needsHumanValidation) {
          update.$set.needsHumanValidation = false;
          logger.ai('DECISION_HUMAN_VALIDATED', { canonical: canonical.substring(0, 60), projectId });
        }
        if (semanticMatch.id) {
          await Decision.findByIdAndUpdate(semanticMatch.id, update);
        } else {
          await Decision.findOneAndUpdate({ projectId, text: semanticMatch.text }, update);
        }
        logger.ai('ENTITY_MERGED', { type: 'decision', canonical: canonical.substring(0, 60), projectId });
        continue;
      }

      // Step 3: new artifact
      let topicId = d.topicHint ? (topicMap[normalizeTopicName(d.topicHint)] || null) : null;
      if (!topicId && topicCount >= 3) {
        topicId = await this._findSimilarTopic(projectId, d.text, topicsWithEmbeddings);
        if (topicsWithEmbeddings === null) {
          topicsWithEmbeddings = await Topic.find({ projectId, status: 'active', embedding: { $ne: null } }).select('_id name embedding').lean();
        }
      }
      let resolvedBlockerIds = [];
      if (d.resolvedBlockerHint) {
        const blockerId = blockerMap[normalizeText(d.resolvedBlockerHint)];
        if (blockerId) { resolvedBlockerIds = [blockerId]; await Blocker.findByIdAndUpdate(blockerId, { $set: { resolved: true, resolvedAt: new Date() } }).catch(() => {}); }
      }
      try {
        const cleanText = this._normalizeArtifactText(d.text.trim());
        const inserted = await Decision.findOneAndUpdate(
          { projectId, text: cleanText },
          {
            $set: {
              rationale: d.rationale || '', discussionId, timestamp: new Date(), status: 'active',
              messageId: messageId || null,
              needsHumanValidation: isAISource,
              ...(topicId && { topicId }),
              ...(resolvedBlockerIds.length && { resolvedBlockerIds })
            },
            $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
            $setOnInsert: { occurrenceCount: 1, proposedBy: this._resolveProposedBy(d.proposedBy, memberMap) }
          },
          { upsert: true, new: true }
        );
        logger.ai('ENTITY_UPSERT_DECISION', { text: cleanText.substring(0, 80), topicId, projectId, discussionId, messageId, needsHumanValidation: isAISource });
        let newEmb = null;
        try { newEmb = await EmbeddingService.embedText(decisionNorm); } catch (_) {}
        existingItems.push({ id: inserted._id, text: cleanText, norm: decisionNorm, emb: newEmb, needsHumanValidation: isAISource });
        existingNorms.push(decisionNorm);
      } catch (err) { logger.debug('Decision upsert failed', { text: d.text, error: err.message }); }
    }

    if (reclassifiedActions.length) {
      await this._upsertActionItems(projectId, discussionId, reclassifiedActions, topicMap, blockerMap, windowMessageIds, memberMap);
    }
  }

  async _findSimilarTopic(projectId, text, cachedTopics) {
    try {
      const topics = cachedTopics ?? await Topic.find({ projectId, status: 'active', embedding: { $ne: null } }).select('_id name embedding').lean();
      if (!topics.length) return null;
      const queryEmbedding = await EmbeddingService.embedText(text);
      let bestId = null, bestScore = 0, bestName = '';
      for (const topic of topics) {
        if (!topic.embedding?.length) continue;
        const score = this._cosineSimilarity(queryEmbedding, topic.embedding);
        if (score > bestScore) { bestScore = score; bestId = topic._id; bestName = topic.name; }
      }
      const THRESHOLD = 0.75;
      if (bestScore >= THRESHOLD) { logger.ai('TOPIC_FALLBACK_MATCHED', { projectId, decisionText: text.substring(0, 60), matchedTopic: bestName, similarity: bestScore.toFixed(4) }); return bestId; }
      logger.ai('TOPIC_FALLBACK_NONE', { projectId, decisionText: text.substring(0, 60), bestScore: bestScore.toFixed(4), threshold: THRESHOLD });
      return null;
    } catch (err) { logger.debug('Topic similarity fallback failed', { error: err.message }); return null; }
  }

  // --- ActionItems (Steps 3,4,5) ---

  async _upsertActionItems(projectId, discussionId, actionItems, topicMap, blockerMap, windowMessageIds = [], memberMap = {}) {
    // existingItems: { id, text, norm, emb }[]
    let existingItems = null;
    let existingNorms = null;

    for (const a of actionItems) {
      if (!a?.text) continue;
      const norm = normalizeText(a.text);
      if (!norm) continue;
      if (!this._passesNoiseFilter(a.text, 'actionItem', projectId, discussionId)) continue;

      const verbNormalized = normalizeActionVerb(a.text);

      // Load existing actions once per call
      if (existingItems === null) {
        const docs = await ActionItem.find({ projectId, status: { $ne: 'completed' } }).select('_id text').lean();
        existingItems = [];
        existingNorms = [];
        for (const doc of docs) {
          const n = normalizeActionVerb(doc.text);
          existingNorms.push(n);
          let emb = null;
          try { emb = await EmbeddingService.embedText(n); } catch (_) {}
          existingItems.push({ id: doc._id, text: doc.text, norm: n, emb });
        }
      }

      // Step 1: substring containment → merge
      const substringCheck = this._isSubstringDuplicate(verbNormalized, existingNorms);
      if (substringCheck.isDuplicate) {
        const match = existingItems.find(e => e.norm === substringCheck.existing);
        if (match) {
          const canonical = this._canonicalize(match.text, a.text);
          await ActionItem.findByIdAndUpdate(match.id, {
            $set: { text: canonical },
            $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
            $inc: { occurrenceCount: 1 }
          });
          logger.ai('ENTITY_MERGED', { type: 'actionItem', canonical: canonical.substring(0, 60), projectId });
          match.text = canonical;
        }
        continue;
      }

      // Step 2: semantic similarity ≥ 0.80 → merge
      const semanticMatch = await this._findSemanticMatch(verbNormalized, existingItems, 'actionItem', projectId);
      if (semanticMatch.matched) {
        const canonical = this._canonicalize(semanticMatch.text, a.text);
        await ActionItem.findByIdAndUpdate(semanticMatch.id, {
          $set: { text: canonical },
          $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
          $inc: { occurrenceCount: 1 }
        });
        logger.ai('ENTITY_MERGED', { type: 'actionItem', canonical: canonical.substring(0, 60), projectId });
        continue;
      }

      // Step 3: new artifact
      const topicId = a.topicHint ? (topicMap[normalizeTopicName(a.topicHint)] || null) : null;
      const blockerId = a.blockerHint ? (blockerMap[normalizeText(a.blockerHint)] || null) : null;
      try {
        const cleanText = this._normalizeArtifactText(a.text.trim());
        await ActionItem.findOneAndUpdate(
          { projectId, text: cleanText, status: { $ne: 'completed' } },
          {
            $set: { status: a.status || 'open', discussionId, ...(topicId && { topicId }), ...(blockerId && { blockerId }) },
            $addToSet: { supportingMessageIds: { $each: windowMessageIds } },
            $setOnInsert: { occurrenceCount: 1, proposedBy: this._resolveProposedBy(a.proposedBy, memberMap) }
          },
          { upsert: true }
        );
        logger.ai('ENTITY_UPSERT_ACTION', { text: cleanText.substring(0, 80), status: a.status, projectId, discussionId });
        let newEmb = null;
        try { newEmb = await EmbeddingService.embedText(verbNormalized); } catch (_) {}
        existingItems.push({ id: null, text: cleanText, norm: verbNormalized, emb: newEmb });
        existingNorms.push(verbNormalized);
      } catch (err) { logger.debug('ActionItem upsert failed', { text: a.text, error: err.message }); }
    }
  }

  // --- Supersession ---

  // Minimum semantic similarity between old and new decisions to allow supersession.
  // Prevents cross-topic supersessions (e.g. Firecracker → Monaco Editor).
  static SUPERSESSION_SEMANTIC_MIN = 0.45;
  // Maximum similarity — above this, old and new are the same decision rephrased, not a real pivot.
  static SUPERSESSION_SEMANTIC_MAX = 0.85;
  // Word overlap threshold for matching LLM-reported old decision to DB records.
  static SUPERSESSION_WORD_OVERLAP_MIN = 0.30;

  async _applySupersessions(projectId, supersessions) {
    if (!supersessions?.length) return;
    for (const s of supersessions) {
      if (!s?.oldDecision || !s?.newDecision) continue;
      try {
        // Find the old decision by fuzzy text match
        const oldNorm = normalizeDecisionText(s.oldDecision);
        const existing = await Decision.find({ projectId, status: 'active' }).select('_id text topicId').lean();
        let bestMatch = null;
        let bestScore = 0;
        for (const d of existing) {
          const norm = normalizeDecisionText(d.text);
          // Simple overlap score
          const oldWords = new Set(oldNorm.split(/\s+/).filter(w => w.length > 3));
          const matchWords = norm.split(/\s+/).filter(w => oldWords.has(w));
          const score = oldWords.size ? matchWords.length / oldWords.size : 0;
          if (score > bestScore) { bestScore = score; bestMatch = d; }
        }
        if (!bestMatch || bestScore < KnowledgeAggregator.SUPERSESSION_WORD_OVERLAP_MIN) {
          logger.ai('SUPERSESSION_SKIPPED_LOW_OVERLAP', {
            projectId,
            oldDecision: s.oldDecision.substring(0, 60),
            bestScore: bestScore.toFixed(3)
          });
          continue;
        }

        // Guard: verify old and new decisions are semantically related.
        // This prevents cross-topic supersessions where the LLM hallucinates
        // a relationship between unrelated decisions (e.g. code execution → editor).
        try {
          const oldEmb = await EmbeddingService.embedText(bestMatch.text);
          const newEmb = await EmbeddingService.embedText(s.newDecision);
          const similarity = this._cosineSimilarity(oldEmb, newEmb);
          if (similarity < KnowledgeAggregator.SUPERSESSION_SEMANTIC_MIN) {
            logger.ai('SUPERSESSION_REJECTED_CROSS_TOPIC', {
              projectId,
              old: bestMatch.text.substring(0, 60),
              new: s.newDecision.substring(0, 60),
              similarity: similarity.toFixed(4)
            });
            continue;
          }
          if (similarity > KnowledgeAggregator.SUPERSESSION_SEMANTIC_MAX) {
            logger.ai('SUPERSESSION_REJECTED_REFINEMENT', {
              projectId,
              old: bestMatch.text.substring(0, 60),
              new: s.newDecision.substring(0, 60),
              similarity: similarity.toFixed(4)
            });
            continue;
          }
          logger.ai('SUPERSESSION_SEMANTIC_OK', {
            projectId,
            similarity: similarity.toFixed(4)
          });
        } catch (embErr) {
          // If embedding fails, fall through — word overlap alone may be enough
          logger.debug('Supersession semantic check failed, proceeding with word overlap only', { error: embErr.message });
        }

        // Upsert the new decision
        const cleanNew = this._normalizeArtifactText(s.newDecision.trim());
        const newDecision = await Decision.findOneAndUpdate(
          { projectId, text: cleanNew },
          { $set: { status: 'active', discussionId: null, timestamp: new Date(), needsHumanValidation: false }, $setOnInsert: { occurrenceCount: 1 } },
          { upsert: true, new: true }
        );

        // Mark old decision superseded
        await Decision.findByIdAndUpdate(bestMatch._id, {
          $set: { status: 'superseded', supersededBy: newDecision._id }
        });

        logger.ai('DECISION_SUPERSEDED', {
          projectId,
          old: bestMatch.text.substring(0, 60),
          new: cleanNew.substring(0, 60),
          wordOverlap: bestScore.toFixed(3)
        });
      } catch (err) {
        logger.debug('Supersession apply failed', { error: err.message });
      }
    }
  }

  // --- ProjectState recompute ---

  async _recomputeProjectState(projectId) {
    // Topic decay: if not seen in 30 days, park them
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Topic.updateMany(
      { projectId, status: 'stable', lastSeenAt: { $lt: thirtyDaysAgo } },
      { $set: { status: 'parked' } }
    );

    // Confidence-based gating (not uniform frequency):
    // - Topics: require repetition (occurrenceCount >= 3) — structural, must stabilize
    // - Blockers: occurrenceCount >= 2 OR high severity — recurring friction or strong signal
    // - Decisions: high-confidence only (commitment language already validated) — no frequency gate
    // - Actions: valid actionable steps (already validated) — no frequency gate
    const [openBlockers, openActions, stableTopicCount, topDecisions, topBlockers, topTopics, topActions] = await Promise.all([
      // Blockers: confirmed (seen >= 2) OR high severity single-instance
      Blocker.countDocuments({ 
        projectId, 
        resolved: false, 
        $or: [
          { occurrenceCount: { $gte: 2 } },
          { severity: 'high' }
        ]
      }),
      // Actions: all valid actions (no frequency gate — captured if clear intent)
      ActionItem.countDocuments({ projectId, status: { $ne: 'completed' } }),
      // Topics: only stable (seen >= 3 times) — must stabilize through repetition
      Topic.countDocuments({ projectId, status: 'stable' }),
      // Decisions: high-confidence decisions (commitment language validated at extraction)
      // Exclude AI-only suggestions that haven't been validated by a human yet
      // Sort by reinforcement + recency
      Decision.find({ projectId, status: 'active', needsHumanValidation: { $ne: true } }).sort({ occurrenceCount: -1, createdAt: -1 }).limit(3).lean(),
      // Blockers for dashboard: confirmed OR high severity
      Blocker.find({ 
        projectId, 
        resolved: false,
        $or: [
          { occurrenceCount: { $gte: 2 } },
          { severity: 'high' }
        ]
      }).sort({ severity: -1, occurrenceCount: -1 }).limit(3).lean(),
      // Topics: only stable on dashboard
      Topic.find({ projectId, status: 'stable' }).sort({ count: -1 }).limit(6).lean(),
      // Actions: recent + reinforced (no frequency gate)
      ActionItem.find({ projectId, status: { $ne: 'completed' } }).sort({ occurrenceCount: -1, createdAt: -1 }).limit(3).lean()
    ]);
    const lastDecision = topDecisions[0] || null;
    const momentum = await this._computeMomentum(projectId);
    const stage = this._inferStage({ openBlockers, momentum, lastDecision });
    const stageReason = this._inferStageReason(stage, { openBlockers, openActions, momentum, lastDecision, stableTopicCount });
    // Step 10: build pinned context from stable knowledge
    const pinnedContext = this._buildPinnedContext({ stage, momentum, topDecisions, topBlockers, topTopics, topActions });
    const estimatedTokens = Math.ceil(pinnedContext.length / 4);
    logger.ai('PINNED_CONTEXT_TOKENS', { projectId, chars: pinnedContext.length, estimatedTokens });
    await ProjectState.findOneAndUpdate(
      { projectId },
      { $set: { stage, stageReason, openBlockerCount: openBlockers, unresolvedActionCount: openActions, activeTopicCount: stableTopicCount, lastDecisionAt: lastDecision?.timestamp || null, momentum, pinnedContext, lastUpdated: new Date() } },
      { upsert: true }
    );
    logger.ai('PROJECT_STATE_UPDATED', { projectId, stage, stageReason, openBlockerCount: openBlockers, unresolvedActionCount: openActions, stableTopicCount, momentum: momentum.trend, pinnedContextTokens: estimatedTokens });
  }

  _buildPinnedContext({ stage, momentum, topDecisions, topBlockers, topTopics, topActions }) {
    const lines = [];
    lines.push(`Stage: ${stage} | Momentum: ${momentum.trend} (${momentum.recentMessageCount} msgs/week)`);
    // Signal priority: Decision > Blocker > Topic > Action
    if (topDecisions.length > 0) {
      lines.push('Decisions:');
      topDecisions.slice(0, 3).forEach(d => lines.push(`- ${d.text}`));
    }
    if (topBlockers.length > 0) {
      lines.push('Blockers:');
      topBlockers.forEach(b => lines.push(`- [${b.severity}] ${b.text}`));
    }
    if (topTopics.length > 0) {
      lines.push(`Topics: ${topTopics.map(t => t.name).join(', ')}`);
    }
    if (topActions?.length > 0) {
      lines.push('Actions:');
      topActions.slice(0, 3).forEach(a => lines.push(`- ${a.text}`));
    }
    return lines.join('\n');
  }

  async _computeMomentum(projectId) {
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const [recent, previous] = await Promise.all([
      Message.countDocuments({ projectId, timestamp: { $gte: sevenDaysAgo.getTime() } }),
      Message.countDocuments({ projectId, timestamp: { $gte: fourteenDaysAgo.getTime(), $lt: sevenDaysAgo.getTime() } })
    ]);
    let trend = 'stable';
    if (previous > 0) { const change = (recent - previous) / previous; if (change >= 0.2) trend = 'rising'; else if (change <= -0.2) trend = 'falling'; }
    else if (recent > 0) trend = 'rising';
    return { recentMessageCount: recent, previousMessageCount: previous, trend };
  }

  _inferStageReason(stage, { openBlockers, openActions, momentum, lastDecision, stableTopicCount }) {
    switch (stage) {
      case 'blocked':
        return `${openBlockers} unresolved blocker${openBlockers !== 1 ? 's' : ''} with falling momentum`;
      case 'discussion':
        return `Active decisions being made — ${stableTopicCount} topic${stableTopicCount !== 1 ? 's' : ''} stabilized`;
      case 'ideation':
        return lastDecision ? 'Early exploration phase' : 'No decisions recorded yet';
      case 'design':
        return `${stableTopicCount} topics defined, ${openActions} action${openActions !== 1 ? 's' : ''} pending`;
      case 'completed':
        return 'All blockers resolved, actions completed';
      default:
        return '';
    }
  }

  _inferStage({ openBlockers, momentum, lastDecision }) {
    if (openBlockers > 0 && momentum.trend === 'falling') return 'blocked';
    if (lastDecision) return 'discussion';
    if (momentum.recentMessageCount > 0) return 'ideation';
    return 'ideation';
  }
}

export default new KnowledgeAggregator();

/**
 * InsightExtractor
 * Extracts engineering knowledge from conversation windows.
 * Window: 14 messages. Rate control: every 5 messages. 4-layer validation.
 */

import logger from '../../utils/logger.js';
import discussionService from '../../services/discussionService.js';
import Decision from '../../models/Decision.js';
import ActionItem from '../../models/ActionItem.js';
import Blocker from '../../models/Blocker.js';

const WINDOW_SIZE = 14;
const MIN_MESSAGES_BETWEEN_EXTRACTIONS = 5; // ~1 extraction per 5 messages → more coverage on long conversations

// Per-discussion counters (in-memory, resets on restart)
const extractionCounters = new Map();

// Commitment language for decisions
const DECISION_PATTERNS = [
  /\bwe('ll| will| are going to| have decided| decided| chose| are using| will use)\b/i,
  /\blet'?s (use|go with|adopt|switch to|deploy|standardize)\b/i,
  /\bgoing with\b/i,
  /\bdecided (to use|on)\b/i,
  /\bwe('ve| have) (chosen|selected|picked|agreed|adopted)\b/i,
  /\bour (approach|stack|architecture|solution|choice) (is|will be)\b/i,
  // Choice verbs without indefinite article — "use Meilisearch" yes, "use a pool" no
  /\b(use|adopt|store|keep|switch to|standardize on|mirror|embed|write to)\s+(?!a\b|an\b)\w/i,
  // "we should use/adopt/store X" — only with explicit choice verb
  /\bwe should (use|adopt|store|keep|switch to|deploy|standardize on|migrate to)\b/i,
  // "[verb] ... in/to/on [Technology]" — catches "Keep a sorted set in Redis", "Write room state to Redis", "Track seen questions in Postgres"
  /\b(keep|write|store|track|run|embed)\b.{1,40}\b(in|to|on|with)\s+(Redis|Postgres|MongoDB|Firecracker|Docker|Monaco|S3|DynamoDB|Kafka|RabbitMQ|Elasticsearch|Meilisearch)\b/i,
];

const UNCERTAINTY_PATTERNS = [
  /\bmaybe\b/i, /\bcould try\b/i, /\bthinking about\b/i,
  /\bnot sure\b/i, /\bperhaps\b/i, /\bpossibly\b/i,
  /\bwe should think\b/i, /\blet'?s think\b/i
];

const NOISE_EXACT = new Set([
  "not sure", "unknown", "none", "no blockers", "none mentioned", "n/a",
  "tbd", "to be determined", "need to check", "need to investigate",
  "yes", "no", "ok", "okay", "sure", "maybe", "perhaps", "sounds good",
  "let's discuss", "will look into it", "will look into this",
  "we should think about this", "we should think about it",
  "let's take a closer look", "all blockers are resolved",
  "blockers are resolved", "no blockers at this time"
]);

function meetsMinLength(text) { return text.trim().length >= 15; }

function notNoise(text) {
  const norm = text.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
  if (NOISE_EXACT.has(norm)) return false;
  if (norm.split(' ').length < 3) return false;
  return true;
}

function appearsInConversation(entityText, conversationText) {
  const stopWords = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','but','we','i','you','this','that','with','are','be','as','by','from']);
  const words = entityText.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  if (!words.length) return false;
  const convLower = conversationText.toLowerCase();
  const matches = words.filter(w => convLower.includes(w));
  // Require at least 2 keyword matches, or 100% match for very short entities (1-2 keywords)
  if (words.length <= 2) return matches.length >= Math.min(2, words.length);
  return matches.length >= Math.ceil(words.length * 0.6); // 60% of keywords must appear
}

// Named technologies — if a decision mentions a specific tech, it's likely a real decision
// regardless of which verb precedes it
const NAMED_TECHNOLOGIES = /\b(Redis|Postgres|PostgreSQL|MongoDB|Mongo|MySQL|DynamoDB|Firecracker|Docker|Kubernetes|Monaco|VS Code|S3|Kafka|RabbitMQ|Elasticsearch|Meilisearch|GraphQL|REST|gRPC|WebSocket|React|Next\.js|Vue|Angular|Svelte|Vite|Nginx|Caddy|Heroku|Vercel|AWS|GCP|Azure|Supabase|Firebase|Prisma|Drizzle|TypeORM|Jest|Vitest|Playwright|Cypress|Tailwind|ELO)\b/i;

function looksLikeDecision(text) {
  if (UNCERTAINTY_PATTERNS.some(p => p.test(text))) return false;
  // Path 1: has commitment language (existing strict check)
  if (DECISION_PATTERNS.some(p => p.test(text))) return true;
  // Path 2: names a specific technology — the LLM already validated this is a decision,
  // and naming a concrete tech is strong signal even without a canonical verb
  if (NAMED_TECHNOLOGIES.test(text)) return true;
  return false;
}

function validateExtractedEntities(extracted, conversationText) {
  const decisions = (extracted.decisions || []).filter(d => {
    if (!meetsMinLength(d.text)) { logger.ai('VALIDATION_REJECTED', { type: 'decision', reason: 'too_short', text: d.text }); return false; }
    if (!notNoise(d.text)) { logger.ai('VALIDATION_REJECTED', { type: 'decision', reason: 'noise', text: d.text }); return false; }
    if (!appearsInConversation(d.text, conversationText)) { logger.ai('VALIDATION_REJECTED', { type: 'decision', reason: 'not_in_conversation', text: d.text }); return false; }
    if (!looksLikeDecision(d.text)) { logger.ai('VALIDATION_REJECTED', { type: 'decision', reason: 'no_commitment_language', text: d.text }); return false; }
    return true;
  });
  const blockers = (extracted.blockers || []).filter(b => {
    if (!meetsMinLength(b.text)) { logger.ai('VALIDATION_REJECTED', { type: 'blocker', reason: 'too_short', text: b.text }); return false; }
    if (!notNoise(b.text)) { logger.ai('VALIDATION_REJECTED', { type: 'blocker', reason: 'noise', text: b.text }); return false; }
    if (!appearsInConversation(b.text, conversationText)) { logger.ai('VALIDATION_REJECTED', { type: 'blocker', reason: 'not_in_conversation', text: b.text }); return false; }
    return true;
  });
  const actionItems = (extracted.actionItems || []).filter(a => {
    if (!meetsMinLength(a.text)) { logger.ai('VALIDATION_REJECTED', { type: 'actionItem', reason: 'too_short', text: a.text }); return false; }
    if (!notNoise(a.text)) { logger.ai('VALIDATION_REJECTED', { type: 'actionItem', reason: 'noise', text: a.text }); return false; }
    if (!appearsInConversation(a.text, conversationText)) { logger.ai('VALIDATION_REJECTED', { type: 'actionItem', reason: 'not_in_conversation', text: a.text }); return false; }
    return true;
  });
  const topics = (extracted.topics || []).filter(t => {
    if (!t?.name || t.name.trim().length < 3) return false;
    // Hard-reject known thread/document structure patterns that LLMs confuse with topics
    const nameLower = t.name.toLowerCase().trim();
    const THREAD_HEADERS = /^(backend|frontend|main|general|shared|summary|thread|discussion|sprint|meeting|notes?)\s*(thread|discussion|summary|notes?|update)?$/i;
    if (THREAD_HEADERS.test(nameLower)) {
      logger.ai('VALIDATION_REJECTED', { type: 'topic', reason: 'thread_header', text: t.name });
      return false;
    }
    // Light grounding check: at least one meaningful keyword from the topic name
    // must appear in the conversation window. Blocks hallucinated topics while allowing abstraction.
    // Domain words that are too generic for grounding checks (would reject valid topics):
    const stopWords = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','but','we','i','you','this','that','with','are','be','as','by','from','system','pipeline','infrastructure','management','integration','real-time','room','code','bank','storage','execution','sandbox','leaderboard','scoring','matchmaking','state','selection','strategy','implementation','delivery','question','service','layer','module','api']);
    const keywords = t.name.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
    if (!keywords.length) return true; // no checkable keywords, let it through
    const convLower = conversationText.toLowerCase();
    const hasAnyKeyword = keywords.some(w => convLower.includes(w));
    if (!hasAnyKeyword) {
      logger.ai('VALIDATION_REJECTED', { type: 'topic', reason: 'no_keyword_in_conversation', text: t.name });
      return false;
    }
    return true;
  });
  return { topics, decisions, blockers, actionItems };
}

class InsightExtractor {
  async extractFromAIResponse({ projectId, discussionId, aiText, llmConfig, callProvider }) {
    const windowMessages = await this._buildWindow(discussionId, WINDOW_SIZE - 1);
    const windowMessageIds = windowMessages.map(m => m._id).filter(Boolean);

    // Violation 5 fix: apply overlap guard here too
    if (windowMessageIds.length > 0 && await this._windowAlreadyProcessed(projectId, windowMessageIds)) {
      logger.ai('EXTRACTION_WINDOW_ALREADY_PROCESSED', { projectId, discussionId, source: 'ai', windowSize: windowMessageIds.length });
      return this.emptyStructure();
    }

    // Violation 2 fix: extract only from human messages, not the AI response itself
    // AI text is circular — the LLM would reinforce its own suggestions
    const windowText = windowMessages.map(m => `${m.user}: ${m.text}`).join('\n');
    if (!windowText) return this.emptyStructure(); // nothing to extract from
    return this._extract({ projectId, discussionId, messageId: null, windowMessageIds, text: windowText, conversationText: windowText, source: 'ai', llmConfig, callProvider });
  }

  async extractFromMessage({ projectId, discussionId, messageId, text, username, isAI, llmConfig, callProvider, bypassRateLimit = false }) {
    const key = discussionId.toString();
    const count = (extractionCounters.get(key) || 0) + 1;
    extractionCounters.set(key, count);
    if (!bypassRateLimit && count < MIN_MESSAGES_BETWEEN_EXTRACTIONS) {
      logger.ai('EXTRACTION_RATE_SKIPPED', { discussionId, count, threshold: MIN_MESSAGES_BETWEEN_EXTRACTIONS });
      return this.emptyStructure();
    }
    extractionCounters.set(key, 0);
    const windowMessages = await this._buildWindow(discussionId, WINDOW_SIZE);
    const windowMessageIds = windowMessages.map(m => m._id).filter(Boolean);

    // Overlap guard: if all window messages are already tracked in existing artifacts, skip
    if (windowMessageIds.length > 0 && await this._windowAlreadyProcessed(projectId, windowMessageIds)) {
      logger.ai('EXTRACTION_WINDOW_ALREADY_PROCESSED', { projectId, discussionId, windowSize: windowMessageIds.length });
      return this.emptyStructure();
    }

    const windowText = windowMessages.map(m => `${m.user}: ${m.text}`).join('\n');
    const author = isAI ? 'CollabAI' : (username || 'User');
    const combinedText = windowText ? `${windowText}\n${author}: ${text}` : `${author}: ${text}`;
    return this._extract({ projectId, discussionId, messageId, windowMessageIds, text: combinedText, conversationText: combinedText, source: isAI ? 'ai' : 'user', llmConfig, callProvider });
  }

  async _buildWindow(discussionId, limit = WINDOW_SIZE) {
    try {
      const messages = await discussionService.getDiscussionMessages(discussionId, limit);
      return messages.filter(m => m.user !== 'System');
    } catch (err) {
      logger.debug('Failed to build message window', { discussionId, error: err.message });
      return [];
    }
  }

  async _extract({ projectId, discussionId, messageId, windowMessageIds = [], text, conversationText, source, llmConfig, callProvider }) {
    try {
      if (!text || text.length < 20) return this.emptyStructure();
      logger.ai('EXTRACTION_STARTED', { projectId, discussionId, messageId, source, windowLength: text.length });
      const prompt = this.buildExtractionPrompt(text);
      const extractionProvider = (llmConfig.provider === 'server') ? 'groq' : llmConfig.provider;
      const extractionModel = (llmConfig.model === 'server') ? 'llama-3.1-8b-instant' : llmConfig.model;
      const response = await callProvider({
        provider: extractionProvider, model: extractionModel,
        context: null, prompt, projectId,
        systemPrompt: 'You are an engineering knowledge extractor. Return ONLY valid JSON. Extract system-level engineering knowledge, not implementation fragments.',
        temperature: 0.1, maxTokens: 1000
      });
      const raw = this.parseExtractedJSON(response);
      const validated = validateExtractedEntities(raw, conversationText);
      validated.messageId = messageId;
      validated.windowMessageIds = windowMessageIds;
      validated.source = source;

      // Second pass: check if any existing decisions are contradicted by this window
      validated.supersessions = await this._detectSupersessions({ projectId, text, callProvider, extractionProvider, extractionModel });

      logger.ai('EXTRACTION_RESULT', {
        projectId, source,
        rawTopics: raw.topics?.length || 0, rawDecisions: raw.decisions?.length || 0,
        rawBlockers: raw.blockers?.length || 0, rawActions: raw.actionItems?.length || 0,
        validTopics: validated.topics.length, validDecisions: validated.decisions.length,
        validBlockers: validated.blockers.length, validActions: validated.actionItems.length,
        supersessions: validated.supersessions.length
      });
      return validated;
    } catch (error) {
      logger.warn('Insight extraction failed', { projectId, discussionId, source, error: error.message });
      return this.emptyStructure();
    }
  }

  async _detectSupersessions({ projectId, text, callProvider, extractionProvider, extractionModel }) {
    try {
      const existing = await Decision.find({ projectId, status: 'active', needsHumanValidation: { $ne: true } })
        .select('text').lean();
      if (!existing.length) return [];

      const decisionList = existing.map((d, i) => `${i + 1}. ${d.text}`).join('\n');
      const prompt = `You are reviewing a conversation window for decision changes.

Existing decisions:
${decisionList}

Conversation:
"""
${text}
"""

Do any messages in this conversation EXPLICITLY contradict, override, or reverse one of the existing decisions above?

STRICT RULES:
- Only flag a supersession if the conversation contains a clear statement like "actually we're switching to X", "we decided against Y", "instead of X we'll use Z"
- Only identify a supersession if the new decision explicitly uses transition language like "instead", "actually", "switching from", "replacing", or "we won't use X".
- A decision about a completely different feature is NEVER a supersession even if it mentions the same technology name.
- The oldDecision field MUST be copied EXACTLY from the numbered list above — do not paraphrase
- Do NOT flag a decision as superseded just because the conversation discusses it, adds detail to it, or implements it.
- CRITICAL: The old and new decisions MUST be about the EXACT SAME system, topic, or technology area. If two decisions address different subsystems or features, they are independent decisions, regardless of shared keywords.
- If in doubt, do NOT flag as superseded. False negatives are acceptable; false positives break the knowledge graph.

Return ONLY valid JSON:
{
  "supersessions": [
    { "oldDecision": "exact text copied from the numbered list", "newDecision": "the replacement decision from the conversation, single sentence" }
  ]
}

If nothing is superseded, return: { "supersessions": [] }`;

      const response = await callProvider({
        provider: extractionProvider, model: extractionModel,
        context: null, prompt, projectId,
        systemPrompt: 'You are an engineering knowledge extractor. Return ONLY valid JSON.',
        temperature: 0.1, maxTokens: 400
      });

      const match = response.match(/\{[\s\S]*\}/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      const result = (parsed.supersessions || []).filter(s =>
        s?.oldDecision && s?.newDecision &&
        typeof s.oldDecision === 'string' && typeof s.newDecision === 'string'
      );
      if (result.length) logger.ai('SUPERSESSIONS_DETECTED', { projectId, count: result.length });
      return result;
    } catch (err) {
      logger.debug('Supersession check failed', { error: err.message });
      return [];
    }
  }

  buildExtractionPrompt(text) {
    return `You are an engineering knowledge distiller. Extract facts from the conversation below.

GROUNDING RULE: Do NOT invent facts. Only extract what is explicitly stated in the conversation.

TOPIC: A high-level system area or subsystem the team is actively designing or solving.
- Synthesize specific tools/details into a broad architectural name (e.g., "Authentication system", "Video conferencing", "Notification service").
- The topic name must be a short noun phrase (2-4 words) describing the engineering area.
- NEVER extract thread names, document headers, or summary titles as topics. Examples of what NOT to extract: "Backend Thread", "Frontend Discussion", "Main Thread", "Summary", "Backend Summary". These are document structure, not technical topics.
- Only base topics on actual technical content in the conversation.

DECISION: A concrete technology or architecture choice explicitly made in the conversation.
- MUST start with a choice verb: Use, Adopt, Store, Keep, Switch to, Standardize on, Deploy, or Migrate to.
- MUST name a specific technology or system that appears in the conversation.
- MUST be a single concise sentence.
- Extract ALL qualifying decisions you find — do not stop early. There may be up to 20.
- REJECT: vague language or uncertainty like "maybe", "we should consider".

BLOCKER: A real constraint explicitly described as blocking or slowing progress.
- Must be stated as a current problem, not a hypothetical.
- Pay special attention to sections labeled "blockers", "open questions", "risks", or "issues" — these contain reliable blocker signals.
- Extract ALL qualifying blockers you find.

ACTION: A concrete engineering step explicitly assigned or committed to.
- Must have clear execution intent stated in the conversation (e.g., "I will configure X", "We need to implement Y").
- Only extract action items that are still open and unresolved at the end of the conversation. If an action item was assigned and then completed within the same conversation, do not extract it.
- Extract ALL qualifying actions you find.

For each entity (decision, blocker, action), identify the username of the person whose message most directly proposed or raised it. Use the exact username prefix from the conversation lines (e.g. "nk" from "nk: ..."). If unclear, return empty string.

Conversation:
"""
${text}
"""

Return ONLY this JSON (empty arrays if nothing qualifies):
{
  "topics": [{ "name": "string" }],
  "decisions": [{ "text": "string", "rationale": "string or empty", "topicHint": "topic name or empty", "resolvedBlockerHint": "blocker text or empty", "proposedBy": "username or empty" }],
  "blockers": [{ "text": "string", "severity": "low|medium|high", "topicHint": "topic name or empty", "proposedBy": "username or empty" }],
  "actionItems": [{ "text": "string", "status": "open|in-progress|completed", "topicHint": "topic name or empty", "blockerHint": "blocker text or empty", "proposedBy": "username or empty" }]
}`;
  }

  parseExtractedJSON(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyStructure();
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        topics: this._validateTopics(parsed.topics),
        decisions: this._validateDecisions(parsed.decisions),
        blockers: this._validateBlockers(parsed.blockers),
        actionItems: this._validateActionItems(parsed.actionItems)
      };
    } catch (error) {
      logger.debug('Failed to parse extraction JSON', { error: error.message });
      return this.emptyStructure();
    }
  }

  _validateTopics(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(t => t && typeof t === 'object' && typeof t.name === 'string' && t.name.trim().length >= 3)
      .map(t => ({ name: t.name.trim() }));
  }

  _validateDecisions(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(d => d && typeof d === 'object' && typeof d.text === 'string' && d.text.trim())
      .map(d => ({
        text: d.text.trim(),
        rationale: typeof d.rationale === 'string' ? d.rationale.trim() : '',
        topicHint: typeof d.topicHint === 'string' ? d.topicHint.trim() : '',
        resolvedBlockerHint: typeof d.resolvedBlockerHint === 'string' ? d.resolvedBlockerHint.trim() : '',
        proposedBy: typeof d.proposedBy === 'string' ? d.proposedBy.trim() : ''
      }));
  }

  _validateBlockers(arr) {
    if (!Array.isArray(arr)) return [];
    const validSeverities = ['low', 'medium', 'high'];
    return arr.filter(b => b && typeof b === 'object' && typeof b.text === 'string' && b.text.trim())
      .map(b => ({
        text: b.text.trim(),
        severity: validSeverities.includes(b.severity) ? b.severity : 'medium',
        topicHint: typeof b.topicHint === 'string' ? b.topicHint.trim() : '',
        proposedBy: typeof b.proposedBy === 'string' ? b.proposedBy.trim() : ''
      }));
  }

  _validateActionItems(arr) {
    if (!Array.isArray(arr)) return [];
    const validStatuses = ['open', 'in-progress', 'completed'];
    return arr.filter(a => a && typeof a === 'object' && typeof a.text === 'string' && a.text.trim())
      .map(a => ({
        text: a.text.trim(),
        status: validStatuses.includes(a.status) ? a.status : 'open',
        topicHint: typeof a.topicHint === 'string' ? a.topicHint.trim() : '',
        blockerHint: typeof a.blockerHint === 'string' ? a.blockerHint.trim() : '',
        proposedBy: typeof a.proposedBy === 'string' ? a.proposedBy.trim() : ''
      }));
  }

  // Overlap guard: returns true if >= 80% of window messages are already tracked
  // in existing artifacts — meaning this window has been substantially processed.
  async _windowAlreadyProcessed(projectId, windowMessageIds) {
    if (!windowMessageIds.length) return false;
    try {
      const idSet = windowMessageIds.map(id => id.toString());
      const [dCount, aCount, bCount] = await Promise.all([
        Decision.countDocuments({ projectId, supportingMessageIds: { $in: windowMessageIds } }),
        ActionItem.countDocuments({ projectId, supportingMessageIds: { $in: windowMessageIds } }),
        Blocker.countDocuments({ projectId, supportingMessageIds: { $in: windowMessageIds } })
      ]);
      // If any artifact already covers messages in this window, check overlap ratio
      const totalCovered = dCount + aCount + bCount;
      if (totalCovered === 0) return false;
      // Fetch unique covered message IDs across all artifact types
      const [dDocs, aDocs, bDocs] = await Promise.all([
        Decision.find({ projectId, supportingMessageIds: { $in: windowMessageIds } }).select('supportingMessageIds').lean(),
        ActionItem.find({ projectId, supportingMessageIds: { $in: windowMessageIds } }).select('supportingMessageIds').lean(),
        Blocker.find({ projectId, supportingMessageIds: { $in: windowMessageIds } }).select('supportingMessageIds').lean()
      ]);
      const coveredIds = new Set();
      [...dDocs, ...aDocs, ...bDocs].forEach(doc =>
        (doc.supportingMessageIds || []).forEach(id => coveredIds.add(id.toString()))
      );
      const overlap = idSet.filter(id => coveredIds.has(id)).length;
      const ratio = overlap / idSet.length;
      return ratio >= 0.9; // 90% overlap → skip (was 80% — too aggressive for long conversations)
    } catch (err) {
      logger.debug('Overlap guard check failed', { error: err.message });
      return false; // fail open — extract anyway
    }
  }

  emptyStructure() {
    return { topics: [], decisions: [], blockers: [], actionItems: [], supersessions: [], messageId: null, windowMessageIds: [], source: null };
  }

  /**
   * Force-extract from the main discussion — bypasses rate gate and overlap guard.
   * Used by the dashboard refresh endpoint to re-scan recent conversation.
   */
  async forceExtractForProject({ projectId, discussionId, llmConfig, callProvider }) {
    const windowMessages = await this._buildWindow(discussionId, WINDOW_SIZE);
    if (!windowMessages.length) return this.emptyStructure();
    // Don't extract from very sparse conversations — not enough signal
    const totalChars = windowMessages.reduce((sum, m) => sum + (m.text?.length || 0), 0);
    if (windowMessages.length < 3 || totalChars < 150) {
      logger.ai('FORCE_EXTRACTION_SKIPPED_SPARSE', { projectId, discussionId, messages: windowMessages.length, chars: totalChars });
      return this.emptyStructure();
    }
    const windowMessageIds = windowMessages.map(m => m._id).filter(Boolean);
    const windowText = windowMessages.map(m => `${m.user}: ${m.text}`).join('\n');
    logger.ai('FORCE_EXTRACTION_STARTED', { projectId, discussionId, windowSize: windowMessages.length });
    return this._extract({ projectId, discussionId, messageId: null, windowMessageIds, text: windowText, conversationText: windowText, source: 'force-refresh', llmConfig, callProvider });
  }
}

export default new InsightExtractor();

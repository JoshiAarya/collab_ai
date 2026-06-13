import { randomUUID } from 'crypto';
import logger from '../../utils/logger.js';

/**
 * InsightExtractor
 * -----------------
 * Given a window of recent human messages, asks the LLM to extract structured
 * knowledge — decisions, blockers, action items, and topics — as strict JSON.
 *
 * The extractor is deliberately conservative: it returns nothing rather than
 * guess. Output is validated before being handed to the KnowledgeAggregator.
 */
class InsightExtractor {
  constructor() {
    this.MAX_PER_TYPE = 5;
  }

  /**
   * Build the extraction prompt from a window of messages.
   * @param {Array<{user: string, text: string}>} windowMessages
   */
  _buildPrompt(windowMessages) {
    const transcript = windowMessages
      .map(m => `${m.user}: ${m.text}`)
      .join('\n');

    return `You are an analyst reading a team's working conversation. The team may be working in any domain (e.g. engineering, design, research, marketing, operations, writing). Extract durable knowledge from the transcript below.

Transcript:
${transcript}

Extract four kinds of artifacts. Be strict — only include something if it is clearly present. Prefer returning empty arrays over guessing.

- decisions: concrete choices the team committed to (e.g. "Use Redis for caching", "Launch the campaign in March"). Include a short rationale if stated.
- blockers: problems, risks, or impediments slowing progress. Rate severity low/medium/high.
- actionItems: specific next steps someone should take (e.g. "Write migration script for user table", "Draft the onboarding email").
- topics: short noun-phrase themes being discussed (e.g. "authentication", "budget planning"). 1-4 words each.

Rules for ALL text fields:
- Neutral, professional language, no first person, no conversational filler ("we'll", "let's", "I think").
- Start with a verb or a technology/noun. Maximum 15 words.
- Never quote the raw message verbatim.

Return ONLY valid JSON, no markdown, in exactly this shape:
{"decisions":[{"text":"","rationale":""}],"blockers":[{"text":"","severity":"medium"}],"actionItems":[{"text":""}],"topics":[{"name":""}]}`;
  }

  /**
   * Run extraction against a window of messages.
   * @param {Object} params
   * @param {Array} params.windowMessages - [{ user, text }]
   * @param {string} params.projectId
   * @param {Object} params.llmConfig - project.activeLLM
   * @returns {Promise<{decisions, blockers, actionItems, topics}>}
   */
  async extract({ windowMessages, projectId, llmConfig }) {
    const empty = { decisions: [], blockers: [], actionItems: [], topics: [] };

    if (!Array.isArray(windowMessages) || windowMessages.length === 0) {
      return empty;
    }

    try {
      const AIOrchestrator = (await import('../orchestrator/AIOrchestrator.js')).default;
      const selectedModel = AIOrchestrator.selectModel(
        llmConfig || { provider: 'server', model: 'llama-3.1-8b-instant' }
      );

      const response = await AIOrchestrator.callProvider({
        requestId: randomUUID(),
        provider: selectedModel.provider,
        model: selectedModel.model,
        prompt: this._buildPrompt(windowMessages),
        systemPrompt: 'You are a precise knowledge-extraction engine. You only output valid JSON.',
        projectId,
        temperature: 0.2,
        maxTokens: 1024
      });

      const parsed = this._parseResponse(response);
      const validated = this._validate(parsed);

      logger.ai('Insight extraction complete', {
        projectId,
        windowSize: windowMessages.length,
        decisions: validated.decisions.length,
        blockers: validated.blockers.length,
        actionItems: validated.actionItems.length,
        topics: validated.topics.length
      });

      return validated;
    } catch (error) {
      logger.warn('Insight extraction failed', { projectId, error: error.message });
      return empty;
    }
  }

  _parseResponse(response) {
    if (!response || typeof response !== 'string') return {};
    // Strip markdown fences and isolate the JSON object.
    const cleaned = response.replace(/```json/gi, '').replace(/```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return {};
    return JSON.parse(cleaned.slice(start, end + 1));
  }

  /**
   * Coerce raw LLM output into clean, bounded arrays.
   */
  _validate(parsed) {
    const result = { decisions: [], blockers: [], actionItems: [], topics: [] };
    if (!parsed || typeof parsed !== 'object') return result;

    const cleanText = (t) => (typeof t === 'string' ? t.trim() : '');
    const tooLong = (t) => t.split(/\s+/).length > 18;

    for (const d of (Array.isArray(parsed.decisions) ? parsed.decisions : [])) {
      const text = cleanText(d?.text);
      if (text.length >= 4 && !tooLong(text)) {
        result.decisions.push({ text, rationale: cleanText(d?.rationale) });
      }
    }

    const SEVERITIES = ['low', 'medium', 'high'];
    for (const b of (Array.isArray(parsed.blockers) ? parsed.blockers : [])) {
      const text = cleanText(b?.text);
      if (text.length >= 4 && !tooLong(text)) {
        const severity = SEVERITIES.includes(b?.severity) ? b.severity : 'medium';
        result.blockers.push({ text, severity });
      }
    }

    for (const a of (Array.isArray(parsed.actionItems) ? parsed.actionItems : [])) {
      const text = cleanText(a?.text);
      if (text.length >= 4 && !tooLong(text)) {
        result.actionItems.push({ text });
      }
    }

    for (const t of (Array.isArray(parsed.topics) ? parsed.topics : [])) {
      const name = cleanText(t?.name || t);
      if (name.length >= 2 && name.split(/\s+/).length <= 4) {
        result.topics.push({ name });
      }
    }

    // Bound the number of artifacts per window to avoid runaway aggregation.
    result.decisions = result.decisions.slice(0, this.MAX_PER_TYPE);
    result.blockers = result.blockers.slice(0, this.MAX_PER_TYPE);
    result.actionItems = result.actionItems.slice(0, this.MAX_PER_TYPE);
    result.topics = result.topics.slice(0, this.MAX_PER_TYPE);

    return result;
  }
}

export default new InsightExtractor();

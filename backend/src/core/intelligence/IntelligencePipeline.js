import logger from '../../utils/logger.js';
import InsightExtractor from './InsightExtractor.js';
import KnowledgeAggregator from './KnowledgeAggregator.js';
import discussionService from '../../services/discussionService.js';
import projectService from '../../services/projectService.js';

const EXTRACT_EVERY_N = 7;   // run extraction once per this many human messages
const WINDOW_SIZE = 13;      // human messages to feed the extractor
const MIN_MESSAGE_LENGTH = 30;

/**
 * IntelligencePipeline
 * --------------------
 * Coordinates passive knowledge extraction. As human messages flow in it
 * counts them per discussion and, on every Nth message, pulls a sliding window
 * of recent human messages, extracts insights, and aggregates them into the
 * project knowledge graph. Entirely non-blocking — failures are swallowed.
 */
class IntelligencePipeline {
  constructor() {
    this.counters = new Map(); // discussionId -> count since last extraction
    this.inFlight = new Set();  // discussionIds currently extracting
  }

  /**
   * Called for every human (non-AI) message. Returns immediately; extraction
   * runs in the background when the rate gate opens.
   */
  onHumanMessage({ projectId, discussionId, text }) {
    if (!text || text.length < MIN_MESSAGE_LENGTH) return;
    if (text.trim().startsWith('@CollabAI')) return;

    const key = discussionId.toString();
    const count = (this.counters.get(key) || 0) + 1;

    if (count < EXTRACT_EVERY_N) {
      this.counters.set(key, count);
      return;
    }

    this.counters.set(key, 0);
    this._runExtraction(projectId, discussionId).catch(err => {
      logger.warn('Intelligence pipeline run failed', { projectId, error: err.message });
    });
  }

  async _runExtraction(projectId, discussionId) {
    const key = discussionId.toString();
    if (this.inFlight.has(key)) return; // avoid overlapping runs
    this.inFlight.add(key);

    try {
      const all = await discussionService.getDiscussionMessages(discussionId, 40);
      const humanWindow = all
        .filter(m => !m.isAI && m.user !== 'System' && m.user !== 'CollabAI')
        .slice(-WINDOW_SIZE);

      if (humanWindow.length < 2) return;

      const project = await projectService.getProjectById(projectId);
      const llmConfig = project?.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };

      const insights = await InsightExtractor.extract({
        windowMessages: humanWindow.map(m => ({ user: m.user, text: m.text })),
        projectId,
        llmConfig
      });

      const windowMessageIds = humanWindow.map(m => m._id);
      await KnowledgeAggregator.mergeInsights({ insights, projectId, windowMessageIds });
    } finally {
      this.inFlight.delete(key);
    }
  }
}

export default new IntelligencePipeline();

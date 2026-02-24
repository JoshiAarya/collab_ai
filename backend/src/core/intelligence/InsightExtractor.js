/**
 * InsightExtractor - PHASE 3
 * Extracts structured signals from AI response text
 * Lightweight, deterministic, never throws hard errors
 */

import logger from '../../utils/logger.js';

class InsightExtractor {
  /**
   * Extract structured insights from AI response text
   * @param {Object} params - Extraction parameters
   * @param {string} params.projectId - Project ID
   * @param {string} params.discussionId - Discussion ID
   * @param {string} params.aiText - AI response text to analyze
   * @param {Object} params.llmConfig - LLM configuration
   * @param {Function} params.callProvider - Provider call function from orchestrator
   * @returns {Object} Extracted insights structure
   */
  async extractFromAIResponse({ projectId, discussionId, aiText, llmConfig, callProvider }) {
    try {
      // Skip extraction if response is too short
      if (!aiText || aiText.length < 50) {
        logger.debug('AI response too short for extraction', { 
          projectId, 
          textLength: aiText?.length 
        });
        return this.emptyStructure();
      }

      logger.ai('Starting insight extraction', {
        projectId,
        discussionId,
        textLength: aiText.length
      });

      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(aiText);

      // Call LLM with low temperature for deterministic extraction
      const response = await callProvider({
        provider: llmConfig.provider,
        model: llmConfig.model,
        context: null,
        prompt,
        projectId,
        systemPrompt: 'You are a precise extraction assistant. Return ONLY valid JSON, no explanations.',
        temperature: 0.2,
        maxTokens: 400
      });

      // Parse JSON safely
      const extracted = this.parseExtractedJSON(response);

      logger.ai('Insight extraction completed', {
        projectId,
        topicsCount: extracted.topics?.length || 0,
        decisionsCount: extracted.decisions?.length || 0,
        blockersCount: extracted.blockers?.length || 0,
        actionItemsCount: extracted.actionItems?.length || 0
      });

      return extracted;

    } catch (error) {
      logger.warn('Insight extraction failed', {
        projectId,
        discussionId,
        error: error.message
      });
      // Never throw - return empty structure
      return this.emptyStructure();
    }
  }

  /**
   * Build extraction prompt
   */
  buildExtractionPrompt(aiText) {
    return `Analyze this AI assistant response and extract structured information.

AI Response:
"""
${aiText}
"""

Extract and return ONLY valid JSON with this exact structure:
{
  "topics": ["topic1", "topic2"],
  "decisions": ["decision1", "decision2"],
  "blockers": ["blocker1"],
  "actionItems": ["action1", "action2"]
}

Rules:
- topics: Main subjects discussed (e.g., "Authentication", "Database Design")
- decisions: Concrete decisions or recommendations made
- blockers: Issues, problems, or blockers mentioned
- actionItems: Next steps, tasks, or action items suggested
- Return empty arrays if none found
- Return ONLY the JSON, no other text`;
  }

  /**
   * Parse extracted JSON safely
   */
  parseExtractedJSON(response) {
    try {
      // Try to find JSON in response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        logger.debug('No JSON found in extraction response');
        return this.emptyStructure();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      return {
        topics: Array.isArray(parsed.topics) ? parsed.topics.filter(t => t && typeof t === 'string') : [],
        decisions: Array.isArray(parsed.decisions) ? parsed.decisions.filter(d => d && typeof d === 'string') : [],
        blockers: Array.isArray(parsed.blockers) ? parsed.blockers.filter(b => b && typeof b === 'string') : [],
        actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.filter(a => a && typeof a === 'string') : []
      };

    } catch (error) {
      logger.debug('Failed to parse extraction JSON', { error: error.message });
      return this.emptyStructure();
    }
  }

  /**
   * Return empty structure
   */
  emptyStructure() {
    return {
      topics: [],
      decisions: [],
      blockers: [],
      actionItems: []
    };
  }
}

export default new InsightExtractor();

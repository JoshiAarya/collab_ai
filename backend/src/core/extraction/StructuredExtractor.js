/**
 * Structured Extraction Service
 * Extracts structured data from AI responses and discussions
 */

class StructuredExtractor {
  /**
   * Extract structured summary from discussion messages
   */
  async extractSummary(messages, llmConfig) {
    const conversationText = messages
      .map(m => `${m.user}: ${m.text}`)
      .join('\n');

    const prompt = `Analyze this team discussion and extract structured information.

Discussion:
${conversationText}

Provide a JSON response with:
{
  "summaryText": "Brief overview",
  "decisions": ["decision1", "decision2"],
  "blockers": ["blocker1"],
  "keyTopics": ["topic1", "topic2"],
  "openQuestions": ["question1"],
  "suggestedNextSteps": ["step1", "step2"]
}`;

    // This would call the AI service
    // For now, return a structured template
    return {
      summaryText: 'Discussion summary',
      decisions: [],
      blockers: [],
      keyTopics: [],
      openQuestions: [],
      suggestedNextSteps: []
    };
  }

  /**
   * Extract decisions from text
   */
  extractDecisions(text) {
    const decisions = [];
    const decisionPatterns = [
      /we (?:decided|agreed|chose) to (.+?)(?:\.|$)/gi,
      /decision: (.+?)(?:\.|$)/gi,
      /let's (.+?)(?:\.|$)/gi
    ];

    decisionPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          decisions.push(match[1].trim());
        }
      }
    });

    return decisions;
  }

  /**
   * Extract blockers from text
   */
  extractBlockers(text) {
    const blockers = [];
    const blockerPatterns = [
      /(?:blocker|blocked by|issue|problem): (.+?)(?:\.|$)/gi,
      /we (?:can't|cannot) (.+?) because (.+?)(?:\.|$)/gi
    ];

    blockerPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          blockers.push(match[1].trim());
        }
      }
    });

    return blockers;
  }

  /**
   * Extract action items
   */
  extractActionItems(text) {
    const actions = [];
    const actionPatterns = [
      /(?:todo|action item|task): (.+?)(?:\.|$)/gi,
      /(?:need to|should|must) (.+?)(?:\.|$)/gi
    ];

    actionPatterns.forEach(pattern => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actions.push(match[1].trim());
        }
      }
    });

    return actions;
  }
}

export default new StructuredExtractor();

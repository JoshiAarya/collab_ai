import AIOrchestrator from '../orchestrator/AIOrchestrator.js';

export default class SignalNormalizer {
  static async normalize(signal) {
    const rawText = signal.rawText || signal.text;
    const username = signal.username || signal.proposedBy?.username || 'Unknown';
    const type = signal.type;

    const prompt = `You are normalizing a raw engineering conversation message into a clean structured entity.

Signal type: ${type}
Raw text: "${rawText}"
Proposed by: ${username}

Rules:
- Write a single clean declarative statement starting with a verb or technology name
- Maximum 15 words
- Never use first person ("I", "we", "our")
- Never quote the raw text verbatim
- For decisions: start with the technology or approach chosen ("Use Postgres for...", "Adopt ECS Fargate for...")
- For blockers: describe the problem not the solution ("Search endpoint returns 8.5s response under load")
- For actions: start with an infinitive verb ("Set up Redis cluster", "Implement RBAC middleware")
- Extract 1-3 high-level technical "topics" based on context (e.g., "Frontend Architecture", "Database Setup", "Container Orchestration").
- If the statement explicitly replaces or pivots away from a previous framework/idea, specify the OLD idea in "supersedes" (e.g. if text says "Instead of Redux we use Zustand", supersedes is "Redux"). Leave empty string if none.

Return ONLY valid JSON matching this schema:
{ "normalizedText": "...", "rationale": "one sentence why", "topics": ["string"], "supersedes": "old idea" }`;

    let responseText;
    try {
      responseText = await AIOrchestrator.callProvider({
        provider: 'server',
        model: 'llama-3.1-8b-instant',
        prompt,
        projectId: signal.projectId,
        systemPrompt: 'You are an engineering signal normalizer. Output strict JSON only.',
        temperature: 0.1,
        maxTokens: 256
      });
    } catch (e) {
      console.error('SignalNormalizer LLM error:', e);
      responseText = JSON.stringify({ normalizedText: rawText, rationale: '' });
    }

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (err) {
      parsed = { normalizedText: rawText, rationale: '' };
    }

    const topicsArr = Array.isArray(parsed.topics) ? parsed.topics.map(t => ({ name: t })) : [];
    const supersessionsArr = parsed.supersedes && parsed.supersedes.trim() !== '' 
      ? [{ oldDecision: parsed.supersedes, newDecision: parsed.normalizedText }] 
      : [];

    const entity = {
      text: parsed.normalizedText,
      rationale: parsed.rationale,
      proposedBy: username,
      timestamp: signal.timestamp || Date.now()
    };

    if (type === 'decision') {
      entity.status = 'active';
      return {
        topics: topicsArr, decisions: [entity], blockers: [], actionItems: [], supersessions: supersessionsArr,
        messageId: signal.messageId, source: 'user'
      };
    } else if (type === 'blocker') {
      entity.severity = 'medium'; // Will be inferred by aggregator
      return {
        topics: topicsArr, decisions: [], blockers: [entity], actionItems: [], supersessions: supersessionsArr,
        messageId: signal.messageId, source: 'user'
      };
    } else if (type === 'action') {
      entity.status = 'open';
      return {
        topics: topicsArr, decisions: [], blockers: [], actionItems: [entity], supersessions: supersessionsArr,
        messageId: signal.messageId, source: 'user'
      };
    }

    return { topics: [], decisions: [], blockers: [], actionItems: [], supersessions: [], messageId: signal.messageId, source: 'user' };
  }
}

import ProjectBrief from '../models/ProjectBrief.js';
import Decision from '../models/Decision.js';
import Summary from '../models/Summary.js';
import Message from '../models/Message.js';
import projectService from './projectService.js';
import logger from '../utils/logger.js';

class BriefService {
  /**
   * Retrieves the current project brief. If missing or older than 24h, generates a new one.
   */
  async getOrGenerateBrief(projectId) {
    const brief = await ProjectBrief.findOne({ projectId }).lean();
    
    // Check if brief exists and is less than 24 hours old
    if (brief) {
      const isStale = (Date.now() - new Date(brief.generatedAt).getTime()) > 24 * 60 * 60 * 1000;
      if (!isStale) {
        return brief;
      }
    }

    // Attempt to generate a new brief
    try {
      const newBrief = await this.generateBrief(projectId);
      return newBrief;
    } catch (error) {
      logger.error('Failed to generate project brief', { projectId, error: error.message });
      // If we have a stale brief, return it with a warning flag
      if (brief) {
        return { ...brief, isOutdatedFallback: true };
      }
      throw new Error('Failed to generate project brief and no cached brief available.');
    }
  }

  /**
   * Forces generation of a new project brief, regardless of the cache.
   */
  async generateBrief(projectId) {
    logger.info('Generating new project brief', { projectId });
    
    const project = await projectService.getProjectById(projectId);
    if (!project) throw new Error('Project not found');

    const [decisions, summaries, messages] = await Promise.all([
      Decision.find({ projectId }).sort({ timestamp: -1 }).lean(),
      Summary.find({ projectId }).sort({ createdAt: -1 }).limit(10).lean(),
      Message.find({ projectId, isMain: true }).sort({ timestamp: -1 }).limit(30).lean()
    ]);

    // Construct the context string
    let contextStr = `PROJECT: ${project.title}\n`;
    if (project.problemStatement) contextStr += `DESCRIPTION: ${project.problemStatement}\n\n`;

    if (decisions.length > 0) {
      contextStr += `## DECISIONS\n`;
      decisions.forEach(d => {
        const who = d.proposedBy?.username || 'team';
        contextStr += `- ${d.text} (by ${who})\n`;
      });
      contextStr += `\n`;
    }

    if (summaries.length > 0) {
      contextStr += `## RECENT THREAD SUMMARIES\n`;
      summaries.forEach(s => {
        contextStr += `- ${s.content}\n`;
      });
      contextStr += `\n`;
    }

    if (messages.length > 0) {
      contextStr += `## LATEST MESSAGES (MAIN THREAD)\n`;
      // Reverse messages to chronological order
      [...messages].reverse().forEach(m => {
        if (!m.isAI && m.user !== 'System') {
          contextStr += `[${m.user}]: ${m.text}\n`;
        }
      });
      contextStr += `\n`;
    }

    const systemPrompt = `You are a senior engineer writing a Project Brief for a new team member. 
Using the provided project context, synthesize a clean, readable, document-like onboarding brief.
Write in prose paragraphs. Do not write a chatty response. Do not list raw decisions verbatim—synthesize them logically.

You MUST include exactly these five sections with Markdown headings:
## What We Are Building
(One paragraph describing the project goal and scope)

## Stack and Architecture
(Key technical decisions and their rationale, drawn from the decisions)

## Current Focus
(What the team is actively working on, inferred from recent messages and summaries)

## Key People
(Team members and what they are responsible for or have proposed)

## Open Questions
(Things that appear unresolved or uncertain from recent conversations)`;

    const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
    const llmConfig = project.activeLLM || { provider: 'server', model: 'llama-3.1-8b-instant' };
    const selectedModel = AIOrchestrator.selectModel(llmConfig);

    const response = await AIOrchestrator.callProvider({
      requestId: `brief-${Date.now()}`,
      provider: selectedModel.provider,
      model: selectedModel.model,
      context: {},
      prompt: "Generate the Project Brief.",
      systemPrompt: systemPrompt + "\n\nCONTEXT:\n" + contextStr,
      messagesOverride: null,
      projectId,
      maxTokens: 2000
    });

    if (!response || !response.trim()) {
      throw new Error('LLM returned empty brief');
    }

    // Save to DB
    const updatedBrief = await ProjectBrief.findOneAndUpdate(
      { projectId },
      { content: response, generatedAt: new Date() },
      { upsert: true, new: true }
    ).lean();

    return updatedBrief;
  }
}

export default new BriefService();

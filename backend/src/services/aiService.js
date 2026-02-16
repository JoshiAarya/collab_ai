import Groq from 'groq-sdk';
import documentService from './documentService.js';
import summaryService from './summaryService.js';
import discussionService from './discussionService.js';
import projectService from './projectService.js';

class AIService {
  constructor() {
    // API key will be checked when needed
  }

  getServerGroqKey() {
    const key = process.env.GROQ_API_KEY || process.env.CHATBOT_API_KEY;
    if (!key) {
      throw new Error('Server AI API key not configured');
    }
    return key;
  }

  // Get AI client based on project config
  async getAIClient(projectId, llmConfig) {
    const { provider, model } = llmConfig;

    // Use server LLM if provider is 'server' or 'groq' (default)
    if (provider === 'server' || provider === 'groq') {
      const serverKey = this.getServerGroqKey();
      
      // Map 'server' model to actual Groq model
      let actualModel = model;
      if (model === 'server' || !model) {
        actualModel = 'llama-3.1-8b-instant';
      }
      
      return {
        client: new Groq({ apiKey: serverKey }),
        provider: 'groq',
        model: actualModel
      };
    }

    // Get stored API key for the provider
    const apiKey = await projectService.getProjectApiKey(projectId, provider);
    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}. Please set up your API key.`);
    }

    // User-provided API keys
    switch (provider) {
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'deepseek':
        throw new Error(`${provider} integration coming soon. Currently only Groq is supported.`);
      
      default:
        throw new Error('Unsupported LLM provider');
    }
  }

  // Build context for AI from RAG sources
  async buildContext(projectId, discussionId, recentMessageCount = 20) {
    try {
      const context = {
        project: null,
        discussion: null,
        discussions: [],
        documents: [],
        summaries: [],
        recentMessages: []
      };

      // 0. Get project info
      const project = await projectService.getProjectById(projectId);
      if (project) {
        context.project = {
          title: project.title,
          description: project.description
        };
      }

      // 0.5 Get discussion info
      const discussion = await discussionService.getDiscussionById(discussionId);
      if (discussion) {
        context.discussion = {
          title: discussion.title,
          description: discussion.description,
          isMain: discussion.isMain
        };
      }

      // 0.7 Get all discussions with their summaries (for cross-discussion context)
      const allDiscussions = await discussionService.getProjectDiscussions(projectId);
      for (const disc of allDiscussions) {
        if (disc._id.toString() === discussionId.toString()) continue; // Skip current discussion
        
        // Get summary for this discussion if it exists
        const discSummaries = await summaryService.getDiscussionSummaries(disc._id, 1);
        if (discSummaries.length > 0) {
          context.discussions.push({
            title: disc.title,
            summary: discSummaries[0].content
          });
        } else {
          // If no summary, get last few messages
          const discMessages = await discussionService.getDiscussionMessages(disc._id, 5);
          if (discMessages.length > 0) {
            const preview = discMessages.map(m => `${m.user}: ${m.text}`).join('\n');
            context.discussions.push({
              title: disc.title,
              summary: `Recent activity:\n${preview}`
            });
          }
        }
      }

      // 1. Get documents (highest priority)
      const documents = await documentService.getProjectDocuments(projectId);
      context.documents = documents.map(doc => ({
        title: doc.title,
        content: doc.content.substring(0, 2000)
      }));

      // 2. Get summaries for current discussion
      const summaries = await summaryService.getDiscussionSummaries(discussionId, 3);
      context.summaries = summaries.map(s => s.content);

      // 3. Get recent messages from current discussion
      const messages = await discussionService.getDiscussionMessages(discussionId, recentMessageCount);
      context.recentMessages = messages.map(m => ({
        user: m.user,
        text: m.text,
        timestamp: m.timestamp
      }));

      return context;
    } catch (error) {
      console.error('Error building context:', error);
      return { project: null, discussion: null, discussions: [], documents: [], summaries: [], recentMessages: [] };
    }
  }

  // Generate AI response with context
  async generateResponse(projectId, discussionId, prompt, llmConfig) {
    try {
      const { client, provider, model } = await this.getAIClient(projectId, llmConfig);
      const context = await this.buildContext(projectId, discussionId, 30);
      const systemPrompt = this.buildSystemPrompt(context);

      if (provider === 'groq') {
        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add conversation history
        context.recentMessages.forEach(m => {
          if (m.user === 'CollabAI') {
            messages.push({ role: 'assistant', content: m.text });
          } else {
            messages.push({ role: 'user', content: `${m.user}: ${m.text}` });
          }
        });

        // Add the current user prompt (this was missing!)
        messages.push({ role: 'user', content: prompt });

        const completion = await client.chat.completions.create({
          model,
          messages,
          temperature: 0.7,
          max_tokens: 1024
        });

        return completion.choices[0]?.message?.content || 'No response generated.';
      }

      throw new Error('Unsupported provider');
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  // Build system prompt with context
  buildSystemPrompt(context) {
    let prompt = `You are CollabAI, a helpful AI assistant for team collaboration.

Be conversational, concise, and natural. Answer questions directly without unnecessary formatting or structure. Use the context below to provide accurate, relevant responses.

`;

    if (context.project) {
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) {
        prompt += `${context.project.description}\n`;
      }
    }

    if (context.discussion && !context.discussion.isMain) {
      prompt += `\nCurrent Discussion: ${context.discussion.title}\n`;
      if (context.discussion.description) {
        prompt += `${context.discussion.description}\n`;
      }
    }

    // Add other discussions context
    if (context.discussions && context.discussions.length > 0) {
      prompt += `\n--- Other Project Discussions ---\n`;
      context.discussions.forEach(disc => {
        prompt += `\n[${disc.title}]\n${disc.summary}\n`;
      });
    }

    if (context.documents.length > 0) {
      prompt += `\n--- Project Documents ---\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
    }

    if (context.summaries.length > 0) {
      prompt += `\n--- Previous Summaries (This Discussion) ---\n`;
      context.summaries.forEach((summary, i) => {
        prompt += `${i + 1}. ${summary}\n`;
      });
    }

    return prompt;
  }

  // Generate summary
  async generateSummary(projectId, discussionId, llmConfig, customPrompt = null) {
    try {
      const { client, model } = await this.getAIClient(projectId, llmConfig);
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);

      if (messages.length === 0) {
        return 'No messages to summarize yet.';
      }

      const conversationText = messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const basePrompt = `Summarize this team discussion. Focus on:
- Key topics discussed
- Decisions made
- Open questions or blockers
- Suggested next steps

Discussion:
${conversationText}

Provide a concise summary:`;

      const finalPrompt = customPrompt 
        ? `${basePrompt}\n\nAdditional instructions: ${customPrompt}`
        : basePrompt;

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes team discussions.'
          },
          {
            role: 'user',
            content: finalPrompt
          }
        ],
        temperature: 0.5,
        max_tokens: 512
      });

      return completion.choices[0]?.message?.content || 'Error generating summary.';
    } catch (error) {
      console.error('Error generating summary:', error);
      return 'Error generating summary.';
    }
  }

  // Regenerate summary with custom prompt
  async regenerateSummary(projectId, discussionId, existingSummary, customPrompt, llmConfig) {
    try {
      const { client, model } = await this.getAIClient(projectId, llmConfig);
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);

      const conversationText = messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that refines and improves discussion summaries based on user feedback.'
          },
          {
            role: 'user',
            content: `Here is the original discussion:

${conversationText}

Current summary:
${existingSummary}

User's refinement request: ${customPrompt}

Please provide an updated summary that addresses the user's request:`
          }
        ],
        temperature: 0.5,
        max_tokens: 512
      });

      return completion.choices[0]?.message?.content || 'Error regenerating summary.';
    } catch (error) {
      console.error('Error regenerating summary:', error);
      throw error;
    }
  }

  // Generate dashboard insights
  async generateDashboardInsights(projectId, llmConfig) {
    try {
      const { client, model } = await this.getAIClient(projectId, llmConfig);
      
      // Get all project data
      const summaries = await summaryService.getProjectSummaries(projectId, 10);
      const documents = await documentService.getProjectDocuments(projectId);
      const discussions = await discussionService.getProjectDiscussions(projectId);
      
      // Get recent messages from all discussions
      let allMessages = [];
      for (const disc of discussions.slice(0, 5)) {
        const messages = await discussionService.getDiscussionMessages(disc._id, 20);
        allMessages = allMessages.concat(messages);
      }
      
      // If no data, return empty insights
      if (allMessages.length === 0 && documents.length === 0 && summaries.length === 0) {
        return {
          topics: [],
          decisions: [],
          blockers: [],
          nextSteps: []
        };
      }

      const summaryText = summaries.map(s => s.content).join('\n\n');
      const docText = documents.map(d => `${d.title}: ${d.content.substring(0, 500)}`).join('\n\n');
      const messageText = allMessages.slice(-50).map(m => `${m.user}: ${m.text}`).join('\n');

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that analyzes project discussions and extracts structured insights.'
          },
          {
            role: 'user',
            content: `Analyze this project data and extract insights:

RECENT MESSAGES:
${messageText}

DOCUMENTS:
${docText}

SUMMARIES:
${summaryText}

Extract and return ONLY valid JSON:
{
  "topics": ["topic1", "topic2"],
  "decisions": ["decision1"],
  "blockers": ["blocker1"],
  "nextSteps": ["step1", "step2"]
}`
          }
        ],
        temperature: 0.3,
        max_tokens: 512
      });

      const text = completion.choices[0]?.message?.content || '{}';
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('Failed to parse AI insights:', e);
      }

      return {
        topics: [],
        decisions: [],
        blockers: [],
        nextSteps: []
      };
    } catch (error) {
      console.error('Error generating insights:', error);
      return {
        topics: [],
        decisions: [],
        blockers: [],
        nextSteps: []
      };
    }
  }
}

export default new AIService();

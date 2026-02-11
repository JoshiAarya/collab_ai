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
  getAIClient(llmConfig) {
    const { provider, apiKey, model } = llmConfig;

    // Use server LLM if no API key or provider is 'server'
    if (provider === 'server' || !apiKey) {
      const serverKey = this.getServerGroqKey();
      return {
        client: new Groq({ apiKey: serverKey }),
        provider: 'groq',
        model: model || 'llama-3.1-8b-instant'
      };
    }

    // User-provided API keys
    switch (provider) {
      case 'groq':
        return {
          client: new Groq({ apiKey }),
          provider: 'groq',
          model: model || 'llama-3.1-8b-instant'
        };
      
      case 'openai':
      case 'claude':
      case 'deepseek':
        // Stubbed for MVP
        throw new Error(`${provider} integration coming soon`);
      
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
          description: discussion.description
        };
      }

      // 1. Get documents (highest priority)
      const documents = await documentService.getProjectDocuments(projectId);
      context.documents = documents.map(doc => ({
        title: doc.title,
        content: doc.content.substring(0, 2000)
      }));

      // 2. Get summaries
      const summaries = await summaryService.getProjectSummaries(projectId, 5);
      context.summaries = summaries.map(s => s.content);

      // 3. Get recent messages
      const messages = await discussionService.getDiscussionMessages(discussionId, recentMessageCount);
      context.recentMessages = messages.map(m => ({
        user: m.user,
        text: m.text,
        timestamp: m.timestamp
      }));

      return context;
    } catch (error) {
      console.error('Error building context:', error);
      return { project: null, discussion: null, documents: [], summaries: [], recentMessages: [] };
    }
  }

  // Generate AI response with context
  async generateResponse(projectId, discussionId, prompt, llmConfig) {
    try {
      const { client, provider, model } = this.getAIClient(llmConfig);
      const context = await this.buildContext(projectId, discussionId, 30);

      // DEBUG: Log what messages the AI is seeing
      console.log('=== AI CONTEXT DEBUG ===');
      console.log('Recent messages count:', context.recentMessages.length);
      console.log('Last 5 messages:');
      context.recentMessages.slice(-5).forEach(m => {
        console.log(`  ${m.user}: ${m.text}`);
      });
      console.log('=======================');

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(context);

      if (provider === 'groq') {
        const messages = [
          { role: 'system', content: systemPrompt }
        ];

        // Add recent messages as conversation history
        // Note: The last message in history is the @CollabAI mention that triggered this,
        // so we include ALL messages as they provide full context
        context.recentMessages.forEach(m => {
          if (m.user === 'CollabAI') {
            messages.push({ role: 'assistant', content: m.text });
          } else {
            // Include the full message text (including @CollabAI if present)
            messages.push({ role: 'user', content: `${m.user}: ${m.text}` });
          }
        });

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
      return 'Sorry, I encountered an error processing your request.';
    }
  }

  // Build system prompt with context
  buildSystemPrompt(context) {
    let prompt = `You are CollabAI, an intelligent collaborative assistant helping a team work together on a project.

Your role:
- Help the team recall what has been discussed
- Summarize key points and decisions
- Identify blockers and open questions
- Suggest next steps
- Be neutral, concise, and context-aware

`;

    // Add project context
    if (context.project) {
      prompt += `\n🎯 PROJECT CONTEXT:\n`;
      prompt += `Project: ${context.project.title}\n`;
      if (context.project.description) {
        prompt += `Description: ${context.project.description}\n`;
      }
    }

    // Add discussion context
    if (context.discussion && !context.discussion.isMain) {
      prompt += `\n💬 CURRENT DISCUSSION:\n`;
      prompt += `Topic: ${context.discussion.title}\n`;
      if (context.discussion.description) {
        prompt += `Focus: ${context.discussion.description}\n`;
      }
    }

    if (context.documents.length > 0) {
      prompt += `\n📄 PROJECT DOCUMENTS:\n`;
      context.documents.forEach(doc => {
        prompt += `\n${doc.title}:\n${doc.content}\n`;
      });
    }

    if (context.summaries.length > 0) {
      prompt += `\n📝 PREVIOUS SUMMARIES:\n`;
      context.summaries.forEach((summary, i) => {
        prompt += `${i + 1}. ${summary}\n`;
      });
    }

    return prompt;
  }

  // Generate summary
  async generateSummary(projectId, discussionId, llmConfig) {
    try {
      const { client, model } = this.getAIClient(llmConfig);
      const messages = await discussionService.getDiscussionMessages(discussionId, 50);

      if (messages.length === 0) {
        return 'No messages to summarize yet.';
      }

      const conversationText = messages
        .map(m => `${m.user}: ${m.text}`)
        .join('\n');

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that summarizes team discussions.'
          },
          {
            role: 'user',
            content: `Summarize this team discussion. Focus on:
- Key topics discussed
- Decisions made
- Open questions or blockers
- Suggested next steps

Discussion:
${conversationText}

Provide a concise summary:`
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

  // Generate dashboard insights
  async generateDashboardInsights(projectId, llmConfig) {
    try {
      const { client, model } = this.getAIClient(llmConfig);
      
      const summaries = await summaryService.getProjectSummaries(projectId, 10);
      const documents = await documentService.getProjectDocuments(projectId);

      const summaryText = summaries.map(s => s.content).join('\n\n');
      const docText = documents.map(d => `${d.title}: ${d.content.substring(0, 500)}`).join('\n\n');

      const completion = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that analyzes project data and provides insights.'
          },
          {
            role: 'user',
            content: `Analyze this project and provide insights:

SUMMARIES:
${summaryText}

DOCUMENTS:
${docText}

Provide:
1. Current topics being discussed
2. Key decisions identified
3. Open questions or blockers
4. Suggested next steps

Format as JSON:
{
  "topics": ["topic1", "topic2"],
  "decisions": ["decision1"],
  "blockers": ["blocker1"],
  "nextSteps": ["step1", "step2"]
}`
          }
        ],
        temperature: 0.5,
        max_tokens: 512
      });

      const text = completion.choices[0]?.message?.content || '{}';
      
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Fallback
      }

      return {
        topics: ['Analysis in progress'],
        decisions: [],
        blockers: [],
        nextSteps: ['Continue discussion']
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

import { describe, it, expect } from 'vitest';
import AIOrchestrator from '../../src/core/orchestrator/AIOrchestrator.js';

describe('AIOrchestrator.selectModel', () => {
  it('defaults to groq when no config is given', () => {
    expect(AIOrchestrator.selectModel(null)).toEqual({ provider: 'groq', model: 'llama-3.1-8b-instant' });
  });

  it('maps the server placeholder to a real Groq model', () => {
    expect(AIOrchestrator.selectModel({ provider: 'server', model: 'server' }))
      .toEqual({ provider: 'server', model: 'llama-3.1-8b-instant' });
  });

  it('maps legacy provider names to current ones', () => {
    expect(AIOrchestrator.selectModel({ provider: 'gemini', model: 'gemini-2.5-pro' }).provider).toBe('google');
    expect(AIOrchestrator.selectModel({ provider: 'claude', model: 'claude-sonnet-4-6' }).provider).toBe('anthropic');
  });

  it('passes current provider names through unchanged', () => {
    expect(AIOrchestrator.selectModel({ provider: 'deepseek', model: 'deepseek-chat' }).provider).toBe('deepseek');
  });
});

describe('AIOrchestrator._normalizeChatMessages', () => {
  it('merges consecutive same-role messages', () => {
    const result = AIOrchestrator._normalizeChatMessages([
      { role: 'user', content: 'Alice: hello' },
      { role: 'user', content: 'Bob: hi there' },
      { role: 'assistant', content: 'Hello both!' },
      { role: 'user', content: 'Alice: question' }
    ]);
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toContain('Alice: hello');
    expect(result[0].content).toContain('Bob: hi there');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });

  it('forces the conversation to start with a user turn', () => {
    const result = AIOrchestrator._normalizeChatMessages([
      { role: 'assistant', content: 'Earlier AI reply' },
      { role: 'user', content: 'Follow-up question' }
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toContain('Earlier AI reply');
    expect(result[0].content).toContain('Follow-up question');
  });

  it('alternates strictly after normalization', () => {
    const noisy = [
      { role: 'assistant', content: 'a1' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a3' },
      { role: 'user', content: 'u3' }
    ];
    const result = AIOrchestrator._normalizeChatMessages(noisy);
    expect(result[0].role).toBe('user');
    for (let i = 1; i < result.length; i++) {
      expect(result[i].role).not.toBe(result[i - 1].role);
    }
  });

  it('handles an empty history', () => {
    expect(AIOrchestrator._normalizeChatMessages([])).toEqual([]);
  });
});

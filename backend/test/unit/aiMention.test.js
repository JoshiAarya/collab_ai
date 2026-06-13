import { describe, it, expect } from 'vitest';
import { isAIMention, stripAIMention } from '../../src/utils/aiMention.js';

describe('aiMention', () => {
  it('matches the canonical mention', () => {
    expect(isAIMention('@CollabAI what is the plan?')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isAIMention('@collabai what is the plan?')).toBe(true);
    expect(isAIMention('@COLLABAI help')).toBe(true);
    expect(isAIMention('@Collabai help')).toBe(true);
  });

  it('tolerates leading whitespace', () => {
    expect(isAIMention('  @collabai hi')).toBe(true);
  });

  it('matches mid-message mentions', () => {
    expect(isAIMention('hey @CollabAI what do you think')).toBe(true);
    expect(isAIMention('hi @collabai can you help')).toBe(true);
  });

  it('does not match longer usernames sharing the prefix', () => {
    expect(isAIMention('@collabaibot hi')).toBe(false);
    expect(isAIMention('ping @collabaibot please')).toBe(false);
  });

  it('does not match email-like strings', () => {
    expect(isAIMention('team@collabai.com sent a message')).toBe(false);
    expect(isAIMention('reach me at team@collabai.com')).toBe(false);
  });

  it('handles empty and missing text', () => {
    expect(isAIMention('')).toBe(false);
    expect(isAIMention(null)).toBe(false);
    expect(isAIMention(undefined)).toBe(false);
  });

  it('strips the mention regardless of case and position', () => {
    expect(stripAIMention('@collabai what is the plan?')).toBe('what is the plan?');
    expect(stripAIMention('@CollabAI: summarize')).toBe(': summarize');
    expect(stripAIMention('  @COLLABAI   hello  ')).toBe('hello');
    expect(stripAIMention('hey @CollabAI what do you think')).toBe('hey what do you think');
  });
});

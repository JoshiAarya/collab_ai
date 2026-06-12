import { describe, it, expect } from 'vitest';
import InsightExtractor from '../../src/core/intelligence/InsightExtractor.js';

describe('InsightExtractor._parseResponse', () => {
  it('parses plain JSON', () => {
    const parsed = InsightExtractor._parseResponse('{"decisions":[{"text":"Use Redis"}]}');
    expect(parsed.decisions[0].text).toBe('Use Redis');
  });

  it('strips markdown fences and surrounding prose', () => {
    const response = 'Here you go:\n```json\n{"topics":[{"name":"caching"}]}\n```\nDone.';
    expect(InsightExtractor._parseResponse(response).topics[0].name).toBe('caching');
  });

  it('returns empty object for non-JSON responses', () => {
    expect(InsightExtractor._parseResponse('no json here')).toEqual({});
    expect(InsightExtractor._parseResponse(null)).toEqual({});
  });
});

describe('InsightExtractor._validate', () => {
  it('drops artifacts that are too short or too long', () => {
    const result = InsightExtractor._validate({
      decisions: [
        { text: 'ok?' }, // 3 chars — too short
        { text: 'Use Redis for caching' },
        { text: 'a '.repeat(25).trim() } // > 18 words
      ]
    });
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0].text).toBe('Use Redis for caching');
  });

  it('coerces invalid severities to medium', () => {
    const result = InsightExtractor._validate({
      blockers: [{ text: 'Database connection pool exhausted', severity: 'catastrophic' }]
    });
    expect(result.blockers[0].severity).toBe('medium');
  });

  it('rejects topics longer than 4 words', () => {
    const result = InsightExtractor._validate({
      topics: [{ name: 'rate limiting' }, { name: 'a very long topic name here' }]
    });
    expect(result.topics).toHaveLength(1);
  });

  it('bounds each artifact type to 5 per window', () => {
    const decisions = Array.from({ length: 9 }, (_, i) => ({ text: `Use approach number ${i} everywhere` }));
    const result = InsightExtractor._validate({ decisions });
    expect(result.decisions).toHaveLength(5);
  });

  it('returns empty arrays for malformed input', () => {
    expect(InsightExtractor._validate(null)).toEqual({
      decisions: [], blockers: [], actionItems: [], topics: []
    });
  });
});

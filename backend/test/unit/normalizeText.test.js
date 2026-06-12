import { describe, it, expect } from 'vitest';
import { normalizeText, normalizeDecisionText } from '../../src/utils/normalizeText.js';

describe('normalizeText', () => {
  it('lowercases, trims, collapses whitespace, strips punctuation', () => {
    expect(normalizeText('  Use   Redis, for Caching!  ')).toBe('use redis for caching');
  });

  it('returns empty string for non-string input', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText(42)).toBe('');
  });
});

describe('normalizeDecisionText', () => {
  it('strips commitment prefixes so phrasing variants dedup', () => {
    expect(normalizeDecisionText("We'll use Redis for caching")).toBe('use redis for caching');
    expect(normalizeDecisionText("Let's use Redis for caching")).toBe('use redis for caching');
    expect(normalizeDecisionText('We decided use Redis for caching')).toBe('use redis for caching');
  });

  it('leaves text without a prefix unchanged (modulo normalization)', () => {
    expect(normalizeDecisionText('Store raw HTML in S3')).toBe('store raw html in s3');
  });
});

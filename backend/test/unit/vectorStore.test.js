import { describe, it, expect } from 'vitest';
import VectorStore from '../../src/core/vector/VectorStore.js';

describe('VectorStore.cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [0.5, 0.3, -0.2];
    expect(VectorStore.cosineSimilarity(v, v)).toBeCloseTo(1, 10);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(VectorStore.cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(VectorStore.cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it('returns 0 when either vector is all zeros', () => {
    expect(VectorStore.cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => VectorStore.cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
  });
});

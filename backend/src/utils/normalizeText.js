/**
 * Text normalization utilities for decision deduplication.
 */

/**
 * General-purpose normalization.
 * Lowercase, trim, collapse spaces, strip punctuation.
 */
export function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:'"()\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decision text normalization for deduplication.
 * Strips leading commitment phrases so "We'll batch X" and "Let's batch X" both → "batch X"
 * Used before embedding similarity to catch phrasing duplicates.
 */
export function normalizeDecisionText(text) {
  if (!text || typeof text !== 'string') return normalizeText(text);
  const DECISION_PREFIXES = /^(we('ll| will| should| probably should| are going to| have decided| decided| chose| are using| will use)|let'?s|going with|decided (to|on)|we('ve| have) (chosen|selected|picked|agreed|adopted)|our (approach|stack|architecture|solution|choice) (is|will be))\s+/i;
  return normalizeText(text.replace(DECISION_PREFIXES, ''));
}

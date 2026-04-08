/**
 * Text normalization utilities for knowledge deduplication.
 */

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and',
  'or', 'but', 'we', 'i', 'you', 'this', 'that', 'with', 'are', 'be', 'as',
  'by', 'from', 'our', 'their', 'its', 'was', 'will', 'has', 'have', 'had',
  'do', 'does', 'did', 'can', 'could', 'should', 'would', 'may', 'might',
  'using', 'used', 'use', 'via', 'into', 'about', 'some', 'all', 'new'
]);

// Basic English singularization — covers the most common patterns
function singularize(word) {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';   // queries → query
  if (word.endsWith('ves')) return word.slice(0, -3) + 'f';   // knives → knife
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2); // buses → bus
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1); // scrapers → scraper
  return word;
}

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
 * Topic name normalization for deduplication.
 * Lowercase → remove stopwords → singularize nouns → trim.
 * "Scrapers" and "scraper" → "scraper"
 * "The scraping pipeline" → "scraping pipeline"
 */
export function normalizeTopicName(name) {
  if (!name || typeof name !== 'string') return '';
  const words = normalizeText(name)
    .split(' ')
    .filter(w => w.length > 1 && !STOP_WORDS.has(w))
    .map(singularize);
  return words.join(' ').trim();
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

/**
 * Action item verb normalization.
 * Strips leading action verbs so "implement X", "build X", "add X" all become "X".
 * Used before embedding dedup to catch semantic duplicates.
 */
export function normalizeActionVerb(text) {
  if (!text || typeof text !== 'string') return normalizeText(text);
  const ACTION_VERBS = /^(implement|build|add|create|setup|set up|write|develop|design|configure|deploy|integrate|test|fix|update|refactor|migrate|connect|enable|install)\s+/i;
  return normalizeText(text.replace(ACTION_VERBS, ''));
}

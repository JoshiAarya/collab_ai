/**
 * AI mention detection — "@CollabAI" anywhere in a message triggers the
 * assistant. Users type it freehand, so matching is case-insensitive and
 * the mention may appear mid-sentence ("hi @collabai can you...").
 * The leading [^\w@] guard keeps email-like strings (team@collabai.com)
 * from triggering.
 */
const AI_MENTION_REGEX = /(^|[^\w@])@collabai\b/i;

export function isAIMention(text) {
  return AI_MENTION_REGEX.test(text || '');
}

export function stripAIMention(text) {
  return (text || '')
    .replace(AI_MENTION_REGEX, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

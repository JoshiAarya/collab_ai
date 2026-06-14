/**
 * AI mention detection — "@CollabAI" anywhere in a message triggers the
 * assistant. Users type it freehand, so matching is case-insensitive and
 * the mention may appear mid-sentence ("hi @collabai can you...").
 * The leading [^\w@] guard keeps email-like strings (team@collabai.com)
 * from triggering.
 */
const AI_MENTION_REGEX = /(^|[^\w@])@collabai\b/i;

export function isAIMention(text, customAliases = []) {
  // Check default @collabai first
  if (AI_MENTION_REGEX.test(text || '')) return true;
  console.log("custom aliasase", customAliases)
  console.log("text", text)
  
  // Check dynamic user aliases if provided (e.g. ['gemini', 'mygpt'])
  if (customAliases && customAliases.length > 0) {
    const aliasPattern = customAliases.join('|');
    const dynamicRegex = new RegExp(`(^|[^\\w@])@(${aliasPattern})\\b`, 'i');
    console.log("returning true")
    return dynamicRegex.test(text || '');
  }
  
  console.log("returning false")
  return false;
}

export function stripAIMention(text, customAliases = []) {
  // Strip default @collabai
  let result = (text || '').replace(AI_MENTION_REGEX, '$1');
  
  // Strip dynamic user aliases if provided
  if (customAliases && customAliases.length > 0) {
    const aliasPattern = customAliases.join('|');
    const dynamicRegex = new RegExp(`(^|[^\\w@])@(${aliasPattern})\\b`, 'ig'); // 'g' flag to catch multiple
    result = result.replace(dynamicRegex, '$1');
  }
  
  return result.replace(/\s{2,}/g, ' ').trim();
}
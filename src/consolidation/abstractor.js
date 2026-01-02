/**
 * Essence Abstractor
 *
 * Convert verbose experiences to essence.
 * Keep meaning, remove narrative.
 */

const NARRATIVE_PATTERNS = [
  // Remove "I did" narrative
  /^I (was |have been |had been )?/i,
  /^(So |Then |After that |Next )/i,
  /^(Let me |I'll |I will |I would )/i,

  // Remove process steps
  /^(First|Second|Third|Finally),? /i,
  /^(After|Before|While) (I |we )/i,

  // Remove hedging
  /^(I think |I believe |It seems |Probably )/i,
];

const FILLER_PATTERNS = [
  / and then /gi,
  / so that /gi,
  / in order to /gi,
  / which means /gi,
  / basically /gi,
  / essentially /gi,
  / actually /gi,
];

/**
 * Abstract content to its essence
 */
export function abstractToEssence(content) {
  let result = content;

  // Remove narrative starts
  for (const pattern of NARRATIVE_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Remove filler phrases
  for (const pattern of FILLER_PATTERNS) {
    result = result.replace(pattern, ' ');
  }

  // Extract key components
  const outcome = extractOutcome(result);
  const location = extractLocation(result);
  const rationale = extractRationale(result);

  // Reconstruct as essence
  const parts = [outcome];

  if (rationale && rationale !== outcome) {
    parts.push(`(${rationale})`);
  }

  if (location) {
    parts.push(`[${location}]`);
  }

  return parts.join(' ').trim();
}

/**
 * Extract the outcome/result from content
 */
function extractOutcome(content) {
  // Look for "X was Y" patterns
  const wasMatch = content.match(/(.+?) was (.+?)(?:\.|$)/i);
  if (wasMatch) {
    return `${wasMatch[1].trim()}: ${wasMatch[2].trim()}`;
  }

  // Look for "fixed/solved X by Y" patterns
  const fixedMatch = content.match(/(fixed|solved|resolved) (.+?) by (.+?)(?:\.|$)/i);
  if (fixedMatch) {
    return `${fixedMatch[2].trim()} fix: ${fixedMatch[3].trim()}`;
  }

  // Truncate to first sentence
  const firstSentence = content.split(/[.!?]/)[0];
  return firstSentence.trim();
}

/**
 * Extract file location if present
 */
function extractLocation(content) {
  // Match file:line patterns
  const fileLineMatch = content.match(/([\w\/-]+\.(ts|tsx|js|jsx|py)):(\d+)/i);
  if (fileLineMatch) {
    return `${fileLineMatch[1]}:${fileLineMatch[3]}`;
  }

  // Match just file patterns
  const fileMatch = content.match(/(src|lib|app|components)\/[\w\/-]+\.(ts|tsx|js|jsx|py)/i);
  if (fileMatch) {
    return fileMatch[0];
  }

  return null;
}

/**
 * Extract rationale ("because X")
 */
function extractRationale(content) {
  const becauseMatch = content.match(/because (.+?)(?:\.|$)/i);
  if (becauseMatch) {
    return becauseMatch[1].trim();
  }

  return null;
}

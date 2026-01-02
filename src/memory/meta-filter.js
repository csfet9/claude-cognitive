/**
 * Meta Content Filter
 *
 * Blocks meta-content from being stored.
 * Meta-content = stuff about the session, not the project.
 */

const META_PATTERNS = [
  // Session state
  /user (asked|instructed|requested|said)/i,
  /session (start|end|began|ended)/i,
  /at the (start|end|beginning) of/i,

  // Memory operations
  /memory:(sync|recall|retain|forget)/i,
  /synced? memory/i,
  /recalled? (from )?memory/i,

  // Process narrative
  /^(then|next|after that|first) I/i,
  /I (read|opened|looked at|checked)/i,
  /ran the (command|build|test)/i,

  // Commands
  /executed \/\w+/i,
  /ran \/\w+/i,

  // Claude self-reference
  /^I (will|would|should|can)/i,
  /let me/i,
];

/**
 * Check if content is meta (about session, not project)
 */
export function isMetaContent(content) {
  if (!content) return false;
  return META_PATTERNS.some((pattern) => pattern.test(content));
}

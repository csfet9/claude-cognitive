/**
 * Trigger Extractor
 *
 * Extract triggers from context for memory retrieval.
 */

/**
 * Extract triggers from current context
 */
export function extractTriggers(context) {
  return {
    // File path triggers location memories
    file: context.currentFile || null,

    // Keywords from user message
    keywords: extractKeywords(context.userMessage || ''),

    // Error patterns
    error: context.lastError || null,

    // Entities (component names, etc.)
    entities: extractEntities(context.userMessage || ''),
  };
}

/**
 * Extract keywords from text
 */
function extractKeywords(text) {
  if (!text) return [];

  // Remove common words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can',
    'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they',
    'it', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'or', 'and', 'not', 'but', 'if', 'so', 'as', 'how',
    'what', 'when', 'where', 'why', 'which', 'who', 'me', 'my',
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return [...new Set(words)];
}

/**
 * Extract entities (capitalized words, likely component/class names)
 */
function extractEntities(text) {
  if (!text) return [];

  // Match PascalCase or camelCase words
  const entityPattern = /\b([A-Z][a-zA-Z]+|[a-z]+[A-Z][a-zA-Z]*)\b/g;
  const matches = text.match(entityPattern) || [];

  return [...new Set(matches)];
}

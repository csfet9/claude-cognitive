/**
 * Semantic Memory
 *
 * Manages .claude/memory.md - the stable project knowledge.
 * Human-curated, always loaded at session start.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DEFAULT_CONTENT = `# Project Memory

## Tech Stack
<!-- Add your tech stack here -->

## Key Decisions
<!-- Add important decisions and their rationale -->

## Critical Paths
<!-- Add important file locations -->
`;

export class SemanticMemory {
  constructor(filePath) {
    this.filePath = filePath;
    this.sections = new Map();
    this.loaded = false;
  }

  /**
   * Load and parse memory file
   */
  async load() {
    if (!existsSync(this.filePath)) {
      // Create default file
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, DEFAULT_CONTENT, 'utf-8');
    }

    const content = readFileSync(this.filePath, 'utf-8');
    this.parse(content);
    this.loaded = true;
  }

  /**
   * Parse markdown into sections
   */
  parse(content) {
    this.sections.clear();

    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      // Check for ## heading
      const match = line.match(/^##\s+(.+)$/);

      if (match) {
        // Save previous section
        if (currentSection) {
          this.sections.set(currentSection, currentContent.join('\n').trim());
        }

        currentSection = match[1];
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      this.sections.set(currentSection, currentContent.join('\n').trim());
    }
  }

  /**
   * Get section content
   */
  get(section) {
    return this.sections.get(section) || '';
  }

  /**
   * Set section content
   */
  set(section, content) {
    this.sections.set(section, content);
  }

  /**
   * Append to section
   */
  append(section, item) {
    const current = this.get(section);
    const newContent = current ? `${current}\n${item}` : item;
    this.set(section, newContent);
  }

  /**
   * Save to file
   */
  async save() {
    let content = '# Project Memory\n\n';

    for (const [section, sectionContent] of this.sections) {
      content += `## ${section}\n${sectionContent}\n\n`;
    }

    writeFileSync(this.filePath, content.trim() + '\n', 'utf-8');
  }

  /**
   * Format as context string for Claude
   */
  toContext() {
    const lines = [];

    for (const [section, content] of this.sections) {
      // Skip empty sections and comments
      const cleanContent = content
        .split('\n')
        .filter((line) => !line.startsWith('<!--') && line.trim())
        .join('\n');

      if (cleanContent) {
        lines.push(`## ${section}`);
        lines.push(cleanContent);
        lines.push('');
      }
    }

    return lines.join('\n').trim();
  }
}

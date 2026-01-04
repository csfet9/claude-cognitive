/**
 * Semantic memory management for claude-cognitive.
 * Manages the .claude/memory.md file with section-based storage.
 * @module semantic
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, isAbsolute } from "node:path";
import type { Observation } from "./events.js";

// ============================================
// Constants
// ============================================

/** Default template for new semantic memory files */
export const DEFAULT_TEMPLATE = `## Tech Stack

<!-- Technologies used in this project -->

## Key Decisions

<!-- Important architectural and design decisions -->

## Critical Paths

<!-- Important file relationships and code paths -->

## Observations

<!-- Promoted observations from Hindsight -->
`;

/** Header regex to match H2 sections */
const SECTION_HEADER_REGEX = /^##\s+(.+)$/;

// ============================================
// Types
// ============================================

/** Options for SemanticMemory constructor */
export interface SemanticMemoryOptions {
  /** Create file with template if it doesn't exist (default: true) */
  createIfMissing?: boolean;
  /** Custom template content for new files */
  template?: string;
}

/** Result of parsing a markdown file into sections */
export interface ParseResult {
  /** Map of section name to content (without header) */
  sections: Map<string, string>;
  /** Original section order for preserving structure */
  order: string[];
  /** Any content before the first H2 header (preamble) */
  preamble: string;
}

// ============================================
// SemanticMemory Class
// ============================================

/**
 * Manages the .claude/memory.md semantic memory file.
 *
 * Provides section-based access to markdown content with:
 * - Lazy loading (load on first access)
 * - Section preservation (maintains structure)
 * - Atomic writes (write to temp, then rename)
 * - Observation promotion support
 *
 * @example
 * ```typescript
 * const semantic = new SemanticMemory('/path/to/project');
 * await semantic.load();
 *
 * const stack = semantic.get('Tech Stack');
 * semantic.append('Observations', '- New insight (2025-01-02)');
 * await semantic.save();
 * ```
 */
export class SemanticMemory {
  /** Project root directory (stored for reference, used in filePath calculation) */
  readonly projectPath: string;

  /** Relative path to memory file from project root (stored for reference) */
  readonly relativePath: string;

  /** Full absolute path to memory file */
  private readonly filePath: string;

  /** Options for behavior customization */
  private readonly options: Required<SemanticMemoryOptions>;

  /** Parsed sections (null if not loaded) */
  private sections: Map<string, string> | null = null;

  /** Section order for preserving structure */
  private sectionOrder: string[] = [];

  /** Preamble content (before first H2) */
  private preamble: string = "";

  /** Whether the file has been modified since last save */
  private dirty: boolean = false;

  /** Lock for preventing concurrent writes */
  private writeLock: Promise<void> | null = null;

  /**
   * Create a new SemanticMemory instance.
   *
   * @param projectPath - Project root directory
   * @param relativePath - Path to memory file relative to project (default: ".claude/memory.md")
   * @param options - Configuration options
   */
  constructor(
    projectPath: string,
    relativePath: string = ".claude/memory.md",
    options: SemanticMemoryOptions = {},
  ) {
    this.projectPath = projectPath;
    this.relativePath = relativePath;
    this.filePath = isAbsolute(relativePath)
      ? relativePath
      : join(projectPath, relativePath);

    this.options = {
      createIfMissing: options.createIfMissing ?? true,
      template: options.template ?? DEFAULT_TEMPLATE,
    };
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Load the semantic memory file.
   *
   * If the file doesn't exist and createIfMissing is true,
   * creates it with the default template.
   *
   * @throws {Error} If file cannot be read or created
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      const parsed = this.parseMarkdown(content);
      this.sections = parsed.sections;
      this.sectionOrder = parsed.order;
      this.preamble = parsed.preamble;
      this.dirty = false;
    } catch (error) {
      if (this.isNotFoundError(error) && this.options.createIfMissing) {
        // Try to create directory and file with template
        try {
          await this.createWithTemplate();
        } catch (createError) {
          // Log creation failure for debugging visibility
          console.warn(
            `[SemanticMemory] Failed to create ${this.filePath}: ${
              createError instanceof Error
                ? createError.message
                : String(createError)
            }. Using empty sections.`,
          );
          // Initialize with empty sections to allow system to continue
          this.sections = new Map();
          this.sectionOrder = [];
          this.preamble = "";
          this.dirty = false;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Save the semantic memory file.
   *
   * Uses atomic write (temp file + rename) to prevent corruption.
   * Thread-safe via internal lock that serializes concurrent calls.
   *
   * @throws {Error} If file cannot be written
   */
  async save(): Promise<void> {
    if (!this.sections) {
      throw new Error("SemanticMemory not loaded. Call load() first.");
    }

    if (!this.dirty) {
      return; // No changes to save
    }

    // Wait for any pending write to complete (loop handles concurrent arrivals)
    while (this.writeLock) {
      await this.writeLock;
    }

    // Now we're the only writer - create new write lock
    this.writeLock = this.performSave();
    try {
      await this.writeLock;
    } finally {
      this.writeLock = null;
    }
  }

  /**
   * Get content of a section.
   *
   * @param section - Section name (without ##)
   * @returns Section content, or undefined if not found
   */
  get(section: string): string | undefined {
    this.assertLoaded();
    return this.sections!.get(section);
  }

  /**
   * Set content of a section.
   *
   * If section doesn't exist, creates it at the end.
   *
   * @param section - Section name (without ##)
   * @param content - New content (without header)
   */
  set(section: string, content: string): void {
    this.assertLoaded();

    if (!this.sections!.has(section)) {
      this.sectionOrder.push(section);
    }

    this.sections!.set(section, content);
    this.dirty = true;
  }

  /**
   * Append an item to a section.
   *
   * If section doesn't exist, creates it.
   * Ensures proper newline handling.
   *
   * @param section - Section name (without ##)
   * @param item - Item to append (will be added on new line)
   */
  append(section: string, item: string): void {
    this.assertLoaded();

    const existing = this.sections!.get(section) ?? "";
    const trimmed = existing.trimEnd();
    const separator = trimmed.length > 0 ? "\n" : "";

    this.set(section, trimmed + separator + item);
  }

  /**
   * Check if a section exists.
   *
   * @param section - Section name
   * @returns True if section exists
   */
  has(section: string): boolean {
    this.assertLoaded();
    return this.sections!.has(section);
  }

  /**
   * Get all section names.
   *
   * @returns Array of section names in order
   */
  getSectionNames(): string[] {
    this.assertLoaded();
    return [...this.sectionOrder];
  }

  /**
   * Delete a section.
   *
   * @param section - Section name to delete
   * @returns True if section was deleted
   */
  delete(section: string): boolean {
    this.assertLoaded();

    const deleted = this.sections!.delete(section);
    if (deleted) {
      this.sectionOrder = this.sectionOrder.filter((s) => s !== section);
      this.dirty = true;
    }
    return deleted;
  }

  // ============================================
  // Context Formatting
  // ============================================

  /**
   * Format semantic memory as context string for injection.
   *
   * Returns the full file content with a header, suitable for
   * including in session context.
   *
   * @returns Formatted context string
   */
  toContext(): string {
    this.assertLoaded();

    const sectionParts: string[] = [];

    for (const section of this.sectionOrder) {
      const content = this.sections!.get(section);
      // Check if content has meaningful text (not just comments)
      if (content && this.hasNonCommentContent(content)) {
        sectionParts.push(`## ${section}`);
        sectionParts.push(content.trim());
        sectionParts.push("");
      }
    }

    // If no sections with content, return empty string
    if (sectionParts.length === 0) {
      return "";
    }

    // Add header and join
    const parts: string[] = [];
    parts.push("### Semantic Memory (.claude/memory.md)");
    parts.push("");
    parts.push(...sectionParts);

    return parts.join("\n").trimEnd();
  }

  // ============================================
  // Observation Promotion
  // ============================================

  /**
   * Promote an observation to the Observations section.
   *
   * Formats the observation with timestamp and appends to
   * the Observations section.
   *
   * @param observation - Observation to promote
   * @param autoSave - Whether to save immediately (default: true)
   */
  async promoteObservation(
    observation: Observation,
    autoSave: boolean = true,
  ): Promise<void> {
    this.assertLoaded();

    const timestamp = new Date().toISOString(); // Full ISO timestamp for ordering
    const entry = `- ${observation.text} (promoted: ${timestamp}, confidence: ${observation.confidence.toFixed(2)})`;

    this.append("Observations", entry);

    if (autoSave) {
      await this.save();
    }
  }

  // ============================================
  // Utilities
  // ============================================

  /**
   * Get the absolute file path.
   */
  getFilePath(): string {
    return this.filePath;
  }

  /**
   * Check if changes are pending save.
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Check if file is loaded.
   */
  isLoaded(): boolean {
    return this.sections !== null;
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Parse markdown content into sections.
   * @internal
   */
  private parseMarkdown(content: string): ParseResult {
    const lines = content.split("\n");
    const sections = new Map<string, string>();
    const order: string[] = [];

    let preamble = "";
    let currentSection: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const match = line.match(SECTION_HEADER_REGEX);

      if (match && match[1]) {
        // Save previous section
        if (currentSection !== null) {
          sections.set(currentSection, currentContent.join("\n"));
        } else if (currentContent.length > 0) {
          preamble = currentContent.join("\n");
        }

        // Start new section
        currentSection = match[1].trim();
        order.push(currentSection);
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save final section
    if (currentSection !== null) {
      sections.set(currentSection, currentContent.join("\n"));
    } else if (currentContent.length > 0) {
      preamble = currentContent.join("\n");
    }

    return { sections, order, preamble };
  }

  /**
   * Create file with default template.
   * @internal
   */
  private async createWithTemplate(): Promise<void> {
    // Ensure directory exists
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    // Write template
    await writeFile(this.filePath, this.options.template, "utf-8");

    // Parse the template
    const parsed = this.parseMarkdown(this.options.template);
    this.sections = parsed.sections;
    this.sectionOrder = parsed.order;
    this.preamble = parsed.preamble;
    this.dirty = false;
  }

  /**
   * Perform the actual save operation.
   * @internal
   */
  private async performSave(): Promise<void> {
    const content = this.toMarkdown();

    // Ensure directory exists (in case it was deleted)
    const dir = dirname(this.filePath);
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(this.filePath, content, "utf-8");
    this.dirty = false;
  }

  /**
   * Convert sections back to markdown.
   * @internal
   */
  private toMarkdown(): string {
    const parts: string[] = [];

    // Include preamble if present
    if (this.preamble.trim().length > 0) {
      parts.push(this.preamble);
      parts.push("");
    }

    // Add sections in order
    for (const section of this.sectionOrder) {
      const content = this.sections!.get(section) ?? "";
      parts.push(`## ${section}`);
      parts.push(content);
    }

    return parts.join("\n");
  }

  /**
   * Check if content has non-comment text.
   * @internal
   */
  private hasNonCommentContent(content: string): boolean {
    // Remove HTML comments and check if anything meaningful remains
    const withoutComments = content.replace(/<!--[\s\S]*?-->/g, "");
    return withoutComments.trim().length > 0;
  }

  /**
   * Assert that sections are loaded.
   * @internal
   */
  private assertLoaded(): void {
    if (!this.sections) {
      throw new Error("SemanticMemory not loaded. Call load() first.");
    }
  }

  /**
   * Check if error is a file not found error.
   * @internal
   */
  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }
}

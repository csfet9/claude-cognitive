/**
 * Tests for the process-session hook.
 * @module tests/unit/hooks/process-session
 *
 * Note: Full integration testing of hooks that call process.exit
 * is done in e2e tests by spawning the CLI process.
 */

import { describe, it, expect } from "vitest";
import cac from "cac";
import {
  registerProcessSessionCommand,
  _summarizeLongCodeBlocks,
  _truncateLongLines,
  _applyFilters,
  _shouldSkipSession,
} from "../../../src/hooks/process-session.js";
import type { RetainFilterConfig } from "../../../src/types.js";

describe("process-session hook", () => {
  describe("command registration", () => {
    it("should register the process-session command", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const commands = cli.commands;
      const processCmd = commands.find((c) => c.name === "process-session");

      expect(processCmd).toBeDefined();
      expect(processCmd?.name).toBe("process-session");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const projectOpt = processCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have transcript option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const transcriptOpt = processCmd?.options.find((o) =>
        o.names.includes("transcript"),
      );

      expect(transcriptOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const jsonOpt = processCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");

      expect(processCmd?.description).toContain("transcript");
    });
  });

  describe("summarizeLongCodeBlocks", () => {
    it("should keep short code blocks unchanged", () => {
      const content = "```typescript\nconst x = 1;\n```";
      const result = _summarizeLongCodeBlocks(content, 100);
      expect(result).toBe(content);
    });

    it("should summarize code blocks exceeding maxLines", () => {
      const lines = Array(600).fill("const x = 1;").join("\n");
      const content = `\`\`\`typescript\n${lines}\n\`\`\``;
      const result = _summarizeLongCodeBlocks(content, 500);
      expect(result).toBe("[Code block: 601 lines of typescript]");
    });

    it("should handle code blocks without language specifier", () => {
      const lines = Array(600).fill("x = 1").join("\n");
      const content = `\`\`\`\n${lines}\n\`\`\``;
      const result = _summarizeLongCodeBlocks(content, 500);
      expect(result).toBe("[Code block: 601 lines of code]");
    });

    it("should handle multiple code blocks", () => {
      const shortBlock = "```js\nconsole.log('hi');\n```";
      const longLines = Array(600).fill("x = 1").join("\n");
      const longBlock = `\`\`\`python\n${longLines}\n\`\`\``;
      const content = `${shortBlock}\n\nSome text\n\n${longBlock}`;
      const result = _summarizeLongCodeBlocks(content, 500);
      expect(result).toContain("```js\nconsole.log('hi');\n```");
      expect(result).toContain("[Code block: 601 lines of python]");
    });
  });

  describe("truncateLongLines", () => {
    it("should keep short lines unchanged", () => {
      const content = "short line\nanother short line";
      const result = _truncateLongLines(content, 100);
      expect(result).toBe(content);
    });

    it("should truncate lines exceeding maxLength", () => {
      const longLine = "a".repeat(150);
      const content = `short\n${longLine}\nshort again`;
      const result = _truncateLongLines(content, 100);
      expect(result).toBe(
        `short\n${"a".repeat(100)}... [truncated]\nshort again`,
      );
    });

    it("should handle empty content", () => {
      const result = _truncateLongLines("", 100);
      expect(result).toBe("");
    });
  });

  describe("applyFilters", () => {
    const defaultConfig: RetainFilterConfig = {
      filterToolResults: true,
      filterFileContents: true,
      maxCodeBlockLines: 500,
      maxLineLength: 2000,
    };

    it("should filter tool results", () => {
      const content = "Before <tool-result>some result</tool-result> After";
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [Tool result filtered] After");
    });

    it("should filter file contents", () => {
      const content =
        'Before <file-contents path="/test">content</file-contents> After';
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [File contents filtered] After");
    });

    it("should filter read-file-result", () => {
      const content =
        "Before <read-file-result>file data</read-file-result> After";
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [File read filtered] After");
    });

    it("should filter glob-result", () => {
      const content = "Before <glob-result>file1\nfile2</glob-result> After";
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [Glob result filtered] After");
    });

    it("should filter grep-result", () => {
      const content = "Before <grep-result>match1\nmatch2</grep-result> After";
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [Grep result filtered] After");
    });

    it("should filter bash-stdout", () => {
      const content = "Before <bash-stdout>output</bash-stdout> After";
      const result = _applyFilters(content, defaultConfig);
      expect(result).toBe("Before [Command output filtered] After");
    });

    it("should respect filterToolResults=false", () => {
      const content = "Before <tool-result>some result</tool-result> After";
      const result = _applyFilters(content, {
        ...defaultConfig,
        filterToolResults: false,
      });
      expect(result).toBe(content);
    });

    it("should respect filterFileContents=false", () => {
      const content =
        'Before <file-contents path="/test">content</file-contents> After';
      const result = _applyFilters(content, {
        ...defaultConfig,
        filterFileContents: false,
      });
      expect(result).toBe(content);
    });

    it("should apply all filters together", () => {
      const content = `User asked something
<tool-result>result here</tool-result>
Assistant: Here's the file:
<file-contents path="/test.ts">const x = 1;</file-contents>
Done!`;
      const result = _applyFilters(content, defaultConfig);
      expect(result).toContain("[Tool result filtered]");
      expect(result).toContain("[File contents filtered]");
      expect(result).toContain("User asked something");
      expect(result).toContain("Done!");
    });
  });

  describe("shouldSkipSession", () => {
    const defaultConfig: RetainFilterConfig = {
      minSessionLength: 200,
      skipToolOnlySessions: true,
    };

    it("should skip sessions shorter than minSessionLength", () => {
      const result = _shouldSkipSession("short", defaultConfig);
      expect(result.skip).toBe(true);
      expect(result.reason).toContain("too short");
    });

    it("should not skip sessions at or above minSessionLength", () => {
      const content = "a".repeat(250);
      const result = _shouldSkipSession(content, defaultConfig);
      expect(result.skip).toBe(false);
    });

    it("should skip sessions that are mostly tool outputs", () => {
      // Create content that's mostly filter placeholders
      const placeholders = Array(50).fill("[Tool result filtered]").join(" ");
      const result = _shouldSkipSession(placeholders, defaultConfig);
      expect(result.skip).toBe(true);
      expect(result.reason).toContain("mostly tool outputs");
    });

    it("should not skip sessions with mixed content", () => {
      const content = `User: Can you help me understand this code?

Assistant: Of course! Let me explain the implementation.

[Tool result filtered]

The code uses a factory pattern to create instances.
It's well structured and follows best practices.

User: Thanks, that makes sense now!`;
      const result = _shouldSkipSession(content, defaultConfig);
      expect(result.skip).toBe(false);
    });

    it("should respect skipToolOnlySessions=false", () => {
      const placeholders = Array(50).fill("[Tool result filtered]").join(" ");
      const result = _shouldSkipSession(placeholders, {
        ...defaultConfig,
        skipToolOnlySessions: false,
      });
      expect(result.skip).toBe(false);
    });

    it("should respect custom minSessionLength", () => {
      const content = "a".repeat(100);
      const result = _shouldSkipSession(content, {
        ...defaultConfig,
        minSessionLength: 50,
      });
      expect(result.skip).toBe(false);
    });
  });
});

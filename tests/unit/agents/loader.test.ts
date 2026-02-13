/**
 * Tests for the agent template loader.
 * @module tests/unit/agents/loader
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import {
  parseAgentMarkdown,
  parseFrontmatter,
  loadCustomAgents,
  templateToMarkdown,
} from "../../../src/agents/loader.js";

describe("agent loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-cognitive-agent-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("parseFrontmatter()", () => {
    it("should return empty frontmatter when no delimiters", () => {
      const result = parseFrontmatter("# Agent: test\n## Mission\nHello.");
      expect(result.frontmatter).toEqual({});
      expect(result.body).toContain("# Agent: test");
    });

    it("should return empty frontmatter when only opening delimiter", () => {
      const result = parseFrontmatter("---\nmodel: opus\n# Agent: test");
      expect(result.frontmatter).toEqual({});
    });

    it("should parse model field", () => {
      const result = parseFrontmatter("---\nmodel: sonnet\n---\n# Agent: test");
      expect(result.frontmatter.model).toBe("sonnet");
    });

    it("should ignore cost field (removed, derived from model)", () => {
      const result = parseFrontmatter(
        "---\ncost: expensive\n---\n# Agent: test",
      );
      // cost is no longer parsed — treated as unknown key
      expect(
        (result.frontmatter as Record<string, unknown>).cost,
      ).toBeUndefined();
    });

    it("should parse categories as comma-separated list", () => {
      const result = parseFrontmatter(
        "---\ncategories: exploration, research\n---\n# Agent: test",
      );
      expect(result.frontmatter.categories).toEqual([
        "exploration",
        "research",
      ]);
    });

    it("should parse categories with brackets", () => {
      const result = parseFrontmatter(
        "---\ncategories: [security, review]\n---\n# Agent: test",
      );
      expect(result.frontmatter.categories).toEqual(["security", "review"]);
    });

    it("should parse name from frontmatter", () => {
      const result = parseFrontmatter("---\nname: my-agent\n---\n## Mission");
      expect(result.frontmatter.name).toBe("my-agent");
    });

    it("should ignore invalid model values", () => {
      const result = parseFrontmatter("---\nmodel: gpt4\n---\n# Agent: test");
      expect(result.frontmatter.model).toBeUndefined();
    });

    it("should filter invalid categories", () => {
      const result = parseFrontmatter(
        "---\ncategories: exploration, invalid, security\n---\n# Agent: test",
      );
      expect(result.frontmatter.categories).toEqual([
        "exploration",
        "security",
      ]);
    });

    it("should ignore unknown keys like description", () => {
      const result = parseFrontmatter(
        "---\nname: test\ndescription: A long description\nmodel: haiku\n---\n# Agent: test",
      );
      expect(result.frontmatter.name).toBe("test");
      expect(result.frontmatter.model).toBe("haiku");
      // description is silently ignored
    });

    it("should return body without frontmatter", () => {
      const result = parseFrontmatter(
        "---\nmodel: opus\n---\n# Agent: test\n## Mission\nHello.",
      );
      expect(result.body).toContain("# Agent: test");
      expect(result.body).not.toContain("---");
    });

    it("should handle all three model tiers", () => {
      for (const model of ["opus", "sonnet", "haiku"]) {
        const result = parseFrontmatter(`---\nmodel: ${model}\n---\nbody`);
        expect(result.frontmatter.model).toBe(model);
      }
    });
  });

  describe("parseAgentMarkdown()", () => {
    it("should parse a valid agent template", () => {
      const content = `# Agent: explorer

## Mission
Explore and understand codebases.

## Tools Available
- Read
- Glob
- Grep

## Output Format
Return findings in structured markdown.

## Constraints
- Do not modify files
- Stay within scope
`;

      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("explorer");
      expect(result?.mission).toBe("Explore and understand codebases.");
      expect(result?.tools).toContain("Read");
      expect(result?.tools).toContain("Glob");
      expect(result?.tools).toContain("Grep");
      expect(result?.outputFormat).toBe(
        "Return findings in structured markdown.",
      );
      expect(result?.constraints).toContain("Do not modify files");
      expect(result?.constraints).toContain("Stay within scope");
    });

    it("should parse frontmatter with model and categories", () => {
      const content = `---
model: sonnet
categories: implementation, testing
---
# Agent: builder

## Mission
Build things.

## Tools Available
- Read
- Write

## Output Format
Code.

## Constraints
- Follow patterns
`;
      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("builder");
      expect(result?.model).toBe("sonnet");
      expect(result?.categories).toEqual(["implementation", "testing"]);
    });

    it("should use frontmatter name as fallback when # Agent: is empty", () => {
      const content = `---
name: fallback-agent
model: haiku
---
# Agent:

## Mission
Test.
`;
      // # Agent: has empty name, should fall back to frontmatter name
      const result = parseAgentMarkdown(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("fallback-agent");
    });

    it("should use frontmatter name when no # Agent: header exists", () => {
      const content = `---
name: fm-only-agent
model: opus
---

## Mission
Test.

## Tools Available
- Read

## Output Format
Text.

## Constraints
- None
`;
      const result = parseAgentMarkdown(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("fm-only-agent");
      expect(result?.model).toBe("opus");
    });

    it("should return null when no name in frontmatter or header", () => {
      const content = `---
model: opus
---

## Mission
No name anywhere.
`;
      const result = parseAgentMarkdown(content);
      expect(result).toBeNull();
    });

    it("should not set model/categories when no frontmatter", () => {
      const content = `# Agent: plain

## Mission
Plain agent.
`;
      const result = parseAgentMarkdown(content);
      expect(result?.model).toBeUndefined();
      expect(result?.categories).toBeUndefined();
    });

    it("should return null for content without agent name", () => {
      const content = `## Mission
Some mission without agent name.
`;
      const result = parseAgentMarkdown(content);
      expect(result).toBeNull();
    });

    it("should return null for empty agent name", () => {
      const content = `# Agent:

## Mission
Some mission.
`;
      const result = parseAgentMarkdown(content);
      expect(result).toBeNull();
    });

    it("should handle missing sections", () => {
      const content = `# Agent: minimal-agent

## Mission
A minimal agent.
`;
      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("minimal-agent");
      expect(result?.mission).toBe("A minimal agent.");
      expect(result?.tools).toEqual([]);
      expect(result?.outputFormat).toBe("");
      expect(result?.constraints).toEqual([]);
    });

    it("should parse tools with asterisk bullets", () => {
      const content = `# Agent: test

## Mission
Test.

## Tools Available
* Tool1
* Tool2

## Output Format
None.

## Constraints
* Constraint1
`;
      const result = parseAgentMarkdown(content);

      expect(result?.tools).toContain("Tool1");
      expect(result?.tools).toContain("Tool2");
      expect(result?.constraints).toContain("Constraint1");
    });

    it("should remove bold markers from list items", () => {
      const content = `# Agent: test

## Mission
Test.

## Tools Available
- Tool with **bold text** inside
- Another **emphasized** item

## Output Format
None.

## Constraints
- None
`;
      const result = parseAgentMarkdown(content);

      // Bold markers in the middle are removed
      expect(result?.tools).toContain("Tool with bold text inside");
      expect(result?.tools).toContain("Another emphasized item");
    });

    it("should handle multi-line mission", () => {
      const content = `# Agent: test

## Mission
First line of mission.
Second line of mission.
Third line.

## Tools Available
- Tool

## Output Format
Output.

## Constraints
- Constraint
`;
      const result = parseAgentMarkdown(content);

      expect(result?.mission).toBe(
        "First line of mission.\nSecond line of mission.\nThird line.",
      );
    });

    it("should parse real-world agent file with description in frontmatter", () => {
      const content = `---
name: security-code-reviewer
description: Use this agent for security review.
model: opus
categories: security, review
---

You are a Security Code Reviewer.

## Core Responsibilities

1. Find vulnerabilities

## Output Format

Markdown report.
`;
      const result = parseAgentMarkdown(content);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("security-code-reviewer");
      expect(result?.model).toBe("opus");
      expect(result?.categories).toEqual(["security", "review"]);
    });
  });

  describe("loadCustomAgents()", () => {
    it("should return empty array when agents directory does not exist", async () => {
      const result = await loadCustomAgents(tempDir);
      expect(result).toEqual([]);
    });

    it("should return empty array when agents path is a file", async () => {
      const agentsPath = join(tempDir, ".claude", "agents");
      await mkdir(join(tempDir, ".claude"), { recursive: true });
      await writeFile(agentsPath, "not a directory");

      const result = await loadCustomAgents(tempDir);
      expect(result).toEqual([]);
    });

    it("should load agent templates from .claude/agents/", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "explorer.md"),
        `# Agent: explorer

## Mission
Explore codebase.

## Tools Available
- Read

## Output Format
JSON.

## Constraints
- Read only
`,
      );

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("explorer");
      expect(result[0].mission).toBe("Explore codebase.");
    });

    it("should load agents with frontmatter", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "reviewer.md"),
        `---
model: sonnet
categories: review
---
# Agent: reviewer

## Mission
Review code.

## Tools Available
- Read

## Output Format
Review.

## Constraints
- Read only
`,
      );

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("reviewer");
      expect(result[0].model).toBe("sonnet");
      expect(result[0].categories).toEqual(["review"]);
    });

    it("should load multiple agents", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "agent1.md"),
        `# Agent: agent1

## Mission
Mission 1.

## Tools Available
- Tool1

## Output Format
Format 1.

## Constraints
- C1
`,
      );

      await writeFile(
        join(agentsDir, "agent2.md"),
        `# Agent: agent2

## Mission
Mission 2.

## Tools Available
- Tool2

## Output Format
Format 2.

## Constraints
- C2
`,
      );

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(2);
      expect(result.map((a) => a.name).sort()).toEqual(["agent1", "agent2"]);
    });

    it("should skip non-markdown files", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "agent.md"),
        `# Agent: valid

## Mission
Valid.

## Tools Available
- Tool

## Output Format
Format.

## Constraints
- C
`,
      );

      await writeFile(join(agentsDir, "notes.txt"), "some notes");
      await writeFile(join(agentsDir, "config.json"), "{}");

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("valid");
    });

    it("should skip invalid markdown files", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "valid.md"),
        `# Agent: valid

## Mission
Valid.

## Tools Available
- Tool

## Output Format
Format.

## Constraints
- C
`,
      );

      await writeFile(
        join(agentsDir, "invalid.md"),
        "# Not an agent\nJust some markdown.",
      );

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("valid");
    });
  });

  describe("templateToMarkdown()", () => {
    it("should generate valid markdown from template", () => {
      const template = {
        name: "test-agent",
        mission: "Test mission.",
        tools: ["Read", "Write"],
        outputFormat: "JSON response.",
        constraints: ["Be concise", "No side effects"],
      };

      const markdown = templateToMarkdown(template);

      expect(markdown).toContain("# Agent: test-agent");
      expect(markdown).toContain("## Mission");
      expect(markdown).toContain("Test mission.");
      expect(markdown).toContain("## Tools Available");
      expect(markdown).toContain("- Read");
      expect(markdown).toContain("- Write");
      expect(markdown).toContain("## Output Format");
      expect(markdown).toContain("JSON response.");
      expect(markdown).toContain("## Constraints");
      expect(markdown).toContain("- Be concise");
      expect(markdown).toContain("- No side effects");
    });

    it("should not include frontmatter when no routing fields set", () => {
      const template = {
        name: "plain",
        mission: "Plain.",
        tools: [],
        outputFormat: "Text.",
        constraints: [],
      };

      const markdown = templateToMarkdown(template);
      expect(markdown).not.toContain("---");
    });

    it("should include frontmatter when model is set", () => {
      const template = {
        name: "with-model",
        mission: "Test.",
        tools: [],
        outputFormat: "Text.",
        constraints: [],
        model: "sonnet" as const,
      };

      const markdown = templateToMarkdown(template);
      expect(markdown).toContain("---");
      expect(markdown).toContain("model: sonnet");
    });

    it("should include all routing fields in frontmatter", () => {
      const template = {
        name: "full",
        mission: "Test.",
        tools: [],
        outputFormat: "Text.",
        constraints: [],
        model: "opus" as const,
        categories: ["security" as const, "review" as const],
      };

      const markdown = templateToMarkdown(template);
      expect(markdown).toContain("model: opus");
      expect(markdown).toContain("categories: security, review");
      expect(markdown).not.toContain("cost:");
    });

    it("should be round-trippable", () => {
      const original = {
        name: "roundtrip",
        mission: "Test round-trip parsing.",
        tools: ["Tool1", "Tool2"],
        outputFormat: "Plain text.",
        constraints: ["Constraint1", "Constraint2"],
      };

      const markdown = templateToMarkdown(original);
      const parsed = parseAgentMarkdown(markdown);

      expect(parsed?.name).toBe(original.name);
      expect(parsed?.mission).toBe(original.mission);
      expect(parsed?.tools).toEqual(original.tools);
      expect(parsed?.outputFormat).toBe(original.outputFormat);
      expect(parsed?.constraints).toEqual(original.constraints);
    });

    it("should be round-trippable with routing fields", () => {
      const original = {
        name: "roundtrip-routing",
        mission: "Test.",
        tools: ["Tool1"],
        outputFormat: "Text.",
        constraints: ["C1"],
        model: "haiku" as const,
        categories: ["exploration" as const, "research" as const],
      };

      const markdown = templateToMarkdown(original);
      const parsed = parseAgentMarkdown(markdown);

      expect(parsed?.name).toBe(original.name);
      expect(parsed?.model).toBe(original.model);
      expect(parsed?.categories).toEqual(original.categories);
    });

    it("should handle empty arrays", () => {
      const template = {
        name: "empty",
        mission: "Empty.",
        tools: [],
        outputFormat: "None.",
        constraints: [],
      };

      const markdown = templateToMarkdown(template);

      expect(markdown).toContain("# Agent: empty");
      expect(markdown).toContain("## Tools Available");
      expect(markdown).toContain("## Constraints");
    });
  });
});

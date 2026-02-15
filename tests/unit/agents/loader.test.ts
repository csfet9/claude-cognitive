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

  describe("parseAgentMarkdown()", () => {
    it("should parse a valid agent template", () => {
      const content = `# Agent: code-explorer

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
      expect(result?.name).toBe("code-explorer");
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

    it("should parse YAML frontmatter format with name and description", () => {
      const content = `---
name: security-code-reviewer
description: Reviews code for security vulnerabilities
model: opus
---

You are a security-focused code reviewer.

Review all code changes for potential security issues.`;

      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("security-code-reviewer");
      expect(result?.mission).toBe(
        "You are a security-focused code reviewer.\n\nReview all code changes for potential security issues.",
      );
      expect(result?.systemPromptAdditions).toBe(
        "Reviews code for security vulnerabilities",
      );
      expect(result?.tools).toEqual([]);
      expect(result?.constraints).toEqual([]);
    });

    it("should strip quotes from frontmatter values", () => {
      const content = `---
name: "bloom-developer"
description: "Use this agent when code needs to be written"
model: opus
---

You are a senior full-stack developer.`;

      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("bloom-developer");
      expect(result?.systemPromptAdditions).toBe(
        "Use this agent when code needs to be written",
      );
    });

    it("should return null for frontmatter with missing name", () => {
      const content = `---
description: Some agent without a name
model: opus
---

Body content.`;

      const result = parseAgentMarkdown(content);
      expect(result).toBeNull();
    });

    it("should parse frontmatter with sections in body", () => {
      const content = `---
name: test-agent
description: A test agent
---

## Mission
Perform security reviews.

## Tools Available
- Read
- Grep

## Constraints
- Do not modify files
- Report findings only`;

      const result = parseAgentMarkdown(content);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-agent");
      expect(result?.mission).toBe("Perform security reviews.");
      expect(result?.tools).toEqual(["Read", "Grep"]);
      expect(result?.constraints).toEqual([
        "Do not modify files",
        "Report findings only",
      ]);
      expect(result?.systemPromptAdditions).toBe("A test agent");
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

    it("should load frontmatter-format agent files", async () => {
      const agentsDir = join(tempDir, ".claude", "agents");
      await mkdir(agentsDir, { recursive: true });

      await writeFile(
        join(agentsDir, "security-reviewer.md"),
        `---
name: security-code-reviewer
description: Reviews code for security vulnerabilities
model: opus
---

You are a security-focused code reviewer.`,
      );

      const result = await loadCustomAgents(tempDir);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("security-code-reviewer");
      expect(result[0].mission).toBe(
        "You are a security-focused code reviewer.",
      );
      expect(result[0].systemPromptAdditions).toBe(
        "Reviews code for security vulnerabilities",
      );
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

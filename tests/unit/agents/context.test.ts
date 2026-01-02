/**
 * Tests for the agent context preparation.
 * @module tests/unit/agents/context
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAgentContext,
  formatAgentPrompt,
  createMinimalContext,
} from "../../../src/agents/context.js";
import type { HindsightClient } from "../../../src/client.js";
import type { AgentTemplate } from "../../../src/agents/types.js";
import type { Memory } from "../../../src/types.js";

describe("agent context", () => {
  const sampleTemplate: AgentTemplate = {
    name: "test-agent",
    mission: "Test mission description.",
    tools: ["Read", "Write", "Glob"],
    outputFormat: "Structured JSON.",
    constraints: ["Stay focused", "No side effects"],
  };

  const sampleMemories: Memory[] = [
    {
      id: "mem-1",
      text: "The project uses TypeScript.",
      factType: "world",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "mem-2",
      text: "I fixed the auth bug by updating tokens.",
      factType: "experience",
      createdAt: "2024-01-02T00:00:00Z",
    },
    {
      id: "mem-3",
      text: "This codebase prefers explicit patterns.",
      factType: "opinion",
      confidence: 0.85,
      createdAt: "2024-01-03T00:00:00Z",
    },
    {
      id: "mem-4",
      text: "Auth changes often require navigation updates.",
      factType: "observation",
      createdAt: "2024-01-04T00:00:00Z",
    },
  ];

  describe("getAgentContext()", () => {
    let mockClient: HindsightClient;

    beforeEach(() => {
      mockClient = {
        recall: vi.fn().mockResolvedValue(sampleMemories),
      } as unknown as HindsightClient;
    });

    it("should retrieve memories for the task", async () => {
      const context = await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Analyze the auth system",
      );

      expect(mockClient.recall).toHaveBeenCalledWith(
        "test-bank",
        "Analyze the auth system",
        expect.objectContaining({
          factType: "all",
          includeEntities: true,
        }),
      );

      expect(context.template).toBe(sampleTemplate);
      expect(context.memories).toEqual(sampleMemories);
      expect(context.task).toBe("Analyze the auth system");
    });

    it("should respect maxMemories option", async () => {
      const manyMemories = Array.from({ length: 20 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
        factType: "world" as const,
        createdAt: "2024-01-01T00:00:00Z",
      }));
      (mockClient.recall as ReturnType<typeof vi.fn>).mockResolvedValue(
        manyMemories,
      );

      const context = await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Task",
        { maxMemories: 5 },
      );

      expect(context.memories).toHaveLength(5);
    });

    it("should use default maxMemories of 10", async () => {
      const manyMemories = Array.from({ length: 20 }, (_, i) => ({
        id: `mem-${i}`,
        text: `Memory ${i}`,
        factType: "world" as const,
        createdAt: "2024-01-01T00:00:00Z",
      }));
      (mockClient.recall as ReturnType<typeof vi.fn>).mockResolvedValue(
        manyMemories,
      );

      const context = await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Task",
      );

      expect(context.memories).toHaveLength(10);
    });

    it("should pass budget option to recall", async () => {
      await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Task",
        { budget: "large" },
      );

      expect(mockClient.recall).toHaveBeenCalledWith(
        "test-bank",
        "Task",
        expect.objectContaining({ budget: "large" }),
      );
    });

    it("should include additional context when provided", async () => {
      const context = await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Task",
        { additionalContext: "Extra info from orchestrator." },
      );

      expect(context.additionalContext).toBe("Extra info from orchestrator.");
    });

    it("should handle recall failure gracefully", async () => {
      (mockClient.recall as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection failed"),
      );

      const context = await getAgentContext(
        mockClient,
        "test-bank",
        sampleTemplate,
        "Task",
      );

      expect(context.memories).toEqual([]);
      expect(context.template).toBe(sampleTemplate);
      expect(context.task).toBe("Task");
    });
  });

  describe("formatAgentPrompt()", () => {
    it("should include agent name and mission", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Do something.",
      });

      expect(prompt).toContain("# Agent: test-agent");
      expect(prompt).toContain("## Mission");
      expect(prompt).toContain("Test mission description.");
    });

    it("should include tools", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Task.",
      });

      expect(prompt).toContain("## Tools Available");
      expect(prompt).toContain("- Read");
      expect(prompt).toContain("- Write");
      expect(prompt).toContain("- Glob");
    });

    it("should include constraints with emphasis", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Task.",
      });

      expect(prompt).toContain("## Constraints (MUST FOLLOW)");
      expect(prompt).toContain("- Stay focused");
      expect(prompt).toContain("- No side effects");
    });

    it("should include task and output format", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Analyze the authentication flow.",
      });

      expect(prompt).toContain("## Your Task");
      expect(prompt).toContain("Analyze the authentication flow.");
      expect(prompt).toContain("## Expected Output Format");
      expect(prompt).toContain("Structured JSON.");
    });

    it("should format memories with type prefixes", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: sampleMemories,
        task: "Task.",
      });

      expect(prompt).toContain("## Relevant Project Context");
      expect(prompt).toContain("[Fact] The project uses TypeScript.");
      expect(prompt).toContain(
        "[Past experience] I fixed the auth bug by updating tokens.",
      );
      expect(prompt).toContain(
        "[Opinion (0.85)] This codebase prefers explicit patterns.",
      );
      expect(prompt).toContain(
        "[Observation] Auth changes often require navigation updates.",
      );
    });

    it("should not include memory section when empty", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Task.",
      });

      expect(prompt).not.toContain("## Relevant Project Context");
    });

    it("should include additional context when present", () => {
      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: [],
        task: "Task.",
        additionalContext: "The user wants a specific approach.",
      });

      expect(prompt).toContain("## Additional Context");
      expect(prompt).toContain("The user wants a specific approach.");
    });

    it("should handle opinion without confidence", () => {
      const memoriesWithoutConfidence: Memory[] = [
        {
          id: "mem-1",
          text: "Opinion without confidence.",
          factType: "opinion",
          createdAt: "2024-01-01T00:00:00Z",
        },
      ];

      const prompt = formatAgentPrompt({
        template: sampleTemplate,
        memories: memoriesWithoutConfidence,
        task: "Task.",
      });

      expect(prompt).toContain("[Opinion (?)] Opinion without confidence.");
    });
  });

  describe("createMinimalContext()", () => {
    it("should create compact context string", () => {
      const context = createMinimalContext(
        sampleTemplate,
        "Quick task for the agent.",
      );

      expect(context).toContain("# Agent: test-agent");
      expect(context).toContain("## Mission");
      expect(context).toContain("Test mission description.");
      expect(context).toContain("## Constraints");
      expect(context).toContain("- Stay focused");
      expect(context).toContain("## Your Task");
      expect(context).toContain("Quick task for the agent.");
      expect(context).toContain("## Expected Output Format");
      expect(context).toContain("Structured JSON.");
    });

    it("should not include tools section", () => {
      const context = createMinimalContext(sampleTemplate, "Task.");

      expect(context).not.toContain("## Tools Available");
    });

    it("should not include memory context", () => {
      const context = createMinimalContext(sampleTemplate, "Task.");

      expect(context).not.toContain("## Relevant Project Context");
    });
  });
});

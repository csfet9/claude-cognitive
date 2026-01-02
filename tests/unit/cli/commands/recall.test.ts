/**
 * Tests for the recall CLI command.
 * @module tests/unit/cli/commands/recall
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerRecallCommand } from "../../../../src/cli/commands/recall.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    recall: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  formatMemories: vi.fn(() => "formatted memories"),
  CLIError: class CLIError extends Error {
    code: number;
    hint?: string;
    constructor(message: string, code: number, hint?: string) {
      super(message);
      this.code = code;
      this.hint = hint;
    }
  },
  ExitCode: {
    CONFIG_ERROR: 78,
  },
}));

describe("recall command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the recall command", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const commands = cli.commands;
      const recallCmd = commands.find((c) => c.name.startsWith("recall"));

      expect(recallCmd).toBeDefined();
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const projectOpt = recallCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have type option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const typeOpt = recallCmd?.options.find((o) => o.names.includes("type"));

      expect(typeOpt).toBeDefined();
    });

    it("should have budget option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const budgetOpt = recallCmd?.options.find((o) =>
        o.names.includes("budget"),
      );

      expect(budgetOpt).toBeDefined();
    });

    it("should have limit option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const limitOpt = recallCmd?.options.find((o) =>
        o.names.includes("limit"),
      );

      expect(limitOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const jsonOpt = recallCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));
      const quietOpt = recallCmd?.options.find((o) =>
        o.names.includes("quiet"),
      );

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerRecallCommand(cli);

      const recallCmd = cli.commands.find((c) => c.name.startsWith("recall"));

      expect(recallCmd?.description).toContain("Search");
    });
  });
});

/**
 * Tests for the learn CLI command.
 * @module tests/unit/cli/commands/learn
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerLearnCommand } from "../../../../src/cli/commands/learn.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    learn: vi.fn().mockResolvedValue({
      memoriesCreated: 10,
      analyzers: ["package", "readme", "structure"],
    }),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  info: vi.fn(),
  formatLearnResult: vi.fn(() => "formatted learn result"),
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
    CONNECTION_ERROR: 76,
  },
}));

describe("learn command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the learn command", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const commands = cli.commands;
      const learnCmd = commands.find((c) => c.name === "learn");

      expect(learnCmd).toBeDefined();
      expect(learnCmd?.name).toBe("learn");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const learnCmd = cli.commands.find((c) => c.name === "learn");
      const projectOpt = learnCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have depth option", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const learnCmd = cli.commands.find((c) => c.name === "learn");
      const depthOpt = learnCmd?.options.find((o) => o.names.includes("depth"));

      expect(depthOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const learnCmd = cli.commands.find((c) => c.name === "learn");
      const jsonOpt = learnCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const learnCmd = cli.commands.find((c) => c.name === "learn");
      const quietOpt = learnCmd?.options.find((o) => o.names.includes("quiet"));

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerLearnCommand(cli);

      const learnCmd = cli.commands.find((c) => c.name === "learn");

      expect(learnCmd?.description).toContain("Bootstrap");
    });
  });
});

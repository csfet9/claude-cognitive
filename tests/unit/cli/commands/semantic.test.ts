/**
 * Tests for the semantic CLI command.
 * @module tests/unit/cli/commands/semantic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerSemanticCommand } from "../../../../src/cli/commands/semantic.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getSemanticMemory: vi.fn().mockReturnValue({
      isLoaded: () => true,
      toContext: () => "# Memory\n## Section\nContent",
      get: (section: string) => `Content for ${section}`,
      set: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    }),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  info: vi.fn(),
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

describe("semantic command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the semantic command", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const commands = cli.commands;
      const semanticCmd = commands.find((c) => c.name.startsWith("semantic"));

      expect(semanticCmd).toBeDefined();
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const semanticCmd = cli.commands.find((c) => c.name.startsWith("semantic"));
      const projectOpt = semanticCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have set option", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const semanticCmd = cli.commands.find((c) => c.name.startsWith("semantic"));
      const setOpt = semanticCmd?.options.find((o) => o.names.includes("set"));

      expect(setOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const semanticCmd = cli.commands.find((c) => c.name.startsWith("semantic"));
      const jsonOpt = semanticCmd?.options.find((o) =>
        o.names.includes("json"),
      );

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const semanticCmd = cli.commands.find((c) => c.name.startsWith("semantic"));
      const quietOpt = semanticCmd?.options.find((o) =>
        o.names.includes("quiet"),
      );

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerSemanticCommand(cli);

      const semanticCmd = cli.commands.find((c) => c.name.startsWith("semantic"));

      expect(semanticCmd?.description).toContain("semantic");
    });
  });
});

/**
 * Tests for the reflect CLI command.
 * @module tests/unit/cli/commands/reflect
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerReflectCommand } from "../../../../src/cli/commands/reflect.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    reflect: vi.fn().mockResolvedValue({
      text: "reflection",
      opinions: [],
      basedOn: { world: [], experience: [], opinion: [] },
    }),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  formatOpinions: vi.fn(() => "formatted opinions"),
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
    CONNECTION_ERROR: 76,
  },
}));

describe("reflect command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the reflect command", () => {
      const cli = cac("test");
      registerReflectCommand(cli);

      const commands = cli.commands;
      const reflectCmd = commands.find((c) => c.name.startsWith("reflect"));

      expect(reflectCmd).toBeDefined();
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerReflectCommand(cli);

      const reflectCmd = cli.commands.find((c) => c.name.startsWith("reflect"));
      const projectOpt = reflectCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerReflectCommand(cli);

      const reflectCmd = cli.commands.find((c) => c.name.startsWith("reflect"));
      const jsonOpt = reflectCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerReflectCommand(cli);

      const reflectCmd = cli.commands.find((c) => c.name.startsWith("reflect"));
      const quietOpt = reflectCmd?.options.find((o) =>
        o.names.includes("quiet"),
      );

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerReflectCommand(cli);

      const reflectCmd = cli.commands.find((c) => c.name.startsWith("reflect"));

      expect(reflectCmd?.description).toContain("Reason");
    });
  });
});

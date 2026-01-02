/**
 * Tests for the init CLI command.
 * @module tests/unit/cli/commands/init
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerInitCommand } from "../../../../src/cli/commands/init.js";

// Mock fs/promises
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockRejectedValue(new Error("ENOENT")),
}));

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    getBankId: vi.fn().mockReturnValue("test-bank"),
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

describe("init command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the init command", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const commands = cli.commands;
      const initCmd = commands.find((c) => c.name === "init");

      expect(initCmd).toBeDefined();
      expect(initCmd?.name).toBe("init");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");
      const projectOpt = initCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have bank-id option", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");
      const bankIdOpt = initCmd?.options.find(
        (o) => o.names.includes("bank-id") || o.names.includes("bankId"),
      );

      expect(bankIdOpt).toBeDefined();
    });

    it("should have force option", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");
      const forceOpt = initCmd?.options.find((o) => o.names.includes("force"));

      expect(forceOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");
      const jsonOpt = initCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");
      const quietOpt = initCmd?.options.find((o) => o.names.includes("quiet"));

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerInitCommand(cli);

      const initCmd = cli.commands.find((c) => c.name === "init");

      expect(initCmd?.description).toContain("Initialize");
    });
  });
});

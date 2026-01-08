/**
 * Tests for the retain CLI command.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerRetainCommand } from "../../../../src/cli/commands/retain.js";

vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    retain: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  info: vi.fn(),
  CLIError: class CLIError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
  ExitCode: { CONFIG_ERROR: 78 },
}));

describe("retain command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the retain command", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      expect(cmd).toBeDefined();
      expect(cmd?.description).toBe("Store content in memory");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("project"));
      expect(opt).toBeDefined();
    });

    it("should have context option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("context"));
      expect(opt).toBeDefined();
    });

    it("should have type option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("type"));
      expect(opt).toBeDefined();
    });

    it("should have dry-run option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("dryRun"));
      expect(opt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("json"));
      expect(opt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerRetainCommand(cli);
      const cmd = cli.commands.find((c) => c.name.startsWith("retain"));
      const opt = cmd?.options.find((o) => o.names.includes("quiet"));
      expect(opt).toBeDefined();
    });
  });
});

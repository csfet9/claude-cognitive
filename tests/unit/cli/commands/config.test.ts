/**
 * Tests for the config CLI command.
 * @module tests/unit/cli/commands/config
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerConfigCommand } from "../../../../src/cli/commands/config.js";

// Mock config loading
vi.mock("../../../../src/config.js", () => ({
  loadConfig: vi.fn().mockResolvedValue({
    hindsight: { host: "localhost", port: 8888 },
    bankId: "test-bank",
    disposition: { skepticism: 3, literalism: 3, empathy: 3 },
    semantic: { path: ".claude/memory.md" },
  }),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  formatConfig: vi.fn(() => "formatted config"),
}));

describe("config command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the config command", () => {
      const cli = cac("test");
      registerConfigCommand(cli);

      const commands = cli.commands;
      const configCmd = commands.find((c) => c.name === "config");

      expect(configCmd).toBeDefined();
      expect(configCmd?.name).toBe("config");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerConfigCommand(cli);

      const configCmd = cli.commands.find((c) => c.name === "config");
      const projectOpt = configCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerConfigCommand(cli);

      const configCmd = cli.commands.find((c) => c.name === "config");
      const jsonOpt = configCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerConfigCommand(cli);

      const configCmd = cli.commands.find((c) => c.name === "config");
      const quietOpt = configCmd?.options.find((o) =>
        o.names.includes("quiet"),
      );

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerConfigCommand(cli);

      const configCmd = cli.commands.find((c) => c.name === "config");

      expect(configCmd?.description).toContain("configuration");
    });
  });
});

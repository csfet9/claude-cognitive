/**
 * Tests for the status CLI command.
 * @module tests/unit/cli/commands/status
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerStatusCommand } from "../../../../src/cli/commands/status.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
    getBankId: vi.fn().mockReturnValue("test-bank"),
    getSemanticPath: vi.fn().mockReturnValue(".claude/memory.md"),
    getSemanticMemory: vi.fn().mockReturnValue({ isLoaded: () => true }),
    getBank: vi.fn().mockResolvedValue({ memoryCount: 42 }),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
  output: vi.fn(),
  formatStatus: vi.fn(
    (r) => `Status: ${r.hindsight.healthy ? "healthy" : "degraded"}`,
  ),
}));

describe("status command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the status command", () => {
      const cli = cac("test");
      registerStatusCommand(cli);

      const commands = cli.commands;
      const statusCmd = commands.find((c) => c.name === "status");

      expect(statusCmd).toBeDefined();
      expect(statusCmd?.name).toBe("status");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerStatusCommand(cli);

      const statusCmd = cli.commands.find((c) => c.name === "status");
      const projectOpt = statusCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerStatusCommand(cli);

      const statusCmd = cli.commands.find((c) => c.name === "status");
      const jsonOpt = statusCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerStatusCommand(cli);

      const statusCmd = cli.commands.find((c) => c.name === "status");
      const quietOpt = statusCmd?.options.find((o) =>
        o.names.includes("quiet"),
      );

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerStatusCommand(cli);

      const statusCmd = cli.commands.find((c) => c.name === "status");

      expect(statusCmd?.description).toContain("status");
    });
  });
});

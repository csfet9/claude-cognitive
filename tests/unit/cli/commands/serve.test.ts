/**
 * Tests for the serve CLI command.
 * @module tests/unit/cli/commands/serve
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import cac from "cac";
import { registerServeCommand } from "../../../../src/cli/commands/serve.js";

// Mock the Mind class
vi.mock("../../../../src/mind.js", () => ({
  Mind: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isDegraded: false,
  })),
}));

// Mock the MCP server
vi.mock("../../../../src/mcp/index.js", () => ({
  ClaudeMindMcpServer: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock output utilities
vi.mock("../../../../src/cli/utils/index.js", () => ({
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

describe("serve command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("command registration", () => {
    it("should register the serve command", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const commands = cli.commands;
      const serveCmd = commands.find((c) => c.name === "serve");

      expect(serveCmd).toBeDefined();
      expect(serveCmd?.name).toBe("serve");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const projectOpt = serveCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have transport option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const transportOpt = serveCmd?.options.find((o) =>
        o.names.includes("transport"),
      );

      expect(transportOpt).toBeDefined();
    });

    it("should have port option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const portOpt = serveCmd?.options.find((o) => o.names.includes("port"));

      expect(portOpt).toBeDefined();
    });

    it("should have host option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const hostOpt = serveCmd?.options.find((o) => o.names.includes("host"));

      expect(hostOpt).toBeDefined();
    });

    it("should have cors option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const corsOpt = serveCmd?.options.find((o) => o.names.includes("cors"));

      expect(corsOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const jsonOpt = serveCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have quiet option", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");
      const quietOpt = serveCmd?.options.find((o) => o.names.includes("quiet"));

      expect(quietOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerServeCommand(cli);

      const serveCmd = cli.commands.find((c) => c.name === "serve");

      expect(serveCmd?.description).toContain("MCP");
    });
  });
});

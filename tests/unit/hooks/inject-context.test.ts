/**
 * Tests for the inject-context hook.
 * @module tests/unit/hooks/inject-context
 *
 * Note: Full integration testing of hooks that call process.exit
 * is done in e2e tests by spawning the CLI process.
 */

import { describe, it, expect } from "vitest";
import cac from "cac";
import { registerInjectContextCommand } from "../../../src/hooks/inject-context.js";

describe("inject-context hook", () => {
  describe("command registration", () => {
    it("should register the inject-context command", () => {
      const cli = cac("test");
      registerInjectContextCommand(cli);

      const commands = cli.commands;
      const injectCmd = commands.find((c) => c.name === "inject-context");

      expect(injectCmd).toBeDefined();
      expect(injectCmd?.name).toBe("inject-context");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerInjectContextCommand(cli);

      const injectCmd = cli.commands.find((c) => c.name === "inject-context");
      const projectOpt = injectCmd?.options.find((o) =>
        o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have timeout option", () => {
      const cli = cac("test");
      registerInjectContextCommand(cli);

      const injectCmd = cli.commands.find((c) => c.name === "inject-context");
      const timeoutOpt = injectCmd?.options.find((o) =>
        o.names.includes("timeout"),
      );

      expect(timeoutOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerInjectContextCommand(cli);

      const injectCmd = cli.commands.find((c) => c.name === "inject-context");

      expect(injectCmd?.description).toContain("session start");
    });
  });
});

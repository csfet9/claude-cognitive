/**
 * Tests for the process-session hook.
 * @module tests/unit/hooks/process-session
 *
 * Note: Full integration testing of hooks that call process.exit
 * is done in e2e tests by spawning the CLI process.
 */

import { describe, it, expect } from "vitest";
import cac from "cac";
import { registerProcessSessionCommand } from "../../../src/hooks/process-session.js";

describe("process-session hook", () => {
  describe("command registration", () => {
    it("should register the process-session command", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const commands = cli.commands;
      const processCmd = commands.find((c) => c.name === "process-session");

      expect(processCmd).toBeDefined();
      expect(processCmd?.name).toBe("process-session");
    });

    it("should have project option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const projectOpt = processCmd?.options.find(
        (o) => o.names.includes("project"),
      );

      expect(projectOpt).toBeDefined();
    });

    it("should have transcript option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const transcriptOpt = processCmd?.options.find(
        (o) => o.names.includes("transcript"),
      );

      expect(transcriptOpt).toBeDefined();
    });

    it("should have json option", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");
      const jsonOpt = processCmd?.options.find((o) => o.names.includes("json"));

      expect(jsonOpt).toBeDefined();
    });

    it("should have correct description", () => {
      const cli = cac("test");
      registerProcessSessionCommand(cli);

      const processCmd = cli.commands.find((c) => c.name === "process-session");

      expect(processCmd?.description).toContain("transcript");
    });
  });
});

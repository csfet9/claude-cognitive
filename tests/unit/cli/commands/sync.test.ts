/**
 * Tests for deprecated sync command.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cac } from "cac";
import { registerSyncCommand } from "../../../../src/cli/commands/sync.js";

describe("sync command", () => {
  describe("command registration", () => {
    let cli: ReturnType<typeof cac>;

    beforeEach(() => {
      cli = cac("test");
      vi.clearAllMocks();
    });

    it("should register the command", () => {
      registerSyncCommand(cli);
      const commands = cli.commands;
      const syncCmd = commands.find((c) => c.name === "sync");
      expect(syncCmd).toBeDefined();
    });

    it("should show deprecation notice in description", () => {
      registerSyncCommand(cli);
      const commands = cli.commands;
      const syncCmd = commands.find((c) => c.name === "sync");
      expect(syncCmd?.description).toContain("DEPRECATED");
    });
  });
});

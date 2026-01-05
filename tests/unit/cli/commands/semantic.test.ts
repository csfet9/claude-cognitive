/**
 * Tests for deprecated semantic command.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cac } from "cac";
import { registerSemanticCommand } from "../../../../src/cli/commands/semantic.js";

describe("semantic command", () => {
  describe("command registration", () => {
    let cli: ReturnType<typeof cac>;

    beforeEach(() => {
      cli = cac("test");
      vi.clearAllMocks();
    });

    it("should register the command", () => {
      registerSemanticCommand(cli);
      const commands = cli.commands;
      const semanticCmd = commands.find((c) => c.name === "semantic");
      expect(semanticCmd).toBeDefined();
    });

    it("should show deprecation notice in description", () => {
      registerSemanticCommand(cli);
      const commands = cli.commands;
      const semanticCmd = commands.find((c) => c.name === "semantic");
      expect(semanticCmd?.description).toContain("DEPRECATED");
    });
  });
});

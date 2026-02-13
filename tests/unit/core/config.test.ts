/**
 * Tests for the configuration loading module.
 * @module tests/unit/core/config
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { loadConfig, getDefaultConfig } from "../../../src/config.js";

describe("config", () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Create a unique temp directory
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-cognitive-config-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });

    // Clear relevant env vars
    delete process.env["HINDSIGHT_HOST"];
    delete process.env["HINDSIGHT_PORT"];
    delete process.env["HINDSIGHT_API_KEY"];
    delete process.env["CLAUDEMIND_BANK_ID"];
  });

  afterEach(async () => {
    // Restore environment
    process.env = { ...originalEnv };

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("getDefaultConfig()", () => {
    it("should return default configuration", () => {
      const config = getDefaultConfig();

      expect(config.hindsight.host).toBe("localhost");
      expect(config.hindsight.port).toBe(8888);
      expect(config.hindsight.timeout).toBe(10000);
      expect(config.semantic?.path).toBe(".claude/memory.md");
      expect(config.bankId).toBeUndefined();
      expect(config.disposition).toBeUndefined();
      expect(config.background).toBeUndefined();
    });

    it("should return a new object each time", () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
      expect(config1.hindsight).not.toBe(config2.hindsight);
    });
  });

  describe("loadConfig()", () => {
    describe("with no configuration files", () => {
      it("should return default configuration", async () => {
        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("localhost");
        expect(config.hindsight.port).toBe(8888);
        expect(config.semantic?.path).toBe(".claude/memory.md");
      });
    });

    describe("with .claudemindrc file", () => {
      it("should load configuration from .claudemindrc", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            hindsight: { host: "custom-host", port: 9999 },
            bankId: "my-bank",
            disposition: { skepticism: 4, literalism: 4, empathy: 2 },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("custom-host");
        expect(config.hindsight.port).toBe(9999);
        expect(config.bankId).toBe("my-bank");
        expect(config.disposition).toEqual({
          skepticism: 4,
          literalism: 4,
          empathy: 2,
        });
      });

      it("should merge with defaults for missing fields", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            bankId: "partial-bank",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("localhost"); // default
        expect(config.hindsight.port).toBe(8888); // default
        expect(config.bankId).toBe("partial-bank");
      });

      it("should handle invalid JSON gracefully", async () => {
        await writeFile(join(tempDir, ".claudemindrc"), "not valid json");

        const config = await loadConfig(tempDir);

        // Should fall back to defaults
        expect(config.hindsight.host).toBe("localhost");
      });
    });

    describe("with package.json claudemind key", () => {
      it("should load configuration from package.json", async () => {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "test-project",
            claudemind: {
              hindsight: { host: "pkg-host" },
              bankId: "pkg-bank",
            },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("pkg-host");
        expect(config.bankId).toBe("pkg-bank");
      });

      it("should ignore package.json without claudemind key", async () => {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "test-project",
            version: "1.0.0",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("localhost");
      });
    });

    describe("configuration priority", () => {
      it("should prioritize .claudemindrc over package.json", async () => {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            name: "test",
            claudemind: {
              bankId: "pkg-bank",
              hindsight: { host: "pkg-host" },
            },
          }),
        );

        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            bankId: "rc-bank",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.bankId).toBe("rc-bank"); // from .claudemindrc
        expect(config.hindsight.host).toBe("pkg-host"); // from package.json (not overwritten)
      });

      it("should prioritize overrides over files", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            bankId: "file-bank",
            hindsight: { host: "file-host" },
          }),
        );

        const config = await loadConfig(tempDir, {
          bankId: "override-bank",
        });

        expect(config.bankId).toBe("override-bank");
        expect(config.hindsight.host).toBe("file-host"); // not overridden
      });
    });

    describe("environment variables", () => {
      it("should apply HINDSIGHT_HOST", async () => {
        process.env["HINDSIGHT_HOST"] = "env-host";

        const config = await loadConfig(tempDir);

        expect(config.hindsight.host).toBe("env-host");
      });

      it("should apply HINDSIGHT_PORT", async () => {
        process.env["HINDSIGHT_PORT"] = "1234";

        const config = await loadConfig(tempDir);

        expect(config.hindsight.port).toBe(1234);
      });

      it("should apply HINDSIGHT_API_KEY", async () => {
        process.env["HINDSIGHT_API_KEY"] = "secret-key";

        const config = await loadConfig(tempDir);

        expect(config.hindsight.apiKey).toBe("secret-key");
      });

      it("should apply CLAUDEMIND_BANK_ID", async () => {
        process.env["CLAUDEMIND_BANK_ID"] = "env-bank";

        const config = await loadConfig(tempDir);

        expect(config.bankId).toBe("env-bank");
      });

      it("should ignore invalid HINDSIGHT_PORT", async () => {
        process.env["HINDSIGHT_PORT"] = "not-a-number";

        const config = await loadConfig(tempDir);

        expect(config.hindsight.port).toBe(8888); // default
      });

      it("should ignore out-of-range HINDSIGHT_PORT", async () => {
        process.env["HINDSIGHT_PORT"] = "99999";

        const config = await loadConfig(tempDir);

        expect(config.hindsight.port).toBe(8888); // default
      });

      it("should prioritize overrides over env vars", async () => {
        process.env["CLAUDEMIND_BANK_ID"] = "env-bank";

        const config = await loadConfig(tempDir, {
          bankId: "override-bank",
        });

        expect(config.bankId).toBe("override-bank");
      });

      it("should prioritize env vars over files", async () => {
        process.env["CLAUDEMIND_BANK_ID"] = "env-bank";

        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            bankId: "file-bank",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.bankId).toBe("env-bank");
      });
    });

    describe("disposition validation", () => {
      it("should accept valid disposition", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            disposition: { skepticism: 1, literalism: 5, empathy: 3 },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.disposition).toEqual({
          skepticism: 1,
          literalism: 5,
          empathy: 3,
        });
      });

      it("should reject disposition with values below 1", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            disposition: { skepticism: 0, literalism: 3, empathy: 3 },
          }),
        );

        await expect(loadConfig(tempDir)).rejects.toThrow(
          "Invalid disposition",
        );
      });

      it("should reject disposition with values above 5", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            disposition: { skepticism: 3, literalism: 6, empathy: 3 },
          }),
        );

        await expect(loadConfig(tempDir)).rejects.toThrow(
          "Invalid disposition",
        );
      });

      it("should reject disposition with non-integer values", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            disposition: { skepticism: 3.5, literalism: 3, empathy: 3 },
          }),
        );

        await expect(loadConfig(tempDir)).rejects.toThrow(
          "Invalid disposition",
        );
      });

      it("should reject disposition with missing traits", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            disposition: { skepticism: 3, literalism: 3 }, // missing empathy
          }),
        );

        await expect(loadConfig(tempDir)).rejects.toThrow(
          "Invalid disposition",
        );
      });
    });

    describe("semantic configuration", () => {
      it("should load custom semantic path", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            semantic: { path: "custom/memory.md" },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.semantic?.path).toBe("custom/memory.md");
      });

      it("should use default semantic path when not specified", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            bankId: "test",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.semantic?.path).toBe(".claude/memory.md");
      });
    });

    describe("background configuration", () => {
      it("should load background from config", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            background: "Developer assistant for React app",
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.background).toBe("Developer assistant for React app");
      });
    });

    describe("modelRouting configuration", () => {
      it("should load modelRouting from .claudemindrc", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            modelRouting: {
              defaultModel: "haiku",
              categories: {
                exploration: { model: "haiku", background: true },
              },
            },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.modelRouting).toBeDefined();
        expect(config.modelRouting?.defaultModel).toBe("haiku");
        expect(config.modelRouting?.categories?.exploration?.model).toBe(
          "haiku",
        );
      });

      it("should merge modelRouting agentOverrides from multiple sources", async () => {
        // package.json has one override
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            claudemind: {
              modelRouting: {
                agentOverrides: { "code-explorer": "sonnet" },
              },
            },
          }),
        );

        // .claudemindrc adds another override
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            modelRouting: {
              agentOverrides: { "code-reviewer": "opus" },
            },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.modelRouting?.agentOverrides?.["code-explorer"]).toBe(
          "sonnet",
        );
        expect(config.modelRouting?.agentOverrides?.["code-reviewer"]).toBe(
          "opus",
        );
      });

      it("should merge modelRouting categories from multiple sources", async () => {
        await writeFile(
          join(tempDir, "package.json"),
          JSON.stringify({
            claudemind: {
              modelRouting: {
                categories: {
                  security: { model: "opus" },
                },
              },
            },
          }),
        );

        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            modelRouting: {
              categories: {
                exploration: { model: "haiku", background: true },
              },
            },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.modelRouting?.categories?.security?.model).toBe("opus");
        expect(config.modelRouting?.categories?.exploration?.model).toBe(
          "haiku",
        );
      });

      it("should allow overrides to take priority for modelRouting", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            modelRouting: {
              defaultModel: "haiku",
            },
          }),
        );

        const config = await loadConfig(tempDir, {
          modelRouting: {
            defaultModel: "opus",
          },
        });

        expect(config.modelRouting?.defaultModel).toBe("opus");
      });

      it("should load enableTeams setting", async () => {
        await writeFile(
          join(tempDir, ".claudemindrc"),
          JSON.stringify({
            modelRouting: {
              enableTeams: true,
            },
          }),
        );

        const config = await loadConfig(tempDir);

        expect(config.modelRouting?.enableTeams).toBe(true);
      });
    });
  });
});

/**
 * Tests for the package.json analyzer.
 * @module tests/unit/learn/analyzers/package
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import {
  analyzePackage,
  getTechStackSummary,
  type PackageAnalysis,
} from "../../../../src/learn/analyzers/package.js";

describe("package analyzer", () => {
  let tempDir: string;

  beforeEach(async () => {
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-mind-pkg-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("analyzePackage()", () => {
    it("should return null when package.json doesn't exist", async () => {
      const result = await analyzePackage(tempDir);
      expect(result).toBeNull();
    });

    it("should return null for invalid JSON", async () => {
      await writeFile(join(tempDir, "package.json"), "not valid json");
      const result = await analyzePackage(tempDir);
      expect(result).toBeNull();
    });

    it("should parse minimal package.json", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-package" }),
      );

      const result = await analyzePackage(tempDir);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-package");
      expect(result?.scripts).toEqual({});
      expect(result?.dependencies).toEqual([]);
      expect(result?.devDependencies).toEqual([]);
    });

    it("should parse full package.json", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "full-package",
          version: "1.2.3",
          description: "A test package",
          main: "dist/index.js",
          type: "module",
          scripts: {
            build: "tsc",
            test: "vitest",
          },
          engines: { node: ">=18" },
          dependencies: {
            react: "^18.0.0",
            zustand: "^4.0.0",
          },
          devDependencies: {
            typescript: "^5.0.0",
            vitest: "^1.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);

      expect(result?.name).toBe("full-package");
      expect(result?.version).toBe("1.2.3");
      expect(result?.description).toBe("A test package");
      expect(result?.main).toBe("dist/index.js");
      expect(result?.type).toBe("module");
      expect(result?.engines).toEqual({ node: ">=18" });
      expect(result?.scripts).toEqual({ build: "tsc", test: "vitest" });
    });

    it("should categorize framework dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            react: "^18.0.0",
            "react-native": "^0.72.0",
            next: "^14.0.0",
            express: "^4.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const frameworks = result?.dependencies.filter(
        (d) => d.category === "framework",
      );

      expect(frameworks).toHaveLength(4);
      expect(frameworks?.map((d) => d.name)).toContain("react");
      expect(frameworks?.map((d) => d.name)).toContain("next");
    });

    it("should categorize UI dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            tailwindcss: "^3.0.0",
            "styled-components": "^6.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const ui = result?.dependencies.filter((d) => d.category === "ui");

      expect(ui).toHaveLength(2);
    });

    it("should categorize state management dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            zustand: "^4.0.0",
            "@tanstack/react-query": "^5.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const state = result?.dependencies.filter((d) => d.category === "state");

      expect(state).toHaveLength(2);
    });

    it("should categorize testing dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          devDependencies: {
            vitest: "^1.0.0",
            "@testing-library": "^14.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const testing = result?.devDependencies.filter(
        (d) => d.category === "testing",
      );

      expect(testing).toHaveLength(2);
    });

    it("should categorize build dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          devDependencies: {
            typescript: "^5.0.0",
            prettier: "^3.0.0",
            eslint: "^8.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const build = result?.devDependencies.filter(
        (d) => d.category === "build",
      );

      expect(build).toHaveLength(3);
    });

    it("should categorize database dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            "@supabase/supabase-js": "^2.0.0",
            prisma: "^5.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const db = result?.dependencies.filter((d) => d.category === "database");

      expect(db).toHaveLength(2);
    });

    it("should categorize API dependencies", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            axios: "^1.0.0",
            graphql: "^16.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const api = result?.dependencies.filter((d) => d.category === "api");

      expect(api).toHaveLength(2);
    });

    it("should use partial matching for scoped packages", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            "@react-navigation/native": "^6.0.0",
            "eslint-config-prettier": "^8.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);

      const reactNav = result?.dependencies.find(
        (d) => d.name === "@react-navigation/native",
      );
      expect(reactNav?.category).toBe("framework"); // contains "react"

      const eslintPrettier = result?.dependencies.find(
        (d) => d.name === "eslint-config-prettier",
      );
      expect(eslintPrettier?.category).toBe("build"); // contains "lint"
    });

    it("should default unknown packages to 'other'", async () => {
      await writeFile(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          dependencies: {
            "unknown-package": "^1.0.0",
          },
        }),
      );

      const result = await analyzePackage(tempDir);
      const unknown = result?.dependencies.find(
        (d) => d.name === "unknown-package",
      );

      expect(unknown?.category).toBe("other");
    });
  });

  describe("getTechStackSummary()", () => {
    it("should summarize framework, UI, state, and database", () => {
      const analysis: PackageAnalysis = {
        name: "test",
        scripts: {},
        dependencies: [
          { name: "react", version: "^18.0.0", category: "framework" },
          { name: "tailwindcss", version: "^3.0.0", category: "ui" },
          { name: "zustand", version: "^4.0.0", category: "state" },
          { name: "@supabase/supabase-js", version: "^2.0.0", category: "database" },
        ],
        devDependencies: [
          { name: "typescript", version: "^5.0.0", category: "build" },
        ],
      };

      const summary = getTechStackSummary(analysis);

      expect(summary).toContain("Framework: react");
      expect(summary).toContain("UI: tailwindcss");
      expect(summary).toContain("State: zustand");
      expect(summary).toContain("Database: @supabase/supabase-js");
      expect(summary).toContain("Language: TypeScript");
    });

    it("should return empty string for minimal package", () => {
      const analysis: PackageAnalysis = {
        name: "test",
        scripts: {},
        dependencies: [],
        devDependencies: [],
      };

      const summary = getTechStackSummary(analysis);

      expect(summary).toBe("");
    });

    it("should detect TypeScript in dependencies", () => {
      const analysis: PackageAnalysis = {
        name: "test",
        scripts: {},
        dependencies: [
          { name: "typescript", version: "^5.0.0", category: "build" },
        ],
        devDependencies: [],
      };

      const summary = getTechStackSummary(analysis);

      expect(summary).toContain("Language: TypeScript");
    });
  });
});

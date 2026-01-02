/**
 * Tests for the README analyzer.
 * @module tests/unit/learn/analyzers/readme
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { analyzeReadme } from "../../../../src/learn/analyzers/readme.js";

describe("readme analyzer", () => {
  let tempDir: string;

  beforeEach(async () => {
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-cognitive-readme-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("analyzeReadme()", () => {
    it("should return null when no README exists", async () => {
      const result = await analyzeReadme(tempDir);
      expect(result).toBeNull();
    });

    it("should find README.md", async () => {
      await writeFile(join(tempDir, "README.md"), "# Test\nDescription");
      const result = await analyzeReadme(tempDir);
      expect(result).not.toBeNull();
    });

    it("should find readme.md (lowercase)", async () => {
      await writeFile(join(tempDir, "readme.md"), "# Test\nDescription");
      const result = await analyzeReadme(tempDir);
      expect(result).not.toBeNull();
    });

    it("should extract project description", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# My Project

This is a great project that does amazing things.
It has multiple features.

## Features
- Feature 1`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.projectDescription).toContain("great project");
      expect(result?.projectDescription).toContain("amazing things");
    });

    it("should skip badges in description", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# My Project
[![Build](https://badge.svg)](https://link)
![Status](https://status.svg)

This is the actual description.`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.projectDescription).toBe("This is the actual description.");
      expect(result?.projectDescription).not.toContain("Build");
    });

    it("should extract setup instructions", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# Project

## Installation

- Clone the repo
- Run npm install
- Run npm run build

## Usage`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.setupInstructions).toContain("Clone the repo");
      // Items with "npm " get the line with marker stripped
      expect(result?.setupInstructions).toContain("- Run npm install");
    });

    it("should extract npm/yarn commands from setup", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# Project

## Setup

\`\`\`bash
npm install my-package
yarn add other-package
npx create-app
\`\`\``,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.setupInstructions.some((i) => i.includes("npm install"))).toBe(true);
    });

    it("should extract features list", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# Project

## Features

- Fast performance
- Easy to use
- Cross-platform

## License`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.features).toContain("Fast performance");
      expect(result?.features).toContain("Easy to use");
      expect(result?.features).toContain("Cross-platform");
    });

    it("should extract documentation links", async () => {
      await writeFile(
        join(tempDir, "README.md"),
        `# Project

See [API Documentation](./docs/api.md) for details.
Check the [Wiki](https://wiki.example.com) for guides.
Visit [Homepage](https://example.com) for more.`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.documentation.some((d) => d.includes("API Documentation"))).toBe(true);
      expect(result?.documentation.some((d) => d.includes("Wiki"))).toBe(true);
    });

    it("should include raw content", async () => {
      const content = "# Project\n\nThis is raw content.";
      await writeFile(join(tempDir, "README.md"), content);

      const result = await analyzeReadme(tempDir);
      expect(result?.rawContent).toBe(content);
    });

    it("should limit instructions to 10", async () => {
      const instructions = Array.from(
        { length: 15 },
        (_, i) => `- Step ${i + 1}`,
      ).join("\n");

      await writeFile(
        join(tempDir, "README.md"),
        `# Project\n\n## Installation\n\n${instructions}`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.setupInstructions.length).toBeLessThanOrEqual(10);
    });

    it("should limit features to 15", async () => {
      const features = Array.from(
        { length: 20 },
        (_, i) => `- Feature ${i + 1}`,
      ).join("\n");

      await writeFile(
        join(tempDir, "README.md"),
        `# Project\n\n## Features\n\n${features}`,
      );

      const result = await analyzeReadme(tempDir);
      expect(result?.features.length).toBeLessThanOrEqual(15);
    });
  });
});

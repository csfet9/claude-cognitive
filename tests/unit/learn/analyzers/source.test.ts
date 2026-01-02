/**
 * Tests for the source code analyzer.
 * @module tests/unit/learn/analyzers/source
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { analyzeSource, getSourceSummary } from "../../../../src/learn/analyzers/source.js";

describe("source analyzer", () => {
  let tempDir: string;

  beforeEach(async () => {
    const suffix = randomBytes(8).toString("hex");
    tempDir = join(tmpdir(), `claude-cognitive-source-test-${suffix}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("analyzeSource()", () => {
    it("should analyze TypeScript files", async () => {
      await writeFile(
        join(tempDir, "module.ts"),
        `export const myFunction = () => {};
export class MyClass {}
import { something } from 'somewhere';`,
      );

      const result = await analyzeSource(tempDir, ["module.ts"]);

      expect(result.filesAnalyzed).toBe(1);
      expect(result.modules.length).toBe(1);
      expect(result.modules[0]?.exports).toContain("myFunction");
      expect(result.modules[0]?.exports).toContain("MyClass");
    });

    it("should analyze JavaScript files", async () => {
      await writeFile(
        join(tempDir, "script.js"),
        `export function doSomething() {}
export const value = 42;`,
      );

      const result = await analyzeSource(tempDir, ["script.js"]);

      expect(result.filesAnalyzed).toBe(1);
      expect(result.modules[0]?.exports).toContain("doSomething");
      expect(result.modules[0]?.exports).toContain("value");
    });

    it("should skip non-JS/TS files", async () => {
      await writeFile(join(tempDir, "readme.md"), "# Readme");
      await writeFile(join(tempDir, "style.css"), ".class {}");

      const result = await analyzeSource(tempDir, ["readme.md", "style.css"]);

      expect(result.filesAnalyzed).toBe(0);
    });

    it("should extract imports", async () => {
      await writeFile(
        join(tempDir, "importer.ts"),
        `import { a, b } from './module';
import c from 'package';
import * as d from 'another';`,
      );

      const result = await analyzeSource(tempDir, ["importer.ts"]);

      expect(result.modules[0]?.imports).toContain("./module");
      expect(result.modules[0]?.imports).toContain("package");
      expect(result.modules[0]?.imports).toContain("another");
    });

    it("should extract named exports with re-exports", async () => {
      await writeFile(
        join(tempDir, "reexporter.ts"),
        `export { foo, bar as baz };`,
      );

      const result = await analyzeSource(tempDir, ["reexporter.ts"]);

      expect(result.modules[0]?.exports).toContain("foo");
      expect(result.modules[0]?.exports).toContain("bar");
    });

    it("should detect camelCase naming convention", async () => {
      await writeFile(
        join(tempDir, "camel.ts"),
        `const firstName = 'John';
const lastName = 'Doe';
const fullName = firstName + lastName;
function getUserName() {}
function getEmailAddress() {}`,
      );

      const result = await analyzeSource(tempDir, ["camel.ts"]);

      expect(result.conventions.namingStyle).toBe("camelCase");
    });

    it("should detect named import style", async () => {
      await writeFile(
        join(tempDir, "named.ts"),
        `import { a } from 'a';
import { b, c } from 'b';
import { d } from 'd';
import { e, f, g } from 'e';`,
      );

      const result = await analyzeSource(tempDir, ["named.ts"]);

      expect(result.conventions.importStyle).toBe("named");
    });

    it("should detect try-catch error handling", async () => {
      await writeFile(
        join(tempDir, "errors.ts"),
        `try { doSomething(); } catch (e) { console.error(e); }
try { doAnother(); } catch (e) { throw e; }
try { doThird(); } catch (e) { handle(e); }`,
      );

      const result = await analyzeSource(tempDir, ["errors.ts"]);

      expect(result.conventions.errorHandling).toBe("try-catch blocks");
    });

    it("should detect promise .catch() error handling", async () => {
      await writeFile(
        join(tempDir, "promise-errors.ts"),
        `fetch(url).catch(e => console.error(e));
doSomething().catch(handleError);
another().catch(e => {});
more().catch(err => log(err));
extra().catch(error => process(error));`,
      );

      const result = await analyzeSource(tempDir, ["promise-errors.ts"]);

      expect(result.conventions.errorHandling).toBe("promise .catch()");
    });

    it("should detect async/await preference", async () => {
      await writeFile(
        join(tempDir, "async.ts"),
        `async function fetchData() {
  const data = await fetch(url);
  return await data.json();
}
async function processData() {
  await prepare();
  await execute();
}`,
      );

      const result = await analyzeSource(tempDir, ["async.ts"]);

      expect(result.conventions.prefersAsync).toBe(true);
    });

    it("should detect barrel exports pattern", async () => {
      // Create multiple files
      await mkdir(join(tempDir, "src"), { recursive: true });
      await writeFile(
        join(tempDir, "src/index.ts"),
        `export { a } from './a';
export { b } from './b';
export { c } from './c';
export { d } from './d';`,
      );
      await writeFile(join(tempDir, "src/a.ts"), "export const a = 1;");
      await writeFile(join(tempDir, "src/b.ts"), "export const b = 2;");
      await writeFile(join(tempDir, "src/c.ts"), "export const c = 3;");
      await writeFile(join(tempDir, "src/d.ts"), "export const d = 4;");

      const result = await analyzeSource(tempDir, [
        "src/index.ts",
        "src/a.ts",
        "src/b.ts",
        "src/c.ts",
        "src/d.ts",
      ]);

      const barrelPattern = result.patterns.find(
        (p) => p.type === "barrel-exports",
      );
      expect(barrelPattern).toBeDefined();
      expect(barrelPattern?.description).toContain("barrel exports");
    });

    it("should handle files that cannot be read", async () => {
      const result = await analyzeSource(tempDir, ["nonexistent.ts"]);

      expect(result.filesAnalyzed).toBe(0);
    });

    it("should analyze multiple file types", async () => {
      await writeFile(join(tempDir, "a.ts"), "export const a = 1;");
      await writeFile(join(tempDir, "b.tsx"), "export const b = 2;");
      await writeFile(join(tempDir, "c.js"), "export const c = 3;");
      await writeFile(join(tempDir, "d.jsx"), "export const d = 4;");
      await writeFile(join(tempDir, "e.mjs"), "export const e = 5;");
      await writeFile(join(tempDir, "f.mts"), "export const f = 6;");

      const result = await analyzeSource(tempDir, [
        "a.ts",
        "b.tsx",
        "c.js",
        "d.jsx",
        "e.mjs",
        "f.mts",
      ]);

      expect(result.filesAnalyzed).toBe(6);
    });
  });

  describe("getSourceSummary()", () => {
    it("should format basic summary", () => {
      const analysis = {
        patterns: [],
        modules: [
          { name: "a", path: "a.ts", exports: [], imports: [] },
          { name: "b", path: "b.ts", exports: [], imports: [] },
        ],
        conventions: {
          namingStyle: "camelCase" as const,
          importStyle: "named" as const,
          errorHandling: "try-catch blocks",
          prefersAsync: true,
        },
        filesAnalyzed: 2,
      };

      const summary = getSourceSummary(analysis);

      expect(summary).toContain("2 files analyzed");
      expect(summary).toContain("2 modules");
      expect(summary).toContain("camelCase");
    });

    it("should include patterns in summary", () => {
      const analysis = {
        patterns: [
          {
            type: "barrel-exports",
            description: "Uses barrel exports",
            examples: ["index.ts"],
          },
          {
            type: "modular-architecture",
            description: "Modular",
            examples: ["a.ts"],
          },
        ],
        modules: [],
        conventions: {
          namingStyle: "camelCase" as const,
          importStyle: "named" as const,
          errorHandling: "mixed",
          prefersAsync: true,
        },
        filesAnalyzed: 10,
      };

      const summary = getSourceSummary(analysis);

      expect(summary).toContain("barrel-exports");
      expect(summary).toContain("modular-architecture");
    });

    it("should handle empty analysis", () => {
      const analysis = {
        patterns: [],
        modules: [],
        conventions: {
          namingStyle: "mixed" as const,
          importStyle: "mixed" as const,
          errorHandling: "mixed",
          prefersAsync: false,
        },
        filesAnalyzed: 0,
      };

      const summary = getSourceSummary(analysis);

      expect(summary).toContain("0 files analyzed");
      expect(summary).toContain("0 modules");
    });
  });
});

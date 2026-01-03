/**
 * Tests for the fact extractor.
 * @module tests/unit/learn/extractor
 */

import { describe, it, expect } from "vitest";
import {
  DefaultFactExtractor,
  createFactExtractor,
} from "../../../src/learn/extractor.js";

describe("fact extractor", () => {
  describe("DefaultFactExtractor", () => {
    describe("extractFacts()", () => {
      it("should return empty array for empty analysis", () => {
        const extractor = new DefaultFactExtractor();
        const facts = extractor.extractFacts({});

        expect(facts).toEqual([]);
      });

      describe("README extraction", () => {
        it("should extract project description", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            readme: {
              projectDescription: "A powerful tool for developers",
              features: [],
              setupInstructions: [],
              documentation: [],
              rawContent: "",
            },
          });

          expect(facts.some((f) => f.content.includes("powerful tool"))).toBe(
            true,
          );
        });

        it("should extract features", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            readme: {
              projectDescription: "",
              features: ["Fast performance", "Easy to use", "Cross-platform"],
              setupInstructions: [],
              documentation: [],
              rawContent: "",
            },
          });

          const featureFact = facts.find((f) => f.content.includes("features"));
          expect(featureFact).toBeDefined();
          expect(featureFact?.content).toContain("Fast performance");
        });

        it("should extract setup instructions", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            readme: {
              projectDescription: "",
              features: [],
              setupInstructions: ["npm install", "npm run build"],
              documentation: [],
              rawContent: "",
            },
          });

          const setupFact = facts.find((f) => f.content.includes("Setup"));
          expect(setupFact).toBeDefined();
          expect(setupFact?.content).toContain("npm install");
        });
      });

      describe("package.json extraction", () => {
        it("should extract package description", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "my-package",
              version: "1.0.0",
              description: "A great package",
              dependencies: [],
              devDependencies: [],
              scripts: {},
              engines: {},
            },
          });

          expect(facts.some((f) => f.content.includes("A great package"))).toBe(
            true,
          );
        });

        it("should extract framework dependencies", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [
                { name: "react", version: "18.0.0", category: "framework" },
              ],
              devDependencies: [],
              scripts: {},
              engines: {},
            },
          });

          const frameworkFact = facts.find((f) =>
            f.content.includes("Framework"),
          );
          expect(frameworkFact).toBeDefined();
          expect(frameworkFact?.content).toContain("react");
        });

        it("should extract UI libraries", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [
                { name: "@mantine/core", version: "6.0.0", category: "ui" },
              ],
              devDependencies: [],
              scripts: {},
              engines: {},
            },
          });

          const uiFact = facts.find((f) => f.content.includes("UI libraries"));
          expect(uiFact).toBeDefined();
        });

        it("should extract state management", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [
                { name: "zustand", version: "4.0.0", category: "state" },
              ],
              devDependencies: [],
              scripts: {},
              engines: {},
            },
          });

          const stateFact = facts.find((f) =>
            f.content.includes("State management"),
          );
          expect(stateFact).toBeDefined();
          expect(stateFact?.content).toContain("zustand");
        });

        it("should extract database dependencies", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [
                { name: "prisma", version: "5.0.0", category: "database" },
              ],
              devDependencies: [],
              scripts: {},
              engines: {},
            },
          });

          const dbFact = facts.find((f) => f.content.includes("Database/ORM"));
          expect(dbFact).toBeDefined();
        });

        it("should extract build tools", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [],
              devDependencies: [
                { name: "vite", version: "5.0.0", category: "build" },
              ],
              scripts: {},
              engines: {},
            },
          });

          const buildFact = facts.find((f) =>
            f.content.includes("Build tools"),
          );
          expect(buildFact).toBeDefined();
          expect(buildFact?.content).toContain("vite");
        });

        it("should extract testing tools", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [],
              devDependencies: [
                { name: "vitest", version: "1.0.0", category: "testing" },
              ],
              scripts: {},
              engines: {},
            },
          });

          const testFact = facts.find((f) =>
            f.content.includes("Testing tools"),
          );
          expect(testFact).toBeDefined();
        });

        it("should extract npm scripts", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [],
              devDependencies: [],
              scripts: { test: "vitest", build: "tsc", dev: "vite" },
              engines: {},
            },
          });

          const scriptFact = facts.find((f) =>
            f.content.includes("NPM scripts"),
          );
          expect(scriptFact).toBeDefined();
          expect(scriptFact?.content).toContain("vitest");
        });

        it("should detect TypeScript", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            package: {
              name: "app",
              version: "1.0.0",
              description: "",
              dependencies: [],
              devDependencies: [
                { name: "typescript", version: "5.0.0", category: "build" },
              ],
              scripts: {},
              engines: {},
            },
          });

          const tsFact = facts.find((f) => f.content.includes("TypeScript"));
          expect(tsFact).toBeDefined();
        });
      });

      describe("structure extraction", () => {
        it("should extract source directories", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            structure: {
              sourceDirectories: ["src", "lib"],
              testDirectories: ["tests"],
              entryPoints: [],
              configFiles: [],
              fileTypes: {},
              totalFiles: 50,
            },
          });

          const structFact = facts.find((f) =>
            f.content.includes("Project structure"),
          );
          expect(structFact).toBeDefined();
          expect(structFact?.content).toContain("source in src, lib");
        });

        it("should extract entry points", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            structure: {
              sourceDirectories: [],
              testDirectories: [],
              entryPoints: ["src/index.ts", "src/main.ts"],
              configFiles: [],
              fileTypes: {},
              totalFiles: 10,
            },
          });

          const entryFact = facts.find((f) =>
            f.content.includes("Entry points"),
          );
          expect(entryFact).toBeDefined();
          expect(entryFact?.content).toContain("src/index.ts");
        });

        it("should extract config files", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            structure: {
              sourceDirectories: [],
              testDirectories: [],
              entryPoints: [],
              configFiles: ["tsconfig.json", "package.json"],
              fileTypes: {},
              totalFiles: 5,
            },
          });

          const configFact = facts.find((f) =>
            f.content.includes("Configuration files"),
          );
          expect(configFact).toBeDefined();
        });

        it("should extract file type distribution", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            structure: {
              sourceDirectories: [],
              testDirectories: [],
              entryPoints: [],
              configFiles: [],
              fileTypes: { ".ts": 50, ".json": 10, ".md": 5 },
              totalFiles: 65,
            },
          });

          const typeFact = facts.find((f) => f.content.includes("File types"));
          expect(typeFact).toBeDefined();
          expect(typeFact?.content).toContain(".ts(50)");
        });
      });

      describe("git extraction", () => {
        it("should extract contributors", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            git: {
              totalCommits: 100,
              contributors: ["Alice", "Bob", "Charlie"],
              significantCommits: [],
              hotspots: [],
              commitPatterns: { avgCommitsPerDay: 2 },
            },
          });

          const teamFact = facts.find((f) => f.content.includes("Team"));
          expect(teamFact).toBeDefined();
          expect(teamFact?.content).toContain("3 contributors");
        });

        it("should extract commit convention", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            git: {
              totalCommits: 100,
              contributors: [],
              significantCommits: [],
              hotspots: [],
              commitPatterns: {
                avgCommitsPerDay: 2,
                messageConvention: "Conventional Commits",
              },
            },
          });

          const convFact = facts.find((f) =>
            f.content.includes("Commit convention"),
          );
          expect(convFact).toBeDefined();
          expect(convFact?.content).toContain("Conventional Commits");
        });

        it("should extract significant commits", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            git: {
              totalCommits: 100,
              contributors: [],
              significantCommits: [
                {
                  hash: "abc123",
                  message: "Major refactor",
                  date: "2024-01-01",
                },
              ],
              hotspots: [],
              commitPatterns: { avgCommitsPerDay: 2 },
            },
          });

          const historyFact = facts.find((f) =>
            f.content.includes("Historical decision"),
          );
          expect(historyFact).toBeDefined();
          expect(historyFact?.content).toContain("Major refactor");
        });

        it("should extract file hotspots", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            git: {
              totalCommits: 100,
              contributors: [],
              significantCommits: [],
              hotspots: [
                { file: "src/index.ts", changeCount: 50 },
                { file: "src/utils.ts", changeCount: 30 },
              ],
              commitPatterns: { avgCommitsPerDay: 2 },
            },
          });

          const hotspotFact = facts.find((f) =>
            f.content.includes("Most active files"),
          );
          expect(hotspotFact).toBeDefined();
          expect(hotspotFact?.content).toContain("src/index.ts");
        });
      });

      describe("source extraction", () => {
        it("should extract naming convention", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            source: {
              patterns: [],
              modules: [],
              conventions: {
                namingStyle: "camelCase",
                importStyle: "named",
                errorHandling: "try-catch blocks",
                prefersAsync: true,
              },
              filesAnalyzed: 10,
            },
          });

          const namingFact = facts.find((f) =>
            f.content.includes("Naming convention"),
          );
          expect(namingFact).toBeDefined();
          expect(namingFact?.content).toContain("camelCase");
        });

        it("should extract import style", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            source: {
              patterns: [],
              modules: [],
              conventions: {
                namingStyle: "camelCase",
                importStyle: "named",
                errorHandling: "mixed",
                prefersAsync: false,
              },
              filesAnalyzed: 10,
            },
          });

          const importFact = facts.find((f) =>
            f.content.includes("Import style"),
          );
          expect(importFact).toBeDefined();
          expect(importFact?.content).toContain("named");
        });

        it("should extract error handling style", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            source: {
              patterns: [],
              modules: [],
              conventions: {
                namingStyle: "camelCase",
                importStyle: "named",
                errorHandling: "promise .catch()",
                prefersAsync: false,
              },
              filesAnalyzed: 10,
            },
          });

          const errorFact = facts.find((f) =>
            f.content.includes("Error handling"),
          );
          expect(errorFact).toBeDefined();
          expect(errorFact?.content).toContain("promise .catch()");
        });

        it("should extract async preference", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            source: {
              patterns: [],
              modules: [],
              conventions: {
                namingStyle: "camelCase",
                importStyle: "named",
                errorHandling: "mixed",
                prefersAsync: true,
              },
              filesAnalyzed: 10,
            },
          });

          const asyncFact = facts.find((f) =>
            f.content.includes("Async/await is preferred"),
          );
          expect(asyncFact).toBeDefined();
        });

        it("should extract code patterns", () => {
          const extractor = new DefaultFactExtractor();
          const facts = extractor.extractFacts({
            source: {
              patterns: [
                {
                  type: "barrel-exports",
                  description: "Uses barrel exports",
                  examples: ["src/index.ts"],
                },
              ],
              modules: [],
              conventions: {
                namingStyle: "camelCase",
                importStyle: "named",
                errorHandling: "mixed",
                prefersAsync: false,
              },
              filesAnalyzed: 10,
            },
          });

          const patternFact = facts.find((f) =>
            f.content.includes("Code pattern"),
          );
          expect(patternFact).toBeDefined();
          expect(patternFact?.content).toContain("barrel exports");
        });
      });

      it("should extract from all sources combined", () => {
        const extractor = new DefaultFactExtractor();
        const facts = extractor.extractFacts({
          readme: {
            projectDescription: "Test project",
            features: ["Feature 1"],
            setupInstructions: ["npm install"],
            documentation: [],
            rawContent: "",
          },
          package: {
            name: "test",
            version: "1.0.0",
            description: "Test package",
            dependencies: [
              { name: "react", version: "18.0.0", category: "framework" },
            ],
            devDependencies: [],
            scripts: { test: "vitest" },
            engines: {},
          },
          structure: {
            sourceDirectories: ["src"],
            testDirectories: ["tests"],
            entryPoints: ["src/index.ts"],
            configFiles: ["tsconfig.json"],
            fileTypes: { ".ts": 20 },
            totalFiles: 20,
          },
          git: {
            totalCommits: 50,
            contributors: ["Dev"],
            significantCommits: [],
            hotspots: [],
            commitPatterns: { avgCommitsPerDay: 1 },
          },
          source: {
            patterns: [],
            modules: [],
            conventions: {
              namingStyle: "camelCase",
              importStyle: "named",
              errorHandling: "try-catch blocks",
              prefersAsync: true,
            },
            filesAnalyzed: 10,
          },
        });

        // Should have facts from all sources
        expect(facts.length).toBeGreaterThan(5);
        expect(facts.some((f) => f.category === "decisions")).toBe(true);
        expect(facts.some((f) => f.category === "stack")).toBe(true);
        expect(facts.some((f) => f.category === "structure")).toBe(true);
        expect(facts.some((f) => f.category === "patterns")).toBe(true);
      });
    });
  });

  describe("createFactExtractor()", () => {
    it("should create a DefaultFactExtractor instance", () => {
      const extractor = createFactExtractor();

      expect(extractor).toBeInstanceOf(DefaultFactExtractor);
    });

    it("should create working extractor", () => {
      const extractor = createFactExtractor();
      const facts = extractor.extractFacts({
        readme: {
          projectDescription: "Test",
          features: [],
          setupInstructions: [],
          documentation: [],
          rawContent: "",
        },
      });

      expect(facts.length).toBeGreaterThan(0);
    });
  });
});

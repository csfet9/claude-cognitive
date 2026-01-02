/**
 * Test fixture utilities.
 * @module tests/helpers/fixtures
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

/**
 * Create a temporary directory for testing.
 * Returns the path and a cleanup function.
 */
export async function createTempDir(): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> {
  const suffix = randomBytes(8).toString("hex");
  const path = join(tmpdir(), `claude-mind-test-${suffix}`);
  await mkdir(path, { recursive: true });

  return {
    path,
    cleanup: async () => {
      await rm(path, { recursive: true, force: true });
    },
  };
}

/**
 * Create a mock project directory with common files.
 */
export async function createMockProject(basePath: string): Promise<void> {
  // Create .claudemindrc
  await writeFile(
    join(basePath, ".claudemindrc"),
    JSON.stringify(
      {
        hindsight: { host: "localhost", port: 8888 },
        bankId: "test-project",
        disposition: { skepticism: 3, literalism: 3, empathy: 3 },
        semantic: { path: ".claude/memory.md" },
      },
      null,
      2,
    ),
  );

  // Create .claude directory
  await mkdir(join(basePath, ".claude"), { recursive: true });

  // Create semantic memory file
  await writeFile(
    join(basePath, ".claude", "memory.md"),
    `# Project Memory

## Tech Stack
- Node.js
- TypeScript

## Key Decisions
- Using Hindsight for memory

## Observations
<!-- Promoted from Hindsight -->
`,
  );

  // Create package.json
  await writeFile(
    join(basePath, "package.json"),
    JSON.stringify(
      {
        name: "test-project",
        version: "1.0.0",
        description: "A test project",
        scripts: {
          build: "tsc",
          test: "vitest",
        },
        dependencies: {
          typescript: "^5.0.0",
        },
      },
      null,
      2,
    ),
  );

  // Create README
  await writeFile(
    join(basePath, "README.md"),
    `# Test Project

A test project for unit testing.

## Features
- Feature 1
- Feature 2

## Setup
npm install
`,
  );

  // Create src directory with sample file
  await mkdir(join(basePath, "src"), { recursive: true });
  await writeFile(
    join(basePath, "src", "index.ts"),
    `export function hello(): string {
  return "Hello, World!";
}
`,
  );
}

/**
 * Create a sample transcript for testing.
 */
export function createSampleTranscript(): string {
  return JSON.stringify({
    messages: [
      { role: "user", content: "Help me fix a bug in the auth flow" },
      {
        role: "assistant",
        content:
          "I found the issue in AuthProvider.tsx - the redirect was happening before state update.",
      },
      { role: "user", content: "Great, that fixed it!" },
    ],
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a custom agent markdown file.
 */
export async function createCustomAgent(
  basePath: string,
  name: string,
): Promise<void> {
  const agentsDir = join(basePath, ".claude", "agents");
  await mkdir(agentsDir, { recursive: true });

  await writeFile(
    join(agentsDir, `${name}.md`),
    `# Agent: ${name}

## Mission
Custom agent for testing.

## Tools Available
- Read
- Grep

## Output Format
Return findings as a list.

## Constraints
- Read-only
- Focus on assigned task
`,
  );
}

/**
 * Sample memory responses for mocking.
 */
export const sampleMemories = {
  world: {
    id: "mem-world-1",
    text: "The project uses TypeScript with strict mode enabled",
    factType: "world" as const,
    createdAt: "2024-01-01T00:00:00Z",
    what: "TypeScript configuration",
    where: "tsconfig.json",
  },
  experience: {
    id: "mem-exp-1",
    text: "I fixed the auth redirect by moving Provider to root",
    factType: "experience" as const,
    createdAt: "2024-01-02T00:00:00Z",
    what: "Auth fix",
    where: "src/providers/AuthProvider.tsx",
  },
  opinion: {
    id: "mem-opinion-1",
    text: "This codebase prefers explicit error handling",
    factType: "opinion" as const,
    createdAt: "2024-01-03T00:00:00Z",
    confidence: 0.85,
  },
};

/**
 * Sample reflection result for mocking.
 */
export const sampleReflection = {
  text: "Based on my experience, auth changes often require navigation updates.",
  opinions: [
    { opinion: "Auth changes require navigation updates", confidence: 0.9 },
    { opinion: "Provider ordering matters for context", confidence: 0.85 },
  ],
  basedOn: {
    world: [sampleMemories.world],
    experience: [sampleMemories.experience],
    opinion: [sampleMemories.opinion],
  },
};

/**
 * Package.json analyzer.
 * @module learn/analyzers/package
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Categorized dependency information.
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Version string */
  version: string;
  /** Inferred category */
  category: DependencyCategory;
}

/**
 * Categories for dependencies.
 */
export type DependencyCategory =
  | "framework"
  | "ui"
  | "state"
  | "testing"
  | "build"
  | "utility"
  | "database"
  | "api"
  | "other";

/**
 * Analysis result from package.json.
 */
export interface PackageAnalysis {
  /** Package name */
  name: string;
  /** Package description */
  description?: string;
  /** Package version */
  version?: string;
  /** Available scripts */
  scripts: Record<string, string>;
  /** Production dependencies */
  dependencies: DependencyInfo[];
  /** Development dependencies */
  devDependencies: DependencyInfo[];
  /** Node engine requirements */
  engines?: Record<string, string>;
  /** Main entry point */
  main?: string;
  /** Module type */
  type?: string;
}

/** Known framework packages */
const FRAMEWORKS = new Set([
  "react",
  "vue",
  "angular",
  "svelte",
  "next",
  "nuxt",
  "express",
  "fastify",
  "koa",
  "nest",
  "expo",
  "react-native",
]);

/** Known UI packages */
const UI_PACKAGES = new Set([
  "tailwindcss",
  "styled-components",
  "emotion",
  "@mui/material",
  "antd",
  "chakra-ui",
  "nativewind",
  "bootstrap",
]);

/** Known state management */
const STATE_PACKAGES = new Set([
  "redux",
  "zustand",
  "mobx",
  "recoil",
  "jotai",
  "valtio",
  "@tanstack/react-query",
  "swr",
]);

/** Known testing packages */
const TESTING_PACKAGES = new Set([
  "jest",
  "vitest",
  "mocha",
  "chai",
  "cypress",
  "playwright",
  "@testing-library",
]);

/** Known build tools */
const BUILD_PACKAGES = new Set([
  "typescript",
  "webpack",
  "vite",
  "esbuild",
  "rollup",
  "parcel",
  "babel",
  "prettier",
  "eslint",
]);

/** Known database/ORM packages */
const DATABASE_PACKAGES = new Set([
  "prisma",
  "drizzle-orm",
  "typeorm",
  "sequelize",
  "mongoose",
  "pg",
  "mysql",
  "sqlite",
  "@supabase/supabase-js",
]);

/** Known API packages */
const API_PACKAGES = new Set([
  "axios",
  "node-fetch",
  "graphql",
  "apollo",
  "trpc",
  "openapi",
  "swagger",
]);

/**
 * Analyze package.json in a project.
 *
 * @param projectPath - Project root directory
 * @returns Package analysis, or null if no package.json found
 */
export async function analyzePackage(
  projectPath: string,
): Promise<PackageAnalysis | null> {
  try {
    const content = await readFile(join(projectPath, "package.json"), "utf-8");
    const pkg = JSON.parse(content) as Record<string, unknown>;

    // Build result with required fields
    const result: PackageAnalysis = {
      name: getString(pkg, "name") ?? "unknown",
      scripts: getScripts(pkg),
      dependencies: parseDependencies(getRecord(pkg, "dependencies")),
      devDependencies: parseDependencies(getRecord(pkg, "devDependencies")),
    };

    // Add optional fields only if they have values
    const description = getString(pkg, "description");
    if (description) result.description = description;

    const version = getString(pkg, "version");
    if (version) result.version = version;

    const engines = getRecord(pkg, "engines") as
      | Record<string, string>
      | undefined;
    if (engines) result.engines = engines;

    const main = getString(pkg, "main");
    if (main) result.main = main;

    const type = getString(pkg, "type");
    if (type) result.type = type;

    return result;
  } catch {
    return null;
  }
}

/**
 * Get string value from object.
 * @internal
 */
function getString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Get record value from object.
 * @internal
 */
function getRecord(
  obj: Record<string, unknown>,
  key: string,
): Record<string, string> | undefined {
  const value = obj[key];
  return typeof value === "object" && value !== null
    ? (value as Record<string, string>)
    : undefined;
}

/**
 * Get scripts object.
 * @internal
 */
function getScripts(pkg: Record<string, unknown>): Record<string, string> {
  const scripts = pkg["scripts"];
  if (typeof scripts !== "object" || scripts === null) {
    return {};
  }
  return scripts as Record<string, string>;
}

/**
 * Parse dependencies into categorized format.
 * @internal
 */
function parseDependencies(
  deps: Record<string, string> | undefined,
): DependencyInfo[] {
  if (!deps) return [];

  return Object.entries(deps).map(([name, version]) => ({
    name,
    version,
    category: categorizeDependency(name),
  }));
}

/**
 * Categorize a dependency by its name.
 * @internal
 */
function categorizeDependency(name: string): DependencyCategory {
  // Check exact matches first
  if (FRAMEWORKS.has(name)) return "framework";
  if (UI_PACKAGES.has(name)) return "ui";
  if (STATE_PACKAGES.has(name)) return "state";
  if (TESTING_PACKAGES.has(name)) return "testing";
  if (BUILD_PACKAGES.has(name)) return "build";
  if (DATABASE_PACKAGES.has(name)) return "database";
  if (API_PACKAGES.has(name)) return "api";

  // Check partial matches for scoped packages
  if (
    name.includes("react") ||
    name.includes("vue") ||
    name.includes("angular")
  ) {
    return "framework";
  }
  if (name.includes("test") || name.includes("spec")) {
    return "testing";
  }
  if (name.includes("lint") || name.includes("format")) {
    return "build";
  }

  return "other";
}

/**
 * Get a summary of the tech stack from package analysis.
 *
 * @param analysis - Package analysis result
 * @returns Human-readable tech stack summary
 */
export function getTechStackSummary(analysis: PackageAnalysis): string {
  const parts: string[] = [];

  // Find frameworks
  const frameworks = analysis.dependencies
    .filter((d) => d.category === "framework")
    .map((d) => d.name);
  if (frameworks.length > 0) {
    parts.push(`Framework: ${frameworks.join(", ")}`);
  }

  // Find UI libraries
  const ui = analysis.dependencies
    .filter((d) => d.category === "ui")
    .map((d) => d.name);
  if (ui.length > 0) {
    parts.push(`UI: ${ui.join(", ")}`);
  }

  // Find state management
  const state = analysis.dependencies
    .filter((d) => d.category === "state")
    .map((d) => d.name);
  if (state.length > 0) {
    parts.push(`State: ${state.join(", ")}`);
  }

  // Find database/ORM
  const db = analysis.dependencies
    .filter((d) => d.category === "database")
    .map((d) => d.name);
  if (db.length > 0) {
    parts.push(`Database: ${db.join(", ")}`);
  }

  // Check for TypeScript
  const hasTypeScript =
    analysis.devDependencies.some((d) => d.name === "typescript") ||
    analysis.dependencies.some((d) => d.name === "typescript");
  if (hasTypeScript) {
    parts.push("Language: TypeScript");
  }

  return parts.join("; ");
}

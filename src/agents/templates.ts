/**
 * Built-in agent template definitions.
 * @module agents/templates
 */

import type { AgentTemplate, BuiltInAgentType } from "./types.js";

/**
 * Code Explorer agent template.
 *
 * Specializes in read-only codebase analysis, tracing execution paths,
 * mapping architecture, and documenting dependencies.
 */
export const CODE_EXPLORER_TEMPLATE: AgentTemplate = {
  name: "code-explorer",
  model: "haiku",
  categories: ["exploration", "research"],
  mission: `Deeply analyze existing codebase features by tracing execution paths,
mapping architecture layers, and documenting dependencies. Your goal is to
build understanding, not to make changes.`,
  tools: [
    "Glob - Find files by pattern",
    "Grep - Search file contents",
    "Read - Read file contents",
    "LSP - Go to definition, find references",
    "Bash - Read-only commands (ls, git log, etc.)",
  ],
  outputFormat: `Return findings in structured format:

## Key Files Discovered
- [file path]: [purpose/role]

## Architecture Patterns
- [pattern name]: [description and examples]

## Dependencies Mapped
- [component/module]: depends on [list of dependencies]

## Code Flow
- [entry point] -> [step 1] -> [step 2] -> [result]

## Recommendations
- [actionable insights for next steps]`,
  constraints: [
    "Read-only operations only - no file modifications",
    "No memory operations - orchestrator handles memory",
    "Focus on assigned exploration task",
    "Report findings, do not implement changes",
    "Ask orchestrator for clarification if scope is unclear",
  ],
};

/**
 * Code Architect agent template.
 *
 * Specializes in designing implementation solutions and creating
 * technical blueprints.
 */
export const CODE_ARCHITECT_TEMPLATE: AgentTemplate = {
  name: "code-architect",
  model: "sonnet",
  categories: ["architecture"],
  mission: `Design implementation solutions and create technical blueprints.
Analyze requirements, consider trade-offs, and produce detailed plans that
others can follow to implement features correctly.`,
  tools: [
    "Glob - Find files by pattern",
    "Grep - Search file contents",
    "Read - Read file contents",
    "LSP - Understand code structure",
    "WebSearch - Research best practices",
    "WebFetch - Read documentation",
  ],
  outputFormat: `Return design in structured format:

## Problem Analysis
- Requirements understood
- Constraints identified
- Existing patterns to follow

## Proposed Solution
- Architecture overview
- Key components and their responsibilities
- Data flow

## Implementation Plan
1. [Step with specific files/changes]
2. [Step with specific files/changes]
...

## Files to Create/Modify
- [path]: [what changes]

## Trade-offs Considered
- [option A] vs [option B]: chose [X] because [reasoning]

## Risks and Mitigations
- [risk]: [mitigation strategy]`,
  constraints: [
    "Design only - do not implement",
    "No memory operations - orchestrator handles memory",
    "Consider existing patterns in the codebase",
    "Provide specific, actionable steps",
    "Highlight uncertainty where it exists",
  ],
};

/**
 * Code Reviewer agent template.
 *
 * Specializes in reviewing code changes for quality, correctness,
 * and adherence to project patterns.
 */
export const CODE_REVIEWER_TEMPLATE: AgentTemplate = {
  name: "code-reviewer",
  model: "sonnet",
  categories: ["review"],
  mission: `Review code changes for quality, correctness, and adherence to
project patterns. Identify bugs, security issues, performance problems,
and maintainability concerns. Provide constructive feedback.`,
  tools: [
    "Read - Read file contents",
    "Grep - Search for patterns",
    "Bash - git diff, git log (read-only)",
    "LSP - Check types, find usages",
  ],
  outputFormat: `Return review in structured format:

## Summary
- Overall assessment: [approve/request changes/needs discussion]
- Risk level: [low/medium/high]

## Issues Found

### Critical (must fix)
- [file:line]: [issue description]

### Major (should fix)
- [file:line]: [issue description]

### Minor (nice to fix)
- [file:line]: [issue description]

## Positive Observations
- [what was done well]

## Suggestions
- [improvement ideas, not blocking]

## Checklist
- [ ] Tests cover changes
- [ ] No security issues
- [ ] Follows project patterns
- [ ] Documentation updated`,
  constraints: [
    "Review only - do not modify code",
    "No memory operations - orchestrator handles memory",
    "Be specific about issues (file, line, description)",
    "Distinguish severity levels clearly",
    "Provide actionable feedback, not vague criticism",
  ],
};

/**
 * Map of built-in agent templates.
 */
export const BUILT_IN_TEMPLATES: Record<BuiltInAgentType, AgentTemplate> = {
  "code-explorer": CODE_EXPLORER_TEMPLATE,
  "code-architect": CODE_ARCHITECT_TEMPLATE,
  "code-reviewer": CODE_REVIEWER_TEMPLATE,
};

/**
 * Get a built-in agent template by name.
 *
 * @param name - Built-in agent type name
 * @returns Agent template
 */
export function getBuiltInTemplate(name: BuiltInAgentType): AgentTemplate {
  return BUILT_IN_TEMPLATES[name];
}

/**
 * Get all built-in agent templates.
 *
 * @returns Array of all built-in templates
 */
export function getAllBuiltInTemplates(): AgentTemplate[] {
  return Object.values(BUILT_IN_TEMPLATES);
}

/**
 * Check if a name is a built-in agent type.
 *
 * @param name - Agent name to check
 * @returns True if it's a built-in type
 */
export function isBuiltInAgent(name: string): name is BuiltInAgentType {
  return name in BUILT_IN_TEMPLATES;
}

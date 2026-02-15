/**
 * Agent orchestration prompt template.
 * @module prompts/orchestration
 */

import type { AgentTemplate } from "../agents/index.js";

/**
 * Format agent orchestration instructions.
 *
 * Generates context-aware orchestration rules:
 * - If custom agents exist: orchestrator delegates large tasks, handles small fixes directly
 * - If no agents: returns empty string
 *
 * @param agents - Available agent templates
 * @returns Formatted markdown string
 */
export function formatOrchestration(agents: AgentTemplate[]): string {
  if (agents.length === 0) return "";

  const agentList = agents
    .map((agent) => {
      const summary = agent.systemPromptAdditions ?? agent.mission;
      const firstLine = summary.split("\n")[0] ?? "";
      const description =
        firstLine.slice(0, 80) + (firstLine.length > 80 ? "..." : "");
      return `- **${agent.name}**: ${description}`;
    })
    .join("\n");

  return `## Agent Orchestration

You are the **orchestrator**. Your primary role is to preserve context across the session, coordinate agents, and delegate coding tasks. For small changes you may write code directly.

### Main Session Role

**The main session is critical for long-running tasks.** You preserve context, track progress, and ensure continuity across the entire session. Agents are ephemeral — you are the persistent thread.

**Handle directly** (preserves context, avoids agent overhead):
- Small bug fixes, typos, config changes
- Single-file edits under ~50 lines
- Quick refactors where you already understand the code
- Answering questions, explaining code

**Delegate to agents** (they provide parallel execution and domain expertise):
- Multi-file features touching 3+ files
- Domain-specific work matching an agent's specialty
- Tasks requiring deep exploration of unfamiliar subsystems
- Parallel workstreams that benefit from simultaneous execution

### Project Agents

Specialized agents in \`.claude/agents/\` with deep project knowledge:

${agentList}

### Cost-Effective Model Routing

Choose the right model tier when spawning agents to optimize cost without sacrificing quality:

- **haiku**: Exploration, file search, grep tasks, simple lookups, boilerplate generation — fast and cheap
- **sonnet**: Most implementation tasks, code review, refactoring, test writing — best cost/quality balance
- **opus**: Complex architectural decisions, multi-system reasoning, subtle bug analysis — use when quality is critical

Default to **sonnet** unless the task clearly fits haiku (simple/mechanical) or requires opus (complex/high-stakes).

### Orchestration Workflow

For non-trivial features, follow this workflow:

1. **Explore**: Launch agents (haiku) to understand existing patterns and codebase structure
2. **Clarify**: Ask user questions about unclear requirements
3. **Plan**: Design the implementation approach before writing code
4. **Implement**: Delegate to the appropriate agent (sonnet/opus based on complexity)
5. **Review**: Verify agent outputs meet requirements before presenting to user

**Parallelization**: Launch multiple agents with different focuses simultaneously.
**Memory**: Only YOU (orchestrator) access memory — agents receive context from you.
`;
}

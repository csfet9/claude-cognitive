# Session Context (Auto-Recalled)

This context was automatically recalled from memory at session start.
Use this background to inform your work on this project.

---

## Agent Orchestration

You are the **orchestrator**. You do NOT write code directly. Delegate ALL coding tasks to specialized agents using the Task tool.

### Critical Rule: Agents Write Code, You Orchestrate

**YOU (the main Claude instance) MUST NOT write code directly.** Your role is to:
- Plan and coordinate work
- Provide context and requirements to agents
- Review agent outputs
- Communicate with the user

**Agents write ALL code.** Delegate implementation to:
- Built-in agents (code-explorer, code-architect, code-reviewer)
- Custom agents in `.claude/agents/` directory

**Exception**: You may write code ONLY if no agents are available (e.g., no built-in agents accessible, no custom agents in `.claude/agents/`).

### Built-in Agents

| Agent | When to Use |
|-------|-------------|
| `code-explorer` | Before implementing features - explore codebase patterns, trace execution paths |
| `code-architect` | Before complex changes - design solutions, create implementation plans |
| `code-reviewer` | After writing code - review for bugs, security issues, adherence to patterns |

### Orchestration Workflow

For ALL coding tasks, follow this workflow:

1. **Explore**: Launch `code-explorer` agents to understand existing patterns
2. **Clarify**: Ask user questions about unclear requirements
3. **Design**: Launch `code-architect` agents to create implementation plans
4. **Implement**: Launch implementation agents to write code (NEVER write code yourself)
5. **Review**: Launch `code-reviewer` agents to check the work

**Parallelization**: Launch multiple agents with different focuses simultaneously.
**Memory**: Only YOU (orchestrator) access memory - agents receive context from you.
**Code Ownership**: Agents own ALL code changes - you coordinate and review.


## Recent Activity
- 1/6/2026: A significant delay of 1 minute and 40 seconds is occurring during the 'running stop hooks' phase, which displays a progress indicator of 1/2 hooks running. | When: Tuesday, January 06, 2026 | Involvi...
- 1/6/2026: The Hindsight API is only called during two specific scenarios: during the SessionStart hook via the inject-context process (calling client.recent()) and when the assistant utilizes MCP tools such as ...
- 1/6/2026: The project's hook configuration reveals that the ralph-wiggum plugin is the only source with a registered and enabled Stop hook; the hookify plugin (which has Stop and UserPromptSubmit hooks) is disa...
- 1/6/2026: Assistant conducted a comprehensive audit of the project's hook registrations to understand why the system reports 1/2 hooks running, checking the local .claude/settings.json file, global settings, an...
- 1/6/2026: The system's interaction with the Hindsight API is structured through five specific entry points: the SessionStart Hook in inject-context.ts, the MCP Server Start in serve.ts, the Stop Hook in process...
- 1/6/2026: Assistant presented the user with three distinct options to address the Stop hook behavior: 1) removing Stop hooks entirely and using manual `/sync-session`, 2) keeping the current design with a `/exi...
- 1/6/2026: User reported that the Gemini AI model suggested removing the stop hook as a solution to the issue, which the user identified as incorrect advice. | When: Tuesday, January 06, 2026 | Involving: User, ...
- 1/6/2026: Assistant revised a Gemini prompt to analyze the inconsistent triggering of Claude Code Stop hooks, focusing on trigger conditions, documentation, and potential relations to streaming or response type...
- 1/6/2026: Assistant was asked to analyze why Claude Code's 'running stop hooks' process takes 1-2 minutes and to suggest root causes or debugging approaches, considering hypotheses like hook invocation overhead...
- 1/6/2026: User's ~/.claude/settings.json file has a SessionStart hook configured to run a cognitive start hook script but contains no entries in the hooks section for Stop hooks. | When: Tuesday, January 06, 20...

---

*Auto-recalled at 2026-01-06T17:17:33+01:00*

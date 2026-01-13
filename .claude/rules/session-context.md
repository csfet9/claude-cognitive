# Session Context (Auto-Recalled)

This context was automatically recalled from memory at session start.
Use this background to inform your work on this project.

---

## Security Review Required

**MANDATORY**: Before ANY `git commit` command, you MUST:
1. Launch the `security-code-reviewer` agent to review all staged changes
2. Wait for the security review to complete
3. Address any critical/high issues found
4. Only then proceed with the commit

This policy is enforced for this project. Do not skip security review.

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
- 1/12/2026: The default 'auto' setting currently results in the Gemini CLI selecting 'gemini-3-flash-preview' as the best model. | When: Monday, January 12, 2026 | Involving: user | The user is noting the current...
- 1/12/2026: Users can override the default model setting by modifying the '.claudemindrc' configuration file. | When: Monday, January 12, 2026 | Involving: user | To allow persistent user preferences for specific...
- 1/12/2026: The logic in 'executor.ts' determines whether to include the '-m' flag based on whether the model is set to 'auto'. | When: Monday, January 12, 2026 | Involving: user | This code implementation ensure...
- 1/12/2026: The Gemini CLI supports specific model overrides for 'gemini-2.5-pro' and 'gemini-2.5-flash' using the '-m' flag in the command line. | When: Monday, January 12, 2026 | Involving: user | To provide us...
- 1/12/2026: The Gemini CLI tool supports an 'auto' configuration model which maps to the command 'gemini -o text' without a model flag, allowing the CLI to auto-select the model. | When: Monday, January 12, 2026 ...
- 1/12/2026: Assistant clarified that the '-m' flag was not removed completely but made conditional. | When: Monday, January 12, 2026 | Involving: Assistant, User | User specifically asked if the '-m' flag was rem...
- 1/12/2026: Assistant instructed the user to restart Claude Code or the MCP server to apply the new compiled code. | When: Monday, January 12, 2026 | Involving: Assistant, User | The MCP server was still running ...
- 1/12/2026: Assistant confirmed that all 801 tests passed and the build succeeded following the refactoring. | When: Monday, January 12, 2026 | Involving: Assistant | To ensure the code changes did not introduce ...
- 1/12/2026: The user is managing a development project called 'claude-cognitive' and is overseeing the integration of a Gemini Model Context Protocol (MCP) server.
- 1/12/2026: The user initiated a release cycle for version 0.6.0, which includes updating the README, changelog, bumping the npm version, and creating a GitHub release.

---

*Auto-recalled at 2026-01-13T00:54:06+01:00*

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
- 1/6/2026: The update command in claude-cognitive handles migration by removing semantic config from existing .claudemindrc files. | When: Tuesday, January 6, 2026 | Involving: Assistant | To ensure backward com...
- 1/6/2026: User is working on a project named Camarilla_Trader located at /Users/sfetanclaudiu/Documents/GitHub/Camarilla_Trader. | When: Tuesday, January 6, 2026 | Involving: User (sfetanclaudiu) | This is the ...
- 1/6/2026: Assistant released version 0.4.9 of claude-cognitive, which included updating npm, committing the changelog, and pushing changes (4 files changed, 50 insertions, 117 deletions). | When: Tuesday, Janua...
- 1/6/2026: Assistant added modern configuration options to the install command: hindsight.timeouts (recall: 120s, reflect: 180s, retain: 90s), context.recentMemoryLimit: 3, retain config, and feedback config. | ...
- 1/6/2026: Assistant removed obsolete semantic memory configurations including the .claude/memory.md path, file creation, and CLAUDE.md memory instructions injection from the install command. | When: Tuesday, Ja...
- 1/6/2026: The tracking logic within 'mind.recall()' was silently skipped as a result of the missing session identifier.
- 1/6/2026: The lack of session initialization caused the feedback system to record zero feedback despite extended project work.
- 1/6/2026: The 'mind.onSessionStart()' function was not being called during the MCP server's 'serve' command.
- 1/6/2026: A bug in the MCP server initialization prevented the 'sessionId' from being assigned, leaving it as a null value.
- 1/6/2026: User employs a sophisticated AI development workflow involving the Claude Code CLI, multiple specialized agents (code-explorer, Explore, code-architect), and a custom 'Hindsight' memory system for ses...

---

*Auto-recalled at 2026-01-07T09:47:48+01:00*

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
- 1/12/2026: The assistant created a 563-line implementation plan file at .claude/gemini-wrapper-plan.md covering seven phases of development for the Gemini CLI wrapper MCP | When: Monday, January 12, 2026 | Invol...
- 1/12/2026: The assistant confirmed that the Gemini integration commits were local only and never pushed to the origin, meaning the local state at version 0.5.9 is in sync with the remote repository | When: Monda...
- 1/12/2026: The user integrates Gemini into projects like claude-cognitive to extend context windows and optimize codebase scanning.
- 1/12/2026: The user manages a full release cycle that includes updating READMEs and changelogs, bumping npm versions to 0.6.0, and performing GitHub releases.
- 1/12/2026: The user incorporates Gemini setup as a default option within 'install' and 'update' commands, specifically for 'learning' environments.
- 1/12/2026: The user troubleshoot technical issues related to exactOptionalPropertyTypes, type mismatches in tool schemas, and mock function parameters during testing.
- 1/12/2026: The user requested that documentation and configurations reflect Gemini 3 models (specifically gemini-2.5-flash) instead of Gemini 2 models.
- 1/12/2026: The user is developing a Gemini integration that involves implementing a Model Context Protocol (MCP) server, integrating Zod schemas, and configuring dynamic model selection via a .claudemindrc file.
- 1/12/2026: The user prefers authenticating the Gemini CLI using a Google account OAuth login rather than an API key to utilize their Google subscription directly.
- 1/12/2026: The assistant verified that the .mcp.json configuration file is clean and only contains the 'claude-cognitive' entry, with no external Gemini MCP present | When: Monday, January 12, 2026 | Involving: ...

---

*Auto-recalled at 2026-01-12T20:35:59+01:00*

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
- 1/13/2026: The v0.6.2 release changed the default dynamic timeout from 120 seconds to unlimited (0). | When: Tuesday, January 13, 2026 | Involving: assistant | To prevent premature timeouts during standard opera...
- 1/13/2026: The v0.6.2 release introduced 'Gemini code exploration guidance' which is auto-injected into sessions when Gemini is configured. | When: Tuesday, January 13, 2026 | Involving: assistant | To provide b...
- 1/13/2026: The assistant released and pushed version v0.6.2 of the software, including commit 1a6bf85. | When: Tuesday, January 13, 2026 | Involving: assistant | User requested the full release cycle (changelog,...
- 1/13/2026: The assistant performed a security review on the proposed changes, which passed with a 'Low risk' assessment and was 'APPROVED'. | When: Tuesday, January 13, 2026 | Involving: assistant | User request...
- 1/13/2026: Users have the ability to set a specific timeout, such as 300,000 milliseconds (5 minutes), within the '.claudemindrc' configuration file under the 'gemini' key. | When: Tuesday, January 13, 2026 | In...
- 1/13/2026: The assistant confirmed that real Gemini CLI errors, such as non-zero exit codes and stderr messages, are still detected and reported regardless of timeout settings. | When: Tuesday, January 13, 2026 ...
- 1/13/2026: The assistant implemented a behavior where setting 'timeout > 0' in the Gemini CLI configuration causes the system to timeout after the specified number of milliseconds. | When: Tuesday, January 13, 2...
- 1/13/2026: The assistant implemented a behavior change where setting 'timeout = 0' in the Gemini CLI configuration causes the system to wait indefinitely without an artificial limit. | When: Tuesday, January 13,...
- 1/13/2026: The user is managing the development and release cycle of the claude-cognitive project, specifically overseeing the transition to version 0.6.0.
- 1/13/2026: The user prefers authenticating the Gemini CLI using a Google account OAuth login rather than an API key to utilize their direct subscription.

---

*Auto-recalled at 2026-01-13T11:08:55+01:00*

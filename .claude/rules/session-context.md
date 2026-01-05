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

### Custom Agents

Check `.claude/agents/` for project-specific agents. These may include specialized agents for:
- Feature implementation
- Testing
- Documentation
- Domain-specific tasks

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
- 1/5/2026: The assistant processed a detailed list of code changes and file creations provided by the user regarding a new feedback system implementation. | When: Monday, January 05, 2026 during the session tran...
- 1/5/2026: The user added a new signal() method to src/mind.ts and updated the onSessionEnd() method to process feedback. The signal() method sends SignalItems to the Hindsight client, while onSessionEnd() uses ...
- 1/5/2026: The user created a new file at src/feedback/index.ts which implements the FeedbackService class facade. This class includes a constructor taking FeedbackConfig and projectDir, and methods including is...

---

*Auto-recalled at 2026-01-05T15:54:34+01:00*

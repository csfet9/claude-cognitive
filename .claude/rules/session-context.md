# Session Context (Auto-Recalled)

This context was automatically recalled from memory at session start.
Use this background to inform your work on this project.

---

## Agent Orchestration

You are the **orchestrator**. Delegate complex tasks to specialized agents using the Task tool.

### Built-in Agents

| Agent | When to Use |
|-------|-------------|
| `code-explorer` | Before implementing features - explore codebase patterns, trace execution paths |
| `code-architect` | Before complex changes - design solutions, create implementation plans |
| `code-reviewer` | After writing code - review for bugs, security issues, adherence to patterns |

### Orchestration Workflow

For non-trivial features, follow this workflow:

1. **Explore**: Launch `code-explorer` agents to understand existing patterns
2. **Clarify**: Ask user questions about unclear requirements
3. **Design**: Launch `code-architect` agents to create implementation plans
4. **Implement**: Write code following the chosen architecture
5. **Review**: Launch `code-reviewer` agents to check your work

**Parallelization**: Launch multiple agents with different focuses simultaneously.
**Memory**: Only YOU (orchestrator) access memory - agents receive context from you.


## Recent Activity
- 1/5/2026: The assistant processed a detailed list of code changes and file creations provided by the user regarding a new feedback system implementation. | When: Monday, January 05, 2026 during the session tran...
- 1/5/2026: The user added a new signal() method to src/mind.ts and updated the onSessionEnd() method to process feedback. The signal() method sends SignalItems to the Hindsight client, while onSessionEnd() uses ...
- 1/5/2026: The user created a new file at src/feedback/index.ts which implements the FeedbackService class facade. This class includes a constructor taking FeedbackConfig and projectDir, and methods including is...

---

*Auto-recalled at 2026-01-05T16:53:16+01:00*

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
- 1/7/2026: User expressed a preference for concrete code patterns, specific decisions with rationale, and file-level knowledge in a project context system | When: Wednesday, January 7, 2026 | Involving: user | T...
- 1/7/2026: Assistant revised its assessment of the memory system to an 8/10 rating | When: Wednesday, January 7, 2026 | Involving: assistant, user | The user provided context that redundancy is a known LLM limit...
- 1/7/2026: The user and assistant worked together on the camarilla-trader project | When: Wednesday, January 7, 2026 | Involving: user, assistant | To sort out specific issues within the project; the presence of...
- 1/7/2026: Analysis is utilized to audit codebase composition, identify documentation density, and understand the technical stack of a repository.
- 1/7/2026: Analysis activities included tracing the Hindsight API call flow and examining entry points to visualize how system requests are handled.
- 1/7/2026: The results of the API flow analysis were used to generate a comprehensive flow diagram for the user on January 6, 2026.
- 1/7/2026: An analysis of the project directory structure was conducted on January 4, 2026, to map the organization of source and test files.
- 1/7/2026: A file extension analysis performed on January 4, 2026, identified 121 files, comprising 92 TypeScript files, 14 Markdown files, 8 JSON files, 2 SVG files, and 5 files without extensions.
- 1/7/2026: The user implemented a feedback system for Hindsight to address the issue of memory redundancy | When: Wednesday, January 7, 2026 | Involving: user | The feedback system uses signals like 'used', 'ign...
- 1/7/2026: User is a software developer specializing in algorithmic trading systems, specifically building a Camarilla Pivot Points architecture for futures markets including ES, NQ, YM, and GC.

---

*Auto-recalled at 2026-01-07T18:50:32+01:00*

# Task Plan: Atlassian CLI (Bun/TS) Design + Plan

## Goal
Define a Bun/TypeScript CLI that mirrors mcp-atlassian capabilities for Jira + Confluence using gh-style subcommands, with Cloud + Server/DC support via API token or PAT, and produce a clear design + implementation plan.

## Current Phase
Phase 4

## Phases
<!-- 
  WHAT: Break your task into 3-7 logical phases. Each phase should be completable.
  WHY: Breaking work into phases prevents overwhelm and makes progress visible.
  WHEN: Update status after completing each phase: pending → in_progress → complete
-->

### Phase 1: Requirements & Discovery
- [x] Confirm scope and success criteria for CLI
- [x] Map MCP tool coverage to CLI subcommands
- [x] Identify config/auth rules and Cloud/Server differences
- [x] Document findings in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Planning & Structure
- [x] Define CLI command map + flags
- [x] Define architecture/modules (config, auth, http, services, output)
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Create project structure and command scaffolding
- [x] Implement core HTTP/auth/config modules
- [x] Implement Jira + Confluence service methods
- [x] Wire commands and output formatting
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Verify key commands with mock/live tests (as available)
- [ ] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** in_progress

### Phase 5: Delivery
- [ ] Review design + plan for completeness
- [ ] Deliver to user
- **Status:** pending

## Key Questions
1. Which outputs are default for human-friendly view vs --json?
2. What exact command surface should mirror MCP tools in v1?
3. Any additional requirements for config file vs env vars?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| CLI uses gh-style subcommands | Matches user preference and existing mental model |
| Direct REST calls (not MCP wrapper) | User requested option A |
| Support Jira + Confluence, Cloud + Server/DC | Matches MCP scope and requirement |
| Support API token + PAT only | Per requirement; OAuth deferred |
| Commander for CLI | Aligns with gh-style command UX |
| Binary name `atlassian` | User preference |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
| `git status` failed: not a git repository | 1 | Skip commit; repo has no .git |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

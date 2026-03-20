# Findings & Decisions
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
- Build a Bun/TypeScript CLI that mirrors mcp-atlassian capabilities.
- Use gh-style subcommands instead of raw tool names.
- Support Jira + Confluence, Cloud + Server/DC.
- Auth: API token (Cloud) and PAT (Server/DC) only.
- Align behavior with mcp-atlassian; differences only in configuration, not core logic.

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
- mcp-atlassian is a Python MCP server using atlassian-python-api with Jira + Confluence tool coverage.
- Tools list is documented in `tmp/mcp-atlassian/docs/tools-reference.mdx` and includes read/write operations for Jira/Confluence.
- Jira Cloud search uses v3 `POST /rest/api/3/search/jql` with `nextPageToken` pagination and max 100 per page; total is not returned.
- Jira Server/DC uses v2-style JQL search with `start`/`limit` and max 50 per request.
- Config in mcp-atlassian is env-first: `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_PERSONAL_TOKEN`, `CONFLUENCE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_PERSONAL_TOKEN`.
- Filters supported via env: `JIRA_PROJECTS_FILTER`, `CONFLUENCE_SPACES_FILTER`, plus SSL verify flags.
- Jira MCP server defines tools in `servers/jira.py` with tags and rich parameter hints (search, get issue, user profile, etc.), which should map to CLI subcommands.
- Jira endpoints referenced include `POST /rest/api/3/search/jql` (cloud search), `GET /rest/api/2/issueLinkType`, `POST /rest/api/3/version`, and `/rest/api/3/issue/{key}/remotelink` for link operations.
- Jira link creation uses `POST /rest/api/3/issueLink` with `type`, `inwardIssue`, and `outwardIssue`; removal uses `DELETE /rest/api/3/issueLink/{linkId}`.
- Jira batch changelog fetch uses `POST /rest/api/3/changelog/bulkfetch` (Cloud-only).
- Implementation uses Commander for gh-style subcommands and adds JSON body/file inputs for write operations.
- CLI command groups are structured once per namespace (project/version/sprint) to avoid duplicate command definitions.
- Confluence MCP tools are defined in `servers/confluence.py` and include search (simple term → CQL conversion), get page by id/title+space, and additional read/write page/comment/label operations.
- Confluence search uses CQL via `confluence.cql` and can apply `CONFLUENCE_SPACES_FILTER`; user search hits `GET /rest/api/search/user`.
- Confluence analytics uses `/wiki/rest/api/analytics/content/{page_id}/views` (Cloud-only).
- mcp-atlassian config supports optional proxies (`HTTP_PROXY`, `HTTPS_PROXY`, `SOCKS_PROXY`, service-specific overrides) and custom headers via `JIRA_CUSTOM_HEADERS`/`CONFLUENCE_CUSTOM_HEADERS` (comma-separated `key=value`).
- MCP TypeScript SDK stdio server uses `McpServer` + `StdioServerTransport`; local process-spawned integrations should communicate only over stdin/stdout JSON-RPC.
- Local `tmp/mcp-atlassian` reference exposes canonical tool names such as `jira_get_issue`, `jira_search`, `confluence_search`, and `confluence_get_page`; reusing those names preserves compatibility for existing MCP clients.

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| CLI uses gh-style subcommands | Matches user preference and familiar CLI UX |
| Direct REST calls (not MCP wrapper) | User selected option A |
| Jira + Confluence; Cloud + Server/DC | Matches MCP scope and requirement |
| Auth: API token + PAT only | Required scope for v1 |
| Commander for CLI | Matches gh-style command expectations |
| CLI binary name `atlassian` | User preference |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- `tmp/mcp-atlassian/README.md`
- `tmp/mcp-atlassian/docs/tools-reference.mdx`
- `tmp/mcp-atlassian/src/mcp_atlassian/jira/config.py`
- `tmp/mcp-atlassian/src/mcp_atlassian/confluence/config.py`
- `tmp/mcp-atlassian/src/mcp_atlassian/jira/search.py`

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
-

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

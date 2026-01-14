# Atlassian CLI (Bun/TS) Design

## Context
Build a Bun/TypeScript CLI that mirrors the capabilities of `mcp-atlassian` as a standalone tool. The CLI uses gh-style subcommands and calls Atlassian REST APIs directly (no MCP wrapper). It must support Jira + Confluence for Cloud and Server/Data Center, with API token (Cloud) and PAT (Server/DC) authentication.

## Goals
- Provide a human-friendly CLI UX similar to `gh` with `jira` and `confluence` subcommands.
- Match MCP tool coverage in v1 (read/write operations where applicable).
- Support Cloud + Server/DC with the same command surface; only configuration differs.
- Provide scriptable output via `--json`.

## Non-goals (v1)
- OAuth 2.0 support.
- Full markdown/ADF conversion beyond what the APIs accept.
- Interactive TUI flows.

## CLI Command Map (v1)
Jira:
- `atl jira issue view|search|create|update|delete|transition`
- `atl jira issue comment add`
- `atl jira issue worklog list|add`
- `atl jira issue link create|remove`
- `atl jira issue link-types`
- `atl jira issue changelog batch`
- `atl jira epic add-issue`
- `atl jira project list|issues|versions`
- `atl jira version create|batch-create`
- `atl jira board list|issues`
- `atl jira sprint list|issues|create|update`
- `atl jira field search`
- `atl jira attachment download`
- `atl jira user view`

Confluence:
- `atl confluence page search|get|create|update|delete|children|views`
- `atl confluence comment add|list`
- `atl confluence label add|list`
- `atl confluence user search`

## Configuration & Auth
- Env-first config with CLI overrides and optional `--env-file`.
- Core vars: `JIRA_URL`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_PERSONAL_TOKEN`,
  `CONFLUENCE_URL`, `CONFLUENCE_USERNAME`, `CONFLUENCE_API_TOKEN`, `CONFLUENCE_PERSONAL_TOKEN`.
- Filters: `JIRA_PROJECTS_FILTER`, `CONFLUENCE_SPACES_FILTER`.
- SSL verify flags: `JIRA_SSL_VERIFY`, `CONFLUENCE_SSL_VERIFY`.
- Optional proxy/custom headers: `HTTP_PROXY`, `HTTPS_PROXY`, `SOCKS_PROXY`,
  `JIRA_CUSTOM_HEADERS`, `CONFLUENCE_CUSTOM_HEADERS`.
- Auth rules:
  - Cloud: Basic auth using username + API token.
  - Server/DC: PAT with `Authorization: Bearer <token>`.

## Architecture
```
src/
  cli/                # command definitions, flag parsing, help/usage
  core/
    config.ts         # env/flag resolution and validation
    http.ts           # fetch wrapper, retries, timeouts, error normalization
    auth.ts           # auth header helpers
    pagination.ts     # paging helpers for Jira/Confluence
    output.ts         # table/json formatting
  services/
    jira/             # Jira endpoints + domain helpers
    confluence/       # Confluence endpoints + domain helpers
```

### HTTP Layer
- Unified `request()` wrapper over `fetch`.
- Retries on 429/5xx with exponential backoff and `Retry-After` support.
- Normalized error type: `status`, `message`, `hint`, `request_id`.

### Service Layer
- Jira: uses v3 endpoints for Cloud (`/rest/api/3`) and v2 for Server/DC (`/rest/api/2`).
- Jira Cloud search: `POST /rest/api/3/search/jql` with `nextPageToken`.
- Jira Server/DC search: `jql` with `startAt`/`maxResults`.
- Agile endpoints: `/rest/agile/1.0`.
- Confluence: `/rest/api` for pages/comments/labels/users; Cloud-only analytics
  `GET /wiki/rest/api/analytics/content/{pageId}/views`.

### Output
- Default: human-friendly tables and summaries.
- `--json`: raw payload output for scripting.
- `--fields` and `--expand` pass-through to APIs when supported.

## Error Semantics
- Exit codes: `0` success, `2` config/validation error, `3` auth error, `1` other failures.
- Friendly messages for common auth/config mistakes.

## Testing
- Unit tests for config parsing, auth header creation, and pagination helpers.
- Mocked HTTP tests for key Jira/Confluence operations.
- Optional live smoke tests behind environment flags.

## Open Questions
- Default table columns for each command (confirm preferred columns).
- Whether to normalize Cloud/Server payloads or return raw per platform.

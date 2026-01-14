# AGENTS

> **Audience**: LLM-driven engineering agents

Bun/TypeScript CLI for Atlassian Jira and Confluence. Mirrors `mcp-atlassian` capabilities as standalone tool.

---

## STRUCTURE

```
atlassian-cli/
├── src/
│   ├── index.ts          # CLI entry + all Commander commands (884 lines)
│   ├── core/             # Shared infrastructure
│   │   ├── config.ts     # Env/flag resolution, JiraConfig/ConfluenceConfig types
│   │   ├── http.ts       # requestJson() wrapper with retry/timeout
│   │   ├── auth.ts       # buildAuthHeaders() for Basic/PAT
│   │   ├── errors.ts     # CliError, ConfigError, AuthError, HttpError
│   │   ├── output.ts     # printTable(), printJson(), printKeyValue()
│   │   ├── env.ts        # loadEnvFile() for --env-file
│   │   └── json.ts       # parseJsonInput() for --body/--body-file
│   └── services/
│       ├── jira.ts       # JiraService class (416 lines)
│       └── confluence.ts # ConfluenceService class (190 lines)
├── docs/plans/           # Design docs and progress tracking
└── tmp/                  # External reference (mcp-atlassian clone)
```

---

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new Jira command | `src/index.ts:206+` | Follow existing `jiraIssue.command()` pattern |
| Add new Confluence command | `src/index.ts:699+` | Follow existing `confluencePage.command()` pattern |
| Add Jira API method | `src/services/jira.ts` | Use `this.request<T>()` helper |
| Add Confluence API method | `src/services/confluence.ts` | Use `this.request<T>()` helper |
| Modify auth logic | `src/core/auth.ts` | Basic (Cloud) vs PAT (Server/DC) |
| Change config resolution | `src/core/config.ts` | `resolveJiraConfig()` / `resolveConfluenceConfig()` |
| Custom error types | `src/core/errors.ts` | Exit codes: 1=general, 2=config, 3=auth |

---

## CONVENTIONS

**CLI pattern**: gh-style subcommands via Commander
```
atlassian jira issue search --jql "..."
atlassian confluence page get --id 123
```

**Service pattern**: Class with private `request<T>()` wrapping `requestJson()`
```typescript
async getIssue(key: string): Promise<unknown> {
  return this.request(`${this.apiBase}/issue/${encodeURIComponent(key)}`, { method: "GET" });
}
```

**Auth detection**: Cloud URLs (*.atlassian.net) use Basic auth; others use PAT
- Cloud: `JIRA_USERNAME` + `JIRA_API_TOKEN`
- Server/DC: `JIRA_PERSONAL_TOKEN`

**API versions**:
- Jira Cloud: `/rest/api/3` with `POST /search/jql` + `nextPageToken`
- Jira Server: `/rest/api/2` with `GET /search` + `startAt`/`maxResults`
- Agile: `/rest/agile/1.0` (boards, sprints, epics)
- Confluence: `/rest/api` (pages, comments, labels)

**Output modes**: `--json` for raw payload, default is human-friendly tables

---

## ANTI-PATTERNS

- **NO separate `src/cli/` module** - All commands live in `src/index.ts` (deviates from design doc)
- **NO `core/pagination.ts`** - Pagination is inline in service methods
- **NO Retry-After header support** - Only exponential backoff in `http.ts`
- **NEVER use `any` without explicit cast** - Use `unknown` then narrow

---

## COMMANDS

```bash
# Install
bun install

# Run
bun run index.ts --help
bun run index.ts jira issue search --jql "project = PROJ"
bun run index.ts confluence page search "docs"

# With env file
bun run index.ts -e .env jira projects list
```

---

## ENV VARS

| Variable | Required | Purpose |
|----------|----------|---------|
| `JIRA_URL` | Yes (Jira) | Base URL |
| `JIRA_USERNAME` | Cloud | Email for Basic auth |
| `JIRA_API_TOKEN` | Cloud | API token |
| `JIRA_PERSONAL_TOKEN` | Server/DC | PAT for Bearer auth |
| `JIRA_SSL_VERIFY` | No | `false` to skip cert validation |
| `JIRA_PROJECTS_FILTER` | No | Comma-separated project keys |
| `CONFLUENCE_URL` | Yes (Confluence) | Base URL (include `/wiki` for Cloud) |
| `CONFLUENCE_USERNAME` | Cloud | Email |
| `CONFLUENCE_API_TOKEN` | Cloud | API token |
| `CONFLUENCE_PERSONAL_TOKEN` | Server/DC | PAT |

---

## NOTES

- `tmp/mcp-atlassian/` is reference implementation (Python) - do not modify
- Design doc at `docs/plans/2026-01-14-atlassian-cli-design.md` describes intended architecture
- No tests yet - design doc mentions unit/mocked HTTP tests as future work
- `index.ts` at 884 lines - consider splitting if adding many more commands

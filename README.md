# atlassian-cli

[![npm version](https://img.shields.io/npm/v/atlassian-cli.svg)](https://www.npmjs.com/package/atlassian-cli)
[![license](https://img.shields.io/npm/l/atlassian-cli.svg)](https://github.com/kaichen/atlassian-cli/blob/main/LICENSE)

CLI for Atlassian Jira and Confluence. Manage issues, search with JQL/CQL, browse Confluence pages — all from the terminal.

## Install

```bash
npm install -g atlassian-cli
```

Or run directly with npx:

```bash
npx atlassian-cli --help
```

## Configuration

Set environment variables or use a `.env` file:

```bash
# Jira (Cloud)
export JIRA_URL=https://your-company.atlassian.net
export JIRA_USERNAME=your.email@company.com
export JIRA_API_TOKEN=your_api_token

# Confluence (Cloud)
export CONFLUENCE_URL=https://your-company.atlassian.net/wiki
export CONFLUENCE_USERNAME=your.email@company.com
export CONFLUENCE_API_TOKEN=your_api_token
```

For Jira/Confluence Server or Data Center, use personal access tokens instead:

```bash
export JIRA_PERSONAL_TOKEN=your_pat
export CONFLUENCE_PERSONAL_TOKEN=your_pat
```

Or pass a `.env` file with the `-e` flag:

```bash
atlassian-cli -e .env jira issue search --jql "project = PROJ"
```

## Usage

```bash
atlassian-cli jira issue search --jql "project = PROJ AND status = 'In Progress'"
atlassian-cli jira issue view PROJ-123
atlassian-cli confluence page search "onboarding docs"
atlassian-cli confluence page get --id 123456
```

Use `--json` for raw JSON output:

```bash
atlassian-cli --json jira issue search --jql "assignee = currentUser()"
```

Run `atlassian-cli --help` for full command list.

## MCP Stdio Mode

Run the CLI as an MCP server over stdio with a single top-level subcommand:

```bash
atlassian-cli mcp
```

Limit the exposed tools if needed:

```bash
atlassian-cli mcp --enabled-tools "jira_get_issue,jira_search,confluence_search"
```

You can also use environment variables:

```bash
export ENABLED_TOOLS="jira_get_issue,jira_search"
export READ_ONLY_MODE=true
atlassian-cli mcp
```

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run src/index.ts --help
```

Build for distribution:

```bash
bun run build
```

## License

MIT

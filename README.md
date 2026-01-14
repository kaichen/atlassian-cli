# atlassian-cli

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts --help
```

Examples:

```bash
# Jira search
JIRA_URL=https://your-company.atlassian.net \
JIRA_USERNAME=your.email@company.com \
JIRA_API_TOKEN=your_api_token \
bun run index.ts jira issue search --jql "project = PROJ"

# Confluence search
CONFLUENCE_URL=https://your-company.atlassian.net/wiki \
CONFLUENCE_USERNAME=your.email@company.com \
CONFLUENCE_API_TOKEN=your_api_token \
bun run index.ts confluence page search "onboarding docs"
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

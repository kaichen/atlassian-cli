import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  resolveConfluenceConfig,
  resolveGlobalOptions,
  resolveJiraConfig,
  type CliOverrides,
} from "../core/config.ts";
import { ConfigError } from "../core/errors.ts";
import { ConfluenceService } from "../services/confluence.ts";
import { JiraService } from "../services/jira.ts";
import { registerConfluenceTools } from "./confluence-tools.ts";
import { registerJiraTools } from "./jira-tools.ts";

const SERVER_VERSION = "0.1.0";

interface StartMcpServerOptions {
  overrides: CliOverrides;
  enabledTools?: string;
}

function parseEnabledTools(raw: string | undefined): Set<string> | undefined {
  const source = raw ?? process.env.ENABLED_TOOLS;
  if (!source) {
    return undefined;
  }
  const names = source
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return names.length > 0 ? new Set(names) : undefined;
}

function writeWarnings(warnings: string[], verbose: boolean): void {
  if (!verbose) {
    return;
  }
  for (const warning of warnings) {
    process.stderr.write(`[mcp] ${warning}\n`);
  }
}

export async function startMcpServer(options: StartMcpServerOptions): Promise<void> {
  const globals = resolveGlobalOptions(options.overrides);
  const enabledTools = parseEnabledTools(options.enabledTools);
  const warnings: string[] = [];

  let jira: JiraService | undefined;
  let confluence: ConfluenceService | undefined;

  try {
    const jiraConfig = resolveJiraConfig(options.overrides, false);
    jira = jiraConfig ? new JiraService(jiraConfig, globals) : undefined;
  } catch (error) {
    warnings.push(error instanceof Error ? `Jira disabled: ${error.message}` : "Jira disabled.");
  }

  try {
    const confluenceConfig = resolveConfluenceConfig(options.overrides, false);
    confluence = confluenceConfig ? new ConfluenceService(confluenceConfig, globals) : undefined;
  } catch (error) {
    warnings.push(
      error instanceof Error ? `Confluence disabled: ${error.message}` : "Confluence disabled.",
    );
  }

  const server = new McpServer({
    name: "atlassian-cli",
    version: SERVER_VERSION,
  });

  let toolCount = 0;
  if (jira) {
    toolCount += registerJiraTools({
      server,
      jira,
      enabledTools,
      readOnly: globals.readOnly,
    });
  }
  if (confluence) {
    toolCount += registerConfluenceTools({
      server,
      confluence,
      enabledTools,
      readOnly: globals.readOnly,
    });
  }

  if (toolCount === 0) {
    const warningText = warnings.length > 0 ? ` ${warnings.join(" ")}` : "";
    throw new ConfigError(
      `No MCP tools are available. Configure Jira and/or Confluence credentials, or adjust ENABLED_TOOLS.${warningText}`.trim(),
    );
  }

  writeWarnings(warnings, globals.verbose);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

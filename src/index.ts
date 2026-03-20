import { Command } from "commander";
import { loadDefaultEnvFile, loadEnvFile } from "./core/env.ts";
import {
  resolveConfluenceConfig,
  resolveGlobalOptions,
  resolveJiraConfig,
  type CliOverrides,
  type GlobalOptions,
} from "./core/config.ts";
import {
  ensureBodyStorageExpand,
  getPageMarkdown,
} from "./core/confluence-markdown.ts";
import { parseJsonInput } from "./core/json.ts";
import { printJson, printKeyValue, printTable, printText } from "./core/output.ts";
import { AuthError, CliError, ConfigError, HttpError } from "./core/errors.ts";
import { JiraService } from "./services/jira.ts";
import { ConfluenceService } from "./services/confluence.ts";

type OutputMode = "json" | "table";

interface CommandContext {
  globals: GlobalOptions;
  output: OutputMode;
  jira?: JiraService;
  confluence?: ConfluenceService;
}

function loadEnvFromArgs(argv: string[]): void {
  loadDefaultEnvFile();
  const envIndex = argv.indexOf("--env-file");
  const shortIndex = argv.indexOf("-e");
  const index = envIndex >= 0 ? envIndex : shortIndex;
  if (index >= 0 && argv[index + 1]) {
    loadEnvFile(argv[index + 1]);
  }
}

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() !== "false";
  }
  return undefined;
}

function collectOverrides(command: Command): CliOverrides {
  const opts = command.optsWithGlobals ? command.optsWithGlobals() : {
    ...command.opts(),
    ...(command.parent?.opts() ?? {}),
  };
  return {
    jiraUrl: opts.jiraUrl,
    jiraUsername: opts.jiraUsername,
    jiraToken: opts.jiraToken,
    jiraPat: opts.jiraPat,
    jiraSslVerify: parseOptionalBool(opts.jiraSslVerify),
    jiraProjectsFilter: opts.jiraProjectsFilter,
    confluenceUrl: opts.confluenceUrl,
    confluenceUsername: opts.confluenceUsername,
    confluenceToken: opts.confluenceToken,
    confluencePat: opts.confluencePat,
    confluenceSslVerify: parseOptionalBool(opts.confluenceSslVerify),
    confluenceSpacesFilter: opts.confluenceSpacesFilter,
    readOnly: opts.readOnly,
    json: opts.json,
    verbose: opts.verbose,
  };
}

function createContext(command: Command, service: "jira" | "confluence"): CommandContext {
  const overrides = collectOverrides(command);
  const globals = resolveGlobalOptions(overrides);
  const output: OutputMode = overrides.json ? "json" : "table";
  if (service === "jira") {
    const jiraConfig = resolveJiraConfig(overrides, true);
    return {
      globals,
      output,
      jira: jiraConfig ? new JiraService(jiraConfig, globals) : undefined,
    };
  }
  const confluenceConfig = resolveConfluenceConfig(overrides, true);
  return {
    globals,
    output,
    confluence: confluenceConfig
      ? new ConfluenceService(confluenceConfig, globals)
      : undefined,
  };
}

function ensureWriteAllowed(globals: GlobalOptions): void {
  if (globals.readOnly) {
    throw new ConfigError("Read-only mode enabled. Write operations are disabled.");
  }
}

function outputResult(
  ctx: CommandContext,
  data: unknown,
  format?: () => void,
): void {
  if (ctx.output === "json") {
    printJson(data);
    return;
  }
  if (format) {
    format();
    return;
  }
  printJson(data);
}

function getIssueSummary(issue: any, baseUrl: string): Record<string, unknown> {
  const fields = issue?.fields ?? {};
  const key = issue?.key ?? "";
  return {
    key,
    summary: fields.summary ?? "",
    status: fields.status?.name ?? "",
    assignee: fields.assignee?.displayName ?? "",
    updated: fields.updated ?? "",
    url: key ? `${baseUrl}/browse/${key}` : "",
  };
}

function printIssueTable(issues: any[], baseUrl: string): void {
  const rows = issues.map((issue) => {
    const summary = getIssueSummary(issue, baseUrl);
    return [
      summary.key,
      summary.summary,
      summary.status,
      summary.assignee,
      summary.updated,
      summary.url,
    ];
  });
  printTable(["Key", "Summary", "Status", "Assignee", "Updated", "URL"], rows);
}

function printConfluenceSearch(results: any[]): void {
  const rows = results.map((item) => {
    const content = item?.content ?? item;
    const space = content?.space?.key ?? content?.space?.name ?? "";
    const links = content?._links ?? {};
    return [
      content?.id ?? "",
      content?.title ?? "",
      space,
      content?.version?.when ?? "",
      links?.base && links?.webui ? `${links.base}${links.webui}` : "",
    ];
  });
  printTable(["ID", "Title", "Space", "Updated", "URL"], rows);
}

function handleError(error: unknown): never {
  if (error instanceof AuthError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }
  if (error instanceof HttpError) {
    process.stderr.write(`${error.message}\n`);
    if (error.body) {
      process.stderr.write(`${JSON.stringify(error.body, null, 2)}\n`);
    }
    process.exit(error.exitCode);
  }
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exit(error.exitCode);
  }
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
}

export async function main(): Promise<void> {
  loadEnvFromArgs(process.argv);
  const program = new Command();
  program
    .name("atlassian")
    .description("Atlassian CLI for Jira and Confluence")
    .option("-e, --env-file <path>", "Path to .env file (overrides default .env loading)")
    .option("--json", "Output raw JSON")
    .option("--verbose", "Verbose logging")
    .option("--read-only", "Disable write operations")
    .option("--jira-url <url>", "Jira URL")
    .option("--jira-username <username>", "Jira username (Cloud)")
    .option("--jira-token <token>", "Jira API token (Cloud)")
    .option("--jira-pat <token>", "Jira personal access token (Server/DC)")
    .option("--jira-ssl-verify <bool>", "Verify Jira SSL certificates (true/false)")
    .option("--jira-projects-filter <keys>", "Comma-separated Jira project keys")
    .option("--confluence-url <url>", "Confluence URL")
    .option("--confluence-username <username>", "Confluence username (Cloud)")
    .option("--confluence-token <token>", "Confluence API token (Cloud)")
    .option("--confluence-pat <token>", "Confluence personal access token (Server/DC)")
    .option("--confluence-ssl-verify <bool>", "Verify Confluence SSL certificates (true/false)")
    .option("--confluence-spaces-filter <keys>", "Comma-separated Confluence space keys");

  const jira = program.command("jira").description("Jira operations");
  const jiraIssue = jira.command("issue").description("Issue operations");

  jiraIssue
    .command("view")
    .argument("<issueKey>", "Issue key (e.g., PROJ-123)")
    .option("--fields <fields>", "Comma-separated fields")
    .option("--expand <expand>", "Fields to expand")
    .action(async (issueKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getIssue(issueKey, options.fields, options.expand);
      outputResult(ctx, data, () => {
        const summary = getIssueSummary(data as any, ctx.jira!.getBaseUrl());
        printKeyValue("Issue", summary);
      });
    })

  jiraIssue
    .command("search")
    .requiredOption("--jql <query>", "JQL query")
    .option("--fields <fields>", "Comma-separated fields")
    .option("--limit <number>", "Max results", "10")
    .option("--start <number>", "Start index", "0")
    .option("--expand <expand>", "Fields to expand")
    .option("--projects-filter <keys>", "Override project filter")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const data: any = await ctx.jira!.searchIssues(
        options.jql,
        options.fields,
        Number(options.limit),
        Number(options.start),
        options.expand,
        options.projectsFilter,
      );
      outputResult(ctx, data, () => {
        const issues = data?.issues ?? [];
        printIssueTable(issues, ctx.jira!.getBaseUrl());
      });
    })

  jiraIssue
    .command("create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for issue creation.");
      }
      const data = await ctx.jira!.createIssue(body);
      outputResult(ctx, data);
    })

  jiraIssue
    .command("update")
    .argument("<issueKey>", "Issue key")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (issueKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for issue update.");
      }
      const data = await ctx.jira!.updateIssue(issueKey, body);
      outputResult(ctx, data);
    })

  jiraIssue
    .command("delete")
    .argument("<issueKey>", "Issue key")
    .action(async (issueKey: string, _options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      await ctx.jira!.deleteIssue(issueKey);
      outputResult(ctx, { success: true, issueKey }, () => {
        printKeyValue("Deleted", { issue: issueKey });
      });
    })

  jiraIssue
    .command("transition")
    .argument("<issueKey>", "Issue key")
    .argument("<transitionId>", "Transition ID")
    .option("--body <json>", "Optional JSON payload override")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (issueKey: string, transitionId: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      const data = await ctx.jira!.transitionIssue(issueKey, transitionId, body);
      outputResult(ctx, data);
    })

  jiraIssue
    .command("transitions")
    .argument("<issueKey>", "Issue key")
    .action(async (issueKey: string, _options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getTransitions(issueKey);
      outputResult(ctx, data);
    })

  jiraIssue
    .command("batch-create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for batch create.");
      }
      const data = await ctx.jira!.batchCreateIssues(body);
      outputResult(ctx, data);
    })

  const jiraComment = jiraIssue.command("comment").description("Issue comments");
  jiraComment
    .command("add")
    .argument("<issueKey>", "Issue key")
    .option("--text <text>", "Plain text comment")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (issueKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      const data = await ctx.jira!.addComment(issueKey, options.text, body);
      outputResult(ctx, data);
    })

  const jiraWorklog = jiraIssue.command("worklog").description("Worklogs");
  jiraWorklog
    .command("list")
    .argument("<issueKey>", "Issue key")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "20")
    .action(async (issueKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getWorklog(
        issueKey,
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  jiraWorklog
    .command("add")
    .argument("<issueKey>", "Issue key")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (issueKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for worklog.");
      }
      const data = await ctx.jira!.addWorklog(issueKey, body);
      outputResult(ctx, data);
    })

  const jiraLinks = jiraIssue.command("link").description("Issue links");
  jiraLinks
    .command("types")
    .action(async (_options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getIssueLinkTypes();
      outputResult(ctx, data);
    })

  jiraLinks
    .command("create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for link creation.");
      }
      const data = await ctx.jira!.createIssueLink(body);
      outputResult(ctx, data);
    })

  jiraLinks
    .command("remove")
    .argument("<linkId>", "Issue link ID")
    .action(async (linkId: string, _options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const data = await ctx.jira!.removeIssueLink(linkId);
      outputResult(ctx, data);
    })

  const jiraAttachment = jira
    .command("attachment")
    .description("Attachment operations");
  jiraAttachment
    .command("download")
    .requiredOption("--ids <ids>", "Comma-separated attachment IDs")
    .option("--dir <path>", "Output directory", ".")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const ids = options.ids.split(",").map((value: string) => value.trim());
      const data = await ctx.jira!.downloadAttachments(ids, options.dir);
      outputResult(ctx, data, () => {
        const rows = data.map((item) => [item.id, item.filename, item.filePath]);
        printTable(["ID", "Filename", "Path"], rows);
      });
    })

  jiraIssue
    .command("changelog")
    .description("Changelog operations")
    .command("batch")
    .requiredOption("--issues <ids>", "Comma-separated issue IDs or keys")
    .option("--fields <fields>", "Comma-separated field IDs")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const issues = options.issues.split(",").map((value: string) => value.trim());
      const fields = options.fields
        ? options.fields.split(",").map((value: string) => value.trim())
        : undefined;
      const data = await ctx.jira!.batchGetChangelogs(issues, fields);
      outputResult(ctx, data);
    })

  jira
    .command("projects")
    .description("Project operations")
    .command("list")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const data: any = await ctx.jira!.getAllProjects(
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data, () => {
        const values = data?.values ?? data;
        const rows = (values ?? []).map((project: any) => [
          project.key ?? "",
          project.name ?? "",
          project.projectTypeKey ?? "",
        ]);
        printTable(["Key", "Name", "Type"], rows);
      });
    })

  const jiraProject = jira
    .command("project")
    .description("Project scoped operations");

  jiraProject
    .command("issues")
    .argument("<projectKey>", "Project key")
    .option("--jql <jql>", "Additional JQL")
    .option("--fields <fields>", "Fields to return")
    .option("--limit <number>", "Max results", "10")
    .option("--start <number>", "Start index", "0")
    .action(async (projectKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data: any = await ctx.jira!.getProjectIssues(
        projectKey,
        options.jql,
        options.fields,
        Number(options.limit),
        Number(options.start),
      );
      outputResult(ctx, data, () => {
        const issues = data?.issues ?? [];
        printIssueTable(issues, ctx.jira!.getBaseUrl());
      });
    })

  jiraProject
    .command("versions")
    .argument("<projectKey>", "Project key")
    .action(async (projectKey: string, _options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getProjectVersions(projectKey);
      outputResult(ctx, data);
    })

  const jiraVersion = jira
    .command("version")
    .description("Version operations");

  jiraVersion
    .command("create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for version creation.");
      }
      const data = await ctx.jira!.createVersion(body);
      outputResult(ctx, data);
    })

  jiraVersion
    .command("batch-create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for version creation.");
      }
      const data = await ctx.jira!.batchCreateVersions(body);
      outputResult(ctx, data);
    })

  jira
    .command("fields")
    .description("Field operations")
    .command("search")
    .option("--query <query>", "Search query")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.searchFields(
        options.query,
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  jira
    .command("boards")
    .description("Board operations")
    .command("list")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      const data: any = await ctx.jira!.getBoards(
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data, () => {
        const rows = (data?.values ?? []).map((board: any) => [
          board.id ?? "",
          board.name ?? "",
          board.type ?? "",
        ]);
        printTable(["ID", "Name", "Type"], rows);
      });
    })

  jira
    .command("board")
    .description("Board scoped operations")
    .command("issues")
    .argument("<boardId>", "Board ID")
    .option("--jql <jql>", "JQL override")
    .option("--fields <fields>", "Fields to return")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (boardId: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getBoardIssues(
        boardId,
        options.jql,
        options.fields,
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  const jiraSprint = jira
    .command("sprint")
    .description("Sprint operations");

  jiraSprint
    .command("list")
    .argument("<boardId>", "Board ID")
    .option("--state <state>", "Sprint state (active,future,closed)")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (boardId: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data: any = await ctx.jira!.getSprintsFromBoard(
        boardId,
        options.state,
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data, () => {
        const rows = (data?.values ?? []).map((sprint: any) => [
          sprint.id ?? "",
          sprint.name ?? "",
          sprint.state ?? "",
          sprint.startDate ?? "",
          sprint.endDate ?? "",
        ]);
        printTable(["ID", "Name", "State", "Start", "End"], rows);
      });
    })

  jiraSprint
    .command("issues")
    .argument("<sprintId>", "Sprint ID")
    .option("--jql <jql>", "JQL override")
    .option("--fields <fields>", "Fields to return")
    .option("--start <number>", "Start index", "0")
    .option("--limit <number>", "Max results", "50")
    .action(async (sprintId: string, options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getSprintIssues(
        sprintId,
        options.jql,
        options.fields,
        Number(options.start),
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  jiraSprint
    .command("create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for sprint creation.");
      }
      const data = await ctx.jira!.createSprint(body);
      outputResult(ctx, data);
    })

  jiraSprint
    .command("update")
    .argument("<sprintId>", "Sprint ID")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (sprintId: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for sprint update.");
      }
      const data = await ctx.jira!.updateSprint(sprintId, body);
      outputResult(ctx, data);
    })

  jira
    .command("epic")
    .description("Epic operations")
    .command("add-issue")
    .argument("<epicIdOrKey>", "Epic ID or key")
    .requiredOption("--issues <keys>", "Comma-separated issue keys")
    .action(async (epicIdOrKey: string, options, command) => {
      const ctx = createContext(command, "jira");
      ensureWriteAllowed(ctx.globals);
      const issues = options.issues.split(",").map((value: string) => value.trim());
      const data = await ctx.jira!.addIssuesToEpic(epicIdOrKey, issues);
      outputResult(ctx, data);
    })

  jira
    .command("user")
    .description("User operations")
    .command("view")
    .argument("<identifier>", "Account ID (Cloud) or username (Server/DC)")
    .action(async (identifier: string, _options, command) => {
      const ctx = createContext(command, "jira");
      const data = await ctx.jira!.getUserProfile(identifier);
      outputResult(ctx, data);
    })

  const confluence = program
    .command("confluence")
    .description("Confluence operations");
  const confluencePage = confluence
    .command("page")
    .description("Page operations");

  confluencePage
    .command("search")
    .argument("<query>", "CQL or simple query")
    .option("--limit <number>", "Max results", "10")
    .option("--spaces-filter <keys>", "Override space filter")
    .action(async (query: string, options, command) => {
      const ctx = createContext(command, "confluence");
      const data: any = await ctx.confluence!.search(
        query,
        Number(options.limit),
        options.spacesFilter,
      );
      outputResult(ctx, data, () => {
        const results = data?.results ?? [];
        printConfluenceSearch(results);
      });
    })

  confluencePage
    .command("get")
    .option("--id <id>", "Page ID")
    .option("--title <title>", "Page title")
    .option("--space <key>", "Space key")
    .option("--expand <expand>", "Fields to expand")
    .option(
      "--markdown",
      "Fetch body.storage.value and return a Markdown document with frontmatter",
    )
    .action(async (options, command) => {
      const ctx = createContext(command, "confluence");
      if (options.markdown && ctx.output === "json") {
        throw new ConfigError("--markdown cannot be combined with --json.");
      }
      const expand = options.markdown
        ? ensureBodyStorageExpand(options.expand)
        : options.expand;
      const data = await ctx.confluence!.getPage(
        options.id,
        options.title,
        options.space,
        expand,
      );
      if (options.markdown) {
        printText(getPageMarkdown(data));
        return;
      }
      outputResult(ctx, data);
    })

  confluencePage
    .command("children")
    .argument("<pageId>", "Page ID")
    .option("--limit <number>", "Max results", "25")
    .action(async (pageId: string, options, command) => {
      const ctx = createContext(command, "confluence");
      const data = await ctx.confluence!.getPageChildren(
        pageId,
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  confluencePage
    .command("views")
    .argument("<pageId>", "Page ID")
    .action(async (pageId: string, _options, command) => {
      const ctx = createContext(command, "confluence");
      const data = await ctx.confluence!.getPageViews(pageId);
      outputResult(ctx, data);
    })

  confluencePage
    .command("create")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (options, command) => {
      const ctx = createContext(command, "confluence");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for page creation.");
      }
      const data = await ctx.confluence!.createPage(body);
      outputResult(ctx, data);
    })

  confluencePage
    .command("update")
    .argument("<pageId>", "Page ID")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (pageId: string, options, command) => {
      const ctx = createContext(command, "confluence");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for page update.");
      }
      const data = await ctx.confluence!.updatePage(pageId, body);
      outputResult(ctx, data);
    })

  confluencePage
    .command("delete")
    .argument("<pageId>", "Page ID")
    .action(async (pageId: string, _options, command) => {
      const ctx = createContext(command, "confluence");
      ensureWriteAllowed(ctx.globals);
      await ctx.confluence!.deletePage(pageId);
      outputResult(ctx, { success: true, pageId }, () => {
        printKeyValue("Deleted", { pageId });
      });
    })

  const confluenceComment = confluence
    .command("comment")
    .description("Comment operations");
  confluenceComment
    .command("add")
    .argument("<pageId>", "Page ID")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (pageId: string, options, command) => {
      const ctx = createContext(command, "confluence");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for comment.");
      }
      const data = await ctx.confluence!.addComment(pageId, body);
      outputResult(ctx, data);
    })

  confluenceComment
    .command("list")
    .argument("<pageId>", "Page ID")
    .option("--limit <number>", "Max results", "25")
    .action(async (pageId: string, options, command) => {
      const ctx = createContext(command, "confluence");
      const data = await ctx.confluence!.getComments(pageId, Number(options.limit));
      outputResult(ctx, data);
    })

  const confluenceLabel = confluence
    .command("label")
    .description("Label operations");
  confluenceLabel
    .command("add")
    .argument("<pageId>", "Page ID")
    .option("--body <json>", "JSON payload")
    .option("--body-file <path>", "Path to JSON payload")
    .action(async (pageId: string, options, command) => {
      const ctx = createContext(command, "confluence");
      ensureWriteAllowed(ctx.globals);
      const body = parseJsonInput(options.body, options.bodyFile);
      if (!body) {
        throw new ConfigError("Provide --body or --body-file for label.");
      }
      const data = await ctx.confluence!.addLabel(pageId, body);
      outputResult(ctx, data);
    })

  confluenceLabel
    .command("list")
    .argument("<pageId>", "Page ID")
    .action(async (pageId: string, _options, command) => {
      const ctx = createContext(command, "confluence");
      const data = await ctx.confluence!.getLabels(pageId);
      outputResult(ctx, data);
    })

  confluence
    .command("user")
    .description("User operations")
    .command("search")
    .requiredOption("--cql <cql>", "User CQL query")
    .option("--limit <number>", "Max results", "10")
    .action(async (options, command) => {
      const ctx = createContext(command, "confluence");
      const data = await ctx.confluence!.searchUser(
        options.cql,
        Number(options.limit),
      );
      outputResult(ctx, data);
    })

  await program.parseAsync(process.argv);
}

if (import.meta.main) {
  main().catch(handleError);
}

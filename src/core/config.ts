import { ConfigError } from "./errors.ts";

export type AuthType = "basic" | "pat";

export type OutputMode = "table" | "json" | "markdown";

export interface GlobalOptions {
  format: OutputMode;
  verbose: boolean;
  readOnly: boolean;
}

export interface JiraConfig {
  url: string;
  authType: AuthType;
  username?: string;
  apiToken?: string;
  personalToken?: string;
  sslVerify: boolean;
  isCloud: boolean;
  projectsFilter?: string;
  customHeaders?: Record<string, string>;
}

export interface ConfluenceConfig {
  url: string;
  authType: AuthType;
  username?: string;
  apiToken?: string;
  personalToken?: string;
  sslVerify: boolean;
  isCloud: boolean;
  spacesFilter?: string;
  customHeaders?: Record<string, string>;
}

export interface CliOverrides {
  jiraUrl?: string;
  jiraUsername?: string;
  jiraToken?: string;
  jiraPat?: string;
  jiraSslVerify?: boolean;
  jiraProjectsFilter?: string;
  confluenceUrl?: string;
  confluenceUsername?: string;
  confluenceToken?: string;
  confluencePat?: string;
  confluenceSslVerify?: boolean;
  confluenceSpacesFilter?: string;
  readOnly?: boolean;
  json?: boolean;
  format?: string;
  markdown?: boolean;
  verbose?: boolean;
}

export function resolveOutputMode(overrides: CliOverrides): OutputMode {
  if (overrides.format) {
    if (overrides.json || overrides.markdown) {
      throw new ConfigError("Use --format or --json/--markdown, not both.");
    }
    const f = overrides.format.toLowerCase();
    if (f === "json" || f === "table" || f === "markdown") {
      return f;
    }
    throw new ConfigError(`Invalid --format value "${overrides.format}". Use table, json, or markdown.`);
  }
  if (overrides.json && overrides.markdown) {
    throw new ConfigError("Cannot combine --json and --markdown. Use one or use --format.");
  }
  if (overrides.markdown) return "markdown";
  if (overrides.json) return "json";
  return "table";
}

export function resolveGlobalOptions(overrides: CliOverrides): GlobalOptions {
  return {
    format: resolveOutputMode(overrides),
    verbose: overrides.verbose ?? parseBool(process.env.MCP_VERBOSE, false),
    readOnly: overrides.readOnly ?? parseBool(process.env.READ_ONLY_MODE, false),
  };
}

function parseBool(value: string | undefined, defaultValue = true): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (value.trim() === "") {
    return defaultValue;
  }
  return value.toLowerCase() !== "false";
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function isCloudUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost") {
      return false;
    }
    return parsed.hostname.endsWith(".atlassian.net");
  } catch {
    return false;
  }
}

function normalizeConfluenceBaseUrl(url: string): string {
  const normalizedUrl = normalizeUrl(url);
  if (!isCloudUrl(normalizedUrl)) {
    return normalizedUrl;
  }
  const parsed = new URL(normalizedUrl);
  if (parsed.pathname === "" || parsed.pathname === "/") {
    parsed.pathname = "/wiki";
    return normalizeUrl(parsed.toString());
  }
  return normalizedUrl;
}

function parseCustomHeaders(raw: string | undefined): Record<string, string> | undefined {
  if (!raw) {
    return undefined;
  }
  const entries = raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, ...rest] = pair.split("=");
      return [key?.trim(), rest.join("=").trim()] as const;
    })
    .filter(([key, value]) => key && value);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries);
}

export function resolveJiraConfig(
  overrides: CliOverrides,
  required = true,
): JiraConfig | undefined {
  const url = overrides.jiraUrl ?? process.env.JIRA_URL;
  if (!url) {
    if (required) {
      throw new ConfigError("Missing Jira URL. Set JIRA_URL or use --jira-url.");
    }
    return undefined;
  }
  const normalizedUrl = normalizeUrl(url);
  const isCloud = isCloudUrl(normalizedUrl);
  const username = overrides.jiraUsername ?? process.env.JIRA_USERNAME;
  const apiToken = overrides.jiraToken ?? process.env.JIRA_API_TOKEN;
  const personalToken = overrides.jiraPat ?? process.env.JIRA_PERSONAL_TOKEN;
  const sslVerify = overrides.jiraSslVerify ?? parseBool(process.env.JIRA_SSL_VERIFY);
  const projectsFilter =
    overrides.jiraProjectsFilter ?? process.env.JIRA_PROJECTS_FILTER;
  const customHeaders = parseCustomHeaders(process.env.JIRA_CUSTOM_HEADERS);

  if (isCloud) {
    if (!username || !apiToken) {
      throw new ConfigError(
        "Jira Cloud requires JIRA_USERNAME and JIRA_API_TOKEN (or --jira-username/--jira-token).",
      );
    }
    return {
      url: normalizedUrl,
      authType: "basic",
      username,
      apiToken,
      sslVerify,
      isCloud,
      projectsFilter,
      customHeaders,
    };
  }

  if (!personalToken) {
    throw new ConfigError(
      "Jira Server/Data Center requires JIRA_PERSONAL_TOKEN (or --jira-pat).",
    );
  }
  return {
    url: normalizedUrl,
    authType: "pat",
    personalToken,
    sslVerify,
    isCloud,
    projectsFilter,
    customHeaders,
  };
}

export function resolveConfluenceConfig(
  overrides: CliOverrides,
  required = true,
): ConfluenceConfig | undefined {
  const url = overrides.confluenceUrl ?? process.env.CONFLUENCE_URL;
  if (!url) {
    if (required) {
      throw new ConfigError(
        "Missing Confluence URL. Set CONFLUENCE_URL or use --confluence-url.",
      );
    }
    return undefined;
  }
  const normalizedUrl = normalizeConfluenceBaseUrl(url);
  const isCloud = isCloudUrl(normalizedUrl);
  const username = overrides.confluenceUsername ?? process.env.CONFLUENCE_USERNAME;
  const apiToken = overrides.confluenceToken ?? process.env.CONFLUENCE_API_TOKEN;
  const personalToken =
    overrides.confluencePat ?? process.env.CONFLUENCE_PERSONAL_TOKEN;
  const sslVerify =
    overrides.confluenceSslVerify ?? parseBool(process.env.CONFLUENCE_SSL_VERIFY);
  const spacesFilter =
    overrides.confluenceSpacesFilter ?? process.env.CONFLUENCE_SPACES_FILTER;
  const customHeaders = parseCustomHeaders(process.env.CONFLUENCE_CUSTOM_HEADERS);

  if (isCloud) {
    if (!username || !apiToken) {
      throw new ConfigError(
        "Confluence Cloud requires CONFLUENCE_USERNAME and CONFLUENCE_API_TOKEN (or --confluence-username/--confluence-token).",
      );
    }
    return {
      url: normalizedUrl,
      authType: "basic",
      username,
      apiToken,
      sslVerify,
      isCloud,
      spacesFilter,
      customHeaders,
    };
  }

  if (!personalToken) {
    throw new ConfigError(
      "Confluence Server/Data Center requires CONFLUENCE_PERSONAL_TOKEN (or --confluence-pat).",
    );
  }
  return {
    url: normalizedUrl,
    authType: "pat",
    personalToken,
    sslVerify,
    isCloud,
    spacesFilter,
    customHeaders,
  };
}

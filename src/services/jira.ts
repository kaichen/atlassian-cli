import { buildAuthHeaders } from "../core/auth.ts";
import type { GlobalOptions, JiraConfig } from "../core/config.ts";
import { CliError, ConfigError } from "../core/errors.ts";
import { requestJson } from "../core/http.ts";
import { join } from "node:path";

function buildCommentBody(text: string, isCloud: boolean): unknown {
  if (!isCloud) {
    return text;
  }
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

export class JiraService {
  private readonly apiBase: string;
  private readonly agileBase = "/rest/agile/1.0";
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: JiraConfig,
    private readonly globals: GlobalOptions,
  ) {
    this.apiBase = config.isCloud ? "/rest/api/3" : "/rest/api/2";
    this.headers = {
      "User-Agent": "atlassian-cli/0.1.0",
      ...buildAuthHeaders(config),
      ...(config.customHeaders ?? {}),
    };
  }

  getBaseUrl(): string {
    return this.config.url;
  }

  private async request<T>(
    path: string,
    options: {
      method: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    return requestJson<T>({
      baseUrl: this.config.url,
      path,
      method: options.method,
      query: options.query,
      body: options.body,
      headers: this.headers,
      sslVerify: this.config.sslVerify,
      verbose: this.globals.verbose,
    });
  }

  async getIssue(issueKey: string, fields?: string, expand?: string): Promise<unknown> {
    return this.request(`${this.apiBase}/issue/${encodeURIComponent(issueKey)}`, {
      method: "GET",
      query: {
        fields,
        expand,
      },
    });
  }

  async searchIssues(
    jql: string,
    fields: string | undefined,
    limit: number,
    startAt: number,
    expand?: string,
    projectsFilter?: string,
  ): Promise<unknown> {
    const effectiveJql = applyProjectsFilter(jql, projectsFilter ?? this.config.projectsFilter);
    if (this.config.isCloud) {
      const pageSize = Math.min(100, limit);
      const issues: unknown[] = [];
      let nextPageToken: string | undefined;
      while (issues.length < limit) {
        const response = await this.request<{
          issues?: unknown[];
          nextPageToken?: string;
          total?: number;
        }>(`${this.apiBase}/search/jql`, {
          method: "POST",
          body: {
            jql: effectiveJql,
            maxResults: Math.min(pageSize, limit - issues.length),
            fields: fields ? fields.split(",").map((field) => field.trim()) : undefined,
            expand,
            nextPageToken,
          },
        });
        issues.push(...(response.issues ?? []));
        if (!response.nextPageToken) {
          return {
            issues,
            total: response.total ?? -1,
          };
        }
        nextPageToken = response.nextPageToken;
      }
      return { issues, total: -1 };
    }

    return this.request(`${this.apiBase}/search`, {
      method: "GET",
      query: {
        jql: effectiveJql,
        fields,
        expand,
        startAt,
        maxResults: Math.min(limit, 50),
      },
    });
  }

  async createIssue(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/issue`, { method: "POST", body });
  }

  async updateIssue(issueKey: string, body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/issue/${encodeURIComponent(issueKey)}`, {
      method: "PUT",
      body,
    });
  }

  async deleteIssue(issueKey: string): Promise<unknown> {
    return this.request(`${this.apiBase}/issue/${encodeURIComponent(issueKey)}`, {
      method: "DELETE",
    });
  }

  async transitionIssue(issueKey: string, transitionId: string, body?: unknown): Promise<unknown> {
    const payload = body ?? { transition: { id: transitionId } };
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: "POST",
        body: payload,
      },
    );
  }

  async addComment(issueKey: string, text?: string, body?: unknown): Promise<unknown> {
    if (!body && !text) {
      throw new ConfigError("Provide --text or --body for comment content.");
    }
    const payload = body ?? { body: buildCommentBody(text ?? "", this.config.isCloud) };
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/comment`,
      {
        method: "POST",
        body: payload,
      },
    );
  }

  async getWorklog(issueKey: string, startAt?: number, maxResults?: number): Promise<unknown> {
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/worklog`,
      {
        method: "GET",
        query: { startAt, maxResults },
      },
    );
  }

  async addWorklog(issueKey: string, body: unknown): Promise<unknown> {
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/worklog`,
      {
        method: "POST",
        body,
      },
    );
  }

  async getTransitions(issueKey: string): Promise<unknown> {
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/transitions`,
      { method: "GET" },
    );
  }

  async getIssueLinkTypes(): Promise<unknown> {
    return this.request(`${this.apiBase}/issueLinkType`, { method: "GET" });
  }

  async createIssueLink(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/issueLink`, { method: "POST", body });
  }

  async removeIssueLink(linkId: string): Promise<unknown> {
    return this.request(`${this.apiBase}/issueLink/${encodeURIComponent(linkId)}`, {
      method: "DELETE",
    });
  }

  async createRemoteIssueLink(issueKey: string, body: unknown): Promise<unknown> {
    return this.request(
      `${this.apiBase}/issue/${encodeURIComponent(issueKey)}/remotelink`,
      { method: "POST", body },
    );
  }

  async batchCreateIssues(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/issue/bulk`, { method: "POST", body });
  }

  async batchGetChangelogs(issueIdsOrKeys: string[], fields?: string[]): Promise<unknown> {
    if (!this.config.isCloud) {
      throw new CliError("Batch changelog fetch is only available on Jira Cloud.");
    }
    return this.request(`${this.apiBase}/changelog/bulkfetch`, {
      method: "POST",
      body: {
        issueIdsOrKeys,
        fieldIds: fields,
      },
    });
  }

  async getUserProfile(identifier: string): Promise<unknown> {
    const queryKey = this.config.isCloud ? "accountId" : "username";
    const value = identifier.startsWith("accountId:")
      ? identifier.slice("accountId:".length)
      : identifier;
    return this.request(`${this.apiBase}/user`, {
      method: "GET",
      query: { [queryKey]: value },
    });
  }

  async getAllProjects(startAt?: number, maxResults?: number): Promise<unknown> {
    if (this.config.isCloud) {
      return this.request(`${this.apiBase}/project/search`, {
        method: "GET",
        query: { startAt, maxResults },
      });
    }
    return this.request(`${this.apiBase}/project`, { method: "GET" });
  }

  async getProjectIssues(
    projectKey: string,
    jql: string | undefined,
    fields: string | undefined,
    limit: number,
    startAt: number,
  ): Promise<unknown> {
    const query = jql ? `${jql} AND project = "${projectKey}"` : `project = "${projectKey}"`;
    return this.searchIssues(query, fields, limit, startAt);
  }

  async getProjectVersions(projectKey: string): Promise<unknown> {
    return this.request(
      `${this.apiBase}/project/${encodeURIComponent(projectKey)}/versions`,
      { method: "GET" },
    );
  }

  async createVersion(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/version`, { method: "POST", body });
  }

  async batchCreateVersions(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/version/bulk`, { method: "POST", body });
  }

  async searchFields(query?: string, startAt?: number, maxResults?: number): Promise<unknown> {
    if (this.config.isCloud) {
      return this.request(`${this.apiBase}/field/search`, {
        method: "GET",
        query: { query, startAt, maxResults },
      });
    }
    return this.request(`${this.apiBase}/field`, { method: "GET" });
  }

  async getBoards(startAt?: number, maxResults?: number): Promise<unknown> {
    return this.request(`${this.agileBase}/board`, {
      method: "GET",
      query: { startAt, maxResults },
    });
  }

  async getBoardIssues(
    boardId: string,
    jql?: string,
    fields?: string,
    startAt?: number,
    maxResults?: number,
  ): Promise<unknown> {
    return this.request(`${this.agileBase}/board/${encodeURIComponent(boardId)}/issue`, {
      method: "GET",
      query: { jql, fields, startAt, maxResults },
    });
  }

  async getSprintsFromBoard(
    boardId: string,
    state?: string,
    startAt?: number,
    maxResults?: number,
  ): Promise<unknown> {
    return this.request(`${this.agileBase}/board/${encodeURIComponent(boardId)}/sprint`, {
      method: "GET",
      query: { state, startAt, maxResults },
    });
  }

  async getSprintIssues(
    sprintId: string,
    jql?: string,
    fields?: string,
    startAt?: number,
    maxResults?: number,
  ): Promise<unknown> {
    return this.request(`${this.agileBase}/sprint/${encodeURIComponent(sprintId)}/issue`, {
      method: "GET",
      query: { jql, fields, startAt, maxResults },
    });
  }

  async createSprint(body: unknown): Promise<unknown> {
    return this.request(`${this.agileBase}/sprint`, { method: "POST", body });
  }

  async updateSprint(sprintId: string, body: unknown): Promise<unknown> {
    return this.request(`${this.agileBase}/sprint/${encodeURIComponent(sprintId)}`, {
      method: "PUT",
      body,
    });
  }

  async addIssuesToEpic(epicIdOrKey: string, issueKeys: string[]): Promise<unknown> {
    return this.request(`${this.agileBase}/epic/${encodeURIComponent(epicIdOrKey)}/issue`, {
      method: "POST",
      body: { issues: issueKeys },
    });
  }

  async downloadAttachments(
    attachmentIds: string[],
    outputDir: string,
  ): Promise<{ id: string; filePath: string; filename: string }[]> {
    const results: { id: string; filePath: string; filename: string }[] = [];
    for (const attachmentId of attachmentIds) {
      const metadata = await this.request<{
        content?: string;
        filename?: string;
      }>(`${this.apiBase}/attachment/${encodeURIComponent(attachmentId)}`, {
        method: "GET",
      });
      if (!metadata.content || !metadata.filename) {
        throw new CliError(`Attachment metadata missing for ${attachmentId}.`);
      }
      const fetchOptions: RequestInit & { tls?: { rejectUnauthorized?: boolean } } = {
        headers: this.headers,
      };
      if (!this.config.sslVerify) {
        fetchOptions.tls = { rejectUnauthorized: false };
      }
      const response = await fetch(metadata.content, fetchOptions);
      if (response.status === 401 || response.status === 403) {
        throw new CliError(`Attachment download unauthorized for ${attachmentId}.`, 3);
      }
      if (!response.ok) {
        throw new CliError(`Failed to download attachment ${attachmentId}.`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const filePath = join(outputDir, metadata.filename);
      await Bun.write(filePath, buffer);
      results.push({ id: attachmentId, filePath, filename: metadata.filename });
    }
    return results;
  }
}

function applyProjectsFilter(jql: string, filter?: string): string {
  if (!filter) {
    return jql;
  }
  const projects = filter
    .split(",")
    .map((project) => project.trim())
    .filter(Boolean);
  if (projects.length === 0) {
    return jql;
  }
  const projectQuery =
    projects.length === 1
      ? `project = "${projects[0]}"`
      : `project IN (${projects.map((p) => `"${p}"`).join(", ")})`;
  if (!jql) {
    return projectQuery;
  }
  if (jql.trim().toUpperCase().startsWith("ORDER BY")) {
    return `${projectQuery} ${jql}`;
  }
  if (jql.toLowerCase().includes("project =") || jql.toLowerCase().includes("project in")) {
    return jql;
  }
  return `(${jql}) AND ${projectQuery}`;
}

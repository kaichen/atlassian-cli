import { buildAuthHeaders } from "../core/auth.ts";
import type { ConfluenceConfig, GlobalOptions } from "../core/config.ts";
import { CliError, ConfigError } from "../core/errors.ts";
import { requestJson } from "../core/http.ts";

function isSimpleQuery(query: string): boolean {
  return !/[=~<>]/.test(query) && !/\b(AND|OR)\b/i.test(query);
}

function quoteCql(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function applySpacesFilter(cql: string, spacesFilter?: string): string {
  if (!spacesFilter) {
    return cql;
  }
  const spaces = spacesFilter
    .split(",")
    .map((space) => space.trim())
    .filter(Boolean);
  if (spaces.length === 0) {
    return cql;
  }
  const spaceQuery = spaces.map((space) => `space = ${quoteCql(space)}`).join(" OR ");
  if (!cql) {
    return spaceQuery;
  }
  if (cql.includes("space =")) {
    return cql;
  }
  return `(${cql}) AND (${spaceQuery})`;
}

export class ConfluenceService {
  private readonly apiBase = "/rest/api";
  private readonly headers: Record<string, string>;

  constructor(
    private readonly config: ConfluenceConfig,
    private readonly globals: GlobalOptions,
  ) {
    this.headers = {
      "User-Agent": "atlassian-cli/0.1.0",
      ...buildAuthHeaders(config),
      ...(config.customHeaders ?? {}),
    };
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

  async search(
    query: string,
    limit: number,
    spacesFilter?: string,
  ): Promise<unknown> {
    const filter = spacesFilter ?? this.config.spacesFilter;
    if (isSimpleQuery(query)) {
      const siteSearch = applySpacesFilter(`siteSearch ~ ${quoteCql(query)}`, filter);
      try {
        return this.request(`${this.apiBase}/search`, {
          method: "GET",
          query: { cql: siteSearch, limit },
        });
      } catch {
        const textSearch = applySpacesFilter(`text ~ ${quoteCql(query)}`, filter);
        return this.request(`${this.apiBase}/search`, {
          method: "GET",
          query: { cql: textSearch, limit },
        });
      }
    }
    const cql = applySpacesFilter(query, filter);
    return this.request(`${this.apiBase}/search`, {
      method: "GET",
      query: { cql, limit },
    });
  }

  async getPage(
    pageId?: string,
    title?: string,
    spaceKey?: string,
    expand?: string,
  ): Promise<unknown> {
    if (pageId) {
      return this.request(`${this.apiBase}/content/${encodeURIComponent(pageId)}`, {
        method: "GET",
        query: { expand },
      });
    }
    if (!title || !spaceKey) {
      throw new ConfigError("Provide page ID or both --title and --space.");
    }
    return this.request(`${this.apiBase}/content`, {
      method: "GET",
      query: { title, spaceKey, expand },
    });
  }

  async getPageChildren(pageId: string, limit?: number): Promise<unknown> {
    return this.request(
      `${this.apiBase}/content/${encodeURIComponent(pageId)}/child/page`,
      { method: "GET", query: { limit } },
    );
  }

  async getComments(pageId: string, limit?: number): Promise<unknown> {
    return this.request(
      `${this.apiBase}/content/${encodeURIComponent(pageId)}/child/comment`,
      { method: "GET", query: { limit } },
    );
  }

  async getLabels(pageId: string): Promise<unknown> {
    return this.request(
      `${this.apiBase}/content/${encodeURIComponent(pageId)}/label`,
      { method: "GET" },
    );
  }

  async searchUser(cql: string, limit?: number): Promise<unknown> {
    return this.request(`${this.apiBase}/search/user`, {
      method: "GET",
      query: { cql, limit },
    });
  }

  async createPage(body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/content`, { method: "POST", body });
  }

  async updatePage(pageId: string, body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/content/${encodeURIComponent(pageId)}`, {
      method: "PUT",
      body,
    });
  }

  async deletePage(pageId: string): Promise<unknown> {
    return this.request(`${this.apiBase}/content/${encodeURIComponent(pageId)}`, {
      method: "DELETE",
    });
  }

  async addLabel(pageId: string, body: unknown): Promise<unknown> {
    return this.request(`${this.apiBase}/content/${encodeURIComponent(pageId)}/label`, {
      method: "POST",
      body,
    });
  }

  async addComment(pageId: string, body: unknown): Promise<unknown> {
    return this.request(
      `${this.apiBase}/content/${encodeURIComponent(pageId)}/child/comment`,
      {
        method: "POST",
        body,
      },
    );
  }

  async getPageViews(pageId: string): Promise<unknown> {
    if (!this.config.isCloud) {
      throw new CliError("Page views are only available on Confluence Cloud.");
    }
    return this.request(`${this.apiBase}/analytics/content/${encodeURIComponent(pageId)}/views`, {
      method: "GET",
    });
  }
}

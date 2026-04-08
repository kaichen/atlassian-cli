import { ConfigError } from "./errors.ts";

function parseHttpUrl(input: string): URL | undefined {
  try {
    const url = new URL(input);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function getPathSegmentAfter(url: URL, segment: string): string | undefined {
  const segments = url.pathname.split("/").filter(Boolean);
  const index = segments.findIndex((value) => value === segment);
  return index >= 0 ? segments[index + 1] : undefined;
}

export function normalizeJiraIssueKey(input: string): string {
  const value = input.trim();
  const url = parseHttpUrl(value);
  if (!url) {
    return value;
  }

  const issueKey = getPathSegmentAfter(url, "browse");
  if (issueKey) {
    return decodeURIComponent(issueKey);
  }

  throw new ConfigError("Jira issue URL must contain /browse/<ISSUE-KEY>.");
}

export function normalizeConfluencePageId(input: string): string {
  const value = input.trim();
  const url = parseHttpUrl(value);
  if (!url) {
    return value;
  }

  const pageIdParam = url.searchParams.get("pageId");
  if (pageIdParam) {
    return pageIdParam;
  }

  const pageId = getPathSegmentAfter(url, "pages");
  if (pageId && /^\d+$/.test(pageId)) {
    return pageId;
  }

  throw new ConfigError("Confluence page URL must contain /pages/<PAGE-ID> or ?pageId=<PAGE-ID>.");
}

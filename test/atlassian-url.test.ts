import { describe, expect, test } from "bun:test";
import {
  normalizeConfluencePageId,
  normalizeJiraIssueKey,
} from "../src/core/atlassian-url.ts";
import { ConfigError } from "../src/core/errors.ts";

describe("normalizeJiraIssueKey", () => {
  test("returns a raw issue key unchanged", () => {
    expect(normalizeJiraIssueKey("PROJ-123")).toBe("PROJ-123");
  });

  test("extracts an issue key from a Jira browse URL", () => {
    expect(normalizeJiraIssueKey("https://example.atlassian.net/browse/PROJ-123")).toBe(
      "PROJ-123",
    );
  });

  test("fails fast for Jira URLs without a browse issue key", () => {
    expect(() => normalizeJiraIssueKey("https://example.atlassian.net/issues")).toThrow(
      new ConfigError("Jira issue URL must contain /browse/<ISSUE-KEY>."),
    );
  });
});

describe("normalizeConfluencePageId", () => {
  test("returns a raw page ID unchanged", () => {
    expect(normalizeConfluencePageId("123456")).toBe("123456");
  });

  test("extracts a page ID from a Confluence page URL", () => {
    expect(
      normalizeConfluencePageId(
        "https://example.atlassian.net/wiki/spaces/TEAM/pages/123456/Example+Page",
      ),
    ).toBe("123456");
  });

  test("extracts a page ID from a viewpage.action URL", () => {
    expect(
      normalizeConfluencePageId(
        "https://example.atlassian.net/wiki/pages/viewpage.action?pageId=123456",
      ),
    ).toBe("123456");
  });

  test("fails fast for Confluence URLs without a page ID", () => {
    expect(() => normalizeConfluencePageId("https://example.atlassian.net/wiki/spaces/TEAM")).toThrow(
      new ConfigError(
        "Confluence page URL must contain /pages/<PAGE-ID> or ?pageId=<PAGE-ID>.",
      ),
    );
  });
});

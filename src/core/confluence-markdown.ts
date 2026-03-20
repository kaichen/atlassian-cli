import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { CliError } from "./errors.ts";

type JsonObject = Record<string, unknown>;

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.use(gfm);

const TABLE_PLACEHOLDER_PREFIX = "CONFLUENCETABLEPLACEHOLDER";

function asObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as JsonObject;
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function ensureSinglePage(data: unknown): JsonObject {
  const page = asObject(data);
  if (!page) {
    throw new CliError("Confluence page response must be an object.");
  }
  if (typeof page.id === "string") {
    return page;
  }

  const results = page.results;
  if (!Array.isArray(results)) {
    throw new CliError("Unable to resolve a single Confluence page from the response.");
  }
  if (results.length === 0) {
    throw new CliError("No page matched the provided query for --markdown.");
  }
  if (results.length > 1) {
    throw new CliError(
      `Expected exactly one page for --markdown, but found ${results.length}. Use --id or narrow the title/space.`,
    );
  }
  const first = asObject(results[0]);
  if (!first) {
    throw new CliError("Confluence page result must be an object.");
  }
  return first;
}

function extractStorageValue(page: JsonObject): string {
  const body = asObject(page.body);
  const storage = body ? asObject(body.storage) : undefined;
  const value = storage?.value;
  if (typeof value !== "string" || value.trim() === "") {
    throw new CliError(
      "Page response did not include body.storage.value. The command must request body.storage.",
    );
  }
  return value;
}

function replaceUserLinks(html: string): string {
  return html
    .replace(
      /<ac:link\b[^>]*>\s*<ri:user\b[^>]*ri:account-id="([^"]+)"[^>]*\/>\s*<ac:link-body>([\s\S]*?)<\/ac:link-body>\s*<\/ac:link>/gi,
      (_match, accountId: string, body: string) => `[${body.trim() || `user:${accountId}`}]`,
    )
    .replace(
      /<ac:link\b[^>]*>\s*<ri:user\b[^>]*ri:account-id="([^"]+)"[^>]*\/>\s*<\/ac:link>/gi,
      (_match, accountId: string) => `[user:${accountId}]`,
    );
}

function replacePageLinks(html: string): string {
  return html.replace(
    /<ac:link\b[^>]*>\s*<ri:page\b[^>]*ri:content-title="([^"]+)"[^>]*\/>\s*(?:<ac:link-body>([\s\S]*?)<\/ac:link-body>)?\s*<\/ac:link>/gi,
    (_match, title: string, body?: string) => `[${(body ?? decodeHtmlAttribute(title)).trim()}]`,
  );
}

function replaceImages(html: string): string {
  return html.replace(
    /<ac:image\b[^>]*>\s*<ri:attachment\b[^>]*ri:filename="([^"]+)"[^>]*\/>\s*<\/ac:image>/gi,
    (_match, filename: string) => `![${decodeHtmlAttribute(filename)}](attachment:${decodeHtmlAttribute(filename)})`,
  );
}

function replaceJiraMacros(html: string): string {
  return html.replace(
    /<ac:structured-macro\b[^>]*ac:name="jira"[^>]*>[\s\S]*?<ac:parameter\b[^>]*ac:name="key"[^>]*>([\s\S]*?)<\/ac:parameter>[\s\S]*?<\/ac:structured-macro>/gi,
    (_match, key: string) => `[Jira: ${normalizeWhitespace(key)}]`,
  );
}

function sanitizeStandardTagAttributes(html: string): string {
  return html.replace(/<([a-z][\w-]*)(\s[^<>]*?)?(\/?)>/gi, (match, tagName: string, rawAttrs = "", selfClosing: string) => {
    if (tagName.toLowerCase() === "a") {
      const href = rawAttrs.match(/\shref="([^"]+)"/i)?.[1];
      return href
        ? `<a href="${decodeHtmlAttribute(href)}"${selfClosing ? " /" : ""}>`
        : `<a${selfClosing ? " /" : ""}>`;
    }
    const allowedAttrs: string[] = [];
    const rowspan = rawAttrs.match(/\srowspan="([^"]+)"/i)?.[1];
    const colspan = rawAttrs.match(/\scolspan="([^"]+)"/i)?.[1];
    const start = rawAttrs.match(/\sstart="([^"]+)"/i)?.[1];
    if (rowspan) {
      allowedAttrs.push(`rowspan="${rowspan}"`);
    }
    if (colspan) {
      allowedAttrs.push(`colspan="${colspan}"`);
    }
    if (start) {
      allowedAttrs.push(`start="${start}"`);
    }
    const attrs = allowedAttrs.length > 0 ? ` ${allowedAttrs.join(" ")}` : "";
    return `<${tagName}${attrs}${selfClosing ? " /" : ""}>`;
  });
}

function normalizeConfluenceFragment(html: string): string {
  const withStructuredContent = replaceJiraMacros(
    replaceImages(replacePageLinks(replaceUserLinks(html))),
  );
  return sanitizeStandardTagAttributes(
    withStructuredContent
    .replace(/<p\b[^>]*\/>/gi, "")
    .replace(
      /<time\b[^>]*datetime="([^"]+)"[^>]*\/>/gi,
      (_match, value: string) => decodeHtmlAttribute(value),
    )
    .replace(/<ac:inline-comment-marker\b[^>]*>([\s\S]*?)<\/ac:inline-comment-marker>/gi, "$1")
    .replace(/<ac:link-body>/gi, "")
    .replace(/<\/ac:link-body>/gi, "")
    .replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter>/gi, "")
    .replace(/<ri:user\b[^>]*\/>/gi, "")
    .replace(/<ri:attachment\b[^>]*\/>/gi, "")
    .replace(/<\/?(?:ac|ri):[\w-]+\b[^>]*\/?>/gi, "")
    .replace(/<\/?span\b[^>]*>/gi, "")
    .replace(/<\/?colgroup\b[^>]*>/gi, "")
    .replace(/<\/?col\b[^>]*\/?>/gi, "")
    .replace(/<p>\s*<\/p>/gi, ""),
  );
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function normalizeTableCellMarkdown(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, ""))
    .join("<br>");
}

function extractTableRows(tableHtml: string): string[][] {
  const rows = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  return rows.map((rowMatch) => {
    const rowHtml = rowMatch[1] ?? "";
    const cells = Array.from(rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi));
    return cells.map((cellMatch) => {
      const cellHtml = normalizeConfluenceFragment(cellMatch[1] ?? "");
      const markdown = turndown.turndown(cellHtml);
      return escapeMarkdownTableCell(normalizeTableCellMarkdown(markdown));
    });
  });
}

function renderMarkdownTable(tableHtml: string): string {
  const rows = extractTableRows(tableHtml).filter((row) => row.length > 0);
  if (rows.length === 0) {
    return "";
  }
  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? ""),
  );
  const header = normalizedRows[0];
  const divider = Array.from({ length: columnCount }, () => "---");
  const body = normalizedRows.slice(1);
  return [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function extractTables(html: string): { content: string; tables: string[] } {
  const tables: string[] = [];
  const content = html.replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (tableHtml) => {
    const index = tables.push(renderMarkdownTable(tableHtml)) - 1;
    return `\n\n${TABLE_PLACEHOLDER_PREFIX}${index}\n\n`;
  });
  return { content, tables };
}

function restoreTables(markdown: string, tables: string[]): string {
  return markdown.replace(
    new RegExp(`${TABLE_PLACEHOLDER_PREFIX}(\\d+)`, "g"),
    (_match, indexText: string) => tables[Number(indexText)] ?? "",
  );
}

function cleanupMarkdown(markdown: string): string {
  return normalizeWhitespace(
    markdown
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, ""),
  );
}

function stringifyFrontmatterValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "\"\"";
  }
  return JSON.stringify(String(value));
}

function buildFrontmatter(page: JsonObject): string {
  const fields = [
    ["id", page.id],
    ["type", page.type],
    ["title", page.title],
    ["status", page.status],
  ];
  const lines = fields.map(([key, value]) => `${key}: ${stringifyFrontmatterValue(value)}`);
  return ["---", ...lines, "---"].join("\n");
}

export function ensureBodyStorageExpand(expand?: string): string {
  if (!expand) {
    return "body.storage";
  }
  const fields = expand
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  if (!fields.includes("body.storage")) {
    fields.push("body.storage");
  }
  return fields.join(",");
}

export function getPageMarkdown(data: unknown): string {
  const page = ensureSinglePage(data);
  const storage = extractStorageValue(page);
  const normalizedHtml = normalizeConfluenceFragment(storage);
  const extracted = extractTables(normalizedHtml);
  const markdown = turndown.turndown(extracted.content);
  const body = cleanupMarkdown(restoreTables(markdown, extracted.tables));
  return `${buildFrontmatter(page)}\n\n${body}`;
}

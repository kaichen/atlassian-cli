/**
 * Minimal ADF (Atlassian Document Format) to Markdown converter.
 * Handles the most common node types found in Jira issue descriptions and comments.
 */

interface AdfNode {
  type: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface AdfAttachment {
  filename: string;
  content: string; // download URL
}

/** Mutable render context threaded through all render functions. */
interface RenderCtx {
  attachments: AdfAttachment[];
  mediaIndex: number;
}

function nextAttachment(ctx: RenderCtx): AdfAttachment | undefined {
  return ctx.attachments[ctx.mediaIndex++];
}

function renderInline(node: AdfNode): string {
  if (node.type === "text") {
    let text = node.text ?? "";
    for (const mark of node.marks ?? []) {
      switch (mark.type) {
        case "strong":
          text = `**${text}**`;
          break;
        case "em":
          text = `*${text}*`;
          break;
        case "code":
          text = `\`${text}\``;
          break;
        case "strike":
          text = `~~${text}~~`;
          break;
        case "link":
          text = `[${text}](${mark.attrs?.href ?? ""})`;
          break;
      }
    }
    return text;
  }
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return (node.attrs?.text as string) ?? "";
  if (node.type === "inlineCard") return (node.attrs?.url as string) ?? "";
  if (node.type === "emoji") return (node.attrs?.shortName as string) ?? "";
  return "";
}

function renderChildren(nodes: AdfNode[] | undefined): string {
  return (nodes ?? []).map(renderInline).join("");
}

function renderBlock(node: AdfNode, ctx: RenderCtx, indent = ""): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map((child) => renderBlock(child, ctx, indent)).join("\n\n");

    case "paragraph":
      return indent + renderChildren(node.content);

    case "heading": {
      const level = Math.min(Number(node.attrs?.level ?? 1), 6);
      return "#".repeat(level) + " " + renderChildren(node.content);
    }

    case "bulletList":
      return (node.content ?? [])
        .map((item) => renderListItem(item, "- ", ctx, indent))
        .join("\n");

    case "orderedList":
      return (node.content ?? [])
        .map((item, i) => renderListItem(item, `${i + 1}. `, ctx, indent))
        .join("\n");

    case "blockquote":
      return (node.content ?? [])
        .map((child) => renderBlock(child, ctx, indent))
        .join("\n")
        .split("\n")
        .map((line) => "> " + line)
        .join("\n");

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = renderChildren(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case "rule":
      return "---";

    case "mediaSingle":
      // mediaSingle wraps a single media child — recurse so the media node consumes the attachment
      return (node.content ?? []).map((child) => renderBlock(child, ctx, indent)).join("");

    case "media": {
      const att = nextAttachment(ctx);
      if (att) return `![${att.filename}](${att.content})`;
      return `![attachment](${(node.attrs?.url as string) ?? ""})`;
    }

    case "table":
      return renderTable(node, ctx);

    default:
      if (node.content) {
        return (node.content ?? []).map((child) => renderBlock(child, ctx, indent)).join("\n\n");
      }
      return "";
  }
}

function renderListItem(node: AdfNode, prefix: string, ctx: RenderCtx, indent: string): string {
  const parts = (node.content ?? []).map((child, i) => {
    if (i === 0) return indent + prefix + renderChildren(child.content);
    return renderBlock(child, ctx, indent + "  ");
  });
  return parts.join("\n");
}

function renderTable(node: AdfNode, ctx: RenderCtx): string {
  const rows = (node.content ?? []).filter((r) => r.type === "tableRow");
  if (rows.length === 0) return "";
  const rendered = rows.map((row) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? []).map((child) => renderBlock(child, ctx)).join(" ").trim(),
    ),
  );
  const colCount = Math.max(...rendered.map((r) => r.length));
  const header = rendered[0] ?? [];
  const lines = [
    "| " + Array.from({ length: colCount }, (_, i) => header[i] ?? "").join(" | ") + " |",
    "| " + Array.from({ length: colCount }, () => "---").join(" | ") + " |",
    ...rendered.slice(1).map(
      (row) => "| " + Array.from({ length: colCount }, (_, i) => row[i] ?? "").join(" | ") + " |",
    ),
  ];
  return lines.join("\n");
}

export function adfToMarkdown(adf: unknown, attachments: AdfAttachment[] = []): string {
  if (!adf || typeof adf !== "object") return String(adf ?? "");
  const ctx: RenderCtx = { attachments, mediaIndex: 0 };
  return renderBlock(adf as AdfNode, ctx).trim();
}

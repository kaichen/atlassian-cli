import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBodyStorageExpand, getPageMarkdown } from "../core/confluence-markdown.ts";
import { ConfluenceService } from "../services/confluence.ts";
import { asObject, registerJsonTool } from "./helpers.ts";

interface ConfluenceToolOptions {
  server: McpServer;
  confluence: ConfluenceService;
  enabledTools?: Set<string>;
  readOnly: boolean;
}

const jsonValueSchema = z.unknown();

function getStorageValue(data: unknown): string | undefined {
  const page = asObject(data);
  const body = page ? asObject(page.body) : undefined;
  const storage = body ? asObject(body.storage) : undefined;
  const value = storage?.value;
  return typeof value === "string" ? value : undefined;
}

export function registerConfluenceTools(options: ConfluenceToolOptions): number {
  const { server, confluence, enabledTools, readOnly } = options;
  let count = 0;

  count += Number(registerJsonTool(server, {
    name: "confluence_search",
    title: "Search Content",
    description: "Search Confluence content using simple text or CQL.",
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
      spaces_filter: z.string().optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ query, limit, spaces_filter }) =>
      confluence.search(query, limit ?? 10, spaces_filter),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_get_page",
    title: "Get Page",
    description: "Get a Confluence page by ID or by title and space key.",
    inputSchema: {
      page_id: z.union([z.string(), z.number()]).optional(),
      title: z.string().optional(),
      space_key: z.string().optional(),
      include_metadata: z.boolean().optional(),
      convert_to_markdown: z.boolean().optional(),
      expand: z.string().optional(),
    },
    enabledTools,
    readOnly,
    handler: async ({
      page_id,
      title,
      space_key,
      include_metadata,
      convert_to_markdown,
      expand,
    }) => {
      const wantsMarkdown = convert_to_markdown ?? true;
      const effectiveExpand = wantsMarkdown ? ensureBodyStorageExpand(expand) : expand;
      const data = await confluence.getPage(
        page_id === undefined ? undefined : String(page_id),
        title,
        space_key,
        effectiveExpand,
      );
      const result: Record<string, unknown> = {};
      if (include_metadata ?? true) {
        result.metadata = data;
      }
      result.content = wantsMarkdown
        ? { format: "markdown", value: getPageMarkdown(data) }
        : { format: "storage", value: getStorageValue(data), raw: data };
      return result;
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_get_page_children",
    title: "Get Page Children",
    description: "List child pages for a Confluence page.",
    inputSchema: {
      parent_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ parent_id, limit }) => confluence.getPageChildren(parent_id, limit),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_get_comments",
    title: "Get Comments",
    description: "List comments on a Confluence page.",
    inputSchema: {
      page_id: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ page_id, limit }) => confluence.getComments(page_id, limit),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_get_labels",
    title: "Get Labels",
    description: "List labels on a Confluence page.",
    inputSchema: { page_id: z.string().min(1) },
    enabledTools,
    readOnly,
    handler: ({ page_id }) => confluence.getLabels(page_id),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_search_user",
    title: "Search User",
    description: "Search Confluence users with user CQL.",
    inputSchema: {
      cql: z.string().min(1),
      limit: z.number().int().min(1).max(100).optional(),
    },
    enabledTools,
    readOnly,
    handler: ({ cql, limit }) => confluence.searchUser(cql, limit),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_create_page",
    title: "Create Page",
    description: "Create a Confluence page.",
    inputSchema: { body: jsonValueSchema },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ body }) => confluence.createPage(body),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_update_page",
    title: "Update Page",
    description: "Update a Confluence page.",
    inputSchema: {
      page_id: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ page_id, body }) => confluence.updatePage(page_id, body),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_delete_page",
    title: "Delete Page",
    description: "Delete a Confluence page.",
    inputSchema: { page_id: z.string().min(1) },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: async ({ page_id }) => {
      await confluence.deletePage(page_id);
      return { success: true, page_id };
    },
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_add_label",
    title: "Add Label",
    description: "Add labels to a Confluence page.",
    inputSchema: {
      page_id: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ page_id, body }) => confluence.addLabel(page_id, body),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_add_comment",
    title: "Add Comment",
    description: "Add a comment to a Confluence page.",
    inputSchema: {
      page_id: z.string().min(1),
      body: jsonValueSchema,
    },
    enabledTools,
    readOnly,
    isWrite: true,
    handler: ({ page_id, body }) => confluence.addComment(page_id, body),
  }));

  count += Number(registerJsonTool(server, {
    name: "confluence_get_page_views",
    title: "Get Page Views",
    description: "Get analytics page views for a Confluence page. Cloud only.",
    inputSchema: { page_id: z.string().min(1) },
    enabledTools,
    readOnly,
    handler: ({ page_id }) => confluence.getPageViews(page_id),
  }));

  return count;
}

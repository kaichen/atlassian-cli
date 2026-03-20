import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

type JsonObject = Record<string, unknown>;

interface RegisterToolOptions<TShape extends ZodRawShapeCompat> {
  name: string;
  title: string;
  description: string;
  inputSchema: TShape;
  annotations?: ToolAnnotations;
  enabledTools?: Set<string>;
  isWrite?: boolean;
  readOnly: boolean;
  handler: (args: ShapeOutput<TShape>) => Promise<unknown>;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatToolPayload(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function buildErrorPayload(error: unknown): JsonObject {
  if (error instanceof Error) {
    const payload: JsonObject = { error: error.message };
    const maybeBody = error as Error & { body?: unknown };
    if (maybeBody.body !== undefined) {
      payload.details = maybeBody.body;
    }
    return payload;
  }
  return { error: String(error) };
}

export function registerJsonTool<TShape extends ZodRawShapeCompat>(
  server: McpServer,
  options: RegisterToolOptions<TShape>,
): boolean {
  if (options.readOnly && options.isWrite) {
    return false;
  }
  if (options.enabledTools && !options.enabledTools.has(options.name)) {
    return false;
  }

  const annotations: ToolAnnotations = {
    title: options.title,
    readOnlyHint: !options.isWrite,
    destructiveHint: Boolean(options.isWrite),
    idempotentHint: !options.isWrite,
    ...options.annotations,
  };

  const toolHandler = (async (args: ShapeOutput<TShape>) => {
    try {
      const result = await options.handler(args);
      const payload = result === undefined ? { success: true } : result;
      const successResult: CallToolResult = {
        content: [{ type: "text", text: formatToolPayload(payload) }],
      };
      return successResult;
    } catch (error) {
      const payload = buildErrorPayload(error);
      const errorResult: CallToolResult = {
        isError: true,
        content: [{ type: "text", text: formatToolPayload(payload) }],
      };
      return errorResult;
    }
  }) as any;

  server.registerTool(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: options.inputSchema,
      annotations,
    },
    toolHandler,
  );

  return true;
}

export function asObject(value: unknown): JsonObject | undefined {
  return isJsonObject(value) ? value : undefined;
}

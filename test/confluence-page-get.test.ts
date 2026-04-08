import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer } from "node:net";
import { resolveConfluenceConfig } from "../src/core/config.ts";

const repoRoot = new URL("..", import.meta.url);

const pagePayload = {
  id: "123",
  type: "page",
  title: "Example Page",
  status: "current",
  body: {
    storage: {
      value: "<h1>Heading</h1><p>Hello <strong>world</strong>.</p>",
    },
  },
};

let server: Bun.Server;
let baseUrl = "";

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a test port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function runCli(args: string[]) {
  const command = `bun run src/index.ts ${args.map(quoteShellArg).join(" ")}`;
  const proc = Bun.spawn({
    cmd: ["/bin/zsh", "-lc", command],
    cwd: repoRoot.pathname,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

beforeAll(async () => {
  const port = await getAvailablePort();
  server = Bun.serve({
    hostname: "127.0.0.1",
    port,
    fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/rest/api/content/123") {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      const expand = url.searchParams.get("expand") ?? "";
      if (!expand.split(",").map((field) => field.trim()).includes("body.storage")) {
        return new Response(JSON.stringify({ error: "body.storage required" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(pagePayload), {
        headers: { "content-type": "application/json" },
      });
    },
  });
  baseUrl = `http://127.0.0.1:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

describe("confluence page get markdown output", () => {
  test("renders a markdown document for --markdown", async () => {
    const result = await runCli([
      "confluence",
      "page",
      "get",
      "--id",
      "123",
      "--markdown",
      "--confluence-url",
      baseUrl,
      "--confluence-pat",
      "test-token",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toStartWith("---\nid: \"123\"");
    expect(result.stdout).toContain("# Heading");
    expect(result.stdout).toContain("Hello **world**.");
  });

  test("renders a markdown document for --format markdown", async () => {
    const result = await runCli([
      "--format",
      "markdown",
      "confluence",
      "page",
      "get",
      "--id",
      "123",
      "--confluence-url",
      baseUrl,
      "--confluence-pat",
      "test-token",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toStartWith("---\nid: \"123\"");
    expect(result.stdout).toContain("# Heading");
    expect(result.stdout).toContain("Hello **world**.");
  });
});

test("canonicalizes Confluence Cloud URLs to /wiki", () => {
  const config = resolveConfluenceConfig({
    confluenceUrl: "https://example.atlassian.net",
    confluenceUsername: "user@example.com",
    confluenceToken: "api-token",
  });

  expect(config?.isCloud).toBe(true);
  expect(config?.url).toBe("https://example.atlassian.net/wiki");
});

import { AuthError, HttpError } from "./errors.ts";

export interface RequestOptions {
  baseUrl: string;
  path: string;
  method: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  sslVerify: boolean;
  timeoutMs?: number;
  retries?: number;
  verbose?: boolean;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson<T>(options: RequestOptions): Promise<T> {
  const {
    baseUrl,
    path,
    method,
    headers,
    query,
    body,
    sslVerify,
    timeoutMs = 30000,
    retries = 2,
    verbose,
  } = options;

  const url = buildUrl(baseUrl, path, query);
  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };
  let payload: string | undefined;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    requestHeaders["Content-Type"] = "application/json";
  }

  const init: RequestInit & { tls?: { rejectUnauthorized?: boolean } } = {
    method,
    headers: requestHeaders,
    body: payload,
  };
  if (!sslVerify) {
    init.tls = { rejectUnauthorized: false };
  }

  let attempt = 0;
  while (true) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if (verbose) {
        process.stderr.write(`${method} ${url} -> ${response.status}\n`);
      }
      if (response.status === 401 || response.status === 403) {
        const detail = await safeReadBody(response);
        throw new AuthError(
          `Authentication failed (${response.status}). ${detail ?? "Check credentials."}`,
        );
      }
      if (!response.ok) {
        const detail = await safeReadBody(response);
        throw new HttpError(
          `Request failed (${response.status}).`,
          response.status,
          detail,
        );
      }
      const text = await response.text();
      if (!text.trim()) {
        return {} as T;
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof AuthError || error instanceof HttpError) {
        throw error;
      }
      if (attempt >= retries) {
        throw error;
      }
      const backoff = 500 * Math.pow(2, attempt);
      attempt += 1;
      await sleep(backoff);
    }
  }
}

async function safeReadBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

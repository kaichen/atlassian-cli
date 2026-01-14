import { readFileSync } from "node:fs";

const ENV_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function loadEnvFile(path: string, override = true): void {
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) {
      continue;
    }
    const match = line.match(ENV_LINE);
    if (!match) {
      continue;
    }
    const key = match[1];
    const rawValue = match[2] ?? "";
    const value = stripQuotes(rawValue);
    if (!override && process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = value;
  }
}

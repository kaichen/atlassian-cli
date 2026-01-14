import { readFileSync } from "node:fs";
import { ConfigError } from "./errors.ts";

export function parseJsonInput(raw?: string, filePath?: string): unknown | undefined {
  if (raw && filePath) {
    throw new ConfigError("Use either --body or --body-file, not both.");
  }
  if (filePath) {
    const content = readFileSync(filePath, "utf8");
    return JSON.parse(content);
  }
  if (raw) {
    return JSON.parse(raw);
  }
  return undefined;
}

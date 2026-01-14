import type { AuthType } from "./config.ts";

export interface AuthConfig {
  authType: AuthType;
  username?: string;
  apiToken?: string;
  personalToken?: string;
}

export function buildAuthHeaders(config: AuthConfig): Record<string, string> {
  if (config.authType === "basic") {
    const token = Buffer.from(`${config.username ?? ""}:${config.apiToken ?? ""}`).toString(
      "base64",
    );
    return {
      Authorization: `Basic ${token}`,
    };
  }
  return {
    Authorization: `Bearer ${config.personalToken ?? ""}`,
  };
}

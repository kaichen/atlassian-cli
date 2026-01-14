export class CliError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

export class ConfigError extends CliError {
  constructor(message: string) {
    super(message, 2);
  }
}

export class AuthError extends CliError {
  constructor(message: string) {
    super(message, 3);
  }
}

export class HttpError extends CliError {
  readonly status: number;
  readonly body?: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message, 1);
    this.status = status;
    this.body = body;
  }
}

import type { Cookie } from "playwright";

export type SecretInputSource = "env" | "file" | "stdin" | "value";

export interface SecretInputRef {
  env?: string;
  file?: string;
  stdin?: boolean;
  value?: string;
}

export interface LoadedSecret {
  source: SecretInputSource;
  value: string;
}

export interface LoginCredentials {
  username: LoadedSecret;
  password: LoadedSecret;
}

export interface LoginSelectors {
  username: string;
  password: string;
  submit?: string;
  success?: string;
}

export interface SessionState {
  cookies: Cookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export type LoginInput =
  | { kind: "session"; session: SessionState; source: SecretInputSource }
  | { kind: "credentials"; credentials: LoginCredentials };

export interface LoginAutomationOptions {
  url: string;
  input: LoginInput;
  selectors?: LoginSelectors;
  headless?: boolean;
  browser?: "chromium" | "firefox" | "webkit";
  storageStateOut?: string;
  timeoutMs?: number;
}

export interface LoginAutomationResult {
  ok: boolean;
  url: string;
  inputKind: LoginInput["kind"];
  browser: "chromium" | "firefox" | "webkit";
  storageStatePath?: string;
}

export interface CliOptions {
  url?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  successSelector?: string;
  usernameEnv?: string;
  usernameFile?: string;
  usernameStdin?: boolean;
  passwordEnv?: string;
  passwordFile?: string;
  passwordStdin?: boolean;
  sessionJsonEnv?: string;
  sessionJsonFile?: string;
  sessionJsonStdin?: boolean;
  storageStateOut?: string;
  browser?: "chromium" | "firefox" | "webkit";
  headful?: boolean;
  timeoutMs?: number;
}

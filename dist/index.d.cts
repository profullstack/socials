import { Cookie } from 'playwright';

type SecretInputSource = "env" | "file" | "stdin" | "value";
interface SecretInputRef {
    env?: string;
    file?: string;
    stdin?: boolean;
    value?: string;
}
interface LoadedSecret {
    source: SecretInputSource;
    value: string;
}
interface LoginCredentials {
    username: LoadedSecret;
    password: LoadedSecret;
}
interface LoginSelectors {
    username: string;
    password: string;
    submit?: string;
    success?: string;
}
interface SessionState {
    cookies: Cookie[];
    origins: Array<{
        origin: string;
        localStorage: Array<{
            name: string;
            value: string;
        }>;
    }>;
}
type LoginInput = {
    kind: "session";
    session: SessionState;
    source: SecretInputSource;
} | {
    kind: "credentials";
    credentials: LoginCredentials;
};
interface LoginAutomationOptions {
    url: string;
    input: LoginInput;
    selectors?: LoginSelectors;
    headless?: boolean;
    browser?: "chromium" | "firefox" | "webkit";
    storageStateOut?: string;
    timeoutMs?: number;
}
interface LoginAutomationResult {
    ok: boolean;
    url: string;
    inputKind: LoginInput["kind"];
    browser: "chromium" | "firefox" | "webkit";
    storageStatePath?: string;
}
interface CliOptions {
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

declare function runLoginAutomation(options: LoginAutomationOptions): Promise<LoginAutomationResult>;

declare function loadSecret(ref: SecretInputRef, label: string): Promise<LoadedSecret>;
declare function loadCredentials(input: {
    username: SecretInputRef;
    password: SecretInputRef;
}): Promise<LoginCredentials>;
declare function parseSessionJson(json: string): SessionState;
declare function loadSessionJson(ref: SecretInputRef): Promise<{
    source: SecretInputSource;
    session: SessionState;
}>;

declare function redactValue(input: string, secrets: Array<string | undefined>): string;
declare function redactObject<T>(value: T, secrets?: Array<string | undefined>): T;

export { type CliOptions, type LoadedSecret, type LoginAutomationOptions, type LoginAutomationResult, type LoginCredentials, type LoginInput, type LoginSelectors, type SecretInputRef, type SecretInputSource, type SessionState, loadCredentials, loadSecret, loadSessionJson, parseSessionJson, redactObject, redactValue, runLoginAutomation };

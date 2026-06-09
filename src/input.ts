import { readFile } from "node:fs/promises";
import type {
  LoadedSecret,
  LoginCredentials,
  SecretInputRef,
  SecretInputSource,
  SessionState,
} from "./types.js";

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(data));
  });
}

export async function loadSecret(ref: SecretInputRef, label: string): Promise<LoadedSecret> {
  const sources = [
    ref.env ? "env" : undefined,
    ref.file ? "file" : undefined,
    ref.stdin ? "stdin" : undefined,
    ref.value ? "value" : undefined,
  ].filter(Boolean);

  if (sources.length !== 1) {
    throw new Error(`${label} requires exactly one input source`);
  }

  if (ref.env) {
    const value = process.env[ref.env];
    if (!value) throw new Error(`${label} env var is unset or empty`);
    return { source: "env", value };
  }

  if (ref.file) {
    const value = (await readFile(ref.file, "utf8")).trim();
    if (!value) throw new Error(`${label} file is empty`);
    return { source: "file", value };
  }

  if (ref.stdin) {
    const value = (await readStdin()).trim();
    if (!value) throw new Error(`${label} stdin is empty`);
    return { source: "stdin", value };
  }

  return { source: "value", value: ref.value ?? "" };
}

export async function loadCredentials(input: {
  username: SecretInputRef;
  password: SecretInputRef;
}): Promise<LoginCredentials> {
  return {
    username: await loadSecret(input.username, "username"),
    password: await loadSecret(input.password, "password"),
  };
}

export function parseSessionJson(json: string): SessionState {
  const parsed = JSON.parse(json) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("session JSON must be an object");
  }

  const state = parsed as Partial<SessionState>;
  if (state.cookies !== undefined && !Array.isArray(state.cookies)) {
    throw new Error("session JSON cookies must be an array when provided");
  }

  if (state.origins !== undefined && !Array.isArray(state.origins)) {
    throw new Error("session JSON origins must be an array when provided");
  }

  return {
    cookies: state.cookies ?? [],
    origins: (state.origins ?? []).map((origin) => ({
      origin: origin.origin,
      localStorage: origin.localStorage ?? [],
    })),
  };
}

export async function loadSessionJson(ref: SecretInputRef): Promise<{
  source: SecretInputSource;
  session: SessionState;
}> {
  const loaded = await loadSecret(ref, "session JSON");
  return {
    source: loaded.source,
    session: parseSessionJson(loaded.value),
  };
}

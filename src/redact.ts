const REDACTION = "[REDACTED]";

export function redactValue(input: string, secrets: Array<string | undefined>): string {
  return secrets
    .filter((secret): secret is string => typeof secret === "string" && secret.length > 0)
    .reduce((text, secret) => text.split(secret).join(REDACTION), input);
}

export function redactObject<T>(value: T, secrets: Array<string | undefined> = []): T {
  const secretKeys = new Set([
    "access_token",
    "authorization",
    "cookie",
    "cookies",
    "jwt",
    "localstorage",
    "password",
    "refresh_token",
    "secret",
    "session",
    "sessionid",
    "storage",
    "token",
    "value",
  ]);

  function visit(item: unknown, key?: string): unknown {
    if (typeof item === "string") {
      return redactValue(item, secrets);
    }

    if (Array.isArray(item)) {
      return item.map((entry) => visit(entry));
    }

    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item).map(([entryKey, entryValue]) => {
          const normalized = entryKey.toLowerCase();
          if (secretKeys.has(normalized) || normalized.includes("token")) {
            return [entryKey, REDACTION];
          }
          return [entryKey, visit(entryValue, entryKey)];
        }),
      );
    }

    return item;
  }

  return visit(value) as T;
}

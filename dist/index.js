// src/automation.ts
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { chromium, firefox, webkit } from "playwright";
function getBrowser(name) {
  switch (name) {
    case "firefox":
      return firefox;
    case "webkit":
      return webkit;
    default:
      return chromium;
  }
}
async function runLoginAutomation(options) {
  if (!options.url) throw new Error("url is required");
  const browserName = options.browser ?? "chromium";
  const browser = await getBrowser(browserName).launch({
    headless: options.headless ?? true
  });
  try {
    const context = options.input.kind === "session" ? await browser.newContext({ storageState: options.input.session }) : await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs ?? 3e4);
    await page.goto(options.url, { waitUntil: "domcontentloaded" });
    if (options.input.kind === "credentials") {
      const selectors = options.selectors;
      if (!selectors?.username || !selectors.password) {
        throw new Error("username and password selectors are required for credential login");
      }
      await page.fill(selectors.username, options.input.credentials.username.value);
      await page.fill(selectors.password, options.input.credentials.password.value);
      if (selectors.submit) {
        await Promise.all([
          page.waitForLoadState("domcontentloaded").catch(() => void 0),
          page.click(selectors.submit)
        ]);
      } else {
        await page.keyboard.press("Enter");
      }
      if (selectors.success) {
        await page.waitForSelector(selectors.success);
      } else {
        await page.waitForLoadState("networkidle").catch(() => void 0);
      }
    }
    if (options.storageStateOut) {
      await mkdir(dirname(options.storageStateOut), { recursive: true });
      const state = await context.storageState();
      await writeFile(options.storageStateOut, JSON.stringify(state, null, 2), {
        mode: 384
      });
    }
    return {
      ok: true,
      url: page.url(),
      inputKind: options.input.kind,
      browser: browserName,
      storageStatePath: options.storageStateOut
    };
  } finally {
    await browser.close();
  }
}

// src/input.ts
import { readFile } from "fs/promises";
function readStdin() {
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
async function loadSecret(ref, label) {
  const sources = [
    ref.env ? "env" : void 0,
    ref.file ? "file" : void 0,
    ref.stdin ? "stdin" : void 0,
    ref.value ? "value" : void 0
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
async function loadCredentials(input) {
  return {
    username: await loadSecret(input.username, "username"),
    password: await loadSecret(input.password, "password")
  };
}
function parseSessionJson(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("session JSON must be an object");
  }
  const state = parsed;
  if (state.cookies !== void 0 && !Array.isArray(state.cookies)) {
    throw new Error("session JSON cookies must be an array when provided");
  }
  if (state.origins !== void 0 && !Array.isArray(state.origins)) {
    throw new Error("session JSON origins must be an array when provided");
  }
  return {
    cookies: state.cookies ?? [],
    origins: (state.origins ?? []).map((origin) => ({
      origin: origin.origin,
      localStorage: origin.localStorage ?? []
    }))
  };
}
async function loadSessionJson(ref) {
  const loaded = await loadSecret(ref, "session JSON");
  return {
    source: loaded.source,
    session: parseSessionJson(loaded.value)
  };
}

// src/redact.ts
var REDACTION = "[REDACTED]";
function redactValue(input, secrets) {
  return secrets.filter((secret) => typeof secret === "string" && secret.length > 0).reduce((text, secret) => text.split(secret).join(REDACTION), input);
}
function redactObject(value, secrets = []) {
  const secretKeys = /* @__PURE__ */ new Set([
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
    "value"
  ]);
  function visit(item, key) {
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
        })
      );
    }
    return item;
  }
  return visit(value);
}
export {
  loadCredentials,
  loadSecret,
  loadSessionJson,
  parseSessionJson,
  redactObject,
  redactValue,
  runLoginAutomation
};
//# sourceMappingURL=index.js.map
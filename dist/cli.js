#!/usr/bin/env node

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

// src/cli.ts
var help = `@profullstack/socials

Usage:
  socials login --url <url> --session-json-file <path> [--storage-state-out <path>]
  socials login --url <url> --session-json-stdin [--storage-state-out <path>]
  socials login --url <url> --username-env <name> --password-env <name> \\
    --username-selector <selector> --password-selector <selector> [--submit-selector <selector>]

Secret inputs:
  --session-json-env <name>     Read Playwright storage-state JSON from an env var
  --session-json-file <path>    Read Playwright storage-state JSON from a file
  --session-json-stdin          Read Playwright storage-state JSON from stdin
  --username-env <name>         Read username from an env var
  --username-file <path>        Read username from a file
  --username-stdin              Read username from stdin
  --password-env <name>         Read password from an env var
  --password-file <path>        Read password from a file
  --password-stdin              Read password from stdin

Options:
  --browser <name>              chromium, firefox, or webkit (default: chromium)
  --headful                     Show the browser window
  --timeout-ms <number>         Playwright timeout in milliseconds
  --success-selector <selector> Wait for this selector after credential login

Use only with accounts you own or administer, and only where automation is
allowed by the platform terms and policies. Secret values are never printed.
`;
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  if (command === "--help" || command === "-h") {
    return { command: "help", options };
  }
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    const next = () => {
      const value = rest[++i];
      if (!value) throw new Error(`${arg} requires a value`);
      return value;
    };
    switch (arg) {
      case "--url":
        options.url = next();
        break;
      case "--username-selector":
        options.usernameSelector = next();
        break;
      case "--password-selector":
        options.passwordSelector = next();
        break;
      case "--submit-selector":
        options.submitSelector = next();
        break;
      case "--success-selector":
        options.successSelector = next();
        break;
      case "--username-env":
        options.usernameEnv = next();
        break;
      case "--username-file":
        options.usernameFile = next();
        break;
      case "--username-stdin":
        options.usernameStdin = true;
        break;
      case "--password-env":
        options.passwordEnv = next();
        break;
      case "--password-file":
        options.passwordFile = next();
        break;
      case "--password-stdin":
        options.passwordStdin = true;
        break;
      case "--session-json-env":
        options.sessionJsonEnv = next();
        break;
      case "--session-json-file":
        options.sessionJsonFile = next();
        break;
      case "--session-json-stdin":
        options.sessionJsonStdin = true;
        break;
      case "--storage-state-out":
        options.storageStateOut = next();
        break;
      case "--browser": {
        const browser = next();
        if (!["chromium", "firefox", "webkit"].includes(browser)) {
          throw new Error("--browser must be chromium, firefox, or webkit");
        }
        options.browser = browser;
        break;
      }
      case "--headful":
        options.headful = true;
        break;
      case "--timeout-ms":
        options.timeoutMs = Number(next());
        if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
          throw new Error("--timeout-ms must be a positive number");
        }
        break;
      case "--help":
      case "-h":
        return { command: "help", options };
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return { command, options };
}
async function buildAutomationOptions(options) {
  if (!options.url) throw new Error("--url is required");
  const sessionSources = [
    options.sessionJsonEnv,
    options.sessionJsonFile,
    options.sessionJsonStdin
  ].filter(Boolean);
  if (sessionSources.length > 0) {
    const { session, source } = await loadSessionJson({
      env: options.sessionJsonEnv,
      file: options.sessionJsonFile,
      stdin: options.sessionJsonStdin
    });
    return {
      url: options.url,
      input: { kind: "session", session, source },
      browser: options.browser,
      headless: !options.headful,
      storageStateOut: options.storageStateOut,
      timeoutMs: options.timeoutMs
    };
  }
  const credentials = await loadCredentials({
    username: {
      env: options.usernameEnv,
      file: options.usernameFile,
      stdin: options.usernameStdin
    },
    password: {
      env: options.passwordEnv,
      file: options.passwordFile,
      stdin: options.passwordStdin
    }
  });
  return {
    url: options.url,
    input: { kind: "credentials", credentials },
    selectors: {
      username: options.usernameSelector ?? "",
      password: options.passwordSelector ?? "",
      submit: options.submitSelector,
      success: options.successSelector
    },
    browser: options.browser,
    headless: !options.headful,
    storageStateOut: options.storageStateOut,
    timeoutMs: options.timeoutMs
  };
}
async function main(argv = process.argv.slice(2)) {
  try {
    const { command, options } = parseArgs(argv);
    if (command === "help" || !command) {
      console.log(help);
      return 0;
    }
    if (command !== "login") {
      throw new Error(`Unknown command: ${command}`);
    }
    const automationOptions = await buildAutomationOptions(options);
    const result = await runLoginAutomation(automationOptions);
    console.log(JSON.stringify(redactObject(result), null, 2));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: message }));
    return 1;
  }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: message }));
    process.exitCode = 1;
  });
}
export {
  main
};
//# sourceMappingURL=cli.js.map
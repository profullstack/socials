#!/usr/bin/env node
import { loadCredentials, loadSessionJson } from "./input.js";
import { redactObject } from "./redact.js";
import { runLoginAutomation } from "./automation.js";
import type { CliOptions, LoginAutomationOptions } from "./types.js";

const help = `@profullstack/socials

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

function parseArgs(argv: string[]): { command?: string; options: CliOptions } {
  const [command, ...rest] = argv;
  const options: CliOptions = {};

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
        options.browser = browser as CliOptions["browser"];
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

async function buildAutomationOptions(options: CliOptions): Promise<LoginAutomationOptions> {
  if (!options.url) throw new Error("--url is required");

  const sessionSources = [
    options.sessionJsonEnv,
    options.sessionJsonFile,
    options.sessionJsonStdin,
  ].filter(Boolean);

  if (sessionSources.length > 0) {
    const { session, source } = await loadSessionJson({
      env: options.sessionJsonEnv,
      file: options.sessionJsonFile,
      stdin: options.sessionJsonStdin,
    });

    return {
      url: options.url,
      input: { kind: "session", session, source },
      browser: options.browser,
      headless: !options.headful,
      storageStateOut: options.storageStateOut,
      timeoutMs: options.timeoutMs,
    };
  }

  const credentials = await loadCredentials({
    username: {
      env: options.usernameEnv,
      file: options.usernameFile,
      stdin: options.usernameStdin,
    },
    password: {
      env: options.passwordEnv,
      file: options.passwordFile,
      stdin: options.passwordStdin,
    },
  });

  return {
    url: options.url,
    input: { kind: "credentials", credentials },
    selectors: {
      username: options.usernameSelector ?? "",
      password: options.passwordSelector ?? "",
      submit: options.submitSelector,
      success: options.successSelector,
    },
    browser: options.browser,
    headless: !options.headful,
    storageStateOut: options.storageStateOut,
    timeoutMs: options.timeoutMs,
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
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
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(JSON.stringify({ ok: false, error: message }));
      process.exitCode = 1;
    });
}

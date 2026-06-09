import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium, firefox, webkit } from "playwright";
import type { BrowserType } from "playwright";
import type { LoginAutomationOptions, LoginAutomationResult } from "./types.js";

function getBrowser(name: LoginAutomationOptions["browser"]): BrowserType {
  switch (name) {
    case "firefox":
      return firefox;
    case "webkit":
      return webkit;
    default:
      return chromium;
  }
}

export async function runLoginAutomation(
  options: LoginAutomationOptions,
): Promise<LoginAutomationResult> {
  if (!options.url) throw new Error("url is required");

  const browserName = options.browser ?? "chromium";
  const browser = await getBrowser(browserName).launch({
    headless: options.headless ?? true,
  });

  try {
    const context =
      options.input.kind === "session"
        ? await browser.newContext({ storageState: options.input.session })
        : await browser.newContext();

    const page = await context.newPage();
    page.setDefaultTimeout(options.timeoutMs ?? 30_000);
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
          page.waitForLoadState("domcontentloaded").catch(() => undefined),
          page.click(selectors.submit),
        ]);
      } else {
        await page.keyboard.press("Enter");
      }

      if (selectors.success) {
        await page.waitForSelector(selectors.success);
      } else {
        await page.waitForLoadState("networkidle").catch(() => undefined);
      }
    }

    if (options.storageStateOut) {
      await mkdir(dirname(options.storageStateOut), { recursive: true });
      const state = await context.storageState();
      await writeFile(options.storageStateOut, JSON.stringify(state, null, 2), {
        mode: 0o600,
      });
    }

    return {
      ok: true,
      url: page.url(),
      inputKind: options.input.kind,
      browser: browserName,
      storageStatePath: options.storageStateOut,
    };
  } finally {
    await browser.close();
  }
}

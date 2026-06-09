# @profullstack/socials

Safe Playwright scaffolding for authorized social account login automation.

This package provides a small SDK and `socials` CLI that can start from either:

- Playwright storage-state JSON containing cookies/session state.
- Username/password inputs supplied through env vars, files, or stdin.

It is intentionally generic. It does not ship platform-specific bypasses,
credential samples, scraping recipes, or hidden flows.

## Use Policy

Use this only with accounts you own or administer. You are responsible for
following each platform's terms, automation rules, rate limits, privacy
requirements, and security policies.

The CLI never prints raw cookies, passwords, tokens, or session JSON. Prefer
short-lived secrets, keep storage-state files private, and delete them when no
longer needed.

## Install

```bash
npm i @profullstack/socials
```

Node 18+.

## CLI

Run with existing Playwright storage-state JSON:

```bash
socials login \
  --url https://social.example/account \
  --session-json-file ./private/storage-state.json \
  --storage-state-out ./private/storage-state.next.json
```

Read session JSON from stdin:

```bash
printf '%s' "$SOCIALS_SESSION_JSON" | socials login \
  --url https://social.example/account \
  --session-json-stdin
```

Run a selector-based login with secrets from env vars:

```bash
socials login \
  --url https://social.example/login \
  --username-env SOCIALS_USERNAME \
  --password-env SOCIALS_PASSWORD \
  --username-selector 'input[name="username"]' \
  --password-selector 'input[name="password"]' \
  --submit-selector 'button[type="submit"]' \
  --success-selector '[data-account-home]'
```

Secret input options:

| Input | Env | File | Stdin |
|---|---|---|---|
| Session JSON | `--session-json-env NAME` | `--session-json-file PATH` | `--session-json-stdin` |
| Username | `--username-env NAME` | `--username-file PATH` | `--username-stdin` |
| Password | `--password-env NAME` | `--password-file PATH` | `--password-stdin` |

Other options:

| Option | Description |
|---|---|
| `--browser chromium\|firefox\|webkit` | Browser engine. Defaults to `chromium`. |
| `--headful` | Show the browser window. Defaults to headless. |
| `--timeout-ms NUMBER` | Playwright timeout in milliseconds. |
| `--storage-state-out PATH` | Save updated Playwright storage state with file mode `0600`. |

## SDK

```ts
import { runLoginAutomation } from "@profullstack/socials";

await runLoginAutomation({
  url: "https://social.example/login",
  input: {
    kind: "credentials",
    credentials: {
      username: { source: "env", value: process.env.SOCIALS_USERNAME! },
      password: { source: "env", value: process.env.SOCIALS_PASSWORD! },
    },
  },
  selectors: {
    username: 'input[name="username"]',
    password: 'input[name="password"]',
    submit: 'button[type="submit"]',
    success: "[data-account-home]",
  },
  storageStateOut: "./private/storage-state.json",
});
```

`runLoginAutomation` returns status metadata only. It does not return cookies,
tokens, passwords, or storage-state content.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

## License

MIT

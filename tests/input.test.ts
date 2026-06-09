import { describe, expect, it } from "vitest";
import { parseSessionJson } from "../src/input.js";

describe("parseSessionJson", () => {
  it("accepts Playwright storage-state shape", () => {
    expect(
      parseSessionJson(
        JSON.stringify({
          cookies: [],
          origins: [{ origin: "https://example.com", localStorage: [] }],
        }),
      ),
    ).toEqual({
      cookies: [],
      origins: [{ origin: "https://example.com", localStorage: [] }],
    });
  });

  it("fills missing optional storage-state arrays", () => {
    expect(parseSessionJson("{}")).toEqual({ cookies: [], origins: [] });
  });

  it("rejects non-object JSON", () => {
    expect(() => parseSessionJson("[]")).toThrow(/object/);
  });

  it("rejects invalid cookies shape", () => {
    expect(() => parseSessionJson('{"cookies":{}}')).toThrow(/cookies/);
  });
});

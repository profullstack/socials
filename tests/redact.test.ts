import { describe, expect, it } from "vitest";
import { redactObject, redactValue } from "../src/redact.js";

describe("redaction", () => {
  it("redacts explicit secret values from strings", () => {
    expect(redactValue("token=super-secret", ["super-secret"])).toBe("token=[REDACTED]");
  });

  it("redacts common secret fields from objects", () => {
    const result = redactObject({
      ok: true,
      password: "p",
      nested: {
        access_token: "t",
        displayName: "user",
      },
    });

    expect(result).toEqual({
      ok: true,
      password: "[REDACTED]",
      nested: {
        access_token: "[REDACTED]",
        displayName: "user",
      },
    });
  });
});

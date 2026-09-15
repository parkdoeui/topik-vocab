import { describe, expect, it } from "vitest";
import { encodePasscodeForTransport } from "./api";

describe("encodePasscodeForTransport", () => {
  it("encodes a Unicode passcode into an ASCII-only header value", () => {
    const encoded = encodePasscodeForTransport("topik-한글-🔒");

    expect(encoded).toBe("v1.dG9waWst7ZWc6riALfCflJI");
    expect([...encoded].every((character) => character.charCodeAt(0) <= 127)).toBe(true);
    expect(() => new Headers({ "X-TOPIK-Passcode": encoded })).not.toThrow();
  });
});

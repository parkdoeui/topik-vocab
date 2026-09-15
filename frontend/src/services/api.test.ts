import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkAuthSession,
  encodePasscodeForTransport,
  loginWithPasscode,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("encodePasscodeForTransport", () => {
  it("encodes a Unicode passcode into an ASCII-only header value", () => {
    const encoded = encodePasscodeForTransport("topik-한글-🔒");

    expect(encoded).toBe("v1.dG9waWst7ZWc6riALfCflJI");
    expect([...encoded].every((character) => character.charCodeAt(0) <= 127)).toBe(true);
    expect(() => new Headers({ "X-TOPIK-Passcode": encoded })).not.toThrow();
  });

  it("does not attach a stale stored passcode to a login request", async () => {
    const storage = {
      getItem: vi.fn(() => "stale-code"),
      setItem: vi.fn(),
    };
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", fetchMock);

    expect(await loginWithPasscode("new-code")).toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("X-TOPIK-Passcode")).toBeNull();
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(storage.setItem).toHaveBeenCalledWith("topik_passcode", "new-code");
  });

  it("revalidates a stored passcode without an unnecessary content type", async () => {
    const storage = { getItem: vi.fn(() => "한글-🔒") };
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("fetch", fetchMock);

    expect(await checkAuthSession()).toBe(true);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("X-TOPIK-Passcode")).toBe(
      encodePasscodeForTransport("한글-🔒")
    );
    expect(headers.get("Content-Type")).toBeNull();
  });
});

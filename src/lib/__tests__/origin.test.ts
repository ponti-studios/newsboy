import { describe, expect, it } from "vitest";

import { assertSameOrigin } from "~/lib/infrastructure/origin";

describe("assertSameOrigin", () => {
  it("allows a matching Origin", () => {
    const request = new Request("https://labs.ponti.io/admin", {
      method: "POST",
      headers: { Origin: "https://labs.ponti.io" },
    });
    expect(assertSameOrigin(request)).toBeNull();
  });

  it("allows a matching Origin behind a TLS-terminating proxy", () => {
    // Inside the origin server, request.url is plain http; only the
    // forwarding headers reveal the public https origin.
    const request = new Request("http://internal/admin", {
      method: "POST",
      headers: {
        Origin: "https://newsboy.ponti-studios.com",
        "x-forwarded-proto": "https, http",
        "x-forwarded-host": "newsboy.ponti-studios.com",
      },
    });
    expect(assertSameOrigin(request)).toBeNull();
  });

  it("rejects a missing or sister-origin Origin", () => {
    const url = "https://labs.ponti.io/admin";
    expect(assertSameOrigin(new Request(url, { method: "POST" }))?.status).toBe(403);
    expect(
      assertSameOrigin(
        new Request(url, { method: "POST", headers: { Origin: "https://api.ponti.io" } }),
      )?.status,
    ).toBe(403);
  });

  it("rejects a forwarded origin that does not match the Origin header", () => {
    const request = new Request("http://internal/admin", {
      method: "POST",
      headers: {
        Origin: "https://attacker.example",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "newsboy.ponti-studios.com",
      },
    });
    expect(assertSameOrigin(request)?.status).toBe(403);
  });
});
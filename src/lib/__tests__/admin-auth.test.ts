import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getHominemUserMock } = vi.hoisted(() => ({
  getHominemUserMock: vi.fn(),
}));

vi.mock("~/lib/infrastructure/hominem-auth", () => ({
  getHominemUser: getHominemUserMock,
  buildHominemLoginUrl: (returnTo: string) =>
    `https://api.ponti.io/login?next=${encodeURIComponent(returnTo)}`,
}));

import { RouterContextProvider } from "react-router";

import {
  canAccessGameAdmin,
  getGameAdminActor,
  requireGameAdmin,
  requireGameAdminMiddleware,
} from "../admin/auth";

const ORIGINAL = {
  GAME_ADMIN_EMAILS: process.env.GAME_ADMIN_EMAILS,
  NODE_ENV: process.env.NODE_ENV,
  RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
};

function adminRequest() {
  return new Request("https://newsboy.ponti.io/admin");
}

describe("requireGameAdmin", () => {
  beforeEach(() => {
    delete process.env.GAME_ADMIN_EMAILS;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.NODE_ENV = "test";
    getHominemUserMock.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("redirects a loader without a Hominem session", async () => {
    getHominemUserMock.mockResolvedValue(null);
    await expect(requireGameAdmin(adminRequest(), "loader")).rejects.toMatchObject({
      status: 302,
    });
  });

  it("throws 401 JSON for an action without a Hominem session", async () => {
    getHominemUserMock.mockResolvedValue(null);
    await expect(requireGameAdmin(adminRequest(), "action")).rejects.toMatchObject({
      status: 401,
    });
  });

  it("throws 403 when the signed-in email is off the allowlist", async () => {
    process.env.GAME_ADMIN_EMAILS = "ops@ponti.io";
    getHominemUserMock.mockResolvedValue({ id: "u1", email: "other@ponti.io" });
    await expect(requireGameAdmin(adminRequest(), "loader")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("throws 503 in production when the allowlist is missing", async () => {
    process.env.NODE_ENV = "production";
    getHominemUserMock.mockResolvedValue({ id: "u1", email: "ops@ponti.io" });
    await expect(requireGameAdmin(adminRequest(), "loader")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("throws 503 in production when the allowlist is empty", async () => {
    process.env.NODE_ENV = "production";
    process.env.GAME_ADMIN_EMAILS = ",,  ,";
    getHominemUserMock.mockResolvedValue({ id: "u1", email: "ops@ponti.io" });
    await expect(requireGameAdmin(adminRequest(), "loader")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("accepts a Hominem session in test without an allowlist", async () => {
    getHominemUserMock.mockResolvedValue({ id: "u1", email: "ops@ponti.io" });
    const result = await requireGameAdmin(adminRequest(), "loader");
    expect(result.userId).toBe("u1");
  });

  it("still requires a Hominem session in local development", async () => {
    process.env.NODE_ENV = "development";
    getHominemUserMock.mockResolvedValue(null);
    await expect(
      requireGameAdmin(new Request("http://localhost:3001/admin"), "loader"),
    ).rejects.toMatchObject({
      status: 302,
    });
  });
});

describe("canAccessGameAdmin", () => {
  beforeEach(() => {
    delete process.env.GAME_ADMIN_EMAILS;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("denies signed-out visitors", () => {
    expect(canAccessGameAdmin(null)).toBe(false);
  });

  it("permits signed-in local users when no allowlist is required", () => {
    expect(canAccessGameAdmin({ email: null })).toBe(true);
  });

  it("matches allowlisted emails without case or surrounding-space sensitivity", () => {
    process.env.GAME_ADMIN_EMAILS = "ops@ponti.io";
    expect(canAccessGameAdmin({ email: " OPS@PONTI.IO " })).toBe(true);
    expect(canAccessGameAdmin({ email: "player@ponti.io" })).toBe(false);
    expect(canAccessGameAdmin({ email: null })).toBe(false);
  });

  it("denies everyone when production requires a missing allowlist", () => {
    process.env.NODE_ENV = "production";
    expect(canAccessGameAdmin({ email: "ops@ponti.io" })).toBe(false);
  });
});

describe("requireGameAdminMiddleware", () => {
  beforeEach(() => {
    delete process.env.GAME_ADMIN_EMAILS;
    delete process.env.RAILWAY_ENVIRONMENT;
    process.env.NODE_ENV = "test";
    getHominemUserMock.mockReset();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("sets the actor on context for a GET", async () => {
    getHominemUserMock.mockResolvedValue({ id: "u1", email: "ops@ponti.io" });
    const request = adminRequest();
    const context = new RouterContextProvider();
    await requireGameAdminMiddleware(
      {
        context,
        params: {},
        pattern: "",
        request,
        url: new URL(request.url),
      },
      async () => new Response(),
    );
    expect(getGameAdminActor(context).userId).toBe("u1");
  });

  it("returns 401 JSON for a POST without a Hominem session", async () => {
    getHominemUserMock.mockResolvedValue(null);
    const request = new Request("https://newsboy.ponti.io/admin", {
      method: "POST",
    });
    const context = new RouterContextProvider();
    await expect(
      requireGameAdminMiddleware(
        {
          context,
          params: {},
          pattern: "",
          request,
          url: new URL(request.url),
        },
        async () => new Response(),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});

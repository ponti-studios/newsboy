import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { getGameUser, loginUrl } from "./auth";

type TestApi = {
  server: Server;
  url: string;
  requests: Array<{ path: string; cookie: string | undefined }>;
};

async function startAuthApi(response: { status?: number; body: unknown }): Promise<TestApi> {
  const requests: TestApi["requests"] = [];
  const server = createServer((request, responseStream) => {
    requests.push({ path: request.url ?? "", cookie: request.headers.cookie });
    responseStream.writeHead(response.status ?? 200, { "content-type": "application/json" });
    responseStream.end(JSON.stringify(response.body));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("auth test server did not start");
  return { server, url: `http://127.0.0.1:${address.port}`, requests };
}

async function stopAuthApi(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

const envOriginal = Object.freeze({
  HOMINEM_API_URL: process.env.HOMINEM_API_URL,
  HOMINEM_INTERNAL_API_URL: process.env.HOMINEM_INTERNAL_API_URL,
  NEWSBOY_APP_URL: process.env.NEWSBOY_APP_URL,
  PORTLESS_URL: process.env.PORTLESS_URL,
  NODE_ENV: process.env.NODE_ENV,
});

afterEach(() => {
  if (envOriginal.HOMINEM_API_URL === undefined) delete process.env.HOMINEM_API_URL;
  else process.env.HOMINEM_API_URL = envOriginal.HOMINEM_API_URL;
  if (envOriginal.HOMINEM_INTERNAL_API_URL === undefined)
    delete process.env.HOMINEM_INTERNAL_API_URL;
  else process.env.HOMINEM_INTERNAL_API_URL = envOriginal.HOMINEM_INTERNAL_API_URL;
  if (envOriginal.NEWSBOY_APP_URL === undefined) delete process.env.NEWSBOY_APP_URL;
  else process.env.NEWSBOY_APP_URL = envOriginal.NEWSBOY_APP_URL;
  if (envOriginal.PORTLESS_URL === undefined) delete process.env.PORTLESS_URL;
  else process.env.PORTLESS_URL = envOriginal.PORTLESS_URL;
  if (envOriginal.NODE_ENV === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = envOriginal.NODE_ENV;
});

describe("Game ↔ Hominem authentication boundary", () => {
  it("forwards the browser session cookie to Hominem and returns the authenticated user", async () => {
    const api = await startAuthApi({
      body: {
        session: { id: "session-1" },
        user: { id: "user-1", email: "player@example.com" },
      },
    });
    process.env.HOMINEM_INTERNAL_API_URL = api.url;
    process.env.HOMINEM_API_URL = "https://api.ponti.io";

    try {
      await expect(
        getGameUser(
          new Request("https://game.ponti.io/", {
            headers: { cookie: "better-auth.session_token=test" },
          }),
        ),
      ).resolves.toEqual({ id: "user-1", email: "player@example.com" });
      expect(api.requests).toEqual([
        { path: "/api/auth/get-session", cookie: "better-auth.session_token=test" },
      ]);
    } finally {
      await stopAuthApi(api.server);
    }
  });

  it("fails closed when Hominem reports no session", async () => {
    const api = await startAuthApi({ body: { session: null, user: null } });
    process.env.HOMINEM_INTERNAL_API_URL = api.url;

    try {
      await expect(getGameUser(new Request("https://game.ponti.io/"))).resolves.toBeNull();
    } finally {
      await stopAuthApi(api.server);
    }
  });

  it("uses NEWSBOY_APP_URL for the login return target while keeping the API public URL", async () => {
    process.env.HOMINEM_API_URL = "https://api.ponti.io";
    process.env.NEWSBOY_APP_URL = "https://newsboy.ponti.io";

    const url = new URL(
      loginUrl(new Request("http://internal:3000/reality"), "https://internal:3000/reality"),
    );
    expect(url.origin).toBe("https://api.ponti.io");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("next")).toBe("https://newsboy.ponti.io/reality");
  });

  it("uses the portless worktree URL for the login return target", async () => {
    process.env.HOMINEM_API_URL = "https://api.ponti.io";
    process.env.NEWSBOY_APP_URL = "https://newsboy.lvh.me";
    process.env.PORTLESS_URL = "https://feature-fix.lvh.me";

    const url = new URL(loginUrl(new Request("https://feature-fix.lvh.me/reality")));
    expect(url.searchParams.get("next")).toBe("https://feature-fix.lvh.me/reality");
  });

  it("normalizes React Router data URLs and drops timezone query parameters", () => {
    process.env.HOMINEM_API_URL = "https://api.ponti.io";
    process.env.NEWSBOY_APP_URL = "http://localhost:5173";

    const url = new URL(
      loginUrl(
        new Request("http://localhost:5173/reality.data?tz=America%2FLos_Angeles"),
        "http://localhost:5173/reality.data?tz=America%2FLos_Angeles",
      ),
    );

    expect(url.searchParams.get("next")).toBe("http://localhost:5173/reality");
  });

  it("keeps localhost requests on their local origin for the login return target", () => {
    process.env.HOMINEM_API_URL = "http://localhost:4040";
    process.env.NODE_ENV = "development";
    process.env.NEWSBOY_APP_URL = "https://newsboy.lvh.me";
    process.env.PORTLESS_URL = "https://feature-fix.lvh.me";

    const url = new URL(loginUrl(new Request("http://localhost:4944/admin/generate?game=reality")));

    expect(url.origin).toBe("https://api.lvh.me");
    expect(url.searchParams.get("next")).toBe("http://localhost:4944/admin/generate?game=reality");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TEXT_MODEL, formatAiError, getConfiguredTextModel } from "./index";

describe("text model resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to Gemma 3 27B", () => {
    expect(DEFAULT_TEXT_MODEL).toBe("openai/gpt-5-mini");
  });

  it("uses NEWSBOY_AI_MODEL when set", () => {
    vi.stubEnv("NEWSBOY_AI_MODEL", "google/gemini-3.1-flash-lite");
    expect(getConfiguredTextModel()).toBe("google/gemini-3.1-flash-lite");
  });
});

describe("AI provider error formatting", () => {
  it("preserves provider status, code, message, body, and safe headers", () => {
    const error = Object.assign(new Error("Provider returned error"), {
      name: "BadRequestResponseError",
      statusCode: 400,
      body: JSON.stringify({
        error: { code: 1234, message: "Invalid response_format", type: "invalid_request" },
        request: "must not be persisted",
      }),
      headers: new Headers({
        "x-request-id": "req_test_123",
        "retry-after": "7",
        authorization: "secret",
      }),
    });

    expect(formatAiError(error)).toBe(
      'BadRequestResponseError | Provider returned error | status=400 | provider_code=1234 | provider_message=Invalid response_format | body={"code":1234,"message":"Invalid response_format","type":"invalid_request"} | x-request-id=req_test_123 | retry-after=7',
    );
    expect(formatAiError(error)).not.toContain("secret");
    expect(formatAiError(error)).not.toContain("must not be persisted");
  });

  it("formats ordinary errors without inventing provider details", () => {
    expect(formatAiError(new Error("network timeout"))).toBe("Error | network timeout");
  });

  it("falls back safely when the provider error shape is invalid", () => {
    const error = Object.assign(new Error("Provider returned error"), {
      body: JSON.stringify({ error: "unexpected provider payload" }),
    });

    expect(formatAiError(error)).toBe(
      "Error | Provider returned error | body=[unrecognized provider response body]",
    );
    expect(formatAiError(error)).not.toContain("unexpected provider payload");
  });
});

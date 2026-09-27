import { describe, expect, it } from "vitest";

import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  readTimeZoneCookie,
  resolveTimeZone,
  TIME_ZONE_COOKIE,
} from "../puzzle/timezone";

describe("timezone utilities", () => {
  it("accepts valid IANA timezone names and rejects invalid values", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Not/A-Timezone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("reads and decodes a valid timezone cookie", () => {
    expect(readTimeZoneCookie(`other=value; ${TIME_ZONE_COOKIE}=America%2FNew_York`)).toBe(
      "America/New_York",
    );
  });

  it.each([
    undefined,
    null,
    "",
    "other=value",
    `${TIME_ZONE_COOKIE}=Not%2FA%20Timezone`,
    `${TIME_ZONE_COOKIE}=%ZZ`,
  ])("returns null for an absent or invalid cookie: %s", (cookieHeader) => {
    expect(readTimeZoneCookie(cookieHeader)).toBeNull();
  });

  it("uses the first matching cookie and ignores similarly prefixed names", () => {
    expect(readTimeZoneCookie(`x${TIME_ZONE_COOKIE}=bad; ${TIME_ZONE_COOKIE}=Asia%2FTokyo`)).toBe(
      "Asia/Tokyo",
    );
    expect(readTimeZoneCookie(`${TIME_ZONE_COOKIE}=UTC; ${TIME_ZONE_COOKIE}=Asia%2FTokyo`)).toBe(
      "UTC",
    );
  });

  it("falls back to UTC for server resolution when the client value is unusable", () => {
    expect(resolveTimeZone(`${TIME_ZONE_COOKIE}=America%2FChicago`)).toBe("America/Chicago");
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(`${TIME_ZONE_COOKIE}=%ZZ`)).toBe(DEFAULT_TIME_ZONE);
  });

  it("does not read the retired What cookie namespace", () => {
    expect(readTimeZoneCookie("what_timezone=America%2FNew_York")).toBeNull();
    expect(resolveTimeZone("what_timezone=America%2FNew_York")).toBe(DEFAULT_TIME_ZONE);
  });
});

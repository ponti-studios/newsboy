import { describe, expect, it } from "vitest";

import {
  addDaysToDateKey,
  buildDateRange,
  dateKeyToLocalDate,
  daysBetweenDateKeys,
  getDateKey,
  isDateKey,
  localDateToDateKey,
  parseDate,
} from "../puzzle/date";

describe("date keys", () => {
  it.each([
    ["2026-08-20", true],
    ["2028-02-29", true],
    ["2026-02-29", false],
    ["2026-04-31", false],
    ["2026-13-01", false],
    ["2026-8-20", false],
    ["not-a-date", false],
  ])("validates %s as %s", (value, expected) => {
    expect(isDateKey(value)).toBe(expected);
  });

  it("formats an instant using the requested timezone rather than the process timezone", () => {
    const instant = new Date("2026-08-20T01:00:00.000Z");

    expect(getDateKey(instant, "UTC")).toBe("2026-08-20");
    expect(getDateKey(instant, "America/Los_Angeles")).toBe("2026-08-19");
    expect(getDateKey(instant, "America/New_York")).toBe("2026-08-19");
    expect(getDateKey(instant, "Asia/Tokyo")).toBe("2026-08-20");
  });

  it.each([
    ["2026-03-08T09:59:59.000Z", "America/Los_Angeles", "2026-03-08"],
    ["2026-03-08T10:00:00.000Z", "America/Los_Angeles", "2026-03-08"],
    ["2026-11-01T08:59:59.000Z", "America/Los_Angeles", "2026-11-01"],
    ["2026-11-01T09:00:00.000Z", "America/Los_Angeles", "2026-11-01"],
  ])("keeps the calendar date stable across DST transitions", (instant, timeZone, expected) => {
    expect(getDateKey(new Date(instant), timeZone)).toBe(expected);
  });

  it("parses date keys at UTC midnight", () => {
    expect(parseDate("2026-08-20")?.toISOString()).toBe("2026-08-20T00:00:00.000Z");
    expect(parseDate("2026-02-30")).toBeNull();
  });

  it.each([
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2028-03-01", -1, "2028-02-29"],
    ["2026-01-01", -1, "2025-12-31"],
  ])("adds %s days by %s", (dateKey, days, expected) => {
    expect(addDaysToDateKey(dateKey, days)).toBe(expected);
  });

  it("returns null when date arithmetic receives an invalid key", () => {
    expect(addDaysToDateKey("2026-02-30", 1)).toBeNull();
  });

  it("calculates calendar-day differences without DST drift", () => {
    expect(daysBetweenDateKeys("2026-03-08", "2026-03-09")).toBe(1);
    expect(daysBetweenDateKeys("2026-11-01", "2026-11-02")).toBe(1);
    expect(daysBetweenDateKeys("2026-08-20", "2026-08-19")).toBe(-1);
    expect(daysBetweenDateKeys("2026-02-30", "2026-03-01")).toBeNull();
  });

  it("builds exact and inclusive date ranges", () => {
    expect(buildDateRange("2026-02-27", { daysAhead: 4 })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(buildDateRange("2026-02-27", { endKey: "2026-03-01" })).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
    ]);
  });

  it("returns an empty range for malformed or reversed bounds", () => {
    expect(buildDateRange("2026-02-30", { daysAhead: 2 })).toEqual([]);
    expect(buildDateRange("2026-03-01", { endKey: "2026-02-27" })).toEqual([]);
  });

  it("round-trips date-picker calendar values without UTC shifting", () => {
    const localDate = dateKeyToLocalDate("2026-08-20");
    expect(localDate).not.toBeNull();
    expect(localDateToDateKey(localDate)).toBe("2026-08-20");
    expect(dateKeyToLocalDate("2026-02-30")).toBeNull();
    expect(localDateToDateKey(undefined)).toBeNull();
  });
});

import {
  addBangladeshDays,
  formatBangladeshDateKey,
  getBangladeshDayOfWeek,
  parseLocalDate,
  parseLocalDateEndOfDay,
  parseLocalDateTime,
} from "./app/utils/dateUtils";
import {
  interpolate,
  pointToPolylineDistance,
  timeToMinutes,
} from "./app/utils/estimate.util";

describe("dateUtils unit tests", () => {
  it("parses local date in Bangladesh timezone", () => {
    const parsed = parseLocalDate("2026-04-22");

    expect(parsed.toISOString()).toBe("2026-04-21T18:00:00.000Z");
  });

  it("parses local date-time with optional seconds", () => {
    const withoutSeconds = parseLocalDateTime("2026-04-22T09:30");
    const withSeconds = parseLocalDateTime("2026-04-22T09:30:15");

    expect(withoutSeconds.toISOString()).toBe("2026-04-22T03:30:00.000Z");
    expect(withSeconds.toISOString()).toBe("2026-04-22T03:30:15.000Z");
  });

  it("parses end-of-day for Bangladesh local date", () => {
    const parsed = parseLocalDateEndOfDay("2026-04-22");

    expect(parsed.toISOString()).toBe("2026-04-22T17:59:59.999Z");
  });

  it("formats Bangladesh date key from UTC date", () => {
    const date = new Date("2026-04-21T22:00:00.000Z");

    expect(formatBangladeshDateKey(date)).toBe("2026-04-22");
  });

  it("returns Bangladesh local day of week", () => {
    const date = new Date("2023-12-31T18:00:00.000Z");

    expect(getBangladeshDayOfWeek(date)).toBe(1);
  });

  it("adds days based on Bangladesh local calendar", () => {
    const start = parseLocalDateTime("2026-04-22T09:30");
    const shifted = addBangladeshDays(start, 2);

    expect(shifted.toISOString()).toBe("2026-04-24T03:30:00.000Z");
    expect(formatBangladeshDateKey(shifted)).toBe("2026-04-24");
  });

  it("throws on invalid input formats", () => {
    expect(() => parseLocalDate("22-04-2026")).toThrow(
      "Invalid date string: 22-04-2026",
    );
    expect(() => parseLocalDateTime("2026/04/22 09:30")).toThrow(
      "Invalid datetime string: 2026/04/22 09:30",
    );
  });
});

describe("estimate.util unit tests", () => {
  it("converts HH:mm time to total minutes", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("interpolates between two coordinates", () => {
    const result = interpolate(
      { lat: 23.8, lng: 90.4 },
      { lat: 24.0, lng: 90.6 },
      0.5,
    );

    expect(result).toEqual({ lat: 23.9, lng: 90.5 });
  });

  it("returns Infinity for empty polyline", () => {
    const distance = pointToPolylineDistance(23.8, 90.4, []);

    expect(distance).toBe(Infinity);
  });

  it("returns near-zero distance when point is on line segment", () => {
    const points = [
      { lat: 23.8, lng: 90.4 },
      { lat: 23.8, lng: 90.5 },
    ];

    const distance = pointToPolylineDistance(23.8, 90.45, points);

    expect(distance).toBeLessThan(0.1);
  });

  it("returns near-zero distance when point matches only polyline point", () => {
    const points = [{ lat: 23.8, lng: 90.4 }];

    const distance = pointToPolylineDistance(23.8, 90.4, points);

    expect(distance).toBeLessThan(0.1);
  });

  it("returns larger distance for a far-away point", () => {
    const points = [
      { lat: 23.8, lng: 90.4 },
      { lat: 23.8, lng: 90.5 },
    ];

    const distance = pointToPolylineDistance(24.0, 90.45, points);

    expect(distance).toBeGreaterThan(10000);
  });
});

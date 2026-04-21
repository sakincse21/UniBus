import {
  formatBangladeshDate,
  formatBangladeshDateTime,
  formatDateForApi,
  getBangladeshDateKey,
  parseApiDate,
} from "./dateTime";

describe("dateTime unit tests", () => {
  it("keeps raw API date keys unchanged", () => {
    expect(getBangladeshDateKey("2026-04-22")).toBe("2026-04-22");
  });

  it("parses API date as Bangladesh local midnight", () => {
    const parsed = parseApiDate("2026-04-22");

    expect(parsed.toISOString()).toBe("2026-04-21T18:00:00.000Z");
  });

  it("formats Bangladesh date as DD-MM-YYYY", () => {
    const formatted = formatBangladeshDate("2026-04-22");

    expect(formatted).toBe("22-04-2026");
  });

  it("formats Bangladesh date-time with both date and time", () => {
    const formatted = formatBangladeshDateTime("2026-04-22T09:30:00");

    expect(formatted).toContain("22-04-2026");
    expect(formatted).toMatch(/09:30/i);
  });

  it("formats JS Date for API payload", () => {
    const date = new Date(2026, 3, 22);

    expect(formatDateForApi(date)).toBe("2026-04-22");
  });
});

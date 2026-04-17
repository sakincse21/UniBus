import { getBangladeshDateKey, parseApiDate } from './dateFormatter';

describe('dateFormatter', () => {
  it('should parse YYYY-MM-DD directly as date keys', () => {
    const key = getBangladeshDateKey("2026-04-15");
    expect(key).toBe("2026-04-15");
  });

  it('should handle Date objects and return correct boundary format', () => {
    // A known timestamp to avoid local timezone variances
    const date = new Date("2026-04-15T12:00:00Z");
    const key = getBangladeshDateKey(date);
    expect(key).toBe("2026-04-15");
  });

  it('should parse API string into local Date properly', () => {
    const date = parseApiDate("2026-04-15T10:30:00");
    // Assert Date type instantiation
    expect(date instanceof Date).toBe(true);
  });
});

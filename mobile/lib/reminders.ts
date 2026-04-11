import { Platform } from "react-native";
import { IRoutineSlot } from "@/interfaces";

// ── Notification setup ────────────────────────────────────────────────────────
// Note: Full push notifications require a development build
// Expo Go does not support Android Push notifications (removed in SDK 53)

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === "web" || process.env.NODE_ENV === "development") {
      console.log(
        "Push notifications are limited in Expo Go. Use a development build for production.",
      );
      return false;
    }
    // Full implementation would use expo-notifications here
    return false;
  } catch (error) {
    console.debug(
      "Notification permissions setup skipped (Expo Go limitation)",
    );
    return false;
  }
}

// ── Calendar setup ────────────────────────────────────────────────────────────

export async function requestCalendarPermissions(): Promise<boolean> {
  try {
    const Calendar = await import("expo-calendar").catch(() => null);
    if (!Calendar) {
      console.debug("Calendar module not available");
      return false;
    }
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.debug("Calendar permissions setup skipped");
    return false;
  }
}

async function getOrCreateCalendarId(): Promise<string | null> {
  try {
    const CalendarModule = await import("expo-calendar").catch(() => null);
    if (!CalendarModule) {
      console.debug("Calendar module not available");
      return null;
    }
    const calendars = await CalendarModule.getCalendarsAsync(
      CalendarModule.EntityTypes.EVENT,
    );
    const existing = calendars.find((c: any) => c.title === "UniBus Routine");

    if (existing) return existing.id;

    if (Platform.OS === "android") {
      const defaultCalendar = calendars.find(
        (c: any) => c.accessLevel === CalendarModule.CalendarAccessLevel.OWNER,
      );
      if (!defaultCalendar) return null;

      const newCalendarId = await CalendarModule.createCalendarAsync({
        title: "UniBus Routine",
        color: "#2563eb",
        entityType: CalendarModule.EntityTypes.EVENT,
        sourceId: defaultCalendar.source.id,
        source: defaultCalendar.source,
        name: "UniBus Routine",
        ownerAccount: defaultCalendar.source.name,
        accessLevel: CalendarModule.CalendarAccessLevel.OWNER,
      });
      return newCalendarId;
    }

    // iOS
    const defaultSource = calendars.find(
      (c: any) => c.source?.type === CalendarModule.SourceType.LOCAL,
    )?.source;

    if (!defaultSource) return null;

    const newCalendarId = await CalendarModule.createCalendarAsync({
      title: "UniBus Routine",
      color: "#2563eb",
      entityType: CalendarModule.EntityTypes.EVENT,
      sourceId: defaultSource.id,
      source: defaultSource,
      name: "UniBus Routine",
      accessLevel: CalendarModule.CalendarAccessLevel.OWNER,
    });
    return newCalendarId;
  } catch (error) {
    console.debug("Error creating calendar:", error);
    return null;
  }
}

// ── Day helpers ───────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function getNextDateForDay(dayName: string): Date {
  const targetDay = DAY_MAP[dayName];
  if (targetDay === undefined) throw new Error(`Invalid day: ${dayName}`);

  const now = new Date();
  const currentDay = now.getDay();
  let daysUntil = targetDay - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntil);
  return nextDate;
}

function parseTimeToDate(date: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// ── Schedule weekly local notifications ───────────────────────────────────────

/**
 * Schedule weekly reminders for routine slots.
 * Note: Full scheduling requires a development build. This is a stub for Expo Go.
 */
export async function scheduleWeeklyReminders(
  slots: IRoutineSlot[],
): Promise<string[]> {
  console.debug(
    "Reminder scheduling not available in Expo Go. Use a development build for notifications.",
  );
  return [];
}

/**
 * Cancel all scheduled routine notifications.
 */
export async function cancelAllReminders(): Promise<void> {
  console.debug("Reminder cancellation not available in Expo Go.");
}

// ── Optional: Add to device calendar ──────────────────────────────────────────

/**
 * Create recurring calendar events for the routine.
 * Note: Full calendar integration requires a development build.
 * Returns the number of events created.
 */
export async function addRoutineToCalendar(
  slots: IRoutineSlot[],
): Promise<number> {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      console.debug("Calendar permission not granted");
      return 0;
    }

    const calendarId = await getOrCreateCalendarId();
    if (!calendarId) {
      console.debug("Could not create calendar");
      return 0;
    }

    const CalendarModule = await import("expo-calendar").catch(() => null);
    if (!CalendarModule) {
      console.debug("Calendar module not available");
      return 0;
    }

    let count = 0;

    for (const slot of slots) {
      const nextDate = getNextDateForDay(slot.day);

      if (slot.firstHalfStart) {
        const startDate = parseTimeToDate(nextDate, slot.firstHalfStart);
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2h block

        await CalendarModule.createEventAsync(calendarId, {
          title: `First Half${slot.note ? ` — ${slot.note}` : ""}`,
          startDate,
          endDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          alarms: [{ relativeOffset: -10 }], // 10 min before
          recurrenceRule: {
            frequency: CalendarModule.Frequency.WEEKLY,
            interval: 1,
          },
        });
        count++;
      }

      if (slot.secondHalfStart) {
        const startDate = parseTimeToDate(nextDate, slot.secondHalfStart);
        const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

        await CalendarModule.createEventAsync(calendarId, {
          title: `Second Half${slot.note ? ` — ${slot.note}` : ""}`,
          startDate,
          endDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          alarms: [{ relativeOffset: -10 }],
          recurrenceRule: {
            frequency: CalendarModule.Frequency.WEEKLY,
            interval: 1,
          },
        });
        count++;
      }
    }

    return count;
  } catch (error) {
    console.debug("Calendar event creation failed:", error);
    return 0;
  }
}

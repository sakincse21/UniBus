import * as Notifications from "expo-notifications";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { IRoutineSlot } from "@/interfaces";

// ── Notification setup ────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === "granted";
}

// ── Calendar setup ────────────────────────────────────────────────────────────

export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

async function getOrCreateCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  const existing = calendars.find((c) => c.title === "UniBus Routine");

  if (existing) return existing.id;

  if (Platform.OS === "android") {
    const defaultCalendar = calendars.find(
      (c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER,
    );
    if (!defaultCalendar) return null;

    const newCalendarId = await Calendar.createCalendarAsync({
      title: "UniBus Routine",
      color: "#2563eb",
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendar.source.id,
      source: defaultCalendar.source,
      name: "UniBus Routine",
      ownerAccount: defaultCalendar.source.name,
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
    return newCalendarId;
  }

  // iOS
  const defaultSource = calendars.find(
    (c) => c.source?.type === Calendar.SourceType.LOCAL,
  )?.source;

  if (!defaultSource) return null;

  const newCalendarId = await Calendar.createCalendarAsync({
    title: "UniBus Routine",
    color: "#2563eb",
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultSource.id,
    source: defaultSource,
    name: "UniBus Routine",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  return newCalendarId;
}

// ── Day helpers ───────────────────────────────────────────────────────────────

const DAY_MAP: Record<string, number> = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

function getNextDateForDay(dayName: string): Date {
  const targetDay = DAY_MAP[dayName];
  if (!targetDay) throw new Error(`Invalid day: ${dayName}`);

  const now = new Date();
  const currentDay = now.getDay() + 1; // 1=Sun..7=Sat
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
 * Cancel all existing routine notifications and schedule new weekly ones
 * for 10 minutes before each first-half and second-half start.
 */
export async function scheduleWeeklyReminders(
  slots: IRoutineSlot[],
): Promise<string[]> {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) throw new Error("Notification permission denied");

  // Cancel all existing routine notifications
  await cancelAllReminders();

  const notificationIds: string[] = [];

  for (const slot of slots) {
    if (!slot.remindersEnabled && slot.remindersEnabled !== undefined) continue;

    const dayIndex = DAY_MAP[slot.day];
    if (!dayIndex) continue;
    // expo-notifications uses 1=Sunday..7=Saturday
    const weekday = dayIndex;

    // First half reminder: 10 minutes before
    if (slot.firstHalfStart) {
      const [h, m] = slot.firstHalfStart.split(":").map(Number);
      let reminderH = h;
      let reminderM = m - 10;
      if (reminderM < 0) {
        reminderM += 60;
        reminderH -= 1;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "📚 Class Starting Soon",
          body: `Your ${slot.day} first half starts at ${slot.firstHalfStart}${slot.note ? ` — ${slot.note}` : ""}`,
          data: { type: "routine", slotDay: slot.day, half: "first" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: reminderH,
          minute: reminderM,
        },
      });
      notificationIds.push(id);
    }

    // Second half reminder: 10 minutes before
    if (slot.secondHalfStart) {
      const [h, m] = slot.secondHalfStart.split(":").map(Number);
      let reminderH = h;
      let reminderM = m - 10;
      if (reminderM < 0) {
        reminderM += 60;
        reminderH -= 1;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "📚 Afternoon Session Starting",
          body: `Your ${slot.day} second half starts at ${slot.secondHalfStart}${slot.note ? ` — ${slot.note}` : ""}`,
          data: { type: "routine", slotDay: slot.day, half: "second" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: reminderH,
          minute: reminderM,
        },
      });
      notificationIds.push(id);
    }
  }

  return notificationIds;
}

/**
 * Cancel all scheduled routine notifications.
 */
export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === "routine") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ── Optional: Add to device calendar ──────────────────────────────────────────

/**
 * Create recurring calendar events for the routine.
 * Returns the number of events created.
 */
export async function addRoutineToCalendar(
  slots: IRoutineSlot[],
): Promise<number> {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) throw new Error("Calendar permission denied");

  const calendarId = await getOrCreateCalendarId();
  if (!calendarId) throw new Error("Could not create calendar");

  let count = 0;

  for (const slot of slots) {
    const nextDate = getNextDateForDay(slot.day);

    if (slot.firstHalfStart) {
      const startDate = parseTimeToDate(nextDate, slot.firstHalfStart);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2h block

      await Calendar.createEventAsync(calendarId, {
        title: `First Half${slot.note ? ` — ${slot.note}` : ""}`,
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [{ relativeOffset: -10 }], // 10 min before
        recurrenceRule: {
          frequency: Calendar.Frequency.WEEKLY,
          interval: 1,
        },
      });
      count++;
    }

    if (slot.secondHalfStart) {
      const startDate = parseTimeToDate(nextDate, slot.secondHalfStart);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

      await Calendar.createEventAsync(calendarId, {
        title: `Second Half${slot.note ? ` — ${slot.note}` : ""}`,
        startDate,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        alarms: [{ relativeOffset: -10 }],
        recurrenceRule: {
          frequency: Calendar.Frequency.WEEKLY,
          interval: 1,
        },
      });
      count++;
    }
  }

  return count;
}

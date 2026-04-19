import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ICalendarEvent, IRoutineSlot } from "@/interfaces";
import { formatBangladeshTime } from "@/lib/dateFormatter";
import { requestNotificationPermissions as ensureNotificationPermission } from "@/lib/notifications";

export { requestNotificationPermissions } from "@/lib/notifications";

const ROUTINE_REMINDER_IDS_KEY = "@tracku_routine_reminder_ids_v1";
const CALENDAR_REMINDER_MAP_KEY = "@tracku_calendar_reminder_map_v1";

type CalendarReminderMap = Record<string, string>;

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function capitalize(word: string): string {
  if (!word) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

function parseTime(value: string): { hour: number; minute: number } | null {
  const [hour, minute] = value.split(":").map(Number);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function getWeeklyReminderTime(
  dayIndex: number,
  classStart: string,
): { weekday: number; hour: number; minute: number } | null {
  const parsed = parseTime(classStart);
  if (!parsed) return null;

  const now = new Date();
  const offset = (dayIndex - now.getDay() + 7) % 7;
  const nextOccurrence = new Date(now);
  nextOccurrence.setDate(now.getDate() + offset);
  nextOccurrence.setHours(parsed.hour, parsed.minute, 0, 0);
  nextOccurrence.setMinutes(nextOccurrence.getMinutes() - 10);

  return {
    weekday: nextOccurrence.getDay() + 1,
    hour: nextOccurrence.getHours(),
    minute: nextOccurrence.getMinutes(),
  };
}

function buildWeeklyTrigger(
  weekday: number,
  hour: number,
  minute: number,
): Notifications.WeeklyTriggerInput {
  const base: Notifications.WeeklyTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour,
    minute,
  };

  if (Platform.OS === "android") {
    return {
      ...base,
      channelId: "routine-reminders",
    };
  }

  return base;
}

async function readRoutineReminderIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(ROUTINE_REMINDER_IDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeRoutineReminderIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(ROUTINE_REMINDER_IDS_KEY, JSON.stringify(ids));
}

async function readCalendarReminderMap(): Promise<CalendarReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(CALENDAR_REMINDER_MAP_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {} as CalendarReminderMap);
  } catch {
    return {};
  }
}

async function writeCalendarReminderMap(
  map: CalendarReminderMap,
): Promise<void> {
  await AsyncStorage.setItem(CALENDAR_REMINDER_MAP_KEY, JSON.stringify(map));
}

function getCalendarReminderKey(event: ICalendarEvent): string {
  if (event.type === "notice" && event.source.noticeId) {
    return `notice:${event.source.noticeId}`;
  }

  if (
    (event.type === "personal" || event.type === "public") &&
    event.source.fixtureId
  ) {
    return `fixture:${event.source.fixtureId}`;
  }

  if (event.type === "routine" && event.source.routineId) {
    return `routine:${event.source.routineId}`;
  }

  return `${event.type}:${event.id}`;
}

// Cancel all scheduled notifications
export const cancelAllReminders = async (): Promise<void> => {
  try {
    const ids = await readRoutineReminderIds();
    await Promise.all(
      ids.map((id) =>
        Notifications.cancelScheduledNotificationAsync(id).catch(() => {}),
      ),
    );
    await writeRoutineReminderIds([]);
    console.log("Routine reminders cancelled");
  } catch (error) {
    console.error("Cancel reminders error:", error);
  }
};

// Schedule weekly reminders for routine
export const scheduleWeeklyReminders = async (
  routine: IRoutineSlot[]
): Promise<number> => {
  // Cancel existing reminders first
  await cancelAllReminders();

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return 0;

  let scheduledCount = 0;
  const scheduledIds: string[] = [];

  for (const slot of routine) {
    const targetDay = DAY_MAP[slot.day];
    if (targetDay === undefined) continue;

    const firstReminder = getWeeklyReminderTime(targetDay, slot.firstHalfStart);
    if (firstReminder) {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "📚 Class Starting Soon",
          body: `${capitalize(slot.day)} class at ${slot.firstHalfStart}${slot.note ? ` - ${slot.note}` : ""}`,
          data: { type: "routine", day: slot.day },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: buildWeeklyTrigger(
          firstReminder.weekday,
          firstReminder.hour,
          firstReminder.minute,
        ),
      });
      scheduledIds.push(identifier);
      scheduledCount++;
    }

    // Second half reminder (10 minutes before)
    if (slot.secondHalfStart) {
      const secondReminder = getWeeklyReminderTime(
        targetDay,
        slot.secondHalfStart,
      );

      if (secondReminder) {
        const identifier = await Notifications.scheduleNotificationAsync({
          content: {
            title: "📚 Afternoon Class Starting Soon",
            body: `${capitalize(slot.day)} afternoon class at ${slot.secondHalfStart}`,
            data: { type: "routine", day: slot.day },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: buildWeeklyTrigger(
            secondReminder.weekday,
            secondReminder.hour,
            secondReminder.minute,
          ),
        });
        scheduledIds.push(identifier);
        scheduledCount++;
      }
    }
  }

  await writeRoutineReminderIds(scheduledIds);
  console.log(`Scheduled ${scheduledCount} reminders`);
  return scheduledCount;
};

// Schedule single notification for notice
export const scheduleNoticeReminder = async (
  title: string,
  body: string,
  date: Date
): Promise<string | null> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;

  if (date <= new Date()) return null;

  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...(Platform.OS === "android"
      ? { channelId: "calendar-reminders" }
      : {}),
  };

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `📢 ${title}`,
      body: body,
      data: { type: "notice" },
      sound: true,
    },
    trigger,
  });

  return identifier;
};

export const sendBusTrackingRequestNotification = async (
  busId: number,
  estimate?: { lat?: number; lng?: number },
  routeId?: number | null,
): Promise<string | null> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;

  const body =
    estimate?.lat != null && estimate?.lng != null
      ? `Someone nearby requested Bus ${busId}. Estimated near ${estimate.lat.toFixed(4)}, ${estimate.lng.toFixed(4)}.`
      : `Someone nearby requested Bus ${busId}. Are you on the bus?`;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Bus ${busId} location requested`,
      body,
      data: {
        type: "bus-tracking-request",
        busId,
        routeId: routeId ?? null,
        estimate,
      },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: null,
  });

  return identifier;
};

  export const syncCalendarReminders = async (
    events: ICalendarEvent[],
  ): Promise<number> => {
    const hasPermission = await ensureNotificationPermission(false);
    if (!hasPermission) return 0;

    const now = Date.now();
    const existingMap = await readCalendarReminderMap();
    const nextMap: CalendarReminderMap = {};

    const reminderCandidates = events.filter((event) => {
      if (event.type === "routine") return false;
      if (event.isAllDay) return false;
      return true;
    });

    const desiredKeys = new Set<string>();
    let scheduledCount = 0;

    for (const event of reminderCandidates) {
      const start = new Date(event.startDateTime);
      if (!Number.isFinite(start.getTime())) continue;

      const reminderDate = new Date(start.getTime() - 15 * 60 * 1000);
      if (reminderDate.getTime() <= now) continue;

      const key = getCalendarReminderKey(event);
      desiredKeys.add(key);

      const previousId = existingMap[key];
      if (previousId) {
        await Notifications.cancelScheduledNotificationAsync(previousId).catch(
          () => {},
        );
      }

      const body = event.description?.trim()
        ? event.description
        : `Starts at ${formatBangladeshTime(start)}`;

      const trigger: Notifications.DateTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderDate,
        ...(Platform.OS === "android"
          ? { channelId: "calendar-reminders" }
          : {}),
      };

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Upcoming: ${event.title}`,
          body,
          data: {
            type: "calendar-reminder",
            eventId: event.id,
            eventType: event.type,
            source: event.source,
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      nextMap[key] = identifier;
      scheduledCount += 1;
    }

    for (const [key, notificationId] of Object.entries(existingMap)) {
      if (desiredKeys.has(key)) continue;
      await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
        () => {},
      );
    }

    await writeCalendarReminderMap(nextMap);
    return scheduledCount;
  };

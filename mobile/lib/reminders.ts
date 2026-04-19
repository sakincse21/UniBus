import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ICalendarEvent, IRoutineSlot } from "@/interfaces";
import { formatBangladeshTime } from "@/lib/dateFormatter";
import { requestNotificationPermissions as ensureNotificationPermission } from "@/lib/notifications";

export { requestNotificationPermissions } from "@/lib/notifications";

const SCHEDULED_REMINDERS_KEY = "@tracku_scheduled_reminders_v2";

interface ScheduledReminder {
  eventId: string;
  notificationId: string;
  notificationTime: number; // Unix timestamp
  eventTitle: string;
  eventType: "notice" | "routine" | "personal" | "public";
  minutesBefore: number;
}

/**
 * Schedule a reminder for a calendar event using server-calculated notification time
 * This is the primary method for scheduling all event reminders (notices, routines, personal)
 */
export const scheduleEventReminder = async (
  event: ICalendarEvent,
): Promise<boolean> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return false;

  // Skip if reminder disabled or no reminder metadata
  if (!event.reminder?.enabled) return false;

  // Use notificationTime from server (already calculated as startTime - minutesBefore)
  const notificationTime = new Date(event.reminder.notificationTime);

  // Don't schedule if already in past
  if (notificationTime <= new Date()) {
    return false;
  }

  try {
    // Schedule the notification at exact server-calculated time
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${event.title}`,
        body: getNotificationBody(event),
        data: {
          eventId: event.id,
          eventType: event.type,
          source: event.source,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationTime,
        channelId: "calendar-reminders",
      },
    });

    // Store for recovery on app restart
    await storeScheduledReminder({
      eventId: event.id,
      notificationId,
      notificationTime: notificationTime.getTime(),
      eventTitle: event.title,
      eventType: event.type,
      minutesBefore: event.reminder.minutesBefore,
    });

    return true;
  } catch (error) {
    console.error(`Failed to schedule reminder for ${event.id}:`, error);
    return false;
  }
};

/**
 * Schedule reminders for all calendar events
 * Cancels existing reminders first, then schedules all provided events
 */
export const scheduleAllEventReminders = async (
  events: ICalendarEvent[],
): Promise<{ scheduled: number; failed: number }> => {
  let scheduled = 0;
  let failed = 0;

  // Cancel existing reminders first
  await cancelAllReminders();

  for (const event of events) {
    const success = await scheduleEventReminder(event);
    if (success) {
      scheduled++;
    } else {
      failed++;
    }
  }

  console.log(`Scheduled ${scheduled} reminders, ${failed} failed`);
  return { scheduled, failed };
};

/**
 * Reschedule reminders for events that have passed their notification time
 * Called on app startup or when app comes to foreground
 */
export const rescheduleExpiredReminders = async (): Promise<number> => {
  const stored = await AsyncStorage.getItem(SCHEDULED_REMINDERS_KEY);
  if (!stored) return 0;

  try {
    const reminders: ScheduledReminder[] = JSON.parse(stored);
    const now = Date.now();
    let rescheduled = 0;

    for (const reminder of reminders) {
      // If notification time has passed and app was closed
      if (reminder.notificationTime <= now) {
        // Cancel old notification
        try {
          await Notifications.cancelScheduledNotificationAsync(
            reminder.notificationId,
          );
        } catch {}

        // For tests: log that this reminder was missed
        console.log(`Reminder missed for ${reminder.eventTitle}`);
        rescheduled++;
      }
    }

    return rescheduled;
  } catch (error) {
    console.error("Failed to reschedule expired reminders:", error);
    return 0;
  }
};

/**
 * Cancel all scheduled reminders
 * Used when logging out or clearing app data
 */
export const cancelAllReminders = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_REMINDERS_KEY);
    if (!stored) return;

    const reminders: ScheduledReminder[] = JSON.parse(stored);
    await Promise.all(
      reminders.map((r) =>
        Notifications.cancelScheduledNotificationAsync(r.notificationId).catch(
          () => {},
        ),
      ),
    );

    await AsyncStorage.removeItem(SCHEDULED_REMINDERS_KEY);
    console.log("All reminders cancelled");
  } catch (error) {
    console.error("Failed to cancel all reminders:", error);
  }
};

/**
 * Store a scheduled reminder for recovery on app restart
 */
const storeScheduledReminder = async (
  reminder: ScheduledReminder,
): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(SCHEDULED_REMINDERS_KEY);
    const reminders: ScheduledReminder[] = stored ? JSON.parse(stored) : [];

    // Remove if already exists (update case)
    const filtered = reminders.filter((r) => r.eventId !== reminder.eventId);
    filtered.push(reminder);

    await AsyncStorage.setItem(
      SCHEDULED_REMINDERS_KEY,
      JSON.stringify(filtered),
    );
  } catch (error) {
    console.error("Failed to store scheduled reminder:", error);
  }
};

/**
 * Get readable notification body based on event type
 */
const getNotificationBody = (event: ICalendarEvent): string => {
  const minutesBefore = event.reminder?.minutesBefore || 10;

  if (event.type === "notice") {
    return `${event.title} starts in ${minutesBefore} minutes`;
  }

  if (event.type === "routine") {
    const startTime = event.startTime || "soon";
    return `Class starts at ${startTime}`;
  }

  if (event.type === "personal") {
    return `${event.title} starts in ${minutesBefore} minutes`;
  }

  if (event.type === "public") {
    return `${event.title} starts in ${minutesBefore} minutes`;
  }

  return `${event.title} is coming up`;
};

/**
 * Legacy: Schedule weekly routine reminders (deprecated, kept for backwards compatibility)
 * Use scheduleAllEventReminders with calendar events instead
 */
export const scheduleWeeklyReminders = async (
  routine: IRoutineSlot[],
): Promise<number> => {
  console.warn(
    "scheduleWeeklyReminders is deprecated, use scheduleAllEventReminders with calendar events",
  );

  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return 0;

  let scheduledCount = 0;
  const now = new Date();

  const dayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  for (const slot of routine) {
    const targetDay = dayMap[slot.day];
    if (targetDay === undefined) continue;

    // Calculate next occurrence
    const today = now.getDay();
    let daysUntil = targetDay - today;
    if (daysUntil <= 0) daysUntil += 7;

    const triggerDate = new Date(now);
    triggerDate.setDate(now.getDate() + daysUntil);

    // First half reminder (10 minutes before)
    if (slot.firstHalfStart) {
      const [firstHour, firstMin] = slot.firstHalfStart
        .split(":")
        .map(Number);
      const firstReminderTime = new Date(triggerDate);
      firstReminderTime.setHours(firstHour, firstMin, 0, 0);
      firstReminderTime.setMinutes(firstReminderTime.getMinutes() - 10);

      if (firstReminderTime > now) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📚 Class Starting Soon",
              body: `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} class at ${slot.firstHalfStart}${slot.note ? ` - ${slot.note}` : ""}`,
              data: { type: "routine", day: slot.day },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: firstReminderTime,
              channelId: "routine-reminders",
            },
          });
          scheduledCount++;
        } catch (error) {
          console.error("Failed to schedule first half reminder:", error);
        }
      }
    }

    // Second half reminder (10 minutes before)
    if (slot.secondHalfStart) {
      const [secondHour, secondMin] = slot.secondHalfStart
        .split(":")
        .map(Number);
      const secondReminderTime = new Date(triggerDate);
      secondReminderTime.setHours(secondHour, secondMin, 0, 0);
      secondReminderTime.setMinutes(secondReminderTime.getMinutes() - 10);

      if (secondReminderTime > now) {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "📚 Afternoon Class Starting Soon",
              body: `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} afternoon class at ${slot.secondHalfStart}`,
              data: { type: "routine", day: slot.day },
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: secondReminderTime,
              channelId: "routine-reminders",
            },
          });
          scheduledCount++;
        } catch (error) {
          console.error("Failed to schedule second half reminder:", error);
        }
      }
    }
  }

  console.log(`Scheduled ${scheduledCount} legacy routine reminders`);
  return scheduledCount;
};

/**
 * Legacy: Schedule single notice reminder (deprecated)
 * Use scheduleEventReminder with calendar events instead
 */
export const scheduleNoticeReminder = async (
  title: string,
  body: string,
  date: Date,
): Promise<string | null> => {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) return null;

  if (date <= new Date()) return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📢 ${title}`,
        body: body,
        data: { type: "notice" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: date,
        channelId: "routine-reminders",
      },
    });

    return identifier;
  } catch (error) {
    console.error("Failed to schedule notice reminder:", error);
    return null;
  }
};

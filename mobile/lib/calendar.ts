import * as Calendar from "expo-calendar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import { ICalendarEvent, IRoutineSlot } from "@/interfaces";
import { parseApiDate } from "@/lib/dateFormatter";

const DEVICE_CALENDAR_SYNC_MAP_KEY = "@unibus_device_calendar_sync_map_v1";
let defaultCalendarId: string | null = null;

type DeviceCalendarSyncMap = Record<string, string>;

async function readSyncMap(): Promise<DeviceCalendarSyncMap> {
  try {
    const raw = await AsyncStorage.getItem(DEVICE_CALENDAR_SYNC_MAP_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce((acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {} as DeviceCalendarSyncMap);
  } catch {
    return {};
  }
}

async function writeSyncMap(map: DeviceCalendarSyncMap): Promise<void> {
  await AsyncStorage.setItem(DEVICE_CALENDAR_SYNC_MAP_KEY, JSON.stringify(map));
}

function parseTime(value?: string): { hour: number; minute: number } | null {
  if (!value) return null;

  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
}

function getSyncKey(event: ICalendarEvent): string {
  if (event.type === "notice" && event.source.noticeId) {
    return `notice:${event.source.noticeId}`;
  }

  if (event.type === "personal" && event.source.fixtureId) {
    return `personal:${event.source.fixtureId}`;
  }

  if (event.type === "routine" && event.source.routineId) {
    return `routine:${event.source.routineId}`;
  }

  return `${event.type}:${event.id}`;
}

function getEventWindow(event: ICalendarEvent): {
  startDate: Date;
  endDate: Date;
  allDay: boolean;
} {
  const startDate = parseApiDate(event.startDateTime);

  let endDate = event.endDateTime
    ? parseApiDate(event.endDateTime)
    : new Date(startDate.getTime() + 60 * 60 * 1000);

  if (event.isAllDay && !event.endDateTime) {
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  }

  if (endDate <= startDate) {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  return {
    startDate,
    endDate,
    allDay: !!event.isAllDay,
  };
}

function buildEventNotes(event: ICalendarEvent): string {
  const notes: string[] = [];

  if (event.description?.trim()) {
    notes.push(event.description.trim());
  }

  if (event.metadata?.note?.trim()) {
    notes.push(`Note: ${event.metadata.note.trim()}`);
  }

  return notes.join("\n\n");
}

export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === "granted") {
      await getDefaultCalendar();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Calendar permission error:", error);
    return false;
  }
};

const getDefaultCalendar = async (): Promise<string | null> => {
  if (defaultCalendarId) return defaultCalendarId;

  try {
    if (typeof Calendar.getDefaultCalendarAsync === "function") {
      try {
        const defaultCalendar = await Calendar.getDefaultCalendarAsync();
        if (defaultCalendar?.id) {
          defaultCalendarId = defaultCalendar.id;
          return defaultCalendar.id;
        }
      } catch {
        // Fall through to cross-platform calendar discovery.
      }
    }

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );

    const preferredCalendar =
      calendars.find((cal) => (cal as any).isPrimary === true) ||
      calendars.find((cal) => cal.source?.name === "Default") ||
      calendars.find(
        (cal) => cal.accessLevel === Calendar.CalendarAccessLevel.OWNER,
      ) ||
      calendars[0];

    if (preferredCalendar?.id) {
      defaultCalendarId = preferredCalendar.id;
      return preferredCalendar.id;
    }

    const source = calendars.find((cal) => cal.source?.id)?.source;
    if (source?.id) {
      const newCalendarId = await Calendar.createCalendarAsync({
        title: "UniBus",
        color: "#2563eb",
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: source.id,
        source,
        name: "unibus",
        ownerAccount: source.name || "unibus",
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });

      defaultCalendarId = newCalendarId;
      return newCalendarId;
    }
  } catch (error) {
    console.error("Get default calendar error:", error);
  }

  return null;
};

export const syncEventsToDefaultCalendar = async (
  events: ICalendarEvent[],
): Promise<number> => {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    return 0;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) {
    return 0;
  }

  const existingMap = await readSyncMap();
  const nextMap: DeviceCalendarSyncMap = {};
  const desiredKeys = new Set(events.map(getSyncKey));

  for (const [key, nativeEventId] of Object.entries(existingMap)) {
    if (desiredKeys.has(key)) {
      continue;
    }

    await Calendar.deleteEventAsync(nativeEventId).catch(() => {});
  }

  let syncedCount = 0;

  for (const event of events) {
    const syncKey = getSyncKey(event);
    const { startDate, endDate, allDay } = getEventWindow(event);

    const eventData = {
      title: event.title,
      notes: buildEventNotes(event),
      startDate,
      endDate,
      allDay,
      timeZone: "Asia/Dhaka",
      availability: Calendar.Availability.BUSY,
    };

    const existingNativeEventId = existingMap[syncKey];

    if (existingNativeEventId) {
      try {
        await Calendar.updateEventAsync(existingNativeEventId, eventData);
        nextMap[syncKey] = existingNativeEventId;
        syncedCount += 1;
        continue;
      } catch {
        // If the native event no longer exists, we recreate it below.
      }
    }

    try {
      const newNativeEventId = await Calendar.createEventAsync(
        calendarId,
        eventData,
      );
      nextMap[syncKey] = newNativeEventId;
      syncedCount += 1;
    } catch (error) {
      console.error("Failed to sync calendar event:", error);
    }
  }

  await writeSyncMap(nextMap);
  return syncedCount;
};

// Helper: Get existing routine events that have been synced
const getExistingRoutineEvents = async (): Promise<Map<string, string>> => {
  const syncMap = await readSyncMap();
  const routineEvents = new Map<string, string>();

  // Filter and store only routine events
  Object.entries(syncMap).forEach(([key, eventId]) => {
    if (key.startsWith("routine:")) {
      routineEvents.set(key, eventId);
    }
  });

  return routineEvents;
};

export const addRoutineToCalendar = async (
  routine: IRoutineSlot[],
): Promise<number> => {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Permission Needed",
      "Please allow calendar access to add events",
    );
    return 0;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) return 0;

  let addedCount = 0;
  const now = new Date();

  // Get existing synced routine events to avoid duplicates
  const existingRoutineEvents = await getExistingRoutineEvents();
  const syncMap = await readSyncMap();

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

    // Create a unique sync key for this routine slot
    const syncKey = `routine:slot_${slot.day}_${slot.firstHalfStart}`;

    // Check if this routine slot was already synced
    if (existingRoutineEvents.has(syncKey)) {
      // Skip if already synced (prevents duplicates on resync)
      continue;
    }

    const today = now.getDay();
    let daysUntil = targetDay - today;
    if (daysUntil <= 0) daysUntil += 7;

    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() + daysUntil);

    const firstHalf = parseTime(slot.firstHalfStart);
    const secondHalf = parseTime(slot.secondHalfStart);

    if (!firstHalf || !secondHalf) {
      continue;
    }

    const startFirst = new Date(eventDate);
    startFirst.setHours(firstHalf.hour, firstHalf.minute, 0, 0);

    const endFirst = new Date(eventDate);
    endFirst.setHours(secondHalf.hour, secondHalf.minute, 0, 0);

    if (startFirst < endFirst) {
      try {
        const eventId = await Calendar.createEventAsync(calendarId, {
          title: `Class: ${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}`,
          notes: slot.note || "Class session",
          startDate: startFirst,
          endDate: endFirst,
          alarms: [{ relativeOffset: -10 }],
          availability: Calendar.Availability.BUSY,
        });

        // Track this synced event
        syncMap[syncKey] = eventId;
        addedCount++;
      } catch (error) {
        console.error("Failed to add event:", error);
      }
    }
  }

  // Persist updated sync map
  await writeSyncMap(syncMap);
  return addedCount;
};

export const addNoticeToCalendar = async (
  title: string,
  description: string,
  eventDate: string,
  startTime?: string,
  endTime?: string,
): Promise<boolean> => {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Permission Needed",
      "Please allow calendar access to add events",
    );
    return false;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) return false;

  try {
    const date = parseApiDate(eventDate);

    let startDate: Date;
    let endDate: Date;

    if (startTime && endTime) {
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);

      startDate = new Date(date);
      startDate.setHours(startHour, startMin, 0, 0);

      endDate = new Date(date);
      endDate.setHours(endHour, endMin, 0, 0);
    } else {
      startDate = new Date(date);
      startDate.setHours(9, 0, 0, 0);
      endDate = new Date(date);
      endDate.setHours(10, 0, 0, 0);
    }

    await Calendar.createEventAsync(calendarId, {
      title: title,
      notes: description,
      startDate: startDate,
      endDate: endDate,
      alarms: [{ relativeOffset: -15 }],
      availability: Calendar.Availability.BUSY,
    });

    return true;
  } catch (error) {
    console.error("Failed to add notice to calendar:", error);
    return false;
  }
};

import * as Calendar from "expo-calendar";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ICalendarEvent, IRoutineSlot, INotice } from "@/interfaces";
import { parseApiDate } from "@/lib/dateFormatter";

const MANUAL_SYNC_MAP_KEY = "@unibus_manual_calendar_sync_map_v1";

let defaultCalendarId: string | null = null;

async function getSyncMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(MANUAL_SYNC_MAP_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

async function saveSyncMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(MANUAL_SYNC_MAP_KEY, JSON.stringify(map));
  } catch (error) {
    console.error("Failed to save sync map", error);
  }
}

export async function checkEventSyncState(eventId: string): Promise<boolean> {
  const map = await getSyncMap();
  return !!map[eventId];
}

function parseTime(value?: string): { hour: number; minute: number } | null {
  if (!value) return null;

  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  return { hour, minute };
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

export const silentRemoveEventFromCalendar = async (eventId: string): Promise<void> => {
  const map = await getSyncMap();
  const existingNativeId = map[eventId];

  if (existingNativeId) {
    try {
      await Calendar.deleteEventAsync(existingNativeId);
    } catch (error) {
      // Ignore if native deletion fails
    }
    delete map[eventId];
    await saveSyncMap(map);
  }
};

export const toggleSingleEventInCalendar = async (
  event: ICalendarEvent,
): Promise<boolean> => {
  const map = await getSyncMap();
  const existingNativeId = map[event.id];

  if (existingNativeId) {
    try {
      await Calendar.deleteEventAsync(existingNativeId);
      delete map[event.id];
      await saveSyncMap(map);
      Alert.alert("Removed", "Event successfully removed from your calendar.");
      return false; // False = no longer synced
    } catch (error) {
      console.error("Failed to remove event:", error);
      Alert.alert("Error", "Failed to remove event from your calendar. It may have already been deleted.");
      // Even if delete fails natively, let's untrack it so it isn't stuck
      delete map[event.id];
      await saveSyncMap(map);
      return false;
    }
  }

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Permission Needed",
      "Please allow calendar access to add this event to your calendar.",
    );
    return false;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) {
    Alert.alert("Error", "Could not find or create a default calendar.");
    return false;
  }

  const { startDate, endDate, allDay } = getEventWindow(event);

  try {
    const newEventId = await Calendar.createEventAsync(calendarId, {
      title: event.title,
      notes: buildEventNotes(event),
      startDate,
      endDate,
      allDay,
      timeZone: "Asia/Dhaka",
      alarms: [{ relativeOffset: -10 }], // Exactly 10 mins before
      availability: Calendar.Availability.BUSY,
    });

    map[event.id] = newEventId;
    await saveSyncMap(map);

    Alert.alert("Success", "Event successfully added to your calendar.");
    return true; // True = perfectly synced
  } catch (error) {
    console.error("Failed to add calendar event manually:", error);
    Alert.alert("Error", "Failed to add event to your calendar.");
    return false;
  }
};

export const checkNoticeSyncState = async (noticeId: number): Promise<boolean> => {
  const map = await getSyncMap();
  return !!map[`notice_${noticeId}`];
};

export const toggleNoticeInCalendar = async (
  notice: INotice,
): Promise<boolean> => {
  const map = await getSyncMap();
  const noticeKey = `notice_${notice.id}`;
  const existingNativeId = map[noticeKey];

  if (existingNativeId) {
    try {
      await Calendar.deleteEventAsync(existingNativeId);
      delete map[noticeKey];
      await saveSyncMap(map);
      Alert.alert("Removed", "Notice successfully removed from your calendar.");
      return false;
    } catch (error) {
      console.error("Failed to remove notice:", error);
      delete map[noticeKey];
      await saveSyncMap(map);
      return false;
    }
  }

  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Permission Needed",
      "Please allow calendar access to add this notice to your calendar.",
    );
    return false;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) return false;

  try {
    let startDate = new Date();
    let endDate = new Date();

    if (notice.eventDate) {
      startDate = new Date(notice.eventDate);
      endDate = new Date(notice.eventDate);

      if (notice.startTime) {
        const [startHour, startMin] = notice.startTime.split(":").map(Number);
        startDate.setHours(startHour, startMin, 0, 0);
      } else {
        startDate.setHours(9, 0, 0, 0); // Default to 9 AM
      }

      if (notice.endTime) {
        const [endHour, endMin] = notice.endTime.split(":").map(Number);
        endDate.setHours(endHour, endMin, 0, 0);
      } else {
        endDate.setHours(startDate.getHours() + 1, startDate.getMinutes(), 0, 0); // 1 hour duration
      }
    }

    const newEventId = await Calendar.createEventAsync(calendarId, {
      title: notice.title,
      notes: notice.content,
      startDate: startDate,
      endDate: endDate,
      alarms: [{ relativeOffset: -10 }],
      availability: Calendar.Availability.BUSY,
    });

    map[noticeKey] = newEventId;
    await saveSyncMap(map);

    Alert.alert("Success", "Notice successfully added to your calendar.");
    return true;
  } catch (error) {
    console.error("Failed to add notice to calendar:", error);
    Alert.alert("Error", "Failed to add notice to your calendar.");
    return false;
  }
};

const ROUTINE_SYNC_MAP_KEY = "@unibus_routine_calendar_sync_v1";

export const clearSyncedRoutinesFromCalendar = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(ROUTINE_SYNC_MAP_KEY);
    if (!raw) return;
    const eventIds: string[] = JSON.parse(raw);

    // Run deletions in parallel to greatly speed up Native Calendar cleanup
    const deletePromises = eventIds.map((eid) =>
      Calendar.deleteEventAsync(eid).catch(() => null)
    );
    await Promise.all(deletePromises);

    await AsyncStorage.removeItem(ROUTINE_SYNC_MAP_KEY);
  } catch (error) {
    console.error("Failed to clear previous routine events", error);
  }
};

export const syncRoutineToCalendar = async (
  routine: IRoutineSlot[],
  days: number,
): Promise<boolean> => {
  const hasPermission = await requestCalendarPermissions();
  if (!hasPermission) {
    Alert.alert(
      "Permission Needed",
      "Please allow calendar access to sync your routine.",
    );
    return false;
  }

  const calendarId = await getDefaultCalendar();
  if (!calendarId) {
    Alert.alert("Error", "Could not find or create a default calendar.");
    return false;
  }

  await clearSyncedRoutinesFromCalendar();

  const newNativeEventIds: string[] = [];
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

  try {
    const createPromises: Promise<string | null>[] = [];

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);
      const targetDayNum = targetDate.getDay();

      const slots = routine.filter((s) => dayMap[s.day] === targetDayNum);

      for (const slot of slots) {
        // First Half
        if (slot.firstHalfStart) {
          const parsed = parseTime(slot.firstHalfStart);
          if (parsed) {
            const startDate = new Date(targetDate);
            startDate.setHours(parsed.hour, parsed.minute, 0, 0);

            // Skip if in the past today
            if (startDate > now || i > 0) {
              const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

              const title = `Class${slot.note ? ` - ${slot.note}` : ""}`;
              const createPromise = Calendar.createEventAsync(calendarId, {
                title,
                startDate,
                endDate,
                allDay: false,
                timeZone: "Asia/Dhaka",
                alarms: [{ relativeOffset: -10 }],
                availability: Calendar.Availability.BUSY,
              }).catch(() => null);
              createPromises.push(createPromise);
            }
          }
        }

        // Second Half
        if (slot.secondHalfStart) {
          const parsed = parseTime(slot.secondHalfStart);
          if (parsed) {
            const startDate = new Date(targetDate);
            startDate.setHours(parsed.hour, parsed.minute, 0, 0);

            if (startDate > now || i > 0) {
              const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

              const title = `Afternoon Class${slot.note ? ` - ${slot.note}` : ""}`;
              const createPromise = Calendar.createEventAsync(calendarId, {
                title,
                startDate,
                endDate,
                allDay: false,
                timeZone: "Asia/Dhaka",
                alarms: [{ relativeOffset: -10 }],
                availability: Calendar.Availability.BUSY,
              }).catch(() => null);
              createPromises.push(createPromise);
            }
          }
        }
      }
    }

    const results = await Promise.all(createPromises);
    const successfullyCreatedIds = results.filter((id) => id !== null) as string[];

    if (successfullyCreatedIds.length > 0) {
      await AsyncStorage.setItem(ROUTINE_SYNC_MAP_KEY, JSON.stringify(successfullyCreatedIds));
      Alert.alert("Success", `Synced ${successfullyCreatedIds.length} classes to your calendar over the next ${days} days.`);
    } else {
      Alert.alert("Notice", "No upcoming classes found to sync for the selected duration.");
    }

    return true;
  } catch (error) {
    console.error("Failed to sync routine visually to calendar:", error);
    Alert.alert("Error", "Failed to sync some events to your calendar.");
    return false;
  }
};

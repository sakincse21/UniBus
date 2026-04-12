import * as Calendar from "expo-calendar";
import { Alert } from "react-native";
import { IRoutineSlot } from "@/interfaces";
import { parseApiDate } from "@/lib/dateFormatter";

let defaultCalendarId: string | null = null;

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
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );

    let unibusCalendar = calendars.find(
      (cal) => cal.title === "UniBus Schedule",
    );

    if (!unibusCalendar) {
      const defaultSource = calendars.find(
        (cal) => cal.source && cal.source.name === "Default",
      )?.source;

      if (defaultSource) {
        const newCalendarId = await Calendar.createCalendarAsync({
          title: "UniBus Schedule",
          color: "#2563eb",
          entityType: Calendar.EntityTypes.EVENT,
          sourceId: defaultSource.id,
          source: defaultSource,
          name: "unibus",
          ownerAccount: "unibus",
          accessLevel: Calendar.CalendarAccessLevel.OWNER,
        });
        defaultCalendarId = newCalendarId;
        return newCalendarId;
      }
    } else {
      defaultCalendarId = unibusCalendar.id;
      return unibusCalendar.id;
    }
  } catch (error) {
    console.error("Get default calendar error:", error);
  }

  return null;
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

    const today = now.getDay();
    let daysUntil = targetDay - today;
    if (daysUntil <= 0) daysUntil += 7;

    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() + daysUntil);

    const [firstHour, firstMin] = slot.firstHalfStart.split(":").map(Number);
    const [secondHour, secondMin] = slot.secondHalfStart.split(":").map(Number);

    const startFirst = new Date(eventDate);
    startFirst.setHours(firstHour, firstMin, 0, 0);

    const endFirst = new Date(eventDate);
    endFirst.setHours(secondHour, secondMin, 0, 0);

    if (startFirst < endFirst) {
      try {
        await Calendar.createEventAsync(calendarId, {
          title: `Class: ${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}`,
          notes: slot.note || "Class session",
          startDate: startFirst,
          endDate: endFirst,
          alarms: [{ relativeOffset: -10 }],
        });
        addedCount++;
      } catch (error) {
        console.error("Failed to add event:", error);
      }
    }
  }

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
    });

    return true;
  } catch (error) {
    console.error("Failed to add notice to calendar:", error);
    return false;
  }
};

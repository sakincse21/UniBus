import * as Notifications from "expo-notifications";
import { Platform, Alert } from "react-native";
import { IRoutineSlot } from "@/interfaces";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Please allow notifications to receive class reminders",
      );
      return false;
    }

    // Configure Android channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("routine-reminders", {
        name: "Class Reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#2563eb",
        enableVibrate: true,
        enableLights: true,
      });
    }

    return true;
  } catch (error) {
    console.error("Notification permission error:", error);
    return false;
  }
};

// Cancel all scheduled notifications
export const cancelAllReminders = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log("All reminders cancelled");
  } catch (error) {
    console.error("Cancel reminders error:", error);
  }
};

// Schedule weekly reminders for routine
export const scheduleWeeklyReminders = async (
  routine: IRoutineSlot[],
): Promise<number> => {
  // Cancel existing reminders first
  await cancelAllReminders();

  const hasPermission = await requestNotificationPermissions();
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
    const [firstHour, firstMin] = slot.firstHalfStart.split(":").map(Number);
    const firstReminderTime = new Date(triggerDate);
    firstReminderTime.setHours(firstHour, firstMin, 0, 0);
    firstReminderTime.setMinutes(firstReminderTime.getMinutes() - 10);

    if (firstReminderTime > now) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "📚 Class Starting Soon",
          body: `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} class at ${slot.firstHalfStart}${slot.note ? ` - ${slot.note}` : ""}`,
          data: { type: "routine", day: slot.day },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          date: firstReminderTime,
          channelId: "routine-reminders",
        },
      });
      scheduledCount++;
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
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "📚 Afternoon Class Starting Soon",
            body: `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} afternoon class at ${slot.secondHalfStart}`,
            data: { type: "routine", day: slot.day },
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: {
            date: secondReminderTime,
            channelId: "routine-reminders",
          },
        });
        scheduledCount++;
      }
    }
  }

  console.log(`Scheduled ${scheduledCount} reminders`);
  return scheduledCount;
};

// Schedule single notification for notice
export const scheduleNoticeReminder = async (
  title: string,
  body: string,
  date: Date,
): Promise<string | null> => {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return null;

  if (date <= new Date()) return null;

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: `📢 ${title}`,
      body: body,
      data: { type: "notice" },
      sound: true,
    },
    trigger: {
      date: date,
      channelId: "routine-reminders",
    },
  });

  return identifier;
};

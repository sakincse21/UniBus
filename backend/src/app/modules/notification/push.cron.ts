import cron from "node-cron";
import { AppDataSource } from "../../db/data-source";
import { Routine, DayOfWeek } from "../routine/routine.entity";
import { UserFixture } from "../calendar/calendar.entity";
import { sendPushToUsers } from "./push.service";
import { User } from "../user/user.entity";
import { In } from "typeorm";

const BANGLADESH_TZ = "Asia/Dhaka";

/**
 * Returns the day of the week in Bangladesh time (saturday, sunday, etc)
 */
function getBangladeshDay(date: Date): DayOfWeek {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGLADESH_TZ,
    weekday: "long"
  });
  return formatter.format(date).toLowerCase() as DayOfWeek;
}

/**
 * Returns time string in HH:mm format for Bangladesh timezone
 */
function getBangladeshTimeString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGLADESH_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  // Node.js implementation of 24-hour style might yield 24:xx so we fix it implicitly by letting Date shape it
  return formatter.format(date);
}

const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    // Target time is exactly 10 minutes from now
    const targetDate = new Date(now.getTime() + 10 * 60000);
    
    // 1. Check Routines
    const targetDay = getBangladeshDay(targetDate);
    const targetTimeStr = getBangladeshTimeString(targetDate);

    const routineRepo = AppDataSource.getRepository(Routine);
    
    const upcomingRoutines = await routineRepo
      .createQueryBuilder("routine")
      .innerJoinAndSelect("routine.user", "user")
      .where("routine.day = :targetDay", { targetDay })
      .andWhere("routine.remindersEnabled = :remindersEnabled", { remindersEnabled: true })
      .andWhere(
        "(routine.firstHalfStart = :targetTimeStr OR routine.secondHalfStart = :targetTimeStr)",
        { targetTimeStr }
      )
      .getMany();

    const pushPayloads: Promise<number>[] = [];

    if (upcomingRoutines.length > 0) {
      upcomingRoutines.forEach(routine => {
        if (!routine.user.pushToken) return;
        
        let routineType = "Class";
        if (routine.firstHalfStart === targetTimeStr) routineType = "First half class";
        if (routine.secondHalfStart === targetTimeStr) routineType = "Second half class";
        const noteStr = routine.note ? ` (${routine.note})` : "";

        pushPayloads.push(
          sendPushToUsers([routine.user], {
            title: "Upcoming Routine Reminder! ⏰",
            body: `Your ${routineType}${noteStr} starts in 10 minutes (${targetTimeStr}).`,
            channelId: "default"
          })
        );
      });
    }

    // 2. Check Calendar Events (UserFixture)
    const calendarRepo = AppDataSource.getRepository(UserFixture);

    // We want events whose startDateTime is within the exact minute matching targetDate
    // Set targetDate seconds to 0 and 59 for a BETWEEN clause
    const startOfMinute = new Date(targetDate);
    startOfMinute.setSeconds(0, 0);
    const endOfMinute = new Date(targetDate);
    endOfMinute.setSeconds(59, 999);

    const upcomingEvents = await calendarRepo
      .createQueryBuilder("event")
      .innerJoinAndSelect("event.user", "user")
      .where("event.startDateTime >= :startOfMinute", { startOfMinute })
      .andWhere("event.startDateTime <= :endOfMinute", { endOfMinute })
      .getMany();

    if (upcomingEvents.length > 0) {
      upcomingEvents.forEach(event => {
        if (!event.user.pushToken) return;

        pushPayloads.push(
          sendPushToUsers([event.user], {
            title: "Upcoming Event! 📅",
            body: `"${event.title}" is starting in 10 minutes.`,
            channelId: "default"
          })
        );
      });
    }

    await Promise.all(pushPayloads);

  } catch (error) {
    console.error("Error running push notification cron job:", error);
  }
};

export const startCronJobs = () => {
  // Run check exactly at second 0 every minute
  const job = cron.schedule("* * * * *", () => {
    checkAndSendReminders().catch(err => console.error(err));
  }, {
    timezone: BANGLADESH_TZ
  });
  
  job.start();
  console.log("Cron jobs started successfully.");

  return () => {
    job.stop();
  };
};

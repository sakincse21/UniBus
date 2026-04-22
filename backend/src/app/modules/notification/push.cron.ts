import cron from "node-cron";
import { AppDataSource } from "../../db/data-source";
import { Routine, DayOfWeek } from "../routine/routine.entity";
import { UserFixture } from "../calendar/calendar.entity";
import { Notice, NoticeStatus } from "../notice/notice.entity";
import { sendPushToUsers } from "./push.service";
import { User, UserRole } from "../user/user.entity";

const BANGLADESH_TZ = "Asia/Dhaka";

function getBangladeshDay(date: Date): DayOfWeek {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: BANGLADESH_TZ, weekday: "long" });
  return formatter.format(date).toLowerCase() as DayOfWeek;
}

function getBangladeshTimeString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: BANGLADESH_TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  return formatter.format(date);
}

function getBangladeshDateString(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: BANGLADESH_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === "year")?.value;
  const month = parts.find(p => p.type === "month")?.value;
  const day = parts.find(p => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

const checkAndSendReminders = async () => {
  try {
    const now = new Date();
    // Target is exactly 10 minutes from now
    const targetDate = new Date(now.getTime() + 10 * 60000);
    
    const targetDay = getBangladeshDay(targetDate);
    const targetTimeStr = getBangladeshTimeString(targetDate);
    const targetDateStr = getBangladeshDateString(targetDate);

    // Postgres time columns expect HH:mm:ss format
    const targetTimeDb = `${targetTimeStr}:00`;
    
    // For varchar columns that may have skipped leading zeros (e.g. "9:30" instead of "09:30")
    const targetTimeStrNoPad = targetTimeStr.startsWith("0") ? targetTimeStr.substring(1) : targetTimeStr;

    const pushPayloads: Promise<number>[] = [];
    const userRepo = AppDataSource.getRepository(User);

    // --- 1. Check Notices (Cross-Role Rule) ---
    const noticeRepo = AppDataSource.getRepository(Notice);
    const upcomingNotices = await noticeRepo
      .createQueryBuilder("notice")
      .leftJoinAndSelect("notice.targetBatch", "batch")
      .where("notice.status = :status", { status: NoticeStatus.APPROVED })
      .andWhere("notice.eventDate = :targetDateStr", { targetDateStr })
      .andWhere("notice.startTime = :targetTimeDb", { targetTimeDb })
      .getMany();

    if (upcomingNotices.length > 0) {
      for (const notice of upcomingNotices) {
        let usersQuery = userRepo.createQueryBuilder("user")
          .leftJoin("user.batch", "batch")
          .where("user.pushToken IS NOT NULL");

        if (!notice.forAll) {
          const conditions: string[] = [];
          const parameters: any = {};

          if (notice.forTeachers) {
            conditions.push("(user.role IN (:...teacherRoles))");
            parameters.teacherRoles = [UserRole.ADMIN, UserRole.TEACHER];
          }

          if (notice.targetBatch) {
            conditions.push("(user.role IN (:...studentRoles) AND batch.id = :batchId)");
            parameters.studentRoles = [UserRole.STUDENT, UserRole.CR];
            parameters.batchId = notice.targetBatch.id;
          }

          if (conditions.length > 0) {
            usersQuery.andWhere(`(${conditions.join(" OR ")})`, parameters);
          } else {
            continue;
          }
        } // Else if forAll is true, the query just runs for everyone with a push token

        const targetUsers = await usersQuery.getMany();

        if (targetUsers.length > 0) {
          pushPayloads.push(
            sendPushToUsers(targetUsers, {
              title: "Upcoming Notice! 📢",
              body: `"${notice.title}" starts in 10 minutes (${targetTimeStr}).`,
              channelId: "notice-updates"
            })
          );
        }
      }
    }

    // --- 2. Check Routines (Personal created events) ---
    // All roles will get their personal created events.
    const routineRepo = AppDataSource.getRepository(Routine);
    const upcomingRoutines = await routineRepo
      .createQueryBuilder("routine")
      .innerJoinAndSelect("routine.user", "user")
      .where("routine.day = :targetDay", { targetDay })
      .andWhere("routine.remindersEnabled = :remindersEnabled", { remindersEnabled: true })
      .andWhere(
        "((routine.firstHalfStart IN (:targetTimeStr, :targetTimeStrNoPad)) OR (routine.secondHalfStart IN (:targetTimeStr, :targetTimeStrNoPad)))",
        { targetTimeStr, targetTimeStrNoPad }
      )
      .getMany();

    if (upcomingRoutines.length > 0) {
      upcomingRoutines.forEach(routine => {
        if (!routine.user.pushToken) return;
        
        let routineType = "Class";
        if (routine.firstHalfStart === targetTimeStr || routine.firstHalfStart === targetTimeStrNoPad) routineType = "First half class";
        if (routine.secondHalfStart === targetTimeStr || routine.secondHalfStart === targetTimeStrNoPad) routineType = "Second half class";
        const noteStr = routine.note ? ` (${routine.note})` : "";

        pushPayloads.push(
          sendPushToUsers([routine.user], {
            title: "Upcoming Routine Reminder! ⏰",
            body: `Your ${routineType}${noteStr} starts in 10 minutes (${targetTimeStr}).`,
            channelId: "routine-reminders"
          })
        );
      });
    }

    // --- 3. Check Calendar Events (Personal UserFixtures) ---
    // All roles get personal created events.
    const calendarRepo = AppDataSource.getRepository(UserFixture);
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
            channelId: "calendar-reminders"
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
  const job = cron.schedule(
    "* * * * *",
    async () => {
      await checkAndSendReminders();
    },
    {
      timezone: BANGLADESH_TZ,
      noOverlap: true,
      name: "push-reminder-cron",
    }
  );
  
  job.start();
  console.log("Cron jobs started successfully.");

  return () => {
    job.stop();
  };
};

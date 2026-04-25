import { AppDataSource } from "../../db/data-source";
import { Notice, NoticeStatus } from "../notice/notice.entity";
import { Routine, DayOfWeek } from "../routine/routine.entity";
import { UserFixture } from "./calendar.entity";
import { User, UserRole } from "../user/user.entity";
import { parseLocalDate, parseLocalDateTime } from "../../utils/dateUtils";

export interface CalendarEvent {
  id: string;
  type: "notice" | "routine" | "personal" | "public";
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime?: Date;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  source: {
    noticeId?: number;
    routineId?: number;
    fixtureId?: number;
  };
  metadata?: {
    forAll?: boolean;
    forTeachers?: boolean;
    batchId?: number;
    batchName?: string;
    confidence?: number;
    note?: string;
    noticeContent?: string;
    createdBy?: string;
    canDelete?: boolean;
  };
  reminder?: {
    enabled: boolean;
    minutesBefore: number;
    notificationTime: string;
  };
}

// Get calendar events for the next N days based on role and visibility.
export async function getCalendarEvents(
  userId: string,
  days: number = 30,
): Promise<CalendarEvent[]> {
  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo
    .createQueryBuilder("user")
    .leftJoinAndSelect("user.batch", "batch")
    .where("user.user_id = :userId", { userId })
    .select([
      "user.user_id",
      "user.role",
      "user.email",
      "batch.id",
      "batch.name"
    ])
    .getOne();

  if (!user) {
    return [];
  }

  const now = new Date();
  // Start from the beginning of the current month so the calendar UI shows past events for the month
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);
  // Set to end of day for proper range inclusion
  endDate.setHours(23, 59, 59, 999);

  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-01`;
  const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  const events: CalendarEvent[] = [];

  // 1. Fetch approved notices with eventDate (role-filtered)
  const noticeEvents = await getNoticeEvents(user, startDateStr, endDateStr);
  events.push(...noticeEvents);

  // 2. Fetch and expand routines to daily entries (role-filtered)
  const routineEvents = await getRoutineEvents(user, startDate, endDate);
  events.push(...routineEvents);

  // 3. Fetch fixtures (owner personal fixtures + all public fixtures)
  const fixtureEvents = await getFixtureEvents(user, startDate, endDate);
  events.push(...fixtureEvents);

  // Sort by start date
  return events.sort(
    (a, b) =>
      new Date(a.startDateTime).getTime() -
      new Date(b.startDateTime).getTime(),
  );
}

// Get notice events filtered by role and batch.
async function getNoticeEvents(
  user: User,
  startDate: string,
  endDate: string,
): Promise<CalendarEvent[]> {
  const noticeRepo = AppDataSource.getRepository(Notice);

  const qb = noticeRepo
    .createQueryBuilder("notice")
    .leftJoinAndSelect("notice.targetBatch", "batch")
    .leftJoinAndSelect("notice.createdBy", "creator")
    .where("notice.status = :status", { status: NoticeStatus.APPROVED })
    .andWhere("notice.eventDate IS NOT NULL")
    .andWhere("notice.eventDate >= :startDate", { startDate })
    .andWhere("notice.eventDate <= :endDate", { endDate });

  // Role-based filtering
  if (user.role === UserRole.ADMIN) {
    // Admin sees all approved notices with events
  } else if (user.role === UserRole.TEACHER) {
    // Teachers see: forAll + forTeachers
    qb.andWhere(
      "(notice.forAll = :forAll OR notice.forTeachers = :forTeachers)",
      { forAll: true, forTeachers: true },
    );
  } else {
    // Students/CR see: forAll + their batch notices
    const batchId = user.batch?.id ?? null;

    if (batchId) {
      qb.andWhere("(notice.forAll = :forAll OR batch.id = :batchId)", {
        forAll: true,
        batchId,
      });
    } else {
      qb.andWhere("notice.forAll = :forAll", { forAll: true });
    }
  }

  const notices = await qb.getMany();

  const normalizeNoticeTime = (time?: string): string | undefined => {
    if (!time) return undefined;

    const trimmed = time.trim();
    const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);

    if (!match) {
      return undefined;
    }

    return `${match[1]}:${match[2]}:00`;
  };

  return notices.map((notice) => {
    const normalizedStartTime = normalizeNoticeTime(notice.startTime);
    const normalizedEndTime = normalizeNoticeTime(notice.endTime);
    const hasTimeRange = Boolean(normalizedStartTime);
    const startDateTime = hasTimeRange
      ? parseLocalDateTime(`${notice.eventDate!}T${normalizedStartTime!}`)
      : parseLocalDate(notice.eventDate!);
    const endDateTime = normalizedEndTime
      ? parseLocalDateTime(`${notice.eventDate!}T${normalizedEndTime!}`)
      : startDateTime; // default to start time if no end time

    const minutesBefore = 10;
    const notificationTime = new Date(startDateTime.getTime() - minutesBefore * 60000);

    return {
      id: `notice-${notice.id}`,
      type: "notice",
      title: notice.title,
      description: notice.content,
      startDateTime,
      endDateTime,
      startTime: normalizedStartTime?.slice(0, 5),
      endTime: normalizedEndTime?.slice(0, 5),
      isAllDay: !hasTimeRange,
      source: { noticeId: notice.id },
      reminder: {
        enabled: hasTimeRange, // only if start time was provided
        minutesBefore,
        notificationTime: notificationTime.toISOString(),
      },
      metadata: {
        forAll: notice.forAll,
        forTeachers: notice.forTeachers,
        batchId: notice.targetBatch?.id,
        batchName: notice.targetBatch?.name,
        noticeContent: notice.content,
        createdBy: notice.createdBy?.name,
        canDelete: canDeleteNotice(notice, user),
      },
    };
  });
}

// Expand visible routines into daily calendar events.
async function getRoutineEvents(
  user: User,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const routineRepo = AppDataSource.getRepository(Routine);
  const userRepo = AppDataSource.getRepository(User);

  // Get the user's own routines (all roles see their own)
  const ownRoutines = await routineRepo.find({
    where: { user: { user_id: user.user_id }, confirmed: true },
  });

  const events: CalendarEvent[] = [];

  // Expand user's own routines to calendar entries
  const expandedOwn = expandRoutinesToCalendarEvents(
    ownRoutines,
    startDate,
    endDate,
    "routine",
  );
  events.push(...expandedOwn);

  // Teachers see routines from their batch students
  if (user.role === UserRole.TEACHER) {
    const batchId = user.batch?.id;
    if (batchId) {
      const batchRoutines = await routineRepo
        .createQueryBuilder("routine")
        .leftJoinAndSelect("routine.user", "routineUser")
        .where("routine.confirmed = :confirmed", { confirmed: true })
        .andWhere("routineUser.batch.id = :batchId", { batchId })
        .getMany();

      const expandedBatch = expandRoutinesToCalendarEvents(
        batchRoutines,
        startDate,
        endDate,
        "routine",
      );
      events.push(...expandedBatch);
    }
  } else if (user.role === UserRole.STUDENT || user.role === UserRole.CR) {
    // Students see their own + teacher routines from their batch (if teacher is assigned to their batch)
    const batchId = user.batch?.id;
    if (batchId) {
      // Get teachers in this batch and their confirmed routines
      const teachers = await userRepo.find({
        where: { role: UserRole.TEACHER, batch: { id: batchId } },
      });

      if (teachers.length > 0) {
        const teacherIds = teachers.map((t) => t.user_id);
        const teacherRoutines = await routineRepo.find({
          where: {
            confirmed: true,
            user: { user_id: undefined }, // placeholder, will use IN clause
          },
        });

        // Fetch routines for each teacher
        const allTeacherRoutines = await Promise.all(
          teacherIds.map((tid) =>
            routineRepo.find({
              where: { confirmed: true, user: { user_id: tid } },
            }),
          ),
        ).then((results) => results.flat());

        const expandedTeachers = expandRoutinesToCalendarEvents(
          allTeacherRoutines,
          startDate,
          endDate,
          "routine",
        );
        events.push(...expandedTeachers);
      }
    }
  }

  return events;
}

// Expand weekly routine rows into dated calendar events.
function expandRoutinesToCalendarEvents(
  routines: Routine[],
  startDate: Date,
  endDate: Date,
  type: "routine" | "personal",
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const dayOfWeekMap: Record<DayOfWeek, number> = {
    [DayOfWeek.SATURDAY]: 6,
    [DayOfWeek.SUNDAY]: 0,
    [DayOfWeek.MONDAY]: 1,
    [DayOfWeek.TUESDAY]: 2,
    [DayOfWeek.WEDNESDAY]: 3,
    [DayOfWeek.THURSDAY]: 4,
    [DayOfWeek.FRIDAY]: 5,
  };

  for (const routine of routines) {
    const targetDayOfWeek = dayOfWeekMap[routine.day];

    // Find all occurrences of this day in the date range
    let current = new Date(startDate);
    while (current < endDate) {
      if (current.getDay() === targetDayOfWeek) {
        // Create event for firstHalfStart
        const [firstHourStr, firstMinStr] = routine.firstHalfStart.split(":");
        const firstHour = parseInt(firstHourStr, 10);
        const firstMin = parseInt(firstMinStr, 10);

        const startDateTime = new Date(current);
        startDateTime.setHours(firstHour, firstMin, 0, 0);

        // Create end time from secondHalfStart if available, otherwise 1 hour later
        let endDateTime = new Date(startDateTime);
        if (routine.secondHalfStart) {
          const [secondHourStr, secondMinStr] =
            routine.secondHalfStart.split(":");
          endDateTime.setHours(parseInt(secondHourStr, 10), parseInt(secondMinStr, 10), 0, 0);
        } else {
          endDateTime.setHours(firstHour + 1, firstMin, 0, 0);
        }

        const minutesBefore = 15;
        const notificationTime = new Date(startDateTime.getTime() - minutesBefore * 60000);

        events.push({
          id: `routine-${routine.id}-${current.toISOString().split("T")[0]}`,
          type: "routine",
          title: routine.note || `Class: ${routine.day.toUpperCase()}`,
          description: routine.note,
          startDateTime,
          endDateTime,
          isAllDay: false,
          source: { routineId: routine.id },
          reminder: {
            enabled: routine.remindersEnabled !== false, // Use routine's preference if defined, default true
            minutesBefore,
            notificationTime: notificationTime.toISOString(),
          },
          metadata: {
            confidence: routine.confidence,
            note: routine.note || undefined,
          },
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }

  return events;
}

// Get fixture events visible to the current user.
async function getFixtureEvents(
  user: User,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const fixtureRepo = AppDataSource.getRepository(UserFixture);

  const fixtures = await fixtureRepo
    .createQueryBuilder("fixture")
    .leftJoinAndSelect("fixture.user", "user")
    .where("(user.user_id = :userId OR fixture.isPublic = :isPublic)", {
      userId: user.user_id,
      isPublic: true,
    })
    .andWhere("fixture.startDateTime >= :startDate", { startDate })
    .andWhere("fixture.startDateTime <= :endDate", { endDate })
    .orderBy("fixture.startDateTime", "ASC")
    .getMany();

  return fixtures.map((fixture) => {
      const isOwner = fixture.user?.user_id === user.user_id;
      const isPublicFixture = !!fixture.isPublic;
      const minutesBefore = 15;
      const startDateTime = new Date(fixture.startDateTime);
      const notificationTime = new Date(startDateTime.getTime() - minutesBefore * 60000);
      
      return {
        id: `fixture-${fixture.id}`,
        type: isPublicFixture ? "public" : "personal",
        title: fixture.title,
        description: fixture.description,
        startDateTime,
        endDateTime: new Date(fixture.endDateTime),
        isAllDay: fixture.isAllDay,
        source: { fixtureId: fixture.id },
        metadata: {
          canDelete: isOwner,
          createdBy: isPublicFixture ? fixture.user?.name : undefined,
        },
        reminder: {
          enabled: !fixture.isAllDay,
          minutesBefore,
          notificationTime: notificationTime.toISOString(),
        }
      };
    });
}

// Determine whether the current user can delete a given notice.
export function canDeleteNotice(notice: Notice, user: User): boolean {
  // If no user or notice, cannot delete
  if (!user || !notice || !user.role) {
    return false;
  }

  const userRole = user.role as UserRole;

  // Admin can delete all notices
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Creator can always delete their own notice
  if (notice.createdBy?.user_id === user.user_id) {
    return true;
  }

  // CR can delete forAll notices
  if (userRole === UserRole.CR && notice.forAll) {
    return true;
  }

  // CR can delete batchwise notices of their own batch
  if (
    userRole === UserRole.CR &&
    notice.targetBatch?.id &&
    user.batch?.id === notice.targetBatch.id
  ) {
    return true;
  }

  // Teacher can delete forAll and forTeachers notices
  if (userRole === UserRole.TEACHER && (notice.forAll || notice.forTeachers)) {
    return true;
  }

  return false;
}

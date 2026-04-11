import { AppDataSource } from "../../db/data-source";
import { Notice, NoticeStatus } from "../notice/notice.entity";
import { Routine, DayOfWeek } from "../routine/routine.entity";
import { UserFixture } from "./calendar.entity";
import { User, UserRole } from "../user/user.entity";
import { parseLocalDate } from "../../utils/dateUtils";

export interface CalendarEvent {
  id: string;
  type: "notice" | "routine" | "personal";
  title: string;
  description?: string;
  startDateTime: Date;
  endDateTime?: Date;
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
}

/**
 * Get calendar events for next N days based on user role and batch
 * Aggregates: notices with eventDate + expanded routines + personal fixtures
 */
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
  // Truncate to date only for comparison with eventDate column (which is stored as date, not datetime)
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + days);
  // Set to end of day for proper range inclusion
  endDate.setHours(23, 59, 59, 999);

  const events: CalendarEvent[] = [];

  // 1. Fetch approved notices with eventDate (role-filtered)
  const noticeEvents = await getNoticeEvents(user, startDate, endDate);
  events.push(...noticeEvents);

  // 2. Fetch and expand routines to daily entries (role-filtered)
  const routineEvents = await getRoutineEvents(user, now, endDate);
  events.push(...routineEvents);

  // 3. Fetch personal fixtures
  const fixtureEvents = await getPersonalFixtureEvents(user, now, endDate);
  events.push(...fixtureEvents);

  // Sort by start date
  return events.sort(
    (a, b) =>
      new Date(a.startDateTime).getTime() -
      new Date(b.startDateTime).getTime(),
  );
}

/**
 * Get notice events filtered by role and batch
 */
async function getNoticeEvents(
  user: User,
  startDate: Date,
  endDate: Date,
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

  return notices.map((notice) => ({
    id: `notice-${notice.id}`,
    type: "notice",
    title: notice.title,
    description: notice.content,
    startDateTime: parseLocalDate(notice.eventDate!),
    endDateTime: parseLocalDate(notice.eventDate!),
    isAllDay: true,
    source: { noticeId: notice.id },
    metadata: {
      forAll: notice.forAll,
      forTeachers: notice.forTeachers,
      batchId: notice.targetBatch?.id,
      batchName: notice.targetBatch?.name,
      noticeContent: notice.content,
      createdBy: notice.createdBy?.name,
      canDelete: canDeleteNotice(notice, user),
    },
  }));
}

/**
 * Expand user routines into daily calendar entries for next N days
 * Only shows user's own routines + teacher routines visible to student/cr in their batch
 */
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

/**
 * Helper: expand weekly routines into daily calendar entries
 */
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

        events.push({
          id: `routine-${routine.id}-${current.toISOString().split("T")[0]}`,
          type: "routine",
          title: routine.note || `Class: ${routine.day.toUpperCase()}`,
          description: routine.note,
          startDateTime,
          endDateTime,
          isAllDay: false,
          source: { routineId: routine.id },
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

/**
 * Get personal fixture events for user
 */
async function getPersonalFixtureEvents(
  user: User,
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const fixtureRepo = AppDataSource.getRepository(UserFixture);

  const fixtures = await fixtureRepo.find({
    where: {
      user: { user_id: user.user_id },
    },
  });

  return fixtures
    .filter(
      (f) =>
        new Date(f.startDateTime) >= startDate &&
        new Date(f.startDateTime) <= endDate,
    )
    .map((fixture) => ({
      id: `fixture-${fixture.id}`,
      type: "personal",
      title: fixture.title,
      description: fixture.description,
      startDateTime: new Date(fixture.startDateTime),
      endDateTime: new Date(fixture.endDateTime),
      isAllDay: fixture.isAllDay,
      source: { fixtureId: fixture.id },
    }));
}

/**
 * Determine if a user can delete a notice based on role and notice properties
 * - CR can delete: forAll notices, batchwise notices for their batch
 * - Teacher can delete: forTeachers notices, any notice they created
 * - Admin can delete: all notices they can see
 */
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

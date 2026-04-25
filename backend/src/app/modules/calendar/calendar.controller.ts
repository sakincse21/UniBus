import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { UserFixture } from "./calendar.entity";
import { getCalendarEvents, canDeleteNotice } from "./calendar.service";
import { Notice } from "../notice/notice.entity";
import { User } from "../user/user.entity";
import { parseLocalDateTime } from "../../utils/dateUtils";

const getCalendarEventsHandler = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const days = parseInt(req.query.days as string) || 30;

  if (days < 1 || days > 365) {
    return res.status(400).json({
      success: false,
      message: "Days must be between 1 and 365",
    });
  }

  const events = await getCalendarEvents(userId, days);

  return res.json({
    success: true,
    data: events,
  });
});

const createPersonalFixture = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const { title, description, startDateTime, endDateTime, isAllDay, isPublic } = req.body;

  // Validation
  if (!title || !startDateTime || !endDateTime) {
    return res.status(400).json({
      success: false,
      message: "title, startDateTime, and endDateTime are required",
    });
  }

  const start = parseLocalDateTime(startDateTime);
  const end = parseLocalDateTime(endDateTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format",
    });
  }

  if (start >= end) {
    return res.status(400).json({
      success: false,
      message: "startDateTime must be before endDateTime",
    });
  }

  const fixtureRepo = AppDataSource.getRepository(UserFixture);

  const fixture = fixtureRepo.create({
    user: { user_id: userId },
    title,
    description: description || null,
    startDateTime: start,
    endDateTime: end,
    isAllDay: !!isAllDay,
    isPublic: !!isPublic,
  });

  await fixtureRepo.save(fixture);

  return res.status(201).json({
    success: true,
    data: fixture,
  });
});

const getPersonalFixtures = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;

  const fixtureRepo = AppDataSource.getRepository(UserFixture);
  const fixtures = await fixtureRepo.find({
    where: { user: { user_id: userId } },
    order: { startDateTime: "ASC" },
  });

  return res.json({
    success: true,
    data: fixtures,
  });
});

const updatePersonalFixture = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const fixtureId = Number(req.params.id);
  const { title, description, startDateTime, endDateTime, isAllDay, isPublic } = req.body;

  const fixtureRepo = AppDataSource.getRepository(UserFixture);
  const fixture = await fixtureRepo.findOne({
    where: { id: fixtureId, user: { user_id: userId } },
  });

  if (!fixture) {
    return res.status(404).json({
      success: false,
      message: "Fixture not found",
    });
  }

  // Validation
  if (startDateTime && endDateTime) {
    const start = parseLocalDateTime(startDateTime);
    const end = parseLocalDateTime(endDateTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "startDateTime must be before endDateTime",
      });
    }

    fixture.startDateTime = start;
    fixture.endDateTime = end;
  }

  if (title !== undefined) fixture.title = title;
  if (description !== undefined) fixture.description = description;
  if (isAllDay !== undefined) fixture.isAllDay = isAllDay;
  if (isPublic !== undefined) fixture.isPublic = !!isPublic;

  await fixtureRepo.save(fixture);

  return res.json({
    success: true,
    data: fixture,
  });
});

const deletePersonalFixture = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const fixtureId = Number(req.params.id);

  const fixtureRepo = AppDataSource.getRepository(UserFixture);
  const fixture = await fixtureRepo.findOne({
    where: { id: fixtureId, user: { user_id: userId } },
  });

  if (!fixture) {
    return res.status(404).json({
      success: false,
      message: "Fixture not found",
    });
  }

  await fixtureRepo.remove(fixture);

  return res.json({
    success: true,
    message: "Fixture deleted successfully",
  });
});

const deleteNotice = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  const noticeId = Number(req.params.id);

  const noticeRepo = AppDataSource.getRepository(Notice);
  const userRepo = AppDataSource.getRepository(User);

  // Get the notice with all required relations
  const notice = await noticeRepo.findOne({
    where: { id: noticeId },
    relations: ["createdBy", "targetBatch"],
  });

  if (!notice) {
    return res.status(404).json({
      success: false,
      message: "Notice not found",
    });
  }

  // Get current user with role and batch
  const user = await userRepo.findOne({
    where: { user_id: userId },
    relations: ["batch"],
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User not found",
    });
  }

  // Check if user has permission to delete this notice
  if (!canDeleteNotice(notice, user)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to delete this notice",
    });
  }

  await noticeRepo.remove(notice);

  return res.json({
    success: true,
    message: "Notice deleted successfully",
  });
});

export const CalendarController = {
  getCalendarEventsHandler,
  createPersonalFixture,
  getPersonalFixtures,
  updatePersonalFixture,
  deletePersonalFixture,
  deleteNotice,
};

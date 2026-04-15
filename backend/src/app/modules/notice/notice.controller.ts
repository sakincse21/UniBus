import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { Notice, NoticeStatus } from "./notice.entity";
import { User, UserRole } from "../user/user.entity";
import { sendPushToUsers } from "../notification/push.service";

type SocketServerLike = {
  emit: (event: string, payload: unknown) => void;
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
};

function getSocketServer(req: Request): SocketServerLike | null {
  const io = req.app.get("io") as Partial<SocketServerLike> | undefined;

  if (!io || typeof io.emit !== "function" || typeof io.to !== "function") {
    return null;
  }

  return io as SocketServerLike;
}

function emitPublishedNotice(io: SocketServerLike | null, notice: Notice) {
  if (!io) return;

  if (notice.forAll) {
    io.emit("notice_published", notice);
    return;
  }

  if (notice.forTeachers) {
    io.to("role:teacher").emit("notice_published", notice);
    return;
  }

  if (notice.targetBatch) {
    io.to(`batch:${notice.targetBatch.id}`).emit("notice_published", notice);
  }
}

function emitPendingNotice(io: SocketServerLike | null, notice: Notice) {
  if (!io) return;

  io.to("role:admin").emit("notice_pending", notice);
  io.to("role:teacher").emit("notice_pending", notice);
  io.to("role:cr").emit("notice_pending", notice);
}

function summarizeNoticeContent(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 140) {
    return normalized;
  }

  return `${normalized.slice(0, 137)}...`;
}

async function getNoticePushRecipients(
  notice: Notice,
  excludeUserId?: string,
): Promise<User[]> {
  const userRepo = AppDataSource.getRepository(User);
  const qb = userRepo
    .createQueryBuilder("user")
    .leftJoin("user.batch", "batch")
    .select(["user.user_id", "user.pushToken", "user.role"]);

  if (notice.forAll) {
    // forAll notices go to every user.
  } else if (notice.forTeachers) {
    qb.where("user.role = :role", { role: UserRole.TEACHER });
  } else if (notice.targetBatch?.id) {
    qb.where("batch.id = :batchId", { batchId: notice.targetBatch.id });
  } else {
    return [];
  }

  if (excludeUserId) {
    qb.andWhere("user.user_id != :excludeUserId", { excludeUserId });
  }

  return qb.getMany();
}

async function pushPublishedNotice(
  notice: Notice,
  excludeUserId?: string,
): Promise<number> {
  const recipients = await getNoticePushRecipients(notice, excludeUserId);

  if (!recipients.length) {
    return 0;
  }

  return sendPushToUsers(recipients, {
    title: `New Notice: ${notice.title}`,
    body: summarizeNoticeContent(notice.content),
    data: {
      type: "notice",
      noticeId: notice.id,
    },
    channelId: "default",
  });
}

const createNotice = tryCatch(async (req: Request, res: Response) => {
  const { title, content, forAll, forTeachers, targetBatchId, eventDate, startTime, endTime } = req.body;

  const user = await AppDataSource.getRepository("User").findOne({
    where: { user_id: req.user.userId },
    relations: ["batch"],
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const repo = AppDataSource.getRepository(Notice);
  const targetBatch = targetBatchId
    ? await AppDataSource.getRepository("Batch").findOne({
        where: { name: targetBatchId },
      })
    : null;

  // CR restrictions: can only post for their own batch
  if (user.role === UserRole.CR) {
    if (!user.batch?.id) {
      return res.status(400).json({ message: "CR must belong to a batch" });
    }
    if (forAll || forTeachers) {
      return res.status(403).json({
        message: "CR can only post for their own batch",
      });
    }
    if (!targetBatch || Number(targetBatch.id) !== user.batch.id) {
      return res.status(403).json({
        message: "CR can only post for their own batch",
      });
    }
  }

  // Student restrictions: can only post for their own batch
  if (user.role === UserRole.STUDENT) {
    if (!user.batch?.id) {
      return res.status(400).json({ message: "Student must belong to a batch" });
    }
    if (forAll || forTeachers) {
      return res.status(403).json({
        message: "Students can only post for their own batch",
      });
    }
    if (!targetBatch || Number(targetBatch.id) !== user.batch.id) {
      return res.status(403).json({
        message: "Students can only post for their own batch",
      });
    }
  }

  // Validate targeting - exactly one must be selected
  const targetCount =
    (forAll ? 1 : 0) + (forTeachers ? 1 : 0) + (targetBatchId ? 1 : 0);
  if (targetCount !== 1) {
    return res.status(400).json({
      message: "Notice must target exactly one audience",
    });
  }

  // Validate eventDate format if provided (YYYY-MM-DD)
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return res.status(400).json({ message: "Invalid eventDate format (use YYYY-MM-DD)" });
  }

  // Validate time format if provided (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (startTime && !timeRegex.test(startTime)) {
    return res.status(400).json({
      message: "Invalid startTime format (use HH:MM)",
    });
  }
  if (endTime && !timeRegex.test(endTime)) {
    return res.status(400).json({
      message: "Invalid endTime format (use HH:MM)",
    });
  }

  // Auto-approve for admin, teacher, CR. Pending for students.
  const notice = repo.create({
    title,
    content,
    createdBy: { user_id: user.user_id },
    forAll: !!forAll,
    forTeachers: !!forTeachers,
    targetBatch: targetBatch?.id ? { id: targetBatch.id } : undefined,
    eventDate: eventDate || undefined,
    startTime: startTime || undefined,
    endTime: endTime || undefined,
    status:
      user.role === UserRole.STUDENT
        ? NoticeStatus.PENDING
        : NoticeStatus.APPROVED,
  });

  await repo.save(notice);

  const io = getSocketServer(req);
  let pushNotifiedUsers = 0;

  // If auto-approved, broadcast immediately
  if (notice.status === NoticeStatus.APPROVED) {
    emitPublishedNotice(io, notice);
    pushNotifiedUsers = await pushPublishedNotice(notice, user.user_id);
  } else if (notice.status === NoticeStatus.PENDING) {
    emitPendingNotice(io, notice);
  }

  res.json({ success: true, data: notice, pushNotifiedUsers });
});

const approveNotice = tryCatch(async (req: Request, res: Response) => {
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.TEACHER && req.user.role !== UserRole.CR) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;

  const repo = AppDataSource.getRepository(Notice);
  const notice = await repo.findOne({
    where: { id: Number(id) },
    relations: ["targetBatch", "createdBy"],
  });

  if (!notice) {
    return res.status(404).json({ message: "Notice not found" });
  }

  notice.status = NoticeStatus.APPROVED;
  await repo.save(notice);

  const io = getSocketServer(req);
  emitPublishedNotice(io, notice);
  
  let pushNotifiedUsers = await pushPublishedNotice(notice);

  // Notify the creator that their notice was accepted
  if (notice.createdBy && notice.createdBy.pushToken && notice.createdBy.user_id !== req.user.userId) {
    await sendPushToUsers([notice.createdBy], {
      title: "Notice Approved ✅",
      body: `Your pending notice "${notice.title}" has been approved!`,
      data: {
        type: "notice",
        noticeId: notice.id,
      },
      channelId: "default",
    });
    pushNotifiedUsers += 1;
  }

  res.json({ success: true, pushNotifiedUsers });
});

const getVisibleNotices = tryCatch(async (req: Request, res: Response) => {
  const user = req.user;
  const userRole = user.role as UserRole;

  const ifUser = await AppDataSource.getRepository("User").findOne({
    where: { user_id: user.userId },
    relations: ["batch"],
  });

  const repo = AppDataSource.getRepository(Notice);
  const qb = repo
    .createQueryBuilder("notice")
    .leftJoinAndSelect("notice.targetBatch", "batch")
    .leftJoinAndSelect("notice.createdBy", "creator")
    .where("notice.status = :status", { status: NoticeStatus.APPROVED });

  if (userRole === UserRole.ADMIN) {
    // Admin sees ALL approved notices
  } else if (userRole === UserRole.TEACHER) {
    qb.andWhere(
      `(notice.forAll = :forAll OR notice.forTeachers = :forTeachers)`,
      { forAll: true, forTeachers: true },
    );
  } else {
    // Student/CR sees: forAll + their specific batch notices
    const batchId = ifUser?.batch?.id ?? null;

    if (batchId) {
      qb.andWhere(`(notice.forAll = :forAll OR batch.id = :batchId)`, {
        forAll: true,
        batchId,
      });
    } else {
      qb.andWhere(`notice.forAll = :forAll`, { forAll: true });
    }
  }

  const notices = await qb.orderBy("notice.createdAt", "DESC").getMany();

  res.json({ success: true, data: notices });
});

const getPendingNotices = tryCatch(async (req: Request, res: Response) => {
  // Admin, Teacher, and CR can view pending notices
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.TEACHER && req.user.role !== UserRole.CR) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const repo = AppDataSource.getRepository(Notice);
  const notices = await repo.find({
    where: { status: NoticeStatus.PENDING },
    relations: ["createdBy", "targetBatch"],
    order: { createdAt: "DESC" },
  });

  res.json({ success: true, data: notices });
});

const rejectNotice = tryCatch(async (req: Request, res: Response) => {
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.TEACHER && req.user.role !== UserRole.CR) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;
  const repo = AppDataSource.getRepository(Notice);
  const notice = await repo.findOne({ where: { id: Number(id) } });

  if (!notice) {
    return res.status(404).json({ message: "Notice not found" });
  }

  notice.status = NoticeStatus.REJECTED;
  await repo.save(notice);

  res.json({ success: true });
});

const deleteNotice = tryCatch(async (req: Request, res: Response) => {
  if (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.TEACHER && req.user.role !== UserRole.CR) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;
  const repo = AppDataSource.getRepository(Notice);
  await repo.delete(Number(id));

  const io = getSocketServer(req);
  io?.emit("notice_deleted", { id: Number(id) });

  res.json({ success: true });
});

const getNoticeById = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;
  const userRole = user.role as UserRole;

  const repo = AppDataSource.getRepository(Notice);
  const notice = await repo.findOne({
    where: { id: Number(id) },
    relations: ["createdBy", "targetBatch", "attachments"],
  });

  if (!notice) {
    return res.status(404).json({ message: "Notice not found" });
  }

  // Check if user has permission to view this notice
  if (notice.status !== NoticeStatus.APPROVED) {
    // Only admin, CR, or creator can view non-approved notices
    if (
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.CR &&
      notice.createdBy.user_id !== user.userId
    ) {
      return res.status(403).json({ message: "Access denied" });
    }
  } else {
    // Check visibility for approved notices
    const ifUser = await AppDataSource.getRepository("User").findOne({
      where: { user_id: user.userId },
      relations: ["batch"],
    });

    if (userRole === UserRole.TEACHER) {
      if (!notice.forAll && !notice.forTeachers) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (userRole === UserRole.STUDENT || userRole === UserRole.CR) {
      const batchId = ifUser?.batch?.id ?? null;
      if (!notice.forAll && notice.targetBatch?.id !== batchId) {
        return res.status(403).json({ message: "Access denied" });
      }
    }
  }

  res.json({ success: true, data: notice });
});

export const NoticeController = {
  createNotice,
  getVisibleNotices,
  approveNotice,
  getPendingNotices,
  rejectNotice,
  deleteNotice,
  getNoticeById,
};

import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { Notice, NoticeStatus } from "./notice.entity";
import { User, UserRole } from "../user/user.entity";

const createNotice = tryCatch(async (req: Request, res: Response) => {
  const { title, content, forAll, forTeachers, targetBatchId } = req.body;
  const user = await AppDataSource.getRepository("User").findOne({
    where: { user_id: req.user.userId },
    relations: ["batch"],
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const repo = AppDataSource.getRepository(Notice);

  const targetBatch = await AppDataSource.getRepository("Batch").findOne({ where: { name: targetBatchId } });

  //restrictions for CR role
  if (user.role === UserRole.CR) {
    console.log(user);
    if (!user.batch.id) {
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

  //preventing students from creating notices
  if (user.role === UserRole.STUDENT) {
    return res.status(403).json({
      message: "Students cannot create notices",
    });
  }

  // const targetCount =
  //   (forAll ? 1 : 0) + (forTeachers ? 1 : 0) + (targetBatchId ? 1 : 0);

  if (forAll && (forTeachers || targetBatchId)) {
    return res.status(400).json({
      message: "Notice cannot be for all and also have specific audience",
    });
  }


  const notice = repo.create({
    title,
    content,
    createdBy: { user_id: user.user_id },
    forAll: !!forAll,
    forTeachers: !!forTeachers,
    targetBatch: targetBatch?.id ? { id: targetBatch.id } : undefined,
    status:
      user.role === UserRole.ADMIN || user.role === UserRole.TEACHER
        ? NoticeStatus.APPROVED
        : NoticeStatus.PENDING,
  });

  await repo.save(notice);

  const io = req.app.get("io");

  // If admin-created (auto approved), broadcast immediately
  if (notice.status === NoticeStatus.APPROVED) {
    io.emit("notice_published", notice);
  }

  res.json({ success: true, data: notice });
});

const approveNotice = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(Notice);

  const notice = await repo.findOne({ where: { id: Number(id) } });

  if (!notice) {
    return res.status(404).json({ message: "Notice not found" });
  }

  notice.status = NoticeStatus.APPROVED;
  await repo.save(notice);

  const io = req.app.get("io");

  if (notice.forAll) {
    io.emit("notice_published", notice);
  } else if (notice.forTeachers) {
    io.to("role:teacher").emit("notice_published", notice);
  } else if (notice.targetBatch) {
    io.to(`batch:${notice.targetBatch.id}`).emit("notice_published", notice);
  }

  res.json({ success: true });
});

const getVisibleNotices = tryCatch(async (req: Request, res: Response) => {
  const user = req.user;

  const ifUser = await AppDataSource.getRepository("User").findOne({
    where: { user_id: user.userId },
    relations: ["batch"],
  });

  console.log("ifUser:", ifUser);

  const repo = AppDataSource.getRepository(Notice);

  const qb = repo
    .createQueryBuilder("notice")
    .leftJoinAndSelect("notice.targetBatch", "batch")
    .where("notice.status = :status", { status: NoticeStatus.APPROVED });

  qb.andWhere(
    `
    notice.forAll = true
    OR (notice.forTeachers = true AND :role = 'teacher')
    OR (batch.id = :batchId)
  `,
    {
      role: user.role,
      batchId: ifUser?.batch?.id ?? null,
    },
  );

  const notices = await qb.orderBy("notice.createdAt", "DESC").getMany();

  res.json({ success: true, data: notices });
});

const getPendingNotices = tryCatch(async (req: Request, res: Response) => {
  if (req.user.role !== UserRole.ADMIN) {
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
  if (req.user.role !== UserRole.ADMIN) {
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
  if (req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { id } = req.params;

  const repo = AppDataSource.getRepository(Notice);

  await repo.delete(Number(id));

  res.json({ success: true });
});

export const NoticeController = {
  createNotice,
  getVisibleNotices,
  approveNotice,
  getPendingNotices,
  rejectNotice,
  deleteNotice,
};

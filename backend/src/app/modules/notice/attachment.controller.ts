import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { Attachment } from "./attachment.entity";
import { Notice } from "./notice.entity";
import * as fs from "fs";
import * as path from "path";

const uploadAttachments = tryCatch(async (req: Request, res: Response) => {
  const { noticeId } = req.body;
  const files = req.files as Express.Multer.File[];

  if (!noticeId || !files || files.length === 0) {
    return res.status(400).json({
      message: "Notice ID and at least one file are required",
    });
  }

  const noticeRepo = AppDataSource.getRepository(Notice);
  const notice = await noticeRepo.findOne({ where: { id: Number(noticeId) } });

  if (!notice) {
    // Clean up uploaded files if notice doesn't exist
    files.forEach((file) => {
      fs.unlink(file.path, () => {}); // Ignore errors
    });
    return res.status(404).json({ message: "Notice not found" });
  }

  const attachmentRepo = AppDataSource.getRepository(Attachment);
  const attachments: Attachment[] = [];

  for (const file of files) {
    const attachment = attachmentRepo.create({
      notice: { id: Number(noticeId) },
      fileName: file.originalname,
      filePath: file.path,
      fileType: file.mimetype,
      fileSize: file.size,
    });
    attachments.push(attachment);
  }

  await attachmentRepo.save(attachments);

  res.json({
    success: true,
    data: attachments,
  });
});

const downloadAttachment = tryCatch(async (req: Request, res: Response) => {
  const { attachmentId } = req.params;

  const attachmentRepo = AppDataSource.getRepository(Attachment);
  const attachment = await attachmentRepo.findOne({
    where: { id: Number(attachmentId) },
    relations: ["notice"],
  });

  if (!attachment) {
    return res.status(404).json({ message: "Attachment not found" });
  }

  // Check if file exists
  if (!fs.existsSync(attachment.filePath)) {
    return res.status(404).json({ message: "File not found on server" });
  }

  // Set response headers for file download
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${attachment.fileName}"`
  );
  res.setHeader("Content-Type", attachment.fileType);

  // Stream the file
  const fileStream = fs.createReadStream(attachment.filePath);
  fileStream.pipe(res);
});

const deleteAttachment = tryCatch(async (req: Request, res: Response) => {
  const { attachmentId } = req.params;

  const attachmentRepo = AppDataSource.getRepository(Attachment);
  const attachment = await attachmentRepo.findOne({
    where: { id: Number(attachmentId) },
  });

  if (!attachment) {
    return res.status(404).json({ message: "Attachment not found" });
  }

  // Delete file from disk
  if (fs.existsSync(attachment.filePath)) {
    fs.unlinkSync(attachment.filePath);
  }

  // Delete from database
  await attachmentRepo.delete(Number(attachmentId));

  res.json({ success: true });
});

const getAttachmentsByNotice = tryCatch(
  async (req: Request, res: Response) => {
    const { noticeId } = req.params;

    const attachmentRepo = AppDataSource.getRepository(Attachment);
    const attachments = await attachmentRepo.find({
      where: { notice: { id: Number(noticeId) } },
      order: { createdAt: "DESC" },
    });

    res.json({
      success: true,
      data: attachments,
    });
  }
);

export const AttachmentController = {
  uploadAttachments,
  downloadAttachment,
  deleteAttachment,
  getAttachmentsByNotice,
};

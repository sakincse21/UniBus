import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { AttachmentController } from "./attachment.controller";
import { uploadAttachments } from "../../middlewares/upload";

const router = Router();

// Upload attachments for a notice
router.post(
  "/upload",
  authValidate,
  uploadAttachments,
  AttachmentController.uploadAttachments
);

// Get attachments for a notice
router.get(
  "/notice/:noticeId",
  authValidate,
  AttachmentController.getAttachmentsByNotice
);

// Download a specific attachment
router.get(
  "/download/:attachmentId",
  authValidate,
  AttachmentController.downloadAttachment
);

// Delete an attachment
router.delete(
  "/:attachmentId",
  authValidate,
  AttachmentController.deleteAttachment
);

export const AttachmentRouter = router;

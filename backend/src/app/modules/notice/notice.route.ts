import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { NoticeController } from "./notice.controller";
import { roleValidate } from "../../middlewares/roleValidate";
import { UserRole } from "../user/user.entity";

const router = Router();

// All authenticated users can create and view notices
router.post("/", authValidate, NoticeController.createNotice);
router.get("/", authValidate, NoticeController.getVisibleNotices);

// Admin and CR can manage pending notices
router.get(
  "/pending",
  authValidate,
  roleValidate([UserRole.ADMIN, UserRole.CR]),
  NoticeController.getPendingNotices,
);
router.put(
  "/:id/approve",
  authValidate,
  roleValidate([UserRole.ADMIN, UserRole.CR]),
  NoticeController.approveNotice,
);
router.put(
  "/:id/reject",
  authValidate,
  roleValidate([UserRole.ADMIN, UserRole.CR]),
  NoticeController.rejectNotice,
);
router.delete(
  "/:id",
  authValidate,
  roleValidate([UserRole.ADMIN, UserRole.CR]),
  NoticeController.deleteNotice,
);
router.get(
  "/:id",
  authValidate,
  NoticeController.getNoticeById,
);

export const NoticeRouter = router;

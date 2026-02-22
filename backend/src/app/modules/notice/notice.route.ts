import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { NoticeController } from "./notice.controller";
import { roleValidate } from "../../middlewares/roleValidate";
import { UserRole } from "../user/user.entity";

const router = Router();

router.post("/", authValidate, NoticeController.createNotice);
router.get("/", authValidate, NoticeController.getVisibleNotices);

router.get("/pending", authValidate,roleValidate([UserRole.ADMIN]), NoticeController.getPendingNotices);
router.patch("/:id/approve", authValidate, roleValidate([UserRole.ADMIN]),  NoticeController.approveNotice);
router.patch("/:id/reject", authValidate, roleValidate([UserRole.ADMIN]), NoticeController.rejectNotice);
router.delete("/:id", authValidate, roleValidate([UserRole.ADMIN]), NoticeController.deleteNotice);

export const NoticeRouter = router;

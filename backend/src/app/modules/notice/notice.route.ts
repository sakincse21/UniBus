import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { NoticeController } from "./notice.controller";

const router = Router();

router.post("/", authValidate, NoticeController.createNotice);
router.get("/", authValidate, NoticeController.getVisibleNotices);

router.get("/pending", authValidate, NoticeController.getPendingNotices);
router.patch("/:id/approve", authValidate, NoticeController.approveNotice);
router.patch("/:id/reject", authValidate, NoticeController.rejectNotice);
router.delete("/:id", authValidate, NoticeController.deleteNotice);

export const NoticeRouter = router;

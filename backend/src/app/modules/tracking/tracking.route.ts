import { Router } from "express";
import { TrackingController } from "./tracking.controller";
import { authValidate } from "../../middlewares/authValidate";

const router = Router();

router.post("/request/:busId", authValidate, TrackingController.requestTracking);
router.get("/active", authValidate, TrackingController.getActiveSessions);

export const TrackingRouter = router;

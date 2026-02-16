import { Router } from "express";
import { TrackingController } from "./tracking.controller";
import { authValidate } from "../../middlewares/authValidate";

const router = Router();

// 👇 THIS is the route your frontend is calling
router.post(
  "/request/:busId",
  authValidate,
  TrackingController.requestTracking
);

export const TrackingRouter = router;

import { Router } from "express";
import { AuthRouter } from "../modules/auth/auth.route";
import { UserRouter } from "../modules/user/user.route";
import { BusRouter } from "../modules/bus/bus.route";
import { TrackingRouter } from "../modules/tracking/tracking.route";
import { LocationRouter } from "../modules/location/location.route";
import { NoticeRouter } from "../modules/notice/notice.route";

const router = Router();

router.use("/notice", NoticeRouter);
router.use('/auth', AuthRouter);
router.use('/user', UserRouter);
router.use("/bus", BusRouter);
router.use("/location", LocationRouter);
router.use("/tracking", TrackingRouter);

export default router;

import { Router } from "express";
import { AuthRouter } from "../modules/auth/auth.route";
import { UserRouter } from "../modules/user/user.route";
import { BusRouter } from "../modules/bus/bus.route";
import { TrackingRouter } from "../modules/tracking/tracking.route";
import { LocationRouter } from "../modules/location/location.route";
import { NoticeRouter } from "../modules/notice/notice.route";
import { AttachmentRouter } from "../modules/notice/attachment.route";
import { RouteRouter } from "../modules/route/route.route";
import { ScheduleRouter } from "../modules/schedule/schedule.route";
import { RoutineRouter } from "../modules/routine/routine.route";
import { CalendarRouter } from "../modules/calendar/calendar.route";
import { BatchRouter } from "../modules/batch/batch.route";
// import { ScheduleRouter } from "../modules/schedule/schedule.route";

const router = Router();

router.use("/notice", NoticeRouter);
router.use("/attachment", AttachmentRouter);
router.use('/auth', AuthRouter);
router.use('/user', UserRouter);
router.use('/batch', BatchRouter);
router.use("/bus", BusRouter);
router.use("/location", LocationRouter);
router.use("/tracking", TrackingRouter);
router.use("/route", RouteRouter);
router.use("/schedule", ScheduleRouter);
router.use("/routine", RoutineRouter);
router.use("/calendar", CalendarRouter);

export default router;

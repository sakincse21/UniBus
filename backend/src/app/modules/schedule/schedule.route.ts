import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";
import { ScheduleController } from "./schedule.controller";

const router = Router();

router.get("/", authValidate, ScheduleController.getAllSchedules);
router.get("/:id", authValidate, ScheduleController.getScheduleById);
router.get("/bus/:busId", authValidate, ScheduleController.getScheduleByBus);

router.post("/", authValidate, roleValidate(["admin"]), ScheduleController.createSchedule);
router.patch("/:id", authValidate, roleValidate(["admin"]), ScheduleController.updateSchedule);
router.delete("/:id", authValidate, roleValidate(["admin"]), ScheduleController.deleteSchedule);

export const ScheduleRouter = router;

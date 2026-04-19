import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { CalendarController } from "./calendar.controller";

const router = Router();

// Calendar events (aggregated: notices + routines + fixtures)
router.get(
  "/events",
  authValidate,
  CalendarController.getCalendarEventsHandler,
);

// Fixtures (owner CRUD, with optional public visibility)
router.post("/fixtures", authValidate, CalendarController.createPersonalFixture);
router.get(
  "/fixtures",
  authValidate,
  CalendarController.getPersonalFixtures,
);
router.put(
  "/fixtures/:id",
  authValidate,
  CalendarController.updatePersonalFixture,
);
router.delete(
  "/fixtures/:id",
  authValidate,
  CalendarController.deletePersonalFixture,
);

// Notice deletion with role-based permission check
router.delete(
  "/notice/:id",
  authValidate,
  CalendarController.deleteNotice,
);

export const CalendarRouter = router;

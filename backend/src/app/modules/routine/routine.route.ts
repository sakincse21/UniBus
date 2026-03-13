import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { RoutineController } from "./routine.controller";
import { uploadRoutineImage } from "../../middlewares/upload";

const router = Router();

// All authenticated users can use routine features
router.post("/upload", authValidate, uploadRoutineImage, RoutineController.uploadAndAnalyze);
router.post("/confirm", authValidate, RoutineController.confirmRoutine);
router.get("/", authValidate, RoutineController.getMyRoutine);
router.patch("/:id", authValidate, RoutineController.updateSlot);
router.delete("/", authValidate, RoutineController.deleteMyRoutine);

export const RoutineRouter = router;

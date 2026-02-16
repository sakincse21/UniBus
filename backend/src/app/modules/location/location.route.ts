import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { LocationController } from "./location.controller";

const router = Router();
router.post("/update", authValidate, LocationController.updateLocation);

export const LocationRouter = router;

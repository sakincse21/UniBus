import { Router } from "express";
import { BusController } from "./bus.controller";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";

const router = Router();

router.post("/", authValidate, roleValidate(["admin"]), BusController.createBus);
router.get("/", authValidate, BusController.getBuses);

export const BusRouter = router;

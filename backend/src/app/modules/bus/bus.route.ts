import { Router } from "express";
import { BusController } from "./bus.controller";
import { authValidate } from "../../middlewares/authValidate";
import { roleValidate } from "../../middlewares/roleValidate";

const router = Router();

router.get("/", authValidate, BusController.getBuses);
router.get("/:id", authValidate, BusController.getBusById);
router.post("/", authValidate, roleValidate(["admin"]), BusController.createBus);
router.patch("/:id", authValidate, roleValidate(["admin"]), BusController.updateBus);
router.delete("/:id", authValidate, roleValidate(["admin"]), BusController.deleteBus);

export const BusRouter = router;

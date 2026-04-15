import { Router } from "express";
import { BatchController } from "./batch.controller";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { authValidate } from "../../middlewares/authValidate";

const router = Router();

router.post("/", authValidate, requireAdmin, BatchController.createBatch);
router.get("/", authValidate, requireAdmin, BatchController.getBatches);
router.delete("/:id", authValidate, requireAdmin, BatchController.deleteBatch);

export const BatchRouter = router;

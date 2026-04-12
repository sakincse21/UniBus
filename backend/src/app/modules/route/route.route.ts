import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { RouteController } from "./route.controller";
import { roleValidate } from "../../middlewares/roleValidate";
import { uploadXlsx } from "../../middlewares/upload";

const router = Router();

// Public/authenticated routes
router.get("/", authValidate, RouteController.getAllRoutes);
router.get("/:id", authValidate, RouteController.getRouteById);
router.get("/bus/:busId", authValidate, RouteController.getRouteByBus);

// Admin-only routes
router.post("/", authValidate, roleValidate(["admin"]), RouteController.createRoute);
router.patch("/:id", authValidate, roleValidate(["admin"]), RouteController.updateRoute);
router.delete("/:id", authValidate, roleValidate(["admin"]), RouteController.deleteRoute);

// Route points management (admin-only)
router.put("/:id/points", authValidate, roleValidate(["admin"]), RouteController.setRoutePoints);
router.post("/:id/points", authValidate, roleValidate(["admin"]), RouteController.addRoutePoint);
router.get("/:id/download-points-excel", authValidate, roleValidate(["admin"]), RouteController.downloadRoutePointsExcel);
router.post("/:id/upload-points-excel", authValidate, roleValidate(["admin"]), uploadXlsx, RouteController.uploadRoutePointsExcel);
router.patch("/points/:pointId", authValidate, roleValidate(["admin"]), RouteController.updateRoutePoint);
router.delete("/points/:pointId", authValidate, roleValidate(["admin"]), RouteController.deleteRoutePoint);

export const RouteRouter = router;

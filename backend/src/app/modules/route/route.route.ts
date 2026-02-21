import { Router } from "express";
import { authValidate } from "../../middlewares/authValidate";
import { RouteController } from "./route.controller";

const router = Router();

// 👇 THIS is the route your frontend is calling
router.get(
  "/request/:busId",
  authValidate,
  RouteController.getRoute
);

export const RouteRouter = router;

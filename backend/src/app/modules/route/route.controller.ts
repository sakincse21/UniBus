import tryCatch from "../../utils/tryCatch";
import { Request, Response } from "express";
import { AppDataSource } from "../../db/data-source";
import { Route } from "./route.entity";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "./routePoint.entity";

const getRoute = tryCatch(async (req: Request, res: Response) => {
  const { busId } = req.params;
  const userId = req.user.userId;

  const scheduleRepo = AppDataSource.getRepository(BusSchedule);

  const schedule = await scheduleRepo.findOne({where: {bus: {id: Number(busId)}}, relations: ["route"]});

  if (!schedule) {
    return res.status(404).json({ success: false, message: "Schedule not found for this bus" });
  }

  const routePointsRepo = AppDataSource.getRepository(RoutePoint);
  const route = await routePointsRepo.findOne({ where: { route: { id: schedule.route.id } }, order: { sequence: "ASC" } });

  if (!route) {
    return res.status(404).json({ success: false, message: "Route not found" });
  }

  res.json({ success: true, points: route });
});


export const RouteController = { getRoute };
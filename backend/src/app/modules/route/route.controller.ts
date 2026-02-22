import tryCatch from "../../utils/tryCatch";
import { Request, Response } from "express";
import { AppDataSource } from "../../db/data-source";
import { Route } from "./route.entity";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "./routePoint.entity";
import { AppError } from "../../errors/AppError";



const createRoute = tryCatch(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) throw new AppError("Route name is required", 400);

  const routeRepo = AppDataSource.getRepository(Route);
  const exists = await routeRepo.findOne({ where: { name } });
  if (exists) throw new AppError("Route with this name already exists", 409);

  const route = routeRepo.create({ name });
  await routeRepo.save(route);

  res.status(201).json({ success: true, data: route });
});

// Get route points for a bus 
// flow is busId -> schedule -> route
const getRouteByBus = tryCatch(async (req: Request, res: Response) => {
  const { busId } = req.params;

  const schedule = await AppDataSource.getRepository(BusSchedule).findOne({
    where: { bus: { id: Number(busId) } },
    relations: ["route"],
  });

  if (!schedule) {
    return res.status(404).json({ success: false, message: "Schedule not found for this bus" });
  }

  const points = await AppDataSource.getRepository(RoutePoint).find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });

  res.json({ success: true, data: { route: schedule.route, points } });
});

const getAllRoutes = tryCatch(async (_req: Request, res: Response) => {
  const routeRepo = AppDataSource.getRepository(Route);
  const routes = await routeRepo.find({ relations: ["points"], order: { id: "ASC" } });

  routes.forEach((route) => {
    if (route.points) route.points.sort((a, b) => a.sequence - b.sequence);
  });

  res.json({ success: true, data: routes });
});

const getRouteById = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const route = await AppDataSource.getRepository(Route).findOne({
    where: { id: Number(id) },
    relations: ["points"],
  });

  if (!route) throw new AppError("Route not found", 404);

  if (route.points) route.points.sort((a, b) => a.sequence - b.sequence);

  res.json({ success: true, data: route });
});

const updateRoute = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  if (name) route.name = name;
  await routeRepo.save(route);

  res.json({ success: true, data: route });
});

const deleteRoute = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  await routeRepo.remove(route);

  res.json({ success: true, message: "Route deleted" });
});

const setRoutePoints = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { points } = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    throw new AppError("Points array is required", 400);
  }

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);

  await rpRepo.delete({ route: { id: route.id } });

  const newPoints = points.map((p: any, idx: number) =>
    rpRepo.create({
      route: { id: route.id },
      lat: p.lat,
      lng: p.lng,
      sequence: p.sequence ?? idx + 1,
      minuteOffset: p.minuteOffset ?? 0,
    })
  );

  await rpRepo.save(newPoints);

  res.json({ success: true, data: newPoints });
});

const addRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { lat, lng, sequence, minuteOffset } = req.body;

  if (lat == null || lng == null || sequence == null || minuteOffset == null) {
    throw new AppError("lat, lng, sequence, and minuteOffset are required", 400);
  }

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = rpRepo.create({
    route: { id: route.id },
    lat,
    lng,
    sequence,
    minuteOffset,
  });

  await rpRepo.save(point);

  res.status(201).json({ success: true, data: point });
});

const updateRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { pointId } = req.params;
  const { lat, lng, sequence, minuteOffset } = req.body;

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = await rpRepo.findOne({ where: { id: Number(pointId) } });
  if (!point) throw new AppError("Route point not found", 404);

  if (lat != null) point.lat = lat;
  if (lng != null) point.lng = lng;
  if (sequence != null) point.sequence = sequence;
  if (minuteOffset != null) point.minuteOffset = minuteOffset;

  await rpRepo.save(point);

  res.json({ success: true, data: point });
});

const deleteRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { pointId } = req.params;

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = await rpRepo.findOne({ where: { id: Number(pointId) } });
  if (!point) throw new AppError("Route point not found", 404);

  await rpRepo.remove(point);

  res.json({ success: true, message: "Route point deleted" });
});

export const RouteController = {
  getRouteByBus,
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  setRoutePoints,
  addRoutePoint,
  updateRoutePoint,
  deleteRoutePoint,
};
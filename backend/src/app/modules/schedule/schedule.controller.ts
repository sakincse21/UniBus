import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { BusSchedule } from "./busSchedule.entity";
import { AppError } from "../../errors/AppError";

const getAllSchedules = tryCatch(async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(BusSchedule);
  const schedules = await repo.find({
    relations: ["bus", "route"],
    order: { id: "ASC" },
  });

  res.json({ success: true, data: schedules });
});

const getScheduleById = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const repo = AppDataSource.getRepository(BusSchedule);
  const schedule = await repo.findOne({
    where: { id: Number(id) },
    relations: ["bus", "route"],
  });

  if (!schedule) throw new AppError("Schedule not found", 404);

  res.json({ success: true, data: schedule });
});

const getScheduleByBus = tryCatch(async (req: Request, res: Response) => {
  const { busId } = req.params;
  const repo = AppDataSource.getRepository(BusSchedule);
  const schedule = await repo.findOne({
    where: { bus: { id: Number(busId) } },
    relations: ["bus", "route"],
  });

  if (!schedule) throw new AppError("No schedule found for this bus", 404);

  res.json({ success: true, data: schedule });
});

const createSchedule = tryCatch(async (req: Request, res: Response) => {
  const { busId, routeId, startTime, endTime } = req.body;

  if (!busId || !routeId || !startTime || !endTime) {
    throw new AppError("busId, routeId, startTime, and endTime are required", 400);
  }

  const repo = AppDataSource.getRepository(BusSchedule);

  const existing = await repo.findOne({ where: { bus: { id: busId } } });
  if (existing) throw new AppError("This bus already has a schedule. Update or delete it first.", 409);

  const schedule = repo.create({
    bus: { id: busId },
    route: { id: routeId },
    startTime,
    endTime,
  });

  await repo.save(schedule);

  const saved = await repo.findOne({
    where: { id: schedule.id },
    relations: ["bus", "route"],
  });

  res.status(201).json({ success: true, data: saved });
});

const updateSchedule = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { routeId, startTime, endTime } = req.body;

  const repo = AppDataSource.getRepository(BusSchedule);
  const schedule = await repo.findOne({
    where: { id: Number(id) },
    relations: ["bus", "route"],
  });

  if (!schedule) throw new AppError("Schedule not found", 404);

  if (routeId) schedule.route = { id: routeId } as any;
  if (startTime) schedule.startTime = startTime;
  if (endTime) schedule.endTime = endTime;

  await repo.save(schedule);

  const updated = await repo.findOne({
    where: { id: schedule.id },
    relations: ["bus", "route"],
  });

  res.json({ success: true, data: updated });
});

const deleteSchedule = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;

  const repo = AppDataSource.getRepository(BusSchedule);
  const schedule = await repo.findOne({ where: { id: Number(id) } });
  if (!schedule) throw new AppError("Schedule not found", 404);

  await repo.remove(schedule);

  res.json({ success: true, message: "Schedule deleted" });
});

export const ScheduleController = {
  getAllSchedules,
  getScheduleById,
  getScheduleByBus,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};

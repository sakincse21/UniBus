import { Request, Response } from "express";
import { BusService } from "./bus.service";
import tryCatch from "../../utils/tryCatch";

const createBus = tryCatch(async (req: Request, res: Response) => {
  const { busNumber } = req.body;
  const bus = await BusService.createBus(busNumber);

  res.status(201).json({
    success: true,
    data: bus,
  });
});

const getBuses = tryCatch(async (_req: Request, res: Response) => {
  const buses = await BusService.getAllBuses();
  res.json({ success: true, data: buses });
});

const getBusById = tryCatch(async (req: Request, res: Response) => {
  const bus = await BusService.getBusById(Number(req.params.id));
  res.json({ success: true, data: bus });
});

const updateBus = tryCatch(async (req: Request, res: Response) => {
  const { busNumber } = req.body;
  const bus = await BusService.updateBus(Number(req.params.id), busNumber);
  res.json({ success: true, data: bus });
});

const deleteBus = tryCatch(async (req: Request, res: Response) => {
  await BusService.deleteBus(Number(req.params.id));
  res.json({ success: true, message: "Bus deleted" });
});

export const BusController = {
  createBus,
  getBuses,
  getBusById,
  updateBus,
  deleteBus,
};

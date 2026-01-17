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

export const BusController = {
  createBus,
  getBuses,
};

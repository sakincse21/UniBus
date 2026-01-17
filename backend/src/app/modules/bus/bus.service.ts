import busRepo from "./bus.repository";
import { AppError } from "../../errors/AppError";

const createBus = async (busNumber: string) => {
  const exists = await busRepo.findOne({ where: { busNumber } });
  if (exists) throw new AppError("Bus already exists", 409);

  const bus = busRepo.create({ busNumber });
  return await busRepo.save(bus);
};

const getAllBuses = async () => {
  return await busRepo.find();
};

export const BusService = {
  createBus,
  getAllBuses,
};

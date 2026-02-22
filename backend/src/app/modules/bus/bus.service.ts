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

const getBusById = async (id: number) => {
  const bus = await busRepo.findOne({ where: { id } });
  if (!bus) throw new AppError("Bus not found", 404);
  return bus;
};

const updateBus = async (id: number, busNumber: string) => {
  const bus = await busRepo.findOne({ where: { id } });
  if (!bus) throw new AppError("Bus not found", 404);

  if (busNumber) {
    const dup = await busRepo.findOne({ where: { busNumber } });
    if (dup && dup.id !== id) throw new AppError("Bus number already in use", 409);
    bus.busNumber = busNumber;
  }

  return await busRepo.save(bus);
};

const deleteBus = async (id: number) => {
  const bus = await busRepo.findOne({ where: { id } });
  if (!bus) throw new AppError("Bus not found", 404);
  await busRepo.remove(bus);
};

export const BusService = {
  createBus,
  getAllBuses,
  getBusById,
  updateBus,
  deleteBus,
};

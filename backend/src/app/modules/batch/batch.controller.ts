import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { Batch } from "./batch.entity";
import { AppError } from "../../errors/AppError";

const createBatch = tryCatch(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    throw new AppError("Batch name is required (e.g. '101', '102')", 400);
  }

  const batchRepo = AppDataSource.getRepository(Batch);
  const exists = await batchRepo.findOne({ where: { name: String(name) } });
  
  if (exists) {
    throw new AppError(`Batch '${name}' already exists`, 409);
  }

  const newBatch = batchRepo.create({ name: String(name) });
  await batchRepo.save(newBatch);

  res.status(201).json({
    success: true,
    message: "Batch created successfully",
    data: newBatch,
  });
});

const getBatches = tryCatch(async (req: Request, res: Response) => {
  const batchRepo = AppDataSource.getRepository(Batch);
  const batches = await batchRepo.find({ order: { name: "ASC" } });
  
  res.status(200).json({
    success: true,
    data: batches,
  });
});

const deleteBatch = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const batchRepo = AppDataSource.getRepository(Batch);
  const userRepo = AppDataSource.getRepository("User");

  const batch = await batchRepo.findOne({ where: { id: Number(id) } });
  if (!batch) {
    throw new AppError("Batch not found", 404);
  }

  const userCount = await userRepo.count({
    where: { batch: { id: Number(id) } },
  });

  if (userCount > 0) {
    throw new AppError(`Cannot delete batch because it has ${userCount} users associated with it.`, 400);
  }

  await batchRepo.remove(batch);

  res.status(200).json({
    success: true,
    message: "Batch deleted successfully",
  });
});

export const BatchController = {
  createBatch,
  getBatches,
  deleteBatch
};

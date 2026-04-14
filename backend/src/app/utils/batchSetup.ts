import { AppDataSource } from "../db/data-source";
import { Batch } from "../modules/batch/batch.entity";

export async function setupInitialBatches() {
  const batchRepo = AppDataSource.getRepository(Batch);

  const batches = ["2021", "2022", "2023", "2024", "2025"];

  for (const batchName of batches) {
    const exists = await batchRepo.findOne({ where: { name: batchName } });
    if (!exists) {
      const batch = batchRepo.create({ name: batchName });
      await batchRepo.save(batch);
      console.log(`Created batch: ${batchName}`);
    }
  }
}

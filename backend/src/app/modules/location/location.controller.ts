import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { UserLocation } from "./userLocation.entity";

const updateLocation = tryCatch(async (req: Request, res: Response) => {
  const { lat, lng } = req.body;
  const userId = req.user.userId;

  const repo = AppDataSource.getRepository(UserLocation);

  let record = await repo.findOne({ where: { user: { user_id: userId } } });

  if (!record) {
    record = repo.create({
      user: { user_id: userId },
      lat,
      lng,
    });
  } else {
    record.lat = lat;
    record.lng = lng;
  }

  await repo.save(record);

  res.json({ success: true });
});

export const LocationController = { updateLocation };

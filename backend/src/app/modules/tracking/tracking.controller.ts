import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { estimateBusLocation } from "./tracking.service";
import { AppDataSource } from "../../db/data-source";
import { UserLocation } from "../location/userLocation.entity";
import { haversine } from "../../utils/haversine";
import { UserRole } from "../user/user.entity";

const requestTracking = tryCatch(async (req: Request, res: Response) => {
  const busId = Number(req.params.busId);
  const io = req.app.get("io");

  const estimate = await estimateBusLocation(busId, new Date());

  // Fallback: if bus not started or ended
  if (!("lat" in estimate)) {
    return res.json({ success: true, estimate });
  }

  // find users in radius 500m
  const locRepo = AppDataSource.getRepository(UserLocation);
  const locations = await locRepo.find({ relations: [UserRole.STUDENT] });

  const radiusUsers = locations.filter((u) => {
    const d = haversine(estimate.lat as number, estimate.lng as number, u.lat, u.lng);
    return d <= 500;
  });

  // Notify only those users
  radiusUsers.forEach((u) => {
    io.to(`user:${u.user.user_id}`).emit("bus_tracking_request", {
      busId,
      message: "Are you currently on this bus?",
      estimate,
    });
  });

  // Return estimate immediately
  return res.json({
    success: true,
    estimate,
    notifiedUsers: radiusUsers.length,
  });
});

export const TrackingController = { requestTracking };

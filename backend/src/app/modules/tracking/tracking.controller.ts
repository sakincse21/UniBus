import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { estimateBusLocation } from "./tracking.service";
import { AppDataSource } from "../../db/data-source";
import { UserLocation } from "../location/userLocation.entity";
import { haversine } from "../../utils/haversine";
import { UserRole } from "../user/user.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { AppError } from "../../errors/AppError";
import { BusSchedule } from "../schedule/busSchedule.entity";

// const requestTracking = tryCatch(async (req: Request, res: Response) => {
//   const busId = Number(req.params.busId);
//   const io = req.app.get("io");

//   const estimate = await estimateBusLocation(busId, new Date());

//   // Fallback: if bus not started or ended
//   if (!("lat" in estimate)) {
//     return res.json({ success: true, estimate });
//   }

//   // find users in radius 500m
//   const locRepo = AppDataSource.getRepository(UserLocation);
//   const locations = await locRepo.find({ relations: [UserRole.STUDENT] });

//   const radiusUsers = locations.filter((u) => {
//     const d = haversine(estimate.lat as number, estimate.lng as number, u.lat, u.lng);
//     return d <= 500;
//   });

//   // Notify only those users
//   radiusUsers.forEach((u) => {
//     io.to(`user:${u.user.user_id}`).emit("bus_tracking_request", {
//       busId,
//       message: "Are you currently on this bus?",
//       estimate,
//     });
//   });

//   // Return estimate immediately
//   return res.json({
//     success: true,
//     estimate,
//     notifiedUsers: radiusUsers.length,
//   });
// });

// backend/src/app/modules/tracking/tracking.controller.ts

const requestTracking = tryCatch(async (req: Request, res: Response) => {
  const busId = Number(req.params.busId);
  const io = req.app.get("io");
  
  const estimate = await estimateBusLocation(busId, new Date());
  
  // Fallback: if bus not started or ended
  if (!("lat" in estimate)) {
    return res.json({ success: true, estimate });
  }

  const locRepo = AppDataSource.getRepository(UserLocation);
  
  // ✅ CORRECT: Use the relation property name "user"
  const locations = await locRepo.find({ 
    relations: ["user"] 
  });

  const radiusUsers = locations.filter((u) => {
    // ✅ Add null check for safety
    if (!u.user) return false;
    const d = haversine(estimate.lat as number, estimate.lng as number, u.lat, u.lng);
    return d <= 500;
  });


  const scheduleRepo = AppDataSource.getRepository(BusSchedule);

    const schedule = await scheduleRepo.findOne({
      where: { bus: { id: busId } },
      relations: ["route"],
    });
    console.log(schedule)
    if (!schedule) throw new AppError("No schedule found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);

  const points = await rpRepo.find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });
  // Notify only those users
  radiusUsers.forEach((u) => {
    // ✅ Ensure io and user exist before emitting
    if (io && u.user?.user_id) {
      io.to(`user:${u.user.user_id}`).emit("bus_tracking_request", {
        busId,
        message: "Are you currently on this bus?",
        estimate,
      });
    }
  });

  return res.json({
    success: true,
    estimate,
    points,
    notifiedUsers: radiusUsers.length,
  });
});

export const TrackingController = { requestTracking };

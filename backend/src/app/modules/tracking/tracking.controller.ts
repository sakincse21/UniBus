import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { estimateBusLocation } from "./tracking.service";
import { AppDataSource } from "../../db/data-source";
import { UserLocation } from "../location/userLocation.entity";
import { haversine } from "../../utils/haversine";
import { RoutePoint } from "../route/routePoint.entity";
import { AppError } from "../../errors/AppError";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";

const requestTracking = tryCatch(async (req: Request, res: Response) => {
  const busId = Number(req.params.busId);
  const io = req.app.get("io");

  const estimate = await estimateBusLocation(busId, new Date());

  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route"],
  });

  let points: RoutePoint[] = [];
  if (schedule) {
    const rpRepo = AppDataSource.getRepository(RoutePoint);
    points = await rpRepo.find({
      where: { route: { id: schedule.route.id } },
      order: { sequence: "ASC" },
    });
  }

  if (!("lat" in estimate)) {
    return res.json({
      success: true,
      estimate,
      points,
      routeId: schedule?.route?.id || null,
      isLive: false,
      notifiedUsers: 0,
      startTime: schedule?.startTime || null,
      endTime: schedule?.endTime || null,
    });
  }

  const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
  const activeSession = await sessionRepo.findOne({
    where: { bus: { id: busId }, active: true },
  });

  if (activeSession) {
    const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
    const liveLoc = await locRepo.findOne({ where: { bus: { id: busId } } });

    return res.json({
      success: true,
      estimate: liveLoc
        ? { lat: liveLoc.lat, lng: liveLoc.lng, confidence: liveLoc.confidence, mode: "live" }
        : estimate,
      points,
      routeId: schedule?.route?.id || null,
      notifiedUsers: 0,
      isLive: !!liveLoc,
      startTime: schedule?.startTime || null,
      endTime: schedule?.endTime || null,
    });
  }

  const userLocRepo = AppDataSource.getRepository(UserLocation);
  const locations = await userLocRepo.find({ relations: ["user"] });

  const radiusUsers = locations.filter((u) => {
    if (!u.user) return false;
    const d = haversine(estimate.lat as number, estimate.lng as number, u.lat, u.lng);
    return d <= 500;
  });

  radiusUsers.forEach((u) => {
    if (io && u.user?.user_id) {
      io.to(`user:${u.user.user_id}`).emit("bus_tracking_request", {
        busId,
        routeId: schedule?.route?.id,
        message: "Are you currently on this bus?",
        estimate,
      });
    }
  });

  return res.json({
    success: true,
    estimate,
    points,
    routeId: schedule?.route?.id || null,
    notifiedUsers: radiusUsers.length,
    isLive: false,
    startTime: schedule?.startTime || null,
    endTime: schedule?.endTime || null,
  });
});

// Get active tracking sessions
const getActiveSessions = tryCatch(async (_req: Request, res: Response) => {
  const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
  const sessions = await sessionRepo.find({
    where: { active: true },
    relations: ["bus", "user"],
  });

  res.json({ success: true, data: sessions });
});

export const TrackingController = { requestTracking, getActiveSessions };

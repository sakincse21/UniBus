import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { estimateBusLocation, getScheduleEndTime } from "./tracking.service";
import { AppDataSource } from "../../db/data-source";
import { UserLocation } from "../location/userLocation.entity";
import { haversine } from "../../utils/haversine";
import { RoutePoint } from "../route/routePoint.entity";
import { AppError } from "../../errors/AppError";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { Bus } from "../bus/bus.entity";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";
import { User } from "../user/user.entity";
import { TrackingRequestService } from "./trackingRequest.service";
import { TrackingRequestStatus } from "./trackingRequest.entity";
import { In } from "typeorm";

const trackingUserSelect: (keyof User)[] = [
  "user_id",
  "name",
  "email",
  "pushToken",
];

const NEARBY_RADIUS_METERS = 500;

function resolveBusId(req: Request): number {
  const bodyBusId = Number(req.body?.busId);
  const paramsBusId = Number(req.params.busId);

  const busId =
    Number.isFinite(bodyBusId) && bodyBusId > 0
      ? bodyBusId
      : paramsBusId;

  if (!Number.isFinite(busId) || busId <= 0) {
    throw new AppError("Valid busId is required", 400);
  }

  return busId;
}

async function getRoutePointsForBus(busId: number): Promise<{
  points: RoutePoint[];
  routeId: number | null;
  startTime: string | null;
  endTime: string | null;
  busNumber: string | null;
}> {
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route", "bus"],
  });

  let points: RoutePoint[] = [];
  if (schedule?.route?.id) {
    const rpRepo = AppDataSource.getRepository(RoutePoint);
    points = await rpRepo.find({
      where: { route: { id: schedule.route.id } },
      order: { sequence: "ASC" },
    });
  }

  return {
    points,
    routeId: schedule?.route?.id || null,
    startTime: schedule?.startTime || null,
    endTime: schedule?.endTime || null,
    busNumber: schedule?.bus?.busNumber || null,
  };
}

const requestTracking = tryCatch(async (req: Request, res: Response) => {
  const busId = resolveBusId(req);
  const io = req.app.get("io");

  const estimate = await estimateBusLocation(busId, new Date());
  const { points, routeId, startTime, endTime, busNumber } = await getRoutePointsForBus(busId);

  let scheduleEndsAt: Date | null = null;
  try {
    scheduleEndsAt = await getScheduleEndTime(busId);
  } catch {
    scheduleEndsAt = null;
  }

  const resolvedBusNumber = busNumber
    ? busNumber
    : (
        await AppDataSource.getRepository(Bus).findOne({
          where: { id: busId },
          select: ["id", "busNumber"],
        })
      )?.busNumber || null;

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
      routeId,
      busNumber: resolvedBusNumber,
      notifiedUsers: 0,
      pushNotifiedUsers: 0,
      requestIds: [],
      isLive: !!liveLoc,
      startTime,
      endTime,
    });
  }

  const userRepo = AppDataSource.getRepository(User);

  const userLocRepo = AppDataSource.getRepository(UserLocation);
  const locations = await userLocRepo.find({ relations: ["user"] });

  const proximityTarget =
    "lat" in estimate &&
    typeof estimate.lat === "number" &&
    typeof estimate.lng === "number"
      ? { lat: estimate.lat, lng: estimate.lng }
      : null;

  const nearbyUserIds = proximityTarget
    ? locations
        .filter((entry) => {
          if (!entry.user?.user_id) return false;
          const distance = haversine(
            proximityTarget.lat,
            proximityTarget.lng,
            entry.lat,
            entry.lng,
          );
          return distance <= NEARBY_RADIUS_METERS;
        })
        .map((entry) => entry.user.user_id)
        .filter((userId) => userId !== req.user.userId)
    : [];

  const receiverIds = [...new Set(nearbyUserIds)];

  const receivers = receiverIds.length
    ? await userRepo.find({
        where: { user_id: In(receiverIds) },
        select: trackingUserSelect,
      })
    : [];

  const requester = await userRepo.findOne({
    where: { user_id: req.user.userId },
    select: trackingUserSelect,
  });

  if (!requester) {
    throw new AppError("Requester not found", 404);
  }

  const estimatePayload =
    "lat" in estimate &&
    typeof estimate.lat === "number" &&
    typeof estimate.lng === "number"
      ? {
          lat: estimate.lat,
          lng: estimate.lng,
          confidence: estimate.confidence,
        }
      : undefined;

  const requestResult = await TrackingRequestService.createRequestsAndNotify({
    requesterId: requester.user_id,
    requesterName: requester.name,
    requesterEmail: requester.email,
    busId,
    busNumber: resolvedBusNumber,
    routeId,
    scheduleEndsAt,
    estimate: estimatePayload,
    receivers,
    io,
  });

  return res.json({
    success: true,
    estimate,
    points,
    routeId,
    busNumber: resolvedBusNumber,
    notifiedUsers: requestResult.notifiedUsers,
    pushNotifiedUsers: requestResult.pushNotifiedUsers,
    requestIds: requestResult.requestIds,
    isLive: false,
    startTime,
    endTime,
  });
});

const getPendingTrackingRequests = tryCatch(async (req: Request, res: Response) => {
  const data = await TrackingRequestService.getPendingRequests(req.user.userId);

  res.json({
    success: true,
    data,
  });
});

const respondTrackingRequest = tryCatch(async (req: Request, res: Response) => {
  const requestId = Number(req.params.id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw new AppError("Valid request id is required", 400);
  }

  const rawStatus = String(req.body?.status || "").toLowerCase();
  if (
    rawStatus !== TrackingRequestStatus.ACCEPTED &&
    rawStatus !== TrackingRequestStatus.REJECTED
  ) {
    throw new AppError("status must be either accepted or rejected", 400);
  }

  const data = await TrackingRequestService.respondToRequest(
    requestId,
    req.user.userId,
    rawStatus as TrackingRequestStatus.ACCEPTED | TrackingRequestStatus.REJECTED,
  );

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${data.requester.userId}`).emit("tracking_request_responded", {
      requestId: data.id,
      busId: data.busId,
      status: data.status,
      responderId: req.user.userId,
    });
  }

  res.json({
    success: true,
    data,
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

export const TrackingController = {
  requestTracking,
  getPendingTrackingRequests,
  respondTrackingRequest,
  getActiveSessions,
};

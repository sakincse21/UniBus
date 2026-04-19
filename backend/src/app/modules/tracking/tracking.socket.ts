import { AppDataSource } from "../../db/data-source";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";
import { UserLocation } from "../location/userLocation.entity";
import { estimateBusLocation, getScheduleEndTime } from "./tracking.service";
import { pointToPolylineDistance } from "../../utils/estimate.util";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { Bus } from "../bus/bus.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { LessThan } from "typeorm";
import { TrackingRequest, TrackingRequestStatus } from "./trackingRequest.entity";
import { processGpsUpdate } from "./tracking.helper";

const SESSION_CLEANUP_INTERVAL_MS = 10000;
export const ROUTE_MATCH_RADIUS_METERS = 25000000; // Increased for widespread testing (was 250)
const DISCONNECT_GRACE_MS = 30000;
let sessionCleanupTimer: ReturnType<typeof setInterval> | null = null;
const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isPoolClosedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /pool is closed/i.test(message);
}

function stopSessionCleanup() {
  if (!sessionCleanupTimer) return;
  clearInterval(sessionCleanupTimer);
  sessionCleanupTimer = null;
}

function clearDisconnectCleanup(userId?: string) {
  if (!userId) return;
  const timer = disconnectCleanupTimers.get(userId);
  if (!timer) return;
  clearTimeout(timer);
  disconnectCleanupTimers.delete(userId);
}

async function getTrackingRooms(busId: number): Promise<string[]> {
  const rooms = [`bus:${busId}`];
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route"],
  });

  if (schedule?.route?.id) {
    rooms.unshift(`route:${schedule.route.id}`);
  }

  return [...new Set(rooms)];
}

export async function emitToTrackingRooms(
  io: any,
  busId: number,
  event: string,
  payload: Record<string, unknown>,
) {
  const rooms = await getTrackingRooms(busId);

  rooms.forEach((room) => {
    io.to(room).emit(event, payload);
  });
}

export async function emitToRequestParticipants(
  io: any,
  request: TrackingRequest,
  event: string,
  payload: Record<string, unknown>,
) {
  if (request.requesterId) {
    io.to(`user:${request.requesterId}`).emit(event, payload);
  }

  if (request.receiverId && request.receiverId !== request.requesterId) {
    io.to(`user:${request.receiverId}`).emit(event, payload);
  }
}

export async function getBusNumberById(busId: number): Promise<string | null> {
  const bus = await AppDataSource.getRepository(Bus).findOne({
    where: { id: busId },
    select: ["id", "busNumber"],
  });

  return bus?.busNumber || null;
}

async function resolveSessionMetaForBus(busId: number): Promise<{
  expiresAt: Date;
  routeId: number | null;
}> {
  let expiresAt: Date;
  let routeId: number | null = null;

  try {
    expiresAt = await getScheduleEndTime(busId);

    const scheduleRepo = AppDataSource.getRepository(BusSchedule);
    const schedule = await scheduleRepo.findOne({
      where: { bus: { id: busId } },
      relations: ["route"],
    });

    if (schedule?.route?.id) {
      routeId = schedule.route.id;
    }
  } catch {
    // 15 minutes default if schedule info is unavailable.
    expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  }

  return { expiresAt, routeId };
}

export async function getDistanceFromRoute(
  busId: number,
  lat: number,
  lng: number,
): Promise<number | null> {
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route"],
  });

  if (!schedule?.route?.id) {
    return null;
  }

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const routePoints = await rpRepo.find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });

  if (routePoints.length < 2) {
    return null;
  }

  return pointToPolylineDistance(lat, lng, routePoints);
}

type TrackingStartAck = {
  ok: boolean;
  message?: string;
  mode?: string;
  startTime?: string;
  endTime?: string;
  dist?: number;
  busNumber?: string | null;
};

type TrackingRequestMatch = {
  busId: number;
  requestId?: number;
  userId: string;
};

async function findEligibleTrackingRequest({
  busId,
  requestId,
  userId,
}: TrackingRequestMatch): Promise<TrackingRequest | null> {
  const now = new Date();
  const trackingRequestRepo = AppDataSource.getRepository(TrackingRequest);

  const query = trackingRequestRepo
    .createQueryBuilder("request")
    .where("request.receiverId = :receiverId", { receiverId: userId })
    .andWhere("request.busId = :busId", { busId })
    .andWhere("(request.expiresAt IS NULL OR request.expiresAt > :now)", {
      now,
    })
    .andWhere("request.status IN (:...statuses)", {
      statuses: [TrackingRequestStatus.ACCEPTED, TrackingRequestStatus.PENDING],
    });

  if (Number.isFinite(requestId)) {
    query.andWhere("request.id = :requestId", { requestId });
  }

  return query.orderBy("request.createdAt", "DESC").getOne();
}

export async function findAcceptedRequestForReceiver(
  busId: number,
  receiverId: string,
): Promise<TrackingRequest | null> {
  const now = new Date();
  return AppDataSource.getRepository(TrackingRequest)
    .createQueryBuilder("request")
    .where("request.receiverId = :receiverId", { receiverId })
    .andWhere("request.busId = :busId", { busId })
    .andWhere("request.status = :status", {
      status: TrackingRequestStatus.ACCEPTED,
    })
    .andWhere("(request.expiresAt IS NULL OR request.expiresAt > :now)", {
      now,
    })
    .orderBy("request.updatedAt", "DESC")
    .getOne();
}

async function ensureRequestAccepted(request: TrackingRequest): Promise<void> {
  if (request.status === TrackingRequestStatus.ACCEPTED) {
    return;
  }

  request.status = TrackingRequestStatus.ACCEPTED;
  await AppDataSource.getRepository(TrackingRequest).save(request);

  await AppDataSource.getRepository(TrackingRequest)
    .createQueryBuilder("tracking_request")
    .update(TrackingRequest)
    .set({ status: TrackingRequestStatus.REJECTED })
    .where("id != :id", { id: request.id })
    .andWhere("requesterId = :requesterId", { requesterId: request.requesterId })
    .andWhere("busId = :busId", { busId: request.busId })
    .andWhere("status = :status", { status: TrackingRequestStatus.PENDING })
    .execute();
}

async function upsertLiveBusLocation(
  busId: number,
  lat: number,
  lng: number,
): Promise<void> {
  const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
  let loc = await locRepo.findOne({ where: { bus: { id: busId } } });

  if (!loc) {
    loc = locRepo.create({ bus: { id: busId }, lat, lng, confidence: 0.95 });
  } else {
    loc.lat = lat;
    loc.lng = lng;
    loc.confidence = 0.95;
  }

  await locRepo.save(loc);
}

async function validateActiveScheduleWindow(busId: number): Promise<{
  ok: boolean;
  message?: string;
  mode?: string;
  startTime?: string;
  endTime?: string;
}> {
  try {
    const estimate = await estimateBusLocation(busId, new Date());

    if ("lat" in estimate && "lng" in estimate) {
      return { ok: true };
    }

    const mode = typeof estimate.mode === "string" ? estimate.mode : undefined;
    const startTime =
      typeof estimate.startTime === "string" ? estimate.startTime : undefined;
    const endTime =
      typeof estimate.endTime === "string" ? estimate.endTime : undefined;

    if (mode === "not_started") {
      return {
        ok: false,
        mode,
        startTime,
        endTime,
        message: startTime
          ? `Bus route has not started yet (starts at ${startTime.slice(0, 5)})`
          : "Bus route has not started yet",
      };
    }

    if (mode === "ended") {
      return {
        ok: false,
        mode,
        startTime,
        endTime,
        message: "Bus route is currently off time",
      };
    }

    return {
      ok: false,
      mode,
      startTime,
      endTime,
      message: "Bus route is not active right now",
    };
  } catch {
    return {
      ok: false,
      message: "Unable to verify bus schedule right now",
    };
  }
}

function startSessionCleanup(io: any) {
  stopSessionCleanup();

  sessionCleanupTimer = setInterval(async () => {
    if (!AppDataSource.isInitialized) {
      return;
    }

    try {
      const repo = AppDataSource.getRepository(LiveTrackingSession);
      const expired = await repo.find({
        where: { active: true, expiresAt: LessThan(new Date()) },
        relations: ["bus", "user"],
      });

      for (const session of expired) {
        session.active = false;
        await repo.save(session);

        if (session.user?.user_id) {
          io.to(`user:${session.user.user_id}`).emit("tracking_expired", {
            busId: session.bus?.id,
            busNumber: session.bus?.busNumber || null,
            message: "Tracking session expired (bus schedule ended)",
          });
        }

        if (session.bus?.id) {
          await emitToTrackingRooms(io, session.bus.id, "bus_tracking_ended", {
            busId: session.bus.id,
            busNumber: session.bus?.busNumber || null,
          });
        }
      }
    } catch (err) {
      if (!AppDataSource.isInitialized || isPoolClosedError(err)) {
        return;
      }
      console.error("Error during session cleanup:", err);
    }
  }, SESSION_CLEANUP_INTERVAL_MS);

  sessionCleanupTimer.unref?.();
}

export const registerTrackingSockets = (io: any) => {
  startSessionCleanup(io);

  const stopCleanup = () => {
    stopSessionCleanup();
  };

  io.on("connection", (socket: any) => {
    const user = socket.user;

    if (user?.userId) {
      clearDisconnectCleanup(user.userId);

      socket.join(`user:${user.userId}`);
      socket.join(`role:${user.role}`);

      if (user.batchId) {
        socket.join(`batch:${user.batchId}`);
      }
    }

    socket.on(
      "location_update",
      async ({ lat, lng }: { lat: number; lng: number }) => {
        const user = socket.user;
        if (!user?.userId) return;
        if (typeof lat !== "number" || typeof lng !== "number") return;

        try {
          const repo = AppDataSource.getRepository(UserLocation);
          let record = await repo.findOne({
            where: { user: { user_id: user.userId } },
          });

          if (!record) {
            record = repo.create({
              user: { user_id: user.userId },
              lat,
              lng,
            });
          } else {
            record.lat = lat;
            record.lng = lng;
          }

          await repo.save(record);
        } catch {
          console.error("Failed to update user location for user:", user.userId);
        }
      }
    );

    socket.on(
      "accept_tracking",
      async (
        {
          busId,
          requestId,
          lat,
          lng,
        }: {
          busId: number;
          requestId?: number;
          lat?: number;
          lng?: number;
        },
        ack?: (payload: TrackingStartAck) => void,
      ) => {
      const user = socket.user;
      if (!user) {
        ack?.({ ok: false, message: "Unauthorized" });
        return;
      }

      if (!Number.isFinite(busId) || busId <= 0) {
        ack?.({ ok: false, message: "Valid busId is required" });
        return;
      }

      const parsedRequestId =
        Number.isFinite(requestId) && Number(requestId) > 0
          ? Number(requestId)
          : undefined;

      const eligibleRequest = await findEligibleTrackingRequest({
        busId,
        requestId: parsedRequestId,
        userId: user.userId,
      });

      if (!eligibleRequest) {
        const message = "No accepted tracking request found for this bus";
        if (!ack) {
          socket.emit("tracking_rejected", {
            busId,
            message,
          });
        }
        ack?.({ ok: false, message });
        return;
      }

      await ensureRequestAccepted(eligibleRequest);

      // Allow testing anywhere initially without schedule constraint (or make it permissive)
      // We will skip `validateActiveScheduleWindow` for now, or just log and continue
      const scheduleCheck = await validateActiveScheduleWindow(busId);
      if (!scheduleCheck.ok && process.env.NODE_ENV !== 'development') {
        if (!ack) {
          socket.emit("tracking_unavailable", {
            busId,
            mode: scheduleCheck.mode,
            message: scheduleCheck.message,
            startTime: scheduleCheck.startTime,
            endTime: scheduleCheck.endTime,
          });
        }

        // Just un-comment below to enforce schedule checking again
        /*
        ack?.({
          ok: false,
          message: scheduleCheck.message,
          mode: scheduleCheck.mode,
        });
        return;
        */
      }

      const repo = AppDataSource.getRepository(LiveTrackingSession);

      const active = await repo.findOne({
        where: { bus: { id: busId }, active: true },
      });

      if (active) {
        const message = "Another user is already tracking this bus";
        if (!ack) {
          socket.emit("tracking_rejected", {
            busId,
            message,
          });
        }
        ack?.({ ok: false, message });
        return;
      }

      const { expiresAt, routeId } = await resolveSessionMetaForBus(busId);
      const busNumber = await getBusNumberById(busId);

      const session = repo.create({
        bus: { id: busId },
        user: { user_id: user.userId },
        startedAt: new Date(),
        expiresAt,
        active: true,
      });

      await repo.save(session);

      socket.emit("tracking_started", {
        busId,
        busNumber,
        expiresAt: expiresAt.toISOString(),
      });

      await emitToTrackingRooms(io, busId, "bus_live_tracking_started", {
        busId,
        busNumber,
        routeId,
      });

      await emitToRequestParticipants(io, eligibleRequest, "bus_live_tracking_started", {
        busId,
        busNumber,
        routeId,
      });

      const hasInitialCoords = Number.isFinite(lat) && Number.isFinite(lng);
      if (hasInitialCoords) {
        await upsertLiveBusLocation(busId, Number(lat), Number(lng));

        const locationPayload = {
          busId,
          busNumber,
          lat: Number(lat),
          lng: Number(lng),
          estimate: { lat: Number(lat), lng: Number(lng), confidence: 0.95 },
        };

        await emitToTrackingRooms(io, busId, "bus_location_update", locationPayload);
        await emitToRequestParticipants(
          io,
          eligibleRequest,
          "bus_location_update",
          locationPayload,
        );
      }

      ack?.({ ok: true, busNumber });
      },
    );

    socket.on(
      "volunteer_tracking",
      async (
        {
          busId,
          lat,
          lng,
        }: { busId: number; lat: number; lng: number },
        ack?: (payload: TrackingStartAck) => void,
      ) => {
        const user = socket.user;
        if (!user?.userId) {
          ack?.({ ok: false, message: "Unauthorized" });
          return;
        }

        if (
          !Number.isFinite(busId) ||
          busId <= 0 ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng)
        ) {
          ack?.({ ok: false, message: "Valid busId and location are required" });
          return;
        }

        const scheduleCheck = await validateActiveScheduleWindow(busId);
        if (!scheduleCheck.ok) {
          if (!ack) {
            socket.emit("tracking_unavailable", {
              busId,
              mode: scheduleCheck.mode,
              message: scheduleCheck.message,
              startTime: scheduleCheck.startTime,
              endTime: scheduleCheck.endTime,
            });
          }

          ack?.({
            ok: false,
            message: scheduleCheck.message,
            mode: scheduleCheck.mode,
            startTime: scheduleCheck.startTime,
            endTime: scheduleCheck.endTime,
          });
          return;
        }

        const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
        const active = await sessionRepo.findOne({
          where: { bus: { id: busId }, active: true },
        });

        if (active) {
          const message = "Another user is already tracking this bus";
          ack?.({ ok: false, message });
          return;
        }

        const distance = await getDistanceFromRoute(busId, lat, lng);
        if (distance === null) {
          ack?.({
            ok: false,
            message: "Route validation is unavailable for this bus right now",
          });
          return;
        }

        if (distance > ROUTE_MATCH_RADIUS_METERS) {
          const rounded = Math.round(distance);
          const message = `You are ${rounded}m away from this route`;
          ack?.({ ok: false, message, dist: rounded });
          return;
        }

        const { expiresAt, routeId } = await resolveSessionMetaForBus(busId);
        const busNumber = await getBusNumberById(busId);

        const session = sessionRepo.create({
          bus: { id: busId },
          user: { user_id: user.userId },
          startedAt: new Date(),
          expiresAt,
          active: true,
        });

        await sessionRepo.save(session);

        const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
        let loc = await locRepo.findOne({ where: { bus: { id: busId } } });

        if (!loc) {
          loc = locRepo.create({ bus: { id: busId }, lat, lng, confidence: 0.95 });
        } else {
          loc.lat = lat;
          loc.lng = lng;
          loc.confidence = 0.95;
        }

        await locRepo.save(loc);

        socket.emit("tracking_started", {
          busId,
          busNumber,
          expiresAt: expiresAt.toISOString(),
        });

        await emitToTrackingRooms(io, busId, "bus_live_tracking_started", {
          busId,
          busNumber,
          routeId,
        });

        await emitToTrackingRooms(io, busId, "bus_location_update", {
          busId,
          lat,
          lng,
          estimate: { lat, lng, confidence: 0.95 },
        });

        ack?.({ ok: true });
      },
    );


    socket.on("view_bus_route", ({ busId, routeId }: { busId?: number; routeId?: number }) => {
      // Join both route and bus rooms when available so clients continue receiving
      // updates even if one identifier becomes unavailable or changes.
      const rooms = [
        routeId ? `route:${routeId}` : null,
        busId ? `bus:${busId}` : null,
      ].filter((room): room is string => Boolean(room));

      if (rooms.length > 0) {
        rooms.forEach((room) => {
          socket.join(room);
          console.log(`Socket ${socket.id} joined room: ${room}`);
        });

        // Send current locations of any actively tracked buses on this route
        (async () => {
          try {
            if (routeId) {
              const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
              const activeSessions = await sessionRepo.find({
                where: { active: true },
                relations: ["bus"],
              });

              // Filter for sessions whose buses are on this route
              for (const session of activeSessions) {
                const scheduleRepo = AppDataSource.getRepository(BusSchedule);
                const schedule = await scheduleRepo.findOne({
                  where: { bus: { id: session.bus?.id } },
                  relations: ["route"],
                });

                if (schedule?.route?.id === routeId) {
                  // Get the latest location for this bus
                  const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
                  const loc = await locRepo.findOne({
                    where: { bus: { id: session.bus?.id } },
                  });

                  if (loc) {
                    socket.emit("bus_location_update", {
                      busId: session.bus?.id,
                      lat: loc.lat,
                      lng: loc.lng,
                      estimate: { lat: loc.lat, lng: loc.lng, confidence: loc.confidence },
                    });
                  }
                }
              }
            } else if (busId) {
              const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
              const loc = await locRepo.findOne({
                where: { bus: { id: busId } },
              });

              if (loc) {
                socket.emit("bus_location_update", {
                  busId,
                  lat: loc.lat,
                  lng: loc.lng,
                  estimate: { lat: loc.lat, lng: loc.lng, confidence: loc.confidence },
                });
              }
            }
          } catch (err) {
            console.error("Error sending initial locations:", err);
          }
        })();
      }
    });

    socket.on("leave_bus_route", ({ busId, routeId }: { busId?: number; routeId?: number }) => {
      // Leave both rooms to keep subscriptions clean.
      const rooms = [
        routeId ? `route:${routeId}` : null,
        busId ? `bus:${busId}` : null,
      ].filter((room): room is string => Boolean(room));

      if (rooms.length > 0) {
        rooms.forEach((room) => {
          socket.leave(room);
          console.log(`Socket ${socket.id} left room: ${room}`);
        });
      }
    });

    socket.on(
      "gps_update",
      async ({ busId, lat, lng }: { busId: number; lat: number; lng: number }) => {
        const user = socket.user;
        if (!user) return;

        await processGpsUpdate(io, { userId: user.userId }, lat, lng, busId, socket);
      },
    );

    /**
     * User stops tracking voluntarily
     */
    socket.on("stop_tracking", async ({ busId }: { busId: number }) => {
      const user = socket.user;
      if (!user) return;

      const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
      const session = await sessionRepo.findOne({
        where: {
          bus: { id: busId },
          user: { user_id: user.userId },
          active: true,
        },
      });

      if (session) {
        session.active = false;
        await sessionRepo.save(session);

        socket.emit("tracking_stopped", { busId });
        await emitToTrackingRooms(io, busId, "bus_tracking_ended", {
          busId,
          busNumber: await getBusNumberById(busId),
        });
      }
    });

    socket.on("disconnect", async () => {
      const user = socket.user;
      if (!user?.userId) return;

      clearDisconnectCleanup(user.userId);

      const timer = setTimeout(async () => {
        disconnectCleanupTimers.delete(user.userId);

        if (!AppDataSource.isInitialized) {
          return;
        }

        const userRoom = io?.sockets?.adapter?.rooms?.get(`user:${user.userId}`);
        if (userRoom && userRoom.size > 0) {
          return;
        }

        const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
        const activeSessions = await sessionRepo.find({
          where: { user: { user_id: user.userId }, active: true },
          relations: ["bus"],
        });

        for (const session of activeSessions) {
          session.active = false;
          await sessionRepo.save(session);
          if (session.bus?.id) {
            await emitToTrackingRooms(io, session.bus.id, "bus_tracking_ended", {
              busId: session.bus.id,
              busNumber: session.bus?.busNumber || null,
            });
          }
        }
      }, DISCONNECT_GRACE_MS);

      disconnectCleanupTimers.set(user.userId, timer);
    });
  });

  return stopCleanup;
};

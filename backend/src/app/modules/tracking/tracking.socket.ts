import { AppDataSource } from "../../db/data-source";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";
import { UserLocation } from "../location/userLocation.entity";
import { getScheduleEndTime } from "./tracking.service";
import { pointToPolylineDistance } from "../../utils/estimate.util";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { LessThan } from "typeorm";

const SESSION_CLEANUP_INTERVAL_MS = 10000;
let sessionCleanupTimer: ReturnType<typeof setInterval> | null = null;

function isPoolClosedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /pool is closed/i.test(message);
}

function stopSessionCleanup() {
  if (!sessionCleanupTimer) return;
  clearInterval(sessionCleanupTimer);
  sessionCleanupTimer = null;
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

async function emitToTrackingRooms(
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
            message: "Tracking session expired (bus schedule ended)",
          });
        }

        if (session.bus?.id) {
          await emitToTrackingRooms(io, session.bus.id, "bus_tracking_ended", {
            busId: session.bus.id,
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

    socket.on("accept_tracking", async ({ busId }: { busId: number }) => {
      const user = socket.user;
      if (!user) return;

      const repo = AppDataSource.getRepository(LiveTrackingSession);

      const active = await repo.findOne({
        where: { bus: { id: busId }, active: true },
      });

      if (active) {
        socket.emit("tracking_rejected", {
          busId,
          message: "Another user is already tracking this bus",
        });
        return;
      }

      let expiresAt: Date;
      let routeId: number | null = null;
      
      try {
        expiresAt = await getScheduleEndTime(busId);
        
        // Fetch the route associated with this bus
        const scheduleRepo = AppDataSource.getRepository(BusSchedule);
        const schedule = await scheduleRepo.findOne({
          where: { bus: { id: busId } },
          relations: ["route"],
        });
        if (schedule?.route) {
          routeId = schedule.route.id;
        }
      } catch {
        //15minuetes default if schedule info is unavailable
        expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      }

      const session = repo.create({
        bus: { id: busId },
        user: { user_id: user.userId },
        startedAt: new Date(),
        expiresAt,
        active: true,
      });

      await repo.save(session);

      socket.emit("tracking_started", { busId, expiresAt: expiresAt.toISOString() });

      await emitToTrackingRooms(io, busId, "bus_live_tracking_started", {
        busId,
        routeId,
      });
    });


    socket.on("view_bus_route", ({ busId, routeId }: { busId?: number; routeId?: number }) => {
      // Join the room for this bus/route to receive live location updates
      // Prefer route room if available, fallback to bus room
      const room = routeId ? `route:${routeId}` : busId ? `bus:${busId}` : undefined;
      if (room) {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room: ${room}`);

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
      // Leave the room for this bus/route when navigating away
      const room = routeId ? `route:${routeId}` : busId ? `bus:${busId}` : undefined;
      if (room) {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room: ${room}`);
      }
    });

    socket.on(
      "gps_update",
      async ({ busId, lat, lng }: { busId: number; lat: number; lng: number }) => {
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

        if (!session) return;

        // Check if session has expired
        if (new Date() > session.expiresAt) {
          session.active = false;
          await sessionRepo.save(session);

          socket.emit("tracking_expired", {
            busId,
            message: "Tracking session expired (bus schedule ended)",
          });
          await emitToTrackingRooms(io, busId, "bus_tracking_ended", { busId });
          return;
        }

        // ── Off-route check: 250 m from nearest polyline segment ─────────────
        try {
          const scheduleRepo = AppDataSource.getRepository(BusSchedule);
          const schedule = await scheduleRepo.findOne({
            where: { bus: { id: busId } },
            relations: ["route"],
          });

          if (schedule) {
            const rpRepo = AppDataSource.getRepository(RoutePoint);
            const routePoints = await rpRepo.find({
              where: { route: { id: schedule.route.id } },
              order: { sequence: "ASC" },
            });

            if (routePoints.length >= 2) {
              const dist = pointToPolylineDistance(lat, lng, routePoints);
              if (dist > 250) {
                session.active = false;
                await sessionRepo.save(session);

                socket.emit("tracking_off_route", {
                  busId,
                  dist: Math.round(dist),
                  message: `You appear to be ${Math.round(dist)}m off the route. Tracking stopped.`,
                });
                await emitToTrackingRooms(io, busId, "bus_tracking_ended", { busId });
                return;
              }
            }
          }
        } catch (err) {
          console.error("Off-route check failed:", err);
          // Non-fatal — continue saving location
        }

        // Update bus location
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

        // Broadcast live bus location to all connected clients
        // Broadcast to route if available, otherwise use bus room
        await emitToTrackingRooms(io, busId, "bus_location_update", {
          busId, 
          lat, 
          lng, 
          estimate: { lat, lng, confidence: 0.95 }
        });
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
        await emitToTrackingRooms(io, busId, "bus_tracking_ended", { busId });
      }
    });

    socket.on("disconnect", async () => {
      const user = socket.user;
      if (!user) return;

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
          });
        }
      }
    });
  });

  return stopCleanup;
};

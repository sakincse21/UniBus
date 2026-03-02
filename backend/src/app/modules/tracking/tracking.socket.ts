import { AppDataSource } from "../../db/data-source";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";
import { UserLocation } from "../location/userLocation.entity";
import { getScheduleEndTime } from "./tracking.service";
import { pointToPolylineDistance } from "../../utils/estimate.util";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { LessThan } from "typeorm";

function startSessionCleanup(io: any) {
  setInterval(async () => {
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

        io.emit("bus_tracking_ended", { busId: session.bus?.id });
      }
    } catch (err) {
      console.error("Error during session cleanup:", err);
    }
  }, 10000); 
}

export const registerTrackingSockets = (io: any) => {
  startSessionCleanup(io);

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
      try {
        expiresAt = await getScheduleEndTime(busId);
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

      io.emit("bus_live_tracking_started", { busId });
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
          io.emit("bus_tracking_ended", { busId });
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
                io.emit("bus_tracking_ended", { busId });
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
        io.emit("bus_location_update", { busId, lat, lng, confidence: 0.95 });
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
        io.emit("bus_tracking_ended", { busId });
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
        io.emit("bus_tracking_ended", { busId: session.bus?.id });
      }
    });
  });
};

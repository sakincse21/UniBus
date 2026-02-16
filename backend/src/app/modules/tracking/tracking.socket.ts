import { AppDataSource } from "../../db/data-source";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";

export const registerTrackingSockets = (io: any) => {
  io.on("connection", (socket: any) => {
    /**
     * ✅ NEW: Join user-specific room on connection
     * This enables targeted notifications later
     */
    // const user = socket.user;
    // if (user?.userId) {
    //   socket.join(`user:${user.userId}`);
    //   console.log(`Socket ${socket.id} joined room user:${user.userId}`);
    // }

    const user = socket.user;

    if (user?.userId) {
      socket.join(`user:${user.userId}`);
      socket.join(`role:${user.role}`);

      if (user.batchId) {
        socket.join(`batch:${user.batchId}`);
      }
    }

    

    /**
     * User accepts tracking request
     */
    socket.on("accept_tracking", async ({ busId }: { busId: number }) => {
      const user = socket.user;
      if (!user) return;

      const repo = AppDataSource.getRepository(LiveTrackingSession);

      const active = await repo.findOne({
        where: { bus: { id: busId }, active: true },
      });

      if (active) {
        socket.emit("tracking_rejected");
        return;
      }

      const session = repo.create({
        bus: { id: busId },
        user: { user_id: user.userId },
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        active: true,
      });

      await repo.save(session);

      socket.emit("tracking_started", { busId });
    });

    /**
     * GPS updates from the volunteer
     */
    socket.on(
      "gps_update",
      async ({
        busId,
        lat,
        lng,
      }: {
        busId: number;
        lat: number;
        lng: number;
      }) => {
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

        if (!session) return; // ignore invalid GPS

        const locRepo = AppDataSource.getRepository(EstimatedBusLocation);

        let loc = await locRepo.findOne({
          where: { bus: { id: busId } },
        });

        if (!loc) {
          loc = locRepo.create({
            bus: { id: busId },
            lat,
            lng,
            confidence: 0.95,
          });
        } else {
          loc.lat = lat;
          loc.lng = lng;
          loc.confidence = 0.95;
        }

        await locRepo.save(loc);

        /**
         * ❗ CHANGED: still broadcast bus location to everyone
         * (viewing the map is public)
         */
        io.emit("bus_location_update", {
          busId,
          lat,
          lng,
          confidence: 0.95,
        });
      },
    );
  });
};

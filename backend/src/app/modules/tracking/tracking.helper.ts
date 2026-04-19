import { ROUTE_MATCH_RADIUS_METERS } from "./tracking.socket";
import { AppDataSource } from "../../db/data-source";
import { LiveTrackingSession } from "./liveTrackingSession.entity";
import { EstimatedBusLocation } from "./estimatedBusLocation.entity";
import { getBusNumberById, emitToTrackingRooms, getDistanceFromRoute, findAcceptedRequestForReceiver, emitToRequestParticipants } from "./tracking.socket";



export async function processGpsUpdate(
  io: any,
  user: { userId: string },
  lat: number,
  lng: number,
  busId?: number,
  socket?: any
) {
  const sessionRepo = AppDataSource.getRepository(LiveTrackingSession);
  
  let qb = sessionRepo.createQueryBuilder("session")
    .leftJoinAndSelect("session.bus", "bus")
    .leftJoinAndSelect("session.user", "user")
    .where("user.user_id = :userId", { userId: user.userId })
    .andWhere("session.active = :active", { active: true });
    
  if (busId) {
    qb = qb.andWhere("bus.id = :busId", { busId });
  }
  
  const sessions = await qb.getMany();
  if (!sessions.length) return;

  for (const session of sessions) {
    const activeBusId = session.bus.id;

    if (new Date() > session.expiresAt) {
      session.active = false;
      await sessionRepo.save(session);

      if (socket) {
        socket.emit("tracking_expired", {
          busId: activeBusId,
          busNumber: await getBusNumberById(activeBusId),
          message: "Tracking session expired (bus schedule ended)",
        });
      }
      await emitToTrackingRooms(io, activeBusId, "bus_tracking_ended", {
        busId: activeBusId,
        busNumber: await getBusNumberById(activeBusId),
      });

      if (session.user && session.user.pushToken) {
        // We'll need to send push to the volunteer who got disconnected.
        try {
          const { sendPushToUsers } = require("../notification/push.service");
          sendPushToUsers([session.user], {
            title: "Tracking Stopped",
            body: "Your tracking session ended automatically.",
            data: { type: "TRACKING_ENDED", busId: activeBusId },
          });
        } catch(e) {}
      }
      continue;
    }

    try {
      const dist = await getDistanceFromRoute(activeBusId, lat, lng);
      if (dist !== null && dist > ROUTE_MATCH_RADIUS_METERS) {
        session.active = false;
        await sessionRepo.save(session);

        if (socket) {
          socket.emit("tracking_off_route", {
            busId: activeBusId,
            busNumber: await getBusNumberById(activeBusId),
            dist: Math.round(dist),
            message: `You appear to be ${Math.round(dist)}m off the route. Tracking stopped.`,
          });
        }
        await emitToTrackingRooms(io, activeBusId, "bus_tracking_ended", {
          busId: activeBusId,
          busNumber: await getBusNumberById(activeBusId),
        });
        continue;
      }
    } catch (err) {
      console.error("Off-route check failed:", err);
    }

    const locRepo = AppDataSource.getRepository(EstimatedBusLocation);
    let loc = await locRepo.findOne({ where: { bus: { id: activeBusId } } });

    if (!loc) {
      loc = locRepo.create({ bus: { id: activeBusId }, lat, lng, confidence: 0.95 });
    } else {
      loc.lat = lat;
      loc.lng = lng;
      loc.confidence = 0.95;
    }
    await locRepo.save(loc);

    const locationPayload = {
      busId: activeBusId,
      lat,
      lng,
      estimate: { lat, lng, confidence: 0.95 },
    };

    await emitToTrackingRooms(io, activeBusId, "bus_location_update", locationPayload);

    try {
        const acceptedRequest = await findAcceptedRequestForReceiver(
        activeBusId,
        user.userId,
        );

        if (acceptedRequest) {
        await emitToRequestParticipants(
            io,
            acceptedRequest,
            "bus_location_update",
            locationPayload,
        );
        }
    } catch(e) {}
  }
}

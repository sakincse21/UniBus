import { sendPushToUsers } from "../notification/push.service";
import { User } from "../user/user.entity";
import { AppError } from "../../errors/AppError";
import trackingRequestRepo from "./trackingRequest.repository";
import { TrackingRequestStatus } from "./trackingRequest.entity";

const REQUEST_EXPIRY_MINUTES = 10;
const MIN_NOTIFICATION_WINDOW_MS = 15000;

type TrackingRequestPayload = {
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  busId: number;
  busNumber?: string | null;
  routeId: number | null;
  scheduleEndsAt?: Date | null;
  estimate?: {
    lat?: number;
    lng?: number;
    confidence?: number;
  };
  receivers: User[];
  io?: {
    to: (room: string) => { emit: (event: string, payload: unknown) => void };
  } | null;
};

type TrackingRequestSummary = {
  id: number;
  busId: number;
  busNumber?: string;
  requester: {
    userId: string;
    name: string;
    email: string;
  };
  status: TrackingRequestStatus;
  createdAt: Date;
  expiresAt: Date | null;
};

async function notifyReceiver(
  payload: TrackingRequestPayload,
  receiver: User,
  request: {
    id: number;
    createdAt: Date;
    expiresAt: Date | null;
  },
): Promise<number> {
  const resolvedBusNumber =
    typeof payload.busNumber === "string" && payload.busNumber.trim().length > 0
      ? payload.busNumber.trim()
      : String(payload.busId);
  const busLabel = `Bus ${resolvedBusNumber}`;

  payload.io?.to(`user:${receiver.user_id}`).emit("bus_tracking_request", {
    type: "TRACKING_REQUEST",
    requestId: request.id,
    busId: payload.busId,
    busNumber: payload.busNumber || null,
    routeId: payload.routeId,
    estimate: payload.estimate,
    requester: {
      userId: payload.requesterId,
      name: payload.requesterName || "A nearby rider",
      email: payload.requesterEmail || "",
    },
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
  });

  return sendPushToUsers([receiver], {
    title: `${busLabel} tracking request`,
    body: `${payload.requesterName || "A nearby rider"} asked if you are on ${busLabel}.`,
    data: {
      type: "TRACKING_REQUEST",
      requestId: request.id,
      busId: payload.busId,
      busNumber: payload.busNumber || null,
      routeId: payload.routeId,
      expiresAt: request.expiresAt?.toISOString() || null,
    },
    channelId: "bus-tracking-requests",
  });
}

async function createRequestsAndNotify(
  payload: TrackingRequestPayload,
): Promise<{ requestIds: number[]; notifiedUsers: number; pushNotifiedUsers: number }> {
  const now = new Date();
  const baseExpiresAt = new Date(now.getTime() + REQUEST_EXPIRY_MINUTES * 60 * 1000);
  const scheduleEndsAt =
    payload.scheduleEndsAt && payload.scheduleEndsAt.getTime() > now.getTime()
      ? payload.scheduleEndsAt
      : null;
  const expiresAt =
    scheduleEndsAt && scheduleEndsAt.getTime() < baseExpiresAt.getTime()
      ? scheduleEndsAt
      : baseExpiresAt;

  if (
    expiresAt.getTime() <= now.getTime() ||
    expiresAt.getTime() - now.getTime() < MIN_NOTIFICATION_WINDOW_MS
  ) {
    return {
      requestIds: [],
      notifiedUsers: 0,
      pushNotifiedUsers: 0,
    };
  }

  const uniqueReceivers = payload.receivers.filter((receiver, index, arr) => {
    return (
      receiver.user_id !== payload.requesterId &&
      arr.findIndex((candidate) => candidate.user_id === receiver.user_id) === index
    );
  });

  const createdRequestIds: number[] = [];
  let notifiedUsers = 0;
  let pushNotifiedUsers = 0;

  for (const receiver of uniqueReceivers) {
    const existing = await trackingRequestRepo.findActivePendingForPair(
      payload.requesterId,
      receiver.user_id,
      payload.busId,
      now,
    );

    if (existing) {
      let activeRequest = existing;

      if (
        !activeRequest.expiresAt ||
        activeRequest.expiresAt.getTime() > expiresAt.getTime()
      ) {
        activeRequest.expiresAt = expiresAt;
        activeRequest = await trackingRequestRepo.save(activeRequest);
      }

      createdRequestIds.push(activeRequest.id);
      notifiedUsers += 1;
      const delivered = await notifyReceiver(payload, receiver, {
        id: activeRequest.id,
        createdAt: activeRequest.createdAt,
        expiresAt: activeRequest.expiresAt,
      });
      pushNotifiedUsers += delivered;
      continue;
    }

    const request = await trackingRequestRepo.createPending({
      requesterId: payload.requesterId,
      receiverId: receiver.user_id,
      busId: payload.busId,
      expiresAt,
    });

    createdRequestIds.push(request.id);
    notifiedUsers += 1;
    const delivered = await notifyReceiver(payload, receiver, {
      id: request.id,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    });

    pushNotifiedUsers += delivered;
  }

  return {
    requestIds: createdRequestIds,
    notifiedUsers,
    pushNotifiedUsers,
  };
}

function toSummary(request: {
  id: number;
  busId: number;
  busNumber?: string | null;
  status: TrackingRequestStatus;
  createdAt: Date;
  expiresAt: Date | null;
  requester: Pick<User, "user_id" | "name" | "email">;
}): TrackingRequestSummary {
  return {
    id: request.id,
    busId: request.busId,
    busNumber: request.busNumber || undefined,
    status: request.status,
    createdAt: request.createdAt,
    expiresAt: request.expiresAt,
    requester: {
      userId: request.requester.user_id,
      name: request.requester.name,
      email: request.requester.email,
    },
  };
}

async function getPendingRequests(receiverId: string): Promise<TrackingRequestSummary[]> {
  const requests = await trackingRequestRepo.findPendingByReceiver(receiverId, new Date());
  return requests.map(toSummary);
}

async function respondToRequest(
  id: number,
  receiverId: string,
  status: TrackingRequestStatus.ACCEPTED | TrackingRequestStatus.REJECTED,
): Promise<TrackingRequestSummary> {
  const request = await trackingRequestRepo.findByIdForReceiver(id, receiverId);

  if (!request) {
    throw new AppError("Tracking request not found", 404);
  }

  if (request.status === status) {
    return toSummary(request);
  }

  if (request.status !== TrackingRequestStatus.PENDING) {
    throw new AppError(`Tracking request is already ${request.status}`, 400);
  }

  if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
    request.status = TrackingRequestStatus.REJECTED;
    await trackingRequestRepo.save(request);
    throw new AppError("Tracking request has expired", 410);
  }

  request.status = status;
  const updated = await trackingRequestRepo.save(request);

if (status === TrackingRequestStatus.ACCEPTED) {
    await trackingRequestRepo.rejectOtherPendingForBus(
      updated.id,
      updated.requesterId,
      updated.busId,
      new Date(),
    );

    if (request.requester && request.requester.pushToken) {
      const busLabel = `the bus`;
      sendPushToUsers([request.requester], {
        title: "Tracking Request Accepted",
        body: `Your request to track ${busLabel} was accepted! You can now view its location.`,
        data: {
          type: "TRACKING_ACCEPTED",
          requestId: request.id,
          busId: request.busId
        },
      }).catch(err => console.error("Failed to send acceptance push:", err));
    }
  }

  return toSummary(updated);
}

export const TrackingRequestService = {
  createRequestsAndNotify,
  getPendingRequests,
  respondToRequest,
};

import { sendPushToUsers } from "../notification/push.service";
import { User } from "../user/user.entity";
import { AppError } from "../../errors/AppError";
import trackingRequestRepo from "./trackingRequest.repository";
import { TrackingRequestStatus } from "./trackingRequest.entity";

const REQUEST_EXPIRY_MINUTES = 10;

type TrackingRequestPayload = {
  requesterId: string;
  requesterName?: string;
  requesterEmail?: string;
  busId: number;
  routeId: number | null;
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
  requester: {
    userId: string;
    name: string;
    email: string;
  };
  status: TrackingRequestStatus;
  createdAt: Date;
  expiresAt: Date | null;
};

async function createRequestsAndNotify(
  payload: TrackingRequestPayload,
): Promise<{ requestIds: number[]; notifiedUsers: number; pushNotifiedUsers: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REQUEST_EXPIRY_MINUTES * 60 * 1000);

  const uniqueReceivers = payload.receivers.filter((receiver, index, arr) => {
    return (
      receiver.user_id !== payload.requesterId &&
      arr.findIndex((candidate) => candidate.user_id === receiver.user_id) === index
    );
  });

  const createdRequestIds: number[] = [];
  let pushNotifiedUsers = 0;

  for (const receiver of uniqueReceivers) {
    const existing = await trackingRequestRepo.findActivePendingForPair(
      payload.requesterId,
      receiver.user_id,
      payload.busId,
      now,
    );

    if (existing) {
      createdRequestIds.push(existing.id);
      continue;
    }

    const request = await trackingRequestRepo.createPending({
      requesterId: payload.requesterId,
      receiverId: receiver.user_id,
      busId: payload.busId,
      expiresAt,
    });

    createdRequestIds.push(request.id);

    payload.io?.to(`user:${receiver.user_id}`).emit("bus_tracking_request", {
      type: "TRACKING_REQUEST",
      requestId: request.id,
      busId: payload.busId,
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

    const delivered = await sendPushToUsers([receiver], {
      title: `Bus ${payload.busId} tracking request`,
      body: `${payload.requesterName || "A nearby rider"} asked if you are on Bus ${payload.busId}.`,
      data: {
        type: "TRACKING_REQUEST",
        requestId: request.id,
        busId: payload.busId,
        routeId: payload.routeId,
      },
      channelId: "bus-tracking-requests",
    });

    pushNotifiedUsers += delivered;
  }

  return {
    requestIds: createdRequestIds,
    notifiedUsers: uniqueReceivers.length,
    pushNotifiedUsers,
  };
}

function toSummary(request: {
  id: number;
  busId: number;
  status: TrackingRequestStatus;
  createdAt: Date;
  expiresAt: Date | null;
  requester: Pick<User, "user_id" | "name" | "email">;
}): TrackingRequestSummary {
  return {
    id: request.id,
    busId: request.busId,
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
  const request = await trackingRequestRepo.findPendingByIdForReceiver(id, receiverId);

  if (!request) {
    throw new AppError("Tracking request not found", 404);
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
  }

  return toSummary(updated);
}

export const TrackingRequestService = {
  createRequestsAndNotify,
  getPendingRequests,
  respondToRequest,
};

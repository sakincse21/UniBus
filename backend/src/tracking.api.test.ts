import request from "supertest";
import app from "./app";
import { AppDataSource } from "./app/db/data-source";
import { BusSchedule } from "./app/modules/schedule/busSchedule.entity";
import { RoutePoint } from "./app/modules/route/routePoint.entity";
import { LiveTrackingSession } from "./app/modules/tracking/liveTrackingSession.entity";
import { EstimatedBusLocation } from "./app/modules/tracking/estimatedBusLocation.entity";
import { UserLocation } from "./app/modules/location/userLocation.entity";
import { User } from "./app/modules/user/user.entity";
import { TrackingRequestService } from "./app/modules/tracking/trackingRequest.service";
import { estimateBusLocation } from "./app/modules/tracking/tracking.service";

jest.mock("./app/db/data-source", () => ({
  ensureDataSourceInitialized: jest.fn().mockResolvedValue(true),
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(),
  },
}));

jest.mock("./app/middlewares/authValidate", () => ({
  authValidate: (req: any, _res: any, next: any) => {
    req.user = { userId: "user-1" };
    next();
  },
}));

jest.mock("./app/modules/tracking/trackingRequest.service", () => ({
  TrackingRequestService: {
    createRequestsAndNotify: jest.fn(),
    getPendingRequests: jest.fn(),
    respondToRequest: jest.fn(),
  },
}));

jest.mock("./app/modules/tracking/tracking.service", () => ({
  estimateBusLocation: jest.fn(),
  getScheduleEndTime: jest.fn(),
}));

const getRepositoryMock = AppDataSource.getRepository as unknown as jest.Mock;
const estimateBusLocationMock = estimateBusLocation as jest.Mock;
const createRequestsAndNotifyMock =
  TrackingRequestService.createRequestsAndNotify as jest.Mock;
const getPendingRequestsMock = TrackingRequestService.getPendingRequests as jest.Mock;
const respondToRequestMock = TrackingRequestService.respondToRequest as jest.Mock;

describe("Tracking API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates tracking requests via POST /tracking/request", async () => {
    estimateBusLocationMock.mockResolvedValue({
      lat: 23.8,
      lng: 90.4,
      confidence: 0.6,
      mode: "estimated",
    });

    const scheduleRepo = {
      findOne: jest.fn().mockResolvedValue({
        route: { id: 9 },
        startTime: "08:00:00",
        endTime: "09:00:00",
      }),
    };
    const routePointRepo = {
      find: jest.fn().mockResolvedValue([{ lat: 23.8, lng: 90.4, sequence: 1 }]),
    };
    const liveSessionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const estimatedLocationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const userLocationRepo = {
      find: jest.fn().mockResolvedValue([
        {
          lat: 23.8005,
          lng: 90.4005,
          user: {
            user_id: "user-2",
            name: "Receiver One",
            email: "receiver1@unibus.test",
            pushToken: "ExponentPushToken[receiver-1]",
          },
        },
      ]),
    };
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        user_id: "user-1",
        name: "Requester",
        email: "requester@unibus.test",
        pushToken: null,
      }),
    };

    getRepositoryMock.mockImplementation((entity: unknown) => {
      if (entity === BusSchedule) return scheduleRepo;
      if (entity === RoutePoint) return routePointRepo;
      if (entity === LiveTrackingSession) return liveSessionRepo;
      if (entity === EstimatedBusLocation) return estimatedLocationRepo;
      if (entity === UserLocation) return userLocationRepo;
      if (entity === User) return userRepo;
      throw new Error(`Unexpected repository request: ${(entity as any)?.name}`);
    });

    createRequestsAndNotifyMock.mockResolvedValue({
      requestIds: [101],
      notifiedUsers: 1,
      pushNotifiedUsers: 1,
    });

    const response = await request(app)
      .post("/api/v1/tracking/request")
      .send({ busId: 33 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.routeId).toBe(9);
    expect(response.body.requestIds).toEqual([101]);
    expect(response.body.notifiedUsers).toBe(1);
    expect(createRequestsAndNotifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requesterId: "user-1",
        busId: 33,
        routeId: 9,
      }),
    );
  });

  it("returns 400 when busId is missing in POST /tracking/request", async () => {
    const response = await request(app).post("/api/v1/tracking/request").send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns pending requests via GET /tracking/pending", async () => {
    getPendingRequestsMock.mockResolvedValue([
      {
        id: 202,
        busId: 44,
        status: "pending",
        createdAt: new Date(),
        expiresAt: null,
        requester: {
          userId: "user-9",
          name: "Nearby Rider",
          email: "nearby@unibus.test",
        },
      },
    ]);

    const response = await request(app).get("/api/v1/tracking/pending");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(getPendingRequestsMock).toHaveBeenCalledWith("user-1");
  });

  it("returns 400 for invalid request id in PATCH /tracking/:id/respond", async () => {
    const response = await request(app)
      .patch("/api/v1/tracking/not-a-number/respond")
      .send({ status: "accepted" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("returns 400 for invalid status in PATCH /tracking/:id/respond", async () => {
    const response = await request(app)
      .patch("/api/v1/tracking/10/respond")
      .send({ status: "maybe" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("responds to a tracking request via PATCH /tracking/:id/respond", async () => {
    const emitMock = jest.fn();
    const toMock = jest.fn().mockReturnValue({ emit: emitMock });
    app.set("io", { to: toMock });

    respondToRequestMock.mockResolvedValue({
      id: 88,
      busId: 55,
      status: "accepted",
      createdAt: new Date(),
      expiresAt: null,
      requester: {
        userId: "requester-55",
        name: "Requester",
        email: "requester@unibus.test",
      },
    });

    const response = await request(app)
      .patch("/api/v1/tracking/88/respond")
      .send({ status: "accepted" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBe(88);
    expect(respondToRequestMock).toHaveBeenCalledWith(88, "user-1", "accepted");
    expect(toMock).toHaveBeenCalledWith("user:requester-55");
    expect(emitMock).toHaveBeenCalledWith(
      "tracking_request_responded",
      expect.objectContaining({
        requestId: 88,
        busId: 55,
        status: "accepted",
        responderId: "user-1",
      }),
    );
  });
});
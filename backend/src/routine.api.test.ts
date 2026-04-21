import request from "supertest";
import app from "./app";
import { AppDataSource } from "./app/db/data-source";
import { Routine } from "./app/modules/routine/routine.entity";

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

type RoutineRecord = {
  id: number;
  user: { user_id: string };
  day: string;
  firstHalfStart: string;
  secondHalfStart: string;
  confidence: number;
  note: string | null;
  confirmed: boolean;
  remindersEnabled: boolean;
};

const getRepositoryMock = AppDataSource.getRepository as unknown as jest.Mock;

describe("Routine API integration tests", () => {
  let routineRepo: {
    delete: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    routineRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((payload: Omit<RoutineRecord, "id">) => ({ id: 1, ...payload })),
      save: jest.fn().mockImplementation(async (value: unknown) => value),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    getRepositoryMock.mockImplementation((entity: unknown) => {
      if (entity === Routine) return routineRepo;
      throw new Error(`Unexpected repository request: ${(entity as any)?.name}`);
    });
  });

  it("creates routine entries with normalized times via POST /routine/confirm", async () => {
    const response = await request(app)
      .post("/api/v1/routine/confirm")
      .send({
        slots: [
          {
            day: "monday",
            firstHalfStart: "9:30",
            secondHalfStart: "14:30",
            confidence: 0.9,
            note: "Class + lab",
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].firstHalfStart).toBe("09:30");
    expect(routineRepo.delete).toHaveBeenCalledWith({ user: { user_id: "user-1" } });
    expect(routineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { user_id: "user-1" },
        day: "monday",
        firstHalfStart: "09:30",
        secondHalfStart: "14:30",
        confirmed: true,
        remindersEnabled: true,
      }),
    );
  });

  it("returns 400 for invalid slot day in POST /routine/confirm", async () => {
    const response = await request(app)
      .post("/api/v1/routine/confirm")
      .send({
        slots: [{ day: "notaday", firstHalfStart: "09:30", secondHalfStart: "" }],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid day");
    expect(routineRepo.delete).not.toHaveBeenCalled();
  });

  it("returns current user routine via GET /routine", async () => {
    routineRepo.find.mockResolvedValue([
      {
        id: 10,
        day: "sunday",
        firstHalfStart: "08:30",
        secondHalfStart: "",
      },
    ]);

    const response = await request(app).get("/api/v1/routine");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(routineRepo.find).toHaveBeenCalledWith({
      where: { user: { user_id: "user-1" } },
      order: { day: "ASC" },
    });
  });

  it("returns 404 when PATCH /routine/:id target is missing", async () => {
    routineRepo.findOne.mockResolvedValue(null);

    const response = await request(app).patch("/api/v1/routine/999").send({
      firstHalfStart: "08:00",
    });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Routine entry not found");
  });

  it("updates routine entry via PATCH /routine/:id", async () => {
    const existing = {
      id: 55,
      user: { user_id: "user-1" },
      day: "tuesday",
      firstHalfStart: "08:30",
      secondHalfStart: "",
      confidence: 1,
      note: null,
      confirmed: true,
      remindersEnabled: true,
    };

    routineRepo.findOne.mockResolvedValue(existing);
    routineRepo.save.mockResolvedValue({
      ...existing,
      firstHalfStart: "09:05",
      secondHalfStart: "15:00",
      note: "Updated slot",
      remindersEnabled: false,
    });

    const response = await request(app).patch("/api/v1/routine/55").send({
      firstHalfStart: "9:05",
      secondHalfStart: "15:00",
      note: "Updated slot",
      remindersEnabled: false,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.firstHalfStart).toBe("09:05");
    expect(routineRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 55,
        firstHalfStart: "09:05",
        secondHalfStart: "15:00",
        note: "Updated slot",
        remindersEnabled: false,
      }),
    );
  });

  it("deletes all routine entries via DELETE /routine", async () => {
    const response = await request(app).delete("/api/v1/routine");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(routineRepo.delete).toHaveBeenCalledWith({ user: { user_id: "user-1" } });
  });
});

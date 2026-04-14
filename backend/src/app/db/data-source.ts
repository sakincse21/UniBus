import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "../modules/user/user.entity";
import { env } from "../config/env";
import { Bus } from "../modules/bus/bus.entity";
import { LiveTrackingSession } from "../modules/tracking/liveTrackingSession.entity";
import { EstimatedBusLocation } from "../modules/tracking/estimatedBusLocation.entity";
import { BusSchedule } from "../modules/schedule/busSchedule.entity";
import { RoutePoint } from "../modules/route/routePoint.entity";
import { Route } from "../modules/route/route.entity";
import { Batch } from "../modules/batch/batch.entity";
import { Notice } from "../modules/notice/notice.entity";
import { Attachment } from "../modules/notice/attachment.entity";
import { UserLocation } from "../modules/location/userLocation.entity";
import { Routine } from "../modules/routine/routine.entity";
import { UserFixture } from "../modules/calendar/calendar.entity";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: true, // Set to false in production, use migrations
  logging: false,
  ssl: { rejectUnauthorized: false },
  entities: [
    User,
    Bus,
    LiveTrackingSession,
    EstimatedBusLocation,
    Route,
    RoutePoint,
    BusSchedule,
    Batch,
    Notice,
    Attachment,
    UserLocation,
    Routine,
    UserFixture,
  ],
});

let initPromise: Promise<DataSource> | null = null;

export async function ensureDataSourceInitialized(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  if (!initPromise) {
    initPromise = AppDataSource.initialize().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

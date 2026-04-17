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
import { TrackingRequest } from "../modules/tracking/trackingRequest.entity";
import { ForumPost } from "../modules/forum/forumPost.entity";
import { ForumComment } from "../modules/forum/forumComment.entity";

export const AppDataSource = new DataSource({
  type: "mysql",
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  username: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  database: env.MYSQL_DB,
  synchronize: true, // use migrations later — good for now
  logging: false,
  entities: [User, Bus, LiveTrackingSession, EstimatedBusLocation,
  Route,
  RoutePoint,
  BusSchedule,
  Batch,
  Notice,
  Attachment,
  UserLocation,
  Routine,
  UserFixture,
  TrackingRequest,
  ForumPost,
  ForumComment,
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

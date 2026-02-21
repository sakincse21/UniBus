import { AppDataSource } from "../../db/data-source";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { timeToMinutes, interpolate } from "./estimate.util";
import { AppError } from "../../errors/AppError";

export async function estimateBusLocation(busId: number, now: Date) {
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const rpRepo = AppDataSource.getRepository(RoutePoint);

  // MVP: pick first schedule only (extend later for day schedules)
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route"],
  });
  console.log(schedule)
  if (!schedule) throw new AppError("No schedule found", 404);

  const startMin = timeToMinutes(schedule.startTime);
  const endMin = timeToMinutes(schedule.endTime);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const elapsed = nowMin - startMin;
  const total = endMin - startMin;

  if (elapsed < 0) {
    return { mode: "not_started", confidence: 0.4 };
  }
  if (elapsed > total) {
    return { mode: "ended", confidence: 0.4 };
  }

  const points = await rpRepo.find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });

  console.log(points)

  // Find segment based on minuteOffset
  let p1 = points[0];
  let p2 = points[points.length - 1];

  for (let i = 0; i < points.length - 1; i++) {
    if (elapsed >= points[i].minuteOffset && elapsed <= points[i + 1].minuteOffset) {
      p1 = points[i];
      p2 = points[i + 1];
      break;
    }
  }

  const segmentDuration = p2.minuteOffset - p1.minuteOffset;
  const ratio = segmentDuration === 0 ? 0 : (elapsed - p1.minuteOffset) / segmentDuration;

  const { lat, lng } = interpolate(p1, p2, ratio);
  
  console.log(`lat ${lat}, lng ${lng}, ratio ${ratio}`)
  return { lat, lng, confidence: 0.6, mode: "estimated" };
}

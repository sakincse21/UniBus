import { AppDataSource } from "../../db/data-source";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "../route/routePoint.entity";
import { timeToMinutes, interpolate } from "../../utils/estimate.util";
import { AppError } from "../../errors/AppError";
import {
  BANGLADESH_OFFSET_MINUTES,
  formatBangladeshDateKey,
  parseLocalDateTime,
} from "../../utils/dateUtils";

const MINUTES_PER_DAY = 24 * 60;

function getBangladeshMinutesOfDay(now: Date): number {
  const bangladeshNow = new Date(now.getTime() + BANGLADESH_OFFSET_MINUTES * 60 * 1000);
  return (
    bangladeshNow.getUTCHours() * 60 +
    bangladeshNow.getUTCMinutes() +
    bangladeshNow.getUTCSeconds() / 60
  );
}

function normalizeScheduleTime(time: string): string {
  const [hh = "00", mm = "00", ssRaw = "00"] = time.split(":");
  const ss = ssRaw.split(".")[0];
  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
}

export async function estimateBusLocation(busId: number, now: Date) {
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const rpRepo = AppDataSource.getRepository(RoutePoint);

  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
    relations: ["route"],
  });

  if (!schedule) throw new AppError("No schedule found", 404);

  const startMin = timeToMinutes(schedule.startTime);
  const endMin = timeToMinutes(schedule.endTime);
  const nowMin = getBangladeshMinutesOfDay(now);
  const crossesMidnight = endMin < startMin;

  let elapsed: number;
  let total: number;

  if (!crossesMidnight) {
    total = endMin - startMin;

    if (nowMin < startMin) {
      return {
        mode: "not_started",
        confidence: 0.4,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      };
    }

    if (nowMin > endMin) {
      return {
        mode: "ended",
        confidence: 0.4,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      };
    }

    elapsed = nowMin - startMin;
  } else {
    // Overnight schedule, e.g. 21:30 -> 02:30
    const inActiveWindow = nowMin >= startMin || nowMin <= endMin;

    if (!inActiveWindow) {
      return {
        mode: "not_started",
        confidence: 0.4,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      };
    }

    total = MINUTES_PER_DAY - startMin + endMin;
    elapsed =
      nowMin >= startMin
        ? nowMin - startMin
        : MINUTES_PER_DAY - startMin + nowMin;
  }

  const points = await rpRepo.find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });

  if (!points || points.length === 0) {
    throw new AppError("No route points defined for this route", 404);
  }

  // ── Clamp elapsed to the range defined by route points ──────────────────────
  // This handles the common case where the schedule window is wider than the
  // sum of minuteOffsets (e.g. route is 30 min of offsets but schedule is 60 min).
  const firstOffset = points[0].minuteOffset;
  const lastOffset = points[points.length - 1].minuteOffset;

  // If the bus hasn't reached the first defined point yet, snap to start.
  if (elapsed <= firstOffset) {
    const { lat, lng } = interpolate(points[0], points[0], 0);
    return { lat, lng, confidence: 0.5, mode: "estimated", startTime: schedule.startTime, endTime: schedule.endTime };
  }

  // If the bus has passed all defined points, snap to end.
  if (elapsed >= lastOffset) {
    const last = points[points.length - 1];
    return { lat: last.lat, lng: last.lng, confidence: 0.5, mode: "estimated", startTime: schedule.startTime, endTime: schedule.endTime };
  }

  // ── Find the segment the bus is currently in ─────────────────────────────────
  let p1 = points[0];
  let p2 = points[1] ?? points[0]; // safe fallback

  for (let i = 0; i < points.length - 1; i++) {
    if (elapsed >= points[i].minuteOffset && elapsed <= points[i + 1].minuteOffset) {
      p1 = points[i];
      p2 = points[i + 1];
      break;
    }
  }

  const segmentDuration = p2.minuteOffset - p1.minuteOffset;
  // Clamp ratio to [0, 1] to prevent extrapolation outside the segment
  const rawRatio = segmentDuration === 0 ? 0 : (elapsed - p1.minuteOffset) / segmentDuration;
  const ratio = Math.min(1, Math.max(0, rawRatio));

  const { lat, lng } = interpolate(p1, p2, ratio);

  return {
    lat,
    lng,
    confidence: 0.6,
    mode: "estimated",
    startTime: schedule.startTime,
    endTime: schedule.endTime,
  };
}

export async function getScheduleEndTime(busId: number): Promise<Date> {
  const scheduleRepo = AppDataSource.getRepository(BusSchedule);
  const schedule = await scheduleRepo.findOne({
    where: { bus: { id: busId } },
  });

  if (!schedule) throw new AppError("No schedule found", 404);

  const now = new Date();
  const nowMin = getBangladeshMinutesOfDay(now);
  const todayBangladesh = formatBangladeshDateKey(now);

  const startMin = timeToMinutes(schedule.startTime);
  const endMin = timeToMinutes(schedule.endTime);
  const crossesMidnight = endMin < startMin;

  const normalizedEndTime = normalizeScheduleTime(schedule.endTime);
  let endDate = parseLocalDateTime(`${todayBangladesh}T${normalizedEndTime}`);

  if (!crossesMidnight) {
    // Normal same-day schedule; if already passed, next end is tomorrow.
    if (nowMin > endMin) {
      endDate = new Date(endDate.getTime() + MINUTES_PER_DAY * 60 * 1000);
    }
    return endDate;
  }

  // Overnight schedule:
  // - Evening segment (now >= start): end is tomorrow morning.
  // - Early-morning segment (now <= end): end is today morning.
  // - Daytime gap (end < now < start): next end is tomorrow morning.
  if (nowMin >= startMin || nowMin > endMin) {
    endDate = new Date(endDate.getTime() + MINUTES_PER_DAY * 60 * 1000);
  }

  return endDate;
}

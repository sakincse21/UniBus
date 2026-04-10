import tryCatch from "../../utils/tryCatch";
import { Request, Response } from "express";
import { AppDataSource } from "../../db/data-source";
import { Route } from "./route.entity";
import { BusSchedule } from "../schedule/busSchedule.entity";
import { RoutePoint } from "./routePoint.entity";
import { AppError } from "../../errors/AppError";
import { readExcelFromFile } from "../../utils/excelRead";
import fs from "fs";
import path from "path";



const createRoute = tryCatch(async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) throw new AppError("Route name is required", 400);

  const routeRepo = AppDataSource.getRepository(Route);
  const exists = await routeRepo.findOne({ where: { name } });
  if (exists) throw new AppError("Route with this name already exists", 409);

  const route = routeRepo.create({ name });
  await routeRepo.save(route);

  res.status(201).json({ success: true, data: route });
});

// Get route points for a bus 
// flow is busId -> schedule -> route
const getRouteByBus = tryCatch(async (req: Request, res: Response) => {
  const { busId } = req.params;

  const schedule = await AppDataSource.getRepository(BusSchedule).findOne({
    where: { bus: { id: Number(busId) } },
    relations: ["route"],
  });

  if (!schedule) {
    return res.status(404).json({ success: false, message: "Schedule not found for this bus" });
  }

  const points = await AppDataSource.getRepository(RoutePoint).find({
    where: { route: { id: schedule.route.id } },
    order: { sequence: "ASC" },
  });

  res.json({ success: true, data: { route: schedule.route, points } });
});

const getAllRoutes = tryCatch(async (_req: Request, res: Response) => {
  const routeRepo = AppDataSource.getRepository(Route);
  const routes = await routeRepo.find({ relations: ["points"], order: { id: "ASC" } });

  routes.forEach((route) => {
    if (route.points) route.points.sort((a, b) => a.sequence - b.sequence);
  });

  res.json({ success: true, data: routes });
});

const getRouteById = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const route = await AppDataSource.getRepository(Route).findOne({
    where: { id: Number(id) },
    relations: ["points"],
  });

  if (!route) throw new AppError("Route not found", 404);

  if (route.points) route.points.sort((a, b) => a.sequence - b.sequence);

  res.json({ success: true, data: route });
});

const updateRoute = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name } = req.body;

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  if (name) route.name = name;
  await routeRepo.save(route);

  res.json({ success: true, data: route });
});

const deleteRoute = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  await routeRepo.remove(route);

  res.json({ success: true, message: "Route deleted" });
});

const setRoutePoints = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { points } = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    throw new AppError("Points array is required", 400);
  }

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);

  await rpRepo.delete({ route: { id: route.id } });

  const newPoints = points.map((p: any, idx: number) =>
    rpRepo.create({
      route: { id: route.id },
      lat: p.lat,
      lng: p.lng,
      sequence: p.sequence ?? idx + 1,
      minuteOffset: p.minuteOffset ?? 0,
    })
  );

  await rpRepo.save(newPoints);

  res.json({ success: true, data: newPoints });
});

const addRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { lat, lng, sequence, minuteOffset } = req.body;

  if (lat == null || lng == null || sequence == null || minuteOffset == null) {
    throw new AppError("lat, lng, sequence, and minuteOffset are required", 400);
  }

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = rpRepo.create({
    route: { id: route.id },
    lat,
    lng,
    sequence,
    minuteOffset,
  });

  await rpRepo.save(point);

  res.status(201).json({ success: true, data: point });
});

const updateRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { pointId } = req.params;
  const { lat, lng, sequence, minuteOffset } = req.body;

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = await rpRepo.findOne({ where: { id: Number(pointId) } });
  if (!point) throw new AppError("Route point not found", 404);

  if (lat != null) point.lat = lat;
  if (lng != null) point.lng = lng;
  if (sequence != null) point.sequence = sequence;
  if (minuteOffset != null) point.minuteOffset = minuteOffset;

  await rpRepo.save(point);

  res.json({ success: true, data: point });
});

const deleteRoutePoint = tryCatch(async (req: Request, res: Response) => {
  const { pointId } = req.params;

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const point = await rpRepo.findOne({ where: { id: Number(pointId) } });
  if (!point) throw new AppError("Route point not found", 404);

  await rpRepo.remove(point);

  res.json({ success: true, message: "Route point deleted" });
});

const uploadRoutePointsExcel = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!req.file) {
    throw new AppError("No file uploaded", 400);
  }

  try {
    const filePath = req.file.path;
    
    // Read Excel file
    const excelData = readExcelFromFile(filePath);

    if (!Array.isArray(excelData) || excelData.length === 0) {
      throw new AppError("Excel file is empty or invalid format", 400);
    }

    // Validate Excel data structure
    const validatedPoints = excelData.map((row: any, idx: number) => {
      // Handle both short column names (lat, lng) and full names (Latitude, Longitude)
      const sequence = Number(row.sequence || row.Sequence) || idx + 1;
      const lat = Number(row.lat || row.Latitude);
      const lng = Number(row.lng || row.Longitude);
      const minuteOffset = Number(row.minuteOffset || row["Minute Offset"]) || 0;

      if (isNaN(lat) || isNaN(lng)) {
        throw new AppError(
          `Row ${idx + 2}: Invalid latitude or longitude values. Expected numbers.`,
          400
        );
      }

      if (lat < -90 || lat > 90) {
        throw new AppError(`Row ${idx + 2}: Latitude must be between -90 and 90`, 400);
      }

      if (lng < -180 || lng > 180) {
        throw new AppError(`Row ${idx + 2}: Longitude must be between -180 and 180`, 400);
      }

      return { sequence, lat, lng, minuteOffset };
    });

    // Check if route exists
    const routeRepo = AppDataSource.getRepository(Route);
    const route = await routeRepo.findOne({ where: { id: Number(id) } });
    if (!route) throw new AppError("Route not found", 404);

    // Delete existing route points
    const rpRepo = AppDataSource.getRepository(RoutePoint);
    await rpRepo.delete({ route: { id: route.id } });

    // Create and save new route points
    const newPoints = validatedPoints.map((p: any) =>
      rpRepo.create({
        route: { id: route.id },
        lat: p.lat,
        lng: p.lng,
        sequence: p.sequence,
        minuteOffset: p.minuteOffset,
      })
    );

    await rpRepo.save(newPoints);

    res.json({
      success: true,
      data: {
        message: `Successfully imported ${newPoints.length} route points`,
        pointsCount: newPoints.length,
        points: newPoints,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to process Excel file: " + (error as any).message, 400);
  } finally {
    // Delete uploaded file
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error("Failed to delete uploaded file:", err);
      }
    }
  }
});

const downloadRoutePointsExcel = tryCatch(async (req: Request, res: Response) => {
  const { id } = req.params;
  const ExcelJS = require("exceljs");

  const routeRepo = AppDataSource.getRepository(Route);
  const route = await routeRepo.findOne({ where: { id: Number(id) } });
  if (!route) throw new AppError("Route not found", 404);

  const rpRepo = AppDataSource.getRepository(RoutePoint);
  const points = await rpRepo.find({
    where: { route: { id: route.id } },
    order: { sequence: "ASC" },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Route Points");

  worksheet.columns = [
    { header: "Sequence", key: "sequence", width: 12 },
    { header: "Latitude", key: "lat", width: 15 },
    { header: "Longitude", key: "lng", width: 15 },
    { header: "Minute Offset", key: "minuteOffset", width: 15 },
  ];

  // Format header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };

  points.forEach((point) => {
    worksheet.addRow({
      sequence: point.sequence,
      lat: point.lat,
      lng: point.lng,
      minuteOffset: point.minuteOffset,
    });
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="Route_${id}_Points.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

export const RouteController = {
  getRouteByBus,
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  setRoutePoints,
  addRoutePoint,
  updateRoutePoint,
  deleteRoutePoint,
  uploadRoutePointsExcel,
  downloadRoutePointsExcel,
};
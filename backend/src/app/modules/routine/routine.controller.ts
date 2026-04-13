import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";
import { AppDataSource } from "../../db/data-source";
import { Routine, DayOfWeek } from "./routine.entity";
import { analyzeRoutineImage } from "./gemini.service";
import fs from "fs";

const routineRepo = () => AppDataSource.getRepository(Routine);

/**
 * POST /routine/upload
 * Upload a routine image → Gemini analysis → return editable draft
 */
const uploadAndAnalyze = tryCatch(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  try {
    console.log('trying image analysis')
    const slots = await analyzeRoutineImage(req.file.path);

    // Clean up uploaded file after analysis
    fs.unlink(req.file.path, () => {});

    return res.status(200).json({
      success: true,
      message: "Routine analyzed successfully",
      data: slots,
    });
  } catch (error: any) {
    // Clean up on failure too
    fs.unlink(req.file.path, () => {});
    const errorMessage = error?.message || "Unknown analysis error";
    const isTimeout = /timed out/i.test(errorMessage);

    return res.status(isTimeout ? 504 : 422).json({
      success: false,
      message: isTimeout
        ? "Routine analysis timed out. Please try again."
        : "Failed to analyze routine image",
      error: errorMessage,
    });
  }
});

/**
 * POST /routine/confirm
 * Save user-confirmed routine entries (replaces all existing for user)
 * Body: { slots: Array<{ day, firstHalfStart, secondHalfStart, confidence, note }> }
 */
const confirmRoutine = tryCatch(async (req: Request, res: Response) => {
  const { slots } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(slots) || slots.length === 0) {
    return res.status(400).json({ message: "Slots array is required" });
  }

  const validDays = Object.values(DayOfWeek);
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

  // Validate each slot
  for (const slot of slots) {
    if (!validDays.includes(slot.day)) {
      return res
        .status(400)
        .json({ message: `Invalid day: ${slot.day}` });
    }
    if (!timeRegex.test(slot.firstHalfStart)) {
      return res
        .status(400)
        .json({ message: `Invalid firstHalfStart time for ${slot.day}` });
    }
    if (slot.secondHalfStart && !timeRegex.test(slot.secondHalfStart)) {
      return res
        .status(400)
        .json({ message: `Invalid secondHalfStart time for ${slot.day}` });
    }
  }

  // Delete existing routine for this user
  await routineRepo().delete({ user: { user_id: userId } });

  // Create new entries
  const entities = slots.map((slot: any) =>
    routineRepo().create({
      user: { user_id: userId },
      day: slot.day as DayOfWeek,
      firstHalfStart: slot.firstHalfStart,
      secondHalfStart: slot.secondHalfStart || "",
      confidence: slot.confidence ?? 1,
      note: slot.note || null,
      confirmed: true,
      remindersEnabled: true,
    }),
  );

  await routineRepo().save(entities);

  return res.status(200).json({
    success: true,
    message: "Routine saved successfully",
    data: entities,
  });
});

/**
 * GET /routine
 * Get the current user's confirmed routine
 */
const getMyRoutine = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;

  const routines = await routineRepo().find({
    where: { user: { user_id: userId } },
    order: { day: "ASC" },
  });

  return res.status(200).json({
    success: true,
    data: routines,
  });
});

/**
 * PATCH /routine/:id
 * Update a single routine entry (inline edit)
 */
const updateSlot = tryCatch(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const userId = req.user.userId;
  const { firstHalfStart, secondHalfStart, note, remindersEnabled } = req.body;

  const entry = await routineRepo().findOne({
    where: { id, user: { user_id: userId } },
  });

  if (!entry) {
    return res.status(404).json({ message: "Routine entry not found" });
  }

  if (firstHalfStart !== undefined) entry.firstHalfStart = firstHalfStart;
  if (secondHalfStart !== undefined) entry.secondHalfStart = secondHalfStart;
  if (note !== undefined) entry.note = note;
  if (remindersEnabled !== undefined) entry.remindersEnabled = remindersEnabled;

  await routineRepo().save(entry);

  return res.status(200).json({
    success: true,
    message: "Routine entry updated",
    data: entry,
  });
});

/**
 * DELETE /routine
 * Delete all routine entries for the current user
 */
const deleteMyRoutine = tryCatch(async (req: Request, res: Response) => {
  const userId = req.user.userId;
  await routineRepo().delete({ user: { user_id: userId } });

  return res.status(200).json({
    success: true,
    message: "All routine entries deleted",
  });
});

export const RoutineController = {
  uploadAndAnalyze,
  confirmRoutine,
  getMyRoutine,
  updateSlot,
  deleteMyRoutine,
};

import { Request, Response } from "express";
import tryCatch from "../../utils/tryCatch";

const requestTracking = tryCatch(async (req: Request, res: Response) => {
  const { busId } = req.params;
  const io = req.app.get("io");

  io.emit("bus_tracking_request", {
    busId,
    message: "Are you currently on this bus?",
  });

  res.json({ success: true });
});

export const TrackingController = {
  requestTracking,
};

import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

const tryCatch = <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (error: any) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  };
export default tryCatch;
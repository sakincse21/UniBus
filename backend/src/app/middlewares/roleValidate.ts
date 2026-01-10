import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import tryCatch from "../utils/tryCatch";

export const roleValidate = (
  requiredRoles: string[]
) => {
    return tryCatch(async (req: Request, res:Response, next: NextFunction) => {
    const userRole = req.user.role;
    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new AppError("Forbidden: Insufficient role", 403);
    }
    next();
  });
};

import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { env } from "../config/env";
import jwt, { JwtPayload } from "jsonwebtoken";
import tryCatch from "../utils/tryCatch";

export const authValidate = tryCatch(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let token = req.cookies.token;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError("Unauthorized: You are not logged in.", 401);
  }
  
  const decoded = jwt.verify(token, env.JWT_SECRET as string);
  req.user = decoded as JwtPayload;
  console.log(req.user);
  next();
});

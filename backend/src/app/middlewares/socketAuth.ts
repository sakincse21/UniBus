import { Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Unauthorized: No token"));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET as string);

    socket.user = decoded as any;
    next();
  } catch (err) {
    next(new Error("Unauthorized: Invalid token"));
  }
};

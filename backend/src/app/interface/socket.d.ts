import { JwtPayload } from "jsonwebtoken";

declare module "socket.io" {
  interface Socket {
    user?: JwtPayload & {
      userId: string;
      email: string;
      role: string;
    };
  }
}

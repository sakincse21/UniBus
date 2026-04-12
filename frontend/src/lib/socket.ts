"use client";

import { io, Socket } from "socket.io-client";
import { configs } from "./config.env";

let socketPromise: Promise<Socket> | null = null;

export function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = (async () => {
      const res = await fetch(
        `/api/v1/auth/socket-token`,
        { credentials: "include" }
      );

      const { token } = await res.json();

      const socket = io(configs.BACKEND_BASE_URL, {
        withCredentials: true,
        auth: { token },
      });

      socket.on("connect", () =>
        console.log("✅ Socket connected:", socket.id)
      );

      socket.on("connect_error", (err) =>
        console.error("❌ Socket error:", err.message)
      );

      return socket;
    })();
  }

  return socketPromise;
}

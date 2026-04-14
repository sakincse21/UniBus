"use client";

import { io, Socket } from "socket.io-client";
import { configs } from "./config.env";

let socketPromise: Promise<Socket> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = (async () => {
      try {
        const res = await fetch(`/api/v1/auth/socket-token`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(`Socket token request failed (${res.status})`);
        }

        const { token } = await res.json();

        if (!token) {
          throw new Error("Socket token not found");
        }

        const socket = io(configs.BACKEND_BASE_URL, {
          withCredentials: true,
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          timeout: 10000,
        });

        socket.on("connect", () => {
          console.log("✅ Socket connected:", socket.id);
          reconnectAttempts = 0;
        });

        socket.on("connect_error", (err: Error) => {
          console.error("❌ Socket error:", err.message);
          reconnectAttempts++;

          if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error("Max reconnection attempts reached");
            socket.disconnect();
          }
        });

        socket.on("disconnect", (reason: string) => {
          console.log("Socket disconnected:", reason);
          if (reason === "io client disconnect") {
            socketPromise = null;
          }
        });

        socket.on("error", (error: Error) => {
          console.error("Socket error event:", error);
          const errorData = error as unknown as { data?: { content?: string } };
          if (errorData?.data?.content === "Authentication error") {
            console.error("Authentication failed, reconnecting with new token");
            socketPromise = null;
          }
        });

        return socket;
      } catch (error) {
        console.error("Failed to initialize socket:", error);
        socketPromise = null;
        throw error;
      }
    })();

    socketPromise.catch(() => {
      socketPromise = null;
    });
  }

  return socketPromise;
}

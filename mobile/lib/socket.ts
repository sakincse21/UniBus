import { io, Socket } from "socket.io-client";
import config from "./config";
import storage from "./storage";

let socket: Socket | null = null;
let socketToken: string | null = null;

function normalizeToken(token: string | null | undefined): string | null {
  const trimmed = typeof token === "string" ? token.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

function attachSocketLifecycleLogs(instance: Socket) {
  instance.on("connect", () => {
    console.log("Socket connected:", instance.id);
  });

  instance.on("connect_error", (error: any) => {
    // Silently handle connection errors in development
    // Backend may not be running during development
    if (process.env.NODE_ENV === "development") {
      console.debug("Socket connection error (expected in dev):", error?.message);
    } else {
      console.error("Socket error:", error?.message);
    }
  });

  instance.on("disconnect", () => {
    console.log("Socket disconnected");
  });
}

export const getSocket = async (): Promise<Socket> => {
  const token = normalizeToken(await storage.getToken());

  if (socket) {
    const tokenChanged = socketToken !== token;

    if (tokenChanged) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
      socketToken = null;
    } else {
      if (socket.disconnected) {
        socket.connect();
      }
      return socket;
    }
  }

  socket = io(config.SOCKET_URL, {
    auth: token ? { token } : {},
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 10000,
  });
  socketToken = token;

  attachSocketLifecycleLogs(socket);

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
};

export default { getSocket, disconnectSocket };

import { io, Socket } from "socket.io-client";
import config from "./config";
import storage from "./storage";

let socket: Socket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export const getSocket = async (): Promise<Socket> => {
  if (socket?.connected) {
    return socket;
  }

  const token = await storage.getToken();

  socket = io(config.SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket?.id || "(ID pending)");
    reconnectAttempts = 0;
  });

  socket.on("connect_error", (error: any) => {
    console.warn("Socket connection error:", error?.message);
    reconnectAttempts++;

    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error("Max reconnection attempts reached, disconnecting");
      socket?.disconnect();
      socket = null;
      reconnectAttempts = 0;
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
    // Only reset on client-side disconnects, not server disconnects
    if (reason === "io client disconnect") {
      socket = null;
    }
  });

  socket.on("error", (error: any) => {
    console.error("Socket error event:", error);
    // Check if error is authorization related
    if (error?.data?.content === "Authentication error") {
      console.error("Authentication failed, disconnecting");
      socket?.disconnect();
      socket = null;
      reconnectAttempts = 0;
    }
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    reconnectAttempts = 0;
  }
};

export default { getSocket, disconnectSocket };

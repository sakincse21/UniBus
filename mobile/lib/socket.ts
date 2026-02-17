import { io, Socket } from "socket.io-client";
import config from "./config";
import storage from "./storage";

let socket: Socket | null = null;

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
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket?.id);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket error:", error.message);
  });

  socket.on("disconnect", () => {
    console.log("⚠️ Socket disconnected");
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export default { getSocket, disconnectSocket };

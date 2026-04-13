import { io, type Socket } from "socket.io-client";

export function createRoomSocket(): Socket {
  return io({
    path: "/api/socket",
    transports: ["websocket"]
  });
}

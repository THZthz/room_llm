import type { Server, Socket } from "socket.io";
import { hasValidAdminCookie } from "@/lib/auth/admin";
import {
  deactivateSessionBySocket,
  getSessionByToken,
  listClientsWithPresence,
  markSessionConnected,
  touchSessionBySocket
} from "@/lib/domain/clients";
import { getLiveState } from "@/lib/state/live";

const ADMIN_ROOM = "admins";

const globalSocketState = globalThis as typeof globalThis & {
  __roomSocketServer?: Server;
};

function buildPresencePayload() {
  return {
    llmEnabled: getLiveState().isLlmEnabled(),
    clients: listClientsWithPresence()
  };
}

export function getSocketServer() {
  return globalSocketState.__roomSocketServer;
}

export function emitPresenceState() {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  io.to(ADMIN_ROOM).emit("presence-state", buildPresencePayload());
}

export function emitLlmState(enabled: boolean) {
  const io = getSocketServer();
  if (!io) {
    return;
  }

  io.emit("llm-access-updated", { enabled });
  emitPresenceState();
}

export function registerSocketServer(io: Server) {
  globalSocketState.__roomSocketServer = io;

  io.on("connection", (socket: Socket) => {
    socket.on("subscribe-admin", () => {
      if (!hasValidAdminCookie(socket.request.headers.cookie)) {
        socket.emit("presence-state", { llmEnabled: getLiveState().isLlmEnabled(), clients: [] });
        return;
      }

      socket.join(ADMIN_ROOM);
      socket.emit("presence-state", buildPresencePayload());
    });

    socket.on("register-client", (payload: { sessionToken?: string }, callback?: (response: { ok: boolean; error?: string; llmEnabled?: boolean }) => void) => {
      try {
        const sessionToken = payload?.sessionToken?.trim();
        if (!sessionToken) {
          callback?.({ ok: false, error: "Missing session token." });
          return;
        }

        const session = getSessionByToken(sessionToken);
        if (!session) {
          callback?.({ ok: false, error: "Session expired. Register again." });
          return;
        }

        markSessionConnected(sessionToken, socket.id);
        getLiveState().registerClient(socket.id, session.clientId, session.clientName);
        socket.emit("llm-access-updated", { enabled: getLiveState().isLlmEnabled() });
        emitPresenceState();
        callback?.({ ok: true, llmEnabled: getLiveState().isLlmEnabled() });
      } catch (error) {
        callback?.({ ok: false, error: error instanceof Error ? error.message : "Unable to connect." });
      }
    });

    socket.on("heartbeat", () => {
      touchSessionBySocket(socket.id);
      getLiveState().heartbeat(socket.id);
      emitPresenceState();
    });

    socket.on("disconnect", () => {
      deactivateSessionBySocket(socket.id);
      getLiveState().disconnect(socket.id);
      emitPresenceState();
    });
  });
}

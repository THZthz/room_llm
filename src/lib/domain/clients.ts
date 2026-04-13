import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db";
import { getLiveState } from "@/lib/state/live";

export type ClientSession = {
  sessionId: string;
  sessionToken: string;
  clientId: number;
  clientName: string;
  lastSeenAt: string;
};

export type ClientPresence = {
  clientId: number;
  name: string;
  connected: boolean;
  connectedAt: string | null;
  lastSeenAt: string | null;
  messageCount: number;
};

type ClientRow = {
  id: number;
  name: string;
  normalized_name: string;
};

type SessionRow = {
  id: string;
  session_token: string;
  client_id: number;
  client_name: string;
  last_seen_at: string;
};

export function normalizeClientName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function registerClient(requestedName: string): ClientSession {
  const cleanedName = requestedName.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeClientName(cleanedName);

  if (cleanedName.length < 2 || cleanedName.length > 32) {
    throw new Error("Name must be between 2 and 32 characters.");
  }

  if (getLiveState().hasActiveName(normalizedName)) {
    throw new Error("That name is already connected.");
  }

  const db = getDatabase();
  let client = db
    .prepare("SELECT id, name, normalized_name FROM clients WHERE normalized_name = ?")
    .get(normalizedName) as ClientRow | undefined;

  if (!client) {
    const insert = db
      .prepare("INSERT INTO clients (name, normalized_name) VALUES (?, ?)")
      .run(cleanedName, normalizedName);

    client = {
      id: Number(insert.lastInsertRowid),
      name: cleanedName,
      normalized_name: normalizedName
    };
  }

  const activeSession = db
    .prepare("SELECT id FROM client_sessions WHERE client_id = ? AND is_active = 1 LIMIT 1")
    .get(client.id) as { id: string } | undefined;

  if (activeSession) {
    throw new Error("That name is already in use.");
  }

  const sessionId = randomUUID();
  const sessionToken = randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO client_sessions (id, client_id, session_token, is_active, last_seen_at)
     VALUES (?, ?, ?, 1, ?)`
  ).run(sessionId, client.id, sessionToken, now);

  return {
    sessionId,
    sessionToken,
    clientId: client.id,
    clientName: client.name,
    lastSeenAt: now
  };
}

export function getSessionByToken(sessionToken: string) {
  const db = getDatabase();
  const session = db
    .prepare(
      `SELECT cs.id, cs.session_token, cs.client_id, c.name AS client_name, cs.last_seen_at
       FROM client_sessions cs
       INNER JOIN clients c ON c.id = cs.client_id
       WHERE cs.session_token = ? AND cs.is_active = 1`
    )
    .get(sessionToken) as SessionRow | undefined;

  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    sessionToken: session.session_token,
    clientId: session.client_id,
    clientName: session.client_name,
    lastSeenAt: session.last_seen_at
  } satisfies ClientSession;
}

export function markSessionConnected(sessionToken: string, socketId: string) {
  const db = getDatabase();
  db.prepare(
    `UPDATE client_sessions
     SET socket_id = ?, last_seen_at = ?, is_active = 1
     WHERE session_token = ?`
  ).run(socketId, new Date().toISOString(), sessionToken);
}

export function touchSessionBySocket(socketId: string) {
  const db = getDatabase();
  db.prepare(
    `UPDATE client_sessions
     SET last_seen_at = ?
     WHERE socket_id = ?`
  ).run(new Date().toISOString(), socketId);
}

export function deactivateSessionBySocket(socketId: string) {
  const db = getDatabase();
  db.prepare(
    `UPDATE client_sessions
     SET is_active = 0, socket_id = NULL, last_seen_at = ?
     WHERE socket_id = ?`
  ).run(new Date().toISOString(), socketId);
}

export function deactivateSessionByToken(sessionToken: string) {
  const db = getDatabase();
  db.prepare(
    `UPDATE client_sessions
     SET is_active = 0, socket_id = NULL, last_seen_at = ?
     WHERE session_token = ?`
  ).run(new Date().toISOString(), sessionToken);
}

export function listClientsWithPresence(): ClientPresence[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT c.id, c.name, COUNT(m.id) AS message_count
       FROM clients c
       LEFT JOIN messages m ON m.client_id = c.id AND m.scope = 'client'
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .all() as Array<{ id: number; name: string; message_count: number }>;

  const liveClients = new Map(getLiveState().getClients().map((client) => [client.clientId, client]));

  return rows.map((row) => {
    const liveClient = liveClients.get(row.id);
    return {
      clientId: row.id,
      name: row.name,
      connected: Boolean(liveClient),
      connectedAt: liveClient?.connectedAt ?? null,
      lastSeenAt: liveClient?.lastSeenAt ?? null,
      messageCount: Number(row.message_count ?? 0)
    };
  });
}

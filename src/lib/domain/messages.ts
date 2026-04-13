import { getDatabase } from "@/lib/db";

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type StoredSummary = {
  id: number;
  title: string;
  targetClientIds: number[];
  content: string;
  sourceMessageCount: number;
  createdAt: string;
};

export function saveMessage(scope: "client" | "admin", role: "user" | "assistant", content: string, clientId?: number | null) {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO messages (scope, client_id, role, content)
       VALUES (?, ?, ?, ?)`
    )
    .run(scope, clientId ?? null, role, content);

  return Number(result.lastInsertRowid);
}

export function getClientMessages(clientId: number, limit = 30): ChatMessage[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE scope = 'client' AND client_id = ?
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(clientId, limit)
    .reverse() as Array<{ id: number; role: "user" | "assistant"; content: string; created_at: string }>;

  return rows.map((row) => ({
    id: Number(row.id),
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }));
}

export function getAdminMessages(limit = 30): ChatMessage[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE scope = 'admin'
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit)
    .reverse() as Array<{ id: number; role: "user" | "assistant"; content: string; created_at: string }>;

  return rows.map((row) => ({
    id: Number(row.id),
    role: row.role,
    content: row.content,
    createdAt: row.created_at
  }));
}

export function getTranscriptText(clientId: number, limit = 30) {
  const messages = getClientMessages(clientId, limit);
  return messages.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");
}

export function getAllClientTranscripts(limitPerClient = 20, clientIds?: number[]) {
  const db = getDatabase();
  const clients = db.prepare("SELECT id, name FROM clients ORDER BY name ASC").all() as Array<{ id: number; name: string }>;
  const filteredClients = clientIds?.length
    ? clients.filter((client) => clientIds.includes(client.id))
    : clients;

  return filteredClients.map((client) => ({
    clientId: client.id,
    clientName: client.name,
    transcript: getTranscriptText(client.id, limitPerClient)
  }));
}

export function createSummary(title: string, targetClientIds: number[], content: string, sourceMessageCount: number) {
  const db = getDatabase();
  const result = db
    .prepare(
      `INSERT INTO summaries (title, target_client_ids, content, source_message_count)
       VALUES (?, ?, ?, ?)`
    )
    .run(title, JSON.stringify(targetClientIds), content, sourceMessageCount);

  return Number(result.lastInsertRowid);
}

export function getRecentSummaries(limit = 10): StoredSummary[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT id, title, target_client_ids, content, source_message_count, created_at
     FROM summaries
     ORDER BY id DESC
     LIMIT ?`
  ).all(limit) as Array<{
    id: number;
    title: string;
    target_client_ids: string;
    content: string;
    source_message_count: number;
    created_at: string;
  }>;

  return rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    targetClientIds: JSON.parse(row.target_client_ids) as number[],
    content: row.content,
    sourceMessageCount: Number(row.source_message_count),
    createdAt: row.created_at
  }));
}

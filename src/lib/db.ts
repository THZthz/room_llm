import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConfig } from "@/lib/config";

let database: Database.Database | undefined;

function createSchema(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      normalized_name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_sessions (
      id TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      socket_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      client_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      target_client_ids TEXT NOT NULL,
      content TEXT NOT NULL,
      source_message_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.prepare(
    `INSERT INTO settings (key, value)
     VALUES ('llm_enabled', 'true')
     ON CONFLICT(key) DO NOTHING`
  ).run();
}

export function initializeDatabase() {
  const db = getDatabase();
  db.prepare("UPDATE client_sessions SET is_active = 0, socket_id = NULL").run();
}

export function getDatabase() {
  if (database) {
    return database;
  }

  const config = getConfig();
  const directory = path.dirname(config.databasePath);
  fs.mkdirSync(directory, { recursive: true });

  database = new Database(config.databasePath);
  createSchema(database);
  return database;
}

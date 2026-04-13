import { getDatabase } from "@/lib/db";
import { getLiveState } from "@/lib/state/live";

export function getStoredLlmEnabled() {
  const db = getDatabase();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'llm_enabled'").get() as { value: string } | undefined;
  return row ? row.value === "true" : true;
}

export function setLlmEnabled(enabled: boolean) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('llm_enabled', ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key)
     DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
  ).run(String(enabled));

  getLiveState().setLlmEnabled(enabled);
}

export function logAdminAction(actionType: string, payload: Record<string, unknown>) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO admin_actions (action_type, payload)
     VALUES (?, ?)`
  ).run(actionType, JSON.stringify(payload));
}

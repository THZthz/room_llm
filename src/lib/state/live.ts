import { getDatabase } from "@/lib/db";

type LiveClient = {
  clientId: number;
  name: string;
  socketId: string;
  connectedAt: string;
  lastSeenAt: string;
};

class LiveState {
  private readonly clientsBySocket = new Map<string, LiveClient>();
  private llmEnabled = true;

  initialize(initialLlmEnabled: boolean) {
    this.llmEnabled = initialLlmEnabled;
  }

  registerClient(socketId: string, clientId: number, name: string) {
    const now = new Date().toISOString();
    this.clientsBySocket.set(socketId, {
      clientId,
      name,
      socketId,
      connectedAt: now,
      lastSeenAt: now
    });
  }

  heartbeat(socketId: string) {
    const client = this.clientsBySocket.get(socketId);
    if (!client) {
      return;
    }

    client.lastSeenAt = new Date().toISOString();
  }

  disconnect(socketId: string) {
    this.clientsBySocket.delete(socketId);
  }

  getClientBySocket(socketId: string) {
    return this.clientsBySocket.get(socketId);
  }

  getClients() {
    return [...this.clientsBySocket.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  hasActiveName(normalizedName: string) {
    return this.getClients().some((client) => client.name.trim().toLowerCase() === normalizedName);
  }

  isLlmEnabled() {
    return this.llmEnabled;
  }

  setLlmEnabled(enabled: boolean) {
    this.llmEnabled = enabled;
  }
}

const globalState = globalThis as typeof globalThis & {
  __roomLiveState?: LiveState;
};

export function getLiveState() {
  if (!globalState.__roomLiveState) {
    globalState.__roomLiveState = new LiveState();
  }

  return globalState.__roomLiveState;
}

export function initializeLiveState() {
  const state = getLiveState();
  const row = getDatabase().prepare("SELECT value FROM settings WHERE key = 'llm_enabled'").get() as
    | { value: string }
    | undefined;
  state.initialize(row ? row.value === "true" : true);
  return state;
}

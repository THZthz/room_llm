"use client";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { MarkdownBlock } from "@/components/markdown-block";
import { createRoomSocket } from "@/lib/socket/client";

type ClientPresence = {
  clientId: number;
  name: string;
  connected: boolean;
  connectedAt: string | null;
  lastSeenAt: string | null;
  messageCount: number;
};

type StoredSummary = {
  id: number;
  title: string;
  content: string;
  createdAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

async function readStreamingText(response: Response, onChunk: (chunk: string) => void) {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? "Request failed.");
    }

    throw new Error((await response.text()) || "Request failed.");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body returned by the server.");
  }

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    onChunk(decoder.decode(value, { stream: true }));
  }

  const tail = decoder.decode();
  if (tail) {
    onChunk(tail);
  }
}

export function AdminApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [clients, setClients] = useState<ClientPresence[]>([]);
  const [summaries, setSummaries] = useState<StoredSummary[]>([]);
  const [llmEnabled, setLlmEnabled] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [contextMode, setContextMode] = useState("summary");
  const [adminReply, setAdminReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [lastAdminPrompt, setLastAdminPrompt] = useState("");

  async function loadAdminData() {
    const clientsPayload = await fetchJson<{ clients: ClientPresence[]; llmEnabled: boolean }>("/api/admin/clients");
    const summaryPayload = await fetchJson<{ summaries: StoredSummary[] }>("/api/admin/summary");
    setClients(clientsPayload.clients);
    setLlmEnabled(clientsPayload.llmEnabled);
    setSummaries(summaryPayload.summaries);
  }

  useEffect(() => {
    void fetchJson<{ authenticated: boolean; llmEnabled: boolean }>("/api/admin/status")
      .then((payload) => {
        setAuthenticated(payload.authenticated);
        setLlmEnabled(payload.llmEnabled);
        if (payload.authenticated) {
          return loadAdminData();
        }
      })
      .catch(() => {
        setAuthenticated(false);
      });
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const socket = createRoomSocket();

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("subscribe-admin");
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("presence-state", (payload: { clients: ClientPresence[]; llmEnabled: boolean }) => {
      setClients(payload.clients);
      setLlmEnabled(payload.llmEnabled);
    });

    socket.on("llm-access-updated", (payload: { enabled: boolean }) => {
      setLlmEnabled(payload.enabled);
    });

    return () => {
      socket.disconnect();
      setSocketConnected(false);
    };
  }, [authenticated]);

  async function handleLogin() {
    setBusy(true);
    setError(null);

    try {
      await fetchJson<{ success: boolean }>("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });
      setAuthenticated(true);
      setPassword("");
      await loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetchJson<{ success: boolean }>("/api/admin/logout", {
      method: "POST"
    });
    setAuthenticated(false);
    setClients([]);
    setSummaries([]);
    setAdminReply("");
  }

  async function handleToggle(enabled: boolean) {
    setLlmEnabled(enabled);
    try {
      await fetchJson<{ llmEnabled: boolean }>("/api/admin/toggle-llm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ enabled })
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to update LLM state.");
      setLlmEnabled(!enabled);
    }
  }

  async function handleSummarize() {
    setBusy(true);
    setError(null);

    try {
      const payload = await fetchJson<{ summary: StoredSummary; summaries: StoredSummary[] }>("/api/admin/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clientIds: selectedClientIds.length ? selectedClientIds : undefined })
      });
      setSummaries(payload.summaries);
      setAdminReply(payload.summary.content);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Summary failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdminChat() {
    if (!prompt.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    const pendingPrompt = prompt;
    setLastAdminPrompt(pendingPrompt);
    setAdminReply("");
    setPrompt("");

    try {
      const response = await fetch("/api/chat/admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: pendingPrompt,
          contextMode,
          clientIds: selectedClientIds.length ? selectedClientIds : undefined
        })
      });

      await readStreamingText(response, (chunk) => {
        setAdminReply((current) => `${current}${chunk}`);
      });
    } catch (requestError) {
      setPrompt(pendingPrompt);
      setError(requestError instanceof Error ? requestError.message : "Admin chat failed.");
    } finally {
      setBusy(false);
    }
  }

  function toggleClientSelection(clientId: number) {
    setSelectedClientIds((current) =>
      current.includes(clientId) ? current.filter((value) => value !== clientId) : [...current, clientId]
    );
  }

  function clearClientSelection() {
    setSelectedClientIds([]);
  }

  if (!authenticated) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="overline" sx={{ color: "primary.main", fontWeight: 700 }}>
              Admin Console
            </Typography>
            <Typography variant="h4">Enter the server password</Typography>
            <Typography color="text.secondary">
              This dashboard is intended for the room operator on the same network.
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
            <Box>
              <Button variant="contained" onClick={handleLogin} disabled={busy || !password}>
                Unlock admin view
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Box>
              <Typography variant="overline" sx={{ color: "secondary.main", fontWeight: 700 }}>
                Admin Console
              </Typography>
              <Typography variant="h4">Live room control</Typography>
              <Typography color="text.secondary">Monitor clients, control access, summarize discussion, and chat with the shared context.</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip color={socketConnected ? "primary" : "default"} label={socketConnected ? "Live" : "Polling only"} />
              <Chip color={llmEnabled ? "secondary" : "default"} label={llmEnabled ? "Client LLM enabled" : "Client LLM disabled"} />
              <Button variant="outlined" onClick={handleLogout}>
                Log out
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
            <Box>
              <Typography variant="h6">Client LLM access</Typography>
              <Typography color="text.secondary">This toggle immediately affects all connected client pages.</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>Disabled</Typography>
              <Switch checked={llmEnabled} onChange={(_, checked) => handleToggle(checked)} />
              <Typography>Enabled</Typography>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} alignItems={{ xs: "flex-start", md: "center" }}>
              <Box>
                <Typography variant="h6">Clients</Typography>
                <Typography color="text.secondary">
                  Select specific clients to scope summaries and admin chat. With no selection, admin actions use all clients.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={selectedClientIds.length ? `${selectedClientIds.length} selected` : "All clients in scope"} color={selectedClientIds.length ? "secondary" : "default"} />
                <Button variant="outlined" onClick={clearClientSelection} disabled={selectedClientIds.length === 0}>
                  Clear selection
                </Button>
              </Stack>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">Use</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Messages</TableCell>
                  <TableCell>Last seen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.clientId}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedClientIds.includes(client.clientId)}
                        onChange={() => toggleClientSelection(client.clientId)}
                      />
                    </TableCell>
                    <TableCell>{client.name}</TableCell>
                    <TableCell>
                      <Chip size="small" color={client.connected ? "primary" : "default"} label={client.connected ? "Connected" : "Offline"} />
                    </TableCell>
                    <TableCell>{client.messageCount}</TableCell>
                    <TableCell>{client.lastSeenAt ? new Date(client.lastSeenAt).toLocaleTimeString() : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6">Summaries</Typography>
                <Typography color="text.secondary">Generate a room-wide summary from client conversations.</Typography>
              </Box>
              <Box>
                <Button variant="contained" color="secondary" onClick={handleSummarize} disabled={busy}>
                  {selectedClientIds.length ? "Summarize selected clients" : "Summarize all clients"}
                </Button>
              </Box>
            </Stack>
            <Stack spacing={1.5}>
              {summaries.length === 0 ? (
                <Typography color="text.secondary">No summaries yet.</Typography>
              ) : (
                summaries.map((summary) => (
                  <Paper key={summary.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {summary.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(summary.createdAt).toLocaleString()}
                    </Typography>
                    <MarkdownBlock content={summary.content} />
                  </Paper>
                ))
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Admin chat</Typography>
            <Typography color="text.secondary">Use no context, recent summaries, or full client transcripts in each admin prompt.</Typography>
            <FormControl sx={{ maxWidth: 240 }}>
              <InputLabel id="context-mode-label">Context</InputLabel>
              <Select labelId="context-mode-label" value={contextMode} label="Context" onChange={(event) => setContextMode(event.target.value)}>
                <MenuItem value="none">No client context</MenuItem>
                <MenuItem value="summary">Recent summaries</MenuItem>
                <MenuItem value="full">Full client transcripts</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} multiline minRows={4} fullWidth />
            <Box>
              <Button variant="contained" onClick={handleAdminChat} disabled={busy || !prompt.trim()}>
                Ask admin assistant
              </Button>
            </Box>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 140 }}>
              {lastAdminPrompt ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    Operator
                  </Typography>
                  <MarkdownBlock content={lastAdminPrompt} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
                    Assistant
                  </Typography>
                  {adminReply ? <MarkdownBlock content={adminReply} /> : <Typography>Thinking...</Typography>}
                </>
              ) : (
                <Typography>No admin response yet.</Typography>
              )}
            </Paper>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

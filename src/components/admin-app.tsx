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
  Typography,
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

async function readStreamingText(
  response: Response,
  onChunk: (chunk: string) => void,
) {
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
    const clientsPayload = await fetchJson<{
      clients: ClientPresence[];
      llmEnabled: boolean;
    }>("/api/admin/clients");
    const summaryPayload = await fetchJson<{ summaries: StoredSummary[] }>(
      "/api/admin/summary",
    );
    setClients(clientsPayload.clients);
    setLlmEnabled(clientsPayload.llmEnabled);
    setSummaries(summaryPayload.summaries);
  }

  useEffect(() => {
    void fetchJson<{ authenticated: boolean; llmEnabled: boolean }>(
      "/api/admin/status",
    )
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

    socket.on(
      "presence-state",
      (payload: { clients: ClientPresence[]; llmEnabled: boolean }) => {
        setClients(payload.clients);
        setLlmEnabled(payload.llmEnabled);
      },
    );

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      setAuthenticated(true);
      setPassword("");
      await loadAdminData();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Login failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetchJson<{ success: boolean }>("/api/admin/logout", {
      method: "POST",
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update LLM state.",
      );
      setLlmEnabled(!enabled);
    }
  }

  async function handleSummarize() {
    setBusy(true);
    setError(null);

    try {
      const payload = await fetchJson<{
        summary: StoredSummary;
        summaries: StoredSummary[];
      }>("/api/admin/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientIds: selectedClientIds.length ? selectedClientIds : undefined,
        }),
      });
      setSummaries(payload.summaries);
      setAdminReply(payload.summary.content);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Summary failed.",
      );
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: pendingPrompt,
          contextMode,
          clientIds: selectedClientIds.length ? selectedClientIds : undefined,
        }),
      });

      await readStreamingText(response, (chunk) => {
        setAdminReply((current) => `${current}${chunk}`);
      });
    } catch (requestError) {
      setPrompt(pendingPrompt);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Admin chat failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleClientSelection(clientId: number) {
    setSelectedClientIds((current) =>
      current.includes(clientId)
        ? current.filter((value) => value !== clientId)
        : [...current, clientId],
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
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 700 }}
            >
              管理控制台
            </Typography>
            <Typography variant="h4">输入服务器密码</Typography>
            <Typography color="text.secondary">
              此仪表盘仅供同一网络下的房间操作员使用。
            </Typography>
            {error ? <Alert severity="error">{error}</Alert> : null}
            <TextField
              label="密码"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              fullWidth
            />
            <Box>
              <Button
                variant="contained"
                onClick={handleLogin}
                disabled={busy || !password}
              >
                解锁管理员视图
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
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "secondary.main", fontWeight: 700 }}
              >
                管理控制台
              </Typography>
              <Typography variant="h4">实时房间控制</Typography>
              <Typography color="text.secondary">
                监控客户端、控制访问权限、总结讨论并与共享上下文进行聊天。
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                color={socketConnected ? "primary" : "default"}
                label={socketConnected ? "实时连接" : "仅轮询"}
              />
              <Chip
                color={llmEnabled ? "secondary" : "default"}
                label={
                  llmEnabled
                    ? "客户端LLM已启用"
                    : "客户端LLM已禁用"
                }
              />
              <Button variant="outlined" onClick={handleLogout}>
                退出登录
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}

        <Paper sx={{ p: 3 }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h6">客户端LLM访问权限</Typography>
              <Typography color="text.secondary">
                此开关会立即影响所有连接的客户端页面。
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography>禁用</Typography>
              <Switch
                checked={llmEnabled}
                onChange={(_, checked) => handleToggle(checked)}
              />
              <Typography>启用</Typography>
            </Stack>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Box>
                <Typography variant="h6">客户端</Typography>
                <Typography color="text.secondary">
                  选择特定客户端以限定总结范围和管理员聊天。未选择时，管理员操作将作用于所有客户端。
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={
                    selectedClientIds.length
                      ? `已选 ${selectedClientIds.length} 个`
                      : "作用于所有客户端"
                  }
                  color={selectedClientIds.length ? "secondary" : "default"}
                />
                <Button
                  variant="outlined"
                  onClick={clearClientSelection}
                  disabled={selectedClientIds.length === 0}
                >
                  清除选择
                </Button>
              </Stack>
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">#</TableCell>
                  <TableCell>名称</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>消息数</TableCell>
                  <TableCell>最后活跃</TableCell>
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
                      <Chip
                        size="small"
                        color={client.connected ? "primary" : "default"}
                        label={client.connected ? "在线" : "离线"}
                      />
                    </TableCell>
                    <TableCell>{client.messageCount}</TableCell>
                    <TableCell>
                      {client.lastSeenAt
                        ? new Date(client.lastSeenAt).toLocaleTimeString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Stack>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
            >
              <Box>
                <Typography variant="h6">总结</Typography>
                <Typography color="text.secondary">
                  根据客户端对话生成房间范围的总结。
                </Typography>
              </Box>
              <Box>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={handleSummarize}
                  disabled={busy}
                >
                  {selectedClientIds.length
                    ? "总结所选客户端"
                    : "总结所有客户端"}
                </Button>
              </Box>
            </Stack>
            <Stack spacing={1.5}>
              {summaries.length === 0 ? (
                <Typography color="text.secondary">暂无总结。</Typography>
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
            <Typography variant="h6">管理员聊天</Typography>
            <Typography color="text.secondary">
              每次提示时可选择不使用上下文、使用近期总结或完整的客户端记录。
            </Typography>
            <FormControl sx={{ maxWidth: 240 }}>
              <InputLabel id="context-mode-label">上下文</InputLabel>
              <Select
                labelId="context-mode-label"
                value={contextMode}
                label="Context"
                onChange={(event) => setContextMode(event.target.value)}
              >
                <MenuItem value="none">无客户端上下文</MenuItem>
                <MenuItem value="summary">近期总结</MenuItem>
                <MenuItem value="full">完整客户端记录</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="提示"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              multiline
              minRows={4}
              fullWidth
            />
            <Box>
              <Button
                variant="contained"
                onClick={handleAdminChat}
                disabled={busy || !prompt.trim()}
              >
                询问助手
              </Button>
            </Box>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 140 }}>
              {lastAdminPrompt ? (
                <>
                  <Typography variant="caption" color="text.secondary">
                    操作员
                  </Typography>
                  <MarkdownBlock content={lastAdminPrompt} />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 2 }}
                  >
                    助手
                  </Typography>
                  {adminReply ? (
                    <MarkdownBlock content={adminReply} />
                  ) : (
                    <Typography>正在思考...</Typography>
                  )}
                </>
              ) : (
                <Typography>尚无助手回复。</Typography>
              )}
            </Paper>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

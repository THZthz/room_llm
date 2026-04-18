"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { MarkdownBlock } from "@/components/markdown-block";
import { createRoomSocket } from "@/lib/socket/client";

type ChatMessage = {
  id: number | string;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: string;
};

type ClientSession = {
  sessionToken: string;
  clientId: number;
  clientName: string;
};

type SessionPayload = {
  sessionToken: string;
  clientId: number;
  clientName: string;
  messages: ChatMessage[];
  llmEnabled: boolean;
};

const storageKey = "room-llm-client-session";

async function postJson<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

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

export function ClientApp() {
  const [session, setSession] = useState<ClientSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [llmEnabled, setLlmEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    const saved = window.localStorage.getItem(storageKey);

    if (!saved) {
      setLoading(false);
      return;
    }

    const parsed = JSON.parse(saved) as ClientSession;

    void postJson<SessionPayload>("/api/client/me", {
      sessionToken: parsed.sessionToken,
    })
      .then((payload) => {
        if (!active) {
          return;
        }

        setSession({
          sessionToken: payload.sessionToken,
          clientId: payload.clientId,
          clientName: payload.clientName,
        });
        setMessages(payload.messages);
        setLlmEnabled(payload.llmEnabled);
      })
      .catch(() => {
        window.localStorage.removeItem(storageKey);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const socket = createRoomSocket();
    const heartbeat = window.setInterval(() => {
      socket.emit("heartbeat");
    }, 10000);

    socket.on("connect", () => {
      setConnected(true);
      socket.emit(
        "register-client",
        { sessionToken: session.sessionToken },
        (response: { ok: boolean; error?: string; llmEnabled?: boolean }) => {
          if (!response.ok) {
            setError(response.error ?? "Unable to register live connection.");
            return;
          }

          setLlmEnabled(response.llmEnabled ?? true);
        },
      );
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("llm-access-updated", (payload: { enabled: boolean }) => {
      setLlmEnabled(payload.enabled);
    });

    return () => {
      window.clearInterval(heartbeat);
      socket.disconnect();
      setConnected(false);
    };
  }, [session]);

  const statusLabel = useMemo(() => {
    if (loading) {
      return "Loading";
    }

    return connected ? "Connected" : "Offline";
  }, [connected, loading]);

  async function handleRegister() {
    setBusy(true);
    setError(null);

    try {
      const payload = await postJson<SessionPayload>("/api/client/register", {
        name,
      });
      const nextSession = {
        sessionToken: payload.sessionToken,
        clientId: payload.clientId,
        clientName: payload.clientName,
      } satisfies ClientSession;

      window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
      setSession(nextSession);
      setMessages(payload.messages);
      setLlmEnabled(payload.llmEnabled);
      setName("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Registration failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!session || !draft.trim()) {
      return;
    }

    setBusy(true);
    setError(null);
    const pendingMessage = draft;
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        content: pendingMessage,
        createdAt: new Date().toISOString(),
      },
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");

    try {
      const response = await fetch("/api/chat/client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionToken: session.sessionToken,
          message: pendingMessage,
        }),
      });

      await readStreamingText(response, (chunk) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: `${message.content}${chunk}`,
                }
              : message,
          ),
        );
      });
    } catch (requestError) {
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id !== userMessageId && message.id !== assistantMessageId,
        ),
      );
      setDraft(pendingMessage);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Message failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function resetIdentity() {
    window.localStorage.removeItem(storageKey);
    setSession(null);
    setMessages([]);
    setError(null);
    setConnected(false);
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper sx={{ p: 3, border: "1px solid rgba(15,118,110,0.12)" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={2}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            <Box>
              <Typography
                variant="overline"
                sx={{ color: "primary.main", fontWeight: 700 }}
              >
                客户端控制台
              </Typography>
              <Typography variant="h4">与房间助手聊天</Typography>
              <Typography color="text.secondary">
                您的浏览器仅与服务器通信。服务器决定何时允许访问LLM。
              </Typography>
            </Box>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "nowrap", flexShrink: 0 }}
            >
              <Chip
                color={connected ? "primary" : "default"}
                label={statusLabel}
              />
              <Chip
                color={llmEnabled ? "secondary" : "default"}
                label={llmEnabled ? "LLM已启用" : "LLM已禁用"}
              />
            </Stack>
          </Stack>
        </Paper>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {!session ? (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h6">注册小组名称</Typography>
              <Typography color="text.secondary">
                连接期间名称必须唯一。开发模式会放宽设备限制。
              </Typography>
              <TextField
                label="小组名称"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
              />
              <Box>
                <Button
                  variant="contained"
                  onClick={handleRegister}
                  disabled={busy || !name.trim()}
                >
                  加入房间
                </Button>
              </Box>
            </Stack>
          </Paper>
        ) : (
          <>
            <Paper sx={{ p: 3 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={2}
                alignItems={{ xs: "flex-start", sm: "center" }}
              >
                <Box>
                  <Typography variant="h6">
                    已登录为 {session.clientName}
                  </Typography>
                  <Typography color="text.secondary">
                    会话本地存储于此浏览器中。
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={resetIdentity}
                >
                  重置身份
                </Button>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h6">对话</Typography>
                <Stack spacing={1.5}>
                  {messages.length === 0 ? (
                    <Typography color="text.secondary">暂无消息。</Typography>
                  ) : (
                    messages.map((message) => (
                      <Box
                        key={message.id}
                        sx={{
                          alignSelf:
                            message.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                          px: 2,
                          py: 1.5,
                          borderRadius: 3,
                          backgroundColor:
                            message.role === "user"
                              ? "secondary.main"
                              : "background.default",
                          color:
                            message.role === "user"
                              ? "common.white"
                              : "text.primary",
                        }}
                      >
                        <Typography variant="caption" sx={{ opacity: 0.78 }}>
                          {message.role === "user"
                            ? session.clientName
                            : "助手"}
                        </Typography>
                        <MarkdownBlock
                          content={
                            message.content ||
                            (message.role === "assistant" && busy
                              ? "正在思考..."
                              : "")
                          }
                          sx={{
                            mt: 0.5,
                            color: "inherit",
                            "& code": {
                              backgroundColor:
                                message.role === "user"
                                  ? "rgba(255, 255, 255, 0.18)"
                                  : "rgba(15, 23, 42, 0.06)",
                              color: "inherit",
                            },
                            "& pre": {
                              backgroundColor:
                                message.role === "user"
                                  ? "rgba(255, 255, 255, 0.18)"
                                  : "rgba(15, 23, 42, 0.06)",
                            },
                          }}
                        />
                      </Box>
                    ))
                  )}
                </Stack>
              </Stack>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                {!llmEnabled ? (
                  <Alert severity="warning">
                    服务器已暂时禁用客户端对LLM的访问。
                  </Alert>
                ) : null}
                <TextField
                  label="消息"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  multiline
                  minRows={3}
                  fullWidth
                  disabled={!llmEnabled || busy}
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleSend}
                    disabled={busy || !draft.trim() || !llmEnabled}
                  >
                    发送
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}

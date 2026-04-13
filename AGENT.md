# Room LLM Control

## Current Goal
- Build a lightweight LAN-first web application with one server/admin UI and multiple client UIs.
- All LLM access must go through the server via AI SDK.
- The admin can monitor clients live, enable or disable client LLM access, summarize client conversations, and chat with the shared context.

## Accepted Constraints
- Single server process on the same network and in the same room.
- SQLite for persistence.
- Socket.IO for real-time status and control.
- Simple admin password gate for v1.
- Development mode can ignore strict one-device and one-tab enforcement.

## Current Architecture
- Next.js App Router app with a custom Node server in server.ts.
- The custom server loads Next-style env files before reading validated config.
- SQLite database through better-sqlite3 for clients, sessions, messages, summaries, admin actions, and settings.
- In-memory live state for connected sockets and current LLM-enabled status, initialized from SQLite on boot.
- Socket.IO channel at /api/socket for client registration, heartbeats, live presence, and admin subscriptions.
- Client-side and admin-side LLM routes both call providers only through AI SDK server code.
- Supported providers are OpenAI, Anthropic, DeepSeek, and OpenRouter.
- Chat routes now stream model output incrementally to the browser instead of waiting for a full response.

## Initial File Layout
- package.json: project scripts and dependencies.
- server.ts: self-hosted Next.js + Socket.IO bootstrap.
- src/app/client/page.tsx: participant UI entry.
- src/app/admin/page.tsx: admin UI entry.
- src/app/api/client/*: registration and session restore routes.
- src/app/api/chat/*: client and admin AI routes.
- src/app/api/admin/*: password gate, live data, summaries, and LLM toggle routes.
- src/lib/domain/*: SQLite-backed domain logic.
- src/lib/socket/*: real-time server and browser socket helpers.
- src/lib/state/live.ts: single-process live state store.

## Current Status
- Foundation scaffold is created.
- SQLite schema and live-state model are in place.
- Client registration, admin login, admin monitoring, summary trigger, and chat routes are implemented.
- Material-styled client and admin pages are implemented in the first pass.
- Admin can now target selected clients when generating summaries or building admin-chat context.
- The workspace validates cleanly in the editor.
- README.md now documents local setup, environment variables, routes, and manual testing flow.
- DeepSeek and OpenRouter are supported through the provider configuration layer.
- Client and admin content width are aligned, and markdown rendering is enabled for admin summaries and responses.
- Client chat bubbles and admin chat exchange render markdown, and both client/admin LLM responses stream live.
- Fenced markdown code blocks now use syntax highlighting through the shared markdown renderer.

## Next Steps
- Exercise the LAN workflow manually with multiple browser windows.
- Verify selected-client summary and admin-chat flows against real conversations.
- Tighten any AI SDK integration details that depend on installed package versions.

## Notes
- This file should be kept current as implementation changes.

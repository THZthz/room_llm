# Room LLM Control

A lightweight LAN-first web application for one server/admin console and multiple browser clients in the same room.

## Features
- Multiple browser clients with unique server-verified names
- Real-time client presence monitoring on the admin page
- Global admin toggle for enabling or disabling client LLM access
- Client-side chat proxied through the server using AI SDK
- Admin-side summary generation from client conversations
- Admin-side chat with optional summary or transcript context
- SQLite persistence for clients, sessions, messages, summaries, and settings

## Stack
- Next.js App Router
- TypeScript
- Socket.IO
- AI SDK
- better-sqlite3
- Material UI

## Prerequisites
- Node.js 20 or newer
- An LLM provider key supported by the configured AI SDK provider

## Supported Providers
- `openai`
- `anthropic`
- `deepseek`
- `openrouter`

DeepSeek and OpenRouter are wired through the OpenAI-compatible AI SDK adapter, so no extra package is required beyond the existing dependencies.

## Setup
1. Create an environment file from [.env.example](.env.example).
2. Set at least these values:
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `AI_PROVIDER`
   - `AI_MODEL`
   - one matching API key:
     - `OPENAI_API_KEY`
     - `ANTHROPIC_API_KEY`
     - `DEEPSEEK_API_KEY`
     - `OPENROUTER_API_KEY`
3. Install dependencies:
   - `npm install`
4. Start the app in development mode:
   - `npm run dev`

## Provider Examples

### OpenAI
```env
AI_PROVIDER=openai
AI_MODEL=gpt-4.1-mini
OPENAI_API_KEY=your_key_here
```

### Anthropic
```env
AI_PROVIDER=anthropic
AI_MODEL=claude-3-7-sonnet-latest
ANTHROPIC_API_KEY=your_key_here
```

### DeepSeek
```env
AI_PROVIDER=deepseek
AI_MODEL=deepseek-chat
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

### OpenRouter
```env
AI_PROVIDER=openrouter
AI_MODEL=openai/gpt-4.1-mini
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=Room LLM Control
```

## LAN Usage
- The server binds to `HOST` and `PORT` from the environment.
- For same-room use, `HOST=0.0.0.0` allows other devices on the LAN to open the app.
- Open these routes:
  - `/client` on participant devices
  - `/admin` on the operator device

## Starting The Server
1. In `d:\projects\app`, create `.env` from `.env.example`.
2. Fill in the admin password, session secret, provider, model, and matching API key.
3. Run `npm install`.
4. Run `npm run dev`.
5. Wait for the server to report that it is listening on `http://HOST:PORT`.

The custom server now loads Next-style env files automatically at startup, but you still need a real `.env` file in the project root. `.env.example` is only a template and is not loaded as runtime config.

For a Windows same-LAN setup, the default is usually:
- admin machine: `http://localhost:3000/admin`
- admin machine home page: `http://localhost:3000/`
- participant devices: `http://<server-lan-ip>:3000/client`
- participant devices can also open: `http://<server-lan-ip>:3000/`

## Main Routes
- `/` landing page
- `/client` participant UI
- `/admin` admin UI

## API Overview
- `POST /api/client/register` register a client name
- `POST /api/client/me` restore a client session from local storage
- `POST /api/chat/client` send a client prompt through the server proxy
- `POST /api/chat/admin` send an admin prompt with optional client context
- `GET /api/admin/status` check admin auth and global LLM state
- `GET /api/admin/clients` fetch current client list and presence
- `POST /api/admin/login` create the admin session cookie
- `POST /api/admin/logout` clear the admin session cookie
- `POST /api/admin/toggle-llm` enable or disable client LLM access
- `GET /api/admin/summary` fetch recent summaries
- `POST /api/admin/summary` create a new summary for all or selected clients

## Data Storage
SQLite is stored at the path configured by `DATABASE_PATH`.
The app creates the database file and schema automatically on startup.

## Current Limits
- Single Node process only
- Live presence is stored in memory
- Admin auth is a simple password gate, not a full user system
- Device and single-tab enforcement is intentionally relaxed for development and LAN-first use

## Recommended First Manual Test
1. Open `/admin` and log in.
2. Open `/client` in two or more browser windows.
3. Register different client names.
4. Verify live presence updates in the admin view.
5. Send client prompts and confirm they appear in summaries.
6. Toggle client LLM access off and confirm new client prompts are blocked.

# CollabCode v4 🚀

A production-grade real-time collaborative code editor with dual-mode support — **Personal** (AI-assisted coding) and **Interview** (structured technical interviews).

🔗 **Live Demo:** [collab-code-s8vw.vercel.app](https://collab-code-s8vw.vercel.app)
📦 **Repo:** [github.com/luicifersaunik/collab-code](https://github.com/luicifersaunik/collab-code)

---

## ✨ Features

### Both Modes
- **Real-time collaborative editing** — conflict-free simultaneous editing via Yjs CRDT, sub-100ms sync
- **Multi-file tabs** — create, rename, delete files per room; each file has its own Yjs doc
- **Live cursor & selection sync** — color-coded per user with floating name labels
- **Code execution** — sandboxed via Judge0 across 14 languages with stdin support
- **Real-time chat** — persistent message history per room, unread badge
- **JWT Authentication** — bcrypt-hashed passwords, 7-day tokens
- **GitHub OAuth** — one-click login via Passport.js
- **Room-based sessions** — 8-character invite codes, shareable links
- **Redis persistence** — rooms, chat, files survive server restarts (in-memory fallback for dev)

### 👨‍💻 Personal Mode
- **AI coding assistant** — powered by Groq (Llama 3.3 70B), free tier
- Quick prompts: Explain code, Fix bug, Optimize, Add comments, Write tests, Explain error
- Context-aware — AI sees your current code and language automatically
- Markdown code block rendering in chat

### 🏢 Interview Mode
- **Session timer** — circular countdown, interviewer-controlled start, color changes as time runs out
- **Private interviewer notes** — auto-saved, never visible to candidates
- **Feedback form** — star rating, hire/no-hire decision, strengths & improvements
- **AI disabled** — candidates cannot use AI assistance, enforced server-side
- Role-based joining — Interviewer or Candidate

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite |
| Editor | Monaco Editor (VS Code engine) |
| Real-time sync | Socket.io WebSockets + Yjs CRDT |
| Backend | Node.js, Express |
| Auth | JWT, bcrypt, Passport.js (GitHub OAuth) |
| AI | Groq API (Llama 3.3 70B) — free tier |
| Code execution | Judge0 API proxy |
| Persistence | Redis (with in-memory fallback) |
| Deployment | Railway (backend) + Vercel (frontend) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 8+

### 1. Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment
Create `server/.env`:
```
PORT=3001
JWT_SECRET=your-long-random-secret
SESSION_SECRET=another-random-secret
GROQ_API_KEY=gsk_your_groq_key        # free at console.groq.com
JUDGE0_URL=https://ce.judge0.com
# REDIS_URL=redis://localhost:6379    # optional
# GITHUB_CLIENT_ID=your_id           # optional
# GITHUB_CLIENT_SECRET=your_secret   # optional
# BACKEND_URL=http://localhost:3001
# FRONTEND_URL=http://localhost:3000
```

### 3. Run
```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

Open **http://localhost:3000**

---

## 🏗 Architecture

```
User Browser
     │
     ├── HTTPS ──► Vercel (React/Vite frontend)
     │                  │
     └── WSS ────► Railway (Node.js + Socket.io)
                        │
                   ┌────┴────┐
                   │         │
                Redis      Groq API
              (rooms)     (AI assist)
                   │
              Judge0 API
           (code execution)
```

### How real-time sync works (Yjs CRDT)
Each file in a room has its own `Y.Doc`. Edits are encoded as binary updates and broadcast via Socket.io. On join, the server sends the current state vector so the new user merges cleanly. No edit conflicts under any concurrency level.

### Room lifecycle
1. Create room → choose Personal or Interview mode → get 8-char code
2. Socket connects → `join-room` event → server sends full room state
3. All edits, cursor moves, file ops, chat sync in real time
4. On disconnect → user removed, empty rooms garbage collected

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with username + password |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Validate token |
| GET | `/api/auth/github` | GitHub OAuth redirect |
| POST | `/api/room/create` | Create room (`mode`, `timerDuration`) |
| GET | `/api/room/:id` | Check if room exists |
| POST | `/api/execute` | Run code (`code`, `language`, `stdin`) |
| POST | `/api/ai-assist` | AI chat (`prompt`, `code`, `language`) |
| POST | `/api/room/:id/feedback` | Save interview feedback |

### Socket events

| Client → Server | Server → Client | Description |
|----------------|-----------------|-------------|
| `join-room` | `room-state` | Join and receive full state |
| `yjs-update` | `yjs-update` | CRDT sync update |
| `file-create` | `file-created` | New file tab |
| `file-rename` | `file-renamed` | Rename tab |
| `file-delete` | `file-deleted` | Delete tab |
| `cursor-move` | `cursor-update` | Live cursor position |
| `chat-message` | `chat-message` | Chat broadcast |
| `timer-start` | `timer-started` | Interview timer |
| `notes-update` | `notes-saved` | Private interviewer notes |

---

## 🌍 Production Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Root dir: `client`, Framework: Vite |
| Backend | Railway | Root dir: `server`, Start: `node server.js` |

### Environment variables — Railway
```
NODE_ENV=production
PORT=3001
JWT_SECRET=...
SESSION_SECRET=...
GROQ_API_KEY=...
JUDGE0_URL=https://ce.judge0.com
BACKEND_URL=https://your-railway-url.up.railway.app
FRONTEND_URL=https://your-vercel-url.vercel.app
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

### Environment variables — Vercel
```
VITE_SERVER_URL=https://your-railway-url.up.railway.app
VITE_GITHUB_OAUTH=true
```

---

## 📄 License

MIT

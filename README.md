# CollabCode 🚀

A real-time collaborative code editor supporting simultaneous multi-user editing with live cursor sync, powered by **Socket.io**, **Monaco Editor** (VS Code's core engine), and **React**.

---

## Tech Stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Frontend  | React 18, Vite                    |
| Editor    | Monaco Editor (`@monaco-editor/react`) |
| Backend   | Node.js, Express                  |
| Real-time | Socket.io (WebSocket)             |

---

## Features

- **Real-time collaborative editing** — changes propagate instantly to all users in the same room
- **Live cursor & selection sync** — each collaborator gets a unique color; their cursor and text selections are visible to everyone else
- **Room-based sessions** — 8-character room codes; create or join with no account required
- **Monaco Editor** — full VS Code editing experience with syntax highlighting, bracket coloring, and IntelliSense
- **15 supported languages** — JavaScript, TypeScript, Python, Rust, Go, C++, Java, SQL, and more
- **Shareable links** — copy a link and send it; recipients land directly in your room
- **Event-driven backend** — efficient WebSocket handling for concurrent multi-user load

---

## Project Structure

```
collabcode/
├── server/
│   ├── server.js          # Express + Socket.io backend
│   └── package.json
├── client/
│   ├── src/
│   │   ├── App.jsx            # Root — routing between Landing & Editor
│   │   ├── socket.js          # Socket.io singleton
│   │   └── components/
│   │       ├── Landing.jsx        # Create / join room page
│   │       ├── Landing.module.css
│   │       ├── EditorPage.jsx     # Main editor + socket logic
│   │       ├── EditorPage.module.css
│   │       ├── Toolbar.jsx        # Room info, language selector, leave
│   │       ├── Toolbar.module.css
│   │       ├── UserList.jsx       # Connected users sidebar
│   │       └── UserList.module.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json           # Root scripts
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 8+

### 1. Install dependencies

```bash
# From the project root
npm run install:all
```

Or manually:
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Run in development

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev        # nodemon, auto-restarts on change
# Server runs on http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev        # Vite dev server with HMR
# App runs on http://localhost:3000
```

The Vite proxy in `vite.config.js` forwards `/api` and `/socket.io` to the backend automatically — no CORS issues in dev.

### 3. Open the app

Navigate to **http://localhost:3000**, create a room, copy the invite link, and open it in another tab or browser to test live collaboration.

---

## How It Works

### Room lifecycle

1. User clicks **Create Room** → POST `/api/room/create` → server generates an 8-char ID and initializes room state in memory
2. User (or invited collaborator) opens invite link → GET `/api/room/:id` validates existence
3. Socket connects → `join-room` event → server sends `room-state` (current code, language, all users)
4. Server emits `user-joined` and `users-updated` to existing occupants
5. On disconnect → user removed from room; empty rooms are garbage-collected

### Real-time sync

| Event (client → server) | Event (server → client) | Payload |
|--------------------------|--------------------------|---------|
| `code-change`            | `code-update`            | Full code string |
| `language-change`        | `language-update`        | Language ID |
| `cursor-move`            | `cursor-update`          | Position + selection + color + name |
| `join-room`              | `room-state`             | Initial snapshot |
| *(disconnect)*           | `user-left`              | Socket ID |

### Cursor rendering

Remote cursors are rendered as Monaco Editor decorations. Each user gets a unique color from a 10-color palette. Dynamic `<style>` tags inject per-user CSS classes (`.remoteCursor-{shortId}`, `.remoteSelection-{shortId}`) that Monaco targets via `afterContentClassName` to show floating name labels above the cursor.

---

## Production Deployment

### Build the client

```bash
npm run build
# Output in client/dist/
```

### Serve static files from Express

Add to `server/server.js` before `server.listen`:

```js
const path = require("path");
app.use(express.static(path.join(__dirname, "../client/dist")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist/index.html"));
});
```

### Environment variables

| Variable    | Default       | Description            |
|-------------|---------------|------------------------|
| `PORT`      | `3001`        | Backend port           |
| `VITE_SERVER_URL` | `""`    | WS server URL in prod  |

Set `VITE_SERVER_URL=https://your-api-domain.com` in `client/.env.production` before building.

---

## Extending the Project

- **Operational Transformation / CRDT** — replace full-string broadcast with `y-monaco` + Yjs for conflict-free merging under high concurrency
- **Persistent rooms** — swap in-memory store for Redis or PostgreSQL
- **Code execution** — add a sandboxed runner (e.g. Judge0 API) and a Run button
- **Chat panel** — add a `chat-message` socket event and a side panel
- **Auth** — add JWT or OAuth to enable named persistent sessions

---

## License

MIT

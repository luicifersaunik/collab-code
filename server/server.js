require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

const store = require("./store");
const { signToken, verifyToken, hashPassword, checkPassword, authMiddleware } = require("./auth");

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://collab-code-production-a926.up.railway.app",
  "https://collab-code-s8vw.vercel.app"
];

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const activeUsers = new Map();
const roomSockets = new Map();

const USER_COLORS = [
  "#00d4ff","#ff6b6b","#ffd93d","#6bcb77",
  "#c77dff","#ff9f43","#48cae4","#f72585",
  "#06ffa5","#ff6b35",
];

const DEFAULT_CODE = `// Welcome to CollabCode!\n// Start typing to collaborate in real-time.\n\nfunction greet(name) {\n  return \`Hello, \${name}! Let's build something great.\`;\n}\n\nconsole.log(greet("World"));\n`;

const JUDGE0_LANG_MAP = {
  javascript: 63, typescript: 74, python: 71, java: 62,
  cpp: 54, c: 50, csharp: 51, rust: 73, go: 60,
  shell: 46, ruby: 72, php: 68, swift: 83, kotlin: 78,
};

// ── AUTH ROUTES ──────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: "Username must be 2–20 characters" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const exists = await store.userExists(username);
    if (exists) return res.status(409).json({ error: "Username already taken" });
    const passwordHash = await hashPassword(password);
    await store.createUser(username, passwordHash);
    const token = signToken({ username });
    res.json({ token, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await store.getUser(username);
    if (!user) return res.status(401).json({ error: "Invalid username or password" });
    const valid = await checkPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });
    const token = signToken({ username });
    res.json({ token, username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ username: req.user.username });
});

// ── ROOM ROUTES ──────────────────────────────────────────────────────────────

app.get("/api/room/:roomId", async (req, res) => {
  const exists = await store.roomExists(req.params.roomId);
  res.json({ exists });
});

app.post("/api/room/create", async (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  await store.createRoom(roomId, { code: DEFAULT_CODE, language: "javascript" });
  res.json({ roomId });
});

// ── CODE EXECUTION ───────────────────────────────────────────────────────────

const JUDGE0_BASE = process.env.JUDGE0_URL || "https://ce.judge0.com";

app.post("/api/execute", async (req, res) => {
  const { code, language } = req.body;
  const langId = JUDGE0_LANG_MAP[language];
  if (!langId) return res.status(400).json({ error: `Language '${language}' not supported for execution.` });

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(process.env.JUDGE0_KEY ? { "X-RapidAPI-Key": process.env.JUDGE0_KEY } : {}),
    };
    const submitRes = await axios.post(
      `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`,
      { source_code: code, language_id: langId, stdin: "" },
      { headers, timeout: 10000 }
    );
    const { token } = submitRes.data;
    if (!token) return res.status(500).json({ error: "No submission token returned" });

    let result = null;
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await axios.get(
        `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false`,
        { headers: process.env.JUDGE0_KEY ? { "X-RapidAPI-Key": process.env.JUDGE0_KEY } : {}, timeout: 5000 }
      );
      result = pollRes.data;
      if (result.status?.id >= 3) break;
    }
    if (!result) return res.status(504).json({ error: "Execution timed out" });

    res.json({
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      status: result.status?.description || "Unknown",
      time: result.time,
      memory: result.memory,
    });
  } catch (err) {
    console.error("Judge0 error:", err.message);
    res.status(502).json({ error: "Code execution service unavailable. See README for Judge0 setup." });
  }
});

// ── SOCKET.IO ────────────────────────────────────────────────────────────────

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) socket.username = payload.username;
  }
  next();
});

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on("join-room", async ({ roomId, username }) => {
    const name = socket.username || username || `Guest${Math.floor(Math.random() * 9000 + 1000)}`;

    const exists = await store.roomExists(roomId);
    if (!exists) await store.createRoom(roomId, { code: DEFAULT_CODE, language: "javascript" });
    const room = await store.getRoom(roomId);

    socket.join(roomId);
    if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
    roomSockets.get(roomId).add(socket.id);
    socket.roomId = roomId;

    const idx = (roomSockets.get(roomId).size - 1) % USER_COLORS.length;
    const user = { id: socket.id, name, color: USER_COLORS[idx], cursor: null };
    activeUsers.set(socket.id, { ...user, roomId });

    const roomUserList = getRoomUsers(roomId);
    socket.emit("room-state", {
      code: room.code,
      language: room.language,
      users: roomUserList,
      yourId: socket.id,
      chatHistory: room.chatHistory || [],
    });
    socket.to(roomId).emit("user-joined", { user });
    io.to(roomId).emit("users-updated", { users: roomUserList });
    console.log(`[JOIN] ${name} → ${roomId}`);
  });

  socket.on("code-change", async ({ roomId, code }) => {
    await store.updateRoomCode(roomId, code);
    socket.to(roomId).emit("code-update", { code });
  });

  socket.on("language-change", async ({ roomId, language }) => {
    await store.updateRoomLanguage(roomId, language);
    socket.to(roomId).emit("language-update", { language });
  });

  socket.on("cursor-move", ({ roomId, position, selection }) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    user.cursor = { position, selection };
    socket.to(roomId).emit("cursor-update", {
      userId: socket.id, position, selection,
      color: user.color, name: user.name,
    });
  });

  socket.on("chat-message", async ({ roomId, text }) => {
    if (!text?.trim()) return;
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const message = {
      id: uuidv4(),
      userId: socket.id,
      username: user.name,
      color: user.color,
      text: text.trim().slice(0, 500),
      timestamp: Date.now(),
    };
    await store.appendChatMessage(roomId, message);
    io.to(roomId).emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const user = activeUsers.get(socket.id);
    activeUsers.delete(socket.id);
    if (!roomId) return;
    const sockets = roomSockets.get(roomId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) roomSockets.delete(roomId);
    }
    console.log(`[-] ${user?.name || socket.id} left ${roomId}`);
    io.to(roomId).emit("user-left", { userId: socket.id });
    io.to(roomId).emit("users-updated", { users: getRoomUsers(roomId) });
  });
});

function getRoomUsers(roomId) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return [];
  return Array.from(sockets).map((id) => activeUsers.get(id)).filter(Boolean)
    .map(({ id, name, color, cursor }) => ({ id, name, color, cursor }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 CollabCode server → http://localhost:${PORT}\n`);
});

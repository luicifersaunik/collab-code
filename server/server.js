require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");
const session = require("express-session");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const { v4: uuidv4 } = require("uuid");
const Y = require("yjs");

const store = require("./store");
const { signToken, verifyToken, hashPassword, checkPassword, authMiddleware } = require("./auth");

const app = express();

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://collab-code-production-a926.up.railway.app",
  "https://collab-code-s8vw.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || "collabcode-session-secret",
  resave: false, saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === "production", maxAge: 24 * 60 * 60 * 1000 },
}));
app.use(passport.initialize());
app.use(passport.session());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"], credentials: true },
});

const yjsDocs = {};
function getYDoc(roomId, fileId) {
  if (!yjsDocs[roomId]) yjsDocs[roomId] = {};
  if (!yjsDocs[roomId][fileId]) yjsDocs[roomId][fileId] = new Y.Doc();
  return yjsDocs[roomId][fileId];
}

const activeUsers = new Map();
const roomSockets = new Map();

const USER_COLORS = [
  "#00d4ff","#ff6b6b","#ffd93d","#6bcb77",
  "#c77dff","#ff9f43","#48cae4","#f72585",
  "#06ffa5","#ff6b35",
];

const JUDGE0_LANG_MAP = {
  javascript: 63, typescript: 74, python: 71, java: 62,
  cpp: 54, c: 50, csharp: 51, rust: 73, go: 60,
  shell: 46, ruby: 72, php: 68, swift: 83, kotlin: 78,
};

// ═══════════════════════════════════════════════════════════════════
//  GITHUB OAUTH
// ═══════════════════════════════════════════════════════════════════

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/auth/github/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const username = profile.username;
      const avatar = profile.photos?.[0]?.value || "";
      if (!(await store.userExists(username))) await store.createUser(username, "", avatar);
      done(null, { username, avatar });
    } catch (err) { done(err); }
  }));

  app.get("/api/auth/github", passport.authenticate("github", { scope: ["user:email"] }));
  app.get("/api/auth/github/callback",
    passport.authenticate("github", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth?error=github` }),
    (req, res) => {
      const token = signToken({ username: req.user.username, avatar: req.user.avatar });
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&username=${req.user.username}&avatar=${encodeURIComponent(req.user.avatar || "")}`);
    }
  );
}

// ═══════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: "Username must be 2–20 characters" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    if (await store.userExists(username)) return res.status(409).json({ error: "Username already taken" });
    const passwordHash = await hashPassword(password);
    await store.createUser(username, passwordHash);
    res.json({ token: signToken({ username }), username, avatar: "" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await store.getUser(username);
    if (!user) return res.status(401).json({ error: "Invalid username or password" });
    if (!user.passwordHash) return res.status(401).json({ error: "This account uses GitHub login" });
    const valid = await checkPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid username or password" });
    res.json({ token: signToken({ username, avatar: user.avatar || "" }), username, avatar: user.avatar || "" });
  } catch (err) { console.error(err); res.status(500).json({ error: "Internal server error" }); }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ username: req.user.username, avatar: req.user.avatar || "" });
});

// ═══════════════════════════════════════════════════════════════════
//  ROOM ROUTES
// ═══════════════════════════════════════════════════════════════════

app.get("/api/room/:roomId", async (req, res) => {
  res.json({ exists: await store.roomExists(req.params.roomId) });
});

app.post("/api/room/create", async (req, res) => {
  const { mode = "personal", timerDuration = 45 } = req.body;
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  await store.createRoom(roomId, mode, timerDuration);
  res.json({ roomId, mode });
});

// ═══════════════════════════════════════════════════════════════════
//  AI ASSIST — Personal mode only
// ═══════════════════════════════════════════════════════════════════

app.post("/api/ai-assist", async (req, res) => {
  const { roomId, prompt, code, language } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt required" });

  // Block AI in interview rooms
  const room = await store.getRoom(roomId);
  if (room?.mode === "interview") {
    return res.status(403).json({ error: "AI assistant is disabled in interview mode." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI service not configured. Add ANTHROPIC_API_KEY to environment variables." });

  try {
    // Use Anthropic Claude
    if (process.env.ANTHROPIC_API_KEY) {
      const response = await axios.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: `You are an expert coding assistant inside CollabCode, a real-time collaborative editor. 
Be concise and practical. Format code with proper markdown code blocks.
Current language: ${language || "javascript"}`,
          messages: [
            {
              role: "user",
              content: code
                ? `Here is the current code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n${prompt}`
                : prompt,
            },
          ],
        },
        {
          headers: {
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          timeout: 30000,
        }
      );
      return res.json({ reply: response.data.content[0].text });
    }

    // Fallback: OpenAI
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        max_tokens: 1024,
        messages: [
          { role: "system", content: `You are an expert coding assistant. Current language: ${language}. Be concise.` },
          { role: "user", content: code ? `Code:\n\`\`\`${language}\n${code}\n\`\`\`\n\n${prompt}` : prompt },
        ],
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 30000 }
    );
    return res.json({ reply: response.data.choices[0].message.content });

  } catch (err) {
    console.error("AI error:", err.message);
    res.status(502).json({ error: "AI service unavailable. Try again." });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  CODE EXECUTION
// ═══════════════════════════════════════════════════════════════════

const JUDGE0_BASE = process.env.JUDGE0_URL || "https://ce.judge0.com";

app.post("/api/execute", async (req, res) => {
  const { code, language, stdin = "" } = req.body;
  const langId = JUDGE0_LANG_MAP[language];
  if (!langId) return res.status(400).json({ error: `Language '${language}' not supported.` });

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(process.env.JUDGE0_KEY ? { "X-RapidAPI-Key": process.env.JUDGE0_KEY } : {}),
    };
    const submitRes = await axios.post(
      `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`,
      { source_code: code, language_id: langId, stdin },
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
      stdout: result.stdout || "", stderr: result.stderr || "",
      compile_output: result.compile_output || "",
      status: result.status?.description || "Unknown",
      time: result.time, memory: result.memory,
    });
  } catch (err) {
    console.error("Judge0 error:", err.message);
    res.status(502).json({ error: "Code execution service unavailable." });
  }
});

// ═══════════════════════════════════════════════════════════════════
//  INTERVIEW FEEDBACK SAVE
// ═══════════════════════════════════════════════════════════════════

app.post("/api/room/:roomId/feedback", async (req, res) => {
  const { roomId } = req.params;
  const { feedback } = req.body;
  await store.saveInterviewFeedback(roomId, feedback);
  res.json({ ok: true });
});

app.get("/api/room/:roomId/feedback", async (req, res) => {
  const room = await store.getRoom(req.params.roomId);
  res.json({ feedback: room?.interviewFeedback || null });
});

// ═══════════════════════════════════════════════════════════════════
//  SOCKET.IO
// ═══════════════════════════════════════════════════════════════════

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const payload = verifyToken(token);
    if (payload) { socket.username = payload.username; socket.avatar = payload.avatar || ""; }
  }
  next();
});

io.on("connection", (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on("join-room", async ({ roomId, username, role = "participant" }) => {
    const name = socket.username || username || `Guest${Math.floor(Math.random() * 9000 + 1000)}`;
    const avatar = socket.avatar || "";

    if (!(await store.roomExists(roomId))) await store.createRoom(roomId, "personal");
    const room = await store.getRoom(roomId);

    socket.join(roomId);
    if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
    roomSockets.get(roomId).add(socket.id);
    socket.roomId = roomId;
    socket.role = role; // "interviewer" | "participant"

    const idx = (roomSockets.get(roomId).size - 1) % USER_COLORS.length;
    const user = { id: socket.id, name, color: USER_COLORS[idx], avatar, cursor: null, activeFileId: room.activeFileId, role };
    activeUsers.set(socket.id, { ...user, roomId });

    const yjsStates = {};
    for (const file of room.files) {
      const doc = getYDoc(roomId, file.id);
      yjsStates[file.id] = Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64");
    }

    const roomUserList = getRoomUsers(roomId);
    socket.emit("room-state", {
      mode: room.mode,
      files: room.files,
      activeFileId: room.activeFileId,
      users: roomUserList,
      yourId: socket.id,
      yourRole: role,
      chatHistory: room.chatHistory || [],
      yjsStates,
      // Interview-only fields
      timerDuration: room.timerDuration,
      timerStartedAt: room.timerStartedAt,
      interviewNotes: role === "interviewer" ? room.interviewNotes : undefined,
    });
    socket.to(roomId).emit("user-joined", { user });
    io.to(roomId).emit("users-updated", { users: roomUserList });
    console.log(`[JOIN] ${name} (${role}) → ${roomId} [${room.mode}]`);
  });

  // Yjs sync
  socket.on("yjs-update", ({ roomId, fileId, update }) => {
    const doc = getYDoc(roomId, fileId);
    Y.applyUpdate(doc, Buffer.from(update, "base64"));
    store.updateFileContent(roomId, fileId, doc.getText("content").toString()).catch(() => {});
    socket.to(roomId).emit("yjs-update", { fileId, update });
  });

  // File operations
  socket.on("file-create", async ({ roomId, file }) => {
    await store.createFile(roomId, file);
    const doc = getYDoc(roomId, file.id);
    doc.getText("content").insert(0, file.content || "");
    io.to(roomId).emit("file-created", { file });
  });
  socket.on("file-rename", async ({ roomId, fileId, name }) => {
    await store.renameFile(roomId, fileId, name);
    io.to(roomId).emit("file-renamed", { fileId, name });
  });
  socket.on("file-delete", async ({ roomId, fileId }) => {
    await store.deleteFile(roomId, fileId);
    delete (yjsDocs[roomId] || {})[fileId];
    io.to(roomId).emit("file-deleted", { fileId });
  });
  socket.on("file-switch", ({ roomId, fileId }) => {
    const user = activeUsers.get(socket.id);
    if (user) user.activeFileId = fileId;
    socket.to(roomId).emit("user-switched-file", { userId: socket.id, fileId });
  });
  socket.on("language-change", async ({ roomId, fileId, language }) => {
    const room = await store.getRoom(roomId);
    if (room) { const f = room.files.find(f => f.id === fileId); if (f) f.language = language; }
    io.to(roomId).emit("language-update", { fileId, language });
  });

  // Cursor
  socket.on("cursor-move", ({ roomId, fileId, position, selection }) => {
    const user = activeUsers.get(socket.id);
    if (!user) return;
    socket.to(roomId).emit("cursor-update", {
      userId: socket.id, fileId, position, selection,
      color: user.color, name: user.name,
    });
  });

  // Chat
  socket.on("chat-message", async ({ roomId, text }) => {
    if (!text?.trim()) return;
    const user = activeUsers.get(socket.id);
    if (!user) return;
    const message = {
      id: uuidv4(), userId: socket.id, username: user.name,
      color: user.color, avatar: user.avatar || "",
      text: text.trim().slice(0, 500), timestamp: Date.now(),
    };
    await store.appendChatMessage(roomId, message);
    io.to(roomId).emit("chat-message", message);
  });

  // Interview: timer start
  socket.on("timer-start", async ({ roomId }) => {
    const user = activeUsers.get(socket.id);
    if (user?.role !== "interviewer") return;
    const startedAt = await store.startTimer(roomId);
    io.to(roomId).emit("timer-started", { startedAt });
  });

  // Interview: notes update (interviewer only, not broadcast to candidates)
  socket.on("notes-update", async ({ roomId, notes }) => {
    const user = activeUsers.get(socket.id);
    if (user?.role !== "interviewer") return;
    await store.updateInterviewNotes(roomId, notes);
    // Only echo back to interviewer sockets
    socket.emit("notes-saved");
  });

  // Disconnect
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    const user = activeUsers.get(socket.id);
    activeUsers.delete(socket.id);
    if (!roomId) return;
    const sockets = roomSockets.get(roomId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) { roomSockets.delete(roomId); delete yjsDocs[roomId]; }
    }
    console.log(`[-] ${user?.name || socket.id} left ${roomId}`);
    io.to(roomId).emit("user-left", { userId: socket.id });
    io.to(roomId).emit("users-updated", { users: getRoomUsers(roomId) });
  });
});

function getRoomUsers(roomId) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return [];
  return Array.from(sockets).map(id => activeUsers.get(id)).filter(Boolean)
    .map(({ id, name, color, avatar, cursor, activeFileId, role }) => ({ id, name, color, avatar, cursor, activeFileId, role }));
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`\n🚀 CollabCode v4 → http://localhost:${PORT}\n`));

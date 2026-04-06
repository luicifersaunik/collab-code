/**
 * store.js — Persistent store abstraction (Redis or in-memory)
 *
 * Room schema:
 *   mode: "personal" | "interview"
 *   files: JSON array of { id, name, language, content }
 *   activeFileId: string
 *   chatHistory: JSON array
 *   interviewNotes: string (interviewer-only, interview mode)
 *   interviewFeedback: JSON object
 *   timerDuration: number (minutes, interview mode)
 *   timerStartedAt: number (timestamp)
 */

const Redis = require("ioredis");

let redis = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
    redis.on("connect", () => console.log("✅ Redis connected"));
    redis.on("error", (err) => { console.warn("⚠️  Redis error:", err.message); redis = null; });
    redis.connect().catch(() => { redis = null; });
  } catch { redis = null; }
} else {
  console.log("ℹ️  No REDIS_URL set — using in-memory store");
}

const memRooms = new Map();
const memUsers = new Map();
const ROOM_TTL = 60 * 60 * 24 * 7;

const DEFAULT_FILE = (id) => ({
  id: id || "file-1",
  name: "main.js",
  language: "javascript",
  content: `// Welcome to CollabCode!\n// Start typing to collaborate in real-time.\n\nfunction greet(name) {\n  return \`Hello, \${name}! Let's build something great.\`;\n}\n\nconsole.log(greet("World"));\n`,
});

// ── Room operations ──────────────────────────────────────────────────────────

async function roomExists(roomId) {
  if (redis) return !!(await redis.exists(`room:${roomId}`));
  return memRooms.has(roomId);
}

async function createRoom(roomId, mode = "personal", timerDuration = 45) {
  const defaultFile = DEFAULT_FILE("file-1");
  const data = {
    mode,
    files: [defaultFile],
    activeFileId: defaultFile.id,
    chatHistory: [],
    interviewNotes: "",
    interviewFeedback: null,
    timerDuration,
    timerStartedAt: null,
  };
  if (redis) {
    await redis.hset(`room:${roomId}`,
      "mode", mode,
      "files", JSON.stringify(data.files),
      "activeFileId", data.activeFileId,
      "chatHistory", JSON.stringify([]),
      "interviewNotes", "",
      "interviewFeedback", "null",
      "timerDuration", timerDuration,
      "timerStartedAt", "null"
    );
    await redis.expire(`room:${roomId}`, ROOM_TTL);
  } else {
    memRooms.set(roomId, data);
  }
  return data;
}

async function getRoom(roomId) {
  if (redis) {
    const raw = await redis.hgetall(`room:${roomId}`);
    if (!raw || !raw.files) return null;
    return {
      mode: raw.mode || "personal",
      files: JSON.parse(raw.files),
      activeFileId: raw.activeFileId,
      chatHistory: JSON.parse(raw.chatHistory || "[]"),
      interviewNotes: raw.interviewNotes || "",
      interviewFeedback: JSON.parse(raw.interviewFeedback || "null"),
      timerDuration: Number(raw.timerDuration) || 45,
      timerStartedAt: raw.timerStartedAt === "null" ? null : Number(raw.timerStartedAt),
    };
  }
  return memRooms.get(roomId) || null;
}

async function updateFileContent(roomId, fileId, content) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "files");
    const files = JSON.parse(raw || "[]");
    const f = files.find(f => f.id === fileId);
    if (f) { f.content = content; await redis.hset(`room:${roomId}`, "files", JSON.stringify(files)); }
    await redis.expire(`room:${roomId}`, ROOM_TTL);
  } else {
    const room = memRooms.get(roomId);
    if (room) { const f = room.files.find(f => f.id === fileId); if (f) f.content = content; }
  }
}

async function createFile(roomId, file) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "files");
    const files = JSON.parse(raw || "[]");
    files.push(file);
    await redis.hset(`room:${roomId}`, "files", JSON.stringify(files));
  } else {
    const room = memRooms.get(roomId);
    if (room) room.files.push(file);
  }
}

async function renameFile(roomId, fileId, name) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "files");
    const files = JSON.parse(raw || "[]");
    const f = files.find(f => f.id === fileId);
    if (f) { f.name = name; await redis.hset(`room:${roomId}`, "files", JSON.stringify(files)); }
  } else {
    const room = memRooms.get(roomId);
    if (room) { const f = room.files.find(f => f.id === fileId); if (f) f.name = name; }
  }
}

async function deleteFile(roomId, fileId) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "files");
    const files = JSON.parse(raw || "[]").filter(f => f.id !== fileId);
    await redis.hset(`room:${roomId}`, "files", JSON.stringify(files));
  } else {
    const room = memRooms.get(roomId);
    if (room) room.files = room.files.filter(f => f.id !== fileId);
  }
}

async function setActiveFile(roomId, fileId) {
  if (redis) await redis.hset(`room:${roomId}`, "activeFileId", fileId);
  else { const room = memRooms.get(roomId); if (room) room.activeFileId = fileId; }
}

async function appendChatMessage(roomId, message) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "chatHistory");
    const history = JSON.parse(raw || "[]");
    history.push(message);
    const trimmed = history.slice(-200);
    await redis.hset(`room:${roomId}`, "chatHistory", JSON.stringify(trimmed));
    return trimmed;
  } else {
    const room = memRooms.get(roomId);
    if (!room) return [];
    room.chatHistory.push(message);
    room.chatHistory = room.chatHistory.slice(-200);
    return room.chatHistory;
  }
}

async function updateInterviewNotes(roomId, notes) {
  if (redis) await redis.hset(`room:${roomId}`, "interviewNotes", notes);
  else { const room = memRooms.get(roomId); if (room) room.interviewNotes = notes; }
}

async function saveInterviewFeedback(roomId, feedback) {
  if (redis) await redis.hset(`room:${roomId}`, "interviewFeedback", JSON.stringify(feedback));
  else { const room = memRooms.get(roomId); if (room) room.interviewFeedback = feedback; }
}

async function startTimer(roomId) {
  const now = Date.now();
  if (redis) await redis.hset(`room:${roomId}`, "timerStartedAt", now);
  else { const room = memRooms.get(roomId); if (room) room.timerStartedAt = now; }
  return now;
}

async function deleteRoom(roomId) {
  if (redis) await redis.del(`room:${roomId}`);
  else memRooms.delete(roomId);
}

// ── User operations ──────────────────────────────────────────────────────────

async function userExists(username) {
  if (redis) return !!(await redis.exists(`user:${username}`));
  return memUsers.has(username);
}

async function createUser(username, passwordHash, avatar = "") {
  const data = { username, passwordHash, avatar, createdAt: Date.now() };
  if (redis) {
    await redis.hset(`user:${username}`, "username", username, "passwordHash", passwordHash || "", "avatar", avatar, "createdAt", data.createdAt);
  } else {
    memUsers.set(username, data);
  }
  return data;
}

async function getUser(username) {
  if (redis) {
    const raw = await redis.hgetall(`user:${username}`);
    if (!raw || !raw.username) return null;
    return raw;
  }
  return memUsers.get(username) || null;
}

module.exports = {
  roomExists, createRoom, getRoom,
  updateFileContent, createFile, renameFile, deleteFile, setActiveFile,
  appendChatMessage, updateInterviewNotes, saveInterviewFeedback, startTimer,
  deleteRoom, userExists, createUser, getUser, DEFAULT_FILE,
};

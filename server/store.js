/**
 * store.js — Persistent store abstraction
 *
 * Uses Redis when REDIS_URL env var is set.
 * Falls back silently to in-memory Maps (default / dev).
 *
 * Room schema (Redis hash key: room:{roomId}):
 *   code, language, createdAt, chatHistory (JSON array)
 *
 * User schema (Redis hash key: user:{username}):
 *   username, passwordHash, createdAt
 */

const Redis = require("ioredis");

let redis = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, { lazyConnect: true });
    redis.on("connect", () => console.log("✅ Redis connected"));
    redis.on("error", (err) => {
      console.warn("⚠️  Redis error — falling back to memory:", err.message);
      redis = null;
    });
    redis.connect().catch(() => { redis = null; });
  } catch {
    redis = null;
  }
} else {
  console.log("ℹ️  No REDIS_URL set — using in-memory store (rooms won't persist across restarts)");
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
const memRooms = new Map();  // roomId → { code, language, createdAt, chatHistory }
const memUsers = new Map();  // username → { username, passwordHash, createdAt }

const ROOM_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// ─── Room operations ─────────────────────────────────────────────────────────

async function roomExists(roomId) {
  if (redis) return !!(await redis.exists(`room:${roomId}`));
  return memRooms.has(roomId);
}

async function createRoom(roomId, { code, language }) {
  const data = {
    code,
    language,
    createdAt: Date.now(),
    chatHistory: [],
  };
  if (redis) {
    await redis.hset(`room:${roomId}`,
      "code", data.code,
      "language", data.language,
      "createdAt", data.createdAt,
      "chatHistory", JSON.stringify(data.chatHistory)
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
    if (!raw || !raw.code) return null;
    return {
      code: raw.code,
      language: raw.language,
      createdAt: Number(raw.createdAt),
      chatHistory: JSON.parse(raw.chatHistory || "[]"),
    };
  }
  return memRooms.get(roomId) || null;
}

async function updateRoomCode(roomId, code) {
  if (redis) {
    await redis.hset(`room:${roomId}`, "code", code);
    await redis.expire(`room:${roomId}`, ROOM_TTL); // refresh TTL on activity
  } else {
    const room = memRooms.get(roomId);
    if (room) room.code = code;
  }
}

async function updateRoomLanguage(roomId, language) {
  if (redis) {
    await redis.hset(`room:${roomId}`, "language", language);
  } else {
    const room = memRooms.get(roomId);
    if (room) room.language = language;
  }
}

async function appendChatMessage(roomId, message) {
  if (redis) {
    const raw = await redis.hget(`room:${roomId}`, "chatHistory");
    const history = JSON.parse(raw || "[]");
    history.push(message);
    // Keep last 200 messages
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

async function deleteRoom(roomId) {
  if (redis) await redis.del(`room:${roomId}`);
  else memRooms.delete(roomId);
}

// ─── User operations ─────────────────────────────────────────────────────────

async function userExists(username) {
  if (redis) return !!(await redis.exists(`user:${username}`));
  return memUsers.has(username);
}

async function createUser(username, passwordHash) {
  const data = { username, passwordHash, createdAt: Date.now() };
  if (redis) {
    await redis.hset(`user:${username}`, "username", username, "passwordHash", passwordHash, "createdAt", data.createdAt);
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
  roomExists, createRoom, getRoom, updateRoomCode, updateRoomLanguage,
  appendChatMessage, deleteRoom,
  userExists, createUser, getUser,
};

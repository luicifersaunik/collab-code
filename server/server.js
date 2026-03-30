const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// In-memory room store
// rooms[roomId] = { code, language, users: Map<socketId, { id, name, color, cursor }> }
const rooms = new Map();

const USER_COLORS = [
  "#00d4ff", "#ff6b6b", "#ffd93d", "#6bcb77",
  "#c77dff", "#ff9f43", "#48cae4", "#f72585",
  "#06ffa5", "#ff6b35",
];

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      code: "// Welcome to CollabCode!\n// Start typing to collaborate in real-time.\n\n",
      language: "javascript",
      users: new Map(),
    });
  }
  return rooms.get(roomId);
}

// REST endpoint to check if room exists
app.get("/api/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  res.json({ exists: rooms.has(roomId) });
});

// Generate new room ID
app.post("/api/room/create", (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  getRoom(roomId); // Initialize room
  res.json({ roomId });
});

io.on("connection", (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // --- JOIN ROOM ---
  socket.on("join-room", ({ roomId, username }) => {
    const room = getRoom(roomId);
    socket.join(roomId);

    // Assign color based on number of users in room
    const colorIndex = room.users.size % USER_COLORS.length;
    const user = {
      id: socket.id,
      name: username || `User${Math.floor(Math.random() * 1000)}`,
      color: USER_COLORS[colorIndex],
      cursor: null,
    };

    room.users.set(socket.id, user);
    socket.roomId = roomId;

    console.log(`[JOIN] ${user.name} joined room ${roomId}`);

    // Send current state to the joining user
    socket.emit("room-state", {
      code: room.code,
      language: room.language,
      users: Array.from(room.users.values()),
      yourId: socket.id,
    });

    // Notify others in the room
    socket.to(roomId).emit("user-joined", { user });

    // Broadcast updated user list to all in room
    io.to(roomId).emit("users-updated", {
      users: Array.from(room.users.values()),
    });
  });

  // --- CODE CHANGE ---
  socket.on("code-change", ({ roomId, code }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.code = code;
    // Broadcast to everyone else in the room
    socket.to(roomId).emit("code-update", { code });
  });

  // --- LANGUAGE CHANGE ---
  socket.on("language-change", ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.language = language;
    socket.to(roomId).emit("language-update", { language });
  });

  // --- CURSOR POSITION ---
  socket.on("cursor-move", ({ roomId, position, selection }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const user = room.users.get(socket.id);
    if (user) {
      user.cursor = { position, selection };
      socket.to(roomId).emit("cursor-update", {
        userId: socket.id,
        position,
        selection,
        color: user.color,
        name: user.name,
      });
    }
  });

  // --- DISCONNECT ---
  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    const user = room.users.get(socket.id);
    room.users.delete(socket.id);

    console.log(`[-] ${user?.name || socket.id} left room ${roomId}`);

    io.to(roomId).emit("user-left", { userId: socket.id });
    io.to(roomId).emit("users-updated", {
      users: Array.from(room.users.values()),
    });

    // Clean up empty rooms
    if (room.users.size === 0) {
      rooms.delete(roomId);
      console.log(`[CLEAN] Room ${roomId} deleted (empty)`);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 CollabCode server running on port ${PORT}\n`);
});

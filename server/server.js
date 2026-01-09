// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const twilio = require("twilio");

const TWILIO_SID = "";
const TWILIO_AUTH = "";
const twilioClient = twilio(TWILIO_SID, TWILIO_AUTH);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const roomDataPath = path.join(__dirname, "data", "room.json");
const activeRooms = {};

app.get("/turn-token", async (req, res) => {
  try {
    const token = await twilioClient.tokens.create();
    res.json(token);
  } catch (err) {
    res.status(500).json({ error: "twilio_failed", message: err.message });
  }
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userName) => {
    try {
      const rooms = JSON.parse(fs.readFileSync(roomDataPath, "utf8"));
      const roomExists = rooms.find((r) => r.id === roomId);

      if (roomExists) {
        socket.join(roomId);
        if (!activeRooms[roomId]) activeRooms[roomId] = [];
        activeRooms[roomId].push({ id: socket.id, name: userName });

        socket.emit("join-success", {
          roomId: roomId,
          roomName: roomExists.name,
          userName: userName,
        });
        io.to(roomId).emit("update-user-list", activeRooms[roomId]);
      }
    } catch (e) {
      console.error(e);
    }
  });

  socket.on("sending-signal", (payload) => {
    io.to(payload.userToSignal).emit("user-joined", {
      signal: payload.signal,
      callerID: payload.callerID,
      userName: payload.userName,
    });
  });

  socket.on("returning-signal", (payload) => {
    io.to(payload.callerID).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("notify-camera-on", ({ roomId }) => {
    socket.to(roomId).emit("peer-camera-on", { callerID: socket.id });
  });

  socket.on("notify-camera-off", ({ roomId }) => {
    socket.to(roomId).emit("peer-camera-off", { callerID: socket.id });
  });

  socket.on("disconnect", () => {
    for (const roomId in activeRooms) {
      activeRooms[roomId] = activeRooms[roomId].filter(
        (user) => user.id !== socket.id
      );
      io.to(roomId).emit("update-user-list", activeRooms[roomId]);
    }
  });
});

server.listen(4000, () => {
  console.log("Server berjalan di port 4000");
});

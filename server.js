const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// GitHub repo ke root se website files serve karega
app.use(express.static(__dirname));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

io.on("connection", (socket) => {
  socket.on("join-room", ({ room }) => {
    if (!room) return;

    const roomName = room.trim().toUpperCase();

    const size = io.sockets.adapter.rooms.get(roomName)?.size || 0;

    if (size >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomName);
    socket.data.room = roomName;

    const count = io.sockets.adapter.rooms.get(roomName)?.size || 1;

    socket.emit("room-joined", {
      room: roomName,
      count
    });

    if (count === 2) {
      socket.to(roomName).emit("peer-joined");
    }
  });

  socket.on("signal", ({ room, data }) => {
    if (!room || !data) return;
    socket.to(room).emit("signal", data);
  });

  socket.on("leave-room", () => {
    const room = socket.data.room;

    if (room) {
      socket.leave(room);
      socket.to(room).emit("peer-left");
      socket.data.room = null;
    }
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;

    if (room) {
      socket.to(room).emit("peer-left");
    }
  });
});

const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

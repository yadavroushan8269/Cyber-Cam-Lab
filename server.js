"use strict";

const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");
const webpush = require("web-push");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 60 * 1024 * 1024, // 60 MB maximum Socket.IO packet
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

/* =========================================================
   CONFIG
========================================================= */

const PORT = process.env.PORT || 10000;

// Maximum users inside one room
const MAX_USERS_PER_ROOM = 6;

// Media sharing limit
const MAX_MEDIA_SIZE = 50 * 1024 * 1024; // 50 MB

// Chat message limit
const MAX_MESSAGE_LENGTH = 5000;

// Room cleanup delay
const ROOM_EMPTY_DELETE_DELAY = 30 * 1000;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(express.json({
  limit: "60mb"
}));


/* =========================================================
   WEB PUSH
========================================================= */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL =
  process.env.VAPID_EMAIL || "mailto:yadavroushan8269@gmail.com";

let pushEnabled = false;

// Room ID -> push subscriptions
const pushSubscriptions = new Map();

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      VAPID_EMAIL,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    pushEnabled = true;

    console.log("Web Push enabled.");
  } catch (error) {
    console.error("Web Push setup failed:", error.message);
  }
} else {
  console.warn(
    "Web Push disabled. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing."
  );
}


/* =========================================================
   API - VAPID PUBLIC KEY
========================================================= */

app.get("/api/vapid-public-key", (req, res) => {
  if (!pushEnabled) {
    return res.status(503).json({
      enabled: false,
      message: "Web Push is not configured."
    });
  }

  res.json({
    enabled: true,
    publicKey: VAPID_PUBLIC_KEY
  });
});


/* =========================================================
   API - SUBSCRIBE PUSH
========================================================= */

app.post("/api/subscribe", (req, res) => {
  try {
    if (!pushEnabled) {
      return res.status(503).json({
        success: false,
        message: "Push notification disabled."
      });
    }

    const {
      room,
      subscription
    } = req.body || {};

    if (!room || !subscription) {
      return res.status(400).json({
        success: false,
        message: "Room and subscription are required."
      });
    }

    if (
      !subscription.endpoint ||
      !subscription.keys ||
      !subscription.keys.p256dh ||
      !subscription.keys.auth
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription."
      });
    }

    pushSubscriptions.set(String(room), subscription);

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Subscribe error:", error);

    res.status(500).json({
      success: false,
      message: "Subscription failed."
    });
  }
});


/* =========================================================
   API - UNSUBSCRIBE PUSH
========================================================= */

app.post("/api/unsubscribe", (req, res) => {
  try {
    const { room } = req.body || {};

    if (room) {
      pushSubscriptions.delete(String(room));
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error("Unsubscribe error:", error);

    res.status(500).json({
      success: false
    });
  }
});


/* =========================================================
   PUSH NOTIFICATION HELPER
========================================================= */

async function sendPushNotification(room, payload) {
  if (!pushEnabled) return;

  const subscription = pushSubscriptions.get(String(room));

  if (!subscription) return;

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.error(
      "Push notification failed:",
      error.statusCode || "",
      error.message
    );

    // Subscription expired / invalid
    if (
      error.statusCode === 404 ||
      error.statusCode === 410
    ) {
      pushSubscriptions.delete(String(room));
    }
  }
}


/* =========================================================
   STATIC FILES
========================================================= */

app.use(express.static(__dirname));


/* =========================================================
   FALLBACK
========================================================= */

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "index.html")
  );
});


/* =========================================================
   ROOM DATA
========================================================= */

/*
  rooms:
  roomId -> Map(socketId, userInfo)
*/

const rooms = new Map();

// socketId -> current room
const socketRooms = new Map();

// socketId -> permanent room ID
const socketPermanentRooms = new Map();

// socketId -> user information
const socketUsers = new Map();

// delayed room cleanup timers
const roomCleanupTimers = new Map();


/* =========================================================
   ROOM HELPERS
========================================================= */

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }

  return rooms.get(roomId);
}


function cancelRoomCleanup(roomId) {
  const timer = roomCleanupTimers.get(roomId);

  if (timer) {
    clearTimeout(timer);
    roomCleanupTimers.delete(roomId);
  }
}


function scheduleRoomCleanup(roomId) {
  if (!roomId) return;

  cancelRoomCleanup(roomId);

  const timer = setTimeout(() => {
    const room = rooms.get(roomId);

    if (!room || room.size === 0) {
      rooms.delete(roomId);
    }

    roomCleanupTimers.delete(roomId);
  }, ROOM_EMPTY_DELETE_DELAY);

  roomCleanupTimers.set(roomId, timer);
}


function getRoomUsers(roomId, excludeSocketId = null) {
  const room = rooms.get(roomId);

  if (!room) return [];

  const users = [];

  for (const [socketId, info] of room.entries()) {
    if (socketId === excludeSocketId) continue;

    users.push({
      socketId,
      room: info.room,
      permanentRoom: info.permanentRoom || info.room,
      name: info.name || "User"
    });
  }

  return users;
}


function broadcastRoomUsers(roomId) {
  const room = rooms.get(roomId);

  if (!room) return;

  const users = getRoomUsers(roomId);

  for (const socketId of room.keys()) {
    io.to(socketId).emit("room-users", {
      room: roomId,
      users: users.filter(
        user => user.socketId !== socketId
      )
    });
  }
}


/* =========================================================
   REMOVE USER FROM ROOM
========================================================= */

function leaveCurrentRoom(socket, reason = "leave") {
  const oldRoomId = socketRooms.get(socket.id);

  if (!oldRoomId) {
    return;
  }

  const room = rooms.get(oldRoomId);

  if (room) {
    room.delete(socket.id);

    socket.to(oldRoomId).emit("peer-left", {
      peerId: socket.id,
      socketId: socket.id,
      reason
    });

    socket.to(oldRoomId).emit("user-left", {
      socketId: socket.id,
      peerId: socket.id,
      reason
    });

    if (room.size === 0) {
      scheduleRoomCleanup(oldRoomId);
    } else {
      broadcastRoomUsers(oldRoomId);
    }
  }

  socket.leave(oldRoomId);
  socketRooms.delete(socket.id);
}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on("connection", (socket) => {

  console.log(
    "Socket connected:",
    socket.id
  );


  /* =======================================================
     REGISTER USER
  ======================================================= */

  socket.on("register-user", (data = {}) => {

    const permanentRoom =
      typeof data.room === "string"
        ? data.room.trim().toUpperCase()
        : "";

    const name =
      typeof data.name === "string"
        ? data.name.trim().slice(0, 40)
        : "User";

    socketPermanentRooms.set(
      socket.id,
      permanentRoom
    );

    socketUsers.set(socket.id, {
      name,
      permanentRoom
    });

    socket.emit("user-registered", {
      socketId: socket.id,
      room: permanentRoom
    });
  });


  /* =======================================================
     JOIN ROOM
  ======================================================= */

  socket.on("join-room", (data = {}) => {

    const roomId =
      typeof data.room === "string"
        ? data.room.trim().toUpperCase()
        : "";

    if (!roomId) {
      socket.emit("room-error", {
        message: "Room ID is required."
      });

      return;
    }

    const existingRoom = rooms.get(roomId);

    /*
      If already inside same room, don't duplicate.
    */
    if (
      socketRooms.get(socket.id) === roomId &&
      existingRoom &&
      existingRoom.has(socket.id)
    ) {
      socket.emit("room-joined", {
        room: roomId,
        users: getRoomUsers(roomId, socket.id)
      });

      return;
    }


    /*
      Leave previous room before joining another.
    */
    if (socketRooms.has(socket.id)) {
      leaveCurrentRoom(
        socket,
        "switch-room"
      );
    }


    const room = getRoom(roomId);

    cancelRoomCleanup(roomId);


    /*
      Maximum 6 users
    */
    if (room.size >= MAX_USERS_PER_ROOM) {

      socket.emit("room-full", {
        room: roomId,
        maxUsers: MAX_USERS_PER_ROOM,
        message:
          `Room is full. Maximum ${MAX_USERS_PER_ROOM} users allowed.`
      });

      return;
    }


    const previousUsers =
      getRoomUsers(roomId);


    const userData =
      socketUsers.get(socket.id) || {};


    room.set(socket.id, {
      room: roomId,
      permanentRoom:
        userData.permanentRoom ||
        socketPermanentRooms.get(socket.id) ||
        roomId,
      name:
        userData.name ||
        "User",
      joinedAt: Date.now()
    });


    socket.join(roomId);

    socketRooms.set(
      socket.id,
      roomId
    );


    /*
      Send room information to joining user
    */
    socket.emit("room-joined", {
      room: roomId,
      users: previousUsers,
      maxUsers: MAX_USERS_PER_ROOM,
      count: room.size
    });


    /*
      Tell existing users
      that a new peer joined.
    */
    socket.to(roomId).emit(
      "peer-joined",
      {
        peerId: socket.id,
        socketId: socket.id,
        room: roomId,
        name:
          userData.name || "User"
      }
    );


    socket.to(roomId).emit(
      "user-joined",
      {
        socketId: socket.id,
        peerId: socket.id,
        room: roomId,
        name:
          userData.name || "User"
      }
    );


    broadcastRoomUsers(roomId);

    console.log(
      `Room ${roomId}: ${room.size}/${MAX_USERS_PER_ROOM}`
    );
  });


  /* =======================================================
     LEAVE ROOM
  ======================================================= */

  socket.on("leave-room", () => {
    leaveCurrentRoom(
      socket,
      "leave-room"
    );
  });


  /* =======================================================
     CALL USER
  ======================================================= */

  socket.on("call-user", async (data = {}) => {

    const targetRoom =
      typeof data.room === "string"
        ? data.room.trim().toUpperCase()
        : "";

    if (!targetRoom) {
      socket.emit("call-unavailable", {
        room: targetRoom,
        message: "Room ID is missing."
      });

      return;
    }


    const callerRoom =
      socketRooms.get(socket.id) ||
      socketPermanentRooms.get(socket.id) ||
      "";


    const callerInfo =
      socketUsers.get(socket.id) || {};


    const targetRoomData =
      rooms.get(targetRoom);


    /*
      Target room doesn't have an online user.
    */
    if (
      !targetRoomData ||
      targetRoomData.size === 0
    ) {

      socket.emit("call-unavailable", {
        room: targetRoom,
        message:
          "This room is currently unavailable."
      });


      await sendPushNotification(
        targetRoom,
        {
          type: "incoming-call",
          title: "Incoming Video Call",
          body:
            `${callerInfo.name || "Someone"} is calling you.`,
          room: callerRoom
        }
      );

      return;
    }


    let sent = false;


    for (const targetSocketId of targetRoomData.keys()) {

      if (targetSocketId === socket.id) {
        continue;
      }

      sent = true;

      io.to(targetSocketId).emit(
        "incoming-call",
        {
          callerId: socket.id,
          callerSocketId: socket.id,
          callerRoom,
          targetRoom,
          callerName:
            callerInfo.name || "User"
        }
      );
    }


    if (sent) {

      socket.emit("call-ringing", {
        room: targetRoom,
        callerId: socket.id
      });

    } else {

      socket.emit("call-unavailable", {
        room: targetRoom,
        message:
          "No other user is available in this room."
      });
    }
  });


  /* =======================================================
     ACCEPT CALL
  ======================================================= */

  socket.on("accept-call", (data = {}) => {

    const callerId =
      data.callerId ||
      data.callerSocketId;

    if (!callerId) return;

    const callerSocket =
      io.sockets.sockets.get(callerId);

    if (!callerSocket) {

      socket.emit("call-unavailable", {
        message:
          "Caller is no longer available."
      });

      return;
    }


    io.to(callerId).emit(
      "call-accepted",
      {
        target: socket.id,
        targetSocketId: socket.id,
        room:
          socketRooms.get(socket.id) || ""
      }
    );


    socket.emit(
      "call-accepted",
      {
        callerId,
        callerSocketId: callerId,
        room:
          socketRooms.get(socket.id) || ""
      }
    );
  });


  /* =======================================================
     REJECT CALL
  ======================================================= */

  socket.on("reject-call", (data = {}) => {

    const callerId =
      data.callerId ||
      data.callerSocketId;

    if (!callerId) return;

    io.to(callerId).emit(
      "call-rejected",
      {
        callerId: socket.id,
        targetSocketId: socket.id,
        room:
          socketRooms.get(socket.id) || "",
        message: "Call rejected."
      }
    );
  });


  /* =======================================================
     WEBRTC SIGNALING
  ======================================================= */

  socket.on("signal", (data = {}) => {

    const target =
      data.target ||
      data.targetSocketId;

    if (!target) return;

    const targetSocket =
      io.sockets.sockets.get(target);

    if (!targetSocket) {
      return;
    }

    targetSocket.emit(
      "signal",
      {
        sender: socket.id,
        senderSocketId: socket.id,
        data: data.data
      }
    );
  });


  /* =======================================================
     CHAT MESSAGE
  ======================================================= */

  socket.on("chat-message", (data = {}) => {

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) return;


    let message =
      typeof data.message === "string"
        ? data.message
        : "";


    message =
      message.trim()
        .slice(0, MAX_MESSAGE_LENGTH);


    if (!message) return;


    const userInfo =
      socketUsers.get(socket.id) || {};


    const chatMessage = {
      id: crypto.randomUUID(),
      type: "text",
      message,
      senderId: socket.id,
      senderName:
        userInfo.name || "User",
      room: roomId,
      timestamp: Date.now()
    };


    /*
      Send message to everyone
      in the same room.
    */
    io.to(roomId).emit(
      "chat-message",
      chatMessage
    );
  });


  /* =======================================================
     CHAT MESSAGE ALIAS
  ======================================================= */

  socket.on("send-message", (data = {}) => {

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) return;


    let message =
      typeof data.message === "string"
        ? data.message.trim()
        : "";


    if (!message) return;


    message =
      message.slice(
        0,
        MAX_MESSAGE_LENGTH
      );


    const userInfo =
      socketUsers.get(socket.id) || {};


    const chatMessage = {
      id: crypto.randomUUID(),
      type: "text",
      message,
      senderId: socket.id,
      senderName:
        userInfo.name || "User",
      room: roomId,
      timestamp: Date.now()
    };


    io.to(roomId).emit(
      "chat-message",
      chatMessage
    );
  });


  /* =======================================================
     MEDIA MESSAGE
     
     Supports:
       - photo
       - video
     
     Expected data:
       {
         name,
         type,
         size,
         data
       }
     
     data can be:
       ArrayBuffer
       Uint8Array
       Buffer
       base64 string
  ======================================================= */

  socket.on("media-message", async (data = {}) => {

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) {

      socket.emit("media-error", {
        message:
          "You are not inside a room."
      });

      return;
    }


    const mediaType =
      typeof data.type === "string"
        ? data.type
        : "";


    /*
      Only photos and videos.
    */
    const allowed =
      mediaType.startsWith("image/") ||
      mediaType.startsWith("video/");


    if (!allowed) {

      socket.emit("media-error", {
        message:
          "Only photo and video files are allowed."
      });

      return;
    }


    let fileSize =
      Number(data.size || 0);


    /*
      If size isn't supplied,
      calculate from incoming data.
    */
    if (!fileSize && data.data) {

      if (Buffer.isBuffer(data.data)) {
        fileSize = data.data.length;
      }

      else if (
        data.data instanceof ArrayBuffer
      ) {
        fileSize =
          data.data.byteLength;
      }

      else if (
        typeof data.data === "string"
      ) {
        /*
          Approximate decoded base64 size.
        */
        const base64 =
          data.data.includes(",")
            ? data.data.split(",")[1]
            : data.data;

        fileSize =
          Math.floor(
            base64.length * 3 / 4
          );
      }
    }


    /*
      50 MB limit
    */
    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_MEDIA_SIZE
    ) {

      socket.emit("media-error", {
        message:
          `Maximum media size is ${formatBytes(MAX_MEDIA_SIZE)}.`
      });

      return;
    }


    const userInfo =
      socketUsers.get(socket.id) || {};


    /*
      We don't permanently save the file.
      It is only relayed to room members.
    */
    const mediaMessage = {
      id: crypto.randomUUID(),
      type: "media",

      mediaType,

      name:
        typeof data.name === "string"
          ? data.name.slice(0, 200)
          : "media",

      size: fileSize,

      /*
        Client receives the original data.
      */
      data: data.data,

      senderId: socket.id,

      senderName:
        userInfo.name || "User",

      room: roomId,

      timestamp: Date.now()
    };


    io.to(roomId).emit(
      "media-message",
      mediaMessage
    );
  });


  /* =======================================================
     MEDIA MESSAGE ALIAS
  ======================================================= */

  socket.on("send-media", (data = {}) => {

    /*
      Reuse same media event logic.
      Triggering the event internally isn't
      necessary; process it directly.
    */

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) return;


    const mediaType =
      typeof data.type === "string"
        ? data.type
        : "";


    const allowed =
      mediaType.startsWith("image/") ||
      mediaType.startsWith("video/");


    if (!allowed) {
      socket.emit("media-error", {
        message:
          "Only photo and video files are allowed."
      });

      return;
    }


    let fileSize =
      Number(data.size || 0);


    if (!fileSize && data.data) {

      if (Buffer.isBuffer(data.data)) {
        fileSize = data.data.length;
      }

      else if (
        data.data instanceof ArrayBuffer
      ) {
        fileSize =
          data.data.byteLength;
      }

      else if (
        typeof data.data === "string"
      ) {

        const base64 =
          data.data.includes(",")
            ? data.data.split(",")[1]
            : data.data;

        fileSize =
          Math.floor(
            base64.length * 3 / 4
          );
      }
    }


    if (
      !Number.isFinite(fileSize) ||
      fileSize <= 0 ||
      fileSize > MAX_MEDIA_SIZE
    ) {

      socket.emit("media-error", {
        message:
          `Maximum media size is ${formatBytes(MAX_MEDIA_SIZE)}.`
      });

      return;
    }


    const userInfo =
      socketUsers.get(socket.id) || {};


    io.to(roomId).emit(
      "media-message",
      {
        id: crypto.randomUUID(),
        type: "media",
        mediaType,

        name:
          typeof data.name === "string"
            ? data.name.slice(0, 200)
            : "media",

        size: fileSize,
        data: data.data,

        senderId: socket.id,

        senderName:
          userInfo.name || "User",

        room: roomId,

        timestamp: Date.now()
      }
    );
  });


  /* =======================================================
     TYPING INDICATOR
  ======================================================= */

  socket.on("typing", (data = {}) => {

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) return;


    const userInfo =
      socketUsers.get(socket.id) || {};


    socket.to(roomId).emit(
      "typing",
      {
        senderId: socket.id,
        senderName:
          userInfo.name || "User",
        typing:
          Boolean(data.typing)
      }
    );
  });


  /* =======================================================
     FRIEND / USER ONLINE CHECK
  ======================================================= */

  socket.on("check-room", (data = {}) => {

    const roomId =
      typeof data.room === "string"
        ? data.room.trim().toUpperCase()
        : "";


    if (!roomId) {
      socket.emit("room-status", {
        room: roomId,
        online: false,
        count: 0
      });

      return;
    }


    const room =
      rooms.get(roomId);


    const count =
      room ? room.size : 0;


    socket.emit("room-status", {
      room: roomId,
      online: count > 0,
      count,
      maxUsers: MAX_USERS_PER_ROOM
    });
  });


  /* =======================================================
     GET CURRENT ROOM USERS
  ======================================================= */

  socket.on("get-room-users", () => {

    const roomId =
      socketRooms.get(socket.id);

    if (!roomId) return;


    socket.emit("room-users", {
      room: roomId,
      users:
        getRoomUsers(
          roomId,
          socket.id
        ),
      count:
        rooms.get(roomId)?.size || 0,
      maxUsers:
        MAX_USERS_PER_ROOM
    });
  });


  /* =======================================================
     DISCONNECT
  ======================================================= */

  socket.on("disconnect", (reason) => {

    console.log(
      "Socket disconnected:",
      socket.id,
      reason
    );


    const roomId =
      socketRooms.get(socket.id);


    leaveCurrentRoom(
      socket,
      "disconnect"
    );


    socketPermanentRooms.delete(
      socket.id
    );

    socketUsers.delete(
      socket.id
    );


    /*
      Don't immediately delete push subscription.
      The user may reconnect.
    */


    if (roomId) {
      console.log(
        `User left room ${roomId}`
      );
    }
  });
});


/* =========================================================
   FORMAT BYTES
========================================================= */

function formatBytes(bytes) {

  if (!Number.isFinite(bytes)) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}


/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {

  res.json({
    ok: true,
    service: "JH Video Call",
    maxUsersPerRoom: MAX_USERS_PER_ROOM,
    maxMediaSize:
      formatBytes(MAX_MEDIA_SIZE),
    pushEnabled,
    uptime:
      Math.floor(process.uptime())
  });
});


/* =========================================================
   START SERVER
========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Maximum users per room: ${MAX_USERS_PER_ROOM}`
    );

    console.log(
      `Maximum media size: ${formatBytes(MAX_MEDIA_SIZE)}`
    );
  }
);


/* =========================================================
   PROCESS ERROR HANDLING
========================================================= */

process.on("uncaughtException", (error) => {
  console.error(
    "Uncaught Exception:",
    error
  );
});


process.on("unhandledRejection", (error) => {
  console.error(
    "Unhandled Rejection:",
    error
  );
});

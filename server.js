const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_USERS_PER_ROOM = 10;

// Serve website files from repository root
app.use(express.static(__dirname));

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


// ===============================
// SOCKET CONNECTION
// ===============================

io.on("connection", (socket) => {

    console.log(
        "User connected:",
        socket.id
    );


    // ===============================
    // JOIN ROOM
    // ===============================

    socket.on("join-room", ({ room }) => {

        if (!room) {
            return;
        }

        const roomName =
            room
                .trim()
                .toUpperCase();

        const roomSet =
            io.sockets.adapter.rooms.get(
                roomName
            );

        const currentUsers =
            roomSet
                ? roomSet.size
                : 0;


        // Maximum 10 users
        if (
            currentUsers >=
            MAX_USERS_PER_ROOM
        ) {

            socket.emit(
                "room-full"
            );

            return;
        }


        // Get users already inside
        const existingUsers =
            roomSet
                ? Array.from(roomSet)
                : [];


        socket.join(roomName);

        socket.data.room =
            roomName;


        const newCount =
            existingUsers.length + 1;


        // Tell new user about existing users
        socket.emit(
            "room-joined",
            {
                room: roomName,
                count: newCount,
                users: existingUsers
            }
        );


        // Tell existing users that
        // a new user has joined
        socket.to(roomName).emit(
            "peer-joined",
            {
                peerId: socket.id
            }
        );


        console.log(
            `${socket.id} joined ${roomName} (${newCount}/10)`
        );
    });


    // ===============================
    // WEBRTC SIGNAL
    // ===============================

    socket.on(
        "signal",
        ({ target, data }) => {

            if (!target || !data) {
                return;
            }

            io.to(target).emit(
                "signal",
                {
                    sender: socket.id,
                    data: data
                }
            );
        }
    );


    // ===============================
    // LEAVE ROOM
    // ===============================

    socket.on(
        "leave-room",
        () => {

            leaveRoom(socket);
        }
    );


    // ===============================
    // DISCONNECT
    // ===============================

    socket.on(
        "disconnect",
        () => {

            leaveRoom(socket);

            console.log(
                "User disconnected:",
                socket.id
            );
        }
    );
});


// ===============================
// LEAVE ROOM FUNCTION
// ===============================

function leaveRoom(socket) {

    const room =
        socket.data.room;

    if (!room) {
        return;
    }

    socket.to(room).emit(
        "peer-left",
        {
            peerId: socket.id
        }
    );

    socket.leave(room);

    socket.data.room = null;
}


// ===============================
// SERVER
// ===============================

const PORT =
    process.env.PORT || 10000;

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Server running on port ${PORT}`
        );
    }
);

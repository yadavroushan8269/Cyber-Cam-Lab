const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_USERS_PER_ROOM = 2;

// ===============================
// WEBSITE
// ===============================

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
    // JOIN OWN ROOM
    // ===============================

    socket.on("join-room", ({ room }) => {

        if (!room) {
            return;
        }

        const roomName =
            room
                .trim()
                .toUpperCase();


        // If already inside another room
        if (socket.data.room) {
            socket.leave(
                socket.data.room
            );
        }


        const roomSet =
            io.sockets.adapter.rooms.get(
                roomName
            );

        const currentUsers =
            roomSet
                ? roomSet.size
                : 0;


        // Maximum 2 people
        if (
            currentUsers >=
            MAX_USERS_PER_ROOM
        ) {

            socket.emit(
                "room-full"
            );

            return;
        }


        socket.join(roomName);

        socket.data.room =
            roomName;


        const newCount =
            currentUsers + 1;


        socket.emit(
            "room-joined",
            {
                room: roomName,
                count: newCount
            }
        );


        console.log(
            `${socket.id} joined ${roomName} (${newCount}/2)`
        );
    });


    // ===============================
    // CALL USER BY ROOM ID
    // ===============================

    socket.on(
        "call-user",
        ({ room }) => {

            if (!room) {
                return;
            }

            const targetRoom =
                room
                    .trim()
                    .toUpperCase();


            const roomSet =
                io.sockets.adapter.rooms.get(
                    targetRoom
                );


            if (
                !roomSet ||
                roomSet.size === 0
            ) {

                socket.emit(
                    "call-unavailable",
                    {
                        room:
                            targetRoom
                    }
                );

                return;
            }


            // Find another socket in target room
            const targetSocketId =
                Array.from(
                    roomSet
                ).find(
                    id =>
                        id !==
                        socket.id
                );


            // If caller accidentally
            // calls himself
            if (!targetSocketId) {

                socket.emit(
                    "call-unavailable",
                    {
                        room:
                            targetRoom
                    }
                );

                return;
            }


            // Send incoming call
            io.to(
                targetSocketId
            ).emit(
                "incoming-call",
                {
                    callerId:
                        socket.id,

                    callerRoom:
                        socket.data.room || "",

                    targetRoom:
                        targetRoom
                }
            );


            // Tell caller ringing
            socket.emit(
                "call-ringing",
                {
                    target:
                        targetSocketId,

                    room:
                        targetRoom
                }
            );


            console.log(
                `${socket.id} is calling ${targetSocketId}`
            );
        }
    );


    // ===============================
    // ACCEPT CALL
    // ===============================

    socket.on(
        "accept-call",
        ({ callerId }) => {

            if (!callerId) {
                return;
            }


            io.to(
                callerId
            ).emit(
                "call-accepted",
                {
                    target:
                        socket.id
                }
            );


            console.log(
                `${socket.id} accepted call from ${callerId}`
            );
        }
    );


    // ===============================
    // REJECT CALL
    // ===============================

    socket.on(
        "reject-call",
        ({ callerId }) => {

            if (!callerId) {
                return;
            }


            io.to(
                callerId
            ).emit(
                "call-rejected"
            );


            console.log(
                `${socket.id} rejected call from ${callerId}`
            );
        }
    );


    // ===============================
    // WEBRTC SIGNAL
    // ===============================

    socket.on(
        "signal",
        ({ target, data }) => {

            if (
                !target ||
                !data
            ) {
                return;
            }


            io.to(
                target
            ).emit(
                "signal",
                {
                    sender:
                        socket.id,

                    data:
                        data
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
// LEAVE ROOM
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
            peerId:
                socket.id
        }
    );


    socket.leave(room);

    socket.data.room =
        null;
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

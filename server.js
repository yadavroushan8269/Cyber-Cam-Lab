const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


// ============================================================
// CONFIG
// ============================================================

const PORT = process.env.PORT || 10000;

// Maximum 6 people in one room
const MAX_USERS_PER_ROOM = 6;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());


// ============================================================
// WEB PUSH CONFIG
// ============================================================

let webPush = null;

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY || "";

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY || "";

const VAPID_EMAIL =
    process.env.VAPID_EMAIL ||
    "mailto:yadavroushan8269@gmail.com";


if (
    VAPID_PUBLIC_KEY &&
    VAPID_PRIVATE_KEY
) {

    try {

        webPush = require("web-push");

        webPush.setVapidDetails(
            VAPID_EMAIL,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        console.log(
            "Web Push enabled."
        );

    } catch (error) {

        console.error(
            "Web Push setup failed:",
            error.message
        );

    }

} else {

    console.warn(
        "Web Push disabled: VAPID keys missing."
    );

}


// ============================================================
// PUSH SUBSCRIPTIONS
// ============================================================

// Room ID -> push subscription
const pushSubscriptions = new Map();


// ============================================================
// VAPID PUBLIC KEY
// ============================================================

app.get(
    "/api/vapid-public-key",
    (req, res) => {

        if (!VAPID_PUBLIC_KEY) {

            return res.status(503).json({
                enabled: false
            });

        }

        res.json({
            enabled: true,
            publicKey: VAPID_PUBLIC_KEY
        });

    }
);


// ============================================================
// SUBSCRIBE FOR NOTIFICATIONS
// ============================================================

app.post(
    "/api/subscribe",
    (req, res) => {

        try {

            const {
                room,
                subscription
            } = req.body || {};


            if (
                !room ||
                !subscription
            ) {

                return res.status(400).json({
                    ok: false,
                    error: "Room and subscription are required."
                });

            }


            const roomName =
                String(room)
                    .trim()
                    .toUpperCase();


            pushSubscriptions.set(
                roomName,
                subscription
            );


            console.log(
                `Push subscription saved for room ${roomName}`
            );


            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "Subscribe error:",
                error
            );

            res.status(500).json({
                ok: false
            });

        }

    }
);


// ============================================================
// UNSUBSCRIBE
// ============================================================

app.post(
    "/api/unsubscribe",
    (req, res) => {

        try {

            const {
                room
            } = req.body || {};


            if (!room) {

                return res.status(400).json({
                    ok: false
                });

            }


            const roomName =
                String(room)
                    .trim()
                    .toUpperCase();


            pushSubscriptions.delete(
                roomName
            );


            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "Unsubscribe error:",
                error
            );

            res.status(500).json({
                ok: false
            });

        }

    }
);


// ============================================================
// STATIC WEBSITE
// ============================================================

app.use(
    express.static(__dirname)
);


// ============================================================
// SPA FALLBACK
// ============================================================

app.get(
    "*",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


// ============================================================
// HELPER: NORMALIZE ROOM
// ============================================================

function normalizeRoom(room) {

    if (!room) {
        return "";
    }

    return String(room)
        .trim()
        .toUpperCase();

}


// ============================================================
// HELPER: GET ROOM USERS
// ============================================================

function getRoomUsers(room) {

    const roomSet =
        io.sockets.adapter.rooms.get(
            room
        );

    if (!roomSet) {
        return [];
    }

    return Array.from(roomSet);

}


// ============================================================
// HELPER: SEND PUSH NOTIFICATION
// ============================================================

async function sendPushToRoom(
    room,
    payload
) {

    if (!webPush) {
        return;
    }


    const subscription =
        pushSubscriptions.get(
            room
        );


    if (!subscription) {
        return;
    }


    try {

        await webPush.sendNotification(
            subscription,
            JSON.stringify(payload)
        );

    } catch (error) {

        console.error(
            `Push notification failed for ${room}:`,
            error.message
        );


        // Subscription expired/invalid
        if (
            error.statusCode === 404 ||
            error.statusCode === 410
        ) {

            pushSubscriptions.delete(
                room
            );

        }

    }

}


// ============================================================
// SOCKET.IO CONNECTION
// ============================================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User connected:",
            socket.id
        );


        // ====================================================
        // JOIN ROOM
        // ====================================================

        socket.on(
            "join-room",
            ({ room } = {}) => {

                const roomName =
                    normalizeRoom(room);


                if (!roomName) {

                    socket.emit(
                        "join-error",
                        {
                            message:
                                "Room ID is required."
                        }
                    );

                    return;
                }


                // If already inside another room,
                // remove from that room first.
                if (
                    socket.data.room &&
                    socket.data.room !== roomName
                ) {

                    leaveRoom(
                        socket
                    );

                }


                const existingUsers =
                    getRoomUsers(
                        roomName
                    );


                // Already in this room
                if (
                    existingUsers.includes(
                        socket.id
                    )
                ) {

                    socket.emit(
                        "room-joined",
                        {
                            room: roomName,
                            count:
                                existingUsers.length,
                            users:
                                existingUsers.filter(
                                    id =>
                                        id !==
                                        socket.id
                                )
                        }
                    );

                    return;
                }


                // Room full
                if (
                    existingUsers.length >=
                    MAX_USERS_PER_ROOM
                ) {

                    socket.emit(
                        "room-full",
                        {
                            max:
                                MAX_USERS_PER_ROOM
                        }
                    );

                    return;
                }


                // Users already in room
                const usersBeforeJoin =
                    [...existingUsers];


                socket.join(
                    roomName
                );


                socket.data.room =
                    roomName;


                const usersAfterJoin =
                    getRoomUsers(
                        roomName
                    );


                // Tell new user about room
                socket.emit(
                    "room-joined",
                    {
                        room: roomName,
                        count:
                            usersAfterJoin.length,
                        users:
                            usersBeforeJoin
                    }
                );


                // Tell existing users
                // that a new person joined
                socket.to(
                    roomName
                ).emit(
                    "peer-joined",
                    {
                        peerId:
                            socket.id
                    }
                );


                console.log(
                    `${socket.id} joined ${roomName} ` +
                    `(${usersAfterJoin.length}/${MAX_USERS_PER_ROOM})`
                );

            }
        );


        // ====================================================
        // DIRECT CALL BY ROOM ID
        // ====================================================

        socket.on(
            "call-user",
            async ({
                room,
                callerRoom
            } = {}) => {

                const targetRoom =
                    normalizeRoom(
                        room
                    );


                const caller =
                    normalizeRoom(
                        callerRoom ||
                        socket.data.room
                    );


                if (!targetRoom) {

                    socket.emit(
                        "call-error",
                        {
                            message:
                                "Target Room ID missing."
                        }
                    );

                    return;
                }


                if (
                    targetRoom ===
                    caller
                ) {

                    socket.emit(
                        "call-error",
                        {
                            message:
                                "You cannot call your own room."
                        }
                    );

                    return;
                }


                const targetUsers =
                    getRoomUsers(
                        targetRoom
                    );


                // Target room is not online
                if (
                    targetUsers.length === 0
                ) {

                    socket.emit(
                        "call-unavailable",
                        {
                            room:
                                targetRoom,
                            reason:
                                "Room is offline."
                        }
                    );


                    // Try push notification
                    await sendPushToRoom(
                        targetRoom,
                        {
                            type:
                                "incoming-call",
                            room:
                                caller,
                            targetRoom:
                                targetRoom,
                            message:
                                `Incoming call from ${caller}`
                        }
                    );

                    return;
                }


                // Target room has users
                // Send incoming call to every
                // socket inside that room
                for (
                    const targetSocketId
                    of targetUsers
                ) {

                    io.to(
                        targetSocketId
                    ).emit(
                        "incoming-call",
                        {
                            callerId:
                                socket.id,
                            callerRoom:
                                caller,
                            targetRoom:
                                targetRoom
                        }
                    );

                }


                socket.emit(
                    "call-ringing",
                    {
                        room:
                            targetRoom
                    }
                );


                console.log(
                    `Call: ${caller} -> ${targetRoom}`
                );

            }
        );


        // ====================================================
        // ACCEPT CALL
        // ====================================================

        socket.on(
            "accept-call",
            ({
                callerId,
                callerRoom,
                targetRoom
            } = {}) => {

                if (!callerId) {
                    return;
                }


                const acceptedRoom =
                    normalizeRoom(
                        targetRoom ||
                        socket.data.room
                    );


                // Notify caller
                io.to(
                    callerId
                ).emit(
                    "call-accepted",
                    {
                        accepterId:
                            socket.id,
                        accepterRoom:
                            acceptedRoom
                    }
                );


                // Notify receiver
                socket.emit(
                    "call-accepted-local",
                    {
                        callerId:
                            callerId,
                        callerRoom:
                            normalizeRoom(
                                callerRoom
                            )
                    }
                );


                console.log(
                    `Call accepted: ${callerRoom} -> ${acceptedRoom}`
                );

            }
        );


        // ====================================================
        // REJECT CALL
        // ====================================================

        socket.on(
            "reject-call",
            ({
                callerId,
                callerRoom,
                targetRoom
            } = {}) => {

                if (!callerId) {
                    return;
                }


                io.to(
                    callerId
                ).emit(
                    "call-rejected",
                    {
                        room:
                            normalizeRoom(
                                targetRoom
                            )
                    }
                );


                console.log(
                    `Call rejected by ${targetRoom}`
                );

            }
        );


        // ====================================================
        // WEBRTC SIGNALING
        // ====================================================

        socket.on(
            "signal",
            ({
                target,
                data
            } = {}) => {

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


        // ====================================================
        // CALL CANCEL
        // ====================================================

        socket.on(
            "cancel-call",
            ({
                targetRoom
            } = {}) => {

                const room =
                    normalizeRoom(
                        targetRoom
                    );


                if (!room) {
                    return;
                }


                const users =
                    getRoomUsers(
                        room
                    );


                users.forEach(
                    userId => {

                        io.to(
                            userId
                        ).emit(
                            "call-cancelled",
                            {
                                room:
                                    socket.data.room
                            }
                        );

                    }
                );

            }
        );


        // ====================================================
        // LEAVE ROOM
        // ====================================================

        socket.on(
            "leave-room",
            () => {

                leaveRoom(
                    socket
                );

            }
        );


        // ====================================================
        // DISCONNECT
        // ====================================================

        socket.on(
            "disconnect",
            () => {

                leaveRoom(
                    socket
                );


                console.log(
                    "User disconnected:",
                    socket.id
                );

            }
        );

    }
);


// ============================================================
// LEAVE ROOM FUNCTION
// ============================================================

function leaveRoom(socket) {

    const room =
        socket.data.room;


    if (!room) {
        return;
    }


    socket.to(
        room
    ).emit(
        "peer-left",
        {
            peerId:
                socket.id
        }
    );


    socket.leave(
        room
    );


    socket.data.room =
        null;


    console.log(
        `${socket.id} left ${room}`
    );

}


// ============================================================
// SERVER START
// ============================================================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            "ROUSHAN // CALL SERVER"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Maximum users per room: ${MAX_USERS_PER_ROOM}`
        );

        console.log(
            "========================================"
        );

    }
);

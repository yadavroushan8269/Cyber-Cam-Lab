const express = require("express");
const http = require("http");
const path = require("path");
const webpush = require("web-push");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_USERS_PER_ROOM = 2;

// =====================================
// WEB PUSH CONFIG
// =====================================

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY;

const VAPID_EMAIL =
    process.env.VAPID_EMAIL ||
    "mailto:admin@example.com";

if (
    VAPID_PUBLIC_KEY &&
    VAPID_PRIVATE_KEY
) {
    webpush.setVapidDetails(
        VAPID_EMAIL,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
    );

    console.log("Web Push enabled.");
} else {
    console.log(
        "WARNING: VAPID keys are missing. Push notifications disabled."
    );
}


// =====================================
// PUSH SUBSCRIPTIONS
// =====================================

// Room ID -> push subscription
const pushSubscriptions = new Map();


// =====================================
// WEBSITE
// =====================================

app.use(express.json());

app.use(express.static(__dirname));

app.get("*", (req, res) => {
    res.sendFile(
        path.join(__dirname, "index.html")
    );
});


// =====================================
// PUBLIC VAPID KEY
// =====================================

app.get(
    "/api/vapid-public-key",
    (req, res) => {

        res.json({
            publicKey:
                VAPID_PUBLIC_KEY || null
        });
    }
);


// =====================================
// SAVE PUSH SUBSCRIPTION
// =====================================

app.post(
    "/api/subscribe",
    (req, res) => {

        try {

            const {
                room,
                subscription
            } = req.body;

            if (
                !room ||
                !subscription
            ) {

                return res
                    .status(400)
                    .json({
                        ok: false,
                        error:
                            "Room and subscription required"
                    });
            }


            const roomName =
                room
                    .trim()
                    .toUpperCase();


            pushSubscriptions.set(
                roomName,
                subscription
            );


            console.log(
                "Push subscription saved:",
                roomName
            );


            res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                "Subscription error:",
                error
            );

            res.status(500).json({
                ok: false
            });
        }
    }
);


// =====================================
// REMOVE PUSH SUBSCRIPTION
// =====================================

app.post(
    "/api/unsubscribe",
    (req, res) => {

        const {
            room
        } = req.body;

        if (room) {

            pushSubscriptions.delete(
                room
                    .trim()
                    .toUpperCase()
            );
        }

        res.json({
            ok: true
        });
    }
);


// =====================================
// SEND PUSH NOTIFICATION
// =====================================

async function sendPushNotification(
    room,
    payload
) {

    if (
        !VAPID_PUBLIC_KEY ||
        !VAPID_PRIVATE_KEY
    ) {
        return;
    }


    const subscription =
        pushSubscriptions.get(
            room
        );


    if (!subscription) {

        console.log(
            "No push subscription:",
            room
        );

        return;
    }


    try {

        await webpush.sendNotification(
            subscription,
            JSON.stringify(
                payload
            )
        );


        console.log(
            "Push notification sent:",
            room
        );

    } catch (error) {

        console.error(
            "Push error:",
            error.statusCode,
            error.message
        );


        // Subscription expired/invalid
        if (
            error.statusCode ===
                404 ||
            error.statusCode ===
                410
        ) {

            pushSubscriptions.delete(
                room
            );
        }
    }
}


// =====================================
// SOCKET CONNECTION
// =====================================

io.on(
    "connection",
    (socket) => {

        console.log(
            "User connected:",
            socket.id
        );


        // =================================
        // JOIN PERMANENT ROOM
        // =================================

        socket.on(
            "join-room",
            ({ room }) => {

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


                if (
                    currentUsers >=
                    MAX_USERS_PER_ROOM
                ) {

                    socket.emit(
                        "room-full"
                    );

                    return;
                }


                socket.join(
                    roomName
                );


                socket.data.room =
                    roomName;


                socket.emit(
                    "room-joined",
                    {
                        room:
                            roomName,

                        count:
                            currentUsers + 1
                    }
                );


                console.log(
                    `${socket.id} joined ${roomName}`
                );
            }
        );


        // =================================
        // CALL BY ROOM ID
        // =================================

        socket.on(
            "call-user",
            async ({
                room
            }) => {

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


                // ---------------------------------
                // ONLINE USER
                // ---------------------------------

                if (
                    roomSet &&
                    roomSet.size > 0
                ) {

                    const targetSocketId =
                        Array.from(
                            roomSet
                        ).find(
                            id =>
                                id !==
                                socket.id
                        );


                    if (
                        targetSocketId
                    ) {

                        io.to(
                            targetSocketId
                        ).emit(
                            "incoming-call",
                            {
                                callerId:
                                    socket.id,

                                callerRoom:
                                    socket.data.room ||
                                    "",

                                targetRoom:
                                    targetRoom
                            }
                        );


                        socket.emit(
                            "call-ringing",
                            {
                                room:
                                    targetRoom
                            }
                        );


                        console.log(
                            "Incoming call sent to online user:",
                            targetRoom
                        );


                        return;
                    }
                }


                // ---------------------------------
                // OFFLINE / BACKGROUND USER
                // ---------------------------------

                await sendPushNotification(
                    targetRoom,
                    {
                        type:
                            "incoming-call",

                        title:
                            "Incoming Video Call",

                        body:
                            `Someone is calling Room ${targetRoom}`,

                        callerRoom:
                            socket.data.room ||
                            "",

                        targetRoom:
                            targetRoom,

                        callerId:
                            socket.id,

                        url:
                            "/?incoming=1"
                    }
                );


                socket.emit(
                    "call-ringing",
                    {
                        room:
                            targetRoom
                    }
                );


                console.log(
                    "Push call sent:",
                    targetRoom
                );
            }
        );


        // =================================
        // ACCEPT CALL
        // =================================

        socket.on(
            "accept-call",
            ({
                callerId
            }) => {

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
            }
        );


        // =================================
        // REJECT CALL
        // =================================

        socket.on(
            "reject-call",
            ({
                callerId
            }) => {

                if (!callerId) {
                    return;
                }


                io.to(
                    callerId
                ).emit(
                    "call-rejected"
                );
            }
        );


        // =================================
        // WEBRTC SIGNAL
        // =================================

        socket.on(
            "signal",
            ({
                target,
                data
            }) => {

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


        // =================================
        // LEAVE ROOM
        // =================================

        socket.on(
            "leave-room",
            () => {

                leaveRoom(
                    socket
                );
            }
        );


        // =================================
        // DISCONNECT
        // =================================

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


// =====================================
// LEAVE ROOM
// =====================================

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
}


// =====================================
// SERVER
// =====================================

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

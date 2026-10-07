"use strict";

/* =========================================================
   JH SECURE CAM
   FINAL SERVER.JS
   Node + Express + Socket.IO + Web Push
========================================================= */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

let webpush = null;

try {
    webpush = require("web-push");
} catch (error) {
    console.warn(
        "web-push package not installed. Push notifications disabled."
    );
}


/* =========================================================
   APP / SERVER
========================================================= */

const app = express();

const server =
    http.createServer(app);


/*
 * Each Socket.IO message can be reasonably sized.
 *
 * The current app sends media as a Data URL, so this needs
 * to be large enough for the selected media.
 *
 * 40 MB allows some overhead for a 25 MB file.
 */
const io =
    new Server(server, {
        maxHttpBufferSize:
            40 * 1024 * 1024,

        cors: {
            origin: true,
            credentials: true
        }
    });


/* =========================================================
   SETTINGS
========================================================= */

const MAX_USERS_PER_ROOM = 6;

const MAX_MEDIA_BYTES =
    25 * 1024 * 1024;


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.json({
        limit: "40mb"
    })
);


/* =========================================================
   WEB PUSH CONFIG
========================================================= */

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY;

const VAPID_PRIVATE_KEY =
    process.env.VAPID_PRIVATE_KEY;

const VAPID_EMAIL =
    process.env.VAPID_EMAIL ||
    "mailto:yadavroushan8269@gmail.com";


let pushEnabled = false;


if (
    webpush &&
    VAPID_PUBLIC_KEY &&
    VAPID_PRIVATE_KEY
) {

    try {

        webpush.setVapidDetails(
            VAPID_EMAIL,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        );

        pushEnabled = true;

        console.log(
            "Web Push enabled."
        );

    } catch (error) {

        console.error(
            "Web Push configuration error:",
            error.message
        );
    }

} else {

    console.warn(
        "Web Push disabled: VAPID keys are missing."
    );
}


/*
 * socket.id -> push subscription
 */
const pushSubscriptions =
    new Map();


/* =========================================================
   API: VAPID PUBLIC KEY
========================================================= */

app.get(
    "/api/vapid-public-key",
    (req, res) => {

        if (
            !pushEnabled ||
            !VAPID_PUBLIC_KEY
        ) {

            return res.status(503).json({
                enabled: false,
                message:
                    "Web Push is not configured."
            });
        }


        res.json({
            enabled: true,
            publicKey:
                VAPID_PUBLIC_KEY
        });
    }
);


/* =========================================================
   API: SUBSCRIBE
========================================================= */

app.post(
    "/api/subscribe",
    (req, res) => {

        if (!pushEnabled) {

            return res.status(503).json({
                ok: false,
                message:
                    "Web Push is disabled."
            });
        }


        const subscription =
            req.body?.subscription;


        if (
            !subscription ||
            !subscription.endpoint
        ) {

            return res.status(400).json({
                ok: false,
                message:
                    "Invalid push subscription."
            });
        }


        /*
         * We identify the subscription using
         * its endpoint.
         *
         * This is intentionally kept in memory.
         */

        const key =
            subscription.endpoint;


        pushSubscriptions.set(
            key,
            subscription
        );


        res.json({
            ok: true
        });
    }
);


/* =========================================================
   API: UNSUBSCRIBE
========================================================= */

app.post(
    "/api/unsubscribe",
    (req, res) => {

        const endpoint =
            req.body?.endpoint;


        if (endpoint) {

            pushSubscriptions.delete(
                endpoint
            );
        }


        res.json({
            ok: true
        });
    }
);


/* =========================================================
   STATIC WEBSITE
========================================================= */

/*
 * API routes MUST be above this.
 */

app.use(
    express.static(
        __dirname
    )
);


/* =========================================================
   SPA FALLBACK
========================================================= */

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


/* =========================================================
   ROOM HELPERS
========================================================= */

function normalizeRoom(
    room
) {

    if (
        typeof room !==
        "string"
    ) {
        return "";
    }

    return room
        .trim()
        .toUpperCase()
        .slice(0, 50);
}


function getRoomUsers(
    room
) {

    if (!room) {
        return [];
    }


    const roomSet =
        io.sockets.adapter.rooms.get(
            room
        );


    if (!roomSet) {
        return [];
    }


    return Array.from(
        roomSet
    );
}


function getRoomCount(
    room
) {

    return getRoomUsers(
        room
    ).length;
}


/* =========================================================
   LEAVE ROOM
========================================================= */

function leaveRoom(
    socket
) {

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


    socket.leave(
        room
    );


    socket.data.room =
        null;


    socket.data.roomName =
        null;


    /*
     * Update room count.
     */

    const remaining =
        getRoomCount(
            room
        );


    if (remaining > 0) {

        io.to(room).emit(
            "room-count",
            {
                count:
                    remaining
            }
        );
    }
}


/* =========================================================
   PUSH NOTIFICATION
========================================================= */

async function sendPushNotification(
    room,
    payload
) {

    if (
        !pushEnabled ||
        !webpush
    ) {
        return;
    }


    /*
     * Current implementation keeps push
     * subscriptions in memory.
     *
     * We don't know which subscription belongs
     * to a particular room permanently, so this
     * broadcasts the incoming-call notification
     * to stored subscriptions.
     */

    const data =
        JSON.stringify(
            payload
        );


    const entries =
        Array.from(
            pushSubscriptions.entries()
        );


    for (
        const [
            key,
            subscription
        ] of entries
    ) {

        try {

            await webpush.sendNotification(
                subscription,
                data
            );

        } catch (error) {

            console.warn(
                "Push notification failed:",
                error.statusCode ||
                error.message
            );


            /*
             * Remove expired subscriptions.
             */

            if (
                error.statusCode ===
                    404 ||
                error.statusCode ===
                    410
            ) {

                pushSubscriptions.delete(
                    key
                );
            }
        }
    }
}


/* =========================================================
   SOCKET CONNECTION
========================================================= */

io.on(
    "connection",
    socket => {

        console.log(
            "User connected:",
            socket.id
        );


        /* =================================================
           JOIN ROOM
        ================================================= */

        socket.on(
            "join-room",
            payload => {

                const room =
                    normalizeRoom(
                        payload?.room
                    );


                if (!room) {

                    socket.emit(
                        "room-full",
                        {
                            message:
                                "Invalid Room ID."
                        }
                    );

                    return;
                }


                /*
                 * If already inside another room,
                 * leave it first.
                 */

                if (
                    socket.data.room &&
                    socket.data.room !== room
                ) {

                    leaveRoom(
                        socket
                    );
                }


                /*
                 * Already in this room.
                 */

                if (
                    socket.data.room ===
                    room
                ) {

                    const users =
                        getRoomUsers(
                            room
                        ).filter(
                            id =>
                                id !==
                                socket.id
                        );


                    socket.emit(
                        "room-joined",
                        {
                            room:
                                room,

                            count:
                                getRoomCount(
                                    room
                                ),

                            users:
                                users
                        }
                    );

                    return;
                }


                /*
                 * Current members BEFORE joining.
                 */

                const existingUsers =
                    getRoomUsers(
                        room
                    );


                if (
                    existingUsers.length >=
                    MAX_USERS_PER_ROOM
                ) {

                    socket.emit(
                        "room-full",
                        {
                            message:
                                "Room is full. Maximum 6 users allowed."
                        }
                    );

                    return;
                }


                /*
                 * Join.
                 */

                socket.join(
                    room
                );


                socket.data.room =
                    room;

                socket.data.roomName =
                    room;


                const count =
                    getRoomCount(
                        room
                    );


                /*
                 * Tell joining user.
                 */

                socket.emit(
                    "room-joined",
                    {
                        room:
                            room,

                        count:
                            count,

                        users:
                            existingUsers
                    }
                );


                /*
                 * Tell existing users.
                 */

                socket.to(room).emit(
                    "peer-joined",
                    {
                        peerId:
                            socket.id,

                        count:
                            count
                    }
                );


                /*
                 * Update everybody.
                 */

                io.to(room).emit(
                    "room-count",
                    {
                        count:
                            count
                    }
                );


                console.log(
                    `${socket.id} joined ${room} (${count}/${MAX_USERS_PER_ROOM})`
                );
            }
        );


        /* =================================================
           ROOM COUNT
        ================================================= */

        socket.on(
            "get-room-count",
            () => {

                const room =
                    socket.data.room;


                if (!room) {
                    return;
                }


                socket.emit(
                    "room-count",
                    {
                        count:
                            getRoomCount(
                                room
                            )
                    }
                );
            }
        );


        /* =================================================
           WEBRTC SIGNAL
        ================================================= */

        socket.on(
            "signal",
            payload => {

                const target =
                    payload?.target;

                const data =
                    payload?.data;


                if (
                    !target ||
                    !data
                ) {
                    return;
                }


                /*
                 * Only forward if target exists.
                 */

                const targetSocket =
                    io.sockets.sockets.get(
                        target
                    );


                if (!targetSocket) {

                    return;
                }


                io.to(target).emit(
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


        /* =================================================
           CALL USER
        ================================================= */

        socket.on(
            "call-user",
            payload => {

                const targetRoom =
                    normalizeRoom(
                        payload?.targetRoom
                    );

                const callerRoom =
                    normalizeRoom(
                        payload?.callerRoom
                    );

                const callerName =
                    typeof payload?.callerName ===
                    "string"
                        ? payload.callerName
                            .trim()
                            .slice(0, 40)
                        : "USER";


                if (!targetRoom) {

                    socket.emit(
                        "call-unavailable",
                        {
                            message:
                                "Invalid Room ID."
                        }
                    );

                    return;
                }


                const users =
                    getRoomUsers(
                        targetRoom
                    );


                /*
                 * Target room doesn't currently
                 * have a connected user.
                 */

                if (!users.length) {

                    socket.emit(
                        "call-unavailable",
                        {
                            message:
                                "No user is currently online in this room."
                        }
                    );


                    /*
                     * Optional push notification.
                     */

                    sendPushNotification(
                        targetRoom,
                        {
                            type:
                                "incoming-call",

                            room:
                                callerRoom,

                            callerRoom:
                                callerRoom,

                            callerName:
                                callerName,

                            message:
                                `${callerName} is calling you.`
                        }
                    ).catch(
                        console.error
                    );


                    return;
                }


                /*
                 * Don't call the caller's own socket.
                 */

                let sent =
                    false;


                users.forEach(
                    userId => {

                        if (
                            userId ===
                            socket.id
                        ) {
                            return;
                        }


                        sent =
                            true;


                        io.to(
                            userId
                        ).emit(
                            "incoming-call",
                            {
                                callerId:
                                    socket.id,

                                callerRoom:
                                    callerRoom,

                                room:
                                    callerRoom,

                                callerName:
                                    callerName
                            }
                        );
                    }
                );


                if (!sent) {

                    socket.emit(
                        "call-unavailable",
                        {
                            message:
                                "No other user is available in this room."
                        }
                    );

                    return;
                }


                socket.emit(
                    "call-ringing",
                    {
                        room:
                            targetRoom
                    }
                );


                console.log(
                    `${socket.id} is calling room ${targetRoom}`
                );
            }
        );


        /* =================================================
           ACCEPT CALL
        ================================================= */

        socket.on(
            "accept-call",
            payload => {

                const callerId =
                    payload?.callerId;


                if (!callerId) {
                    return;
                }


                const callerSocket =
                    io.sockets.sockets.get(
                        callerId
                    );


                if (!callerSocket) {

                    socket.emit(
                        "call-unavailable",
                        {
                            message:
                                "Caller is no longer online."
                        }
                    );

                    return;
                }


                callerSocket.emit(
                    "call-accepted",
                    {
                        receiverId:
                            socket.id,

                        targetId:
                            socket.id,

                        receiverRoom:
                            socket.data.room
                    }
                );


                console.log(
                    `${socket.id} accepted call from ${callerId}`
                );
            }
        );


        /* =================================================
           REJECT CALL
        ================================================= */

        socket.on(
            "reject-call",
            payload => {

                const callerId =
                    payload?.callerId;


                if (!callerId) {
                    return;
                }


                const callerSocket =
                    io.sockets.sockets.get(
                        callerId
                    );


                if (!callerSocket) {
                    return;
                }


                callerSocket.emit(
                    "call-rejected",
                    {
                        receiverId:
                            socket.id
                    }
                );


                console.log(
                    `${socket.id} rejected call from ${callerId}`
                );
            }
        );


        /* =================================================
           CHAT TEXT
        ================================================= */

        socket.on(
            "chat-message",
            payload => {

                const room =
                    normalizeRoom(
                        payload?.room
                    );

                const message =
                    payload?.message;


                if (
                    !room ||
                    !message
                ) {
                    return;
                }


                /*
                 * Security:
                 * Don't trust client room blindly.
                 */

                if (
                    socket.data.room !==
                    room
                ) {
                    return;
                }


                const cleanMessage = {

                    id:
                        String(
                            message.id ||
                            Date.now()
                        ).slice(
                            0,
                            100
                        ),

                    type:
                        "text",

                    senderId:
                        socket.id,

                    senderName:
                        typeof message.senderName ===
                        "string"
                            ? message.senderName
                                .slice(0, 40)
                            : "USER",

                    text:
                        typeof message.text ===
                        "string"
                            ? message.text
                                .slice(0, 5000)
                            : "",

                    time:
                        Date.now(),

                    replyTo:
                        message.replyTo ||
                        null
                };


                if (
                    !cleanMessage.text
                ) {
                    return;
                }


                socket.to(
                    room
                ).emit(
                    "chat-message",
                    {
                        message:
                            cleanMessage
                    }
                );
            }
        );


        /* =================================================
           CHAT MEDIA
        ================================================= */

        socket.on(
            "chat-media",
            payload => {

                const room =
                    normalizeRoom(
                        payload?.room
                    );

                const message =
                    payload?.message;


                if (
                    !room ||
                    !message
                ) {
                    return;
                }


                /*
                 * Only allow media from
                 * a socket actually inside
                 * the room.
                 */

                if (
                    socket.data.room !==
                    room
                ) {
                    return;
                }


                /*
                 * Basic media validation.
                 */

                const mime =
                    typeof message.mime ===
                    "string"
                        ? message.mime
                        : "";


                const allowed =
                    mime.startsWith(
                        "image/"
                    ) ||
                    mime.startsWith(
                        "video/"
                    );


                if (!allowed) {

                    socket.emit(
                        "chat-media-error",
                        {
                            message:
                                "Only image and video files are allowed."
                        }
                    );

                    return;
                }


                const size =
                    Number(
                        message.size
                    );


                if (
                    !Number.isFinite(
                        size
                    ) ||
                    size <= 0 ||
                    size >
                        MAX_MEDIA_BYTES
                ) {

                    socket.emit(
                        "chat-media-error",
                        {
                            message:
                                "Media must be between 1 byte and 25 MB."
                        }
                    );

                    return;
                }


                const dataUrl =
                    typeof message.dataUrl ===
                    "string"
                        ? message.dataUrl
                        : "";


                /*
                 * Prevent unexpectedly huge
                 * payloads from being relayed.
                 */

                if (
                    !dataUrl ||
                    dataUrl.length >
                        40 * 1024 * 1024
                ) {

                    socket.emit(
                        "chat-media-error",
                        {
                            message:
                                "Media payload is too large."
                        }
                    );

                    return;
                }


                const cleanMessage = {

                    id:
                        String(
                            message.id ||
                            Date.now()
                        ).slice(
                            0,
                            100
                        ),

                    type:
                        mime.startsWith(
                            "video/"
                        )
                            ? "video"
                            : "image",

                    senderId:
                        socket.id,

                    senderName:
                        typeof message.senderName ===
                        "string"
                            ? message.senderName
                                .slice(0, 40)
                            : "USER",

                    name:
                        typeof message.name ===
                        "string"
                            ? message.name
                                .slice(0, 200)
                            : "media",

                    mime:
                        mime,

                    size:
                        size,

                    dataUrl:
                        dataUrl,

                    time:
                        Date.now(),

                    replyTo:
                        message.replyTo ||
                        null
                };


                socket.to(
                    room
                ).emit(
                    "chat-media",
                    {
                        message:
                            cleanMessage
                    }
                );


                console.log(
                    `Media relayed: ${cleanMessage.name} (${size} bytes) in ${room}`
                );
            }
        );


        /* =================================================
           CHAT TYPING
        ================================================= */

        socket.on(
            "chat-typing",
            payload => {

                const room =
                    normalizeRoom(
                        payload?.room
                    );


                if (
                    !room ||
                    socket.data.room !==
                    room
                ) {
                    return;
                }


                socket.to(
                    room
                ).emit(
                    "chat-typing",
                    {
                        senderId:
                            socket.id,

                        name:
                            typeof payload?.name ===
                            "string"
                                ? payload.name
                                    .slice(0, 40)
                                : "USER"
                    }
                );
            }
        );


        /* =================================================
           CHAT STOP TYPING
        ================================================= */

        socket.on(
            "chat-stop-typing",
            payload => {

                const room =
                    normalizeRoom(
                        payload?.room
                    );


                if (
                    !room ||
                    socket.data.room !==
                    room
                ) {
                    return;
                }


                socket.to(
                    room
                ).emit(
                    "chat-stop-typing",
                    {
                        senderId:
                            socket.id
                    }
                );
            }
        );


        /* =================================================
           LEAVE ROOM
        ================================================= */

        socket.on(
            "leave-room",
            () => {

                leaveRoom(
                    socket
                );

                console.log(
                    "User left room:",
                    socket.id
                );
            }
        );


        /* =================================================
           DISCONNECT
        ================================================= */

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "User disconnected:",
                    socket.id,
                    reason
                );


                leaveRoom(
                    socket
                );
            }
        );
    }
);


/* =========================================================
   SERVER START
========================================================= */

const PORT =
    process.env.PORT ||
    10000;


server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "===================================="
        );

        console.log(
            "   JH SECURE CAM SERVER ONLINE"
        );

        console.log(
            "===================================="
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Maximum users per room: ${MAX_USERS_PER_ROOM}`
        );

        console.log(
            `Maximum media size: ${MAX_MEDIA_BYTES / (1024 * 1024)} MB`
        );

        console.log(
            `Web Push: ${pushEnabled ? "ENABLED" : "DISABLED"}`
        );
    }
);

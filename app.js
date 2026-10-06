/* =========================================================
   ROUSHAN // CALL
   MULTI USER CCTV VIDEO SYSTEM
   MAX 6 USERS
========================================================= */

const socket = io();


// =========================================================
// GLOBAL STATE
// =========================================================

let roomCode = "";
let localStream = null;

let currentFacingMode = "user";
let isMuted = false;

let incomingCallerId = null;
let incomingCallerRoom = null;
let incomingTargetRoom = null;

let activeCall = false;
let scannerInstance = null;


// Every remote user gets its own RTCPeerConnection
const peers = {};


// Remote video tile allocation
const peerTiles = {};


// Camera tile IDs
const tileIds = [
    "cameraTile2",
    "cameraTile3",
    "cameraTile4",
    "cameraTile5",
    "cameraTile6"
];


// =========================================================
// DOM ELEMENTS
// =========================================================

const roomInput =
    document.getElementById("roomInput");

const targetRoomInput =
    document.getElementById("targetRoomInput");

const createBtn =
    document.getElementById("createBtn");

const joinBtn =
    document.getElementById("joinBtn");

const scanBtn =
    document.getElementById("scanBtn");

const notificationBtn =
    document.getElementById("notificationBtn");

const qrBox =
    document.getElementById("qrBox");

const qrCode =
    document.getElementById("qrcode");

const scanner =
    document.getElementById("scanner");

const status =
    document.getElementById("status");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");

const cameraBtn =
    document.getElementById("cameraBtn");

const switchCameraBtn =
    document.getElementById("switchCameraBtn");

const micBtn =
    document.getElementById("micBtn");

const endBtn =
    document.getElementById("endBtn");

const userCount =
    document.getElementById("userCount");

const connectionStatus =
    document.getElementById("connectionStatus");

const logOutput =
    document.getElementById("logOutput");

const incomingCallOverlay =
    document.getElementById(
        "incomingCallOverlay"
    );

const incomingCallerText =
    document.getElementById(
        "incomingCallerText"
    );

const acceptCallBtn =
    document.getElementById(
        "acceptCallBtn"
    );

const rejectCallBtn =
    document.getElementById(
        "rejectCallBtn"
    );

const connectingOverlay =
    document.getElementById(
        "connectingOverlay"
    );

const connectingText =
    document.getElementById(
        "connectingText"
    );


// =========================================================
// WEBRTC CONFIG
// =========================================================

const rtcConfig = {

    iceServers: [

        {
            urls:
                "stun:stun.l.google.com:19302"
        },

        {
            urls:
                "stun:stun1.l.google.com:19302"
        }

    ]
};


// =========================================================
// UTILITY
// =========================================================

function normalizeRoom(code) {

    return String(code || "")
        .trim()
        .toUpperCase();

}


function setStatus(message) {

    if (status) {
        status.textContent =
            message;
    }

    addLog(
        message
    );
}


function addLog(message) {

    if (!logOutput) {
        return;
    }

    const line =
        document.createElement("div");

    line.textContent =
        "> " + message;

    logOutput.appendChild(
        line
    );

    while (
        logOutput.children.length > 12
    ) {

        logOutput.removeChild(
            logOutput.firstChild
        );

    }

}


function showConnecting(message) {

    if (!connectingOverlay) {
        return;
    }

    if (connectingText) {
        connectingText.textContent =
            message ||
            "PLEASE WAIT";
    }

    connectingOverlay.classList.remove(
        "hidden"
    );

}


function hideConnecting() {

    if (!connectingOverlay) {
        return;
    }

    connectingOverlay.classList.add(
        "hidden"
    );

}


// =========================================================
// PERMANENT ROOM ID
// =========================================================

function getPermanentRoomCode() {

    let saved =
        localStorage.getItem(
            "roushanPermanentRoom"
        );


    if (saved) {

        return normalizeRoom(
            saved
        );

    }


    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let code = "";


    for (
        let i = 0;
        i < 6;
        i++
    ) {

        code +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }


    localStorage.setItem(
        "roushanPermanentRoom",
        code
    );


    return code;

}


function showPermanentRoom() {

    roomCode =
        getPermanentRoomCode();


    if (roomInput) {

        roomInput.value =
            roomCode;

        roomInput.readOnly =
            true;

    }

}


showPermanentRoom();


// =========================================================
// SOCKET STATUS
// =========================================================

socket.on(
    "connect",
    () => {

        if (connectionStatus) {

            connectionStatus.textContent =
                "ONLINE";

        }

        addLog(
            "SOCKET CONNECTED"
        );

        setStatus(
            "SYSTEM ONLINE // SOCKET CONNECTED"
        );


        // Automatically register our room
        // with the server.
        setTimeout(
            () => {

                if (roomCode) {

                    joinOwnRoom();

                }

            },
            300
        );

    }
);


socket.on(
    "disconnect",
    () => {

        if (connectionStatus) {

            connectionStatus.textContent =
                "OFFLINE";

        }

        addLog(
            "SOCKET DISCONNECTED"
        );

        setStatus(
            "CONNECTION LOST // RECONNECTING..."
        );

    }
);


// =========================================================
// JOIN OWN PERMANENT ROOM
// =========================================================

function joinOwnRoom() {

    if (!roomCode) {
        return;
    }


    socket.emit(
        "join-room",
        {
            room:
                roomCode
        }
    );


    addLog(
        `ROOM ${roomCode} JOIN REQUEST SENT`
    );

}


// =========================================================
// CREATE ROOM
// =========================================================

if (createBtn) {

    createBtn.addEventListener(
        "click",
        async () => {

            roomCode =
                getPermanentRoomCode();


            if (roomInput) {

                roomInput.value =
                    roomCode;

                roomInput.readOnly =
                    true;

            }


            createQRCode(
                roomCode
            );


            joinOwnRoom();


            await startCamera();


            setStatus(
                `ROOM ${roomCode} READY`
            );

        }
    );

}


// =========================================================
// QR CODE GENERATION
// =========================================================

function createQRCode(code) {

    if (!qrCode) {
        return;
    }


    qrCode.innerHTML =
        "";


    const joinUrl =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(
            code
        );


    if (
        typeof QRCode ===
        "undefined"
    ) {

        addLog(
            "QR LIBRARY NOT FOUND"
        );

        return;

    }


    new QRCode(
        qrCode,
        {
            text:
                joinUrl,

            width:
                220,

            height:
                220,

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );


    if (qrBox) {

        qrBox.classList.remove(
            "hidden"
        );

    }


    addLog(
        "QR ACCESS CODE GENERATED"
    );

}


// =========================================================
// TARGET ROOM CALL
// =========================================================

if (joinBtn) {

    joinBtn.addEventListener(
        "click",
        async () => {

            const target =
                normalizeRoom(
                    targetRoomInput
                        ? targetRoomInput.value
                        : ""
                );


            if (!target) {

                alert(
                    "Target Room ID enter karo."
                );

                return;

            }


            if (
                target ===
                roomCode
            ) {

                alert(
                    "Apne hi room ko call nahi kar sakte."
                );

                return;

            }


            await startCamera();


            activeCall =
                true;


            showConnecting(
                "CALLING ROOM " +
                target
            );


            setStatus(
                `CALLING ${target}...`
            );


            socket.emit(
                "call-user",
                {
                    room:
                        target,

                    callerRoom:
                        roomCode
                }
            );

        }
    );

}


// =========================================================
// ROOM JOINED
// =========================================================

socket.on(
    "room-joined",
    async ({
        room,
        count,
        users
    }) => {

        roomCode =
            normalizeRoom(
                room
            );


        if (roomInput) {

            roomInput.value =
                roomCode;

            roomInput.readOnly =
                true;

        }


        updateUserCount(
            count
        );


        setStatus(
            `ROOM CONNECTED (${count}/6)`
        );


        addLog(
            `JOINED ROOM ${roomCode}`
        );


        // Only start camera automatically
        // when joining our own room or after
        // an accepted call.
        if (
            !localStream &&
            activeCall
        ) {

            await startCamera();

        }


        // Existing users are already in room.
        // Connect to them if we are actually
        // participating in the call.
        if (
            activeCall
        ) {

            for (
                const peerId of users || []
            ) {

                try {

                    await createPeer(
                        peerId,
                        true
                    );

                } catch (error) {

                    console.error(
                        "Peer creation error:",
                        error
                    );

                }

            }

        }

    }
);


// =========================================================
// ROOM FULL
// =========================================================

socket.on(
    "room-full",
    ({
        max
    } = {}) => {

        hideConnecting();


        setStatus(
            `ROOM FULL // MAX ${max || 6}`
        );


        alert(
            `Room full hai. Maximum ${max || 6} users allowed hain.`
        );

    }
);


// =========================================================
// JOIN ERROR
// =========================================================

socket.on(
    "join-error",
    ({
        message
    } = {}) => {

        hideConnecting();


        setStatus(
            message ||
            "ROOM JOIN ERROR"
        );

        alert(
            message ||
            "Room join nahi hua."
        );

    }
);


// =========================================================
// PEER JOINED
// =========================================================

socket.on(
    "peer-joined",
    ({
        peerId
    }) => {

        addLog(
            `USER CONNECTED: ${peerId}`
        );


        setStatus(
            "NEW USER DETECTED"
        );


        // The new user will create the offer.
        // We don't create another offer here.
        updateUserCountFromRoom();

    }
);


// =========================================================
// UPDATE COUNT FROM SOCKET ROOMS
// =========================================================

function updateUserCountFromRoom() {

    // Server will send room-joined count
    // on actual joins. This fallback only
    // keeps UI responsive.
    if (userCount) {

        const current =
            Number(
                userCount.textContent
            ) || 0;

        if (current < 6) {

            userCount.textContent =
                String(
                    Math.min(
                        6,
                        current + 1
                    )
                );

        }

    }

}


function updateUserCount(count) {

    if (!userCount) {
        return;
    }

    userCount.textContent =
        String(
            Math.min(
                6,
                Math.max(
                    0,
                    Number(count) || 0
                )
            )
        );

}


// =========================================================
// INCOMING CALL
// =========================================================

socket.on(
    "incoming-call",
    ({
        callerId,
        callerRoom,
        targetRoom
    } = {}) => {

        incomingCallerId =
            callerId || null;

        incomingCallerRoom =
            normalizeRoom(
                callerRoom
            );

        incomingTargetRoom =
            normalizeRoom(
                targetRoom ||
                roomCode
            );


        activeCall =
            false;


        if (incomingCallerText) {

            incomingCallerText.textContent =
                `> ${incomingCallerRoom || "UNKNOWN"} IS CALLING...`;

        }


        if (incomingCallOverlay) {

            incomingCallOverlay.classList.remove(
                "hidden"
            );

        }


        setStatus(
            `INCOMING CALL FROM ${incomingCallerRoom}`
        );


        addLog(
            `INCOMING CALL // ${incomingCallerRoom}`
        );

    }
);


// =========================================================
// ACCEPT CALL
// =========================================================

if (acceptCallBtn) {

    acceptCallBtn.addEventListener(
        "click",
        async () => {

            if (!incomingCallerId) {

                return;

            }


            const callerId =
                incomingCallerId;


            const callerRoom =
                incomingCallerRoom;


            const targetRoom =
                incomingTargetRoom ||
                roomCode;


            incomingCallOverlay.classList.add(
                "hidden"
            );


            activeCall =
                true;


            showConnecting(
                "ACCEPTING CONNECTION..."
            );


            setStatus(
                "CALL ACCEPTED // STARTING CAMERA"
            );


            try {

                await startCamera();

            } catch (error) {

                console.error(
                    error
                );

                hideConnecting();

                return;

            }


            socket.emit(
                "accept-call",
                {
                    callerId:
                        callerId,

                    callerRoom:
                        callerRoom,

                    targetRoom:
                        targetRoom
                }
            );


            addLog(
                `CALL ACCEPTED FROM ${callerRoom}`
            );


            // The caller will create the
            // initial WebRTC offer.
            setTimeout(
                () => {

                    hideConnecting();

                },
                1200
            );


            incomingCallerId =
                null;

        }
    );

}


// =========================================================
// REJECT CALL
// =========================================================

if (rejectCallBtn) {

    rejectCallBtn.addEventListener(
        "click",
        () => {

            if (incomingCallerId) {

                socket.emit(
                    "reject-call",
                    {
                        callerId:
                            incomingCallerId,

                        callerRoom:
                            incomingCallerRoom,

                        targetRoom:
                            incomingTargetRoom
                    }
                );

            }


            if (incomingCallOverlay) {

                incomingCallOverlay.classList.add(
                    "hidden"
                );

            }


            addLog(
                "INCOMING CALL REJECTED"
            );


            setStatus(
                "CALL REJECTED"
            );


            incomingCallerId =
                null;

            incomingCallerRoom =
                null;

            incomingTargetRoom =
                null;

        }
    );

}


// =========================================================
// CALL RINGING
// =========================================================

socket.on(
    "call-ringing",
    ({
        room
    } = {}) => {

        hideConnecting();


        setStatus(
            `RINGING ${room}...`
        );


        addLog(
            `CALL RINGING // ${room}`
        );

    }
);


// =========================================================
// CALL UNAVAILABLE
// =========================================================

socket.on(
    "call-unavailable",
    ({
        room,
        reason
    } = {}) => {

        hideConnecting();


        activeCall =
            false;


        setStatus(
            `${room || "ROOM"} OFFLINE`
        );


        addLog(
            "TARGET ROOM OFFLINE"
        );


        alert(
            `Room ${room || ""} online nahi hai.`
        );

    }
);


// =========================================================
// CALL ERROR
// =========================================================

socket.on(
    "call-error",
    ({
        message
    } = {}) => {

        hideConnecting();


        setStatus(
            message ||
            "CALL ERROR"
        );


        alert(
            message ||
            "Call start nahi hui."
        );

    }
);


// =========================================================
// CALL ACCEPTED BY OTHER USER
// =========================================================

socket.on(
    "call-accepted",
    async ({
        accepterId,
        accepterRoom
    } = {}) => {

        activeCall =
            true;


        hideConnecting();


        setStatus(
            `CALL ACCEPTED // ${accepterRoom || "REMOTE USER"}`
        );


        addLog(
            "REMOTE USER ACCEPTED CALL"
        );


        // Caller creates the initial offer.
        if (accepterId) {

            try {

                await startCamera();


                await createPeer(
                    accepterId,
                    true
                );

            } catch (error) {

                console.error(
                    "Offer creation error:",
                    error
                );

                setStatus(
                    "VIDEO CONNECTION ERROR"
                );

            }

        }

    }
);


// =========================================================
// LOCAL ACCEPT CONFIRMATION
// =========================================================

socket.on(
    "call-accepted-local",
    ({
        callerId,
        callerRoom
    } = {}) => {

        activeCall =
            true;


        setStatus(
            `CONNECTED TO ${callerRoom || "CALLER"}`
        );


        addLog(
            "CALL ACCEPT CONFIRMED"
        );

    }
);


// =========================================================
// CALL REJECTED
// =========================================================

socket.on(
    "call-rejected",
    ({
        room
    } = {}) => {

        hideConnecting();


        activeCall =
            false;


        setStatus(
            "CALL REJECTED"
        );


        addLog(
            `CALL REJECTED BY ${room || "REMOTE USER"}`
        );

    }
);


// =========================================================
// CALL CANCELLED
// =========================================================

socket.on(
    "call-cancelled",
    () => {

        hideConnecting();


        setStatus(
            "CALL CANCELLED"
        );

    }
);


// =========================================================
// WEBRTC SIGNAL
// =========================================================

socket.on(
    "signal",
    async ({
        sender,
        data
    } = {}) => {

        if (
            !sender ||
            !data
        ) {

            return;

        }


        try {

            let peer =
                peers[sender];


            if (!peer) {

                peer =
                    await createPeer(
                        sender,
                        false
                    );

            }


            // ---------------------------------------------
            // OFFER
            // ---------------------------------------------

            if (
                data.type ===
                "offer"
            ) {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        data
                    )
                );


                const answer =
                    await peer.createAnswer();


                await peer.setLocalDescription(
                    answer
                );


                socket.emit(
                    "signal",
                    {
                        target:
                            sender,

                        data:
                            peer.localDescription
                    }
                );


                activeCall =
                    true;


                hideConnecting();


                setStatus(
                    "VIDEO CONNECTING..."
                );


                addLog(
                    "WEBRTC OFFER RECEIVED"
                );

            }


            // ---------------------------------------------
            // ANSWER
            // ---------------------------------------------

            else if (
                data.type ===
                "answer"
            ) {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        data
                    )
                );


                hideConnecting();


                setStatus(
                    "VIDEO CONNECTED"
                );


                addLog(
                    "WEBRTC ANSWER RECEIVED"
                );

            }


            // ---------------------------------------------
            // ICE CANDIDATE
            // ---------------------------------------------

            else if (
                data.type ===
                "candidate"
            ) {

                if (
                    data.candidate
                ) {

                    try {

                        await peer.addIceCandidate(
                            new RTCIceCandidate(
                                data.candidate
                            )
                        );

                    } catch (error) {

                        console.warn(
                            "ICE candidate error:",
                            error
                        );

                    }

                }

            }

        } catch (error) {

            console.error(
                "SIGNAL ERROR:",
                error
            );


            setStatus(
                "WEBRTC SIGNAL ERROR"
            );

        }

    }
);


// =========================================================
// CREATE PEER CONNECTION
// =========================================================

async function createPeer(
    peerId,
    createOffer
) {

    if (
        !peerId
    ) {

        return null;

    }


    // Already exists
    if (
        peers[peerId]
    ) {

        return peers[peerId];

    }


    const peer =
        new RTCPeerConnection(
            rtcConfig
        );


    peers[peerId] =
        peer;


    // =====================================================
    // ADD LOCAL MEDIA
    // =====================================================

    if (
        localStream
    ) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    try {

                        peer.addTrack(
                            track,
                            localStream
                        );

                    } catch (error) {

                        console.warn(
                            "Track add error:",
                            error
                        );

                    }

                }
            );

    }


    // =====================================================
    // ICE
    // =====================================================

    peer.onicecandidate =
        event => {

            if (
                event.candidate
            ) {

                socket.emit(
                    "signal",
                    {
                        target:
                            peerId,

                        data: {

                            type:
                                "candidate",

                            candidate:
                                event.candidate

                        }

                    }
                );

            }

        };


    // =====================================================
    // REMOTE TRACK
    // =====================================================

    peer.ontrack =
        event => {

            if (
                !event.streams ||
                !event.streams[0]
            ) {

                return;

            }


            const stream =
                event.streams[0];


            attachRemoteStream(
                peerId,
                stream
            );


            activeCall =
                true;


            hideConnecting();


            setStatus(
                "VIDEO CONNECTED"
            );


            addLog(
                `VIDEO STREAM CONNECTED // ${peerId}`
            );

        };


    // =====================================================
    // CONNECTION STATE
    // =====================================================

    peer.onconnectionstatechange =
        () => {

            const state =
                peer.connectionState;


            console.log(
                "Peer:",
                peerId,
                "State:",
                state
            );


            if (
                state ===
                "connected"
            ) {

                activeCall =
                    true;

                hideConnecting();

                setStatus(
                    "VIDEO NETWORK CONNECTED"
                );

            }


            if (
                state ===
                "failed"
            ) {

                setStatus(
                    "CONNECTION FAILED"
                );

            }


            if (
                state ===
                "disconnected"
            ) {

                addLog(
                    `USER DISCONNECTED // ${peerId}`
                );

            }

        };


    // =====================================================
    // ICE CONNECTION STATE
    // =====================================================

    peer.oniceconnectionstatechange =
        () => {

            console.log(
                "ICE:",
                peerId,
                peer.iceConnectionState
            );

        };


    // =====================================================
    // CREATE OFFER
    // =====================================================

    if (
        createOffer
    ) {

        const offer =
            await peer.createOffer({
                offerToReceiveAudio:
                    true,

                offerToReceiveVideo:
                    true
            });


        await peer.setLocalDescription(
            offer
        );


        socket.emit(
            "signal",
            {
                target:
                    peerId,

                data:
                    peer.localDescription
            }
        );


        addLog(
            `OFFER SENT // ${peerId}`
        );

    }


    return peer;

}


// =========================================================
// REMOTE VIDEO TILE
// =========================================================

function attachRemoteStream(
    peerId,
    stream
) {

    let tileInfo =
        peerTiles[peerId];


    if (
        !tileInfo
    ) {

        tileInfo =
            createRemoteTile(
                peerId
            );

    }


    if (
        !tileInfo
    ) {

        return;

    }


    tileInfo.video.srcObject =
        stream;


    tileInfo.video.autoplay =
        true;

    tileInfo.video.playsInline =
        true;

    tileInfo.video.muted =
        false;


    tileInfo.video.play()
        .catch(
            () => {}
        );


    tileInfo.tile.classList.remove(
        "empty-tile"
    );


    const live =
        tileInfo.tile.querySelector(
            ".camera-live"
        );


    if (live) {

        live.textContent =
            "● LIVE";

    }


    const footer =
        tileInfo.tile.querySelector(
            ".camera-footer span:last-child"
        );


    if (footer) {

        footer.textContent =
            "ONLINE";

    }

}


// =========================================================
// CREATE REMOTE TILE
// =========================================================

function createRemoteTile(
    peerId
) {

    // Already assigned
    if (
        peerTiles[peerId]
    ) {

        return peerTiles[peerId];

    }


    let tile =
        null;


    // Find first free tile
    for (
        const tileId of tileIds
    ) {

        const candidate =
            document.getElementById(
                tileId
            );


        if (
            !candidate
        ) {

            continue;

        }


        let occupied =
            false;


        for (
            const existingPeer in peerTiles
        ) {

            if (
                peerTiles[
                    existingPeer
                ].tile ===
                candidate
            ) {

                occupied =
                    true;

                break;

            }

        }


        if (
            !occupied
        ) {

            tile =
                candidate;

            break;

        }

    }


    if (
        !tile
    ) {

        addLog(
            "NO FREE CAMERA TILE"
        );

        return null;

    }


    const video =
        tile.querySelector(
            "video"
        );


    if (
        !video
    ) {

        return null;

    }


    peerTiles[peerId] = {

        tile:
            tile,

        video:
            video

    };


    const cameraName =
        tile.querySelector(
            ".camera-name"
        );


    if (cameraName) {

        const number =
            tile.id.replace(
                "cameraTile",
                ""
            );


        cameraName.textContent =
            `CAM_0${number} // USER`;

    }


    return peerTiles[peerId];

}


// =========================================================
// REMOVE REMOTE TILE
// =========================================================

function removeRemoteTile(
    peerId
) {

    const info =
        peerTiles[peerId];


    if (
        !info
    ) {

        return;

    }


    if (
        info.video
    ) {

        info.video.srcObject =
            null;

    }


    if (
        info.tile
    ) {

        info.tile.classList.add(
            "empty-tile"
        );


        const live =
            info.tile.querySelector(
                ".camera-live"
            );


        if (live) {

            live.textContent =
                "● WAITING";

        }


        const footer =
            info.tile.querySelector(
                ".camera-footer span:last-child"
            );


        if (footer) {

            footer.textContent =
                "OFFLINE";

        }


        const cameraName =
            info.tile.querySelector(
                ".camera-name"
            );


        if (cameraName) {

            const number =
                info.tile.id.replace(
                    "cameraTile",
                    ""
                );


            cameraName.textContent =
                `CAM_0${number} // USER_0${number}`;

        }

    }


    delete peerTiles[
        peerId
    ];

}


// =========================================================
// PEER LEFT
// =========================================================

socket.on(
    "peer-left",
    ({
        peerId
    } = {}) => {

        if (!peerId) {
            return;
        }


        if (
            peers[peerId]
        ) {

            try {

                peers[
                    peerId
                ].close();

            } catch {}

            delete peers[
                peerId
            ];

        }


        removeRemoteTile(
            peerId
        );


        updateUserCountFromRoom();


        addLog(
            `USER LEFT // ${peerId}`
        );


        setStatus(
            "USER DISCONNECTED"
        );

    }
);


// =========================================================
// START CAMERA
// =========================================================

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        async () => {

            await startCamera();

        }
    );

}


async function startCamera() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "Camera API unavailable. HTTPS required."
            );

        }


        const oldStream =
            localStream;


        const newStream =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode: {
                            ideal:
                                currentFacingMode
                        },

                        width: {
                            ideal:
                                1280
                        },

                        height: {
                            ideal:
                                720
                        },

                        frameRate: {
                            ideal:
                                24,

                            max:
                                30
                        }

                    },

                    audio: true

                });


        localStream =
            newStream;


        // Local preview
        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.playsInline =
                true;


            await localVideo
                .play()
                .catch(
                    () => {}
                );

        }


        // Replace tracks on existing peers
        for (
            const peerId in peers
        ) {

            const peer =
                peers[
                    peerId
                ];


            if (
                !peer
            ) {

                continue;

            }


            const videoTrack =
                localStream
                    .getVideoTracks()[0];


            const audioTrack =
                localStream
                    .getAudioTracks()[0];


            const videoSender =
                peer
                    .getSenders()
                    .find(
                        sender =>
                            sender.track &&
                            sender.track.kind ===
                            "video"
                    );


            const audioSender =
                peer
                    .getSenders()
                    .find(
                        sender =>
                            sender.track &&
                            sender.track.kind ===
                            "audio"
                    );


            if (
                videoSender &&
                videoTrack
            ) {

                try {

                    await videoSender.replaceTrack(
                        videoTrack
                    );

                } catch (error) {

                    console.warn(
                        "Video replace error:",
                        error
                    );

                }

            }


            if (
                audioSender &&
                audioTrack
            ) {

                try {

                    await audioSender.replaceTrack(
                        audioTrack
                    );

                } catch (error) {

                    console.warn(
                        "Audio replace error:",
                        error
                    );

                }

            }

        }


        // Stop previous stream
        if (
            oldStream &&
            oldStream !== localStream
        ) {

            oldStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        // Respect mute state
        localStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        !isMuted;

                }
            );


        if (cameraBtn) {

            cameraBtn.textContent =
                "CAMERA ON";

        }


        setStatus(
            "LOCAL CAMERA ONLINE"
        );


        addLog(
            "LOCAL CAMERA STARTED"
        );


        return localStream;

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        setStatus(
            "CAMERA ACCESS ERROR"
        );


        alert(
            "Camera/Mic start nahi hua:\n" +
            error.message
        );


        throw error;

    }

}


// =========================================================
// SWITCH CAMERA
// =========================================================

if (switchCameraBtn) {

    switchCameraBtn.addEventListener(
        "click",
        async () => {

            currentFacingMode =
                currentFacingMode ===
                "user"
                    ? "environment"
                    : "user";


            try {

                await startCamera();


                setStatus(
                    currentFacingMode ===
                    "environment"
                        ? "BACK CAMERA ACTIVE"
                        : "FRONT CAMERA ACTIVE"
                );

            } catch {}

        }
    );

}


// =========================================================
// MIC MUTE
// =========================================================

if (micBtn) {

    micBtn.addEventListener(
        "click",
        () => {

            if (!localStream) {

                alert(
                    "Pehle camera start karo."
                );

                return;

            }


            const tracks =
                localStream
                    .getAudioTracks();


            if (
                tracks.length === 0
            ) {

                return;

            }


            isMuted =
                !isMuted;


            tracks.forEach(
                track => {

                    track.enabled =
                        !isMuted;

                }
            );


            micBtn.textContent =
                isMuted
                    ? "UNMUTE"
                    : "MUTE";


            setStatus(
                isMuted
                    ? "MIC MUTED"
                    : "MIC ACTIVE"
            );


            addLog(
                isMuted
                    ? "MIC MUTED"
                    : "MIC UNMUTED"
            );

        }
    );

}


// =========================================================
// END CALL
// =========================================================

if (endBtn) {

    endBtn.addEventListener(
        "click",
        endCall
    );

}


function endCall() {

    activeCall =
        false;


    hideConnecting();


    // Close every peer
    for (
        const peerId in peers
    ) {

        try {

            peers[
                peerId
            ].close();

        } catch {}

        delete peers[
            peerId
        ];

    }


    // Clear remote tiles
    for (
        const peerId in peerTiles
    ) {

        removeRemoteTile(
            peerId
        );

    }


    // Stop camera
    if (
        localStream
    ) {

        localStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        localStream =
            null;

    }


    if (localVideo) {

        localVideo.srcObject =
            null;

    }


    socket.emit(
        "leave-room"
    );


    // Reset buttons
    if (cameraBtn) {

        cameraBtn.textContent =
            "CAMERA";

    }


    if (micBtn) {

        micBtn.textContent =
            "MUTE";

    }


    isMuted =
        false;


    setStatus(
        "CALL ENDED"
    );


    addLog(
        "CALL TERMINATED"
    );


    updateUserCount(
        0
    );

}


// =========================================================
// QR SCANNER
// =========================================================

if (scanBtn) {

    scanBtn.addEventListener(
        "click",
        startScanner
    );

}


async function startScanner() {

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        alert(
            "QR scanner load nahi hua."
        );

        return;

    }


    if (
        scannerInstance
    ) {

        try {

            await scannerInstance.stop();

        } catch {}

        try {

            await scannerInstance.clear();

        } catch {}

        scannerInstance =
            null;

    }


    if (scanner) {

        scanner.classList.remove(
            "hidden"
        );

        scanner.innerHTML =
            "";

    }


    scannerInstance =
        new Html5Qrcode(
            "scanner"
        );


    try {

        await scannerInstance.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps:
                    10,

                qrbox:
                    {
                        width:
                            250,

                        height:
                            250
                    }
            },

            async decodedText => {

                await handleScannedCode(
                    decodedText
                );

            },

            () => {}

        );


        setStatus(
            "QR SCANNER ACTIVE"
        );


    } catch (error) {

        console.error(
            "QR scanner error:",
            error
        );


        if (scanner) {

            scanner.classList.add(
                "hidden"
            );

        }


        alert(
            "QR scanner camera open nahi hua:\n" +
            error.message
        );

    }

}


// =========================================================
// HANDLE QR CODE
// =========================================================

async function handleScannedCode(
    decodedText
) {

    let code =
        "";


    try {

        const url =
            new URL(
                decodedText
            );


        code =
            normalizeRoom(
                url.searchParams.get(
                    "room"
                )
            );

    } catch {

        code =
            normalizeRoom(
                decodedText
            );

    }


    if (!code) {

        return;

    }


    // Stop scanner
    if (
        scannerInstance
    ) {

        try {

            await scannerInstance.stop();

        } catch {}

        try {

            await scannerInstance.clear();

        } catch {}

        scannerInstance =
            null;

    }


    if (scanner) {

        scanner.classList.add(
            "hidden"
        );

    }


    if (targetRoomInput) {

        targetRoomInput.value =
            code;

    }


    // Don't call own room
    if (
        code ===
        roomCode
    ) {

        setStatus(
            "THIS IS YOUR OWN ROOM"
        );

        return;

    }


    await startCamera();


    activeCall =
        true;


    showConnecting(
        `CALLING ${code}`
    );


    socket.emit(
        "call-user",
        {
            room:
                code,

            callerRoom:
                roomCode
        }
    );


    setStatus(
        `CALLING ROOM ${code}`
    );


    addLog(
        `QR ROOM DETECTED // ${code}`
    );

}


// =========================================================
// AUTO JOIN FROM QR URL
// =========================================================

function checkRoomFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const roomFromUrl =
        params.get(
            "room"
        );


    if (!roomFromUrl) {

        return;

    }


    const target =
        normalizeRoom(
            roomFromUrl
        );


    if (!target) {

        return;

    }


    // Don't call ourselves
    if (
        target ===
        roomCode
    ) {

        createQRCode(
            roomCode
        );

        return;

    }


    if (targetRoomInput) {

        targetRoomInput.value =
            target;

    }


    addLog(
        `QR LINK DETECTED // ${target}`
    );


    // Wait for socket connection
    // before sending call.
    const startAutoCall =
        () => {

            setTimeout(
                async () => {

                    try {

                        await startCamera();

                    } catch {}

                    activeCall =
                        true;


                    showConnecting(
                        `CALLING ${target}`
                    );


                    socket.emit(
                        "call-user",
                        {
                            room:
                                target,

                            callerRoom:
                                roomCode
                        }
                    );


                    setStatus(
                        `CALLING ${target}...`
                    );

                },
                800
            );

        };


    if (
        socket.connected
    ) {

        startAutoCall();

    } else {

        socket.once(
            "connect",
            startAutoCall
        );

    }

}


checkRoomFromUrl();


// =========================================================
// NOTIFICATION SYSTEM
// =========================================================

if (notificationBtn) {

    notificationBtn.addEventListener(
        "click",
        setupNotifications
    );

}


async function setupNotifications() {

    if (
        !("Notification" in window)
    ) {

        alert(
            "Is browser mein notifications supported nahi hain."
        );

        return;

    }


    try {

        const permission =
            await Notification.requestPermission();


        if (
            permission !==
            "granted"
        ) {

            setStatus(
                "NOTIFICATION PERMISSION DENIED"
            );

            return;

        }


        if (
            !("serviceWorker" in navigator)
        ) {

            setStatus(
                "SERVICE WORKER NOT AVAILABLE"
            );

            return;

        }


        const registration =
            await navigator.serviceWorker.register(
                "/sw.js"
            );


        const response =
            await fetch(
                "/api/vapid-public-key"
            );


        if (!response.ok) {

            throw new Error(
                "VAPID key endpoint unavailable."
            );

        }


        const data =
            await response.json();


        if (
            !data.enabled ||
            !data.publicKey
        ) {

            setStatus(
                "PUSH SERVICE NOT ENABLED"
            );

            return;

        }


        const subscription =
            await registration.pushManager.subscribe({

                userVisibleOnly:
                    true,

                applicationServerKey:
                    urlBase64ToUint8Array(
                        data.publicKey
                    )

            });


        const subscribeResponse =
            await fetch(
                "/api/subscribe",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            room:
                                roomCode,

                            subscription:
                                subscription
                        })
                }
            );


        if (
            !subscribeResponse.ok
        ) {

            throw new Error(
                "Subscription save failed."
            );

        }


        setStatus(
            "NOTIFICATIONS ENABLED"
        );


        addLog(
            "PUSH NOTIFICATIONS ENABLED"
        );


        alert(
            "Notifications enabled."
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );


        setStatus(
            "NOTIFICATION SETUP FAILED"
        );


        alert(
            "Notification setup nahi hua:\n" +
            error.message
        );

    }

}


// =========================================================
// BASE64 -> UINT8 ARRAY
// =========================================================

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (4 -
                base64String.length %
                4) %
            4
        );


    const base64 =
        (
            base64String +
            padding
        )
            .replace(
                /-/g,
                "+"
            )
            .replace(
                /_/g,
                "/"
            );


    const rawData =
        window.atob(
            base64
        );


    const outputArray =
        new Uint8Array(
            rawData.length
        );


    for (
        let i = 0;
        i < rawData.length;
        ++i
    ) {

        outputArray[i] =
            rawData.charCodeAt(
                i
            );

    }


    return outputArray;

}


// =========================================================
// PAGE VISIBILITY
// =========================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            if (
                localVideo &&
                localVideo.srcObject
            ) {

                localVideo.play()
                    .catch(
                        () => {}
                    );

            }

        }

    }
);


// =========================================================
// KEYBOARD SHORTCUTS
// =========================================================

document.addEventListener(
    "keydown",
    event => {

        // Escape closes incoming call
        if (
            event.key ===
            "Escape"
        ) {

            if (
                incomingCallOverlay &&
                !incomingCallOverlay.classList.contains(
                    "hidden"
                )
            ) {

                if (
                    rejectCallBtn
                ) {

                    rejectCallBtn.click();

                }

            }

        }

    }
);


// =========================================================
// INITIAL LOG
// =========================================================

addLog(
    "ROUSHAN // CALL INITIALIZED"
);

addLog(
    "MAX CHANNELS: 06"
);

addLog(
    `YOUR ROOM: ${roomCode}`
);

setStatus(
    "SYSTEM READY // WAITING FOR CONNECTION"
);

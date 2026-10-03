// ======================================================
// JH ROUSHAN YADAV - WebRTC + Socket.IO + Push
// ======================================================

const socket = io();

// ------------------------------
// DOM ELEMENTS
// ------------------------------
const roomInput = document.getElementById("roomInput");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const scanBtn = document.getElementById("scanBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const callBtn = document.getElementById("callBtn");
const endCallBtn = document.getElementById("endCallBtn");

let switchCameraBtn = document.getElementById("switchCameraBtn");

const acceptCallBtn = document.getElementById("acceptCallBtn");
const rejectCallBtn = document.getElementById("rejectCallBtn");

const incomingCallBox = document.getElementById("incomingCallBox");

// ------------------------------
// VARIABLES
// ------------------------------
let roomCode = "";
let targetRoom = "";

let localStream = null;
let peerConnection = null;

let currentFacingMode = "user";

let pendingCaller = null;

const peerConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};

// ======================================================
// PERMANENT ROOM CODE
// ======================================================

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(
            Math.floor(Math.random() * chars.length)
        );
    }

    return code;
}


function getPermanentRoomCode() {

    let saved = localStorage.getItem("roushanPermanentRoom");

    if (!saved) {
        saved = generateRoomCode();

        localStorage.setItem(
            "roushanPermanentRoom",
            saved
        );
    }

    return saved;
}


// ======================================================
// SHOW PERMANENT ROOM
// ======================================================

function showPermanentRoom() {

    roomCode = getPermanentRoomCode();

    roomInput.value = roomCode;

    // IMPORTANT:
    // Permanent Room ID can NEVER be manually edited
    roomInput.readOnly = true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );
}


// ======================================================
// SOCKET CONNECT
// ======================================================

socket.on("connect", () => {

    console.log(
        "Socket connected:",
        socket.id
    );

    showPermanentRoom();

    joinOwnRoom();
});


// ======================================================
// JOIN OWN PERMANENT ROOM
// ======================================================

function joinOwnRoom() {

    roomCode = getPermanentRoomCode();

    roomInput.value = roomCode;

    // Keep permanent ID locked
    roomInput.readOnly = true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );

    socket.emit(
        "join-room",
        roomCode
    );

    console.log(
        "Joined own room:",
        roomCode
    );
}


// ======================================================
// CREATE ROOM
// ======================================================

if (createBtn) {

    createBtn.addEventListener(
        "click",
        () => {

            const ownRoom =
                getPermanentRoomCode();

            roomCode = ownRoom;

            roomInput.value =
                ownRoom;

            roomInput.readOnly = true;

            roomInput.setAttribute(
                "readonly",
                "readonly"
            );

            socket.emit(
                "join-room",
                ownRoom
            );

            alert(
                "Tumhara Permanent Room Code:\n\n" +
                ownRoom
            );
        }
    );
}


// ======================================================
// JOIN TARGET ROOM
// ======================================================

function joinTargetRoom(code) {

    if (!code) return;

    const cleanedCode =
        code.trim().toUpperCase();

    if (!cleanedCode) return;

    targetRoom = cleanedCode;

    // Display target room temporarily
    roomInput.value =
        targetRoom;

    roomInput.readOnly = true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );

    socket.emit(
        "join-room",
        targetRoom
    );

    console.log(
        "Joining target room:",
        targetRoom
    );
}


// ======================================================
// JOIN BUTTON
// ======================================================

if (joinBtn) {

    joinBtn.addEventListener(
        "click",
        () => {

            const ownRoom =
                getPermanentRoomCode();

            const enteredCode =
                prompt(
                    "Jis Room mein join karna hai uska Room Code enter karo:"
                );

            if (!enteredCode) {
                return;
            }

            const code =
                enteredCode.trim().toUpperCase();

            if (!code) {
                return;
            }

            if (code === ownRoom) {

                alert(
                    "Ye tumhara apna Room Code hai.\n\n" +
                    "Dusre person ka Room Code enter karo."
                );

                return;
            }

            joinTargetRoom(code);
        }
    );
}


// ======================================================
// QR SCANNER
// ======================================================

if (scanBtn) {

    scanBtn.addEventListener(
        "click",
        async () => {

            try {

                if (
                    typeof Html5Qrcode ===
                    "undefined"
                ) {

                    alert(
                        "QR Scanner library load nahi hui."
                    );

                    return;
                }

                const scanner =
                    new Html5Qrcode(
                        "qr-reader"
                    );

                await scanner.start(
                    {
                        facingMode: "environment"
                    },
                    {
                        fps: 10,
                        qrbox: 250
                    },
                    async decodedText => {

                        console.log(
                            "QR:",
                            decodedText
                        );

                        let code =
                            decodedText
                                .trim()
                                .toUpperCase();

                        // If QR contains URL
                        try {

                            const url =
                                new URL(
                                    decodedText
                                );

                            const room =
                                url.searchParams.get(
                                    "room"
                                );

                            if (room) {
                                code =
                                    room
                                        .trim()
                                        .toUpperCase();
                            }

                        } catch (e) {
                            // Not URL
                        }

                        await scanner.stop();

                        joinTargetRoom(code);
                    }
                );

            } catch (error) {

                console.error(
                    "QR error:",
                    error
                );

                alert(
                    "QR Scanner start nahi ho saka."
                );
            }
        }
    );
}


// ======================================================
// CAMERA
// ======================================================

async function startCamera() {

    try {

        // If existing video track exists,
        // first try changing camera directly
        if (
            localStream &&
            localStream.getVideoTracks().length
        ) {

            const videoTrack =
                localStream.getVideoTracks()[0];

            try {

                await videoTrack.applyConstraints({
                    facingMode: {
                        exact:
                            currentFacingMode
                    }
                });

                console.log(
                    "Camera switched using applyConstraints"
                );

                if (localVideo) {
                    localVideo.srcObject =
                        localStream;
                }

                return localStream;

            } catch (constraintError) {

                console.log(
                    "applyConstraints failed, opening new camera..."
                );
            }
        }


        // New camera stream
        const oldStream =
            localStream;

        const newStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    video: {
                        facingMode: {
                            ideal:
                                currentFacingMode
                        },
                        width: {
                            ideal: 1280
                        },
                        height: {
                            ideal: 720
                        }
                    },
                    audio: true
                }
            );


        // Keep old audio track if possible
        if (
            oldStream &&
            oldStream.getAudioTracks().length
        ) {

            const newAudioTracks =
                newStream.getAudioTracks();

            const oldAudioTrack =
                oldStream.getAudioTracks()[0];

            if (
                newAudioTracks.length &&
                oldAudioTrack
            ) {

                oldAudioTrack.stop();

            }
        }


        // Stop old video tracks
        if (oldStream) {

            oldStream
                .getVideoTracks()
                .forEach(track => {

                    if (
                        !newStream
                            .getVideoTracks()
                            .includes(track)
                    ) {
                        track.stop();
                    }

                });
        }


        localStream =
            newStream;


        if (localVideo) {

            localVideo.srcObject =
                localStream;

            localVideo.muted =
                true;

            localVideo.playsInline =
                true;

            try {
                await localVideo.play();
            } catch (e) {
                console.log(
                    "Video autoplay:",
                    e
                );
            }
        }


        // Replace tracks in active peer
        replacePeerTracks();


        console.log(
            "Camera started:",
            currentFacingMode
        );


        return localStream;

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        // Final fallback
        try {

            const fallbackStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: true,
                        audio: true
                    }
                );

            localStream =
                fallbackStream;

            if (localVideo) {

                localVideo.srcObject =
                    localStream;

                localVideo.muted =
                    true;

                await localVideo.play()
                    .catch(() => {});
            }

            replacePeerTracks();

            return localStream;

        } catch (finalError) {

            console.error(
                "Final camera error:",
                finalError
            );

            alert(
                "Camera/Microphone permission allow karo."
            );

            return null;
        }
    }
}


// ======================================================
// REPLACE PEER VIDEO TRACK
// ======================================================

async function replacePeerVideoTrack() {

    if (
        !peerConnection ||
        !localStream
    ) {
        return;
    }

    const newVideoTrack =
        localStream.getVideoTracks()[0];

    if (!newVideoTrack) {
        return;
    }


    const sender =
        peerConnection
            .getSenders()
            .find(
                s =>
                    s.track &&
                    s.track.kind === "video"
            );


    if (sender) {

        try {

            await sender.replaceTrack(
                newVideoTrack
            );

            console.log(
                "Peer video track replaced"
            );

        } catch (error) {

            console.error(
                "replaceTrack error:",
                error
            );
        }
    }
}


// ======================================================
// REPLACE ALL PEER TRACKS
// ======================================================

async function replacePeerTracks() {

    if (
        !peerConnection ||
        !localStream
    ) {
        return;
    }


    const senders =
        peerConnection.getSenders();


    const videoTrack =
        localStream.getVideoTracks()[0];

    const audioTrack =
        localStream.getAudioTracks()[0];


    for (const sender of senders) {

        if (
            sender.track &&
            sender.track.kind === "video" &&
            videoTrack
        ) {

            try {
                await sender.replaceTrack(
                    videoTrack
                );
            } catch (e) {
                console.error(e);
            }
        }


        if (
            sender.track &&
            sender.track.kind === "audio" &&
            audioTrack
        ) {

            try {
                await sender.replaceTrack(
                    audioTrack
                );
            } catch (e) {
                console.error(e);
            }
        }
    }
}


// ======================================================
// SWITCH CAMERA BUTTON
// ======================================================

if (!switchCameraBtn) {

    switchCameraBtn =
        document.createElement("button");

    switchCameraBtn.id =
        "switchCameraBtn";

    switchCameraBtn.type =
        "button";

    switchCameraBtn.textContent =
        "🔄 Switch Camera";

    // Add after call button if possible
    if (callBtn && callBtn.parentElement) {

        callBtn.parentElement.appendChild(
            switchCameraBtn
        );

    } else {

        document.body.appendChild(
            switchCameraBtn
        );
    }
}


switchCameraBtn.addEventListener(
    "click",
    async () => {

        currentFacingMode =
            currentFacingMode === "user"
                ? "environment"
                : "user";

        console.log(
            "Switching camera to:",
            currentFacingMode
        );

        await startCamera();
    }
);


// ======================================================
// CREATE PEER CONNECTION
// ======================================================

function createPeerConnection(
    remoteSocketId = null
) {

    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (e) {}
    }


    peerConnection =
        new RTCPeerConnection(
            peerConfig
        );


    // Local tracks
    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });
    }


    // Remote video
    peerConnection.ontrack =
        event => {

            console.log(
                "Remote track received"
            );

            const [stream] =
                event.streams;

            if (
                remoteVideo &&
                stream
            ) {

                remoteVideo.srcObject =
                    stream;

                remoteVideo.autoplay =
                    true;

                remoteVideo.playsInline =
                    true;

                remoteVideo
                    .play()
                    .catch(() => {});
            }
        };


    // ICE candidate
    peerConnection.onicecandidate =
        event => {

            if (
                event.candidate &&
                remoteSocketId
            ) {

                socket.emit(
                    "ice-candidate",
                    {
                        target:
                            remoteSocketId,

                        candidate:
                            event.candidate
                    }
                );
            }
        };


    peerConnection.onconnectionstatechange =
        () => {

            console.log(
                "Peer connection:",
                peerConnection.connectionState
            );

            if (
                peerConnection.connectionState ===
                "failed"
            ) {

                console.log(
                    "WebRTC connection failed"
                );
            }
        };


    return peerConnection;
}


// ======================================================
// CALL BUTTON
// ======================================================

if (callBtn) {

    callBtn.addEventListener(
        "click",
        async () => {

            if (!targetRoom) {

                const enteredCode =
                    prompt(
                        "Jis person ko call karna hai uska Room Code:"
                    );

                if (!enteredCode) {
                    return;
                }

                const code =
                    enteredCode
                        .trim()
                        .toUpperCase();

                const ownRoom =
                    getPermanentRoomCode();

                if (code === ownRoom) {

                    alert(
                        "Apne hi Room ko call nahi kar sakte."
                    );

                    return;
                }

                targetRoom = code;
            }


            if (!localStream) {

                const stream =
                    await startCamera();

                if (!stream) {
                    return;
                }
            }


            console.log(
                "Calling:",
                targetRoom
            );


            socket.emit(
                "call-user",
                {
                    target:
                        targetRoom
                }
            );
        }
    );
}


// ======================================================
// INCOMING CALL
// ======================================================

socket.on(
    "incoming-call",
    data => {

        console.log(
            "Incoming call:",
            data
        );

        pendingCaller =
            data;


        if (incomingCallBox) {

            incomingCallBox.style.display =
                "block";
        }
    }
);


// ======================================================
// ACCEPT CALL
// ======================================================

if (acceptCallBtn) {

    acceptCallBtn.addEventListener(
        "click",
        async () => {

            try {

                if (!pendingCaller) {
                    return;
                }


                const caller =
                    pendingCaller;


                if (!localStream) {

                    const stream =
                        await startCamera();

                    if (!stream) {
                        return;
                    }
                }


                if (incomingCallBox) {

                    incomingCallBox.style.display =
                        "none";
                }


                socket.emit(
                    "accept-call",
                    {
                        target:
                            caller.from ||
                            caller.caller ||
                            caller.socketId
                    }
                );


                pendingCaller =
                    null;

            } catch (error) {

                console.error(
                    "Accept call error:",
                    error
                );
            }
        }
    );
}


// ======================================================
// REJECT CALL
// ======================================================

if (rejectCallBtn) {

    rejectCallBtn.addEventListener(
        "click",
        () => {

            if (!pendingCaller) {
                return;
            }


            socket.emit(
                "reject-call",
                {
                    target:
                        pendingCaller.from ||
                        pendingCaller.caller ||
                        pendingCaller.socketId
                }
            );


            pendingCaller =
                null;


            if (incomingCallBox) {

                incomingCallBox.style.display =
                    "none";
            }
        }
    );
}


// ======================================================
// CALL ACCEPTED
// ======================================================

socket.on(
    "call-accepted",
    async data => {

        console.log(
            "Call accepted:",
            data
        );


        try {

            const target =
                data.target ||
                data.from ||
                data.socketId;


            if (!localStream) {

                const stream =
                    await startCamera();

                if (!stream) {
                    return;
                }
            }


            createPeerConnection(
                target
            );


            const offer =
                await peerConnection
                    .createOffer();


            await peerConnection
                .setLocalDescription(
                    offer
                );


            socket.emit(
                "offer",
                {
                    target:
                        target,

                    offer:
                        offer
                }
            );

        } catch (error) {

            console.error(
                "Call accepted error:",
                error
            );
        }
    }
);


// ======================================================
// OFFER
// ======================================================

socket.on(
    "offer",
    async data => {

        try {

            const sender =
                data.from ||
                data.sender ||
                data.socketId;


            if (!localStream) {

                const stream =
                    await startCamera();

                if (!stream) {
                    return;
                }
            }


            createPeerConnection(
                sender
            );


            await peerConnection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        data.offer
                    )
                );


            const answer =
                await peerConnection
                    .createAnswer();


            await peerConnection
                .setLocalDescription(
                    answer
                );


            socket.emit(
                "answer",
                {
                    target:
                        sender,

                    answer:
                        answer
                }
            );

        } catch (error) {

            console.error(
                "Offer error:",
                error
            );
        }
    }
);


// ======================================================
// ANSWER
// ======================================================

socket.on(
    "answer",
    async data => {

        try {

            if (!peerConnection) {
                return;
            }


            await peerConnection
                .setRemoteDescription(
                    new RTCSessionDescription(
                        data.answer
                    )
                );


            console.log(
                "Remote answer set"
            );

        } catch (error) {

            console.error(
                "Answer error:",
                error
            );
        }
    }
);


// ======================================================
// ICE CANDIDATE
// ======================================================

socket.on(
    "ice-candidate",
    async data => {

        try {

            if (
                !peerConnection ||
                !data.candidate
            ) {
                return;
            }


            await peerConnection
                .addIceCandidate(
                    new RTCIceCandidate(
                        data.candidate
                    )
                );

        } catch (error) {

            console.error(
                "ICE error:",
                error
            );
        }
    }
);


// ======================================================
// CALL REJECTED
// ======================================================

socket.on(
    "call-rejected",
    () => {

        alert(
            "Call reject kar diya gaya."
        );
    }
);


// ======================================================
// END CALL
// ======================================================

function endCall() {

    console.log(
        "Ending call..."
    );


    if (peerConnection) {

        try {
            peerConnection.close();
        } catch (e) {}

        peerConnection =
            null;
    }


    if (localStream) {

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


    if (remoteVideo) {

        remoteVideo.srcObject =
            null;
    }


    targetRoom =
        "";


    pendingCaller =
        null;


    if (incomingCallBox) {

        incomingCallBox.style.display =
            "none";
    }


    // IMPORTANT:
    // Restore permanent Room ID
    joinOwnRoom();


    console.log(
        "Call ended. Permanent room restored."
    );
}


if (endCallBtn) {

    endCallBtn.addEventListener(
        "click",
        () => {

            socket.emit(
                "end-call",
                {
                    target:
                        targetRoom
                }
            );

            endCall();
        }
    );
}


// ======================================================
// REMOTE END CALL
// ======================================================

socket.on(
    "call-ended",
    () => {

        endCall();

        alert(
            "Call ended."
        );
    }
);


// ======================================================
// PAGE LOAD
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        showPermanentRoom();

        console.log(
            "Permanent Room:",
            getPermanentRoomCode()
        );
    }
);


// ======================================================
// SERVICE WORKER
// ======================================================

async function registerServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {
        return null;
    }


    try {

        const registration =
            await navigator.serviceWorker.register(
                "/sw.js"
            );

        console.log(
            "Service Worker registered"
        );

        return registration;

    } catch (error) {

        console.error(
            "Service Worker error:",
            error
        );

        return null;
    }
}


// ======================================================
// PUSH NOTIFICATION
// ======================================================

async function enablePushNotifications() {

    try {

        if (
            !("Notification" in window)
        ) {

            console.log(
                "Notifications not supported"
            );

            return;
        }


        if (
            !("serviceWorker" in navigator)
        ) {
            return;
        }


        const registration =
            await registerServiceWorker();


        if (!registration) {
            return;
        }


        const permission =
            await Notification.requestPermission();


        if (
            permission !== "granted"
        ) {

            console.log(
                "Notification permission denied"
            );

            return;
        }


        const response =
            await fetch(
                "/api/vapid-public-key"
            );


        if (!response.ok) {

            throw new Error(
                "VAPID key API failed: " +
                response.status
            );
        }


        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            !contentType.includes(
                "application/json"
            )
        ) {

            throw new Error(
                "Server returned non-JSON response"
            );
        }


        const data =
            await response.json();


        if (
            !data.publicKey
        ) {

            throw new Error(
                "VAPID public key missing"
            );
        }


        let subscription =
            await registration.pushManager
                .getSubscription();


        if (!subscription) {

            subscription =
                await registration.pushManager
                    .subscribe(
                        {
                            userVisibleOnly:
                                true,

                            applicationServerKey:
                                urlBase64ToUint8Array(
                                    data.publicKey
                                )
                        }
                    );
        }


        const saveResponse =
            await fetch(
                "/api/subscribe",
                {
                    method:
                        "POST",

                    headers:
                        {
                            "Content-Type":
                                "application/json"
                        },

                    body:
                        JSON.stringify(
                            {
                                room:
                                    getPermanentRoomCode(),

                                subscription:
                                    subscription
                            }
                        )
                }
            );


        if (!saveResponse.ok) {

            throw new Error(
                "Subscription save failed"
            );
        }


        console.log(
            "Push notification enabled"
        );

    } catch (error) {

        console.error(
            "Push notification error:",
            error
        );
    }
}


// ======================================================
// BASE64 → UINT8ARRAY
// ======================================================

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (4 -
                (base64String.length %
                    4)) %
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
        window.atob(base64);


    return Uint8Array.from(
        [...rawData].map(
            char =>
                char.charCodeAt(0)
        )
    );
}


// ======================================================
// ENABLE PUSH ON PAGE LOAD
// ======================================================

window.addEventListener(
    "load",
    () => {

        setTimeout(
            () => {

                enablePushNotifications();

            },
            1500
        );
    }
);

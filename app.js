const socket = io();

let roomCode = "";
let localStream = null;
let currentFacingMode = "user";
let isMuted = false;
let scannerInstance = null;

const peers = {};

const roomInput = document.getElementById("roomInput");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const scanBtn = document.getElementById("scanBtn");

const qrBox = document.getElementById("qrBox");
const qrCode = document.getElementById("qrcode");
const scanner = document.getElementById("scanner");
const status = document.getElementById("status");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");
const endBtn = document.getElementById("endBtn");


// ======================================================
// WEBRTC
// ======================================================

const rtcConfig = {
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
// STATUS
// ======================================================

function setStatus(message) {
    if (status) {
        status.textContent = message;
    }
}


// ======================================================
// PERMANENT ROOM CODE
// ======================================================

function getPermanentRoomCode() {

    let saved = localStorage.getItem(
        "roushanPermanentRoom"
    );

    if (saved) {
        return saved;
    }

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[
            Math.floor(
                Math.random() * chars.length
            )
        ];
    }

    localStorage.setItem(
        "roushanPermanentRoom",
        code
    );

    return code;
}


// ======================================================
// SHOW PERMANENT ROOM
// ======================================================

function showPermanentRoom() {

    roomCode = getPermanentRoomCode();

    roomInput.value = roomCode;

    roomInput.readOnly = true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );
}

showPermanentRoom();


// ======================================================
// CREATE ROOM
// ======================================================

createBtn.addEventListener(
    "click",
    async () => {

        roomCode =
            getPermanentRoomCode();

        roomInput.value =
            roomCode;

        roomInput.readOnly =
            true;

        roomInput.setAttribute(
            "readonly",
            "readonly"
        );

        // CREATE QR
        createQRCode(roomCode);

        // JOIN OWN ROOM
        joinRoom(roomCode);

        setStatus(
            "Room ready. QR code scan karo."
        );
    }
);


// ======================================================
// CREATE QR CODE
// ======================================================

function createQRCode(code) {

    if (!qrCode || !qrBox) {
        console.error(
            "QR elements missing"
        );
        return;
    }

    qrCode.innerHTML = "";

    const joinUrl =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(code);

    if (
        typeof QRCode === "undefined"
    ) {

        console.error(
            "QRCode library not loaded"
        );

        alert(
            "QR Code library load nahi hui."
        );

        return;
    }

    new QRCode(
        qrCode,
        {
            text: joinUrl,
            width: 220,
            height: 220,
            correctLevel:
                QRCode.CorrectLevel.M
        }
    );

    qrBox.classList.remove(
        "hidden"
    );
}


// ======================================================
// JOIN ROOM BUTTON
// ======================================================

joinBtn.addEventListener(
    "click",
    () => {

        const ownRoom =
            getPermanentRoomCode();

        const entered =
            prompt(
                "Jis Room mein join karna hai uska Room Code enter karo:"
            );

        if (!entered) {
            return;
        }

        const code =
            entered
                .trim()
                .toUpperCase();

        if (!code) {
            return;
        }

        if (code === ownRoom) {

            alert(
                "Ye tumhara apna Room Code hai.\n" +
                "Dusre person ka Room Code enter karo."
            );

            return;
        }

        joinRoom(code);
    }
);


// ======================================================
// JOIN ROOM
// ======================================================

function joinRoom(code) {

    if (!code) {
        return;
    }

    roomCode =
        code
            .trim()
            .toUpperCase();

    roomInput.value =
        roomCode;

    roomInput.readOnly =
        true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );

    socket.emit(
        "join-room",
        {
            room: roomCode
        }
    );

    setStatus(
        "Room join ho raha hai..."
    );
}


// ======================================================
// ROOM JOINED
// ======================================================

socket.on(
    "room-joined",
    async ({
        room,
        count,
        users
    }) => {

        roomCode = room;

        roomInput.value =
            room;

        roomInput.readOnly =
            true;

        setStatus(
            `Room connected (${count}/10)`
        );

        if (!localStream) {
            await startCamera();
        }

        // Existing users
        for (
            const peerId of users
        ) {

            await createPeer(
                peerId,
                true
            );
        }
    }
);


// ======================================================
// NEW USER JOINED
// ======================================================

socket.on(
    "peer-joined",
    async ({
        peerId
    }) => {

        console.log(
            "New user:",
            peerId
        );

        if (!localStream) {
            await startCamera();
        }

        setStatus(
            "Dusra person room mein aa gaya."
        );
    }
);


// ======================================================
// SIGNAL
// ======================================================

socket.on(
    "signal",
    async ({
        sender,
        data
    }) => {

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

            // OFFER
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
                        target: sender,
                        data:
                            peer.localDescription
                    }
                );

                setStatus(
                    "Video connecting..."
                );
            }

            // ANSWER
            else if (
                data.type ===
                "answer"
            ) {

                await peer.setRemoteDescription(
                    new RTCSessionDescription(
                        data
                    )
                );

                setStatus(
                    "Video connected."
                );
            }

            // ICE
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

                        console.log(
                            "ICE error:",
                            error
                        );
                    }
                }
            }

        } catch (error) {

            console.error(
                "Signal error:",
                error
            );
        }
    }
);


// ======================================================
// CREATE PEER
// ======================================================

async function createPeer(
    peerId,
    createOffer
) {

    if (peers[peerId]) {
        return peers[peerId];
    }

    const peer =
        new RTCPeerConnection(
            rtcConfig
        );

    peers[peerId] =
        peer;

    // LOCAL TRACKS
    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    peer.addTrack(
                        track,
                        localStream
                    );
                }
            );
    }

    // ICE
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

    // REMOTE VIDEO
    peer.ontrack =
        event => {

            if (
                event.streams &&
                event.streams[0]
            ) {

                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo
                    .play()
                    .catch(
                        () => {}
                    );

                setStatus(
                    "Video connected."
                );
            }
        };

    peer.onconnectionstatechange =
        () => {

            console.log(
                "Peer:",
                peerId,
                peer.connectionState
            );
        };

    // CREATE OFFER
    if (createOffer) {

        const offer =
            await peer.createOffer();

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
    }

    return peer;
}


// ======================================================
// CAMERA BUTTON
// ======================================================

cameraBtn.addEventListener(
    "click",
    startCamera
);


// ======================================================
// START CAMERA
// ======================================================

async function startCamera() {

    try {

        const oldStream =
            localStream;

        const newStream =
            await navigator
                .mediaDevices
                .getUserMedia(
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

        localStream =
            newStream;

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


        // Replace video/audio tracks
        for (
            const peerId in peers
        ) {

            const peer =
                peers[peerId];

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


            if (
                videoSender &&
                videoTrack
            ) {

                await videoSender
                    .replaceTrack(
                        videoTrack
                    );
            }


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
                audioSender &&
                audioTrack
            ) {

                await audioSender
                    .replaceTrack(
                        audioTrack
                    );
            }
        }


        // Stop old stream
        if (oldStream) {

            oldStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }


        cameraBtn.textContent =
            "Camera Started";

        setStatus(
            "Camera started."
        );

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        alert(
            "Camera/Microphone permission allow karo.\n\n" +
            error.message
        );
    }
}


// ======================================================
// SWITCH CAMERA
// ======================================================

const switchCameraBtn =
    document.createElement(
        "button"
    );

switchCameraBtn.type =
    "button";

switchCameraBtn.textContent =
    "🔄 Switch Camera";

cameraBtn.parentNode.insertBefore(
    switchCameraBtn,
    micBtn
);


switchCameraBtn.addEventListener(
    "click",
    async () => {

        currentFacingMode =
            currentFacingMode ===
            "user"
                ? "environment"
                : "user";

        await startCamera();
    }
);


// ======================================================
// MUTE / UNMUTE MIC
// ======================================================

micBtn.addEventListener(
    "click",
    () => {

        if (!localStream) {

            alert(
                "Pehle Camera Start karo."
            );

            return;
        }

        const audioTracks =
            localStream
                .getAudioTracks();

        if (!audioTracks.length) {

            alert(
                "Microphone track nahi mila."
            );

            return;
        }

        isMuted =
            !isMuted;

        audioTracks.forEach(
            track => {

                track.enabled =
                    !isMuted;
            }
        );

        micBtn.textContent =
            isMuted
                ? "Unmute Mic"
                : "Mute Mic";

        setStatus(
            isMuted
                ? "Microphone muted."
                : "Microphone unmuted."
        );
    }
);


// ======================================================
// END CALL
// ======================================================

endBtn.addEventListener(
    "click",
    () => {

        // Close peers
        for (
            const peerId in peers
        ) {

            try {
                peers[peerId].close();
            } catch {}

            delete peers[peerId];
        }


        // Stop camera/mic
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


        localVideo.srcObject =
            null;

        remoteVideo.srcObject =
            null;


        // Leave current room
        socket.emit(
            "leave-room"
        );


        // Restore permanent room
        roomCode =
            getPermanentRoomCode();

        roomInput.value =
            roomCode;

        roomInput.readOnly =
            true;

        roomInput.setAttribute(
            "readonly",
            "readonly"
        );


        cameraBtn.textContent =
            "Start Camera";

        micBtn.textContent =
            "Mute Mic";

        isMuted =
            false;


        setStatus(
            "Call ended."
        );
    }
);


// ======================================================
// QR SCANNER
// ======================================================

scanBtn.addEventListener(
    "click",
    startScanner
);


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


    if (scannerInstance) {

        try {
            await scannerInstance.stop();
        } catch {}

        try {
            await scannerInstance.clear();
        } catch {}

        scannerInstance =
            null;
    }


    scanner.classList.remove(
        "hidden"
    );

    scanner.innerHTML =
        "";


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
                fps: 10,
                qrbox: 250
            },

            async decodedText => {

                let code =
                    decodedText;


                // QR contains URL
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
                            room;
                    }

                } catch {
                    // Plain room code
                }


                if (!code) {
                    return;
                }


                code =
                    code
                        .trim()
                        .toUpperCase();


                try {
                    await scannerInstance.stop();
                } catch {}


                try {
                    await scannerInstance.clear();
                } catch {}


                scannerInstance =
                    null;


                scanner.classList.add(
                    "hidden"
                );


                const ownRoom =
                    getPermanentRoomCode();


                if (
                    code === ownRoom
                ) {

                    alert(
                        "Ye tumhara apna Room Code hai."
                    );

                    return;
                }


                joinRoom(code);
            },

            () => {}
        );

    } catch (error) {

        console.error(
            "QR error:",
            error
        );

        scanner.classList.add(
            "hidden"
        );

        alert(
            "QR scanner camera open nahi hua.\n" +
            error.message
        );
    }
}


// ======================================================
// AUTO JOIN FROM QR URL
// ======================================================

const params =
    new URLSearchParams(
        window.location.search
    );

const roomFromUrl =
    params.get("room");


if (roomFromUrl) {

    const code =
        roomFromUrl
            .trim()
            .toUpperCase();

    roomInput.value =
        code;

    roomInput.readOnly =
        true;

    setTimeout(
        () => {

            joinRoom(code);

        },
        700
    );
}


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
            "Service Worker registered."
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
            return;
        }

        const registration =
            await registerServiceWorker();

        if (!registration) {
            return;
        }


        let permission =
            Notification.permission;


        if (
            permission ===
            "default"
        ) {

            permission =
                await Notification.requestPermission();
        }


        if (
            permission !==
            "granted"
        ) {

            console.log(
                "Notification permission:",
                permission
            );

            return;
        }


        const response =
            await fetch(
                "/api/vapid-public-key"
            );


        if (!response.ok) {

            throw new Error(
                "VAPID API error: " +
                response.status
            );
        }


        const type =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            !type.includes(
                "application/json"
            )
        ) {

            throw new Error(
                "VAPID API ne JSON nahi diya."
            );
        }


        const data =
            await response.json();


        if (!data.publicKey) {

            throw new Error(
                "Public VAPID key missing."
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


        const save =
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


        if (!save.ok) {

            throw new Error(
                "Subscription save failed."
            );
        }


        console.log(
            "Push notification enabled."
        );

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );
    }
}


// ======================================================
// BASE64 KEY CONVERTER
// ======================================================

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (
                4 -
                (
                    base64String.length %
                    4
                )
            ) % 4
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

    return Uint8Array.from(
        [...rawData].map(
            char =>
                char.charCodeAt(0)
        )
    );
}


// ======================================================
// INITIALIZE
// ======================================================

window.addEventListener(
    "load",
    () => {

        showPermanentRoom();

        setTimeout(
            () => {
                enablePushNotifications();
            },
            1500
        );
    }
);

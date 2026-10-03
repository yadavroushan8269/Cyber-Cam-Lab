const socket = io();

let roomCode = "";
let localStream = null;
let peerConnection = null;
let currentFacingMode = "user";
let isMuted = false;

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

let html5QrCode = null;


// ==========================
// WEBRTC CONFIG
// ==========================

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};


// ==========================
// STATUS
// ==========================

function setStatus(text) {
    status.textContent = text;
}


// ==========================
// ROOM CODE
// ==========================

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    for (let i = 0; i < 6; i++) {
        code += chars[
            Math.floor(Math.random() * chars.length)
        ];
    }

    return code;
}


// ==========================
// CREATE ROOM
// ==========================

createBtn.addEventListener("click", () => {

    const code = generateRoomCode();

    roomInput.value = code;

    createQRCode(code);

    joinRoom(code);

    setStatus(
        "Room created. Waiting for other phone..."
    );
});


// ==========================
// CREATE QR
// ==========================

function createQRCode(code) {

    qrCode.innerHTML = "";

    const joinUrl =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(code);

    new QRCode(qrCode, {
        text: joinUrl,
        width: 220,
        height: 220
    });

    qrBox.classList.remove("hidden");
}


// ==========================
// JOIN ROOM
// ==========================

joinBtn.addEventListener("click", () => {

    const code =
        roomInput.value.trim().toUpperCase();

    if (!code) {
        alert("Room code enter karo.");
        return;
    }

    joinRoom(code);
});


function joinRoom(code) {

    roomCode = code;

    socket.emit("join-room", {
        room: roomCode
    });

    setStatus("Joining room...");
}


// ==========================
// SOCKET CONNECT
// ==========================

socket.on("connect", () => {

    console.log("Socket connected");

});


// ==========================
// ROOM JOINED
// ==========================

socket.on("room-joined", ({ room, count }) => {

    roomCode = room;

    roomInput.value = room;

    if (count === 1) {

        setStatus(
            "Room ready. Waiting for other phone..."
        );

    } else {

        setStatus(
            "Both phones joined the room."
        );
    }
});


// ==========================
// SECOND PHONE JOINED
// ==========================

socket.on("peer-joined", async () => {

    setStatus(
        "Other phone joined. Connecting..."
    );

    if (!localStream) {
        await startCamera();
    }

    await createPeerConnection();

    const offer =
        await peerConnection.createOffer();

    await peerConnection.setLocalDescription(
        offer
    );

    socket.emit("signal", {
        room: roomCode,
        data: peerConnection.localDescription
    });
});


// ==========================
// SIGNALING
// ==========================

socket.on("signal", async (data) => {

    try {

        if (!peerConnection) {
            await createPeerConnection();
        }

        if (data.type === "offer") {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data)
            );

            if (!localStream) {
                await startCamera();
            }

            const answer =
                await peerConnection.createAnswer();

            await peerConnection.setLocalDescription(
                answer
            );

            socket.emit("signal", {
                room: roomCode,
                data: peerConnection.localDescription
            });

            setStatus("Connecting video...");

        }

        else if (data.type === "answer") {

            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(data)
            );

            setStatus("Video connected.");

        }

        else if (data.type === "candidate") {

            if (data.candidate) {

                try {

                    await peerConnection.addIceCandidate(
                        new RTCIceCandidate(
                            data.candidate
                        )
                    );

                } catch (error) {

                    console.log(
                        "ICE candidate error:",
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

        setStatus("Connection error.");
    }
});


// ==========================
// ROOM FULL
// ==========================

socket.on("room-full", () => {

    alert(
        "This room already has two phones."
    );

    setStatus("Room is full.");

});


// ==========================
// PEER LEFT
// ==========================

socket.on("peer-left", () => {

    setStatus(
        "Other phone left the call."
    );

    remoteVideo.srcObject = null;

    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;
    }
});


// ==========================
// CREATE PEER CONNECTION
// ==========================

async function createPeerConnection() {

    if (peerConnection) {
        return;
    }

    peerConnection =
        new RTCPeerConnection(
            rtcConfig
        );


    // ICE candidates
    peerConnection.onicecandidate =
        (event) => {

            if (event.candidate) {

                socket.emit("signal", {

                    room: roomCode,

                    data: {
                        type: "candidate",
                        candidate: event.candidate
                    }

                });
            }
        };


    // Remote video
    peerConnection.ontrack =
        (event) => {

            if (
                event.streams &&
                event.streams[0]
            ) {

                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo.play()
                    .catch(() => {});

                setStatus(
                    "Video connected."
                );
            }
        };


    peerConnection.onconnectionstatechange =
        () => {

            const state =
                peerConnection.connectionState;

            console.log(
                "Connection state:",
                state
            );

            if (state === "connected") {

                setStatus(
                    "Video connected."
                );

            } else if (state === "connecting") {

                setStatus(
                    "Connecting video..."
                );

            } else if (
                state === "disconnected"
            ) {

                setStatus(
                    "Video disconnected."
                );

            } else if (
                state === "failed"
            ) {

                setStatus(
                    "Connection failed."
                );
            }
        };


    // Add local tracks
    if (localStream) {

        localStream
            .getTracks()
            .forEach((track) => {

                peerConnection.addTrack(
                    track,
                    localStream
                );

            });
    }
}


// ==========================
// START CAMERA
// ==========================

cameraBtn.addEventListener(
    "click",
    startCamera
);


async function startCamera() {

    try {

        const oldStream =
            localStream;


        const newStream =
            await navigator.mediaDevices.getUserMedia({

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

            });


        localStream =
            newStream;


        // Show local video
        localVideo.srcObject =
            localStream;

        localVideo.muted = true;

        localVideo.playsInline = true;

        await localVideo.play()
            .catch(() => {});


        // If peer already exists,
        // replace old tracks.
        if (peerConnection) {

            const newVideoTrack =
                localStream.getVideoTracks()[0];

            const videoSender =
                peerConnection
                    .getSenders()
                    .find(
                        sender =>
                            sender.track &&
                            sender.track.kind ===
                            "video"
                    );

            if (
                videoSender &&
                newVideoTrack
            ) {

                await videoSender.replaceTrack(
                    newVideoTrack
                );
            }


            const newAudioTrack =
                localStream.getAudioTracks()[0];

            const audioSender =
                peerConnection
                    .getSenders()
                    .find(
                        sender =>
                            sender.track &&
                            sender.track.kind ===
                            "audio"
                    );

            if (
                audioSender &&
                newAudioTrack
            ) {

                await audioSender.replaceTrack(
                    newAudioTrack
                );
            }

        }


        // Stop previous camera
        if (oldStream) {

            oldStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });
        }


        cameraBtn.textContent =
            "Camera Started";

        setStatus(
            "Camera started."
        );


        // If peer already joined,
        // make sure connection has tracks.
        if (
            roomCode &&
            !peerConnection
        ) {

            await createPeerConnection();
        }


    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        if (
            error.name ===
            "NotAllowedError"
        ) {

            alert(
                "Camera aur microphone permission Allow karo."
            );

        } else if (
            error.name ===
            "NotFoundError"
        ) {

            alert(
                "Camera nahi mila."
            );

        } else if (
            error.name ===
            "NotReadableError"
        ) {

            alert(
                "Camera kisi doosre app mein use ho raha hai."
            );

        } else {

            alert(
                "Camera start nahi hua:\n" +
                error.message
            );
        }
    }
}


// ==========================
// SWITCH CAMERA BUTTON
// ==========================

const switchCameraBtn =
    document.createElement("button");

switchCameraBtn.id =
    "switchCameraBtn";

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
    switchCamera
);


async function switchCamera() {

    if (!localStream) {

        await startCamera();

        return;
    }


    currentFacingMode =
        currentFacingMode === "user"
            ? "environment"
            : "user";


    await startCamera();


    setStatus(
        currentFacingMode === "user"
            ? "Front camera active."
            : "Back camera active."
    );
}


// ==========================
// MUTE / UNMUTE MIC
// ==========================

micBtn.addEventListener(
    "click",
    toggleMic
);


function toggleMic() {

    if (!localStream) {

        alert(
            "Pehle camera start karo."
        );

        return;
    }


    const audioTracks =
        localStream.getAudioTracks();


    if (audioTracks.length === 0) {

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
}


// ==========================
// END CALL
// ==========================

endBtn.addEventListener(
    "click",
    endCall
);


function endCall() {

    if (peerConnection) {

        peerConnection.close();

        peerConnection = null;
    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });

        localStream = null;
    }


    localVideo.srcObject = null;

    remoteVideo.srcObject = null;


    if (roomCode) {

        socket.emit(
            "leave-room"
        );
    }


    isMuted = false;

    micBtn.textContent =
        "Mute Mic";

    cameraBtn.textContent =
        "Start Camera";


    setStatus(
        "Call ended."
    );
}


// ==========================
// QR SCANNER
// ==========================

scanBtn.addEventListener(
    "click",
    startQRScanner
);


async function startQRScanner() {

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        alert(
            "QR scanner load nahi hua. Internet check karo."
        );

        return;
    }


    scanner.classList.remove(
        "hidden"
    );


    scanner.innerHTML = "";


    html5QrCode =
        new Html5Qrcode(
            "scanner"
        );


    try {

        await html5QrCode.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,
                qrbox: 250
            },

            async (decodedText) => {

                console.log(
                    "QR:",
                    decodedText
                );


                let code = null;


                // QR contains our website URL
                try {

                    const url =
                        new URL(
                            decodedText
                        );

                    code =
                        url.searchParams.get(
                            "room"
                        );

                } catch (error) {

                    // If QR directly contains
                    // room code
                    code =
                        decodedText;
                }


                if (!code) {
                    return;
                }


                code =
                    code.trim()
                        .toUpperCase();


                try {

                    await html5QrCode.stop();

                    html5QrCode.clear();

                } catch (error) {

                    console.log(
                        "Scanner stop:",
                        error
                    );
                }


                scanner.classList.add(
                    "hidden"
                );


                roomInput.value =
                    code;


                joinRoom(code);

            },

            () => {
                // QR not detected yet
            }

        );

        setStatus(
            "Point camera at QR code."
        );


    } catch (error) {

        console.error(
            "QR scanner error:",
            error
        );

        scanner.classList.add(
            "hidden"
        );

        alert(
            "QR scanner camera open nahi hua."
        );
    }
}


// ==========================
// AUTO JOIN FROM QR URL
// ==========================

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const roomFromURL =
    urlParams.get("room");


if (roomFromURL) {

    const code =
        roomFromURL
            .trim()
            .toUpperCase();


    roomInput.value =
        code;


    setTimeout(() => {

        joinRoom(code);

    }, 500);
}

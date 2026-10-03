const socket = io();

let roomCode = "";
let localStream = null;
let currentFacingMode = "user";
let isMuted = false;

// One connection for each other user
const peers = {};

const roomInput =
    document.getElementById("roomInput");

const createBtn =
    document.getElementById("createBtn");

const joinBtn =
    document.getElementById("joinBtn");

const scanBtn =
    document.getElementById("scanBtn");

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

const micBtn =
    document.getElementById("micBtn");

const endBtn =
    document.getElementById("endBtn");


// ===============================
// WEBRTC
// ===============================

const rtcConfig = {

    iceServers: [
        {
            urls:
                "stun:stun.l.google.com:19302"
        }
    ]
};


// ===============================
// PERMANENT ROOM CODE
// ===============================

function getPermanentRoomCode() {

    let saved =
        localStorage.getItem(
            "roushanPermanentRoom"
        );

    if (saved) {
        return saved;
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


// ===============================
// SHOW PERMANENT CODE
// ===============================

function showPermanentRoom() {

    roomCode =
        getPermanentRoomCode();

    roomInput.value =
        roomCode;

    // Prevent editing
    roomInput.readOnly = true;

    roomInput.setAttribute(
        "readonly",
        "readonly"
    );
}


// Automatically show code
showPermanentRoom();


// ===============================
// CREATE ROOM
// ===============================

createBtn.addEventListener(
    "click",
    () => {

        // NEVER generate a new code
        roomCode =
            getPermanentRoomCode();

        roomInput.value =
            roomCode;

        roomInput.readOnly =
            true;

        createQRCode(
            roomCode
        );

        joinRoom(
            roomCode
        );
    }
);


// ===============================
// QR CODE
// ===============================

function createQRCode(code) {

    qrCode.innerHTML = "";

    const joinUrl =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(code);


    new QRCode(
        qrCode,
        {
            text: joinUrl,
            width: 220,
            height: 220
        }
    );


    qrBox.classList.remove(
        "hidden"
    );
}


// ===============================
// JOIN ROOM
// ===============================

joinBtn.addEventListener(
    "click",
    () => {

        const code =
            roomInput.value
                .trim()
                .toUpperCase();


        if (!code) {

            alert(
                "Room code nahi mila."
            );

            return;
        }


        joinRoom(code);
    }
);


function joinRoom(code) {

    roomCode =
        code
            .trim()
            .toUpperCase();


    roomInput.value =
        roomCode;

    roomInput.readOnly =
        true;


    socket.emit(
        "join-room",
        {
            room: roomCode
        }
    );


    setStatus(
        "Joining room..."
    );
}


// ===============================
// STATUS
// ===============================

function setStatus(text) {

    status.textContent =
        text;
}


// ===============================
// ROOM JOINED
// ===============================

socket.on(
    "room-joined",
    async ({
        room,
        count,
        users
    }) => {

        roomCode =
            room;

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


        // Create connection to every
        // existing user
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


// ===============================
// NEW USER JOINED
// ===============================

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


        // Existing user waits for the
        // new user to send the offer.
        //
        // No offer needed here.
        setStatus(
            "New person joined the room."
        );
    }
);


// ===============================
// SIGNAL
// ===============================

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
                    "Connecting video..."
                );
            }


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


// ===============================
// CREATE PEER
// ===============================

async function createPeer(
    peerId,
    createOffer
) {

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


    // ===========================
    // LOCAL TRACKS
    // ===========================

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


    // ===========================
    // ICE
    // ===========================

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


    // ===========================
    // REMOTE VIDEO
    // ===========================

    peer.ontrack =
        event => {

            if (
                event.streams &&
                event.streams[0]
            ) {

                remoteVideo.srcObject =
                    event.streams[0];

                remoteVideo.play()
                    .catch(
                        () => {}
                    );


                setStatus(
                    "Video connected."
                );
            }
        };


    // ===========================
    // CONNECTION STATE
    // ===========================

    peer.onconnectionstatechange =
        () => {

            console.log(
                peerId,
                peer.connectionState
            );
        };


    // ===========================
    // OFFER
    // ===========================

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


// ===============================
// START CAMERA
// ===============================

cameraBtn.addEventListener(
    "click",
    startCamera
);


async function startCamera() {

    try {

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


        localVideo.srcObject =
            localStream;


        localVideo.muted =
            true;


        await localVideo
            .play()
            .catch(
                () => {}
            );


        // Replace tracks in all peers
        for (
            const peerId in peers
        ) {

            const peer =
                peers[peerId];


            const videoTrack =
                localStream
                    .getVideoTracks()[0];


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


            const audioTrack =
                localStream
                    .getAudioTracks()[0];


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
            error
        );


        alert(
            "Camera start nahi hua:\n" +
            error.message
        );
    }
}


// ===============================
// SWITCH CAMERA
// ===============================

const switchCameraBtn =
    document.createElement(
        "button"
    );


switchCameraBtn.textContent =
    "🔄 Switch Camera";


switchCameraBtn.type =
    "button";


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


// ===============================
// MIC
// ===============================

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


        if (!tracks.length) {
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
                ? "Unmute Mic"
                : "Mute Mic";
    }
);


// ===============================
// END CALL
// ===============================

endBtn.addEventListener(
    "click",
    () => {

        for (
            const peerId in peers
        ) {

            peers[peerId].close();

            delete peers[peerId];
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


        localVideo.srcObject =
            null;

        remoteVideo.srcObject =
            null;


        socket.emit(
            "leave-room"
        );


        cameraBtn.textContent =
            "Start Camera";


        micBtn.textContent =
            "Mute Mic";


        setStatus(
            "Call ended."
        );
    }
);


// ===============================
// QR SCANNER
// ===============================

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


    scanner.classList.remove(
        "hidden"
    );


    scanner.innerHTML =
        "";


    const qr =
        new Html5Qrcode(
            "scanner"
        );


    try {

        await qr.start(

            {
                facingMode:
                    "environment"
            },

            {
                fps: 10,
                qrbox: 250
            },

            async decodedText => {

                let code = null;


                try {

                    const url =
                        new URL(
                            decodedText
                        );

                    code =
                        url.searchParams.get(
                            "room"
                        );

                } catch {

                    code =
                        decodedText;
                }


                if (!code) {
                    return;
                }


                try {

                    await qr.stop();

                    await qr.clear();

                } catch {}


                scanner.classList.add(
                    "hidden"
                );


                roomInput.value =
                    code.toUpperCase();


                joinRoom(
                    code
                );
            },

            () => {}

        );


    } catch (error) {

        console.error(
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


// ===============================
// AUTO JOIN QR LINK
// ===============================

const params =
    new URLSearchParams(
        window.location.search
    );


const roomFromUrl =
    params.get("room");


if (roomFromUrl) {

    roomInput.value =
        roomFromUrl
            .toUpperCase();


    // QR se aaye user ko
    // readonly permanent code nahi banana
    roomInput.readOnly =
        true;


    setTimeout(
        () => {

            joinRoom(
                roomFromUrl
            );

        },
        500
    );
}

const socket = io();

let roomCode = "";
let localStream = null;
let currentFacingMode = "user";
let isMuted = false;

let currentCallTarget = null;
let incomingCallerId = null;

// One peer only because room has 2 users
const peers = {};


// ===============================
// ELEMENTS
// ===============================

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
// PERMANENT ROOM ID
// ===============================

function getPermanentRoomCode() {

    let saved =
        localStorage.getItem(
            "roushanPermanentRoom"
        );


    if (saved) {

        return saved
            .trim()
            .toUpperCase();
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
// SHOW MY PERMANENT ROOM
// ===============================

function showPermanentRoom() {

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


    roomInput.placeholder =
        "Your Room ID";
}


showPermanentRoom();


// ===============================
// CREATE / SHOW QR
// ===============================

createBtn.addEventListener(
    "click",
    async () => {

        roomCode =
            getPermanentRoomCode();


        roomInput.value =
            roomCode;


        roomInput.readOnly =
            true;


        createQRCode(
            roomCode
        );


        // Join own permanent room
        await joinOwnRoom();


        setStatus(
            "Your Room ID is ready. Share it with the other person."
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
            text:
                joinUrl,

            width:
                220,

            height:
                220
        }
    );


    qrBox.classList.remove(
        "hidden"
    );
}


// ===============================
// JOIN BUTTON = CALL
// ===============================

joinBtn.addEventListener(
    "click",
    async () => {

        const targetRoom =
            prompt(
                "Jise call karna hai uski Room ID enter karo:"
            );


        if (!targetRoom) {
            return;
        }


        const code =
            targetRoom
                .trim()
                .toUpperCase();


        if (
            code.length < 4
        ) {

            alert(
                "Valid Room ID enter karo."
            );

            return;
        }


        if (
            code ===
            getPermanentRoomCode()
        ) {

            alert(
                "Apni Room ID par call nahi kar sakte."
            );

            return;
        }


        // Make sure caller is
        // connected to own room
        await joinOwnRoom();


        // Send call request
        currentCallTarget =
            code;


        socket.emit(
            "call-user",
            {
                room:
                    code
            }
        );


        setStatus(
            "Calling " + code + "..."
        );
    }
);


// ===============================
// JOIN MY OWN ROOM
// ===============================

async function joinOwnRoom() {

    const myRoom =
        getPermanentRoomCode();


    roomCode =
        myRoom;


    roomInput.value =
        myRoom;


    roomInput.readOnly =
        true;


    if (
        socket.connected &&
        socket.__joinedRoom === myRoom
    ) {

        return;
    }


    socket.emit(
        "join-room",
        {
            room:
                myRoom
        }
    );


    socket.__joinedRoom =
        myRoom;
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
    ({
        room,
        count
    }) => {

        roomCode =
            room;


        roomInput.value =
            room;


        roomInput.readOnly =
            true;


        setStatus(
            `Your room is ready (${count}/2)`
        );
    }
);


// ===============================
// ROOM FULL
// ===============================

socket.on(
    "room-full",
    () => {

        setStatus(
            "Room full hai."
        );


        alert(
            "Is Room ID par already 2 users connected hain."
        );
    }
);


// ===============================
// CALL RINGING
// ===============================

socket.on(
    "call-ringing",
    () => {

        setStatus(
            "Calling... receiver ke Accept karne ka wait hai."
        );
    }
);


// ===============================
// CALL UNAVAILABLE
// ===============================

socket.on(
    "call-unavailable",
    ({
        room
    }) => {

        currentCallTarget =
            null;


        setStatus(
            "User online nahi hai."
        );


        alert(
            `Room ${room} mein abhi koi available nahi hai.`
        );
    }
);


// ===============================
// INCOMING CALL UI
// ===============================

function showIncomingCall(
    callerId,
    callerRoom
) {

    incomingCallerId =
        callerId;


    // Existing overlay remove
    const old =
        document.getElementById(
            "incomingCallOverlay"
        );


    if (old) {
        old.remove();
    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "incomingCallOverlay";


    overlay.style.position =
        "fixed";

    overlay.style.inset =
        "0";

    overlay.style.zIndex =
        "999999";

    overlay.style.background =
        "#111827";

    overlay.style.display =
        "flex";

    overlay.style.flexDirection =
        "column";

    overlay.style.alignItems =
        "center";

    overlay.style.justifyContent =
        "center";

    overlay.style.padding =
        "30px";

    overlay.style.color =
        "white";

    overlay.style.textAlign =
        "center";


    overlay.innerHTML = `

        <div style="
            width:90px;
            height:90px;
            border-radius:50%;
            background:#374151;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:42px;
            margin-bottom:25px;
        ">
            📹
        </div>

        <h1 style="
            margin:0 0 10px;
            font-size:30px;
        ">
            Incoming Video Call
        </h1>

        <p style="
            margin:0 0 8px;
            font-size:18px;
        ">
            Someone is calling you
        </p>

        <p style="
            margin:0 0 45px;
            opacity:.7;
            font-size:14px;
        ">
            Room: ${callerRoom || "Unknown"}
        </p>

        <div style="
            display:flex;
            gap:18px;
            width:100%;
            max-width:420px;
        ">

            <button id="rejectCallBtn"
                style="
                    flex:1;
                    border:0;
                    border-radius:14px;
                    padding:18px 10px;
                    font-size:18px;
                    font-weight:bold;
                    background:#dc2626;
                    color:white;
                ">
                ✕ Reject
            </button>

            <button id="acceptCallBtn"
                style="
                    flex:1;
                    border:0;
                    border-radius:14px;
                    padding:18px 10px;
                    font-size:18px;
                    font-weight:bold;
                    background:#16a34a;
                    color:white;
                ">
                ✓ Accept
            </button>

        </div>
    `;


    document.body.appendChild(
        overlay
    );


    document
        .getElementById(
            "acceptCallBtn"
        )
        .addEventListener(
            "click",
            acceptIncomingCall
        );


    document
        .getElementById(
            "rejectCallBtn"
        )
        .addEventListener(
            "click",
            rejectIncomingCall
        );
}


// ===============================
// INCOMING CALL EVENT
// ===============================

socket.on(
    "incoming-call",
    ({
        callerId,
        callerRoom
    }) => {

        showIncomingCall(
            callerId,
            callerRoom
        );
    }
);


// ===============================
// ACCEPT
// ===============================

async function acceptIncomingCall() {

    const callerId =
        incomingCallerId;


    if (!callerId) {
        return;
    }


    removeIncomingCall();


    // Start camera only after
    // accepting the call
    if (!localStream) {

        await startCamera();
    }


    socket.emit(
        "accept-call",
        {
            callerId:
                callerId
        }
    );


    setStatus(
        "Call accepted. Connecting..."
    );
}


// ===============================
// REJECT
// ===============================

function rejectIncomingCall() {

    const callerId =
        incomingCallerId;


    if (callerId) {

        socket.emit(
            "reject-call",
            {
                callerId:
                    callerId
            }
        );
    }


    removeIncomingCall();


    incomingCallerId =
        null;


    setStatus(
        "Call rejected."
    );
}


// ===============================
// REMOVE CALL UI
// ===============================

function removeIncomingCall() {

    const overlay =
        document.getElementById(
            "incomingCallOverlay"
        );


    if (overlay) {
        overlay.remove();
    }
}


// ===============================
// CALL ACCEPTED
// ===============================

socket.on(
    "call-accepted",
    async ({
        target
    }) => {

        currentCallTarget =
            target;


        // Start camera now
        if (!localStream) {

            await startCamera();
        }


        // Caller creates offer
        await createPeer(
            target,
            true
        );


        setStatus(
            "Call accepted. Connecting video..."
        );
    }
);


// ===============================
// CALL REJECTED
// ===============================

socket.on(
    "call-rejected",
    () => {

        currentCallTarget =
            null;


        setStatus(
            "Call rejected."
        );


        alert(
            "Receiver ne call reject kar diya."
        );
    }
);


// ===============================
// WEBRTC SIGNAL
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
                        target:
                            sender,

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

                    } catch (
                        error
                    ) {

                        console.log(
                            "ICE error:",
                            error
                        );
                    }
                }
            }

        } catch (
            error
        ) {

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


    // CONNECTION STATE
    peer.onconnectionstatechange =
        () => {

            console.log(
                peerId,
                peer.connectionState
            );


            if (
                peer.connectionState ===
                "connected"
            ) {

                setStatus(
                    "Video connected."
                );
            }


            if (
                peer.connectionState ===
                "failed"
            ) {

                setStatus(
                    "Connection failed."
                );
            }
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


        // Replace existing tracks
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

    } catch (
        error
    ) {

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
                "Pehle call accept karo ya camera start karo."
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


        currentCallTarget =
            null;

        incomingCallerId =
            null;


        removeIncomingCall();


        socket.emit(
            "leave-room"
        );


        socket.__joinedRoom =
            null;


        cameraBtn.textContent =
            "Start Camera";


        micBtn.textContent =
            "Mute Mic";


        setStatus(
            "Call ended."
        );


        // Rejoin own permanent room
        setTimeout(
            () => {

                joinOwnRoom();

            },
            500
        );
    }
);


// ===============================
// PEER LEFT
// ===============================

socket.on(
    "peer-left",
    ({
        peerId
    }) => {

        if (
            peers[peerId]
        ) {

            peers[peerId].close();

            delete peers[peerId];
        }


        remoteVideo.srcObject =
            null;


        setStatus(
            "Other person left the call."
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
                fps:
                    10,

                qrbox:
                    250
            },

            async decodedText => {

                let code =
                    null;


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


                const targetRoom =
                    code
                        .trim()
                        .toUpperCase();


                // QR owner ki room ko
                // apni permanent ID se replace
                // nahi karna.
                //
                // QR scan = call that user.

                if (
                    targetRoom ===
                    getPermanentRoomCode()
                ) {

                    alert(
                        "Ye aapki khud ki Room ID hai."
                    );

                    return;
                }


                await joinOwnRoom();


                currentCallTarget =
                    targetRoom;


                socket.emit(
                    "call-user",
                    {
                        room:
                            targetRoom
                    }
                );


                setStatus(
                    "Calling " +
                    targetRoom +
                    "..."
                );
            },

            () => {}
        );

    } catch (
        error
    ) {

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
// AUTO QR LINK
// ===============================

const params =
    new URLSearchParams(
        window.location.search
    );


const roomFromUrl =
    params.get("room");


if (roomFromUrl) {

    const targetRoom =
        roomFromUrl
            .trim()
            .toUpperCase();


    // QR link se aane par
    // apni permanent Room ID
    // change nahi hogi.

    if (
        targetRoom !==
        getPermanentRoomCode()
    ) {

        setTimeout(
            async () => {

                await joinOwnRoom();


                currentCallTarget =
                    targetRoom;


                socket.emit(
                    "call-user",
                    {
                        room:
                            targetRoom
                    }
                );


                setStatus(
                    "Calling " +
                    targetRoom +
                    "..."
                );

            },
            700
        );
    }
}

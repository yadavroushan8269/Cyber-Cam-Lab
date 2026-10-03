const socket = io();


// ============================================
// GLOBAL VARIABLES
// ============================================

let roomCode = "";
let localStream = null;
let currentFacingMode = "user";
let isMuted = false;

let incomingCallerId = null;
let incomingCallerRoom = null;

let callInProgress = false;

// WebRTC peers
const peers = {};


// ============================================
// HTML ELEMENTS
// ============================================

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

const notificationBtn =
    document.getElementById("notificationBtn");

const incomingCallOverlay =
    document.getElementById("incomingCallOverlay");

const incomingCallerText =
    document.getElementById("incomingCallerText");

const acceptCallBtn =
    document.getElementById("acceptCallBtn");

const rejectCallBtn =
    document.getElementById("rejectCallBtn");


// ============================================
// WEBRTC CONFIG
// ============================================

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};


// ============================================
// PERMANENT ROOM ID
// ============================================

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

    for (let i = 0; i < 6; i++) {

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


// ============================================
// SHOW OWN ROOM ID
// ============================================

function showPermanentRoom() {

    roomCode =
        getPermanentRoomCode();

    roomInput.value =
        roomCode;

    /*
     * IMPORTANT:
     * Do NOT make the input permanently readonly.
     * Join Room needs to accept another room code.
     */
}


// ============================================
// AUTO REGISTER OWN ROOM
// ============================================

function joinOwnRoom() {

    const ownRoom =
        getPermanentRoomCode();

    roomCode =
        ownRoom;

    roomInput.value =
        ownRoom;

    socket.emit(
        "join-room",
        {
            room: ownRoom
        }
    );
}


showPermanentRoom();


// ============================================
// SOCKET CONNECT
// ============================================

socket.on(
    "connect",
    () => {

        console.log(
            "Socket connected:",
            socket.id
        );

        setTimeout(
            () => {
                joinOwnRoom();
            },
            300
        );
    }
);


// ============================================
// STATUS
// ============================================

function setStatus(text) {

    if (status) {
        status.textContent =
            text;
    }
}


// ============================================
// CREATE ROOM / QR
// ============================================

createBtn.addEventListener(
    "click",
    () => {

        const ownRoom =
            getPermanentRoomCode();

        roomCode =
            ownRoom;

        roomInput.value =
            ownRoom;

        createQRCode(
            ownRoom
        );

        joinOwnRoom();

        setStatus(
            "Your room is ready."
        );
    }
);


// ============================================
// CREATE QR CODE
// ============================================

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


// ============================================
// JOIN ROOM BUTTON
// ============================================

joinBtn.addEventListener(
    "click",
    () => {

        /*
         * If roomInput already contains another room
         * code, use it.
         *
         * Otherwise ask for room code.
         */

        let enteredCode =
            roomInput.value
                .trim()
                .toUpperCase();

        const ownRoom =
            getPermanentRoomCode();


        /*
         * Since own room is shown by default,
         * ask for target room when Join is clicked.
         */

        if (
            !enteredCode ||
            enteredCode === ownRoom
        ) {

            enteredCode =
                prompt(
                    "Jis Room mein join karna hai uska Room Code enter karo:"
                );
        }


        if (!enteredCode) {
            return;
        }


        const code =
            enteredCode
                .trim()
                .toUpperCase();


        if (!code) {

            alert(
                "Room Code enter karo."
            );

            return;
        }


        if (
            code === ownRoom
        ) {

            alert(
                "Ye tumhara apna Room Code hai.\nDusre person ka Room Code enter karo."
            );

            return;
        }


        roomCode =
            code;

        roomInput.value =
            code;


        setStatus(
            "Calling Room " +
            code +
            "..."
        );


        joinTargetRoom(
            code
        );
    }
);


// ============================================
// JOIN TARGET ROOM
// ============================================

function joinTargetRoom(code) {

    const targetRoom =
        code
            .trim()
            .toUpperCase();

    if (!targetRoom) {
        return;
    }

    roomCode =
        targetRoom;

    roomInput.value =
        targetRoom;

    setStatus(
        "Calling Room " +
        targetRoom +
        "..."
    );

    socket.emit(
        "call-user",
        {
            room:
                targetRoom
        }
    );
}


// ============================================
// ROOM JOINED
// ============================================

socket.on(
    "room-joined",
    async ({
        room,
        count
    }) => {

        console.log(
            "Room joined:",
            room,
            count
        );


        if (
            room ===
            getPermanentRoomCode()
        ) {

            roomCode =
                room;

            roomInput.value =
                room;

            setStatus(
                "Your Room is online."
            );

            return;
        }


        setStatus(
            `Room connected (${count}/2)`
        );


        if (!localStream) {

            await startCamera();
        }
    }
);


// ============================================
// ROOM FULL
// ============================================

socket.on(
    "room-full",
    () => {

        setStatus(
            "Room is full."
        );

        alert(
            "Is room mein already 2 people connected hain."
        );
    }
);


// ============================================
// CALL RINGING
// ============================================

socket.on(
    "call-ringing",
    ({
        room
    }) => {

        setStatus(
            "Calling Room " +
            room +
            "..."
        );
    }
);


// ============================================
// CALL UNAVAILABLE
// ============================================

socket.on(
    "call-unavailable",
    ({
        room
    }) => {

        setStatus(
            "Room " +
            room +
            " is not available."
        );

        alert(
            "Ye Room ID abhi available nahi hai."
        );
    }
);


// ============================================
// INCOMING CALL
// ============================================

socket.on(
    "incoming-call",
    ({
        callerId,
        callerRoom,
        targetRoom
    }) => {

        incomingCallerId =
            callerId;

        incomingCallerRoom =
            callerRoom;

        console.log(
            "Incoming call:",
            callerId
        );

        incomingCallerText.textContent =
            callerRoom
                ? `Room ${callerRoom} is calling you`
                : "Someone is calling you";

        incomingCallOverlay.classList.remove(
            "hidden"
        );

        setStatus(
            "Incoming video call..."
        );
    }
);


// ============================================
// ACCEPT CALL
// ============================================

acceptCallBtn.addEventListener(
    "click",
    async () => {

        if (!incomingCallerId) {
            return;
        }

        const caller =
            incomingCallerId;

        hideIncomingCall();

        try {

            await startCamera();

        } catch (error) {

            console.error(
                error
            );

            return;
        }

        socket.emit(
            "accept-call",
            {
                callerId:
                    caller
            }
        );

        callInProgress =
            true;

        setStatus(
            "Call accepted. Connecting..."
        );
    }
);


// ============================================
// REJECT CALL
// ============================================

rejectCallBtn.addEventListener(
    "click",
    () => {

        if (
            incomingCallerId
        ) {

            socket.emit(
                "reject-call",
                {
                    callerId:
                        incomingCallerId
                }
            );
        }

        hideIncomingCall();

        setStatus(
            "Call rejected."
        );

        incomingCallerId =
            null;

        incomingCallerRoom =
            null;
    }
);


// ============================================
// HIDE INCOMING CALL
// ============================================

function hideIncomingCall() {

    incomingCallOverlay.classList.add(
        "hidden"
    );
}


// ============================================
// CALL ACCEPTED
// ============================================

socket.on(
    "call-accepted",
    async ({
        target
    }) => {

        if (!target) {
            return;
        }

        setStatus(
            "Call accepted. Connecting video..."
        );

        if (!localStream) {

            await startCamera();
        }

        const peer =
            await createPeer(
                target,
                true
            );

        callInProgress =
            true;
    }
);


// ============================================
// CALL REJECTED
// ============================================

socket.on(
    "call-rejected",
    () => {

        setStatus(
            "Call rejected."
        );

        alert(
            "The other person rejected the call."
        );
    }
);


// ============================================
// CREATE WEBRTC PEER
// ============================================

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


    // ========================================
    // ADD LOCAL TRACKS
    // ========================================

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


    // ========================================
    // ICE
    // ========================================

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


    // ========================================
    // REMOTE VIDEO
    // ========================================

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


    // ========================================
    // CONNECTION STATE
    // ========================================

    peer.onconnectionstatechange =
        () => {

            console.log(
                "Connection:",
                peer.connectionState
            );


            if (
                peer.connectionState ===
                "connected"
            ) {

                setStatus(
                    "Video connected."
                );

                callInProgress =
                    true;
            }


            if (
                peer.connectionState ===
                "failed"
            ) {

                setStatus(
                    "Connection failed."
                );
            }


            if (
                peer.connectionState ===
                "disconnected"
            ) {

                setStatus(
                    "Video disconnected."
                );
            }
        };


    // ========================================
    // CREATE OFFER
    // ========================================

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


// ============================================
// WEBRTC SIGNAL
// ============================================

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


            // ICE CANDIDATE
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


// ============================================
// START CAMERA BUTTON
// ============================================

cameraBtn.addEventListener(
    "click",
    startCamera
);


// ============================================
// START CAMERA
// ============================================

async function startCamera() {

    try {

        /*
         * First try switching the existing
         * camera track.
         */

        if (localStream) {

            const currentVideoTrack =
                localStream.getVideoTracks()[0];


            if (currentVideoTrack) {

                try {

                    await currentVideoTrack.applyConstraints(
                        {
                            facingMode: {
                                exact:
                                    currentFacingMode
                            }
                        }
                    );


                    localVideo.srcObject =
                        localStream;


                    await localVideo
                        .play()
                        .catch(
                            () => {}
                        );


                    // Update WebRTC sender
                    await replacePeerVideoTrack(
                        currentVideoTrack
                    );


                    cameraBtn.textContent =
                        "Camera Started";


                    setStatus(
                        currentFacingMode ===
                        "user"
                            ? "Front camera active."
                            : "Back camera active."
                    );


                    return;

                } catch (
                    switchError
                ) {

                    console.log(
                        "Direct camera switch failed:",
                        switchError
                    );
                }
            }
        }


        /*
         * Fallback:
         * Create a new camera stream.
         */

        const oldStream =
            localStream;


        /*
         * Stop old video tracks first.
         */
        if (oldStream) {

            oldStream
                .getVideoTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }


        const newStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    video: {
                        facingMode: {
                            exact:
                                currentFacingMode
                        },

                        width: {
                            ideal:
                                1280
                        },

                        height: {
                            ideal:
                                720
                        }
                    },

                    audio:
                        oldStream
                            ? false
                            : true
                }
            );


        /*
         * If there was already an audio stream,
         * keep the existing audio track.
         */

        if (
            oldStream &&
            oldStream.getAudioTracks().length
        ) {

            const oldAudioTrack =
                oldStream.getAudioTracks()[0];

            newStream.addTrack(
                oldAudioTrack
            );
        }


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


        await replacePeerTracks();


        /*
         * Stop old tracks except tracks that
         * were moved into the new stream.
         */

        if (oldStream) {

            oldStream
                .getTracks()
                .forEach(
                    track => {

                        if (
                            !newStream
                                .getTracks()
                                .includes(track)
                        ) {

                            track.stop();
                        }
                    }
                );
        }


        cameraBtn.textContent =
            "Camera Started";


        setStatus(
            currentFacingMode ===
            "user"
                ? "Front camera active."
                : "Back camera active."
        );


    } catch (
        error
    ) {

        console.error(
            "Camera error:",
            error
        );


        /*
         * Last fallback.
         */

        try {

            const fallbackStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video:
                            true,
                        audio:
                            true
                    }
                );


            const oldStream =
                localStream;


            localStream =
                fallbackStream;


            localVideo.srcObject =
                localStream;


            localVideo.muted =
                true;


            await localVideo
                .play()
                .catch(
                    () => {}
                );


            await replacePeerTracks();


            if (oldStream) {

                oldStream
                    .getTracks()
                    .forEach(
                        track =>
                            track.stop()
                    );
            }


            setStatus(
                "Camera started."
            );


        } catch (
            fallbackError
        ) {

            console.error(
                "Fallback camera error:",
                fallbackError
            );


            alert(
                "Camera/Microphone start nahi hua:\n" +
                fallbackError.message
            );
        }
    }
}


// ============================================
// REPLACE PEER VIDEO TRACK
// ============================================

async function replacePeerVideoTrack(
    videoTrack
) {

    for (
        const peerId in peers
    ) {

        const peer =
            peers[peerId];


        if (!peer) {
            continue;
        }


        const sender =
            peer
                .getSenders()
                .find(
                    item =>
                        item.track &&
                        item.track.kind ===
                        "video"
                );


        if (
            sender &&
            videoTrack
        ) {

            try {

                await sender.replaceTrack(
                    videoTrack
                );

            } catch (
                error
            ) {

                console.error(
                    "Video replace error:",
                    error
                );
            }
        }
    }
}


// ============================================
// REPLACE PEER AUDIO + VIDEO TRACKS
// ============================================

async function replacePeerTracks() {

    if (!localStream) {
        return;
    }


    const videoTrack =
        localStream
            .getVideoTracks()[0];


    const audioTrack =
        localStream
            .getAudioTracks()[0];


    for (
        const peerId in peers
    ) {

        const peer =
            peers[peerId];


        if (!peer) {
            continue;
        }


        // VIDEO
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

            try {

                await videoSender.replaceTrack(
                    videoTrack
                );

            } catch (
                error
            ) {

                console.error(
                    "Video track error:",
                    error
                );
            }
        }


        // AUDIO
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

            try {

                await audioSender.replaceTrack(
                    audioTrack
                );

            } catch (
                error
            ) {

                console.error(
                    "Audio track error:",
                    error
                );
            }
        }
    }
}


// ============================================
// SWITCH CAMERA BUTTON
// ============================================

let switchCameraBtn =
    document.getElementById(
        "switchCameraBtn"
    );


/*
 * If HTML does not already contain
 * Switch Camera button, create it.
 */

if (!switchCameraBtn) {

    switchCameraBtn =
        document.createElement(
            "button"
        );

    switchCameraBtn.id =
        "switchCameraBtn";

    switchCameraBtn.type =
        "button";

    switchCameraBtn.className =
        "secondary";

    switchCameraBtn.textContent =
        "🔄 Switch Camera";


    if (
        cameraBtn &&
        cameraBtn.parentNode
    ) {

        cameraBtn.parentNode.insertBefore(
            switchCameraBtn,
            micBtn
        );
    }
}


switchCameraBtn.addEventListener(
    "click",
    async () => {

        if (!localStream) {

            alert(
                "Pehle camera start karo."
            );

            return;
        }


        const videoTrack =
            localStream
                .getVideoTracks()[0];


        if (!videoTrack) {

            alert(
                "Video camera available nahi hai."
            );

            return;
        }


        currentFacingMode =
            currentFacingMode ===
            "user"
                ? "environment"
                : "user";


        switchCameraBtn.disabled =
            true;


        switchCameraBtn.textContent =
            "🔄 Switching...";


        try {

            await startCamera();

        } finally {

            switchCameraBtn.disabled =
                false;

            switchCameraBtn.textContent =
                "🔄 Switch Camera";
        }
    }
);


// ============================================
// MICROPHONE
// ============================================

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
            localStream.getAudioTracks();


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


// ============================================
// END CALL
// ============================================

endBtn.addEventListener(
    "click",
    endCall
);


function endCall() {

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


    callInProgress =
        false;


    cameraBtn.textContent =
        "Start Camera";


    micBtn.textContent =
        "Mute Mic";


    isMuted =
        false;


    incomingCallerId =
        null;

    incomingCallerRoom =
        null;


    hideIncomingCall();


    setStatus(
        "Call ended."
    );


    /*
     * Re-register own permanent room.
     */

    setTimeout(
        () => {

            joinOwnRoom();

        },
        500
    );
}


// ============================================
// QR SCANNER
// ============================================

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


                code =
                    code
                        .trim()
                        .toUpperCase();


                roomInput.value =
                    code;


                joinTargetRoom(
                    code
                );
            },

            () => {}
        );

    } catch (
        error
    ) {

        console.error(
            "QR scanner error:",
            error
        );


        scanner.classList.add(
            "hidden"
        );


        alert(
            "QR scanner camera open nahi hua:\n" +
            error.message
        );
    }
}


// ============================================
// PUSH NOTIFICATIONS
// ============================================

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
                /\-/g,
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
                char.charCodeAt(
                    0
                )
        )
    );
}


// ============================================
// REGISTER PUSH
// ============================================

async function registerPush() {

    if (
        !("serviceWorker" in navigator)
    ) {

        alert(
            "Is browser mein Service Worker supported nahi hai."
        );

        return;
    }


    if (
        !("PushManager" in window)
    ) {

        alert(
            "Is browser mein Push Notification supported nahi hai."
        );

        return;
    }


    try {

        const registration =
            await navigator
                .serviceWorker
                .register(
                    "/sw.js"
                );


        console.log(
            "Service Worker registered."
        );


        const response =
            await fetch(
                "/api/vapid-public-key"
            );


        if (!response.ok) {

            throw new Error(
                "VAPID public key API error: " +
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
                "Server ne JSON ke badle HTML response diya."
            );
        }


        const result =
            await response.json();


        const publicKey =
            result.publicKey;


        if (!publicKey) {

            alert(
                "VAPID keys server par configured nahi hain."
            );

            return;
        }


        let permission =
            Notification.permission;


        if (
            permission !==
            "granted"
        ) {

            permission =
                await Notification.requestPermission();
        }


        if (
            permission !==
            "granted"
        ) {

            alert(
                "Notifications ko Allow karo."
            );

            return;
        }


        let subscription =
            await registration
                .pushManager
                .getSubscription();


        if (!subscription) {

            subscription =
                await registration
                    .pushManager
                    .subscribe(
                        {
                            userVisibleOnly:
                                true,

                            applicationServerKey:
                                urlBase64ToUint8Array(
                                    publicKey
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


        if (
            !saveResponse.ok
        ) {

            throw new Error(
                "Subscription server par save nahi hui."
            );
        }


        notificationBtn.textContent =
            "🔔 Notifications Enabled";


        setStatus(
            "Call notifications enabled."
        );

    } catch (
        error
    ) {

        console.error(
            "Push error:",
            error
        );


        alert(
            "Notification enable nahi hua:\n" +
            error.message
        );
    }
}


// ============================================
// NOTIFICATION BUTTON
// ============================================

notificationBtn.addEventListener(
    "click",
    registerPush
);


// ============================================
// SERVICE WORKER MESSAGE
// ============================================

if (
    "serviceWorker" in navigator
) {

    navigator.serviceWorker.addEventListener(
        "message",
        event => {

            const data =
                event.data;


            if (
                !data ||
                data.type !==
                "call-action"
            ) {
                return;
            }


            if (
                data.action ===
                "accept"
            ) {

                incomingCallerId =
                    data.callerId ||
                    null;

                incomingCallerRoom =
                    data.callerRoom ||
                    null;


                incomingCallerText.textContent =
                    data.callerRoom
                        ? `Room ${data.callerRoom} is calling you`
                        : "Someone is calling you";


                incomingCallOverlay.classList.remove(
                    "hidden"
                );


                setStatus(
                    "Incoming video call..."
                );

            }

            else if (
                data.action ===
                "reject"
            ) {

                if (
                    data.callerId
                ) {

                    socket.emit(
                        "reject-call",
                        {
                            callerId:
                                data.callerId
                        }
                    );
                }

            }

            else {

                incomingCallerId =
                    data.callerId ||
                    null;

                incomingCallerRoom =
                    data.callerRoom ||
                    null;


                incomingCallerText.textContent =
                    data.callerRoom
                        ? `Room ${data.callerRoom} is calling you`
                        : "Someone is calling you";


                incomingCallOverlay.classList.remove(
                    "hidden"
                );
            }
        }
    );
}


// ============================================
// AUTO REGISTER SERVICE WORKER
// ============================================

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        () => {

            navigator.serviceWorker
                .register(
                    "/sw.js"
                )
                .then(
                    registration => {

                        console.log(
                            "Service Worker ready:",
                            registration.scope
                        );
                    }
                )
                .catch(
                    error => {

                        console.error(
                            "Service Worker error:",
                            error
                        );
                    }
                );
        }
    );
}


// ============================================
// ROOM FROM QR / URL
// ============================================

const params =
    new URLSearchParams(
        window.location.search
    );


const roomFromUrl =
    params.get(
        "room"
    );


if (roomFromUrl) {

    const targetRoom =
        roomFromUrl
            .trim()
            .toUpperCase();


    roomInput.value =
        targetRoom;


    setTimeout(
        () => {

            joinTargetRoom(
                targetRoom
            );

        },
        800
    );
}

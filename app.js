/* =========================================================
   JH SECURE CAM
   FINAL APP.JS
   HACKER SOUND EDITION
========================================================= */

"use strict";


/* =========================================================
   SOCKET
========================================================= */
/* =========================================================
   JH SECURE CAM — REAL HACKER TYPING SOUND
   ========================================================= */

let hackerAudioContext = null;
let hackerLastKeyTime = 0;

function unlockHackerAudio() {
    try {
        const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioCtx) return;

        if (!hackerAudioContext) {
            hackerAudioContext = new AudioCtx();
        }

        if (
            hackerAudioContext.state === "suspended"
        ) {
            hackerAudioContext
                .resume()
                .catch(() => {});
        }

    } catch (error) {
        console.warn(
            "Hacker audio unavailable:",
            error
        );
    }
}


function playHackerTypingSound() {

    unlockHackerAudio();

    if (!hackerAudioContext) {
        return;
    }

    try {

        const ctx =
            hackerAudioContext;

        const now =
            ctx.currentTime;


        /*
         * Different frequencies make every
         * key sound slightly different.
         */

        const sounds = [

            {
                type: "square",
                start: 115,
                end: 72,
                duration: 0.045
            },

            {
                type: "square",
                start: 155,
                end: 95,
                duration: 0.050
            },

            {
                type: "sawtooth",
                start: 190,
                end: 105,
                duration: 0.042
            },

            {
                type: "square",
                start: 85,
                end: 58,
                duration: 0.055
            },

            {
                type: "triangle",
                start: 220,
                end: 120,
                duration: 0.040
            }

        ];


        const sound =
            sounds[
                Math.floor(
                    Math.random() *
                    sounds.length
                )
            ];


        const master =
            ctx.createGain();


        /*
         * Web-audio output at full app level.
         * Phone's own volume still controls
         * the final loudness.
         */

        master.gain.setValueAtTime(
            0.9,
            now
        );


        master.connect(
            ctx.destination
        );


        const oscillator =
            ctx.createOscillator();


        const gain =
            ctx.createGain();


        oscillator.type =
            sound.type;


        oscillator.frequency.setValueAtTime(
            sound.start,
            now
        );


        oscillator.frequency
            .exponentialRampToValueAtTime(
                sound.end,
                now + sound.duration
            );


        gain.gain.setValueAtTime(
            0.0001,
            now
        );


        gain.gain
            .exponentialRampToValueAtTime(
                0.50,
                now + 0.003
            );


        gain.gain
            .exponentialRampToValueAtTime(
                0.0001,
                now + sound.duration
            );


        oscillator.connect(
            gain
        );


        gain.connect(
            master
        );


        oscillator.start(
            now
        );


        oscillator.stop(
            now +
            sound.duration +
            0.01
        );


    } catch (error) {

        console.warn(
            "Typing sound error:",
            error
        );
    }
}


/* =========================================================
   ONLY TEXT TYPING GETS THE SOUND
   Buttons do NOT make this sound.
   ========================================================= */

function isTypingField(
    element
) {

    if (!element) {
        return false;
    }


    return (
        element.tagName === "INPUT" ||
        element.tagName === "TEXTAREA" ||
        element.isContentEditable
    );
}


/* =========================================================
   KEYBOARD LISTENER
   ========================================================= */

document.addEventListener(
    "keydown",
    (event) => {

        if (
            !isTypingField(
                event.target
            )
        ) {
            return;
        }


        const ignoredKeys = [

            "Shift",
            "Control",
            "Alt",
            "Meta",

            "CapsLock",
            "Tab",
            "Escape",

            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",

            "Home",
            "End",

            "PageUp",
            "PageDown",

            "Insert",
            "Delete"

        ];


        if (
            ignoredKeys.includes(
                event.key
            )
        ) {
            return;
        }


        /*
         * Prevent overlapping sounds
         * when keyboard repeats extremely fast.
         */

        const now =
            performance.now();


        if (
            now -
            hackerLastKeyTime <
            18
        ) {
            return;
        }


        hackerLastKeyTime =
            now;


        playHackerTypingSound();

    },
    {
        passive: true
    }
);


/* =========================================================
   MOBILE BROWSER AUDIO UNLOCK
   First touch unlocks audio.
   It does NOT play a sound.
   ========================================================= */

document.addEventListener(
    "pointerdown",
    () => {

        unlockHackerAudio();

    },
    {
        passive: true,
        once: true
    }
);

const socket = io();


/* =========================================================
   CONSTANTS
========================================================= */

const MAX_FRIENDS = 6;
const MAX_MEDIA_MB = 25;

const STORAGE_ROOM =
    "roushanPermanentRoom";

const STORAGE_FRIENDS =
    "roushanFriends";

const STORAGE_USER_NAME =
    "roushanUserName";


/* =========================================================
   WEBRTC
========================================================= */

const rtcConfig = {
    iceServers: [
        {
            urls:
                "stun:stun.l.google.com:19302"
        }
    ]
};


/* =========================================================
   GLOBAL STATE
========================================================= */

let roomCode = "";

let localStream = null;

let currentFacingMode = "user";

let isMuted = false;

let isMirrored = false;

let currentFilter = "none";

let activeCall = false;

let incomingCallerId = null;

let incomingCallerRoom = null;

let scannerInstance = null;

let replyTarget = null;

let selectedMediaFile = null;

let typingTimer = null;

let userName =
    localStorage.getItem(
        STORAGE_USER_NAME
    ) || "USER";


/*
 * peerId -> RTCPeerConnection
 */
const peers = {};


/*
 * peerId -> camera tile
 */
const peerTiles = {};


/* =========================================================
   HACKER SOUND SYSTEM
========================================================= */

let hackerAudioContext = null;


/*
 * Create / unlock AudioContext.
 *
 * Browser audio starts after user interaction.
 */
function getHackerAudio() {

    if (!hackerAudioContext) {

        const AudioCtx =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!AudioCtx) {
            return null;
        }

        hackerAudioContext =
            new AudioCtx();
    }


    if (
        hackerAudioContext.state ===
        "suspended"
    ) {

        hackerAudioContext
            .resume()
            .catch(
                () => {}
            );
    }


    return hackerAudioContext;
}


/*
 * Hacker-style synthetic sound.
 *
 * No external MP3 required.
 */
function hackerBeep(
    type = "click"
) {

    const ctx =
        getHackerAudio();

    if (!ctx) {
        return;
    }


    const now =
        ctx.currentTime;


    const oscillator =
        ctx.createOscillator();

    const gain =
        ctx.createGain();

    const filter =
        ctx.createBiquadFilter();


    oscillator.connect(
        filter
    );

    filter.connect(
        gain
    );

    gain.connect(
        ctx.destination
    );


    filter.type =
        "highpass";

    filter.frequency.value =
        300;


    gain.gain.setValueAtTime(
        0.0001,
        now
    );


    /*
     * NORMAL CLICK
     */

    if (
        type === "click"
    ) {

        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            850,
            now
        );


        oscillator.frequency.exponentialRampToValueAtTime(
            1250,
            now + 0.055
        );


        gain.gain.exponentialRampToValueAtTime(
            0.9,
            now + 0.008
        );


        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.13
        );


        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.14
        );

        return;
    }


    /*
     * ACTION
     */

    if (
        type === "action"
    ) {

        oscillator.type =
            "sawtooth";


        oscillator.frequency.setValueAtTime(
            420,
            now
        );


        oscillator.frequency.exponentialRampToValueAtTime(
            1100,
            now + 0.12
        );


        gain.gain.exponentialRampToValueAtTime(
            0.85,
            now + 0.01
        );


        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.22
        );


        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.23
        );

        return;
    }


    /*
     * INCOMING CALL ALERT
     */

    if (
        type === "alert"
    ) {

        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            520,
            now
        );

        oscillator.frequency.setValueAtTime(
            900,
            now + 0.10
        );

        oscillator.frequency.setValueAtTime(
            520,
            now + 0.20
        );

        oscillator.frequency.setValueAtTime(
            900,
            now + 0.30
        );


        gain.gain.exponentialRampToValueAtTime(
            0.95,
            now + 0.01
        );


        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.43
        );


        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.44
        );

        return;
    }


    /*
     * SHUTDOWN / END
     */

    if (
        type === "shutdown"
    ) {

        oscillator.type =
            "sawtooth";


        oscillator.frequency.setValueAtTime(
            1000,
            now
        );


        oscillator.frequency.exponentialRampToValueAtTime(
            180,
            now + 0.28
        );


        gain.gain.exponentialRampToValueAtTime(
            0.9,
            now + 0.01
        );


        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 0.31
        );


        oscillator.start(
            now
        );

        oscillator.stop(
            now + 0.32
        );

        return;
    }
}


/*
 * Every clickable button gets hacker click.
 */
document.addEventListener(
    "click",
    event => {

        const target =
            event.target.closest(
                "button, .filter-option, .friend-item"
            );


        if (!target) {
            return;
        }


        /*
         * These have their own sounds.
         */
        if (
            target === acceptCallBtn ||
            target === rejectCallBtn
        ) {
            return;
        }


        hackerBeep(
            "click"
        );
    },
    true
);


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}


/* =========================================================
   MAIN DOM
========================================================= */

const connectionState =
    $("connectionState");

const connectionDot =
    $("connectionDot");

const status =
    $("status");

const onlineCount =
    $("onlineCount");


/* =========================================================
   ROOM DOM
========================================================= */

const roomInput =
    $("roomInput");

const createBtn =
    $("createBtn");

const targetRoomInput =
    $("targetRoomInput");


/* =========================================================
   VIDEO DOM
========================================================= */

const localVideo =
    $("localVideo");

const remoteVideo =
    $("remoteVideo");

const remoteVideo3 =
    $("remoteVideo3");

const remoteVideo4 =
    $("remoteVideo4");

const remoteVideo5 =
    $("remoteVideo5");

const remoteVideo6 =
    $("remoteVideo6");

const localTile =
    $("localTile");

const cameraTile2 =
    $("cameraTile2");

const cameraTile3 =
    $("cameraTile3");

const cameraTile4 =
    $("cameraTile4");

const cameraTile5 =
    $("cameraTile5");

const cameraTile6 =
    $("cameraTile6");


/* =========================================================
   CONTROLS
========================================================= */

const cameraBtn =
    $("cameraBtn");

const micBtn =
    $("micBtn");

const switchCameraBtn =
    $("switchCameraBtn");

const mirrorBtn =
    $("mirrorBtn");

const filterBtn =
    $("filterBtn");

const myRoomBtn =
    $("myRoomBtn");

const joinRoomBtn =
    $("joinRoomBtn");

const friendsBtn =
    $("friendsBtn");

const chatBtn =
    $("chatBtn");

const endBtn =
    $("endBtn");


/* =========================================================
   MY ROOM
========================================================= */

const myRoomOverlay =
    $("myRoomOverlay");

const myRoomValue =
    $("myRoomValue");

const copyRoomBtn =
    $("copyRoomBtn");

const myRoomCloseBtn =
    $("myRoomCloseBtn");

const qrBox =
    $("qrBox");

const qrcode =
    $("qrcode");


/* =========================================================
   JOIN ROOM
========================================================= */

const joinRoomOverlay =
    $("joinRoomOverlay");

const joinRoomInput =
    $("joinRoomInput");

const joinRoomConfirmBtn =
    $("joinRoomConfirmBtn");

const joinRoomCloseBtn =
    $("joinRoomCloseBtn");

const scanBtn =
    $("scanBtn");

const scanner =
    $("scanner");


/* =========================================================
   FRIENDS
========================================================= */

const friendsOverlay =
    $("friendsOverlay");

const friendNameInput =
    $("friendNameInput");

const friendRoomInput =
    $("friendRoomInput");

const addFriendConfirmBtn =
    $("addFriendConfirmBtn");

const friendsList =
    $("friendsList");

const friendsCloseBtn =
    $("friendsCloseBtn");


/* =========================================================
   FILTERS
========================================================= */

const filterOverlay =
    $("filterOverlay");

const filterCloseBtn =
    $("filterCloseBtn");

const filterOptions =
    document.querySelectorAll(
        ".filter-option"
    );


/* =========================================================
   INCOMING CALL
========================================================= */

const incomingCallOverlay =
    $("incomingCallOverlay");

const incomingCallerText =
    $("incomingCallerText");

const acceptCallBtn =
    $("acceptCallBtn");

const rejectCallBtn =
    $("rejectCallBtn");


/* =========================================================
   CONNECTING
========================================================= */

const connectingOverlay =
    $("connectingOverlay");

const connectingText =
    $("connectingText");


/* =========================================================
   CHAT
========================================================= */

const chatPanel =
    $("chatPanel");

const chatMessages =
    $("chatMessages");

const chatInput =
    $("chatInput");

const chatSendBtn =
    $("chatSendBtn");

const chatFileBtn =
    $("chatFileBtn");

const chatFileInput =
    $("chatFileInput");

const chatCloseBtn =
    $("chatCloseBtn");

const typingIndicator =
    $("typingIndicator");

const chatReplyBar =
    $("chatReplyBar");

const chatReplyText =
    $("chatReplyText");

const chatReplyCancelBtn =
    $("chatReplyCancelBtn");

const chatMediaPreview =
    $("chatMediaPreview");

const chatMediaName =
    $("chatMediaName");

const chatMediaSize =
    $("chatMediaSize");

const chatMediaCancelBtn =
    $("chatMediaCancelBtn");


/* =========================================================
   SAFETY CHECK
========================================================= */

if (!localVideo) {

    console.error(
        "JH Secure Cam: localVideo missing."
    );
}


/* =========================================================
   STATUS
========================================================= */

function setStatus(
    message
) {

    if (status) {

        status.textContent =
            message;
    }


    console.log(
        "[STATUS]",
        message
    );
}


/* =========================================================
   CONNECTION STATUS
========================================================= */

socket.on(
    "connect",
    () => {

        if (connectionState) {

            connectionState.textContent =
                "ONLINE";
        }


        if (connectionDot) {

            connectionDot.style.color =
                "#00ff66";
        }


        setStatus(
            "Secure server connected."
        );


        updateOnlineCount();
    }
);


socket.on(
    "disconnect",
    () => {

        if (connectionState) {

            connectionState.textContent =
                "OFFLINE";
        }


        if (connectionDot) {

            connectionDot.style.color =
                "#ff304f";
        }


        setStatus(
            "Server connection lost."
        );
    }
);


/* =========================================================
   PERMANENT ROOM
========================================================= */

function generateRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


    let result =
        "";


    for (
        let i = 0;
        i < 6;
        i++
    ) {

        result +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];
    }


    return result;
}


function getPermanentRoomCode() {

    let saved =
        localStorage.getItem(
            STORAGE_ROOM
        );


    if (!saved) {

        saved =
            generateRoomCode();


        localStorage.setItem(
            STORAGE_ROOM,
            saved
        );
    }


    return saved
        .trim()
        .toUpperCase();
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


    if (myRoomValue) {

        myRoomValue.textContent =
            roomCode;
    }
}


showPermanentRoom();


/* =========================================================
   JOIN OWN ROOM
========================================================= */

function joinOwnRoom() {

    roomCode =
        getPermanentRoomCode();


    socket.emit(
        "join-room",
        {
            room:
                roomCode
        }
    );


    setStatus(
        "Joining your permanent room..."
    );
}


/* =========================================================
   ROOM JOINED
========================================================= */

socket.on(
    "room-joined",
    async data => {

        const room =
            data?.room ||
            roomCode;


        const users =
            Array.isArray(
                data?.users
            )
                ? data.users
                : [];


        roomCode =
            room
                .trim()
                .toUpperCase();


        if (roomInput) {

            roomInput.value =
                roomCode;

            roomInput.readOnly =
                true;
        }


        if (myRoomValue) {

            myRoomValue.textContent =
                getPermanentRoomCode();
        }


        activeCall =
            true;


        updateOnlineCount(
            data?.count
        );


        setStatus(
            `Room connected (${data?.count || 1}/6)`
        );


        if (!localStream) {

            await startCamera();
        }


        for (
            const peerId of users
        ) {

            if (
                peerId ===
                socket.id
            ) {
                continue;
            }


            await createPeer(
                peerId,
                true
            );
        }
    }
);


/* =========================================================
   ROOM FULL
========================================================= */

socket.on(
    "room-full",
    data => {

        hackerBeep(
            "shutdown"
        );


        setStatus(
            "Room is full."
        );


        alert(
            data?.message ||
            "Room full hai. Maximum 6 users allowed."
        );
    }
);


/* =========================================================
   NEW PEER
========================================================= */

socket.on(
    "peer-joined",
    async ({
        peerId
    }) => {

        if (!peerId) {
            return;
        }


        updateOnlineCount();


        setStatus(
            "New user joined the camera network."
        );
    }
);


/* =========================================================
   PEER LEFT
========================================================= */

socket.on(
    "peer-left",
    ({
        peerId
    }) => {

        if (!peerId) {
            return;
        }


        closePeer(
            peerId
        );


        updateOnlineCount();


        setStatus(
            "A user left the room."
        );
    }
);


/* =========================================================
   CREATE WEBRTC PEER
========================================================= */

async function createPeer(
    peerId,
    createOffer = false
) {

    if (!peerId) {
        return null;
    }


    if (
        peers[peerId]
    ) {

        return peers[
            peerId
        ];
    }


    const pc =
        new RTCPeerConnection(
            rtcConfig
        );


    peers[peerId] =
        pc;


    /*
     * Local tracks.
     */

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    pc.addTrack(
                        track,
                        localStream
                    );
                }
            );
    }


    /*
     * ICE.
     */

    pc.onicecandidate =
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


    /*
     * Remote tracks.
     */

    pc.ontrack =
        event => {

            const stream =
                event.streams?.[0];


            if (!stream) {
                return;
            }


            attachRemoteStream(
                peerId,
                stream
            );


            updateOnlineCount();
        };


    /*
     * Connection state.
     */

    pc.onconnectionstatechange =
        () => {

            console.log(
                "Peer",
                peerId,
                pc.connectionState
            );


            if (
                pc.connectionState ===
                    "closed"
            ) {

                closePeer(
                    peerId
                );
            }
        };


    /*
     * Create offer.
     */

    if (createOffer) {

        try {

            const offer =
                await pc.createOffer();


            await pc.setLocalDescription(
                offer
            );


            socket.emit(
                "signal",
                {
                    target:
                        peerId,

                    data:
                        pc.localDescription
                }
            );

        } catch (error) {

            console.error(
                "Offer error:",
                error
            );
        }
    }


    return pc;
}


/* =========================================================
   SIGNAL
========================================================= */

socket.on(
    "signal",
    async ({
        sender,
        data
    }) => {

        if (
            !sender ||
            !data
        ) {
            return;
        }


        try {

            let pc =
                peers[sender];


            if (!pc) {

                if (!localStream) {

                    await startCamera();
                }


                pc =
                    await createPeer(
                        sender,
                        false
                    );
            }


            /*
             * OFFER
             */

            if (
                data.type ===
                "offer"
            ) {

                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        data
                    )
                );


                const answer =
                    await pc.createAnswer();


                await pc.setLocalDescription(
                    answer
                );


                socket.emit(
                    "signal",
                    {
                        target:
                            sender,

                        data:
                            pc.localDescription
                    }
                );


                setStatus(
                    "Video connection negotiating..."
                );
            }


            /*
             * ANSWER
             */

            else if (
                data.type ===
                "answer"
            ) {

                await pc.setRemoteDescription(
                    new RTCSessionDescription(
                        data
                    )
                );


                setStatus(
                    "Video connection established."
                );
            }


            /*
             * ICE
             */

            else if (
                data.type ===
                "candidate"
            ) {

                if (
                    data.candidate
                ) {

                    try {

                        await pc.addIceCandidate(
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
                "Signal handling error:",
                error
            );
        }
    }
);


/* =========================================================
   REMOTE TILE MANAGEMENT
========================================================= */

const remoteSlots = [
    {
        tile:
            cameraTile2,

        video:
            remoteVideo
    },

    {
        tile:
            cameraTile3,

        video:
            remoteVideo3
    },

    {
        tile:
            cameraTile4,

        video:
            remoteVideo4
    },

    {
        tile:
            cameraTile5,

        video:
            remoteVideo5
    },

    {
        tile:
            cameraTile6,

        video:
            remoteVideo6
    }
];


function getRemoteSlot(
    peerId
) {

    if (
        peerTiles[peerId]
    ) {

        return peerTiles[
            peerId
        ];
    }


    for (
        const slot of remoteSlots
    ) {

        const occupied =
            Object.values(
                peerTiles
            ).includes(
                slot
            );


        if (!occupied) {

            peerTiles[
                peerId
            ] = slot;


            return slot;
        }
    }


    return null;
}


function attachRemoteStream(
    peerId,
    stream
) {

    const slot =
        getRemoteSlot(
            peerId
        );


    if (!slot) {

        console.warn(
            "No free camera tile for:",
            peerId
        );

        return;
    }


    slot.video.srcObject =
        stream;


    slot.video.muted =
        false;


    slot.tile.classList.remove(
        "empty"
    );


    slot.video
        .play()
        .catch(
            () => {}
        );
}


function releaseRemoteSlot(
    peerId
) {

    const slot =
        peerTiles[
            peerId
        ];


    if (!slot) {
        return;
    }


    slot.video.srcObject =
        null;


    slot.tile.classList.add(
        "empty"
    );


    delete peerTiles[
        peerId
    ];
}


/* =========================================================
   CLOSE PEER
========================================================= */

function closePeer(
    peerId
) {

    const pc =
        peers[peerId];


    if (pc) {

        try {

            pc.close();

        } catch {}
        

        delete peers[
            peerId
        ];
    }


    releaseRemoteSlot(
        peerId
    );
}


/* =========================================================
   ONLINE COUNT
========================================================= */

function updateOnlineCount(
    suppliedCount
) {

    let count =
        Number(
            suppliedCount
        );


    if (
        !Number.isFinite(
            count
        ) ||
        count <= 0
    ) {

        count =
            Object.keys(
                peers
            ).length + 1;
    }


    count =
        Math.max(
            1,
            Math.min(
                6,
                count
            )
        );


    if (onlineCount) {

        onlineCount.textContent =
            `${count} / 6 ONLINE`;
    }
}


/* =========================================================
   CAMERA
========================================================= */

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
                            ideal:
                                1280
                        },

                        height: {
                            ideal:
                                720
                        }
                    },

                    audio:
                        true
                });


        localStream =
            newStream;


        localVideo.srcObject =
            localStream;


        localVideo.muted =
            true;


        localVideo.playsInline =
            true;


        const videoTrack =
            localStream
                .getVideoTracks()[0];


        const audioTrack =
            localStream
                .getAudioTracks()[0];


        /*
         * Replace tracks.
         */

        for (
            const peerId in peers
        ) {

            const pc =
                peers[peerId];


            if (!pc) {
                continue;
            }


            const videoSender =
                pc
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

                    await videoSender
                        .replaceTrack(
                            videoTrack
                        );

                } catch (error) {

                    console.warn(
                        "Video replace error:",
                        error
                    );
                }
            }


            const audioSender =
                pc
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

                    await audioSender
                        .replaceTrack(
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


        /*
         * Preserve mute.
         */

        if (audioTrack) {

            audioTrack.enabled =
                !isMuted;
        }


        /*
         * Stop old stream.
         */

        if (oldStream) {

            oldStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );
        }


        applyMirror();

        applyFilter();


        localTile.classList.remove(
            "empty"
        );


        cameraBtn.textContent =
            "📷 Camera ON";


        setStatus(
            currentFacingMode ===
                "environment"
                ? "Back camera active."
                : "Front camera active."
        );


        await localVideo
            .play()
            .catch(
                () => {}
            );

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );


        setStatus(
            "Camera permission/device error."
        );


        alert(
            "Camera start nahi hua.\n\n" +
            error.message
        );
    }
}


/* =========================================================
   CAMERA BUTTON
========================================================= */

if (cameraBtn) {

    cameraBtn.addEventListener(
        "click",
        async () => {

            hackerBeep(
                "action"
            );


            if (
                localStream
            ) {

                const tracks =
                    localStream
                        .getVideoTracks();


                if (tracks.length) {

                    const enabled =
                        !tracks[0].enabled;


                    tracks.forEach(
                        track => {

                            track.enabled =
                                enabled;
                        }
                    );


                    cameraBtn.textContent =
                        enabled
                            ? "📷 Camera ON"
                            : "📷 Camera OFF";


                    setStatus(
                        enabled
                            ? "Camera enabled."
                            : "Camera disabled."
                    );


                    return;
                }
            }


            await startCamera();
        }
    );
}


/* =========================================================
   SWITCH CAMERA
========================================================= */

if (switchCameraBtn) {

    switchCameraBtn.addEventListener(
        "click",
        async () => {

            hackerBeep(
                "action"
            );


            if (
                !navigator.mediaDevices ||
                !navigator.mediaDevices.getUserMedia
            ) {

                alert(
                    "Camera API supported nahi hai."
                );

                return;
            }


            currentFacingMode =
                currentFacingMode ===
                    "user"
                    ? "environment"
                    : "user";


            setStatus(
                currentFacingMode ===
                    "environment"
                    ? "Switching to back camera..."
                    : "Switching to front camera..."
            );


            try {

                await startCamera();

            } catch (
                error
            ) {

                currentFacingMode =
                    currentFacingMode ===
                        "user"
                        ? "environment"
                        : "user";


                console.error(
                    error
                );
            }
        }
    );
}


/* =========================================================
   MIRROR
========================================================= */

function applyMirror() {

    if (!localVideo) {
        return;
    }


    localVideo.classList.toggle(
        "mirrored",
        isMirrored
    );
}


if (mirrorBtn) {

    mirrorBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            isMirrored =
                !isMirrored;


            applyMirror();


            mirrorBtn.classList.toggle(
                "active",
                isMirrored
            );


            mirrorBtn.textContent =
                isMirrored
                    ? "🪞 Mirror ON"
                    : "🪞 Mirror";
        }
    );
}


/* =========================================================
   FILTER
========================================================= */

function applyFilter() {

    if (!localVideo) {
        return;
    }


    localVideo.classList.remove(
        "filter-none",
        "filter-vibrant",
        "filter-warm",
        "filter-cool",
        "filter-mono",
        "filter-sepia",
        "filter-dream",
        "filter-neon",
        "filter-soft",
        "filter-contrast"
    );


    localVideo.classList.add(
        `filter-${currentFilter}`
    );
}


filterOptions.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                hackerBeep(
                    "action"
                );


                currentFilter =
                    button.dataset.filter ||
                    "none";


                filterOptions.forEach(
                    item => {

                        item.classList.toggle(
                            "active",
                            item === button
                        );
                    }
                );


                applyFilter();


                setStatus(
                    currentFilter ===
                        "none"
                        ? "Camera filter cleared."
                        : `Filter: ${currentFilter.toUpperCase()}`
                );


                closeOverlay(
                    filterOverlay
                );
            }
        );
    }
);


if (filterBtn) {

    filterBtn.addEventListener(
        "click",
        () => {

            openOverlay(
                filterOverlay
            );
        }
    );
}


if (filterCloseBtn) {

    filterCloseBtn.addEventListener(
        "click",
        () => {

            closeOverlay(
                filterOverlay
            );
        }
    );
}


/* =========================================================
   MIC
========================================================= */

if (micBtn) {

    micBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


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

                alert(
                    "Microphone track nahi mila."
                );

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


            micBtn.classList.toggle(
                "active",
                isMuted
            );


            micBtn.textContent =
                isMuted
                    ? "🔇 Mic OFF"
                    : "🎤 Mic";
        }
    );
}


/* =========================================================
   END CALL
========================================================= */

if (endBtn) {

    endBtn.addEventListener(
        "click",
        endCall
    );
}


function endCall() {

    hackerBeep(
        "shutdown"
    );


    activeCall =
        false;


    /*
     * Close peers.
     */

    Object.keys(
        peers
    ).forEach(
        peerId => {

            closePeer(
                peerId
            );
        }
    );


    /*
     * Stop camera.
     */

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


    localTile.classList.add(
        "empty"
    );


    socket.emit(
        "leave-room"
    );


    cameraBtn.textContent =
        "📷 Camera";


    micBtn.textContent =
        "🎤 Mic";


    isMuted =
        false;


    setStatus(
        "Call ended. Your Room ID is still permanent."
    );


    updateOnlineCount(
        1
    );


    setTimeout(
        () => {

            joinOwnRoom();

        },
        600
    );
}


/* =========================================================
   MY ROOM PANEL
========================================================= */

if (myRoomBtn) {

    myRoomBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            const code =
                getPermanentRoomCode();


            if (myRoomValue) {

                myRoomValue.textContent =
                    code;
            }


            createQRCode(
                code
            );


            toggleOverlay(
                myRoomOverlay
            );
        }
    );
}


if (myRoomCloseBtn) {

    myRoomCloseBtn.addEventListener(
        "click",
        () => {

            closeOverlay(
                myRoomOverlay
            );
        }
    );
}


function createQRCode(
    code
) {

    if (!qrcode) {
        return;
    }


    qrcode.innerHTML =
        "";


    if (
        typeof QRCode ===
        "undefined"
    ) {

        qrcode.textContent =
            "QR library unavailable.";

        return;
    }


    const joinUrl =
        window.location.origin +
        window.location.pathname +
        "?room=" +
        encodeURIComponent(
            code
        );


    new QRCode(
        qrcode,
        {
            text:
                joinUrl,

            width:
                200,

            height:
                200,

            correctLevel:
                QRCode.CorrectLevel.M
        }
    );


    if (qrBox) {

        qrBox.classList.remove(
            "hidden"
        );
    }
}


/* =========================================================
   COPY ROOM
========================================================= */

if (copyRoomBtn) {

    copyRoomBtn.addEventListener(
        "click",
        async () => {

            hackerBeep(
                "action"
            );


            const code =
                getPermanentRoomCode();


            try {

                await navigator
                    .clipboard
                    .writeText(
                        code
                    );


                copyRoomBtn.textContent =
                    "✓ COPIED";


                setTimeout(
                    () => {

                        copyRoomBtn.textContent =
                            "📋 Copy Room ID";

                    },
                    1200
                );

            } catch {

                alert(
                    "Room ID: " +
                    code
                );
            }
        }
    );
}


/* =========================================================
   JOIN ROOM PANEL
========================================================= */

if (joinRoomBtn) {

    joinRoomBtn.addEventListener(
        "click",
        () => {

            const sound =
                getHackerAudio();

            if (sound) {
                hackerBeep(
                    "action"
                );
            }


            if (joinRoomInput) {

                joinRoomInput.value =
                    "";
            }


            openOverlay(
                joinRoomOverlay
            );


            setTimeout(
                () => {

                    joinRoomInput?.focus();

                },
                100
            );
        }
    );
}


if (joinRoomCloseBtn) {

    joinRoomCloseBtn.addEventListener(
        "click",
        () => {

            closeOverlay(
                joinRoomOverlay
            );
        }
    );
}


if (joinRoomConfirmBtn) {

    joinRoomConfirmBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            const target =
                joinRoomInput
                    ?.value
                    .trim()
                    .toUpperCase();


            if (!target) {

                alert(
                    "Room ID enter karo."
                );

                return;
            }


            if (
                target ===
                getPermanentRoomCode()
            ) {

                closeOverlay(
                    joinRoomOverlay
                );


                joinOwnRoom();


                return;
            }


            closeOverlay(
                joinRoomOverlay
            );


            socket.emit(
                "call-user",
                {
                    targetRoom:
                        target,

                    callerRoom:
                        getPermanentRoomCode(),

                    callerName:
                        userName
                }
            );


            setStatus(
                `Calling Room ${target}...`
            );


            showConnecting(
                `Calling Room ${target}...`
            );


            setTimeout(
                () => {

                    hideConnecting();

                },
                10000
            );
        }
    );
}


/* =========================================================
   CALL EVENTS
========================================================= */

socket.on(
    "call-ringing",
    data => {

        hackerBeep(
            "click"
        );


        setStatus(
            `Calling ${data?.room || "room"}...`
        );


        showConnecting(
            "Waiting for answer..."
        );
    }
);


socket.on(
    "call-unavailable",
    data => {

        hackerBeep(
            "shutdown"
        );


        hideConnecting();


        alert(
            data?.message ||
            "Room unavailable."
        );


        setStatus(
            "Room unavailable."
        );
    }
);


/* =========================================================
   INCOMING CALL
========================================================= */

socket.on(
    "incoming-call",
    data => {

        incomingCallerId =
            data?.callerId ||
            data?.from ||
            null;


        incomingCallerRoom =
            data?.callerRoom ||
            data?.room ||
            "";


        const callerName =
            data?.callerName ||
            incomingCallerRoom ||
            "Unknown user";


        if (incomingCallerText) {

            incomingCallerText.textContent =
                `${callerName} is calling you`;
        }


        /*
         * LOUD HACKER ALERT
         */

        hackerBeep(
            "alert"
        );


        openCallOverlay();


        setStatus(
            "Incoming call..."
        );
    }
);


/* =========================================================
   ACCEPT CALL
========================================================= */

if (acceptCallBtn) {

    acceptCallBtn.addEventListener(
        "click",
        async () => {

            hackerBeep(
                "action"
            );


            closeCallOverlay();


            activeCall =
                true;


            if (!localStream) {

                await startCamera();
            }


            socket.emit(
                "accept-call",
                {
                    callerId:
                        incomingCallerId,

                    callerRoom:
                        incomingCallerRoom,

                    receiverRoom:
                        roomCode
                }
            );


            setStatus(
                "Call accepted."
            );
        }
    );
}


/* =========================================================
   REJECT CALL
========================================================= */

if (rejectCallBtn) {

    rejectCallBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "shutdown"
            );


            socket.emit(
                "reject-call",
                {
                    callerId:
                        incomingCallerId,

                    callerRoom:
                        incomingCallerRoom
                }
            );


            closeCallOverlay();


            incomingCallerId =
                null;


            incomingCallerRoom =
                null;


            setStatus(
                "Call rejected."
            );
        }
    );
}


/* =========================================================
   CALL ACCEPTED
========================================================= */

socket.on(
    "call-accepted",
    async data => {

        hackerBeep(
            "action"
        );


        hideConnecting();


        activeCall =
            true;


        const peerId =
            data?.receiverId ||
            data?.targetId;


        if (
            peerId &&
            peerId !== socket.id
        ) {

            if (!localStream) {

                await startCamera();
            }


            await createPeer(
                peerId,
                true
            );
        }


        setStatus(
            "Call accepted. Connecting video..."
        );
    }
);


/* =========================================================
   CALL REJECTED
========================================================= */

socket.on(
    "call-rejected",
    () => {

        hackerBeep(
            "shutdown"
        );


        hideConnecting();


        setStatus(
            "Call rejected."
        );
    }
);


/* =========================================================
   CALL OVERLAY
========================================================= */

function openCallOverlay() {

    if (
        incomingCallOverlay
    ) {

        incomingCallOverlay
            .classList
            .remove(
                "hidden"
            );
    }
}


function closeCallOverlay() {

    if (
        incomingCallOverlay
    ) {

        incomingCallOverlay
            .classList
            .add(
                "hidden"
            );
    }
}


/* =========================================================
   CONNECTING
========================================================= */

function showConnecting(
    message
) {

    if (connectingText) {

        connectingText.textContent =
            message ||
            "Establishing connection...";
    }


    connectingOverlay
        ?.classList
        .remove(
            "hidden"
        );
}


function hideConnecting() {

    connectingOverlay
        ?.classList
        .add(
            "hidden"
        );
}


/* =========================================================
   GENERIC OVERLAY
========================================================= */

function openOverlay(
    element
) {

    if (!element) {
        return;
    }


    element.classList.remove(
        "hidden"
    );
}


function closeOverlay(
    element
) {

    if (!element) {
        return;
    }


    element.classList.add(
        "hidden"
    );
}


function toggleOverlay(
    element
) {

    if (!element) {
        return;
    }


    element.classList.toggle(
        "hidden"
    );
}


/* =========================================================
   CLOSE OVERLAY BY BACKGROUND
========================================================= */

[
    myRoomOverlay,
    joinRoomOverlay,
    friendsOverlay,
    filterOverlay
].forEach(
    overlay => {

        if (!overlay) {
            return;
        }


        overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    overlay
                ) {

                    closeOverlay(
                        overlay
                    );
                }
            }
        );
    }
);


/* =========================================================
   FRIEND STORAGE
========================================================= */

function getFriends() {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    STORAGE_FRIENDS
                ) || "[]"
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch {

        return [];
    }
}


function saveFriends(
    friends
) {

    localStorage.setItem(
        STORAGE_FRIENDS,
        JSON.stringify(
            friends
        )
    );
}


function renderFriends() {

    if (!friendsList) {
        return;
    }


    friendsList.innerHTML =
        "";


    const friends =
        getFriends();


    if (!friends.length) {

        friendsList.innerHTML =
            `<div class="friends-empty">
                No friends saved yet.
            </div>`;


        return;
    }


    friends.forEach(
        friend => {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "friend-item";


            const info =
                document.createElement(
                    "div"
                );


            info.className =
                "friend-info";


            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "friend-name";


            name.textContent =
                friend.name;


            const room =
                document.createElement(
                    "div"
                );


            room.className =
                "friend-room";


            room.textContent =
                friend.room;


            info.appendChild(
                name
            );


            info.appendChild(
                room
            );


            const call =
                document.createElement(
                    "button"
                );


            call.className =
                "friend-call";


            call.type =
                "button";


            call.textContent =
                "CALL";


            call.addEventListener(
                "click",
                () => {

                    callFriend(
                        friend.room
                    );
                }
            );


            item.appendChild(
                info
            );


            item.appendChild(
                call
            );


            friendsList.appendChild(
                item
            );
        }
    );
}


/* =========================================================
   ADD FRIEND
========================================================= */

if (friendsBtn) {

    friendsBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            renderFriends();


            openOverlay(
                friendsOverlay
            );
        }
    );
}


if (friendsCloseBtn) {

    friendsCloseBtn.addEventListener(
        "click",
        () => {

            closeOverlay(
                friendsOverlay
            );
        }
    );
}


if (addFriendConfirmBtn) {

    addFriendConfirmBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            const name =
                friendNameInput
                    ?.value
                    .trim();


            const room =
                friendRoomInput
                    ?.value
                    .trim()
                    .toUpperCase();


            if (!name) {

                alert(
                    "Friend name enter karo."
                );

                return;
            }


            if (!room) {

                alert(
                    "Friend Room ID enter karo."
                );

                return;
            }


            if (
                room ===
                getPermanentRoomCode()
            ) {

                alert(
                    "Apna Room ID friend ke roop mein add nahi kar sakte."
                );

                return;
            }


            const friends =
                getFriends();


            if (
                friends.length >=
                MAX_FRIENDS
            ) {

                alert(
                    "Maximum 6 friends allowed."
                );

                return;
            }


            const exists =
                friends.some(
                    friend =>
                        friend.room ===
                        room
                );


            if (exists) {

                alert(
                    "Ye Room ID already saved hai."
                );

                return;
            }


            friends.push({

                id:
                    Date.now()
                    .toString(),

                name:
                    name.slice(
                        0,
                        40
                    ),

                room:
                    room
            });


            saveFriends(
                friends
            );


            friendNameInput.value =
                "";


            friendRoomInput.value =
                "";


            renderFriends();


            setStatus(
                `${name} added to friends.`
            );
        }
    );
}


/* =========================================================
   CALL FRIEND
========================================================= */

function callFriend(
    targetRoom
) {

    if (!targetRoom) {
        return;
    }


    hackerBeep(
        "action"
    );


    closeOverlay(
        friendsOverlay
    );


    socket.emit(
        "call-user",
        {
            targetRoom:
                targetRoom,

            callerRoom:
                getPermanentRoomCode(),

            callerName:
                userName
        }
    );


    showConnecting(
        `Calling ${targetRoom}...`
    );


    setStatus(
        `Calling ${targetRoom}...`
    );
}


/* =========================================================
   CHAT OPEN/CLOSE
========================================================= */

if (chatBtn) {

    chatBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            chatPanel
                ?.classList
                .toggle(
                    "hidden"
                );


            if (
                !chatPanel?.classList.contains(
                    "hidden"
                )
            ) {

                setTimeout(
                    () => {

                        chatInput?.focus();

                    },
                    100
                );
            }
        }
    );
}


if (chatCloseBtn) {

    chatCloseBtn.addEventListener(
        "click",
        () => {

            closeOverlay(
                chatPanel
            );
        }
    );
}


/* =========================================================
   CHAT MESSAGE ID
========================================================= */

function createMessageId() {

    return (
        Date.now()
        .toString(36) +
        "-" +
        Math.random()
            .toString(36)
            .slice(2)
    );
}


/* =========================================================
   CHAT SEND TEXT
========================================================= */

if (chatSendBtn) {

    chatSendBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            /*
             * If media is selected,
             * Send button sends media.
             */
            if (
                selectedMediaFile
            ) {

                sendMediaFile(
                    selectedMediaFile
                );


                return;
            }


            sendChatMessage();
        }
    );
}


if (chatInput) {

    chatInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                sendChatMessage();
            }
        }
    );


    chatInput.addEventListener(
        "input",
        () => {

            socket.emit(
                "chat-typing",
                {
                    room:
                        roomCode,

                    name:
                        userName
                }
            );


            clearTimeout(
                typingTimer
            );


            typingTimer =
                setTimeout(
                    () => {

                        socket.emit(
                            "chat-stop-typing",
                            {
                                room:
                                    roomCode
                            }
                        );

                    },
                    900
                );
        }
    );
}


function sendChatMessage() {

    const text =
        chatInput
            ?.value
            .trim();


    if (!text) {
        return;
    }


    if (!roomCode) {

        alert(
            "Pehle room join karo."
        );

        return;
    }


    const message = {

        id:
            createMessageId(),

        type:
            "text",

        senderId:
            socket.id,

        senderName:
            userName,

        text:
            text,

        time:
            Date.now(),

        replyTo:
            replyTarget
                ? {
                    id:
                        replyTarget.id,

                    text:
                        replyTarget.text ||
                        "Media"
                }
                : null
    };


    appendChatMessage(
        message,
        true
    );


    socket.emit(
        "chat-message",
        {
            room:
                roomCode,

            message:
                message
        }
    );


    chatInput.value =
        "";


    clearReply();
}


/* =========================================================
   CHAT RECEIVE
========================================================= */

socket.on(
    "chat-message",
    data => {

        const message =
            data?.message ||
            data;


        if (!message) {
            return;
        }


        if (
            message.senderId ===
            socket.id
        ) {
            return;
        }


        appendChatMessage(
            message,
            false
        );
    }
);


/* =========================================================
   CHAT RENDER
========================================================= */

function appendChatMessage(
    message,
    mine
) {

    if (!chatMessages) {
        return;
    }


    const empty =
        chatMessages.querySelector(
            ".chat-empty"
        );


    if (empty) {
        empty.remove();
    }


    const wrapper =
        document.createElement(
            "div"
        );


    wrapper.className =
        "chat-message " +
        (
            mine
                ? "mine"
                : "theirs"
        );


    const sender =
        document.createElement(
            "div"
        );


    sender.className =
        "chat-sender";


    sender.textContent =
        mine
            ? "YOU"
            : (
                message.senderName ||
                "USER"
            );


    wrapper.appendChild(
        sender
    );


    /*
     * Reply preview.
     */

    if (
        message.replyTo
    ) {

        const reply =
            document.createElement(
                "div"
            );


        reply.className =
            "chat-reply-preview";


        reply.textContent =
            `↪ ${message.replyTo.text || "Message"}`;


        wrapper.appendChild(
            reply
        );
    }


    /*
     * TEXT
     */

    if (
        message.type ===
            "text" &&
        message.text
    ) {

        const text =
            document.createElement(
                "div"
            );


        text.className =
            "chat-text";


        text.textContent =
            message.text;


        wrapper.appendChild(
            text
        );
    }


    /*
     * MEDIA
     */

    if (
        message.type ===
            "image" ||
        message.type ===
            "video"
    ) {

        appendMediaMessage(
            wrapper,
            message
        );
    }


    /*
     * TIME
     */

    const time =
        document.createElement(
            "div"
        );


    time.className =
        "chat-time";


    time.textContent =
        formatTime(
            message.time
        );


    wrapper.appendChild(
        time
    );


    /*
     * Reply button.
     */

    const replyButton =
        document.createElement(
            "button"
        );


    replyButton.className =
        "chat-reply-button";


    replyButton.type =
        "button";


    replyButton.textContent =
        "↩ REPLY";


    replyButton.addEventListener(
        "click",
        () => {

            setReplyTarget(
                message
            );
        }
    );


    wrapper.appendChild(
        replyButton
    );


    chatMessages.appendChild(
        wrapper
    );


    chatMessages.scrollTop =
        chatMessages.scrollHeight;
}


/* =========================================================
   MEDIA MESSAGE
========================================================= */

function appendMediaMessage(
    wrapper,
    message
) {

    if (!message.url) {

        const waiting =
            document.createElement(
                "div"
            );


        waiting.className =
            "chat-text";


        waiting.textContent =
            "Receiving media...";


        wrapper.appendChild(
            waiting
        );


        return;
    }


    if (
        message.type ===
        "image"
    ) {

        const image =
            document.createElement(
                "img"
            );


        image.className =
            "chat-media";


        image.src =
            message.url;


        image.alt =
            message.name ||
            "Photo";


        image.loading =
            "lazy";


        wrapper.appendChild(
            image
        );
    }


    if (
        message.type ===
        "video"
    ) {

        const video =
            document.createElement(
                "video"
            );


        video.className =
            "chat-media";


        video.src =
            message.url;


        video.controls =
            true;


        video.playsInline =
            true;


        wrapper.appendChild(
            video
        );
    }


    const info =
        document.createElement(
            "div"
        );


    info.className =
        "chat-media-info";


    info.textContent =
        message.name ||
        "Media";


    const size =
        document.createElement(
            "span"
        );


    size.className =
        "chat-media-size";


    size.textContent =
        formatMB(
            message.size ||
            0
        );


    info.appendChild(
        size
    );


    wrapper.appendChild(
        info
    );
}


/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(
    timestamp
) {

    const date =
        new Date(
            timestamp ||
            Date.now()
        );


    return date.toLocaleTimeString(
        [],
        {
            hour:
                "2-digit",

            minute:
                "2-digit"
        }
    );
}


/* =========================================================
   REPLY
========================================================= */

function setReplyTarget(
    message
) {

    hackerBeep(
        "click"
    );


    replyTarget =
        message;


    if (chatReplyBar) {

        chatReplyBar.classList.remove(
            "hidden"
        );
    }


    if (chatReplyText) {

        chatReplyText.textContent =
            message.text ||
            message.name ||
            "Media";
    }


    chatInput?.focus();
}


function clearReply() {

    replyTarget =
        null;


    chatReplyBar
        ?.classList
        .add(
            "hidden"
        );
}


if (chatReplyCancelBtn) {

    chatReplyCancelBtn.addEventListener(
        "click",
        clearReply
    );
}


/* =========================================================
   MEDIA FILE SELECT
========================================================= */

if (chatFileBtn) {

    chatFileBtn.addEventListener(
        "click",
        () => {

            hackerBeep(
                "action"
            );


            chatFileInput?.click();
        }
    );
}


if (chatFileInput) {

    chatFileInput.addEventListener(
        "change",
        () => {

            const file =
                chatFileInput.files?.[0];


            if (!file) {
                return;
            }


            selectedMediaFile =
                file;


            const sizeMB =
                file.size /
                (
                    1024 *
                    1024
                );


            if (chatMediaName) {

                chatMediaName.textContent =
                    file.name;
            }


            if (chatMediaSize) {

                chatMediaSize.textContent =
                    `${sizeMB.toFixed(2)} MB`;
            }


            chatMediaPreview
                ?.classList
                .remove(
                    "hidden"
                );


            /*
             * Size check.
             */

            if (
                sizeMB >
                MAX_MEDIA_MB
            ) {

                alert(
                    `File size ${sizeMB.toFixed(2)} MB hai.\n\n` +
                    `Maximum allowed size ${MAX_MEDIA_MB} MB hai.`
                );


                clearSelectedMedia();


                return;
            }


            /*
             * IMPORTANT:
             * Do NOT send automatically.
             *
             * User can now see the size
             * and press Chat Send button.
             */

            setStatus(
                `${file.name} selected — ${sizeMB.toFixed(2)} MB`
            );
        }
    );
}


/* =========================================================
   CLEAR MEDIA
========================================================= */

if (chatMediaCancelBtn) {

    chatMediaCancelBtn.addEventListener(
        "click",
        clearSelectedMedia
    );
}


function clearSelectedMedia() {

    selectedMediaFile =
        null;


    if (chatFileInput) {

        chatFileInput.value =
            "";
    }


    chatMediaPreview
        ?.classList
        .add(
            "hidden"
        );
}


/* =========================================================
   FILE SIZE
========================================================= */

function formatMB(
    bytes
) {

    return (
        bytes /
        (
            1024 *
            1024
        )
    ).toFixed(2) +
        " MB";
}


/* =========================================================
   MEDIA SEND
========================================================= */

async function sendMediaFile(
    file
) {

    if (!file) {
        return;
    }


    if (!roomCode) {

        alert(
            "Pehle room join karo."
        );


        clearSelectedMedia();


        return;
    }


    const sizeMB =
        file.size /
        (
            1024 *
            1024
        );


    if (
        sizeMB >
        MAX_MEDIA_MB
    ) {

        alert(
            `Maximum ${MAX_MEDIA_MB} MB allowed.`
        );


        clearSelectedMedia();


        return;
    }


    try {

        setStatus(
            `Preparing ${sizeMB.toFixed(2)} MB media...`
        );


        const dataUrl =
            await fileToDataURL(
                file
            );


        const type =
            file.type.startsWith(
                "video/"
            )
                ? "video"
                : "image";


        const message = {

            id:
                createMessageId(),

            type:
                type,

            senderId:
                socket.id,

            senderName:
                userName,

            name:
                file.name,

            mime:
                file.type,

            size:
                file.size,

            dataUrl:
                dataUrl,

            time:
                Date.now(),

            replyTo:
                replyTarget
                    ? {
                        id:
                            replyTarget.id,

                        text:
                            replyTarget.text ||
                            "Media"
                    }
                    : null
        };


        /*
         * Show immediately.
         */

        appendChatMessage(
            {
                ...message,

                url:
                    dataUrl
            },
            true
        );


        /*
         * Send to server.
         */

        socket.emit(
            "chat-media",
            {
                room:
                    roomCode,

                message:
                    message
            }
        );


        clearSelectedMedia();

        clearReply();


        setStatus(
            `${file.name} sent (${sizeMB.toFixed(2)} MB).`
        );

    } catch (error) {

        console.error(
            "Media send error:",
            error
        );


        alert(
            "Media send nahi ho paya."
        );


        clearSelectedMedia();
    }
}


/* =========================================================
   FILE TO DATA URL
========================================================= */

function fileToDataURL(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );
                };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );
        }
    );
}


/* =========================================================
   RECEIVE MEDIA
========================================================= */

socket.on(
    "chat-media",
    data => {

        const message =
            data?.message ||
            data;


        if (!message) {
            return;
        }


        if (
            message.senderId ===
            socket.id
        ) {
            return;
        }


        if (
            !message.dataUrl
        ) {

            appendChatMessage(
                message,
                false
            );


            return;
        }


        appendChatMessage(
            {
                ...message,

                url:
                    message.dataUrl
            },
            false
        );
    }
);


/* =========================================================
   TYPING
========================================================= */

socket.on(
    "chat-typing",
    data => {

        if (!typingIndicator) {
            return;
        }


        if (
            data?.senderId ===
            socket.id
        ) {
            return;
        }


        typingIndicator.textContent =
            `${data?.name || "User"} is typing...`;
    }
);


socket.on(
    "chat-stop-typing",
    () => {

        if (
            typingIndicator
        ) {

            typingIndicator.textContent =
                "";
        }
    }
);


/* =========================================================
   QR SCANNER
========================================================= */

if (scanBtn) {

    scanBtn.addEventListener(
        "click",
        startScanner
    );
}


async function startScanner() {

    hackerBeep(
        "action"
    );


    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        alert(
            "QR scanner library load nahi hui."
        );


        return;
    }


    if (!scanner) {
        return;
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
                fps:
                    10,

                qrbox:
                    220
            },

            async decodedText => {

                hackerBeep(
                    "action"
                );


                let code =
                    decodedText;


                try {

                    const url =
                        new URL(
                            decodedText
                        );


                    const urlRoom =
                        url.searchParams.get(
                            "room"
                        );


                    if (urlRoom) {

                        code =
                            urlRoom;
                    }

                } catch {}


                code =
                    String(
                        code
                    )
                    .trim()
                    .toUpperCase();


                if (!code) {
                    return;
                }


                try {

                    await scannerInstance
                        .stop();


                    await scannerInstance
                        .clear();

                } catch {}


                scanner.classList.add(
                    "hidden"
                );


                if (joinRoomInput) {

                    joinRoomInput.value =
                        code;
                }


                closeOverlay(
                    joinRoomOverlay
                );


                socket.emit(
                    "call-user",
                    {
                        targetRoom:
                            code,

                        callerRoom:
                            getPermanentRoomCode(),

                        callerName:
                            userName
                    }
                );


                showConnecting(
                    `Calling ${code}...`
                );


                setStatus(
                    `Calling Room ${code}...`
                );
            },

            () => {}
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


/* =========================================================
   AUTO JOIN ROOM FROM URL
========================================================= */

const urlParams =
    new URLSearchParams(
        window.location.search
    );


const roomFromUrl =
    urlParams.get(
        "room"
    );


if (roomFromUrl) {

    const target =
        roomFromUrl
            .trim()
            .toUpperCase();


    setTimeout(
        () => {

            if (
                target ===
                getPermanentRoomCode()
            ) {

                joinOwnRoom();


                return;
            }


            if (joinRoomInput) {

                joinRoomInput.value =
                    target;
            }


            openOverlay(
                joinRoomOverlay
            );

        },
        1000
    );
}


/* =========================================================
   START OWN ROOM ON SOCKET CONNECT
========================================================= */

socket.on(
    "connect",
    () => {

        setTimeout(
            () => {

                if (
                    !roomFromUrl
                ) {

                    joinOwnRoom();
                }

            },
            500
        );
    }
);


/* =========================================================
   USER NAME
========================================================= */

function setupUserName() {

    let saved =
        localStorage.getItem(
            STORAGE_USER_NAME
        );


    if (
        saved &&
        saved.trim()
    ) {

        userName =
            saved
                .trim()
                .slice(
                    0,
                    40
                );


        return;
    }


    userName =
        "USER";


    localStorage.setItem(
        STORAGE_USER_NAME,
        userName
    );
}


setupUserName();


/* =========================================================
   FRIENDS INITIALIZATION
========================================================= */

renderFriends();


/* =========================================================
   INITIAL UI
========================================================= */

applyMirror();

applyFilter();

updateOnlineCount(
    1
);


setStatus(
    "System ready. Waiting for connection..."
);


/* =========================================================
   DEBUG
========================================================= */

console.log(
    "%cJH SECURE CAM",
    "color:#00ff66;font-size:20px;font-weight:bold"
);


console.log(
    "Camera Switch:",
    !!switchCameraBtn
);


console.log(
    "Mirror:",
    !!mirrorBtn
);


console.log(
    "Filters:",
    filterOptions.length
);


console.log(
    "Chat:",
    !!chatPanel
);


console.log(
    "Friends:",
    !!friendsList
);


console.log(
    "Hacker Sound:",
    "ENABLED"
);

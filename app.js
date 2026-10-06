/* =========================================================
   ROUSHAN//CALL
   APP.JS
   WebRTC + Socket.IO + QR + 6 CCTV TILES
   ========================================================= */

"use strict";

/* =========================================================
   SOCKET
   ========================================================= */

const socket = io();

/* =========================================================
   STATE
   ========================================================= */

let roomCode = "";
let targetRoomCode = "";

let localStream = null;
let currentFacingMode = "user";
let isMuted = false;

let activeCall = false;
let incomingCallerId = null;
let incomingCallerRoom = null;

const peers = {};
const remoteTiles = {};

let ownRoomUsers = [];
let connectedUserCount = 1;

/* =========================================================
   DOM
   ========================================================= */

const roomInput = document.getElementById("roomInput");
const targetRoomInput = document.getElementById("targetRoomInput");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const scanBtn = document.getElementById("scanBtn");
const notificationBtn = document.getElementById("notificationBtn");

const qrBox = document.getElementById("qrBox");
const qrcode = document.getElementById("qrcode");
const scanner = document.getElementById("scanner");

const statusEl = document.getElementById("status");
const connectionState = document.getElementById("connectionState");
const onlineCount = document.getElementById("onlineCount");

const localVideo = document.getElementById("localVideo");

const cameraBtn = document.getElementById("cameraBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const micBtn = document.getElementById("micBtn");
const endBtn = document.getElementById("endBtn");

const incomingCallOverlay =
  document.getElementById("incomingCallOverlay");

const incomingCallerText =
  document.getElementById("incomingCallerText");

const acceptCallBtn =
  document.getElementById("acceptCallBtn");

const rejectCallBtn =
  document.getElementById("rejectCallBtn");

const connectingOverlay =
  document.getElementById("connectingOverlay");

const connectingText =
  document.getElementById("connectingText");

const cameraTiles = [
  document.getElementById("localTile"),
  document.getElementById("cameraTile2"),
  document.getElementById("cameraTile3"),
  document.getElementById("cameraTile4"),
  document.getElementById("cameraTile5"),
  document.getElementById("cameraTile6")
];

const remoteVideos = [
  null,
  document.getElementById("remoteVideo"),
  document.getElementById("remoteVideo3"),
  document.getElementById("remoteVideo4"),
  document.getElementById("remoteVideo5"),
  document.getElementById("remoteVideo6")
];

/* =========================================================
   WEBRTC
   ========================================================= */

const rtcConfig = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302"
      ]
    }
  ]
};

/* =========================================================
   HELPERS
   ========================================================= */

function log(message) {
  console.log("[ROUSHAN//CALL]", message);
}

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }

  log(message);
}

function showConnecting(message) {
  if (connectingText) {
    connectingText.textContent = message;
  }

  if (connectingOverlay) {
    connectingOverlay.classList.remove("hidden");
  }
}

function hideConnecting() {
  if (connectingOverlay) {
    connectingOverlay.classList.add("hidden");
  }
}

function updateOnlineCount(count) {
  count = Number(count);

  if (!Number.isFinite(count)) {
    count = connectedUserCount || 1;
  }

  connectedUserCount = Math.max(1, Math.min(6, count));

  if (onlineCount) {
    onlineCount.textContent =
      `${connectedUserCount} / 6 ONLINE`;
  }
}

/* =========================================================
   PERMANENT ROOM ID
   ========================================================= */

function generateRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < 6; i++) {
    result += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return result;
}

function getPermanentRoomCode() {

  let saved =
    localStorage.getItem("roushanPermanentRoom");

  if (
    !saved ||
    typeof saved !== "string" ||
    saved.length !== 6
  ) {
    saved = generateRoomCode();

    localStorage.setItem(
      "roushanPermanentRoom",
      saved
    );
  }

  return saved.toUpperCase();
}

function showPermanentRoom() {

  roomCode = getPermanentRoomCode();

  if (roomInput) {
    roomInput.value = roomCode;
    roomInput.readOnly = true;
    roomInput.setAttribute("readonly", "readonly");
  }
}

/* =========================================================
   SOCKET CONNECTION
   ========================================================= */

socket.on("connect", () => {

  connectionState.textContent = "ONLINE";

  setStatus(
    "ROOM CONNECTED // SIGNAL SERVER ONLINE"
  );

  showPermanentRoom();

  setTimeout(() => {
    joinOwnRoom();
  }, 300);
});

socket.on("disconnect", () => {

  connectionState.textContent = "OFFLINE";

  setStatus(
    "SIGNAL SERVER DISCONNECTED"
  );
});

/* =========================================================
   JOIN OWN PERMANENT ROOM
   ========================================================= */

function joinOwnRoom() {

  roomCode = getPermanentRoomCode();

  if (!socket.connected) {
    return;
  }

  socket.emit(
    "join-room",
    {
      room: roomCode
    }
  );

  log(
    "Joining own room: " + roomCode
  );
}

/* =========================================================
   CREATE ROOM / QR
   ========================================================= */

createBtn.addEventListener("click", async () => {

  roomCode = getPermanentRoomCode();

  roomInput.value = roomCode;

  createQRCode(roomCode);

  if (!localStream) {
    await startCamera();
  }

  joinOwnRoom();

  setStatus(
    "YOUR ROOM IS READY // " + roomCode
  );
});

function createQRCode(code) {

  if (!qrcode || typeof QRCode === "undefined") {
    setStatus("QR LIBRARY NOT LOADED");
    return;
  }

  qrcode.innerHTML = "";

  const joinUrl =
    window.location.origin +
    window.location.pathname +
    "?room=" +
    encodeURIComponent(code);

  new QRCode(qrcode, {
    text: joinUrl,
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.M
  });

  qrBox.classList.remove("hidden");
}

/* =========================================================
   TARGET ROOM CALL
   ========================================================= */

joinBtn.addEventListener("click", async () => {

  const value =
    targetRoomInput.value.trim().toUpperCase();

  if (!value) {
    alert("Target Room ID enter karo.");
    return;
  }

  if (value === roomCode) {
    alert(
      "Ye tumhara apna room ID hai."
    );
    return;
  }

  targetRoomCode = value;

  if (!localStream) {
    await startCamera();
  }

  joinOwnRoom();

  showConnecting(
    "CALLING ROOM " + targetRoomCode
  );

  setStatus(
    "CALLING ROOM // " + targetRoomCode
  );

  socket.emit(
    "call-user",
    {
      targetRoom: targetRoomCode
    }
  );
});

/* =========================================================
   ROOM JOINED
   ========================================================= */

socket.on(
  "room-joined",
  async (data) => {

    log("room-joined");

    const users =
      Array.isArray(data?.users)
        ? data.users
        : [];

    ownRoomUsers = users;

    const count =
      Number(data?.count) ||
      users.length + 1 ||
      1;

    updateOnlineCount(count);

    if (!localStream) {
      await startCamera();
    }

    setStatus(
      `ROOM CONNECTED // ${count}/6 ONLINE`
    );
  }
);

/* =========================================================
   ROOM FULL
   ========================================================= */

socket.on("room-full", () => {

  hideConnecting();

  setStatus(
    "ROOM FULL // MAXIMUM 6 USERS"
  );

  alert(
    "Ye room already 6 users se full hai."
  );
});

/* =========================================================
   PEER JOINED
   ========================================================= */

socket.on(
  "peer-joined",
  async ({ peerId }) => {

    log("Peer joined: " + peerId);

    if (!peerId) return;

    ownRoomUsers.push(peerId);

    updateOnlineCount(
      Math.min(
        6,
        Math.max(
          1,
          ownRoomUsers.length + 1
        )
      )
    );

    /*
      Agar current user active call mein hai,
      naye user ke saath WebRTC connection start karo.
    */

    if (activeCall) {

      if (!localStream) {
        await startCamera();
      }

      if (!peers[peerId]) {
        await createPeer(
          peerId,
          true
        );
      }
    }
  }
);

/* =========================================================
   INCOMING CALL
   ========================================================= */

socket.on(
  "incoming-call",
  async (data) => {

    incomingCallerId =
      data?.callerId || null;

    incomingCallerRoom =
      data?.callerRoom || data?.room || "";

    const displayRoom =
      incomingCallerRoom || "UNKNOWN";

    incomingCallerText.textContent =
      "ROOM " +
      displayRoom +
      " IS CALLING YOU...";

    incomingCallOverlay.classList.remove(
      "hidden"
    );

    setStatus(
      "INCOMING CALL // " +
      displayRoom
    );

    /*
      Camera ko pehle se start karna zaroori nahi.
      Accept ke time start hogi.
    */
  }
);

/* =========================================================
   ACCEPT CALL
   ========================================================= */

acceptCallBtn.addEventListener(
  "click",
  async () => {

    incomingCallOverlay.classList.add(
      "hidden"
    );

    if (!incomingCallerId) {
      setStatus(
        "CALL ERROR // CALLER NOT FOUND"
      );
      return;
    }

    activeCall = true;

    showConnecting(
      "ACCEPTING INCOMING CALL..."
    );

    if (!localStream) {
      await startCamera();
    }

    socket.emit(
      "accept-call",
      {
        callerId: incomingCallerId,
        callerRoom: incomingCallerRoom
      }
    );

    /*
      Caller call accept hone ke baad offer
      create karega.
    */

    setStatus(
      "CALL ACCEPTED // WAITING FOR VIDEO"
    );
  }
);

/* =========================================================
   REJECT CALL
   ========================================================= */

rejectCallBtn.addEventListener(
  "click",
  () => {

    incomingCallOverlay.classList.add(
      "hidden"
    );

    if (incomingCallerId) {

      socket.emit(
        "reject-call",
        {
          callerId: incomingCallerId
        }
      );
    }

    incomingCallerId = null;
    incomingCallerRoom = null;

    setStatus(
      "INCOMING CALL REJECTED"
    );
  }
);

/* =========================================================
   CALL ACCEPTED
   ========================================================= */

socket.on(
  "call-accepted",
  async (data) => {

    hideConnecting();

    activeCall = true;

    const targetId =
      data?.targetId ||
      data?.userId ||
      data?.receiverId;

    if (!targetId) {
      setStatus(
        "CALL ACCEPTED // PEER ID MISSING"
      );
      return;
    }

    setStatus(
      "CALL ACCEPTED // CONNECTING VIDEO"
    );

    if (!localStream) {
      await startCamera();
    }

    /*
      Caller offer create karega.
    */

    await createPeer(
      targetId,
      true
    );
  }
);

/* =========================================================
   CALL REJECTED
   ========================================================= */

socket.on(
  "call-rejected",
  () => {

    hideConnecting();

    activeCall = false;

    setStatus(
      "CALL REJECTED"
    );
  }
);

/* =========================================================
   CALL RINGING
   ========================================================= */

socket.on(
  "call-ringing",
  () => {

    setStatus(
      "CALL RINGING // WAITING FOR ACCEPT"
    );
  }
);

/* =========================================================
   CALL UNAVAILABLE
   ========================================================= */

socket.on(
  "call-unavailable",
  () => {

    hideConnecting();

    setStatus(
      "CALL UNAVAILABLE // USER OFFLINE"
    );

    alert(
      "Target room mein koi available user nahi hai."
    );
  }
);

/* =========================================================
   WEBRTC SIGNAL
   ========================================================= */

socket.on(
  "signal",
  async ({ sender, data }) => {

    if (!sender || !data) {
      return;
    }

    try {

      let peer = peers[sender];

      /*
        Offer receive hua:
        peer create karo bina offer ke.
      */

      if (data.type === "offer") {

        if (!peer) {

          peer =
            await createPeer(
              sender,
              false
            );
        }

        await peer.setRemoteDescription(
          new RTCSessionDescription(data)
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
            data: peer.localDescription
          }
        );

        activeCall = true;

        hideConnecting();

        setStatus(
          "VIDEO SIGNAL RECEIVED // CONNECTING"
        );

        return;
      }


      /*
        Answer receive hua.
      */

      if (data.type === "answer") {

        if (!peer) {
          return;
        }

        await peer.setRemoteDescription(
          new RTCSessionDescription(data)
        );

        hideConnecting();

        setStatus(
          "VIDEO CONNECTION ESTABLISHED"
        );

        return;
      }


      /*
        ICE candidate.
      */

      if (
        data.candidate !== undefined &&
        data.candidate !== null
      ) {

        if (!peer) {
          peer =
            await createPeer(
              sender,
              false
            );
        }

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

        return;
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

/* =========================================================
   CREATE PEER
   ========================================================= */

async function createPeer(
  peerId,
  createOffer
) {

  if (!peerId) {
    return null;
  }

  /*
    Existing peer return karo.
  */

  if (peers[peerId]) {
    return peers[peerId];
  }

  const pc =
    new RTCPeerConnection(
      rtcConfig
    );

  peers[peerId] = pc;

  /*
    LOCAL TRACKS
  */

  if (localStream) {

    localStream
      .getTracks()
      .forEach((track) => {

        pc.addTrack(
          track,
          localStream
        );

      });
  }

  /*
    ICE
  */

  pc.onicecandidate = (event) => {

    if (
      event.candidate
    ) {

      socket.emit(
        "signal",
        {
          target: peerId,
          data: {
            candidate:
              event.candidate
          }
        }
      );
    }
  };

  /*
    REMOTE TRACK
  */

  pc.ontrack = (event) => {

    const stream =
      event.streams &&
      event.streams[0];

    if (!stream) {
      return;
    }

    attachRemoteVideo(
      peerId,
      stream
    );

    hideConnecting();

    activeCall = true;

    setStatus(
      "LIVE VIDEO // CONNECTION SECURE"
    );
  };

  /*
    CONNECTION STATE
  */

  pc.onconnectionstatechange = () => {

    const state =
      pc.connectionState;

    log(
      `Peer ${peerId}: ${state}`
    );

    if (
      state === "connected"
    ) {

      hideConnecting();

      activeCall = true;

      setStatus(
        "LIVE // VIDEO CONNECTION ACTIVE"
      );
    }

    if (
      state === "failed"
    ) {

      setStatus(
        "CONNECTION FAILED // NETWORK MAY REQUIRE TURN"
      );
    }

    if (
      state === "disconnected"
    ) {

      setStatus(
        "PEER DISCONNECTED"
      );
    }

    if (
      state === "closed"
    ) {

      removeRemoteVideo(
        peerId
      );
    }
  };

  /*
    NEGOTIATION
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
          target: peerId,
          data: pc.localDescription
        }
      );

    } catch (error) {

      console.error(
        "OFFER ERROR:",
        error
      );
    }
  }

  return pc;
}

/* =========================================================
   REMOTE VIDEO TILE
   ========================================================= */

function attachRemoteVideo(
  peerId,
  stream
) {

  /*
    Existing tile check.
  */

  if (
    remoteTiles[peerId]
  ) {

    const video =
      remoteTiles[peerId].video;

    if (
      video.srcObject !== stream
    ) {
      video.srcObject = stream;
    }

    remoteTiles[peerId]
      .tile
      .classList.remove("empty");

    return;
  }

  /*
    First free tile.
    */

  let tileIndex = -1;

  for (
    let i = 1;
    i < cameraTiles.length;
    i++
  ) {

    const tile =
      cameraTiles[i];

    if (
      !tile ||
      !tile.dataset.peerId
    ) {

      tileIndex = i;
      break;
    }
  }

  /*
    5 remote slots full.
  */

  if (tileIndex === -1) {

    console.warn(
      "No free CCTV tile for:",
      peerId
    );

    return;
  }

  const tile =
    cameraTiles[tileIndex];

  const video =
    remoteVideos[tileIndex];

  if (!tile || !video) {
    return;
  }

  tile.dataset.peerId =
    peerId;

  video.srcObject =
    stream;

  tile.classList.remove(
    "empty"
  );

  /*
    Update label.
  */

  const label =
    tile.querySelector(
      ".camera-label"
    );

  if (label) {

    label.textContent =
      `CAM_0${tileIndex + 1} // USER ● LIVE`;
  }

  remoteTiles[peerId] = {
    tile,
    video,
    index: tileIndex
  };

  updateOnlineCount(
    Object.keys(peers).length + 1
  );
}

/* =========================================================
   REMOVE REMOTE TILE
   ========================================================= */

function removeRemoteVideo(
  peerId
) {

  const info =
    remoteTiles[peerId];

  if (!info) {
    return;
  }

  const {
    tile,
    video,
    index
  } = info;

  if (video) {
    video.srcObject = null;
  }

  if (tile) {

    tile.dataset.peerId = "";

    tile.classList.add(
      "empty"
    );

    const label =
      tile.querySelector(
        ".camera-label"
      );

    if (label) {

      label.textContent =
        `CAM_0${index + 1} // USER ● WAITING`;
    }
  }

  delete remoteTiles[peerId];

  updateOnlineCount(
    Object.keys(peers).length + 1
  );
}

/* =========================================================
   PEER LEFT
   ========================================================= */

socket.on(
  "peer-left",
  ({ peerId }) => {

    log(
      "Peer left: " + peerId
    );

    if (
      peers[peerId]
    ) {

      try {
        peers[peerId].close();
      } catch (_) {}

      delete peers[peerId];
    }

    removeRemoteVideo(
      peerId
    );

    ownRoomUsers =
      ownRoomUsers.filter(
        id => id !== peerId
      );

    updateOnlineCount(
      Object.keys(peers).length + 1
    );
  }
);

/* =========================================================
   CAMERA
   ========================================================= */

cameraBtn.addEventListener(
  "click",
  async () => {

    if (localStream) {

      stopLocalStream();

      cameraBtn.textContent =
        "START CAMERA";

      setStatus(
        "CAMERA OFFLINE"
      );

      return;
    }

    await startCamera();
  }
);

async function startCamera() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      throw new Error(
        "Camera API unavailable"
      );
    }

    /*
      Purana stream stop.
    */

    if (localStream) {
      stopLocalStream();
    }

    localStream =
      await navigator.mediaDevices.getUserMedia(
        {
          video: {
            facingMode: {
              ideal: currentFacingMode
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

    localVideo.srcObject =
      localStream;

    cameraBtn.textContent =
      "STOP CAMERA";

    isMuted = false;

    micBtn.textContent =
      "MUTE MIC";

    /*
      Existing peers mein new tracks replace/add.
    */

    for (
      const peerId of Object.keys(peers)
    ) {

      const pc =
        peers[peerId];

      const senders =
        pc.getSenders();

      for (
        const track of localStream.getTracks()
      ) {

        const sender =
          senders.find(
            s =>
              s.track &&
              s.track.kind === track.kind
          );

        if (sender) {

          try {

            await sender.replaceTrack(
              track
            );

          } catch (error) {

            console.warn(
              "replaceTrack error:",
              error
            );
          }

        } else {

          try {

            pc.addTrack(
              track,
              localStream
            );

          } catch (error) {

            console.warn(
              "addTrack error:",
              error
            );
          }
        }
      }
    }

    setStatus(
      "LOCAL CAMERA ONLINE // CAM_01"
    );

    return localStream;

  } catch (error) {

    console.error(
      "CAMERA ERROR:",
      error
    );

    setStatus(
      "CAMERA ERROR // PERMISSION REQUIRED"
    );

    alert(
      "Camera/Microphone permission allow karo."
    );

    return null;
  }
}

/* =========================================================
   STOP LOCAL STREAM
   ========================================================= */

function stopLocalStream() {

  if (!localStream) {
    return;
  }

  localStream
    .getTracks()
    .forEach(
      track => track.stop()
    );

  localStream = null;

  if (localVideo) {
    localVideo.srcObject = null;
  }
}

/* =========================================================
   SWITCH CAMERA
   ========================================================= */

switchCameraBtn.addEventListener(
  "click",
  async () => {

    if (!localStream) {

      await startCamera();
      return;
    }

    currentFacingMode =
      currentFacingMode === "user"
        ? "environment"
        : "user";

    const oldStream =
      localStream;

    try {

      const newStream =
        await navigator.mediaDevices.getUserMedia(
          {
            video: {
              facingMode: {
                exact:
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

      const newVideoTrack =
        newStream.getVideoTracks()[0];

      if (!newVideoTrack) {
        throw new Error(
          "No camera track"
        );
      }

      /*
        Replace video track in every peer.
      */

      for (
        const peerId of Object.keys(peers)
      ) {

        const pc =
          peers[peerId];

        const sender =
          pc.getSenders().find(
            s =>
              s.track &&
              s.track.kind === "video"
          );

        if (sender) {

          await sender.replaceTrack(
            newVideoTrack
          );
        }
      }

      /*
        Old video track stop.
      */

      oldStream
        .getVideoTracks()
        .forEach(
          track => track.stop()
        );

      /*
        Keep old audio track.
      */

      const audioTrack =
        oldStream.getAudioTracks()[0];

      localStream =
        new MediaStream();

      localStream.addTrack(
        newVideoTrack
      );

      if (audioTrack) {

        localStream.addTrack(
          audioTrack
        );
      }

      localVideo.srcObject =
        localStream;

      setStatus(
        currentFacingMode === "user"
          ? "FRONT CAMERA ACTIVE"
          : "BACK CAMERA ACTIVE"
      );

    } catch (error) {

      console.error(
        "SWITCH CAMERA ERROR:",
        error
      );

      /*
        Some phones don't support
        exact facingMode.
      */

      currentFacingMode =
        currentFacingMode === "user"
          ? "environment"
          : "user";

      setStatus(
        "CAMERA SWITCH FAILED"
      );
    }
  }
);

/* =========================================================
   MICROPHONE
   ========================================================= */

micBtn.addEventListener(
  "click",
  () => {

    if (!localStream) {

      setStatus(
        "START CAMERA FIRST"
      );

      return;
    }

    const audioTracks =
      localStream.getAudioTracks();

    if (!audioTracks.length) {
      return;
    }

    isMuted = !isMuted;

    audioTracks.forEach(
      track => {
        track.enabled = !isMuted;
      }
    );

    micBtn.textContent =
      isMuted
        ? "UNMUTE MIC"
        : "MUTE MIC";

    setStatus(
      isMuted
        ? "MIC MUTED"
        : "MIC ACTIVE"
    );
  }
);

/* =========================================================
   END CALL
   ========================================================= */

endBtn.addEventListener(
  "click",
  () => {

    endCall();
  }
);

function endCall() {

  activeCall = false;

  /*
    Close every WebRTC peer.
  */

  Object.keys(peers)
    .forEach(
      peerId => {

        try {
          peers[peerId].close();
        } catch (_) {}

        delete peers[peerId];

        removeRemoteVideo(
          peerId
        );
      }
    );

  /*
    Local camera stop.
  */

  stopLocalStream();

  cameraBtn.textContent =
    "START CAMERA";

  micBtn.textContent =
    "MUTE MIC";

  isMuted = false;

  hideConnecting();

  incomingCallOverlay.classList.add(
    "hidden"
  );

  /*
    IMPORTANT:
    Permanent room se leave nahi kar rahe.
    Isse END ke baad bhi room incoming call
    receive kar sakta hai.
  */

  joinOwnRoom();

  updateOnlineCount(1);

  setStatus(
    "CALL ENDED // ROOM STILL ONLINE"
  );
}

/* =========================================================
   QR SCANNER
   ========================================================= */

let html5QrCode = null;
let scannerRunning = false;

scanBtn.addEventListener(
  "click",
  async () => {

    if (
      typeof Html5Qrcode ===
      "undefined"
    ) {

      alert(
        "QR scanner library load nahi hui."
      );

      return;
    }

    if (scannerRunning) {

      await stopScanner();
      return;
    }

    scanner.classList.remove(
      "hidden"
    );

    html5QrCode =
      new Html5Qrcode(
        "scanner"
      );

    scannerRunning = true;

    try {

      await html5QrCode.start(
        {
          facingMode: "environment"
        },
        {
          fps: 10,
          qrbox: {
            width: 250,
            height: 250
          }
        },
        async (decodedText) => {

          await handleScannedQR(
            decodedText
          );
        },
        () => {}
      );

      scanBtn.textContent =
        "[ STOP SCAN ]";

      setStatus(
        "QR SCANNER ACTIVE"
      );

    } catch (error) {

      console.error(
        "QR START ERROR:",
        error
      );

      scannerRunning = false;

      scanner.classList.add(
        "hidden"
      );

      alert(
        "QR scanner start nahi ho saka."
      );
    }
  }
);

/* =========================================================
   QR RESULT
   ========================================================= */

async function handleScannedQR(
  text
) {

  let code = "";

  try {

    const url =
      new URL(text);

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

  } catch (_) {

    /*
      Plain room code.
    */

    code =
      String(text)
        .trim()
        .toUpperCase();
  }

  if (!code) {
    return;
  }

  await stopScanner();

  targetRoomInput.value =
    code;

  /*
    QR se direct CALL.
  */

  if (
    code === roomCode
  ) {

    setStatus(
      "QR IS YOUR OWN ROOM"
    );

    return;
  }

  if (!localStream) {
    await startCamera();
  }

  targetRoomCode =
    code;

  showConnecting(
    "QR CALLING ROOM " +
    code
  );

  setStatus(
    "QR CALL // " + code
  );

  socket.emit(
    "call-user",
    {
      targetRoom: code
    }
  );
}

/* =========================================================
   STOP SCANNER
   ========================================================= */

async function stopScanner() {

  if (
    html5QrCode &&
    scannerRunning
  ) {

    try {
      await html5QrCode.stop();
    } catch (_) {}

    try {
      html5QrCode.clear();
    } catch (_) {}
  }

  html5QrCode = null;
  scannerRunning = false;

  scanner.classList.add(
    "hidden"
  );

  scanBtn.textContent =
    "[ SCAN QR ]";
}

/* =========================================================
   URL ROOM
   ========================================================= */

async function handleRoomFromURL() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const room =
    params.get("room");

  if (!room) {
    return;
  }

  const code =
    room.trim().toUpperCase();

  if (!code) {
    return;
  }

  /*
    Apna hi QR scan hua ho to call mat karo.
  */

  if (code === roomCode) {

    targetRoomInput.value =
      code;

    createQRCode(code);

    setStatus(
      "YOUR ROOM QR OPENED"
    );

    return;
  }

  targetRoomInput.value =
    code;

  targetRoomCode =
    code;

  /*
    Socket connected hone ke baad
    call karo.
  */

  if (!socket.connected) {
    return;
  }

  if (!localStream) {
    await startCamera();
  }

  showConnecting(
    "QR CALLING ROOM " + code
  );

  setStatus(
    "QR ROOM DETECTED // CALLING"
  );

  socket.emit(
    "call-user",
    {
      targetRoom: code
    }
  );
}

/* =========================================================
   NOTIFICATIONS
   ========================================================= */

notificationBtn.addEventListener(
  "click",
  async () => {

    await setupNotifications(
      true
    );
  }
);

async function setupNotifications(
  askPermission = false
) {

  if (
    !("serviceWorker" in navigator)
  ) {

    setStatus(
      "PUSH NOTIFICATIONS NOT SUPPORTED"
    );

    return;
  }

  if (
    !("PushManager" in window)
  ) {

    setStatus(
      "PUSH NOTIFICATIONS NOT SUPPORTED"
    );

    return;
  }

  try {

    const registration =
      await navigator.serviceWorker.register(
        "/sw.js"
      );

    let permission =
      Notification.permission;

    if (
      askPermission &&
      permission !== "granted"
    ) {

      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {

      setStatus(
        "NOTIFICATION PERMISSION NOT GRANTED"
      );

      return;
    }

    const keyResponse =
      await fetch(
        "/api/vapid-public-key"
      );

    if (!keyResponse.ok) {
      throw new Error(
        "VAPID key request failed"
      );
    }

    const keyData =
      await keyResponse.json();

    if (!keyData.publicKey) {
      throw new Error(
        "VAPID public key missing"
      );
    }

    const applicationServerKey =
      urlBase64ToUint8Array(
        keyData.publicKey
      );

    let subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) {

      subscription =
        await registration.pushManager.subscribe(
          {
            userVisibleOnly: true,
            applicationServerKey
          }
        );
    }

    const response =
      await fetch(
        "/api/subscribe",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            room: roomCode,
            subscription
          })
        }
      );

    if (!response.ok) {
      throw new Error(
        "Subscription save failed"
      );
    }

    setStatus(
      "PUSH NOTIFICATIONS ENABLED"
    );

    notificationBtn.textContent =
      "[ NOTIFY ON ]";

  } catch (error) {

    console.error(
      "NOTIFICATION ERROR:",
      error
    );

    setStatus(
      "NOTIFICATION SETUP FAILED"
    );
  }
}

/* =========================================================
   BASE64 -> UINT8
   ========================================================= */

function urlBase64ToUint8Array(
  base64String
) {

  const padding =
    "=".repeat(
      (4 -
        (base64String.length % 4)) %
      4
    );

  const base64 =
    (
      base64String
        .replace(/-/g, "+")
        .replace(/_/g, "/") +
      padding
    );

  const rawData =
    window.atob(base64);

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
      rawData.charCodeAt(i);
  }

  return outputArray;
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

  showPermanentRoom();

  updateOnlineCount(1);

  /*
    Notification permission automatically
    request nahi karenge.
    User [ NOTIFY ] dabayega.
  */

  if (
    "serviceWorker" in navigator
  ) {

    try {

      await navigator.serviceWorker.register(
        "/sw.js"
      );

    } catch (error) {

      console.warn(
        "Service worker registration failed:",
        error
      );
    }
  }

  /*
    URL mein ?room=XXXX hai to
    QR auto-call.
  */

  if (
    window.location.search
  ) {

    setTimeout(
      () => {
        handleRoomFromURL();
      },
      1000
    );
  }

  setStatus(
    "SYSTEM READY // ROOM " +
    roomCode
  );
}

/* =========================================================
   START
   ========================================================= */

init();

/* =========================================================
   ROUSHAN CCTV CALL
   FINAL APP.JS
========================================================= */

"use strict";


/* =========================================================
   SOCKET
========================================================= */

const socket = io();


/* =========================================================
   GLOBAL CONFIG
========================================================= */

const MAX_USERS = 6;

const MAX_FRIENDS = 50;

const MAX_MEDIA_SIZE =
  50 * 1024 * 1024; // 50 MB

const FRIENDS_STORAGE_KEY =
  "roushanFriends";

const ROOM_STORAGE_KEY =
  "roushanPermanentRoom";

const MIRROR_STORAGE_KEY =
  "roushanMirrorCamera";

const FILTER_STORAGE_KEY =
  "roushanCameraFilter";


/* =========================================================
   WEBRTC CONFIG
========================================================= */

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


/* =========================================================
   STATE
========================================================= */

let roomCode = "";

let localStream = null;

let currentFacingMode = "user";

let isMuted = false;

let isMirrored = false;

let currentFilter = "none";

let activeCall = false;

let currentTargetRoom = "";

let incomingCallerId = "";

let incomingCallerRoom = "";

let scannerInstance = null;

let scannerRunning = false;

let selectedMediaFile = null;

let replyToMessage = null;

let unreadMessages = 0;

let chatOpen = false;

let currentCallRoom = "";

let socketConnected = false;


/* =========================================================
   PEERS
========================================================= */

const peers = {};


/* =========================================================
   REMOTE STREAMS
========================================================= */

const remoteStreams = {};


/* =========================================================
   REMOTE TILE MAP
========================================================= */

const remoteTiles = [
  {
    tile: "cameraTile2",
    video: "remoteVideo",
    label: "cameraLabel2"
  },
  {
    tile: "cameraTile3",
    video: "remoteVideo3",
    label: "cameraLabel3"
  },
  {
    tile: "cameraTile4",
    video: "remoteVideo4",
    label: "cameraLabel4"
  },
  {
    tile: "cameraTile5",
    video: "remoteVideo5",
    label: "cameraLabel5"
  },
  {
    tile: "cameraTile6",
    video: "remoteVideo6",
    label: "cameraLabel6"
  }
];


/* =========================================================
   DOM HELPER
========================================================= */

const $ = id => document.getElementById(id);

const qs = selector =>
  document.querySelector(selector);

const qsa = selector =>
  document.querySelectorAll(selector);


/* =========================================================
   DOM REFERENCES
========================================================= */

const app =
  $("app");

const roomInput =
  $("roomInput");

const targetRoomInput =
  $("targetRoomInput");

const statusEl =
  $("status");

const systemStatus =
  $("systemStatus");

const connectionState =
  $("connectionState");

const connectionDot =
  $("connectionDot");

const currentRoomDisplay =
  $("currentRoomDisplay");

const onlineCount =
  $("onlineCount");


/* =========================================================
   VIDEO ELEMENTS
========================================================= */

const localVideo =
  $("localVideo");

const localTile =
  $("localTile");

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


/* =========================================================
   CONTROL BUTTONS
========================================================= */

const micBtn =
  $("micBtn");

const mirrorBtn =
  $("mirrorBtn");

const switchCameraBtn =
  $("switchCameraBtn");

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
   ROOM PANEL
========================================================= */

const myRoomOverlay =
  $("myRoomOverlay");

const myRoomValue =
  $("myRoomValue");

const copyRoomBtn =
  $("copyRoomBtn");

const showQrBtn =
  $("showQrBtn");

const closeMyRoomBtn =
  $("closeMyRoomBtn");

const qrBox =
  $("qrBox");

const qrcode =
  $("qrcode");


/* =========================================================
   JOIN PANEL
========================================================= */

const joinRoomOverlay =
  $("joinRoomOverlay");

const joinRoomInput =
  $("joinRoomInput");

const joinRoomConfirmBtn =
  $("joinRoomConfirmBtn");

const closeJoinRoomBtn =
  $("closeJoinRoomBtn");

const scanBtn =
  $("scanBtn");

const scanner =
  $("scanner");


/* =========================================================
   FRIEND PANEL
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

const friendsCount =
  $("friendsCount");

const closeFriendsBtn =
  $("closeFriendsBtn");

const noFriendsMessage =
  $("noFriendsMessage");


/* =========================================================
   FILTER PANEL
========================================================= */

const filterOverlay =
  $("filterOverlay");

const closeFilterBtn =
  $("closeFilterBtn");

const filterOptions =
  qsa(".filter-option");


/* =========================================================
   CHAT
========================================================= */

const chatPanel =
  $("chatPanel");

const closeChatBtn =
  $("closeChatBtn");

const clearChatBtn =
  $("clearChatBtn");

const chatMessages =
  $("chatMessages");

const chatEmptyState =
  $("chatEmptyState");

const chatParticipants =
  $("chatParticipants");

const messageInput =
  $("messageInput");

const sendMessageBtn =
  $("sendMessageBtn");

const photoBtn =
  $("photoBtn");

const videoBtn =
  $("videoBtn");

const photoInput =
  $("photoInput");

const videoInput =
  $("videoInput");

const replyPreview =
  $("replyPreview");

const replyPreviewText =
  $("replyPreviewText");

const cancelReplyBtn =
  $("cancelReplyBtn");

const chatUnreadBadge =
  $("chatUnreadBadge");

const chatTypingStatus =
  $("chatTypingStatus");


/* =========================================================
   MEDIA PREVIEW
========================================================= */

const mediaPreview =
  $("mediaPreview");

const mediaPreviewThumb =
  $("mediaPreviewThumb");

const mediaFileName =
  $("mediaFileName");

const mediaFileSize =
  $("mediaFileSize");

const mediaFileType =
  $("mediaFileType");

const mediaTransferSize =
  $("mediaTransferSize");

const cancelMediaBtn =
  $("cancelMediaBtn");

const sendMediaBtn =
  $("sendMediaBtn");


/* =========================================================
   UPLOAD PROGRESS
========================================================= */

const uploadProgressBox =
  $("uploadProgressBox");

const uploadProgressBar =
  $("uploadProgressBar");

const uploadProgressText =
  $("uploadProgressText");

const uploadProgressPercent =
  $("uploadProgressPercent");


/* =========================================================
   CALL OVERLAYS
========================================================= */

const incomingCallOverlay =
  $("incomingCallOverlay");

const incomingCallerText =
  $("incomingCallerText");

const acceptCallBtn =
  $("acceptCallBtn");

const rejectCallBtn =
  $("rejectCallBtn");

const connectingOverlay =
  $("connectingOverlay");

const connectingText =
  $("connectingText");


/* =========================================================
   NOTIFICATION
========================================================= */

const notificationBtn =
  $("notificationBtn");

const notificationToast =
  $("notificationToast");

const closeNotificationBtn =
  $("closeNotificationBtn");


/* =========================================================
   TOAST
========================================================= */

const toast =
  $("toast");

const toastIcon =
  $("toastIcon");

const toastMessage =
  $("toastMessage");

let toastTimer = null;


/* =========================================================
   SAFE TEXT
========================================================= */

function escapeHTML(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   STATUS
========================================================= */

function setStatus(message) {

  if (statusEl) {
    statusEl.textContent =
      message;
  }

  if (systemStatus) {
    systemStatus.textContent =
      "ACTIVE";
  }

}


/* =========================================================
   SYSTEM READY
========================================================= */

function setSystemReady() {

  if (systemStatus) {
    systemStatus.textContent =
      "READY";
  }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
  message,
  icon = "✓",
  duration = 2500
) {

  if (!toast) return;

  clearTimeout(toastTimer);

  toastMessage.textContent =
    message;

  toastIcon.textContent =
    icon;

  toast.classList.remove(
    "hidden"
  );

  toastTimer =
    setTimeout(() => {

      toast.classList.add(
        "hidden"
      );

    }, duration);

}


/* =========================================================
   CONNECTION
========================================================= */

socket.on("connect", () => {

  socketConnected = true;

  if (connectionState) {
    connectionState.textContent =
      "ONLINE";
  }

  if (connectionDot) {
    connectionDot.classList.remove(
      "offline"
    );
  }

  setStatus(
    "Socket connection established."
  );

  setTimeout(() => {

    if (roomCode) {
      joinOwnRoom();
    }

  }, 300);

});


socket.on("disconnect", () => {

  socketConnected = false;

  if (connectionState) {
    connectionState.textContent =
      "OFFLINE";
  }

  if (connectionDot) {
    connectionDot.classList.add(
      "offline"
    );
  }

  setStatus(
    "Connection lost. Reconnecting..."
  );

});


socket.on("connect_error", () => {

  setStatus(
    "Unable to connect to server."
  );

});


/* =========================================================
   PERMANENT ROOM
========================================================= */

function generateRoomCode() {

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

  return code;

}


function getPermanentRoom() {

  let saved =
    localStorage.getItem(
      ROOM_STORAGE_KEY
    );

  if (
    !saved ||
    saved.length < 4
  ) {

    saved =
      generateRoomCode();

    localStorage.setItem(
      ROOM_STORAGE_KEY,
      saved
    );

  }

  return saved.toUpperCase();

}


function showPermanentRoomData() {

  roomCode =
    getPermanentRoom();

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

  if (currentRoomDisplay) {
    currentRoomDisplay.textContent =
      roomCode;
  }

}


/* =========================================================
   JOIN OWN ROOM
========================================================= */

function joinOwnRoom() {

  if (!socketConnected) {
    return;
  }

  roomCode =
    getPermanentRoom();

  socket.emit(
    "join-room",
    {
      room: roomCode
    }
  );

}


/* =========================================================
   ROOM JOINED
========================================================= */

socket.on(
  "room-joined",
  data => {

    const users =
      data &&
      Array.isArray(data.users)
        ? data.users
        : [];

    const room =
      data &&
      data.room
        ? data.room
        : roomCode;

    currentCallRoom =
      room;

    if (currentRoomDisplay) {
      currentRoomDisplay.textContent =
        room;
    }

    updateOnlineCount(
      users.length + 1
    );

    setStatus(
      `Room ${room} connected.`
    );

    setSystemReady();

    if (
      !activeCall &&
      !localStream
    ) {

      startCamera(
        false
      );

    }

    /*
      If server gives existing users,
      connect to them when this is an
      active call.
    */

    if (
      activeCall &&
      Array.isArray(users)
    ) {

      users.forEach(
        user => {

          const peerId =
            typeof user === "string"
              ? user
              : user.id;

          if (
            peerId &&
            peerId !== socket.id
          ) {

            createPeer(
              peerId,
              true
            );

          }

        }
      );

    }

  }
);


/* =========================================================
   ROOM FULL
========================================================= */

socket.on(
  "room-full",
  () => {

    showToast(
      "ROOM IS FULL. MAX 6 USERS.",
      "!",
      3500
    );

    setStatus(
      "Room full. Maximum 6 users allowed."
    );

  }
);


/* =========================================================
   ONLINE COUNT
========================================================= */

function updateOnlineCount(count) {

  const safeCount =
    Math.max(
      0,
      Math.min(
        MAX_USERS,
        Number(count) || 0
      )
    );

  if (onlineCount) {

    onlineCount.textContent =
      `${safeCount}/${MAX_USERS}`;

  }

}


/* =========================================================
   PEER JOINED
========================================================= */

socket.on(
  "peer-joined",
  data => {

    const peerId =
      typeof data === "string"
        ? data
        : data?.id;

    if (
      !peerId ||
      peerId === socket.id
    ) {
      return;
    }

    setStatus(
      "Another user joined the room."
    );

    if (activeCall) {

      createPeer(
        peerId,
        true
      );

    }

  }
);


/* =========================================================
   PEER LEFT
========================================================= */

socket.on(
  "peer-left",
  data => {

    const peerId =
      typeof data === "string"
        ? data
        : data?.id;

    if (!peerId) {
      return;
    }

    removePeer(
      peerId
    );

    updateOnlineCountFromPeers();

  }
);


/* =========================================================
   UPDATE COUNT FROM PEERS
========================================================= */

function updateOnlineCountFromPeers() {

  const count =
    1 +
    Object.keys(
      peers
    ).length;

  updateOnlineCount(
    count
  );

}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera(
  forceRestart = false
) {

  try {

    if (
      localStream &&
      !forceRestart
    ) {

      applyLocalCameraSettings();

      updateCameraUI();

      return localStream;

    }

    if (
      localStream &&
      forceRestart
    ) {

      stopLocalTracks();

    }

    const constraints = {

      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },

      video: {
        facingMode:
          currentFacingMode,

        width: {
          ideal:1280
        },

        height: {
          ideal:720
        },

        frameRate: {
          ideal:30,
          max:30
        }
      }

    };


    localStream =
      await navigator.mediaDevices
        .getUserMedia(
          constraints
        );


    localVideo.srcObject =
      localStream;

    localVideo.muted =
      true;

    localVideo.playsInline =
      true;

    localVideo.autoplay =
      true;


    localTile.classList.remove(
      "empty"
    );

    localTile.classList.add(
      "call-connected"
    );


    applyLocalCameraSettings();

    updateCameraUI();


    /*
      Replace tracks for
      already connected peers.
    */

    replacePeerTracks();


    setStatus(
      "Camera active."
    );


    return localStream;

  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    setStatus(
      "Camera permission required."
    );

    showToast(
      "CAMERA ACCESS FAILED",
      "!",
      3500
    );

    return null;

  }

}


/* =========================================================
   STOP LOCAL TRACKS
========================================================= */

function stopLocalTracks() {

  if (!localStream) {
    return;
  }

  localStream
    .getTracks()
    .forEach(
      track => {
        track.stop();
      }
    );

  localStream =
    null;

  if (localVideo) {
    localVideo.srcObject =
      null;
  }

  localTile.classList.add(
    "empty"
  );

  localTile.classList.remove(
    "call-connected"
  );

}


/* =========================================================
   REPLACE PEER TRACKS
========================================================= */

function replacePeerTracks() {

  if (!localStream) {
    return;
  }

  Object.values(
    peers
  ).forEach(
    peer => {

      if (
        !peer ||
        !peer.pc
      ) {
        return;
      }

      const senders =
        peer.pc.getSenders();

      localStream
        .getTracks()
        .forEach(
          track => {

            const sender =
              senders.find(
                s =>
                  s.track &&
                  s.track.kind ===
                    track.kind
              );

            if (sender) {

              sender
                .replaceTrack(
                  track
                )
                .catch(
                  console.error
                );

            } else {

              try {

                peer.pc.addTrack(
                  track,
                  localStream
                );

              } catch (error) {

                console.error(
                  error
                );

              }

            }

          }
        );

    }
  );

}


/* =========================================================
   SWITCH CAMERA
========================================================= */

async function switchCamera() {

  currentFacingMode =
    currentFacingMode === "user"
      ? "environment"
      : "user";

  const oldStream =
    localStream;

  const stream =
    await startCamera(
      true
    );

  if (!stream) {

    currentFacingMode =
      currentFacingMode === "user"
        ? "environment"
        : "user";

    return;

  }

  if (oldStream) {

    oldStream
      .getTracks()
      .forEach(
        track => {

          try {
            track.stop();
          } catch {}

        }
      );

  }

  applyLocalCameraSettings();

  showToast(
    currentFacingMode === "user"
      ? "FRONT CAMERA"
      : "BACK CAMERA",
    "✓"
  );

}


/* =========================================================
   MIRROR
========================================================= */

function loadMirrorSetting() {

  isMirrored =
    localStorage.getItem(
      MIRROR_STORAGE_KEY
    ) === "true";

  applyMirror();

}


function toggleMirror() {

  isMirrored =
    !isMirrored;

  localStorage.setItem(
    MIRROR_STORAGE_KEY,
    String(isMirrored)
  );

  applyMirror();

  showToast(
    isMirrored
      ? "MIRROR ON"
      : "MIRROR OFF",
    "↔"
  );

}


function applyMirror() {

  if (!localVideo) {
    return;
  }

  localVideo.classList.toggle(
    "mirrored",
    isMirrored
  );

  if (mirrorBtn) {

    mirrorBtn.classList.toggle(
      "active",
      isMirrored
    );

  }

}


/* =========================================================
   FILTERS
========================================================= */

function loadFilterSetting() {

  currentFilter =
    localStorage.getItem(
      FILTER_STORAGE_KEY
    ) ||
    "none";

  applyFilter();

}


function applyFilter() {

  if (!localVideo) {
    return;
  }

  const classes = [
    "filter-vibrant",
    "filter-warm",
    "filter-cool",
    "filter-gray",
    "filter-contrast",
    "filter-bright",
    "filter-dark",
    "filter-sepia",
    "filter-cinema",
    "filter-neon"
  ];

  classes.forEach(
    cls =>
      localVideo.classList.remove(
        cls
      )
  );

  if (
    currentFilter !== "none"
  ) {

    localVideo.classList.add(
      `filter-${currentFilter}`
    );

  }

  filterOptions.forEach(
    option => {

      option.classList.toggle(
        "active",
        option.dataset.filter ===
          currentFilter
      );

    }
  );

}


function setFilter(
  filter
) {

  currentFilter =
    filter || "none";

  localStorage.setItem(
    FILTER_STORAGE_KEY,
    currentFilter
  );

  applyFilter();

  showToast(
    currentFilter === "none"
      ? "FILTER OFF"
      : `${currentFilter.toUpperCase()} FILTER`,
    "◈"
  );

}


/* =========================================================
   CAMERA UI
========================================================= */

function updateCameraUI() {

  if (!micBtn) {
    return;
  }

  micBtn.classList.toggle(
    "active",
    !isMuted
  );

  if (isMuted) {

    micBtn.querySelector(
      ".control-text"
    ).textContent =
      "UNMUTE";

  } else {

    micBtn.querySelector(
      ".control-text"
    ).textContent =
      "MIC";

  }

}


/* =========================================================
   MIC
========================================================= */

function toggleMic() {

  if (!localStream) {

    startCamera();

    return;

  }

  const tracks =
    localStream.getAudioTracks();

  if (!tracks.length) {

    showToast(
      "MICROPHONE NOT FOUND",
      "!",
      3000
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

  updateCameraUI();

  showToast(
    isMuted
      ? "MIC MUTED"
      : "MIC UNMUTED",
    isMuted
      ? "×"
      : "✓"
  );

}


/* =========================================================
   CREATE PEER
========================================================= */

function createPeer(
  peerId,
  createOffer = false
) {

  if (!peerId) {
    return null;
  }

  if (
    peerId === socket.id
  ) {
    return null;
  }


  /*
    Existing peer.
  */

  if (
    peers[peerId] &&
    peers[peerId].pc
  ) {

    return peers[peerId];

  }


  const pc =
    new RTCPeerConnection(
      rtcConfig
    );


  peers[peerId] = {
    pc,
    room: currentCallRoom,
    tile: null
  };


  /*
    Add local tracks.
  */

  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => {

          try {

            pc.addTrack(
              track,
              localStream
            );

          } catch (error) {

            console.error(
              "addTrack:",
              error
            );

          }

        }
      );

  }


  /*
    ICE candidates.
  */

  pc.onicecandidate =
    event => {

      if (
        event.candidate
      ) {

        socket.emit(
          "signal",
          {
            target: peerId,

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
    Remote track.
  */

  pc.ontrack =
    event => {

      const stream =
        event.streams &&
        event.streams[0];

      if (!stream) {
        return;
      }

      remoteStreams[peerId] =
        stream;

      attachRemoteStream(
        peerId,
        stream
      );

    };


  /*
    Connection state.
  */

  pc.onconnectionstatechange =
    () => {

      const state =
        pc.connectionState;

      if (
        state ===
        "connected"
      ) {

        setStatus(
          "Secure video connection established."
        );

        updateOnlineCountFromPeers();

      }


      if (
        state ===
        "failed" ||
        state ===
        "disconnected" ||
        state ===
        "closed"
      ) {

        removePeer(
          peerId
        );

      }

    };


  /*
    Negotiation.
  */

  pc.onnegotiationneeded =
    async () => {

      /*
        Only the side explicitly
        requested to create an offer
        should start negotiation.
      */

    };


  /*
    Create offer.
  */

  if (createOffer) {

    createOfferForPeer(
      peerId,
      pc
    );

  }


  return peers[peerId];

}


/* =========================================================
   CREATE OFFER
========================================================= */

async function createOfferForPeer(
  peerId,
  pc
) {

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

        data: {
          type:
            "offer",

          offer:
            pc.localDescription
        }
      }
    );

  } catch (error) {

    console.error(
      "Offer error:",
      error
    );

  }

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


    let peer =
      peers[sender];


    /*
      Offer.
    */

    if (
      data.type ===
      "offer"
    ) {

      if (!peer) {

        peer =
          createPeer(
            sender,
            false
          );

      }

      if (!peer) {
        return;
      }

      const pc =
        peer.pc;

      try {

        await pc.setRemoteDescription(
          new RTCSessionDescription(
            data.offer
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

            data: {
              type:
                "answer",

              answer:
                pc.localDescription
            }
          }
        );

      } catch (error) {

        console.error(
          "Offer handling error:",
          error
        );

      }

      return;

    }


    /*
      Answer.
    */

    if (
      data.type ===
      "answer"
    ) {

      if (!peer) {
        return;
      }

      try {

        await peer.pc.setRemoteDescription(
          new RTCSessionDescription(
            data.answer
          )
        );

      } catch (error) {

        console.error(
          "Answer error:",
          error
        );

      }

      return;

    }


    /*
      ICE candidate.
    */

    if (
      data.type ===
      "candidate"
    ) {

      if (!peer) {
        return;
      }

      try {

        await peer.pc.addIceCandidate(
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
);


/* =========================================================
   REMOTE TILE
========================================================= */

function findFreeRemoteTile() {

  for (
    const tile of remoteTiles
  ) {

    const element =
      $(tile.tile);

    if (
      element &&
      !element.dataset.peerId
    ) {

      return tile;

    }

  }

  return null;

}


function getRemoteTileForPeer(
  peerId
) {

  if (
    peers[peerId] &&
    peers[peerId].tile
  ) {

    return remoteTiles.find(
      tile =>
        tile.tile ===
        peers[peerId].tile
    );

  }

  return findFreeRemoteTile();

}


/* =========================================================
   ATTACH REMOTE STREAM
========================================================= */

function attachRemoteStream(
  peerId,
  stream
) {

  const tile =
    getRemoteTileForPeer(
      peerId
    );

  if (!tile) {

    showToast(
      "6 CAMERA SLOTS ALREADY USED",
      "!",
      3000
    );

    return;

  }


  const tileElement =
    $(tile.tile);

  const video =
    $(tile.video);

  const label =
    $(tile.label);


  if (!tileElement ||
      !video) {
    return;
  }


  tileElement.dataset.peerId =
    peerId;

  tileElement.classList.remove(
    "empty"
  );

  tileElement.classList.add(
    "call-connected"
  );


  video.srcObject =
    stream;

  video.autoplay =
    true;

  video.playsInline =
    true;


  if (label) {

    label.textContent =
      `USER ${String(
        peerId
      ).slice(0,6).toUpperCase()}`;

  }


  if (peers[peerId]) {

    peers[peerId].tile =
      tile.tile;

  }


  updateOnlineCountFromPeers();

}


/* =========================================================
   REMOVE PEER
========================================================= */

function removePeer(
  peerId
) {

  const peer =
    peers[peerId];

  if (peer) {

    try {

      peer.pc.close();

    } catch {}

  }


  delete peers[peerId];

  delete remoteStreams[peerId];


  remoteTiles.forEach(
    tile => {

      const tileElement =
        $(tile.tile);

      if (
        tileElement &&
        tileElement.dataset.peerId ===
          peerId
      ) {

        const video =
          $(tile.video);

        const label =
          $(tile.label);

        delete tileElement.dataset.peerId;

        tileElement.classList.add(
          "empty"
        );

        tileElement.classList.remove(
          "call-connected"
        );

        if (video) {
          video.srcObject =
            null;
        }

        if (label) {
          label.textContent =
            tile.tile
              .replace(
                "cameraTile",
                "CAMERA "
              );
        }

      }

    }
  );


  updateOnlineCountFromPeers();

}


/* =========================================================
   CALL USER
========================================================= */

function joinTargetRoom(
  target
) {

  const cleanTarget =
    String(target || "")
      .trim()
      .toUpperCase();

  if (!cleanTarget) {

    showToast(
      "ROOM ID REQUIRED",
      "!",
      2500
    );

    return;

  }


  if (
    cleanTarget ===
    roomCode
  ) {

    showToast(
      "THIS IS YOUR OWN ROOM",
      "!",
      2500
    );

    return;

  }


  currentTargetRoom =
    cleanTarget;

  activeCall =
    true;


  showConnecting(
    `CALLING ROOM ${cleanTarget}`
  );


  setStatus(
    `Calling Room ${cleanTarget}...`
  );


  socket.emit(
    "call-user",
    {
      targetRoom:
        cleanTarget,

      callerRoom:
        roomCode
    }
  );


  startCamera();

}


/* =========================================================
   CALL RINGING
========================================================= */

socket.on(
  "call-ringing",
  data => {

    const target =
      data?.targetRoom ||
      currentTargetRoom;

    setStatus(
      `Calling ${target || "user"}...`
    );

  }
);


/* =========================================================
   CALL UNAVAILABLE
========================================================= */

socket.on(
  "call-unavailable",
  data => {

    hideConnecting();

    activeCall =
      false;

    setStatus(
      "User is unavailable."
    );

    showToast(
      "USER UNAVAILABLE",
      "!",
      3500
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
      "";

    incomingCallerRoom =
      data?.callerRoom ||
      data?.room ||
      "";

    incomingCallerText.textContent =
      incomingCallerRoom
        ? `ROOM ${incomingCallerRoom} IS CALLING YOU`
        : "INCOMING VIDEO CALL";


    incomingCallOverlay.classList.remove(
      "hidden"
    );


    /*
      Play browser notification
      if permission already granted.
    */

    sendBrowserNotification(
      "Incoming Video Call",
      incomingCallerRoom
        ? `Room ${incomingCallerRoom} is calling you.`
        : "You have an incoming video call."
    );

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

    activeCall =
      true;

    currentTargetRoom =
      incomingCallerRoom;

    currentCallRoom =
      incomingCallerRoom;

    showConnecting(
      "ACCEPTING CALL..."
    );


    await startCamera();


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
      "Call accepted. Connecting..."
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


    socket.emit(
      "reject-call",
      {
        callerId:
          incomingCallerId,

        callerRoom:
          incomingCallerRoom
      }
    );


    incomingCallerId =
      "";

    incomingCallerRoom =
      "";

    activeCall =
      false;


    setStatus(
      "Incoming call rejected."
    );

  }
);


/* =========================================================
   CALL ACCEPTED
========================================================= */

socket.on(
  "call-accepted",
  async data => {

    hideConnecting();

    activeCall =
      true;

    currentCallRoom =
      data?.room ||
      currentTargetRoom ||
      roomCode;


    setStatus(
      "Call accepted. Starting secure video..."
    );


    await startCamera();


    /*
      If server supplies receiver ID,
      create peer directly.
    */

    const peerId =
      data?.receiverId ||
      data?.targetId ||
      data?.userId;


    if (peerId) {

      createPeer(
        peerId,
        true
      );

    }

  }
);


/* =========================================================
   CALL REJECTED
========================================================= */

socket.on(
  "call-rejected",
  () => {

    hideConnecting();

    activeCall =
      false;

    setStatus(
      "Call rejected."
    );

    showToast(
      "CALL REJECTED",
      "×",
      3000
    );

  }
);


/* =========================================================
   SHOW CONNECTING
========================================================= */

function showConnecting(
  text
) {

  if (connectingText) {
    connectingText.textContent =
      text;
  }

  connectingOverlay.classList.remove(
    "hidden"
  );

}


/* =========================================================
   HIDE CONNECTING
========================================================= */

function hideConnecting() {

  connectingOverlay.classList.add(
    "hidden"
  );

}


/* =========================================================
   END CALL
========================================================= */

function endCall() {

  activeCall =
    false;

  currentTargetRoom =
    "";

  currentCallRoom =
    "";


  Object.keys(
    peers
  ).forEach(
    peerId => {

      try {

        peers[peerId].pc.close();

      } catch {}

      delete peers[peerId];

    }
  );


  remoteTiles.forEach(
    tile => {

      const tileElement =
        $(tile.tile);

      const video =
        $(tile.video);

      const label =
        $(tile.label);

      if (tileElement) {

        delete tileElement.dataset.peerId;

        tileElement.classList.add(
          "empty"
        );

        tileElement.classList.remove(
          "call-connected"
        );

      }

      if (video) {
        video.srcObject =
          null;
      }

      if (label) {

        label.textContent =
          tile.tile
            .replace(
              "cameraTile",
              "CAMERA "
            );

      }

    }
  );


  hideConnecting();


  socket.emit(
    "leave-room"
  );


  /*
    Do NOT destroy local camera.
    User can remain previewing.
  */

  joinOwnRoom();


  setStatus(
    "Call ended. Waiting for another connection."
  );

  updateOnlineCount(
    1
  );

  showToast(
    "CALL ENDED",
    "■"
  );

}


/* =========================================================
   MY ROOM PANEL
========================================================= */

function openMyRoom() {

  showPermanentRoomData();

  myRoomOverlay.classList.remove(
    "hidden"
  );

  myRoomOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

}


function closeMyRoom() {

  myRoomOverlay.classList.add(
    "hidden"
  );

  myRoomOverlay.setAttribute(
    "aria-hidden",
    "true"
  );

}


function generateQRCode() {

  if (!qrcode) {
    return;
  }


  qrcode.innerHTML =
    "";


  if (
    typeof QRCode ===
    "undefined"
  ) {

    showToast(
      "QR LIBRARY NOT LOADED",
      "!",
      3000
    );

    return;

  }


  const url =
    `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
      roomCode
    )}`;


  new QRCode(
    qrcode,
    {
      text:url,

      width:200,

      height:200,

      colorDark:"#000000",

      colorLight:"#ffffff",

      correctLevel:
        QRCode.CorrectLevel.M
    }
  );


  qrBox.classList.remove(
    "hidden"
  );

}


/* =========================================================
   COPY ROOM
========================================================= */

async function copyRoomId() {

  try {

    await navigator.clipboard.writeText(
      roomCode
    );

    showToast(
      "ROOM ID COPIED",
      "✓"
    );

  } catch {

    const temp =
      document.createElement(
        "textarea"
      );

    temp.value =
      roomCode;

    document.body.appendChild(
      temp
    );

    temp.select();

    document.execCommand(
      "copy"
    );

    temp.remove();

    showToast(
      "ROOM ID COPIED",
      "✓"
    );

  }

}


/* =========================================================
   JOIN MODAL
========================================================= */

function openJoinRoom() {

  joinRoomOverlay.classList.remove(
    "hidden"
  );

  joinRoomOverlay.setAttribute(
    "aria-hidden",
    "false"
  );

  setTimeout(
    () => {

      joinRoomInput?.focus();

    },
    100
  );

}


function closeJoinRoom() {

  joinRoomOverlay.classList.add(
    "hidden"
  );

  joinRoomOverlay.setAttribute(
    "aria-hidden",
    "true"
  );

  stopScanner();

}


/* =========================================================
   JOIN ROOM CONFIRM
========================================================= */

function confirmJoinRoom() {

  const value =
    joinRoomInput.value
      .trim()
      .toUpperCase();

  if (!value) {

    showToast(
      "ENTER ROOM ID",
      "!",
      2500
    );

    return;

  }

  if (
    value ===
    roomCode
  ) {

    showToast(
      "THIS IS YOUR OWN ROOM ID",
      "!",
      3000
    );

    return;

  }


  targetRoomInput.value =
    value;


  closeJoinRoom();


  joinTargetRoom(
    value
  );

}


/* =========================================================
   QR SCANNER
========================================================= */

async function startScanner() {

  if (
    typeof Html5Qrcode ===
    "undefined"
  ) {

    showToast(
      "QR SCANNER NOT LOADED",
      "!",
      3000
    );

    return;

  }


  scanner.classList.remove(
    "hidden"
  );


  if (scannerRunning) {
    return;
  }


  scannerInstance =
    new Html5Qrcode(
      "scanner"
    );


  scannerRunning =
    true;


  try {

    await scannerInstance.start(

      {
        facingMode:
          "environment"
      },

      {
        fps:10,

        qrbox:{
          width:220,
          height:220
        }
      },

      decodedText => {

        handleScannedRoom(
          decodedText
        );

      },

      () => {}

    );

  } catch (error) {

    console.error(
      "Scanner:",
      error
    );

    scannerRunning =
      false;

    showToast(
      "UNABLE TO START QR SCANNER",
      "!",
      3500
    );

  }

}


/* =========================================================
   HANDLE SCANNED QR
========================================================= */

function handleScannedRoom(
  text
) {

  let room = "";

  try {

    const url =
      new URL(
        text
      );

    room =
      url.searchParams.get(
        "room"
      ) || "";

  } catch {

    room =
      String(text || "")
        .trim()
        .toUpperCase();

  }


  if (!room) {
    return;
  }


  room =
    room
      .trim()
      .toUpperCase();


  stopScanner();


  joinRoomInput.value =
    room;


  showToast(
    `ROOM ${room} FOUND`,
    "✓"
  );


  setTimeout(
    () => {

      confirmJoinRoom();

    },
    500
  );

}


/* =========================================================
   STOP SCANNER
========================================================= */

async function stopScanner() {

  if (
    !scannerInstance ||
    !scannerRunning
  ) {

    scanner.classList.add(
      "hidden"
    );

    return;

  }


  try {

    await scannerInstance.stop();

  } catch {}


  try {

    await scannerInstance.clear();

  } catch {}


  scannerInstance =
    null;

  scannerRunning =
    false;


  scanner.classList.add(
    "hidden"
  );

}


/* =========================================================
   FRIEND STORAGE
========================================================= */

function getFriends() {

  try {

    const raw =
      localStorage.getItem(
        FRIENDS_STORAGE_KEY
      );

    const friends =
      raw
        ? JSON.parse(raw)
        : [];

    return Array.isArray(
      friends
    )
      ? friends
      : [];

  } catch {

    return [];

  }

}


function saveFriends(
  friends
) {

  localStorage.setItem(
    FRIENDS_STORAGE_KEY,
    JSON.stringify(
      friends
    )
  );

}


/* =========================================================
   FRIENDS UI
========================================================= */

function renderFriends() {

  if (!friendsList) {
    return;
  }


  const friends =
    getFriends();


  friendsCount.textContent =
    friends.length;


  friendsList
    .querySelectorAll(
      ".friend-item"
    )
    .forEach(
      item => item.remove()
    );


  if (!friends.length) {

    noFriendsMessage.classList.remove(
      "hidden"
    );

    return;

  }


  noFriendsMessage.classList.add(
    "hidden"
  );


  friends.forEach(
    friend => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "friend-item";


      const avatar =
        document.createElement(
          "div"
        );

      avatar.className =
        "friend-avatar";

      avatar.textContent =
        (
          friend.name ||
          "U"
        )
          .charAt(0)
          .toUpperCase();


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


      const actions =
        document.createElement(
          "div"
        );

      actions.className =
        "friend-actions";


      const callBtn =
        document.createElement(
          "button"
        );

      callBtn.type =
        "button";

      callBtn.className =
        "friend-call";

      callBtn.textContent =
        "☎";

      callBtn.title =
        "Call";


      callBtn.addEventListener(
        "click",
        () => {

          friendsOverlay.classList.add(
            "hidden"
          );

          joinTargetRoom(
            friend.room
          );

        }
      );


      const deleteBtn =
        document.createElement(
          "button"
        );

      deleteBtn.type =
        "button";

      deleteBtn.className =
        "friend-delete";

      deleteBtn.textContent =
        "×";

      deleteBtn.title =
        "Delete";


      deleteBtn.addEventListener(
        "click",
        () => {

          removeFriend(
            friend.room
          );

        }
      );


      actions.appendChild(
        callBtn
      );

      actions.appendChild(
        deleteBtn
      );


      item.appendChild(
        avatar
      );

      item.appendChild(
        info
      );

      item.appendChild(
        actions
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

function addFriend() {

  const name =
    friendNameInput.value
      .trim();

  const room =
    friendRoomInput.value
      .trim()
      .toUpperCase();


  if (!name) {

    showToast(
      "ENTER FRIEND NAME",
      "!",
      2500
    );

    return;

  }


  if (!room) {

    showToast(
      "ENTER ROOM ID",
      "!",
      2500
    );

    return;

  }


  if (
    room ===
    roomCode
  ) {

    showToast(
      "YOU CANNOT ADD YOUR OWN ROOM",
      "!",
      3000
    );

    return;

  }


  let friends =
    getFriends();


  const existing =
    friends.find(
      friend =>
        friend.room ===
        room
    );


  if (existing) {

    existing.name =
      name;

  } else {

    if (
      friends.length >=
      MAX_FRIENDS
    ) {

      showToast(
        `MAX ${MAX_FRIENDS} FRIENDS`,
        "!",
        3000
      );

      return;

    }


    friends.push(
      {
        id:
          Date.now().toString(),

        name,

        room
      }
    );

  }


  saveFriends(
    friends
  );


  friendNameInput.value =
    "";

  friendRoomInput.value =
    "";


  renderFriends();


  showToast(
    "FRIEND SAVED",
    "✓"
  );

}


/* =========================================================
   REMOVE FRIEND
========================================================= */

function removeFriend(
  room
) {

  const friends =
    getFriends()
      .filter(
        friend =>
          friend.room !==
          room
      );


  saveFriends(
    friends
  );


  renderFriends();


  showToast(
    "FRIEND REMOVED",
    "×"
  );

}


/* =========================================================
   CHAT STORAGE
========================================================= */

function getChatStorageKey() {

  const room =
    currentCallRoom ||
    currentTargetRoom ||
    roomCode;

  return `roushanChat_${room}`;

}


function getStoredMessages() {

  try {

    const raw =
      localStorage.getItem(
        getChatStorageKey()
      );

    const messages =
      raw
        ? JSON.parse(raw)
        : [];

    return Array.isArray(
      messages
    )
      ? messages
      : [];

  } catch {

    return [];

  }

}


function saveStoredMessages(
  messages
) {

  /*
    Keep local history
    reasonably small.
  */

  const trimmed =
    messages.slice(
      -300
    );

  localStorage.setItem(
    getChatStorageKey(),
    JSON.stringify(
      trimmed
    )
  );

}


/* =========================================================
   OPEN CHAT
========================================================= */

function openChat() {

  chatOpen =
    true;

  chatPanel.classList.remove(
    "hidden"
  );

  chatPanel.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "chat-open"
  );


  unreadMessages =
    0;

  updateUnreadBadge();


  renderChatMessages();


  setTimeout(
    () => {

      messageInput?.focus();

    },
    100
  );

}


/* =========================================================
   CLOSE CHAT
========================================================= */

function closeChat() {

  chatOpen =
    false;

  chatPanel.classList.add(
    "hidden"
  );

  chatPanel.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "chat-open"
  );

}


/* =========================================================
   UPDATE UNREAD
========================================================= */

function updateUnreadBadge() {

  if (
    !chatUnreadBadge
  ) {
    return;
  }


  if (
    unreadMessages <= 0
  ) {

    chatUnreadBadge.classList.add(
      "hidden"
    );

    return;

  }


  chatUnreadBadge.classList.remove(
    "hidden"
  );


  chatUnreadBadge.textContent =
    unreadMessages > 99
      ? "99+"
      : unreadMessages;

}


/* =========================================================
   FORMAT SIZE
========================================================= */

function formatFileSize(
  bytes
) {

  if (
    !Number.isFinite(
      bytes
    )
  ) {
    return "0 B";
  }


  if (
    bytes <
    1024
  ) {

    return `${bytes} B`;

  }


  if (
    bytes <
    1024 * 1024
  ) {

    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;

  }


  if (
    bytes <
    1024 * 1024 * 1024
  ) {

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;

  }


  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(2)} GB`;

}


/* =========================================================
   MEDIA FILE SIZE
========================================================= */

function showMediaPreview(
  file
) {

  if (!file) {
    return;
  }


  selectedMediaFile =
    file;


  if (
    file.size >
    MAX_MEDIA_SIZE
  ) {

    showToast(
      "FILE IS LARGER THAN 50 MB",
      "!",
      3500
    );

    selectedMediaFile =
      null;

    return;

  }


  mediaFileName.textContent =
    file.name;

  mediaFileSize.textContent =
    formatFileSize(
      file.size
    );

  mediaTransferSize.textContent =
    formatFileSize(
      file.size
    );


  mediaFileType.textContent =
    file.type.startsWith(
      "video/"
    )
      ? "VIDEO FILE"
      : "IMAGE FILE";


  mediaPreviewThumb.innerHTML =
    "";


  if (
    file.type.startsWith(
      "image/"
    )
  ) {

    const img =
      document.createElement(
        "img"
      );

    img.alt =
      "Selected image";

    const url =
      URL.createObjectURL(
        file
      );

    img.src =
      url;

    img.onload =
      () => {

        URL.revokeObjectURL(
          url
        );

      };

    mediaPreviewThumb.appendChild(
      img
    );

  } else if (
    file.type.startsWith(
      "video/"
    )
  ) {

    const video =
      document.createElement(
        "video"
      );

    video.src =
      URL.createObjectURL(
        file
      );

    video.muted =
      true;

    video.playsInline =
      true;

    video.controls =
      false;

    mediaPreviewThumb.appendChild(
      video
    );

  }


  mediaPreview.classList.remove(
    "hidden"
  );

}


/* =========================================================
   CLEAR MEDIA PREVIEW
========================================================= */

function clearMediaPreview() {

  selectedMediaFile =
    null;

  mediaPreview.classList.add(
    "hidden"
  );

  mediaPreviewThumb.innerHTML =
    "";

  mediaFileName.textContent =
    "";

  mediaFileSize.textContent =
    "0 MB";

  mediaTransferSize.textContent =
    "0 MB";

}


/* =========================================================
   SEND TEXT MESSAGE
========================================================= */

function sendTextMessage() {

  const text =
    messageInput.value
      .trim();


  if (!text) {
    return;
  }


  const message =
    {
      id:
        generateMessageId(),

      type:
        "text",

      text,

      senderId:
        socket.id,

      senderName:
        "YOU",

      timestamp:
        Date.now(),

      replyTo:
        replyToMessage
          ? {
              id:
                replyToMessage.id,

              text:
                replyToMessage.text ||
                "MEDIA",

              sender:
                replyToMessage.senderName ||
                "USER"
            }
          : null
    };


  socket.emit(
    "chat-message",
    {
      room:
        currentCallRoom ||
        currentTargetRoom ||
        roomCode,

      message
    }
  );


  addLocalChatMessage(
    message
  );


  messageInput.value =
    "";


  clearReply();


  autoResizeTextarea();

}


/* =========================================================
   MESSAGE ID
========================================================= */

function generateMessageId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2)
  );

}


/* =========================================================
   LOCAL CHAT MESSAGE
========================================================= */

function addLocalChatMessage(
  message
) {

  const messages =
    getStoredMessages();

  messages.push(
    message
  );

  saveStoredMessages(
    messages
  );

  renderChatMessages();

}


/* =========================================================
   INCOMING CHAT MESSAGE
========================================================= */

socket.on(
  "chat-message",
  data => {

    const message =
      data?.message ||
      data;


    if (
      !message
    ) {
      return;
    }


    /*
      Ignore own duplicate.
    */

    if (
      message.senderId ===
      socket.id
    ) {

      return;

    }


    const messages =
      getStoredMessages();


    messages.push(
      message
    );


    saveStoredMessages(
      messages
    );


    renderChatMessages();


    if (!chatOpen) {

      unreadMessages +=
        1;

      updateUnreadBadge();

      sendBrowserNotification(
        "New Message",
        message.type ===
          "text"
          ? message.text
          : "You received a media file."
      );

    }

  }
);


/* =========================================================
   RENDER CHAT
========================================================= */

function renderChatMessages() {

  if (!chatMessages) {
    return;
  }


  const messages =
    getStoredMessages();


  chatMessages.innerHTML =
    "";


  if (!messages.length) {

    chatMessages.appendChild(
      chatEmptyState
    );

    chatEmptyState.classList.remove(
      "hidden"
    );

    return;

  }


  chatEmptyState.classList.add(
    "hidden"
  );


  messages.forEach(
    message => {

      renderSingleMessage(
        message
      );

    }
  );


  requestAnimationFrame(
    () => {

      chatMessages.scrollTop =
        chatMessages.scrollHeight;

    }
  );

}


/* =========================================================
   RENDER SINGLE MESSAGE
========================================================= */

function renderSingleMessage(
  message
) {

  const wrapper =
    document.createElement(
      "div"
    );


  const mine =
    message.senderId ===
    socket.id;


  wrapper.className =
    `chat-message ${
      mine
        ? "mine"
        : "theirs"
    }`;


  const bubble =
    document.createElement(
      "div"
    );

  bubble.className =
    "message-bubble";


  if (
    message.replyTo
  ) {

    const quoted =
      document.createElement(
        "div"
      );

    quoted.className =
      "message-quoted";


    const quotedSender =
      document.createElement(
        "strong"
      );

    quotedSender.textContent =
      message.replyTo.sender ||
      "USER";


    const quotedText =
      document.createElement(
        "span"
      );

    quotedText.textContent =
      message.replyTo.text ||
      "MESSAGE";


    quoted.appendChild(
      quotedSender
    );

    quoted.appendChild(
      quotedText
    );


    bubble.appendChild(
      quoted
    );

  }


  const sender =
    document.createElement(
      "div"
    );

  sender.className =
    "message-sender";

  sender.textContent =
    mine
      ? "YOU"
      : (
          message.senderName ||
          "USER"
        );


  bubble.appendChild(
    sender
  );


  if (
    message.type ===
    "text"
  ) {

    const text =
      document.createElement(
        "div"
      );

    text.className =
      "message-text";

    text.textContent =
      message.text ||
      "";

    bubble.appendChild(
      text
    );

  }


  if (
    message.type ===
    "image"
  ) {

    renderImageMessage(
      bubble,
      message
    );

  }


  if (
    message.type ===
    "video"
  ) {

    renderVideoMessage(
      bubble,
      message
    );

  }


  const time =
    document.createElement(
      "div"
    );

  time.className =
    "message-time";

  time.textContent =
    formatMessageTime(
      message.timestamp
    );


  bubble.appendChild(
    time
  );


  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "message-actions";


  const replyBtn =
    document.createElement(
      "button"
    );

  replyBtn.type =
    "button";

  replyBtn.className =
    "reply-message-btn";

  replyBtn.textContent =
    "↩ REPLY";


  replyBtn.addEventListener(
    "click",
    () => {

      setReply(
        message
      );

    }
  );


  actions.appendChild(
    replyBtn
  );

  bubble.appendChild(
    actions
  );


  wrapper.appendChild(
    bubble
  );


  chatMessages.appendChild(
    wrapper
  );

}


/* =========================================================
   IMAGE MESSAGE
========================================================= */

function renderImageMessage(
  bubble,
  message
) {

  if (
    !message.data
  ) {
    return;
  }


  const img =
    document.createElement(
      "img"
    );

  img.className =
    "chat-media";

  img.alt =
    message.fileName ||
    "Image";


  img.src =
    message.data;


  bubble.appendChild(
    img
  );


  appendMediaInfo(
    bubble,
    message
  );

}


/* =========================================================
   VIDEO MESSAGE
========================================================= */

function renderVideoMessage(
  bubble,
  message
) {

  if (
    !message.data
  ) {
    return;
  }


  const video =
    document.createElement(
      "video"
    );

  video.className =
    "chat-video";

  video.controls =
    true;

  video.playsInline =
    true;

  video.preload =
    "metadata";

  video.src =
    message.data;


  bubble.appendChild(
    video
  );


  appendMediaInfo(
    bubble,
    message
  );

}


/* =========================================================
   MEDIA INFO
========================================================= */

function appendMediaInfo(
  bubble,
  message
) {

  const info =
    document.createElement(
      "div"
    );

  info.className =
    "media-message-info";


  const name =
    document.createElement(
      "span"
    );

  name.textContent =
    message.fileName ||
    "MEDIA";


  const size =
    document.createElement(
      "span"
    );

  size.className =
    "media-message-size";

  size.textContent =
    formatFileSize(
      Number(
        message.fileSize ||
        0
      )
    );


  info.appendChild(
    name
  );

  info.appendChild(
    size
  );


  bubble.appendChild(
    info
  );

}


/* =========================================================
   FORMAT MESSAGE TIME
========================================================= */

function formatMessageTime(
  timestamp
) {

  const date =
    new Date(
      timestamp || Date.now()
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

function setReply(
  message
) {

  replyToMessage =
    message;


  replyPreviewText.textContent =
    message.type ===
      "text"
      ? (
          message.text ||
          ""
        )
      : (
          message.fileName ||
          "MEDIA"
        );


  replyPreview.classList.remove(
    "hidden"
  );


  messageInput.focus();

}


function clearReply() {

  replyToMessage =
    null;

  replyPreview.classList.add(
    "hidden"
  );

  replyPreviewText.textContent =
    "";

}


/* =========================================================
   MEDIA FILE SELECT
========================================================= */

function handlePhotoSelect(
  event
) {

  const file =
    event.target.files?.[0];

  if (file) {

    showMediaPreview(
      file
    );

  }

  event.target.value =
    "";

}


function handleVideoSelect(
  event
) {

  const file =
    event.target.files?.[0];

  if (file) {

    showMediaPreview(
      file
    );

  }

  event.target.value =
    "";

}


/* =========================================================
   SEND MEDIA
========================================================= */

async function sendSelectedMedia() {

  if (!selectedMediaFile) {

    showToast(
      "SELECT A FILE FIRST",
      "!",
      2500
    );

    return;

  }


  const file =
    selectedMediaFile;


  if (
    file.size >
    MAX_MEDIA_SIZE
  ) {

    showToast(
      "MAXIMUM FILE SIZE IS 50 MB",
      "!",
      3500
    );

    return;

  }


  /*
    For the current browser-side
    implementation we convert the
    selected file into a data URL.
  */

  try {

    sendMediaBtn.disabled =
      true;


    uploadProgressBox.classList.remove(
      "hidden"
    );


    updateUploadProgress(
      0
    );


    const dataUrl =
      await fileToDataURL(
        file,
        progress => {

          updateUploadProgress(
            progress
          );

        }
      );


    const type =
      file.type.startsWith(
        "video/"
      )
        ? "video"
        : "image";


    const message =
      {
        id:
          generateMessageId(),

        type,

        data:
          dataUrl,

        fileName:
          file.name,

        fileSize:
          file.size,

        mimeType:
          file.type,

        senderId:
          socket.id,

        senderName:
          "YOU",

        timestamp:
          Date.now(),

        replyTo:
          replyToMessage
            ? {
                id:
                  replyToMessage.id,

                text:
                  replyToMessage.text ||
                  replyToMessage.fileName ||
                  "MEDIA",

                sender:
                  replyToMessage.senderName ||
                  "USER"
              }
            : null
      };


    socket.emit(
      "chat-message",
      {
        room:
          currentCallRoom ||
          currentTargetRoom ||
          roomCode,

        message
      }
    );


    addLocalChatMessage(
      message
    );


    clearReply();

    clearMediaPreview();


    updateUploadProgress(
      100
    );


    setTimeout(
      () => {

        uploadProgressBox.classList.add(
          "hidden"
        );

      },
      500
    );


    showToast(
      `${type.toUpperCase()} SENT • ${formatFileSize(
        file.size
      )}`,
      "✓",
      3000
    );


  } catch (error) {

    console.error(
      "Media send error:",
      error
    );

    showToast(
      "MEDIA SEND FAILED",
      "!",
      3500
    );

  } finally {

    sendMediaBtn.disabled =
      false;

  }

}


/* =========================================================
   FILE TO DATA URL
========================================================= */

function fileToDataURL(
  file,
  onProgress
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

          if (
            onProgress
          ) {
            onProgress(
              100
            );
          }

          resolve(
            reader.result
          );

        };


      reader.onerror =
        () => {

          reject(
            reader.error
          );

        };


      reader.onprogress =
        event => {

          if (
            event.lengthComputable &&
            onProgress
          ) {

            const progress =
              Math.round(
                (
                  event.loaded /
                  event.total
                ) * 100
              );

            onProgress(
              progress
            );

          }

        };


      reader.readAsDataURL(
        file
      );

    }
  );

}


/* =========================================================
   UPLOAD PROGRESS
========================================================= */

function updateUploadProgress(
  percent
) {

  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(percent) || 0
      )
    );


  uploadProgressBar.style.width =
    `${value}%`;

  uploadProgressPercent.textContent =
    `${Math.round(value)}%`;

  uploadProgressText.textContent =
    value >= 100
      ? "SENT"
      : "SENDING...";

}


/* =========================================================
   CLEAR CHAT
========================================================= */

function clearChat() {

  const confirmed =
    window.confirm(
      "Clear chat history from this device?"
    );

  if (!confirmed) {
    return;
  }


  localStorage.removeItem(
    getChatStorageKey()
  );


  renderChatMessages();


  showToast(
    "CHAT HISTORY CLEARED",
    "✓"
  );

}


/* =========================================================
   AUTO RESIZE TEXTAREA
========================================================= */

function autoResizeTextarea() {

  if (!messageInput) {
    return;
  }

  messageInput.style.height =
    "auto";

  messageInput.style.height =
    `${Math.min(
      messageInput.scrollHeight,
      100
    )}px`;

}


/* =========================================================
   NOTIFICATION
========================================================= */

async function requestNotificationPermission() {

  if (
    !("Notification" in window)
  ) {

    showToast(
      "NOTIFICATIONS NOT SUPPORTED",
      "!",
      3000
    );

    return;

  }


  try {

    const permission =
      await Notification.requestPermission();


    if (
      permission ===
      "granted"
    ) {

      notificationToast.classList.add(
        "hidden"
      );


      showToast(
        "NOTIFICATIONS ENABLED",
        "✓"
      );


      await registerPushSubscription();

    } else {

      showToast(
        "NOTIFICATION PERMISSION DENIED",
        "!",
        3000
      );

    }

  } catch (error) {

    console.error(
      error
    );

  }

}


/* =========================================================
   BROWSER NOTIFICATION
========================================================= */

function sendBrowserNotification(
  title,
  body
) {

  if (
    !("Notification" in window)
  ) {
    return;
  }

  if (
    Notification.permission !==
    "granted"
  ) {
    return;
  }

  try {

    new Notification(
      title,
      {
        body,

        icon:
          "/favicon.ico",

        badge:
          "/favicon.ico"
      }
    );

  } catch {}

}


/* =========================================================
   PUSH SUBSCRIPTION
========================================================= */

async function registerPushSubscription() {

  if (
    !("serviceWorker" in navigator)
  ) {
    return;
  }


  try {

    const registration =
      await navigator.serviceWorker
        .register(
          "/sw.js"
        );


    const response =
      await fetch(
        "/api/vapid-public-key"
      );


    if (!response.ok) {
      return;
    }


    const data =
      await response.json();


    if (
      !data.publicKey
    ) {
      return;
    }


    const subscription =
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


    await fetch(
      "/api/subscribe",
      {
        method:
          "POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({
            room:
              roomCode,

            subscription
          })
      }
    );

  } catch (error) {

    console.warn(
      "Push subscription:",
      error
    );

  }

}


/* =========================================================
   BASE64 KEY
========================================================= */

function urlBase64ToUint8Array(
  base64String
) {

  const padding =
    "=".repeat(
      (
        4 -
        base64String.length %
          4
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
    atob(
      base64
    );


  return Uint8Array.from(
    [...rawData]
      .map(
        char =>
          char.charCodeAt(0)
      )
  );

}


/* =========================================================
   URL ROOM
========================================================= */

function handleRoomFromURL() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const room =
    params.get(
      "room"
    );


  if (!room) {
    return;
  }


  const cleanRoom =
    room
      .trim()
      .toUpperCase();


  if (
    !cleanRoom ||
    cleanRoom ===
      roomCode
  ) {

    return;

  }


  setTimeout(
    () => {

      joinRoomInput.value =
        cleanRoom;

      openJoinRoom();

    },
    700
  );

}


/* =========================================================
   EVENT LISTENERS
========================================================= */


/*
  Mic
*/

micBtn?.addEventListener(
  "click",
  toggleMic
);


/*
  Mirror
*/

mirrorBtn?.addEventListener(
  "click",
  toggleMirror
);


/*
  Switch camera
*/

switchCameraBtn?.addEventListener(
  "click",
  switchCamera
);


/*
  Filters
*/

filterBtn?.addEventListener(
  "click",
  () => {

    filterOverlay.classList.remove(
      "hidden"
    );

  }
);


closeFilterBtn?.addEventListener(
  "click",
  () => {

    filterOverlay.classList.add(
      "hidden"
    );

  }
);


filterOptions.forEach(
  option => {

    option.addEventListener(
      "click",
      () => {

        setFilter(
          option.dataset.filter
        );

        filterOverlay.classList.add(
          "hidden"
        );

      }
    );

  }
);


/*
  My Room
*/

myRoomBtn?.addEventListener(
  "click",
  openMyRoom
);


closeMyRoomBtn?.addEventListener(
  "click",
  closeMyRoom
);


copyRoomBtn?.addEventListener(
  "click",
  copyRoomId
);


showQrBtn?.addEventListener(
  "click",
  generateQRCode
);


/*
  Join
*/

joinRoomBtn?.addEventListener(
  "click",
  openJoinRoom
);


closeJoinRoomBtn?.addEventListener(
  "click",
  closeJoinRoom
);


joinRoomConfirmBtn?.addEventListener(
  "click",
  confirmJoinRoom
);


joinRoomInput?.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      confirmJoinRoom();

    }

  }
);


/*
  QR scanner
*/

scanBtn?.addEventListener(
  "click",
  () => {

    if (
      scannerRunning
    ) {

      stopScanner();

    } else {

      startScanner();

    }

  }
);


/*
  Friends
*/

friendsBtn?.addEventListener(
  "click",
  () => {

    renderFriends();

    friendsOverlay.classList.remove(
      "hidden"
    );

  }
);


closeFriendsBtn?.addEventListener(
  "click",
  () => {

    friendsOverlay.classList.add(
      "hidden"
    );

  }
);


addFriendConfirmBtn?.addEventListener(
  "click",
  addFriend
);


friendRoomInput?.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter"
    ) {

      event.preventDefault();

      addFriend();

    }

  }
);


/*
  Chat
*/

chatBtn?.addEventListener(
  "click",
  () => {

    if (chatOpen) {

      closeChat();

    } else {

      openChat();

    }

  }
);


closeChatBtn?.addEventListener(
  "click",
  closeChat
);


clearChatBtn?.addEventListener(
  "click",
  clearChat
);


sendMessageBtn?.addEventListener(
  "click",
  sendTextMessage
);


messageInput?.addEventListener(
  "input",
  autoResizeTextarea
);


messageInput?.addEventListener(
  "keydown",
  event => {

    if (
      event.key ===
      "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      sendTextMessage();

    }

  }
);


/*
  Reply
*/

cancelReplyBtn?.addEventListener(
  "click",
  clearReply
);


/*
  Media
*/

photoBtn?.addEventListener(
  "click",
  () => {

    photoInput?.click();

  }
);


videoBtn?.addEventListener(
  "click",
  () => {

    videoInput?.click();

  }
);


photoInput?.addEventListener(
  "change",
  handlePhotoSelect
);


videoInput?.addEventListener(
  "change",
  handleVideoSelect
);


cancelMediaBtn?.addEventListener(
  "click",
  clearMediaPreview
);


sendMediaBtn?.addEventListener(
  "click",
  sendSelectedMedia
);


/*
  End
*/

endBtn?.addEventListener(
  "click",
  endCall
);


/*
  Notification
*/

notificationBtn?.addEventListener(
  "click",
  requestNotificationPermission
);


closeNotificationBtn?.addEventListener(
  "click",
  () => {

    notificationToast.classList.add(
      "hidden"
    );

  }
);


/* =========================================================
   OVERLAY CLICK TO CLOSE
========================================================= */

myRoomOverlay?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      myRoomOverlay
    ) {

      closeMyRoom();

    }

  }
);


joinRoomOverlay?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      joinRoomOverlay
    ) {

      closeJoinRoom();

    }

  }
);


friendsOverlay?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      friendsOverlay
    ) {

      friendsOverlay.classList.add(
        "hidden"
      );

    }

  }
);


filterOverlay?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      filterOverlay
    ) {

      filterOverlay.classList.add(
        "hidden"
      );

    }

  }
);


/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Escape"
    ) {
      return;
    }


    closeMyRoom();

    closeJoinRoom();

    friendsOverlay.classList.add(
      "hidden"
    );

    filterOverlay.classList.add(
      "hidden"
    );

    if (chatOpen) {
      closeChat();
    }

  }
);


/* =========================================================
   INITIALIZATION
========================================================= */

function initializeApp() {

  showPermanentRoomData();

  loadMirrorSetting();

  loadFilterSetting();

  renderFriends();

  setSystemReady();

  updateOnlineCount(
    0
  );


  /*
    Prepare local video.
  */

  if (localVideo) {

    localVideo.muted =
      true;

    localVideo.playsInline =
      true;

  }


  /*
    Notification UI.
  */

  if (
    "Notification" in window &&
    Notification.permission ===
      "granted"
  ) {

    notificationToast?.classList.add(
      "hidden"
    );

  }


  /*
    Auto room from QR URL.
  */

  handleRoomFromURL();


  /*
    Initial status.
  */

  setStatus(
    "System initialized. Waiting for connection..."
  );


  /*
    Start camera automatically.
  */

  setTimeout(
    () => {

      startCamera();

    },
    500
  );

}


initializeApp();


/* =========================================================
   BEFORE UNLOAD
========================================================= */

window.addEventListener(
  "beforeunload",
  () => {

    Object.values(
      peers
    ).forEach(
      peer => {

        try {

          peer.pc.close();

        } catch {}

      }
    );

  }
);


/* =========================================================
   VISIBILITY CHANGE
========================================================= */

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {

      /*
        Keep camera alive.
      */

      if (
        !localStream
      ) {

        startCamera();

      }

    }

  }
);


/* =========================================================
   ONLINE / OFFLINE
========================================================= */

window.addEventListener(
  "online",
  () => {

    setStatus(
      "Internet connection restored."
    );

  }
);


window.addEventListener(
  "offline",
  () => {

    setStatus(
      "Internet connection lost."
    );

  }
);


/* =========================================================
   DEBUG HELPERS
========================================================= */

window.RoushanCCTV = {

  getRoom() {
    return roomCode;
  },

  getPeers() {
    return peers;
  },

  getFriends() {
    return getFriends();
  },

  getStream() {
    return localStream;
  },

  openChat() {
    openChat();
  },

  endCall() {
    endCall();
  }

};


/* =========================================================
   END APP.JS
========================================================= */

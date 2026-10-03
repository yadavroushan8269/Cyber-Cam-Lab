const socket = io();

let roomCode = "";
let localStream = null;
let peerConnection = null;
let isCaller = false;
let currentFacingMode = "user";

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const statusEl = document.getElementById("status");

const roomInput = document.getElementById("roomInput");
const qrContainer = document.getElementById("qrContainer");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const scanQrBtn = document.getElementById("scanQrBtn");
const startCameraBtn = document.getElementById("startCameraBtn");
const muteBtn = document.getElementById("muteBtn");
const endCallBtn = document.getElementById("endCallBtn");

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};


// ===============================
// STATUS
// ===============================

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}


// ===============================
// CREATE ROOM
// ===============================

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

function createRoom() {
  roomCode = generateRoomCode();

  if (roomInput) {
    roomInput.value = roomCode;
  }

  createQRCode(roomCode);
  joinRoom(roomCode, true);
}


// ===============================
// QR CODE
// ===============================

function createQRCode(code) {
  if (!qrContainer) return;

  qrContainer.innerHTML = "";

  const joinUrl =
    window.location.origin +
    window.location.pathname +
    "?room=" +
    encodeURIComponent(code);

  if (typeof QRCode !== "undefined") {
    new QRCode(qrContainer, {
      text: joinUrl,
      width: 220,
      height: 220
    });
  }
}


// ===============================
// JOIN ROOM
// ===============================

function joinRoom(code, caller = false) {
  if (!code) {
    alert("Room code enter karo.");
    return;
  }

  roomCode = code.trim().toUpperCase();
  isCaller = caller;

  socket.emit("join-room", {
    room: roomCode
  });

  setStatus("Joining room...");
}


// ===============================
// SOCKET EVENTS
// ===============================

socket.on("connect", () => {
  setStatus("Server connected. Not connected to a call.");
});


socket.on("room-joined", ({ room, count }) => {
  roomCode = room;

  if (roomInput) {
    roomInput.value = room;
  }

  if (count === 1) {
    setStatus("Room created. Waiting for other phone...");
  } else {
    setStatus("Connected to room.");
  }
});


socket.on("peer-joined", async () => {
  setStatus("Other phone joined.");

  if (!localStream) {
    await startCamera();
  }

  await createOffer();
});


socket.on("signal", async (data) => {
  try {
    if (!peerConnection) {
      await createPeerConnection();
    }

    if (data.type === "offer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data)
      );

      const answer = await peerConnection.createAnswer();

      await peerConnection.setLocalDescription(answer);

      socket.emit("signal", {
        room: roomCode,
        data: peerConnection.localDescription
      });

      setStatus("Video connection starting...");
    }

    else if (data.type === "answer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data)
      );

      setStatus("Video connected.");
    }

    else if (data.type === "candidate") {
      try {
        await peerConnection.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (error) {
        console.log("ICE candidate error:", error);
      }
    }

  } catch (error) {
    console.error("Signal error:", error);
    setStatus("Connection error.");
  }
});


socket.on("room-full", () => {
  alert("Room already has two phones.");
  setStatus("Room full.");
});


socket.on("peer-left", () => {
  setStatus("Other phone left the call.");

  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
});


// ===============================
// WEBRTC PEER CONNECTION
// ===============================

async function createPeerConnection() {
  if (peerConnection) {
    return peerConnection;
  }

  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = (event) => {
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


  peerConnection.ontrack = (event) => {
    if (remoteVideo) {
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.play().catch(() => {});
    }

    setStatus("Video connected.");
  };


  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;

    if (state === "connected") {
      setStatus("Video connected.");
    }

    else if (state === "connecting") {
      setStatus("Connecting video...");
    }

    else if (state === "disconnected") {
      setStatus("Connection disconnected.");
    }

    else if (state === "failed") {
      setStatus("Connection failed.");
    }
  };


  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(
        track,
        localStream
      );
    });
  }

  return peerConnection;
}


// ===============================
// CREATE OFFER
// ===============================

async function createOffer() {
  try {
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

  } catch (error) {
    console.error("Offer error:", error);
    setStatus("Could not start video connection.");
  }
}


// ===============================
// CAMERA
// ===============================

async function startCamera() {
  try {
    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {

      alert(
        "Camera access is not supported by this browser."
      );

      return;
    }

    const oldStream = localStream;

    const newStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: currentFacingMode
          }
        },
        audio: true
      });

    localStream = newStream;

    if (localVideo) {
      localVideo.srcObject = localStream;
      localVideo.muted = true;
      localVideo.playsInline = true;

      await localVideo.play().catch(() => {});
    }


    // If an existing WebRTC connection exists,
    // replace its camera track.
    if (peerConnection) {

      const newVideoTrack =
        localStream.getVideoTracks()[0];

      const videoSender =
        peerConnection
          .getSenders()
          .find(
            sender =>
              sender.track &&
              sender.track.kind === "video"
          );

      if (videoSender && newVideoTrack) {
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
              sender.track.kind === "audio"
          );

      if (audioSender && newAudioTrack) {
        await audioSender.replaceTrack(
          newAudioTrack
        );
      }

    } else if (roomCode) {
      await createPeerConnection();
    }


    // Stop old camera after new camera starts.
    if (oldStream) {
      oldStream.getTracks().forEach(
        track => track.stop()
      );
    }

    setStatus("Camera started.");

  } catch (error) {

    console.error("Camera error:", error);

    if (error.name === "NotAllowedError") {
      alert(
        "Camera/microphone permission allow karo."
      );
    }

    else if (error.name === "NotFoundError") {
      alert(
        "Camera device nahi mila."
      );
    }

    else if (error.name === "NotReadableError") {
      alert(
        "Camera kisi aur app mein use ho raha hai."
      );
    }

    else {
      alert(
        "Camera start nahi ho paaya: " +
        error.message
      );
    }
  }
}


// ===============================
// SWITCH FRONT / BACK CAMERA
// ===============================

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
}


// ===============================
// MUTE MICROPHONE
// ===============================

function toggleMute() {

  if (!localStream) {
    alert("Pehle camera start karo.");
    return;
  }

  const audioTracks =
    localStream.getAudioTracks();

  if (audioTracks.length === 0) {
    return;
  }

  const enabled =
    audioTracks[0].enabled;

  audioTracks.forEach(
    track => {
      track.enabled = !enabled;
    }
  );

  if (muteBtn) {
    muteBtn.textContent =
      enabled
        ? "Unmute Mic"
        : "Mute Mic";
  }
}


// ===============================
// END CALL
// ===============================

function endCall() {

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (localStream) {
    localStream.getTracks().forEach(
      track => track.stop()
    );

    localStream = null;
  }

  if (localVideo) {
    localVideo.srcObject = null;
  }

  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }

  if (roomCode) {
    socket.emit("leave-room");
  }

  if (muteBtn) {
    muteBtn.textContent = "Mute Mic";
  }

  setStatus("Call ended.");
}


// ===============================
// QR SCANNER
// ===============================

let qrScanner = null;

async function scanQR() {

  if (typeof Html5Qrcode === "undefined") {
    alert("QR scanner load nahi hua.");
    return;
  }

  const scannerId = "qr-reader";

  let scannerElement =
    document.getElementById(scannerId);

  if (!scannerElement) {

    scannerElement =
      document.createElement("div");

    scannerElement.id = scannerId;

    scannerElement.style.width = "100%";
    scannerElement.style.maxWidth = "350px";
    scannerElement.style.margin = "20px auto";

    document.body.appendChild(
      scannerElement
    );
  }


  qrScanner = new Html5Qrcode(scannerId);

  try {

    await qrScanner.start(
      {
        facingMode: "environment"
      },
      {
        fps: 10,
        qrbox: 250
      },

      async (decodedText) => {

        try {
          const url =
            new URL(decodedText);

          const room =
            url.searchParams.get("room");

          if (room) {

            await qrScanner.stop();
            qrScanner.clear();

            scannerElement.innerHTML = "";

            if (roomInput) {
              roomInput.value =
                room.toUpperCase();
            }

            joinRoom(room, false);
          }

        } catch (error) {
          console.log(
            "Invalid QR:",
            decodedText
          );
        }
      },

      () => {}
    );

  } catch (error) {

    console.error(
      "QR scanner error:",
      error
    );

    alert(
      "QR camera open nahi hua."
    );
  }
}


// ===============================
// BUTTON EVENTS
// ===============================

if (createRoomBtn) {
  createRoomBtn.addEventListener(
    "click",
    createRoom
  );
}


if (joinRoomBtn) {
  joinRoomBtn.addEventListener(
    "click",
    () => {
      const code =
        roomInput
          ? roomInput.value.trim()
          : "";

      joinRoom(code, false);
    }
  );
}


if (scanQrBtn) {
  scanQrBtn.addEventListener(
    "click",
    scanQR
  );
}


if (startCameraBtn) {
  startCameraBtn.addEventListener(
    "click",
    startCamera
  );
}


if (muteBtn) {
  muteBtn.addEventListener(
    "click",
    toggleMute
  );
}


if (endCallBtn) {
  endCallBtn.addEventListener(
    "click",
    endCall
  );
}


// ===============================
// ADD SWITCH

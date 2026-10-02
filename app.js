const socket = io();

const roomInput = document.getElementById("roomInput");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const scanBtn = document.getElementById("scanBtn");
const qrBox = document.getElementById("qrBox");
const qr = document.getElementById("qrcode");
const scanner = document.getElementById("scanner");
const statusEl = document.getElementById("status");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const cameraBtn = document.getElementById("cameraBtn");
const micBtn = document.getElementById("micBtn");
const endBtn = document.getElementById("endBtn");

let room = "";
let localStream = null;
let peer = null;
let scannerInstance = null;

const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" }
  ]
};

function status(message) {
  statusEl.textContent = message;
}

function randomRoom() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeRoomLink(code) {
  return `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`;
}

function showQR(code) {
  qr.innerHTML = "";
  new QRCode(qr, {
    text: makeRoomLink(code),
    width: 210,
    height: 210
  });
  qrBox.classList.remove("hidden");
}

async function startCamera() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: true
  });
  localVideo.srcObject = localStream;
  cameraBtn.textContent = "Camera On";
  return localStream;
}

function createPeer(initiator) {
  if (peer) peer.close();

  peer = new RTCPeerConnection(rtcConfig);

  if (localStream) {
    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  }

  peer.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("signal", { room, data: { candidate: event.candidate } });
    }
  };

  peer.onconnectionstatechange = () => {
    status(`Connection: ${peer.connectionState}`);
  };

  if (initiator) {
    peer.createOffer()
      .then(offer => peer.setLocalDescription(offer))
      .then(() => {
        socket.emit("signal", {
          room,
          data: { description: peer.localDescription }
        });
      });
  }

  return peer;
}

async function joinRoom(code) {
  room = code.trim().toUpperCase();
  if (!room) return status("Enter a room code.");

  try {
    await startCamera();
  } catch (err) {
    status("Camera/microphone permission was denied or unavailable.");
    return;
  }

  socket.emit("join-room", { room });
  status(`Joining room ${room}...`);
}

createBtn.onclick = async () => {
  const code = randomRoom();
  roomInput.value = code;
  showQR(code);
  await joinRoom(code);
};

joinBtn.onclick = () => joinRoom(roomInput.value);

cameraBtn.onclick = async () => {
  try {
    await startCamera();
    if (peer) {
      localStream.getTracks().forEach(track => {
        const already = peer.getSenders().some(s => s.track === track);
        if (!already) peer.addTrack(track, localStream);
      });
    }
    status("Camera is on.");
  } catch {
    status("Could not start the camera.");
  }
};

micBtn.onclick = () => {
  if (!localStream) return;
  const audio = localStream.getAudioTracks()[0];
  if (!audio) return;
  audio.enabled = !audio.enabled;
  micBtn.textContent = audio.enabled ? "Mute Mic" : "Unmute Mic";
};

endBtn.onclick = () => {
  if (room) socket.emit("leave-room");
  if (peer) peer.close();
  peer = null;
  remoteVideo.srcObject = null;

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  cameraBtn.textContent = "Start Camera";
  status("Call ended.");
};

socket.on("room-joined", ({ room: joinedRoom, count }) => {
  room = joinedRoom;
  status(count === 1 ? "Waiting for the second phone..." : "Connected.");
});

socket.on("peer-joined", async () => {
  status("Second phone joined. Connecting...");
  createPeer(true);
});

socket.on("signal", async (data) => {
  if (!peer) createPeer(false);

  try {
    if (data.description) {
      await peer.setRemoteDescription(data.description);

      if (data.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit("signal", {
          room,
          data: { description: peer.localDescription }
        });
      }
    }

    if (data.candidate) {
      await peer.addIceCandidate(data.candidate);
    }
  } catch (err) {
    console.error(err);
    status("WebRTC connection error.");
  }
});

socket.on("room-full", () => {
  status("This room already has two phones.");
});

socket.on("peer-left", () => {
  if (peer) peer.close();
  peer = null;
  remoteVideo.srcObject = null;
  status("The other phone left the room.");
});

scanBtn.onclick = async () => {
  if (typeof Html5Qrcode === "undefined") {
    status("QR scanner is still loading. Try again.");
    return;
  }

  scanner.classList.remove("hidden");

  if (scannerInstance) return;

  scannerInstance = new Html5Qrcode("scanner");

  try {
    await scannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        try {
          const url = new URL(decodedText);
          const code = url.searchParams.get("room");
          if (code) {
            roomInput.value = code;
            await scannerInstance.stop();
            scanner.classList.add("hidden");
            scannerInstance.clear();
            scannerInstance = null;
            await joinRoom(code);
          }
        } catch {
          status("QR scanned, but it is not a valid room link.");
        }
      },
      () => {}
    );
  } catch (err) {
    status("Unable to access the camera for QR scanning.");
    scanner.classList.add("hidden");
  }
};

const params = new URLSearchParams(location.search);
const initialRoom = params.get("room");
if (initialRoom) {
  roomInput.value = initialRoom;
  status("QR room detected. Tap Join Room.");
}

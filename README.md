# QR WebRTC Video Call

A simple two-phone video calling website using:

- WebRTC for live audio/video
- Socket.IO for signaling
- QR code for room pairing
- Express for serving the app

## Important

GitHub is used to store the source code. GitHub Pages cannot run the Node.js signaling server, so deploy this project to a Node-compatible host such as Render, Railway, Fly.io, or your own server.

Camera access requires HTTPS (localhost is also allowed).

## Run locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

For testing from two phones, use the deployed HTTPS URL. A normal `http://192.168...` address may not be allowed to access the camera on phones.

## How to use

1. Phone A opens the site.
2. Tap `Create Room`.
3. A QR code appears.
4. Phone B opens the same site and taps `Scan QR`.
5. Scan Phone A's QR code.
6. Both phones join the same room.
7. Allow camera and microphone permissions.
8. The WebRTC video connection starts.

## Deploying

Push this repository to GitHub, then create a Node/Web Service on your hosting provider.

Build/install command:

```bash
npm install
```

Start command:

```bash
npm start
```

The app listens on the `PORT` environment variable supplied by the host.

## Production note

For difficult networks, add a TURN server to `rtcConfig.iceServers`. The included Google STUN server is useful for basic testing but is not a complete production TURN solution.

## Privacy

This demo does not intentionally record or save the camera stream. The signaling server exchanges WebRTC connection information; the media connection is handled by WebRTC.

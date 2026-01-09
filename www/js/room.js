// room.js - FIX OFF-CAM BUG
if (typeof socket === "undefined") {
  var socket = io("https://m3h048qq-4000.asse.devtunnels.ms");
}

const roomId = sessionStorage.getItem("currentRoomId");
const myName = sessionStorage.getItem("userName");

let myStream = null;
let cameraOn = false;
const peers = {};
let currentUsers = [];

async function getIceServers() {
  try {
    const res = await fetch(
      "https://m3h048qq-4000.asse.devtunnels.ms/turn-token"
    );
    const token = await res.json();
    return token.iceServers;
  } catch (e) {
    return [];
  }
}

socket.emit("join-room", roomId, myName);

function renderVideo(userId, userName, stream, isMe) {
  const card = document.getElementById(`card-${userId}`);
  if (!card) return;

  const feed = card.querySelector(".video-feed");

  if (!stream) {
    feed.innerHTML = "";
    feed.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(
      userName
    )}&background=random')`;
    return;
  }

  // Jika sudah ada video, jangan buat baru, cukup update src
  let video = feed.querySelector("video");
  if (!video) {
    video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    feed.appendChild(video);
  }

  video.srcObject = stream;
  video.muted = isMe;
  feed.style.backgroundImage = "none";
}

// Inisialisasi Peer
async function initPeer(userToSignal, isInitiator, incomingSignal = null) {
  const iceServers = await getIceServers();
  const peer = new SimplePeer({
    initiator: isInitiator,
    trickle: false,
    config: { iceServers },
    stream: myStream,
  });

  peer.on("signal", (signal) => {
    if (isInitiator) {
      socket.emit("sending-signal", {
        userToSignal,
        callerID: socket.id,
        signal,
        userName: myName,
      });
    } else {
      socket.emit("returning-signal", { signal, callerID: userToSignal });
    }
  });

  peer.on("stream", (remoteStream) => {
    const user = currentUsers.find((u) => u.id === userToSignal);
    renderVideo(userToSignal, user ? user.name : "User", remoteStream, false);
  });

  if (incomingSignal) peer.signal(incomingSignal);

  peers[userToSignal] = peer;
}

// Socket Listeners
socket.on("user-joined", (payload) => {
  initPeer(payload.callerID, false, payload.signal);
});

socket.on("receiving-returned-signal", (payload) => {
  if (peers[payload.id]) peers[payload.id].signal(payload.signal);
});

socket.on("peer-camera-on", (payload) => {
  // Jika mereka on cam, kita siapkan peer baru jika belum ada
  // Tapi biasanya signaling otomatis mengurus ini
  console.log("Peer on cam:", payload.callerID);
});

socket.on("peer-camera-off", (payload) => {
  const user = currentUsers.find((u) => u.id === payload.callerID);
  renderVideo(payload.callerID, user ? user.name : "User", null, false);
});

socket.on("update-user-list", (users) => {
  currentUsers = users;
  const grid = document.querySelector(".video-grid");
  if (!grid) return;

  // Render ulang grid tanpa merusak stream yang ada
  const existingCards = Array.from(grid.querySelectorAll(".video-card")).map(
    (c) => c.id
  );
  const newUserIds = users.map((u) => `card-${u.id}`);

  // Hapus user yang keluar
  existingCards.forEach((id) => {
    if (!newUserIds.includes(id)) document.getElementById(id)?.remove();
  });

  // Tambah user baru
  users.forEach((u) => {
    if (!document.getElementById(`card-${u.id}`)) {
      const card = document.createElement("div");
      card.id = `card-${u.id}`;
      card.className = `video-card ${
        u.id === socket.id ? "active-speaker" : ""
      }`;
      card.innerHTML = `
        <div class="video-feed"></div>
        <div class="video-overlay"><span class="user-name">${u.name} ${
        u.id === socket.id ? "(You)" : ""
      }</span></div>
      `;
      grid.appendChild(card);
      renderVideo(u.id, u.name, null, u.id === socket.id);
    }
  });
});

async function startCamera() {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    cameraOn = true;
    renderVideo(socket.id, myName, myStream, true);

    socket.emit("notify-camera-on", { roomId });

    // Kirim stream ke semua peer yang sudah tersambung
    currentUsers.forEach((user) => {
      if (user.id !== socket.id) {
        if (peers[user.id]) {
          peers[user.id].addStream(myStream);
        } else {
          initPeer(user.id, true);
        }
      }
    });
  } catch (err) {
    console.error(err);
  }
}

function stopCamera() {
  if (myStream) {
    myStream.getTracks().forEach((track) => {
      track.stop();
      // Beritahu peer bahwa stream dihentikan
      Object.values(peers).forEach((peer) => {
        try {
          peer.removeStream(myStream);
        } catch (e) {}
      });
    });
    myStream = null;
  }
  cameraOn = false;
  renderVideo(socket.id, myName, null, true);
  socket.emit("notify-camera-off", { roomId });
}

function toggleCamera() {
  cameraOn ? stopCamera() : startCamera();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".control-btn").forEach((btn) => {
    if (
      btn.querySelector(".material-symbols-outlined")?.textContent.trim() ===
      "videocam"
    ) {
      btn.addEventListener("click", toggleCamera);
    }
  });
});

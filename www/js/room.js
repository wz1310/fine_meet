// room.js - FIXED WEBRTC STABILITY & OFF-CAM RENDERING
if (typeof socket === "undefined") {
  var socket = io("https://c1jx4415-4000.asse.devtunnels.ms");
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
      "https://c1jx4415-4000.asse.devtunnels.ms/turn-token"
    );
    const token = await res.json();
    return token.iceServers;
  } catch (e) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

// Inisialisasi awal
socket.emit("join-room", roomId, myName);

function renderVideo(userId, userName, stream, isMe) {
  const card = document.getElementById(`card-${userId}`);
  if (!card) return;

  const feed = card.querySelector(".video-feed");

  // JIKA OFF-CAM ATAU STREAM MATI
  if (!stream) {
    feed.innerHTML = ""; // Hapus elemen video agar tidak hitam
    feed.style.backgroundImage = `url('https://ui-avatars.com/api/?name=${encodeURIComponent(
      userName
    )}&background=random&size=256')`;
    feed.style.backgroundSize = "cover";
    feed.style.backgroundPosition = "center";
    return;
  }

  // JIKA ON-CAM
  let video = feed.querySelector("video");
  if (!video) {
    video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    feed.appendChild(video);
  }

  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  video.muted = isMe;
  feed.style.backgroundImage = "none";
}

async function initPeer(userToSignal, isInitiator, incomingSignal = null) {
  const iceServers = await getIceServers();

  if (peers[userToSignal]) {
    peers[userToSignal].destroy();
  }

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

  peer.on("error", (err) => {
    console.error("Peer error:", err);
    // Jika error, bersihkan video
    const user = currentUsers.find((u) => u.id === userToSignal);
    renderVideo(userToSignal, user ? user.name : "User", null, false);
  });

  if (incomingSignal) peer.signal(incomingSignal);
  peers[userToSignal] = peer;
}

// --- Socket Listeners ---

socket.on("user-joined", (payload) => {
  initPeer(payload.callerID, false, payload.signal);
});

socket.on("receiving-returned-signal", (payload) => {
  if (peers[payload.id]) {
    peers[payload.id].signal(payload.signal);
  }
});

socket.on("update-user-list", (users) => {
  currentUsers = users;
  const grid = document.querySelector(".video-grid");
  if (!grid) return;

  const newUserIds = users.map((u) => `card-${u.id}`);

  // Hapus card user keluar
  Array.from(grid.querySelectorAll(".video-card")).forEach((card) => {
    if (!newUserIds.includes(card.id)) card.remove();
  });

  // Tambah card user baru
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

      if (u.id !== socket.id && !peers[u.id]) {
        initPeer(u.id, true);
      }
    }
  });
});

// Listener penting agar lawan bicara tahu Anda off-cam
socket.on("peer-camera-off", (payload) => {
  const user = currentUsers.find((u) => u.id === payload.callerID);
  if (user) {
    renderVideo(payload.callerID, user.name, null, false);
  }
});

// --- Camera Controls ---

async function startCamera() {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    cameraOn = true;
    renderVideo(socket.id, myName, myStream, true);

    socket.emit("notify-camera-on", { roomId });

    // Paksa negosiasi ulang ke semua peer agar video tampil di mereka
    Object.keys(peers).forEach((userId) => {
      initPeer(userId, true);
    });
  } catch (err) {
    console.error("Gagal akses kamera:", err);
    alert("Mohon izinkan akses kamera.");
  }
}

function stopCamera() {
  if (myStream) {
    myStream.getTracks().forEach((track) => track.stop());
    myStream = null;
  }
  cameraOn = false;

  // Update UI sendiri
  renderVideo(socket.id, myName, null, true);

  // Beritahu orang lain bahwa kita off-cam agar layar mereka tidak hitam
  socket.emit("notify-camera-off", { roomId });

  // Reset koneksi peer agar kembali ke kondisi tanpa stream
  Object.keys(peers).forEach((userId) => {
    initPeer(userId, true);
  });
}

function toggleCamera() {
  cameraOn ? stopCamera() : startCamera();
}

// --- UI Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".control-btn").forEach((btn) => {
    const iconText = btn
      .querySelector(".material-symbols-outlined")
      ?.textContent.trim();
    if (iconText === "videocam") {
      btn.addEventListener("click", toggleCamera);
    }
  });

  // Chat toggle & Back button logic tetap sama
  const chatBtn = document.querySelector(".control-btn.primary");
  const chatSidebar = document.querySelector(".chat-sidebar");
  if (chatBtn && chatSidebar) {
    chatBtn.addEventListener("click", () => {
      chatSidebar.classList.toggle("open");
      chatBtn.classList.toggle("active");
    });
  }

  const backBtn = document.querySelector(".control-btn.small-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "/";
    });
  }
});

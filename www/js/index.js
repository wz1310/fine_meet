// Gantilah IP ini dengan IP Address komputer server Anda jika dijalankan di HP asli
const SERVER_URL = "https://c1jx4415-4000.asse.devtunnels.ms";

// 1. Inisialisasi Koneksi Socket.io
const socket = io(SERVER_URL);

// Elemen UI untuk Status
const statusIcon = document.querySelector(
  ".status-indicator .material-symbols-outlined"
);
const statusText = document.querySelector(".status-indicator span:last-child");

// Fungsi untuk membuat dan menampilkan popup
function showJoinModal() {
  // 1. Cek jika modal sudah ada agar tidak duplikat
  if (document.getElementById("join-modal-container")) return;

  // 2. Buat elemen container modal
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "join-modal-container";
  modalOverlay.style = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); display: flex; justify-content: center;
    align-items: center; z-index: 9999; backdrop-filter: blur(4px);
  `;

  // 3. Masukkan HTML popup ke dalam overlay
  modalOverlay.innerHTML = `
    <div style="background: #242424; padding: 24px; border-radius: 16px; width: 90%; max-width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); color: white; font-family: 'Inter', sans-serif;">
      <h2 style="margin-top: 0; font-size: 20px;">Join Meeting</h2>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #aaa;">Your Name</label>
        <input type="text" id="modalUserName" placeholder="Enter your name" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #333; background: #121212; color: white; box-sizing: border-box; outline: none;">
      </div>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #aaa;">Meeting ID</label>
        <input type="text" id="modalRoomId" placeholder="e.g. 345-982-1102" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #333; background: #121212; color: white; box-sizing: border-box; outline: none;">
      </div>
      <button id="modalSubmitBtn" style="width: 100%; padding: 12px; background: #0e71eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">Join Now</button>
      <button id="modalCloseBtn" style="width: 100%; margin-top: 8px; background: transparent; color: #aaa; border: none; cursor: pointer; font-size: 13px;">Cancel</button>
    </div>
  `;

  document.body.appendChild(modalOverlay);

  // 4. Event Listener untuk tombol Join di dalam modal
  document.getElementById("modalSubmitBtn").addEventListener("click", () => {
    const name = document.getElementById("modalUserName").value;
    const room = document.getElementById("modalRoomId").value;

    if (name && room) {
      console.log(`User ${name} joining room: ${room}`);
      socket.emit("join-room", room, name);

      // Hapus modal setelah join
    //   document.body.removeChild(modalOverlay);
    } else {
      alert("Please fill in all fields");
    }
  });

  // 5. Event Listener untuk tombol Cancel
  document.getElementById("modalCloseBtn").addEventListener("click", () => {
    document.body.removeChild(modalOverlay);
  });
}

// Event saat berhasil terhubung
socket.on("connect", () => {
  console.log("Terhubung ke server dengan ID:", socket.id);

  // Mengubah indikator menjadi Hijau (Connected)
  if (statusIcon && statusText) {
    statusIcon.style.color = "#2ecc71"; // Warna hijau
    statusText.innerText = "Connected";
  }
});

// Listener jika Room ID ditemukan
socket.on("join-success", (data) => {
  console.log("Berhasil join ke:", data.roomName);

  // Simpan data di sessionStorage agar bisa dibaca di halaman room.html jika perlu
  sessionStorage.setItem("currentRoomId", data.roomId);
  sessionStorage.setItem("currentRoomName", data.roomName);
  sessionStorage.setItem("userName", data.userName); // Simpan nama user

  // Pindah ke halaman room.html
  window.location.href = "room.html";
});

// Listener jika Room ID tidak ditemukan
socket.on("join-error", (message) => {
  alert(message); // Munculkan pesan error dari server
});

// Event saat terputus atau gagal koneksi
socket.on("disconnect", () => {
  console.log("Koneksi terputus");

  // Mengubah indikator menjadi Merah (Disconnected)
  if (statusIcon && statusText) {
    statusIcon.style.color = "#e74c3c"; // Warna merah
    statusText.innerText = "Disconnected";
  }
});

socket.on("connect_error", () => {
  console.log("Gagal terhubung ke server");
  if (statusIcon && statusText) {
    statusIcon.style.color = "#e74c3c";
    statusText.innerText = "Connection Failed";
  }
});

// 2. Fungsi untuk Join Room
function joinMeeting(roomId) {
  if (roomId) {
    socket.emit("join-room", roomId);
    console.log("Mencoba join ke room:", roomId);
  }
}

// 3. Menghubungkan ke UI
document.addEventListener("DOMContentLoaded", () => {
  const joinBtn = document.querySelector(".action-card");

  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      showJoinModal();
    });
  }

  // Listener untuk menerima data dari popup.html (jika menggunakan iframe/popup window)
  window.addEventListener("message", (event) => {
    if (event.data.type === "JOIN_ROOM") {
      const { name, room } = event.data;
      console.log(`User ${name} joining room: ${room}`);

      // Emit ke server dengan tambahan data nama jika diperlukan
      socket.emit("join-room", room, name);

      // Kembali ke halaman utama atau tutup popup
      // window.location.href = "index.html";
    }
  });

  // Memanggil REST API status
  fetch(`${SERVER_URL}/api/status`)
    .then((response) => response.json())
    .then((data) => {
      console.log("Status Server API:", data.message);
    })
    .catch((err) => console.error("Gagal akses API:", err));
});

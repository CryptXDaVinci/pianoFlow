**🎹 Ambient Piano Radio**

Ambient Piano Radio adalah layanan streaming audio berbasis Node.js yang menghasilkan suara piano ambient secara real-time. Proyek ini dirancang untuk menghasilkan musik latar yang menenangkan, cocok untuk fokus, relaksasi, atau sebagai inspirasi kreatif.

**🚀 Fitur**

* Streaming Audio Real-time menggunakan FFmpeg dan Express.

* Generasi Suara Piano Acak dengan kombinasi chord dan ambient pad.

* Kualitas Suara Halus dengan mixing yang dioptimalkan.

* Stabil & Efisien untuk penggunaan jangka panjang.



---

**📦 Instalasi**

**. Klon Repository**

```bash
git clone https://github.com/username/ambient-piano-radio.git
cd ambient-piano-radio
```

**2. Instalasi Dependencies**

Pastikan Anda memiliki Node.js dan npm.
Jika belum terinstal, silakan instal Node.js terlebih dahulu.
```bash
npm install
```

**3. Instal FFmpeg**

Pastikan FFmpeg terinstal di sistem Anda.

* Debian/Ubuntu:
```bash
sudo apt update
sudo apt install ffmpeg
```
* Termux (Android):
```bash
pkg install ffmpeg
```
* Windows:
Unduh dari FFmpeg Official dan tambahkan ke PATH.
---

**⚡ Cara Menjalankan**
```bash
node index.js

Server akan berjalan di:

http://localhost:3000/stream
```


Untuk mendengarkan, cukup buka URL tersebut di browser atau gunakan media player seperti VLC:

VLC:
Media → Open Network Stream → Masukkan URL http://localhost:3000/stream



---

**🎛️ Konfigurasi (Opsional)**

* Anda dapat mengubah beberapa parameter di dalam kode:

* Port Server: Ubah variabel PORT di index.js.

* Frekuensi Ambient: Modifikasi generateAmbientPad() untuk suara yang berbeda.

* Variasi Chord: Tambahkan atau ubah array CHORDS untuk akord yang baru.
---

**🔧 API Endpoint**
```bash
GET /stream
Endpoint untuk streaming audio real-time.
```

Contoh:
```bash
curl http://localhost:3000/stream --output ambient.mp3
```

---

**🤝 Kontribusi**

Kontribusi sangat terbuka!
Silakan fork repository ini, buat branch baru, dan kirim pull request.
```bash
git checkout -b fitur-baru
git commit -m "Menambahkan fitur baru"
git push origin fitur-baru
```

---

📜 Lisensi

Proyek ini dilisensikan di bawah MIT License.


---

👤 Pembuat

CryptXDaVinci
GitHub: github.com/CryptXDaVinci

---

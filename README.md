# SociaBuzz → Antrian BY1 FF (starter)

Starter server ini menyediakan:
- `POST /webhook/<WEBHOOK_PATH_SECRET>` untuk menerima webhook SociaBuzz
- `/` untuk overlay transparan yang otomatis refresh tiap 2 detik
- `GET /api/queue` untuk data antrean
- endpoint admin sederhana dengan `ADMIN_TOKEN`

## Penting
1. Format pesan donatur yang diharapkan: `NICK: nama_ff | ID: 123456789`
2. Struktur payload webhook SociaBuzz harus diperiksa dulu. Kode mencoba membaca beberapa nama field pesan umum, tetapi belum bisa dijamin cocok sebelum payload tes asli diperiksa.
3. Queue disimpan di memori server untuk demo. Antrean akan hilang saat server restart/redeploy/berhenti. Untuk pemakaian live, sambungkan database persisten (misalnya Postgres/Supabase).
4. Jangan publikasikan secret atau token. Jangan masukkan API key SociaBuzz ke kode.
5. Gunakan hanya jika konfigurasi akun SociaBuzz menyediakan webhook donasi dan event yang dikirim benar-benar memuat pesan donatur.

## Deploy ke Render
1. Upload folder ini ke repository GitHub milikmu.
2. Di Render pilih **New → Web Service**, hubungkan repo tersebut.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Tambahkan Environment Variables:
   - `WEBHOOK_PATH_SECRET` = string acak panjang, misalnya hasil password generator
   - `ADMIN_TOKEN` = string acak lain yang kuat
6. Deploy. Render memberi URL HTTPS seperti `https://nama-service.onrender.com`.
7. Cek `https://nama-service.onrender.com/health` harus menampilkan `{"ok":true}`.
8. Masukkan URL webhook SociaBuzz: `https://nama-service.onrender.com/webhook/NILAI_WEBHOOK_PATH_SECRET`
9. Setelah webhook test, cek Logs di Render. Jika format pesan tidak terbaca, jangan menebak; perlu menyesuaikan parser berdasarkan payload asli.

## Uji antrean manual (opsional)
POST ke `/api/admin/add` dengan header `x-admin-token: <ADMIN_TOKEN>` dan JSON:
`{"nickname":"contoh_ff","playerId":"123456789"}`

## Overlay OBS
Tambahkan Browser Source dengan URL `https://nama-service.onrender.com/`, lalu atur ukuran sesuai kebutuhan (misalnya lebar 280, tinggi 600). Jangan gunakan file HTML lokal jika ingin antrean server online.

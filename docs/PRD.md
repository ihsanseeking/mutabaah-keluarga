# PRD — Mutabaah Keluarga
**Product Requirements Document**
Versi: 1.0 (MVP) | Dibuat: 2026-08-27
Diturunkan dari konsep: Mutabaah Fidin Jenggot Merah

---

## Changelog

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-08-27 | Draft awal MVP: Amir-only config amalan, fokus istilah "Keluarga", backend Google Sheets + Apps Script |
| 1.1 | 2026-08-28 | Profil anak (checklist by proxy oleh orang tua), amalan bertarget per-anggota, usulan amalan dari anggota (approve/reject oleh Amir), katalog rekomendasi amalan |
| 1.1.1 | 2026-08-28 | Login via No HP (opsional, tanpa kode undangan), cegah nama/No HP duplikat, ingat kode undangan terakhir di device |
| 1.2.0 | 2026-08-28 | PWA installable penuh (icon + service worker), pengingat checklist terjadwal (Amir atur jam, sistem kasih rekomendasi jam) via push notification Firebase Cloud Messaging |

---

## 1. Latar Belakang

Proyek **Mutabaah Fidin Jenggot Merah** membuktikan pola PJ/Pembina + anggota efektif untuk mutabaah kelompok. **Mutabaah Keluarga** menurunkan pola yang sama ke skala rumah tangga: kepala keluarga (disebut **Amir**) menetapkan poin-poin amalan yang wajib/dianjurkan dijalankan anggota keluarganya, dan memantau progresnya.

Berbeda dari proyek asal yang hardcode 1 grup + daftar amalan tetap, Mutabaah Keluarga dirancang **multi-tenant**: satu aplikasi bisa dipakai banyak keluarga berbeda sekaligus, masing-masing terisolasi datanya, dan daftar amalannya **sepenuhnya fleksibel** — Amir bisa menambah, mengubah, menonaktifkan amalan kapan pun tanpa perlu update kode.

## 2. Tujuan Produk

| # | Tujuan | Indikator Keberhasilan |
|---|---|---|
| 1 | Amir bisa menyusun poin amalan sendiri tanpa bantuan developer | Amir bisa tambah/ubah/nonaktifkan amalan dari UI dalam < 1 menit |
| 2 | Anggota keluarga mudah checklist amalan harian | Checklist bisa diisi offline, tersync otomatis saat online |
| 3 | Satu aplikasi melayani banyak keluarga terisolasi | Data satu keluarga tidak bisa diakses keluarga lain |
| 4 | Biaya operasional Rp0 | Backend Google Sheets + Apps Script, tanpa biaya hosting database |
| 5 | Tampilan bisa dipersonalisasi | Amir bisa ubah warna & font tema keluarganya sendiri |

## 3. Pengguna (User Personas)

### 3.1 Amir (Kepala Keluarga)
- Membuat keluarga baru → dapat kode undangan unik
- Menyusun/mengubah daftar amalan & target secara bebas
- Memantau progres seluruh anggota keluarga
- Mengatur tema warna & font aplikasi keluarganya

### 3.2 Anggota Keluarga
- Bergabung ke keluarga menggunakan kode undangan dari Amir
- Checklist amalan harian sesuai daftar yang ditetapkan Amir
- Melihat progres pribadi

*(v1.1 — Anggota bisa mengusulkan amalan baru untuk disetujui Amir; lihat §9 Roadmap)*

## 4. Fitur Utama (MVP v1.0)

### 4.1 Modul Identitas & Keluarga
- **F-01 Buat Keluarga** — Amir isi nama keluarga + nama sendiri + PIN → sistem generate `keluarga_id` & **kode undangan** 6 karakter unik.
- **F-02 Gabung Keluarga** — Anggota input kode undangan + nama + buat PIN sendiri.
- **F-03 Login** — kode undangan + nama + PIN → sistem terbitkan token sesi (HMAC-signed, tersimpan di localStorage).
- **F-04 Isolasi Data** — setiap request API disertai token; server memvalidasi `keluarga_id` pemilik token sebelum baca/tulis data — anggota keluarga lain tidak bisa saling mengakses data.

### 4.2 Modul Amalan (Amir)
- **F-05 Kelola Amalan** — Amir dapat membuat amalan baru (nama, kategori, tipe `checkbox`/`counter`, target jika counter, urutan tampil, hari spesifik opsional misal "hanya Jumat").
- **F-06 Ubah/Nonaktifkan Amalan** — perubahan langsung berlaku ke semua anggota tanpa perlu update aplikasi. Amalan yang dinonaktifkan tidak dihapus (soft-delete via kolom `status`) agar riwayat checkin lama tetap valid untuk laporan.

### 4.3 Modul Checklist (Anggota)
- **F-07 Checklist Harian** — anggota centang amalan sesuai daftar aktif keluarganya.
- **F-08 Offline-First** — setiap centang tersimpan ke localStorage dulu (state langsung update di UI), baru masuk antrean sinkronisasi (outbox) ke backend — device offline tetap bisa dipakai penuh.
- **F-09 Auto-Sync** — outbox dikirim batch setiap ±15 detik atau saat koneksi kembali online (event `online`), bukan per-klik — supaya hemat call ke Apps Script & tetap responsif walau backend agak lambat.

### 4.4 Modul Laporan (Amir)
- **F-10 Rekap Progres Keluarga** — Amir bisa melihat rekap jumlah checkin per anggota dalam rentang tanggal.
- *(Grafik & ekspor CSV — v1.1, lihat roadmap)*

### 4.5 Modul Tema
- **F-11 Kustom Warna & Font** — Amir mengatur warna primer/sekunder & font aplikasi keluarganya dari panel; tersimpan per keluarga, diterapkan otomatis ke semua device anggota lewat CSS custom properties saat app dimuat.

## 5. Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-01 | Bekerja offline penuh untuk aksi checklist (localStorage sebagai primary store) |
| NFR-02 | PIN tidak pernah disimpan dalam bentuk plain text — di-hash (SHA-256 + salt unik per user) sebelum masuk Sheet |
| NFR-03 | Token sesi ditandatangani (HMAC) dengan secret yang hanya ada di server (Script Properties), tidak pernah dikirim ke client |
| NFR-04 | Semua penulisan ke Sheet dibungkus `LockService` untuk mencegah race condition antar device |
| NFR-05 | Data satu keluarga tidak bisa diakses/dibaca keluarga lain lewat API manapun |
| NFR-06 | Responsive, mobile-first, mendukung layar 360px+ |

## 6. Batasan Teknis yang Disadari (Trade-off)

Google Sheets + Apps Script dipilih karena skala data kecil (per keluarga hanya beberapa anggota) dan supaya tidak menambah biaya/service baru. Konsekuensi yang disadari dan sudah dimitigasi dalam desain:

- **Latensi lebih tinggi** dari database asli (~1–3 detik/call) → dimitigasi dengan pola offline-first (UI tidak pernah menunggu network).
- **Tidak ada realtime subscription bawaan** → cukup untuk kebutuhan sekarang karena mutabaah bukan aplikasi realtime; jika dibutuhkan nanti, tinggal tambah polling interval.
- **Auth harus ditangani manual** (bukan bawaan seperti Supabase Auth) → diselesaikan dengan token HMAC + validasi `keluarga_id` di setiap handler.
- **Quota Apps Script** (30 eksekusi simultan, 6 menit/eksekusi) → jauh di atas kebutuhan skala puluhan keluarga; jadi baru relevan kalau proyek berkembang jadi produk berskala besar. Pada titik itu, layer sync sengaja dibuat terpisah (`callApi()` di frontend) supaya backend bisa diganti (misal ke Firestore/Supabase) tanpa membongkar UI.

## 7. Out of Scope (MVP v1.0)

- Anggota mengusulkan amalan untuk disetujui Amir (approval flow)
- Grafik & ekspor laporan (CSV/gambar)
- Notifikasi/reminder
- Multi-bahasa
- Mode "Grup" generik (istilah tetap "Keluarga" — lihat §8)

## 8. Keputusan Arsitektur & Rasional

Dicatat di sini supaya keputusan yang sudah diambil tidak perlu didiskusikan ulang tiap kali proyek dilanjutkan:

| Keputusan | Alasan |
|---|---|
| Repo terpisah dari `fidin-mutabaah-app` | Model data & auth berbeda signifikan (multi-tenant vs 1 grup hardcode); lebih bersih dipisah, meski UI & pola offline-first di-reuse dari proyek asal |
| MVP: Amir-only config amalan (bukan approval-flow) | Mempercepat rilis MVP yang bisa langsung dites; skema data (kolom `status`, `dibuat_oleh`) sudah dirancang siap menampung status `diajukan` tanpa migrasi saat approval-flow ditambah di v1.1 |
| Istilah tetap "Keluarga" (bukan digeneralisasi ke "Grup") | Fokus dulu ke use-case nyata yang jelas; skema & kode tetap ditulis generik secara struktural (tidak ada logic yang hardcode "harus 1 amir 1 keluarga"), jadi migrasi istilah ke "Grup" nanti murni cosmetic, bukan re-arsitektur |
| Database: Google Sheets + Apps Script (via clasp) | Skala data kecil, gratis, transparan (bisa diintip manual), tidak nambah service baru. Trade-off latensi & quota dimitigasi lewat pola offline-first (lihat §6) |
| Repo public | Kode sumber terbuka; data asli (nama, checkin) tersimpan terpisah di Google Sheets masing-masing deployment, bukan di repo — jadi aman dipublikasikan |

## 9. Roadmap

| Versi | Fitur |
|---|---|
| v1.0 (MVP) | Multi-keluarga, Amir kelola amalan bebas, checklist offline-first, laporan rekap sederhana, tema custom |
| v1.1 | Anggota usulkan amalan → Amir approve/reject, grafik progres, ekspor CSV, streak |
| v1.2 | Notifikasi/reminder browser, motivasi sosial antar anggota (opsional per keluarga) |
| v2.0 | Generalisasi istilah "Keluarga" → "Grup" (dukung kelompok kajian, dll), sama seperti roadmap `fidin-mutabaah-app` |

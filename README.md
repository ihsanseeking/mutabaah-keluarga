# Mutabaah Keluarga

Aplikasi mutabaah (checklist amalan harian) untuk keluarga — konsepnya diturunkan dari [Mutabaah Fidin Jenggot Merah](https://github.com/ihsanseeking/fidin-mutabaah-app) (pola PJ/Pembina), tapi digeneralisasi ke skala rumah tangga: kepala keluarga (**Amir**) yang menyusun poin-poin amalan untuk anggota keluarganya, sepenuhnya fleksibel dan bisa diubah kapan saja tanpa update kode.

🔗 **Live App**: _(isi setelah deploy)_

## Fitur MVP (v1.0)
- 👨‍👩‍👧‍👦 Multi-keluarga dalam satu aplikasi — tiap keluarga terisolasi via kode undangan
- ⚙️ Amir menentukan/mengubah daftar amalan & target secara bebas
- ✅ Anggota checklist amalan harian, **offline-first** (localStorage → sync ke Google Sheets)
- 📊 Laporan rekap progres keluarga untuk Amir
- 🎨 Tema warna & font bisa dikustom per keluarga
- 🔐 Login sederhana: kode keluarga + nama + PIN (tanpa email/password)

## Roadmap
- **v1.1** — Anggota bisa mengusulkan amalan, Amir approve/reject; grafik & ekspor CSV
- **v1.2** — Reminder browser, motivasi sosial antar anggota
- **v2.0** — Generalisasi istilah "Keluarga" → "Grup" (support kelompok kajian juga)

## Tech Stack
| Layer | Teknologi |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, single-file PWA (`public/index.html`) |
| Backend/API | Google Apps Script Web App (`apps-script/`) |
| Database | Google Sheets |
| Dev tooling backend | [clasp](https://github.com/google/clasp) — CLI resmi Google untuk Apps Script |
| Hosting frontend | Cloudflare Pages / Netlify (static) |

## Dokumen
- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document (fitur, persona, keputusan arsitektur)
- [`docs/ERD.md`](docs/ERD.md) — Skema Google Sheets
- [`docs/API.md`](docs/API.md) — Kontrak API Apps Script

## Setup

### 1. Backend (Google Apps Script)
```bash
npm install -g @google/clasp
clasp login
cd apps-script
cp .clasp.json.example .clasp.json   # lalu isi scriptId hasil `clasp create`
clasp create --type webapp --title "Mutabaah Keluarga API"
clasp push
clasp deploy
```
Di editor Apps Script (`clasp open`):
1. **Project Settings → Script Properties** → tambah `TOKEN_SECRET` (string acak panjang, buat sendiri — dipakai untuk menandatangani token sesi).
2. Jalankan fungsi `setupSheets` sekali (dari dropdown fungsi di editor) untuk membuat semua tab & header Sheet sesuai [`docs/ERD.md`](docs/ERD.md).
3. Salin URL Web App hasil `clasp deploy`.

### 2. Frontend
Buka `public/index.html`, ganti nilai `API_URL` dengan URL Web App di atas, lalu deploy ke Cloudflare Pages/Netlify (drag & drop atau git-connected).

## Struktur Proyek
```
apps-script/   → Backend API (Google Apps Script, dikelola via clasp)
public/        → Frontend PWA
docs/          → PRD, ERD, spesifikasi API
```

---

Dikembangkan dari basis [fidin-mutabaah-app](https://github.com/ihsanseeking/fidin-mutabaah-app).

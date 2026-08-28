# ERD — Mutabaah Keluarga
**Skema Google Sheets (dipakai sebagai database)**
Versi: 1.0

---

## Catatan Arsitektur

Satu Google Spreadsheet menampung **semua keluarga** (multi-tenant), dipisahkan lewat kolom `keluarga_id` di setiap tabel/tab. Tidak ada spreadsheet terpisah per keluarga — ini menjaga skema tetap sederhana untuk dikelola lewat Apps Script biasa (`SpreadsheetApp`), sekaligus menghindari batas jumlah spreadsheet per akun Google.

Setiap tab punya baris header di baris 1, dibuat otomatis oleh fungsi `setupSheets()` di `apps-script/Utils.js` (jalankan sekali dari editor Apps Script setelah setup awal).

## Diagram ERD

```
┌─────────────────────────────┐
│           keluarga            │
├─────────────────────────────┤
│ 🔑 keluarga_id     TEXT       │
│    nama_keluarga   TEXT       │
│    kode_invite     TEXT  UQ   │  ← 6 karakter, dipakai untuk join & login
│    amir_user_id    TEXT       │
│    tema_primary    TEXT       │
│    tema_secondary  TEXT       │
│    tema_font       TEXT       │
│    tema_mode       TEXT       │
│    dibuat_at       DATETIME   │
└──────────┬──────────────────┘
           │ 1 : ∞
   ┌───────┼────────────────────────────────────┐
   ▼                                             ▼
┌──────────────────────┐             ┌──────────────────────────┐
│         users          │             │      amalan_config         │
├──────────────────────┤             ├──────────────────────────┤
│ 🔑 user_id      TEXT    │             │ 🔑 amalan_id      TEXT      │
│    keluarga_id  FK     │             │    keluarga_id    FK       │
│    nama         TEXT    │             │    nama           TEXT      │
│    peran        TEXT    │  'amir' /   │    kategori        TEXT      │
│                          │  'anggota'  │    tipe   'checkbox'/'counter'│
│    pin_hash     TEXT    │             │    target          NUMBER    │
│    pin_salt     TEXT    │             │    urutan          NUMBER    │
│    aktif        BOOL    │             │    hari_spesifik   TEXT      │
│    dibuat_at DATETIME  │             │    status  'aktif'/'nonaktif' │
└──────────┬──────────────┘             │      (siap 'diajukan' v1.1)  │
           │                             │    dibuat_oleh     FK(user)  │
           │                             │    dibuat_at      DATETIME   │
           │                             └──────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│                checkin                  │
├──────────────────────────────────────┤
│ 🔑 checkin_id     TEXT                  │
│    keluarga_id    FK                    │
│    user_id        FK                    │
│    tanggal        DATE ("yyyy-MM-dd")   │
│    amalan_id      FK                    │
│    value          BOOLEAN | NUMBER      │
│    updated_at     DATETIME              │
│    (unik logis: user_id+tanggal+amalan_id) │
└──────────────────────────────────────┘
```

## Detail Kolom

### `keluarga`
| Kolom | Tipe | Keterangan |
|---|---|---|
| keluarga_id | TEXT (PK) | format `kel_xxxxxxxx` |
| nama_keluarga | TEXT | mis. "Keluarga Faturohman" |
| kode_invite | TEXT (unique) | 6 karakter alfanumerik, dipakai anggota untuk join & semua orang untuk login |
| amir_user_id | TEXT (FK → users) | pembuat keluarga |
| tema_primary / tema_secondary | TEXT | hex color, default `#1b4332` / `#40916c` |
| tema_font | TEXT | nama font Google Fonts |
| tema_mode | TEXT | `light` / `dark` |
| dibuat_at | DATETIME | |

### `users`
| Kolom | Tipe | Keterangan |
|---|---|---|
| user_id | TEXT (PK) | format `usr_xxxxxxxx` |
| keluarga_id | TEXT (FK) | |
| nama | TEXT | |
| peran | TEXT | `amir` \| `anggota` \| `anak` (profil anak, tanpa PIN — dicentang oleh orang tua via profile switcher) |
| pin_hash | TEXT | SHA-256(pin + salt) |
| pin_salt | TEXT | UUID unik per user |
| aktif | BOOLEAN | soft-delete anggota |
| dibuat_at | DATETIME | |

### `amalan_config`
| Kolom | Tipe | Keterangan |
|---|---|---|
| amalan_id | TEXT (PK) | format `am_xxxxxxxx` |
| keluarga_id | TEXT (FK) | |
| nama | TEXT | mis. "Sholat Subuh Berjamaah" |
| kategori | TEXT | bebas, ditentukan Amir, mis. "Sholat", "Tilawah" |
| tipe | TEXT | `checkbox` \| `counter` |
| target | NUMBER | dipakai kalau tipe=`counter` (mis. target 100x dzikir) |
| urutan | NUMBER | urutan tampil di checklist |
| hari_spesifik | TEXT | kosong = tiap hari; atau mis. `"jumat"` |
| target_user_ids | TEXT | kosong = berlaku buat semua anggota; atau daftar `user_id` dipisah koma = khusus anggota tsb |
| status | TEXT | `aktif` \| `nonaktif` \| `diajukan` (usulan anggota non-amir, menunggu approve) \| `ditolak` |
| dibuat_oleh | TEXT (FK → users) | siapa yang mengajukan/membuat |
| dibuat_at | DATETIME | |

> Kolom `target_user_ids` ditambahkan setelah rilis awal. Kalau Sheet sudah pernah dibuat lewat `setupSheets()` versi lama, jalankan `migrateSchema()` sekali dari editor Apps Script untuk menambahkan kolom ini tanpa mengganggu data yang sudah ada.

### `checkin`
| Kolom | Tipe | Keterangan |
|---|---|---|
| checkin_id | TEXT (PK) | format `chk_xxxxxxxx` |
| keluarga_id | TEXT (FK) | didenormalisasi dari user, mempercepat filter laporan per keluarga |
| user_id | TEXT (FK) | |
| tanggal | DATE (TEXT `yyyy-MM-dd`) | |
| amalan_id | TEXT (FK) | |
| value | BOOLEAN \| NUMBER | `true`/`false` untuk checkbox, angka untuk counter |
| updated_at | DATETIME | dipakai untuk resolusi konflik last-write-wins |

> Kombinasi `user_id + tanggal + amalan_id` bersifat unik secara logis, divalidasi di kode (`Checkin.upsertCheckin` melakukan cari-lalu-update-atau-insert) — Google Sheets sendiri tidak punya unique constraint native.

## Kenapa Bukan 1 Tab per Keluarga?

Supaya jumlah tab tidak bertambah terus seiring keluarga baru — cukup 4 tab tetap, seberapa pun banyak keluarga yang pakai. Ini juga membuka kemungkinan laporan lintas keluarga di level admin platform kalau suatu saat dibutuhkan.

## Pertumbuhan Data & Mitigasi

Tab `checkin` yang paling cepat bertambah barisnya (per keluarga × per anggota × per amalan × per hari). Untuk skala puluhan keluarga masih sangat aman dibaca penuh lewat `sheetToObjects()`. Kalau ke depan terasa lambat: filter berdasarkan tanggal lebih awal sebelum diproses, atau arsipkan data lebih dari setahun ke sheet terpisah.

# API — Mutabaah Keluarga (Apps Script Web App)
Versi: 1.0

Semua request dikirim sebagai **POST** ke satu URL Web App (hasil `clasp deploy`), dengan body JSON berisi field `action` yang menentukan operasi yang dijalankan — pola RPC-over-HTTP, karena satu deployment Apps Script Web App hanya mengekspos satu URL.

```
POST {API_URL}
Body: JSON.stringify({ action: "...", token: "...", ...field lain })
```

Response selalu JSON: `{ "ok": true, ... }` atau `{ "ok": false, "error": "kode_error" }`.

## Auth

Semua action selain `register_keluarga` / `join_keluarga` / `login` membutuhkan field `token` di body (didapat dari hasil register/join/login). Token adalah string HMAC-signed yang dibuat & diverifikasi server-side (lihat `apps-script/Utils.js`: `generateToken` / `verifyToken`) menggunakan secret yang tersimpan di Script Properties (`TOKEN_SECRET`) — tidak pernah terkirim ke client.

---

## `register_keluarga`
Membuat keluarga baru sekaligus akun Amir pertama.

**Request**
```json
{ "action": "register_keluarga", "nama_keluarga": "Keluarga Faturohman", "nama_amir": "Ihsan", "pin": "1234" }
```
**Response**
```json
{ "ok": true, "keluarga_id": "kel_ab12cd34", "kode_invite": "AB12CD", "token": "..." }
```

## `join_keluarga`
Anggota bergabung ke keluarga yang sudah ada memakai kode undangan dari Amir.

**Request**
```json
{ "action": "join_keluarga", "kode_invite": "AB12CD", "nama": "Yadi", "pin": "5678" }
```
**Response**
```json
{ "ok": true, "keluarga_id": "kel_ab12cd34", "token": "..." }
```

## `login`
**Request**
```json
{ "action": "login", "kode_invite": "AB12CD", "nama": "Yadi", "pin": "5678" }
```
**Response**
```json
{ "ok": true, "user_id": "usr_...", "peran": "anggota", "keluarga_id": "kel_...", "token": "..." }
```
**Error**: `kode_invite_tidak_ditemukan` | `user_tidak_ditemukan` | `pin_salah`

## `get_state`
Bootstrap data setelah login/buka app: info keluarga, tema, daftar amalan aktif, dan checkin milik user sejak tanggal `since`.

**Request**
```json
{ "action": "get_state", "token": "...", "since": "2026-08-20" }
```
**Response**
```json
{
  "ok": true,
  "user": { "user_id": "usr_...", "nama": "Yadi", "peran": "anggota" },
  "keluarga": {
    "keluarga_id": "kel_...", "nama_keluarga": "Keluarga Faturohman", "kode_invite": "AB12CD",
    "tema": { "primary": "#1b4332", "secondary": "#40916c", "font": "Plus Jakarta Sans", "mode": "light" }
  },
  "amalan": [
    { "amalan_id": "am_...", "nama": "Sholat Subuh", "kategori": "Sholat", "tipe": "checkbox", "urutan": 1 }
  ],
  "checkins": [
    { "tanggal": "2026-08-27", "amalan_id": "am_...", "value": true }
  ]
}
```

## `upsert_checkin`
Kirim batch perubahan checklist — dipanggil dari outbox sync (setiap ±15 detik atau saat online kembali), bukan per-klik.

**Request**
```json
{
  "action": "upsert_checkin", "token": "...",
  "items": [ { "tanggal": "2026-08-27", "amalan_id": "am_...", "value": true } ]
}
```
**Response**
```json
{ "ok": true, "synced": 1 }
```

## `amalan_create` *(khusus Amir)*
**Request**
```json
{ "action": "amalan_create", "token": "...", "nama": "Tilawah 1 Juz", "kategori": "Tilawah", "tipe": "checkbox", "urutan": 5 }
```
**Response**
```json
{ "ok": true, "amalan_id": "am_..." }
```

## `amalan_update` *(khusus Amir)*
**Request**
```json
{ "action": "amalan_update", "token": "...", "amalan_id": "am_...", "patch": { "nama": "Tilawah min. 1 Juz", "target": 20 } }
```

## `amalan_deactivate` *(khusus Amir)*
**Request**
```json
{ "action": "amalan_deactivate", "token": "...", "amalan_id": "am_..." }
```

## `get_laporan` *(khusus Amir)*
**Request**
```json
{ "action": "get_laporan", "token": "...", "from": "2026-08-01", "to": "2026-08-27" }
```
**Response**
```json
{
  "ok": true,
  "periode": { "from": "2026-08-01", "to": "2026-08-27" },
  "jumlah_amalan_aktif": 8,
  "rekap": [ { "nama": "Yadi", "peran": "anggota", "total_checkin": 42 } ]
}
```

## `update_tema` *(khusus Amir)*
**Request**
```json
{ "action": "update_tema", "token": "...", "tema_primary": "#0f172a", "tema_secondary": "#38bdf8", "tema_font": "Inter", "tema_mode": "dark" }
```

---

## Kode Error Umum

| Kode | Arti |
|---|---|
| `field_kurang` | Field wajib belum diisi |
| `kode_invite_tidak_ditemukan` | Kode keluarga salah/tidak ada |
| `user_tidak_ditemukan` | Kombinasi nama tidak ada di keluarga tsb |
| `pin_salah` | PIN tidak cocok |
| `forbidden` | Aksi butuh peran Amir, tapi token milik anggota |
| `amalan_tidak_ditemukan` | `amalan_id` tidak ada atau bukan milik keluarga token tsb |
| `token_invalid` | Token rusak/tidak valid |
| `unknown_action` | `action` tidak dikenali |

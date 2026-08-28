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
Bootstrap data setelah login/buka app: info keluarga, tema, daftar amalan aktif, dan checkin milik satu **profil** sejak tanggal `since`. `profile_user_id` opsional — kosongkan untuk profil diri sendiri, atau isi `user_id` seorang anak (peran `anak`) di keluarga yang sama supaya orang tua bisa mengisi checklist atas nama anaknya.

**Request**
```json
{ "action": "get_state", "token": "...", "since": "2026-08-20", "profile_user_id": "usr_anak123" }
```
**Response**
```json
{
  "ok": true,
  "user": { "user_id": "usr_...", "nama": "Yadi", "peran": "anggota" },
  "profile": { "user_id": "usr_anak123", "nama": "Fatih", "peran": "anak" },
  "keluarga": {
    "keluarga_id": "kel_...", "nama_keluarga": "Keluarga Faturohman", "kode_invite": "AB12CD",
    "tema": { "primary": "#1b4332", "secondary": "#40916c", "font": "Plus Jakarta Sans", "mode": "light" }
  },
  "amalan": [
    { "amalan_id": "am_...", "nama": "Sholat Subuh", "kategori": "Sholat", "tipe": "checkbox", "urutan": 1, "target_user_ids": "" }
  ],
  "checkins": [
    { "tanggal": "2026-08-27", "amalan_id": "am_...", "value": true }
  ]
}
```
**Error** (tambahan): `profil_tidak_valid` — `profile_user_id` bukan diri sendiri atau bukan anak di keluarga yang sama.

## `upsert_checkin`
Kirim batch perubahan checklist — dipanggil dari outbox sync (setiap ±15 detik atau saat online kembali), bukan per-klik. `profile_user_id` opsional, sama seperti `get_state`.

**Request**
```json
{
  "action": "upsert_checkin", "token": "...", "profile_user_id": "usr_anak123",
  "items": [ { "tanggal": "2026-08-27", "amalan_id": "am_...", "value": true } ]
}
```
**Response**
```json
{ "ok": true, "synced": 1 }
```

## `amalan_create`
Siapa pun anggota login (amir/anggota) boleh memanggil ini. Kalau yang mengajukan **Amir**, amalan langsung berstatus `aktif`. Kalau bukan Amir, otomatis berstatus `diajukan` (usulan, menunggu Amir approve/reject lewat `amalan_update`). `target_user_ids` opsional — kosongkan untuk "berlaku semua anggota", atau isi `user_id` (dipisah koma) untuk amalan khusus anggota tertentu.

**Request**
```json
{ "action": "amalan_create", "token": "...", "nama": "Tilawah 1 Juz", "kategori": "Tilawah", "tipe": "checkbox", "urutan": 5, "target_user_ids": "" }
```
**Response**
```json
{ "ok": true, "amalan_id": "am_...", "status": "aktif" }
```

## `amalan_manage_list`
Daftar amalan buat panel "Kelola Amalan". Amir melihat SEMUA amalan keluarga (semua status — buat approve/reject usulan & nonaktifkan). Anggota biasa hanya melihat amalan yang dia ajukan sendiri yang masih `diajukan`/`ditolak` (buat mantau status usulannya sendiri).

**Request**
```json
{ "action": "amalan_manage_list", "token": "..." }
```
**Response**
```json
{ "ok": true, "amalan": [ { "amalan_id": "am_...", "nama": "...", "status": "diajukan", "dibuat_oleh": "usr_..." } ] }
```

## `dependent_create` *(khusus Amir)*
Membuat profil anak — tanpa PIN, tidak bisa login sendiri. Dicentang oleh orang tua (amir/anggota) lewat profile switcher setelah login.

**Request**
```json
{ "action": "dependent_create", "token": "...", "nama": "Fatih" }
```
**Response**
```json
{ "ok": true, "user_id": "usr_anak123" }
```

## `list_members`
Daftar semua anggota keluarga (amir/anggota/anak) — dipakai buat profile switcher (filter `peran === 'anak'` atau diri sendiri) dan buat memilih target amalan khusus.

**Request**
```json
{ "action": "list_members", "token": "..." }
```
**Response**
```json
{ "ok": true, "members": [ { "user_id": "usr_...", "nama": "Ihsan Faturohman", "peran": "amir" } ] }
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
| `profil_tidak_valid` | `profile_user_id` bukan diri sendiri atau bukan anak di keluarga yang sama |
| `token_invalid` | Token rusak/tidak valid |
| `unknown_action` | `action` tidak dikenali |

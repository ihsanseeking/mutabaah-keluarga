/**
 * Utils.js — helper Sheet, hashing, token, dan setup skema.
 * Lihat docs/ERD.md untuk penjelasan tiap tabel/tab.
 */

// ID Spreadsheet database (script standalone, bukan container-bound —
// lihat README.md §Setup). Ganti kalau mau pindah ke Spreadsheet lain.
var SHEET_ID = '1MbbbcKpDPZ0mtXb0TL4NqEqprBOFzp8NfX0iByf2y_g';

var SCHEMA = {
  keluarga: ['keluarga_id', 'nama_keluarga', 'kode_invite', 'amir_user_id',
    'tema_primary', 'tema_secondary', 'tema_font', 'tema_mode', 'dibuat_at'],
  users: ['user_id', 'keluarga_id', 'nama', 'peran', 'pin_hash', 'pin_salt', 'no_hp', 'aktif', 'dibuat_at'],
  amalan_config: ['amalan_id', 'keluarga_id', 'nama', 'kategori', 'tipe', 'target',
    'urutan', 'hari_spesifik', 'target_user_ids', 'status', 'dibuat_oleh', 'dibuat_at'],
  checkin: ['checkin_id', 'keluarga_id', 'user_id', 'tanggal', 'amalan_id', 'value', 'updated_at'],
  reminder: ['reminder_id', 'keluarga_id', 'jam', 'label', 'aktif', 'last_sent_date', 'dibuat_at'],
  push_token: ['token_id', 'user_id', 'keluarga_id', 'fcm_token', 'dibuat_at']
};

/**
 * Jalankan SEKALI dari editor Apps Script setelah deploy pertama kali,
 * untuk membuat semua tab & header sesuai docs/ERD.md.
 */
function setupSheets() {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]);
    sheet.setFrozenRows(1);
  });
}

/**
 * Jalankan SEKALI dari editor Apps Script kalau Sheet sudah pernah dibuat
 * lewat setupSheets() versi lama (sebelum kolom target_user_ids ditambahkan) —
 * cuma nambah header kolom yang belum ada, gak menyentuh data yang sudah ada.
 */
function migrateSchema() {
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = getSheet(name);
    var lastCol = Math.max(sheet.getLastColumn(), 1);
    var existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    SCHEMA[name].forEach(function (col) {
      if (existing.indexOf(col) === -1) {
        sheet.getRange(1, existing.length + 1).setValue(col);
        existing.push(col);
      }
    });
  });
}

/**
 * Jalankan SEKALI dari editor Apps Script kalau ada anggota/anak dobel
 * (mis. gara-gara sempat coba "Gabung Keluarga" berkali-kali sebelum
 * `nama_sudah_terdaftar` dicegah di Auth.js/Anggota.js). Buat tiap
 * kombinasi keluarga+nama yang sama, baris PALING AWAL dipertahankan
 * (jadi PIN yang berlaku = PIN dari percobaan gabung yang pertama),
 * baris-baris duplikatnya dihapus. Data checkin milik baris yang dihapus
 * TIDAK ikut dipindah/dihapus — kalau perlu, tangani manual dulu.
 */
function cleanupDuplicateUsers() {
  var sheet = getSheet('users');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var idxKeluarga = headers.indexOf('keluarga_id');
  var idxNama = headers.indexOf('nama');

  var seen = {};
  var rowsToDelete = [];
  for (var r = 1; r < data.length; r++) {
    var key = data[r][idxKeluarga] + '|' + String(data[r][idxNama]).trim().toLowerCase();
    if (seen[key] === undefined) {
      seen[key] = r;
    } else {
      rowsToDelete.push(r + 1); // +1: baris sheet mulai dari 1, data[0] = header
    }
  }

  rowsToDelete.sort(function (a, b) { return b - a; }); // hapus dari bawah biar index gak geser
  rowsToDelete.forEach(function (rowNum) { sheet.deleteRow(rowNum); });

  Logger.log('Baris duplikat dihapus: ' + rowsToDelete.length);
  return rowsToDelete.length;
}

function getSheet(name) {
  var ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tidak ditemukan: ' + name + ' — jalankan setupSheets() dulu.');
  return sheet;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data.shift();
  return data.map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

/**
 * Selalu baca urutan header LANGSUNG dari sheet (bukan dari SCHEMA) — supaya
 * tetap benar walau sheet lama sudah dimigrasi dan kolom barunya nempel di
 * ujung, bukan di posisi yang didefinisikan di SCHEMA.
 */
function appendRow(sheet, obj) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sheet.appendRow(row);
}

function findRow(sheetName, key, value) {
  var rows = sheetToObjects(getSheet(sheetName));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][key] === value) return rows[i];
  }
  return null;
}

function updateRow(sheetName, key, value, patch) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var keyIdx = headers.indexOf(key);
  for (var r = 1; r < data.length; r++) {
    if (data[r][keyIdx] === value) {
      Object.keys(patch).forEach(function (k) {
        var idx = headers.indexOf(k);
        if (idx > -1) sheet.getRange(r + 1, idx + 1).setValue(patch[k]);
      });
      return true;
    }
  }
  return false;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function bytesToHex(bytes) {
  return bytes.map(function (b) { return ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0'); }).join('');
}

function hashPin(pin, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + ':' + salt);
  return bytesToHex(raw);
}

/**
 * Samakan format nomor HP Indonesia (08xx / +628xx / 628xx) jadi satu bentuk
 * kanonik "62xxxxxxxxxx", supaya perbandingan uniqueness & lookup konsisten
 * berapa pun format yang diketik user.
 */
function normalizePhone_(raw) {
  if (!raw) return '';
  var digits = String(raw).replace(/\D/g, '');
  if (digits.indexOf('0') === 0) digits = '62' + digits.slice(1);
  else if (digits.indexOf('62') !== 0) digits = '62' + digits;
  return digits;
}

function tokenSecret_() {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret) throw new Error('TOKEN_SECRET belum di-set di Script Properties.');
  return secret;
}

function generateToken(userId) {
  var payload = userId + '.' + Date.now();
  var sig = bytesToHex(Utilities.computeHmacSha256Signature(payload, tokenSecret_()));
  return Utilities.base64EncodeWebSafe(payload) + '.' + sig;
}

function verifyToken(token) {
  if (!token) throw new Error('token_invalid');
  var parts = token.split('.');
  if (parts.length !== 2) throw new Error('token_invalid');
  var payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
  var expectedSig = bytesToHex(Utilities.computeHmacSha256Signature(payload, tokenSecret_()));
  if (expectedSig !== parts[1]) throw new Error('token_invalid');
  return payload.split('.')[0]; // user_id
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function generateId(prefix) {
  return prefix + '_' + Utilities.getUuid().split('-')[0];
}

function generateInviteCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I biar gak ambigu dibaca
  var code = '';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

/** Ambil user dari token, lempar error kalau tidak ada. */
function requireUser(token) {
  var userId = verifyToken(token);
  var user = findRow('users', 'user_id', userId);
  if (!user || !user.aktif) throw new Error('user_tidak_ditemukan');
  return user;
}

/** Sama seperti requireUser, tapi juga memastikan perannya 'amir'. */
function requireAmir(token) {
  var user = requireUser(token);
  if (user.peran !== 'amir') throw new Error('forbidden');
  return user;
}

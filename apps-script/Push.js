/**
 * Push.js — simpan token device (Firebase Cloud Messaging) dan kirim
 * notifikasi pengingat lewat FCM HTTP v1 API pakai Service Account.
 *
 * SETUP WAJIB (sekali saja, dari editor Apps Script):
 * 1. Project Settings > Script Properties > tambah `FIREBASE_SERVICE_ACCOUNT`
 *    — isinya seluruh isi file JSON hasil "Generate new private key" di
 *    Firebase Console > Project Settings > Service accounts (paste apa
 *    adanya sebagai satu string JSON).
 * 2. Jalankan fungsi `installReminderTrigger` sekali dari dropdown fungsi
 *    di editor — ini bikin time-driven trigger yang ngecek pengingat
 *    tiap 5 menit secara otomatis.
 */

var PushToken = {
  /** Simpan/update token FCM milik device yang lagi dipakai. */
  save: function (p) {
    if (!p.fcm_token) throw new Error('field_kurang');
    var user = requireUser(p.token);
    return withLock(function () {
      var existing = findRow('push_token', 'fcm_token', p.fcm_token);
      if (existing) {
        updateRow('push_token', 'fcm_token', p.fcm_token, { user_id: user.user_id, keluarga_id: user.keluarga_id });
      } else {
        appendRow(getSheet('push_token'), {
          token_id: generateId('tok'), user_id: user.user_id, keluarga_id: user.keluarga_id,
          fcm_token: p.fcm_token, dibuat_at: new Date()
        });
      }
      return { ok: true };
    });
  }
};

/**
 * Dipanggil time-driven trigger tiap 5 menit (lihat installReminderTrigger).
 * Cek semua pengingat aktif; kalau jamnya jatuh dalam 6 menit terakhir DAN
 * belum dikirim hari ini, kirim notifikasi ke semua anggota berlogin
 * (amir + anggota — profil anak dilewati karena tidak punya device sendiri).
 */
function sendDueReminders() {
  var now = new Date();
  var todayStr = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');
  var nowMinutes = Number(Utilities.formatDate(now, 'Asia/Jakarta', 'HH')) * 60 +
    Number(Utilities.formatDate(now, 'Asia/Jakarta', 'mm'));

  var reminders = sheetToObjects(getSheet('reminder')).filter(function (r) { return r.aktif; });

  reminders.forEach(function (r) {
    if (r.last_sent_date === todayStr) return;
    var parts = String(r.jam).split(':');
    var jamMenit = Number(parts[0]) * 60 + Number(parts[1]);
    var selisih = nowMinutes - jamMenit;
    if (selisih < 0 || selisih >= 6) return;

    kirimReminderKeKeluarga_(r);
    updateRow('reminder', 'reminder_id', r.reminder_id, { last_sent_date: todayStr });
  });
}

function kirimReminderKeKeluarga_(reminder) {
  var userIds = sheetToObjects(getSheet('users')).filter(function (u) {
    return u.keluarga_id === reminder.keluarga_id && u.aktif && u.peran !== 'anak';
  }).map(function (u) { return u.user_id; });

  var tokens = sheetToObjects(getSheet('push_token')).filter(function (t) {
    return userIds.indexOf(t.user_id) > -1;
  });

  var body = reminder.label ? reminder.label : 'Waktunya cek checklist amalan hari ini!';
  tokens.forEach(function (t) {
    try {
      kirimFcm_(t.fcm_token, 'Mutabaah Keluarga', body);
    } catch (e) {
      // Token invalid/expired (mis. app di-uninstall) — jangan gagalkan reminder lain.
    }
  });
}

function kirimFcm_(fcmToken, title, body) {
  var svc = JSON.parse(firebaseServiceAccount_());
  var accessToken = getFcmAccessToken_(svc);

  // Sengaja pakai `data` (bukan `notification`) — biar browser TIDAK auto-
  // tampilin notifikasi bawaan (yang gak bisa di-atur getar/requireInteraction-
  // nya), dan selalu lewat handler kita sendiri di sw.js/index.html supaya
  // konsisten getar + gak ilang sendiri, baik app lagi kebuka atau tertutup.
  var payload = {
    message: {
      token: fcmToken,
      data: { title: title, body: body },
      webpush: { headers: { Urgency: 'high' } }
    }
  };

  UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + svc.project_id + '/messages:send', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

function firebaseServiceAccount_() {
  var json = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  if (!json) throw new Error('FIREBASE_SERVICE_ACCOUNT belum di-set di Script Properties.');
  return json;
}

/** Ambil access token OAuth2 buat FCM lewat JWT Bearer flow, di-cache ~55 menit. */
function getFcmAccessToken_(svc) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('fcm_access_token');
  if (cached) return cached;

  var header = { alg: 'RS256', typ: 'JWT' };
  var now = Math.floor(Date.now() / 1000);
  var claimSet = {
    iss: svc.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  var toBase64Url = function (str) { return Utilities.base64EncodeWebSafe(str).replace(/=+$/, ''); };
  var signatureInput = toBase64Url(JSON.stringify(header)) + '.' + toBase64Url(JSON.stringify(claimSet));
  var signature = Utilities.computeRsaSha256Signature(signatureInput, svc.private_key);
  var jwt = signatureInput + '.' + Utilities.base64EncodeWebSafe(signature).replace(/=+$/, '');

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt },
    muteHttpExceptions: true
  });
  var data = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error('Gagal ambil access token FCM: ' + res.getContentText());

  cache.put('fcm_access_token', data.access_token, 3300);
  return data.access_token;
}

/**
 * Jalankan SEKALI dari editor Apps Script untuk memasang time-driven trigger
 * yang menjalankan sendDueReminders() tiap 5 menit. Aman dijalankan berkali-
 * kali — trigger lama buat fungsi yang sama dihapus dulu biar gak dobel.
 */
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDueReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendDueReminders').timeBased().everyMinutes(5).create();
}

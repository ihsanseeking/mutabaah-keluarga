/**
 * Auth.js — buat keluarga, gabung keluarga, login (via kode keluarga ATAU
 * No HP), dan update tema/No HP. Lihat docs/API.md untuk kontrak tiap action.
 *
 * No HP bersifat opsional & harus unik di seluruh sistem (lintas keluarga) —
 * dipakai sebagai jalan pintas login tanpa perlu inget kode undangan lagi,
 * dari device manapun.
 */

var Auth = {

  registerKeluarga: function (p) {
    if (!p.nama_keluarga || !p.nama_amir || !p.pin) throw new Error('field_kurang');
    var noHp = p.no_hp ? normalizePhone_(p.no_hp) : '';
    return withLock(function () {
      if (noHp) cekNoHpUnik_(noHp);

      var keluargaId = generateId('kel');
      var kodeInvite = generateInviteCode();
      var userId = generateId('usr');
      var salt = Utilities.getUuid();

      appendRow(getSheet('keluarga'), {
        keluarga_id: keluargaId, nama_keluarga: p.nama_keluarga, kode_invite: kodeInvite,
        amir_user_id: userId, tema_primary: '#1b4332', tema_secondary: '#40916c',
        tema_font: 'Plus Jakarta Sans', tema_mode: 'light', dibuat_at: new Date()
      });

      appendRow(getSheet('users'), {
        user_id: userId, keluarga_id: keluargaId, nama: p.nama_amir, peran: 'amir',
        pin_hash: hashPin(p.pin, salt), pin_salt: salt, no_hp: noHp, aktif: true, dibuat_at: new Date()
      });

      return { ok: true, keluarga_id: keluargaId, kode_invite: kodeInvite, token: generateToken(userId) };
    });
  },

  joinKeluarga: function (p) {
    if (!p.kode_invite || !p.nama || !p.pin) throw new Error('field_kurang');
    var noHp = p.no_hp ? normalizePhone_(p.no_hp) : '';
    return withLock(function () {
      var keluarga = findRow('keluarga', 'kode_invite', String(p.kode_invite).toUpperCase());
      if (!keluarga) throw new Error('kode_invite_tidak_ditemukan');

      var namaSudahAda = sheetToObjects(getSheet('users')).some(function (u) {
        return u.keluarga_id === keluarga.keluarga_id && u.aktif &&
          String(u.nama).trim().toLowerCase() === p.nama.trim().toLowerCase();
      });
      if (namaSudahAda) throw new Error('nama_sudah_terdaftar');
      if (noHp) cekNoHpUnik_(noHp);

      var userId = generateId('usr');
      var salt = Utilities.getUuid();
      appendRow(getSheet('users'), {
        user_id: userId, keluarga_id: keluarga.keluarga_id, nama: p.nama, peran: 'anggota',
        pin_hash: hashPin(p.pin, salt), pin_salt: salt, no_hp: noHp, aktif: true, dibuat_at: new Date()
      });

      return { ok: true, keluarga_id: keluarga.keluarga_id, token: generateToken(userId) };
    });
  },

  login: function (p) {
    if (!p.kode_invite || !p.nama || !p.pin) throw new Error('field_kurang');
    var keluarga = findRow('keluarga', 'kode_invite', String(p.kode_invite).toUpperCase());
    if (!keluarga) throw new Error('kode_invite_tidak_ditemukan');

    var user = sheetToObjects(getSheet('users')).filter(function (u) {
      return u.keluarga_id === keluarga.keluarga_id && u.nama === p.nama && u.aktif;
    })[0];
    if (!user) throw new Error('user_tidak_ditemukan');
    if (hashPin(p.pin, user.pin_salt) !== user.pin_hash) throw new Error('pin_salah');

    return {
      ok: true, user_id: user.user_id, peran: user.peran,
      keluarga_id: keluarga.keluarga_id, token: generateToken(user.user_id)
    };
  },

  /** Login tanpa kode undangan — cukup No HP (yang didaftarkan sebelumnya) + PIN. */
  loginByPhone: function (p) {
    if (!p.no_hp || !p.pin) throw new Error('field_kurang');
    var noHp = normalizePhone_(p.no_hp);
    var user = sheetToObjects(getSheet('users')).filter(function (u) {
      return u.aktif && u.no_hp && normalizePhone_(u.no_hp) === noHp;
    })[0];
    if (!user) throw new Error('no_hp_tidak_ditemukan');
    if (hashPin(p.pin, user.pin_salt) !== user.pin_hash) throw new Error('pin_salah');

    return {
      ok: true, user_id: user.user_id, peran: user.peran,
      keluarga_id: user.keluarga_id, token: generateToken(user.user_id)
    };
  },

  /** Tambah/ubah No HP milik akun sendiri, kapan saja setelah login. */
  updateNoHp: function (p) {
    var user = requireUser(p.token);
    var noHp = p.no_hp ? normalizePhone_(p.no_hp) : '';
    return withLock(function () {
      if (noHp) cekNoHpUnik_(noHp, user.user_id);
      updateRow('users', 'user_id', user.user_id, { no_hp: noHp });
      return { ok: true };
    });
  },

  updateTema: function (p) {
    var user = requireAmir(p.token);
    return withLock(function () {
      updateRow('keluarga', 'keluarga_id', user.keluarga_id, {
        tema_primary: p.tema_primary, tema_secondary: p.tema_secondary,
        tema_font: p.tema_font, tema_mode: p.tema_mode
      });
      return { ok: true };
    });
  }
};

/** Lempar error kalau No HP sudah dipakai akun aktif lain (opsional: kecuali user_id sendiri, buat updateNoHp). */
function cekNoHpUnik_(noHp, kecualiUserId) {
  var dipakai = sheetToObjects(getSheet('users')).some(function (u) {
    return u.aktif && u.no_hp && normalizePhone_(u.no_hp) === noHp && u.user_id !== kecualiUserId;
  });
  if (dipakai) throw new Error('no_hp_sudah_dipakai');
}

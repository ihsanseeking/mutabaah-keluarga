/**
 * Auth.js — buat keluarga, gabung keluarga, login, dan update tema (khusus Amir).
 * Lihat docs/API.md untuk kontrak request/response tiap action.
 */

var Auth = {

  registerKeluarga: function (p) {
    if (!p.nama_keluarga || !p.nama_amir || !p.pin) throw new Error('field_kurang');
    return withLock(function () {
      var keluargaId = generateId('kel');
      var kodeInvite = generateInviteCode();
      var userId = generateId('usr');
      var salt = Utilities.getUuid();

      appendRow(getSheet('keluarga'), {
        keluarga_id: keluargaId, nama_keluarga: p.nama_keluarga, kode_invite: kodeInvite,
        amir_user_id: userId, tema_primary: '#1b4332', tema_secondary: '#40916c',
        tema_font: 'Plus Jakarta Sans', tema_mode: 'light', dibuat_at: new Date()
      }, SCHEMA.keluarga);

      appendRow(getSheet('users'), {
        user_id: userId, keluarga_id: keluargaId, nama: p.nama_amir, peran: 'amir',
        pin_hash: hashPin(p.pin, salt), pin_salt: salt, aktif: true, dibuat_at: new Date()
      }, SCHEMA.users);

      return { ok: true, keluarga_id: keluargaId, kode_invite: kodeInvite, token: generateToken(userId) };
    });
  },

  joinKeluarga: function (p) {
    if (!p.kode_invite || !p.nama || !p.pin) throw new Error('field_kurang');
    return withLock(function () {
      var keluarga = findRow('keluarga', 'kode_invite', String(p.kode_invite).toUpperCase());
      if (!keluarga) throw new Error('kode_invite_tidak_ditemukan');

      var userId = generateId('usr');
      var salt = Utilities.getUuid();
      appendRow(getSheet('users'), {
        user_id: userId, keluarga_id: keluarga.keluarga_id, nama: p.nama, peran: 'anggota',
        pin_hash: hashPin(p.pin, salt), pin_salt: salt, aktif: true, dibuat_at: new Date()
      }, SCHEMA.users);

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

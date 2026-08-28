/**
 * Anggota.js — kelola roster keluarga: anggota ber-akun (amir/anggota) dan
 * profil anak (tanpa login, dicentang oleh orang tuanya lewat profile switcher).
 */

var Anggota = {

  /** Profil anak dibuat Amir — tanpa PIN, gak bisa login sendiri. */
  createDependent: function (p) {
    if (!p.nama) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var userId = generateId('usr');
      appendRow(getSheet('users'), {
        user_id: userId, keluarga_id: user.keluarga_id, nama: p.nama, peran: 'anak',
        pin_hash: '', pin_salt: '', aktif: true, dibuat_at: new Date()
      });
      return { ok: true, user_id: userId };
    });
  },

  /** Daftar semua anggota (amir/anggota/anak) di keluarga — buat profile switcher & target amalan. */
  listMembers: function (p) {
    var user = requireUser(p.token);
    var members = sheetToObjects(getSheet('users')).filter(function (u) {
      return u.keluarga_id === user.keluarga_id && u.aktif;
    }).map(function (u) {
      return { user_id: u.user_id, nama: u.nama, peran: u.peran };
    });
    return { ok: true, members: members };
  }
};

/**
 * Dipakai Checkin.getState & Checkin.upsertCheckin untuk memastikan profil
 * yang mau diisi (diri sendiri atau anak) memang valid & satu keluarga.
 * Siapa pun anggota login (amir/anggota) boleh mengisi buat dirinya sendiri
 * atau profil 'anak' mana pun di keluarga yang sama — bukan anggota dewasa lain.
 */
function resolveProfile_(user, profileUserId) {
  if (!profileUserId || profileUserId === user.user_id) return user;
  var target = findRow('users', 'user_id', profileUserId);
  if (!target || target.keluarga_id !== user.keluarga_id || target.peran !== 'anak') {
    throw new Error('profil_tidak_valid');
  }
  return target;
}

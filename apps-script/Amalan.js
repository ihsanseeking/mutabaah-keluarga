/**
 * Amalan.js — CRUD daftar amalan (poin mutabaah) milik satu keluarga.
 *
 * Siapa pun anggota keluarga (amir/anggota) boleh MENGAJUKAN amalan baru lewat
 * `create` — kalau yang mengajukan Amir, langsung berstatus 'aktif'; kalau
 * bukan Amir, berstatus 'diajukan' sampai Amir approve/reject lewat `update`
 * (patch status ke 'aktif'/'ditolak').
 *
 * Amalan bisa ditarget ke SEMUA anggota (target_user_ids kosong) atau ke
 * anggota tertentu saja (target_user_ids = daftar user_id dipisah koma).
 */

var Amalan = {

  /** Amalan aktif yang berlaku buat satu profil (diri sendiri/anak), dipakai Checkin.getState & Laporan. */
  list: function (keluargaId, profileUserId) {
    return sheetToObjects(getSheet('amalan_config')).filter(function (a) {
      if (a.keluarga_id !== keluargaId || a.status !== 'aktif') return false;
      if (!a.target_user_ids) return true; // kosong = berlaku buat semua anggota
      return String(a.target_user_ids).split(',').indexOf(profileUserId) > -1;
    });
  },

  /**
   * Daftar amalan buat panel "Kelola Amalan". Amir melihat semua amalan
   * keluarga (semua status, buat approve/reject/nonaktifkan). Anggota biasa
   * cuma melihat amalan yang dia ajukan sendiri yang masih diajukan/ditolak
   * (buat mantau status usulannya) — amalan aktif sudah kelihatan di checklist.
   */
  manageList: function (p) {
    var user = requireUser(p.token);
    var rows = sheetToObjects(getSheet('amalan_config')).filter(function (a) {
      return a.keluarga_id === user.keluarga_id;
    });
    if (user.peran === 'amir') return { ok: true, amalan: rows };
    var punyaSendiri = rows.filter(function (a) {
      return a.dibuat_oleh === user.user_id && a.status !== 'aktif';
    });
    return { ok: true, amalan: punyaSendiri };
  },

  create: function (p) {
    if (!p.nama) throw new Error('field_kurang');
    var user = requireUser(p.token);
    return withLock(function () {
      var amalanId = generateId('am');
      var status = user.peran === 'amir' ? 'aktif' : 'diajukan';
      appendRow(getSheet('amalan_config'), {
        amalan_id: amalanId, keluarga_id: user.keluarga_id, nama: p.nama,
        kategori: p.kategori || 'Umum', tipe: p.tipe || 'checkbox', target: p.target || '',
        urutan: p.urutan || 0, hari_spesifik: p.hari_spesifik || '',
        target_user_ids: p.target_user_ids || '', status: status,
        dibuat_oleh: user.user_id, dibuat_at: new Date()
      });
      return { ok: true, amalan_id: amalanId, status: status };
    });
  },

  update: function (p) {
    if (!p.amalan_id) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var amalan = findRow('amalan_config', 'amalan_id', p.amalan_id);
      if (!amalan || amalan.keluarga_id !== user.keluarga_id) throw new Error('amalan_tidak_ditemukan');
      updateRow('amalan_config', 'amalan_id', p.amalan_id, p.patch || {});
      return { ok: true };
    });
  },

  deactivate: function (p) {
    if (!p.amalan_id) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var amalan = findRow('amalan_config', 'amalan_id', p.amalan_id);
      if (!amalan || amalan.keluarga_id !== user.keluarga_id) throw new Error('amalan_tidak_ditemukan');
      updateRow('amalan_config', 'amalan_id', p.amalan_id, { status: 'nonaktif' });
      return { ok: true };
    });
  }
};

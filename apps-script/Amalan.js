/**
 * Amalan.js — CRUD daftar amalan (poin mutabaah) milik satu keluarga.
 * MVP v1.0: hanya Amir yang boleh membuat/mengubah/menonaktifkan.
 * Kolom `status` & `dibuat_oleh` sudah disiapkan untuk flow pengajuan-persetujuan
 * anggota di v1.1 (lihat docs/PRD.md §8) tanpa perlu migrasi skema.
 */

var Amalan = {

  /** Daftar amalan aktif milik satu keluarga, dipakai internal oleh Checkin.getState & Laporan. */
  list: function (keluargaId) {
    return sheetToObjects(getSheet('amalan_config')).filter(function (a) {
      return a.keluarga_id === keluargaId && a.status === 'aktif';
    });
  },

  create: function (p) {
    if (!p.nama) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var amalanId = generateId('am');
      appendRow(getSheet('amalan_config'), {
        amalan_id: amalanId, keluarga_id: user.keluarga_id, nama: p.nama,
        kategori: p.kategori || 'Umum', tipe: p.tipe || 'checkbox', target: p.target || '',
        urutan: p.urutan || 0, hari_spesifik: p.hari_spesifik || '', status: 'aktif',
        dibuat_oleh: user.user_id, dibuat_at: new Date()
      }, SCHEMA.amalan_config);
      return { ok: true, amalan_id: amalanId };
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

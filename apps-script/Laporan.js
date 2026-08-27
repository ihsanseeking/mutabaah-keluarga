/**
 * Laporan.js — rekap progres keluarga untuk Amir (F-10, MVP v1.0).
 * Grafik & ekspor CSV direncanakan v1.1 (lihat docs/PRD.md §9 Roadmap).
 */

var Laporan = {

  getLaporan: function (p) {
    if (!p.from || !p.to) throw new Error('field_kurang');
    var amir = requireAmir(p.token);

    var anggota = sheetToObjects(getSheet('users')).filter(function (u) {
      return u.keluarga_id === amir.keluarga_id && u.aktif;
    });
    var checkins = sheetToObjects(getSheet('checkin')).filter(function (c) {
      return c.keluarga_id === amir.keluarga_id && c.tanggal >= p.from && c.tanggal <= p.to;
    });

    var rekap = anggota.map(function (u) {
      var totalCheckin = checkins.filter(function (c) {
        return c.user_id === u.user_id && (c.value === true || (typeof c.value === 'number' && c.value > 0));
      }).length;
      return { nama: u.nama, peran: u.peran, total_checkin: totalCheckin };
    });

    return {
      ok: true,
      periode: { from: p.from, to: p.to },
      jumlah_amalan_aktif: Amalan.list(amir.keluarga_id).length,
      rekap: rekap
    };
  }
};

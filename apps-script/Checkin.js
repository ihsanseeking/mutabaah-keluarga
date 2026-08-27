/**
 * Checkin.js — bootstrap state (get_state) & sinkronisasi checklist (upsert_checkin).
 * Frontend memanggil get_state sekali saat login/buka app, lalu upsert_checkin
 * secara batch dari outbox offline-first (lihat public/index.html).
 */

var Checkin = {

  getState: function (p) {
    var user = requireUser(p.token);
    var keluarga = findRow('keluarga', 'keluarga_id', user.keluarga_id);
    var amalan = Amalan.list(user.keluarga_id);
    var since = p.since || Utilities.formatDate(
      new Date(Date.now() - 7 * 86400000), 'Asia/Jakarta', 'yyyy-MM-dd');

    var checkins = sheetToObjects(getSheet('checkin')).filter(function (c) {
      return c.user_id === user.user_id && c.tanggal >= since;
    }).map(function (c) {
      return { tanggal: c.tanggal, amalan_id: c.amalan_id, value: c.value };
    });

    return {
      ok: true,
      user: { user_id: user.user_id, nama: user.nama, peran: user.peran },
      keluarga: {
        keluarga_id: keluarga.keluarga_id, nama_keluarga: keluarga.nama_keluarga,
        kode_invite: keluarga.kode_invite,
        tema: {
          primary: keluarga.tema_primary, secondary: keluarga.tema_secondary,
          font: keluarga.tema_font, mode: keluarga.tema_mode
        }
      },
      amalan: amalan,
      checkins: checkins
    };
  },

  upsertCheckin: function (p) {
    var user = requireUser(p.token);
    var items = p.items || [];
    if (!items.length) return { ok: true, synced: 0 };

    return withLock(function () {
      var sheet = getSheet('checkin');
      var data = sheet.getDataRange().getValues();
      var headers = data[0];
      var idxUser = headers.indexOf('user_id');
      var idxTanggal = headers.indexOf('tanggal');
      var idxAmalan = headers.indexOf('amalan_id');

      items.forEach(function (item) {
        var rowIdx = -1;
        for (var r = 1; r < data.length; r++) {
          if (data[r][idxUser] === user.user_id &&
              data[r][idxTanggal] === item.tanggal &&
              data[r][idxAmalan] === item.amalan_id) {
            rowIdx = r;
            break;
          }
        }
        var record = {
          checkin_id: rowIdx > -1 ? data[rowIdx][headers.indexOf('checkin_id')] : generateId('chk'),
          keluarga_id: user.keluarga_id, user_id: user.user_id, tanggal: item.tanggal,
          amalan_id: item.amalan_id, value: item.value, updated_at: new Date()
        };
        if (rowIdx > -1) {
          headers.forEach(function (h, i) { sheet.getRange(rowIdx + 1, i + 1).setValue(record[h]); });
          data[rowIdx] = headers.map(function (h) { return record[h]; });
        } else {
          appendRow(sheet, record, headers);
          data.push(headers.map(function (h) { return record[h]; }));
        }
      });

      return { ok: true, synced: items.length };
    });
  }
};

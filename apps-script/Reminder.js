/**
 * Reminder.js — jadwal pengingat checklist yang diatur Amir (jam bebas,
 * bisa lebih dari satu per hari). Pengiriman aktualnya lewat sendDueReminders()
 * di Push.js, dipanggil time-driven trigger (lihat installReminderTrigger()).
 */

var Reminder = {

  list: function (p) {
    var user = requireUser(p.token);
    var reminders = sheetToObjects(getSheet('reminder')).filter(function (r) {
      return r.keluarga_id === user.keluarga_id && r.aktif;
    }).map(function (r) {
      return { reminder_id: r.reminder_id, jam: r.jam, label: r.label };
    });
    return { ok: true, reminders: reminders };
  },

  create: function (p) {
    if (!p.jam || !/^\d{2}:\d{2}$/.test(p.jam)) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var reminderId = generateId('rmd');
      appendRow(getSheet('reminder'), {
        reminder_id: reminderId, keluarga_id: user.keluarga_id, jam: p.jam,
        label: p.label || '', aktif: true, last_sent_date: '', dibuat_at: new Date()
      });
      return { ok: true, reminder_id: reminderId };
    });
  },

  delete: function (p) {
    if (!p.reminder_id) throw new Error('field_kurang');
    var user = requireAmir(p.token);
    return withLock(function () {
      var reminder = findRow('reminder', 'reminder_id', p.reminder_id);
      if (!reminder || reminder.keluarga_id !== user.keluarga_id) throw new Error('reminder_tidak_ditemukan');
      var sheet = getSheet('reminder');
      var data = sheet.getDataRange().getValues();
      var idCol = data[0].indexOf('reminder_id');
      for (var r = 1; r < data.length; r++) {
        if (data[r][idCol] === p.reminder_id) { sheet.deleteRow(r + 1); break; }
      }
      return { ok: true };
    });
  }
};

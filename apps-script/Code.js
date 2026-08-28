/**
 * Code.js — entry point Web App. Semua request (GET & POST) masuk lewat
 * router `handleRequest`, didispatch berdasarkan field `action`.
 * Kontrak tiap action ada di docs/API.md.
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    var params = parseParams_(e);
    var action = params.action;
    var handler = getActionHandler_(action);
    if (!handler) return jsonResponse({ ok: false, error: 'unknown_action' });
    return jsonResponse(handler(params));
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || 'internal_error' });
  }
}

// Dibangun di dalam fungsi (bukan var top-level) supaya baru dievaluasi saat
// dipanggil — Apps Script memuat file lain (Amalan/Auth/Checkin/Laporan.gs)
// berdasarkan urutan alfabetis, jadi referensi ke objeknya belum tentu siap
// kalau dievaluasi di top-level Code.gs (C datang sebelum L, dst).
function getActionHandler_(action) {
  var actions = {
    register_keluarga: Auth.registerKeluarga,
    join_keluarga: Auth.joinKeluarga,
    login: Auth.login,
    login_hp: Auth.loginByPhone,
    update_no_hp: Auth.updateNoHp,
    update_tema: Auth.updateTema,
    get_state: Checkin.getState,
    upsert_checkin: Checkin.upsertCheckin,
    amalan_create: Amalan.create,
    amalan_update: Amalan.update,
    amalan_deactivate: Amalan.deactivate,
    amalan_manage_list: Amalan.manageList,
    dependent_create: Anggota.createDependent,
    list_members: Anggota.listMembers,
    get_laporan: Laporan.getLaporan
  };
  return actions[action];
}

function parseParams_(e) {
  // POST dengan body JSON (pola utama dari public/index.html):
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* fallthrough */ }
  }
  // Fallback: query string (mis. dipakai untuk tes cepat lewat URL).
  return e.parameter || {};
}

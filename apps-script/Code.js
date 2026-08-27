/**
 * Code.js — entry point Web App. Semua request (GET & POST) masuk lewat
 * router `handleRequest`, didispatch berdasarkan field `action`.
 * Kontrak tiap action ada di docs/API.md.
 */

var ACTIONS = {
  register_keluarga: Auth.registerKeluarga,
  join_keluarga: Auth.joinKeluarga,
  login: Auth.login,
  update_tema: Auth.updateTema,
  get_state: Checkin.getState,
  upsert_checkin: Checkin.upsertCheckin,
  amalan_create: Amalan.create,
  amalan_update: Amalan.update,
  amalan_deactivate: Amalan.deactivate,
  get_laporan: Laporan.getLaporan
};

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
    var handler = ACTIONS[action];
    if (!handler) return jsonResponse({ ok: false, error: 'unknown_action' });
    return jsonResponse(handler(params));
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || 'internal_error' });
  }
}

function parseParams_(e) {
  // POST dengan body JSON (pola utama dari public/index.html):
  if (e.postData && e.postData.contents) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* fallthrough */ }
  }
  // Fallback: query string (mis. dipakai untuk tes cepat lewat URL).
  return e.parameter || {};
}

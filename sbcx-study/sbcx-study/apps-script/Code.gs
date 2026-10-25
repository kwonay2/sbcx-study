/**
 * 2조 SBCX 실험 — 구글 시트 저장소 (Apps Script 웹 앱)
 *
 * 처음 한 번 (README '1. 구글 시트 준비' 참고)
 *  1) 응답을 모을 새 구글 시트를 만들고 [확장 프로그램 → Apps Script]를 연다.
 *  2) 이 파일 내용을 Code.gs에 통째로 붙여 넣고 저장한다.
 *  3) 위쪽 함수 목록에서 setup 을 골라 [실행] → 권한을 허용한다.
 *     실행 로그에 나온 APPS_SCRIPT_SECRET 값을 Vercel 환경 변수에 넣는다.
 *  4) [배포 → 새 배포 → 유형: 웹 앱] 실행: 나 / 액세스 권한: 모든 사용자 → 배포.
 *     나온 웹 앱 URL(…/exec)을 Vercel 환경 변수 APPS_SCRIPT_URL 에 넣는다.
 *  코드를 고친 뒤에는 [배포 관리 → 수정 → 버전: 새 버전]으로 다시 배포해야 반영된다.
 *
 * 시트 구성
 *  응답        한 줄 = 한 참가자 (열 이름은 SPSS·jamovi용 영문, 뜻은 '문항 사전' 시트)
 *  행동 로그    한 줄 = 한 이벤트
 *  동의 기록    참가자별 동의 시각·문구 버전·항목
 *  동의문 원문  버전별 동의 문구 전문
 *  문항 사전    열 이름 ↔ 문항·변수·역코딩
 *  설정        실험 모드(본실험/파일럿)와 제한 시간 — 관리자 화면에서 바꾼다
 *  추첨용 휴대전화 번호는 응답과 연결되지 않도록 '별도 구글 시트 파일'에 ID 없이 저장한다.
 */

var SHEET = {
  responses: '응답',
  logs: '행동 로그',
  consents: '동의 기록',
  consentTexts: '동의문 원문',
  dictionary: '문항 사전',
  settings: '설정'
};
var PHONE_SHEET = '추첨 번호';
var DEFAULTS = { mode: '본실험', help_seconds: 90, skip_seconds: 180, scenario_wait: 10, target_per_group: 45 };
var SETTING_NOTES = {
  mode: '본실험 / 파일럿 — 새로 들어오는 참가자의 구분',
  help_seconds: '혼자 찾기 제한 시간(초). 지나면 위치 안내',
  skip_seconds: '안내 뒤 이 시간(초)이 지나면 [건너뛰기]',
  scenario_wait: '상황 카드 최소 체류 시간(초)',
  target_per_group: '집단당 목표 완료 인원'
};
var GROUPS = { 1: ['목적형', '직접 노출'], 2: ['목적형', '설정 경유'], 3: ['탐색형', '직접 노출'], 4: ['탐색형', '설정 경유'] };
var DATE_KEYS = { started_at: 1, last_at: 1, finished_at: 1, at: 1, received_at: 1, saved_at: 1 };
var PROTECTED = { id: 1, kind: 1, started_at: 1, last_at: 1, group: 1, W: 1, X2: 1, task1_x1: 1, task2_x1: 1, set_order: 1 };
var LOG_HEADER = ['at', 'id', 'elapsed_s', 'task', 'page', 'event', 'detail'];
var CONSENT_HEADER = ['id', 'at', 'version', 'participate', 'data', 'phone'];
var CONSENT_TEXT_HEADER = ['version', 'saved_at', 'text'];
var SETTINGS_HEADER = ['key', 'value', '설명'];
var PHONE_HEADER = ['received_at', 'phone', 'attn_pass', 'kind'];
var KINDS = { '본실험': 1, '파일럿': 1, '테스트': 1 };
var ACTIVE_MS = 30 * 60 * 1000;

var ACTIONS = {
  assign: assign_,
  save: save_,
  phone: phone_,
  admin_data: adminData_,
  admin_logs: adminLogs_,
  admin_settings: adminSettings_,
  admin_kind: adminKind_,
  admin_delete_tests: adminDeleteTests_,
  export_all: exportAll_
};

/** 처음 한 번 편집기에서 실행한다. 비밀 키를 만들고 시트를 준비한다. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) {
    props.setProperty('SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8));
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  props.setProperty('SS_ID', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Seoul');
  ensureBase_(ss);
  var book = phoneBook_();
  Logger.log('APPS_SCRIPT_SECRET = ' + props.getProperty('SECRET'));
  Logger.log('응답 시트: ' + ss.getUrl());
  Logger.log('추첨 번호 시트(별도 파일): ' + book.getUrl());
}

function doGet() {
  return ContentService.createTextOutput('SBCX 저장소가 동작 중이에요.');
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e && e.postData ? e.postData.contents : '{}');
  } catch (err) {
    return out_({ ok: false, error: 'bad_json' });
  }
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || body.secret !== secret) return out_({ ok: false, error: 'unauthorized' });
  var fn = ACTIONS[body.action];
  if (!fn) return out_({ ok: false, error: 'unknown_action' });
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var result = fn(body) || {};
    result.ok = true;
    return out_(result);
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (e2) {}
  }
}

/* ───────────────────────── 참가자 ───────────────────────── */

function assign_(b) {
  var ss = ss_();
  ensureBase_(ss);
  var sh = sheet_(ss, SHEET.responses, b.columns && b.columns.length ? b.columns : ['id']);
  if (b.dictionary && b.dictionaryVersion) writeDictionary_(ss, b.dictionaryHeader, b.dictionary, b.dictionaryVersion);
  if (b.consentVersion && b.consentText) saveConsentText_(ss, String(b.consentVersion), String(b.consentText));

  var settings = settings_(ss);
  var kind = b.test ? '테스트' : settings.mode === '파일럿' ? '파일럿' : '본실험';
  var t = table_(sh);
  var H = t.index;
  var now = Date.now();

  // 16칸(집단 4 × 결정·행동 순서 2 × 니트 세트 순서 2) 블록 무작위 배정.
  // 같은 구분 안에서 '완료했거나 30분 안에 움직인' 사람만 센다 → 중도 이탈 자리는 다시 채워진다.
  var cells = [];
  for (var g = 1; g <= 4; g++) for (var o = 0; o < 2; o++) for (var s = 0; s < 2; s++) cells.push({ g: g, o: o, s: s, n: 0 });
  t.rows.forEach(function (r) {
    if (r[H.kind] !== kind) return;
    if (r[H.status] !== '완료' && now - ms_(r[H.last_at]) > ACTIVE_MS) return;
    var rg = Number(r[H.group]);
    var ro = r[H.task1_x1] === '결정' ? 0 : 1;
    var rs = String(r[H.set_order]).charAt(0) === '가' ? 0 : 1;
    cells.forEach(function (c) {
      if (c.g === rg && c.o === ro && c.s === rs) c.n++;
    });
  });
  var cand = cells;
  var f = b.test && b.force ? b.force : null;
  if (f) {
    cand = cells.filter(function (c) {
      return (f.g == null || c.g === Number(f.g)) && (f.o == null || c.o === Number(f.o)) && (f.s == null || c.s === Number(f.s));
    });
    if (!cand.length) cand = cells;
  }
  var min = Math.min.apply(null, cand.map(function (c) { return c.n; }));
  cand = cand.filter(function (c) { return c.n === min; });
  var pick = cand[Math.floor(Math.random() * cand.length)];

  var used = {};
  t.rows.forEach(function (r) { used[r[H.id]] = 1; });
  var id;
  do {
    id = 'P-' + randomId_(6);
  } while (used[id]);

  var x1 = pick.o === 0 ? ['결정', '행동'] : ['행동', '결정'];
  var sets = pick.s === 0 ? ['가', '나'] : ['나', '가'];
  var consent = b.consent || {};
  var rec = {
    id: id,
    kind: kind,
    status: '진행 중',
    page: 'S1 시작·동의',
    started_at: now,
    last_at: now,
    group: pick.g,
    W: GROUPS[pick.g][0],
    X2: GROUPS[pick.g][1],
    task1_x1: x1[0],
    task2_x1: x1[1],
    set_order: sets.join('→'),
    task1_set: sets[0],
    task2_set: sets[1],
    device: b.device || '',
    window: b.window || '',
    consent_phone: consent.phone ? 1 : 0
  };
  appendObjects_(sh, t.header, [rec]);
  var cs = sheet_(ss, SHEET.consents, CONSENT_HEADER);
  appendObjects_(cs, CONSENT_HEADER, [
    {
      id: id,
      at: now,
      version: b.consentVersion || '',
      participate: consent.participate ? 1 : 0,
      data: consent.data ? 1 : 0,
      phone: consent.phone ? 1 : 0
    }
  ]);
  return { id: id, group: pick.g, o: pick.o, s: pick.s, kind: kind, settings: settings };
}

function save_(b) {
  var ss = ss_();
  var sh = sheet_(ss, SHEET.responses, b.columns && b.columns.length ? b.columns : ['id']);
  var t = table_(sh);
  var H = t.index;
  var at = findRow_(t, b.id);
  if (at < 0) throw new Error('unknown_id');
  var row = t.rows[at].slice();
  var rec = b.record || {};
  Object.keys(rec).forEach(function (k) {
    if (H[k] == null || PROTECTED[k]) return;
    row[H[k]] = cell_(k, rec[k]);
  });
  row[H.last_at] = new Date();
  sh.getRange(at + 2, 1, 1, row.length).setValues([row.map(requote_)]);

  var logs = b.logs || [];
  if (logs.length) {
    var ls = sheet_(ss, SHEET.logs, LOG_HEADER);
    appendRows_(
      ls,
      logs.map(function (l) {
        return [
          new Date(Number(l.at) || Date.now()),
          q_(String(b.id)),
          Number(l.elapsed_s) || 0,
          q_(String(l.task == null ? '' : l.task)),
          q_(String(l.page || '')),
          q_(String(l.event || '')),
          q_(String(l.detail == null ? '' : l.detail).slice(0, 1000))
        ];
      })
    );
  }
  return { saved: true };
}

function phone_(b) {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.responses);
  if (!sh) throw new Error('unknown_id');
  var t = table_(sh);
  var at = findRow_(t, b.id);
  if (at < 0) throw new Error('unknown_id');
  var r = t.rows[at];
  var phone = String(b.phone || '').replace(/[^0-9]/g, '');
  if (!/^01[0-9]{8,9}$/.test(phone)) throw new Error('bad_phone');
  var ps = sheet_(phoneBook_(), PHONE_SHEET, PHONE_HEADER);
  // 참가자 ID는 남기지 않는다. 추첨 제외 판단에 필요한 주의 점검 통과 여부와 구분만 함께 둔다.
  var ap = t.index.attn_pass != null ? r[t.index.attn_pass] : '';
  appendRows_(ps, [[new Date(), q_(phone), ap === '' ? '' : Number(ap), q_(String(r[t.index.kind]))]]);
  return { saved: true };
}

/* ───────────────────────── 관리자 ───────────────────────── */

function adminData_() {
  var ss = ss_();
  ensureBase_(ss);
  var rs = ss.getSheetByName(SHEET.responses);
  var book = phoneBook_();
  var ps = sheet_(book, PHONE_SHEET, PHONE_HEADER);
  return {
    responses: rs ? objects_(table_(rs)) : [],
    consents: objects_(table_(ss.getSheetByName(SHEET.consents))),
    consentTexts: objects_(table_(ss.getSheetByName(SHEET.consentTexts))),
    settings: settings_(ss),
    phoneCount: Math.max(0, ps.getLastRow() - 1),
    sheetUrl: ss.getUrl(),
    phoneUrl: book.getUrl(),
    now: Date.now()
  };
}

function adminLogs_(b) {
  var ss = ss_();
  var ls = sheet_(ss, SHEET.logs, LOG_HEADER);
  var rows = objects_(table_(ls));
  if (b.id) rows = rows.filter(function (r) { return r.id === b.id; });
  var limit = Math.min(Number(b.limit) || 500, 5000);
  rows = rows.slice(-limit).reverse();
  return { logs: rows };
}

function adminSettings_(b) {
  var ss = ss_();
  var cur = settings_(ss);
  var next = b.settings || {};
  Object.keys(DEFAULTS).forEach(function (k) {
    if (next[k] == null || next[k] === '') return;
    if (k === 'mode') {
      if (next[k] === '본실험' || next[k] === '파일럿') cur.mode = next[k];
    } else {
      var n = Math.round(Number(next[k]));
      if (isFinite(n) && n >= 0 && n <= 3600) cur[k] = n;
    }
  });
  writeSettings_(ss, cur);
  return { settings: cur };
}

function adminKind_(b) {
  if (!KINDS[b.kind]) throw new Error('bad_kind');
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.responses);
  var t = table_(sh);
  var at = findRow_(t, b.id);
  if (at < 0) throw new Error('unknown_id');
  sh.getRange(at + 2, t.index.kind + 1, 1, 1).setValues([[b.kind]]);
  return { id: b.id, kind: b.kind };
}

function adminDeleteTests_() {
  var ss = ss_();
  var sh = ss.getSheetByName(SHEET.responses);
  if (!sh) return { deleted: 0 };
  var t = table_(sh);
  var H = t.index;
  var del = {};
  var keep = [];
  t.rows.forEach(function (r) {
    if (r[H.kind] === '테스트') del[r[H.id]] = 1;
    else if (!blank_(r)) keep.push(r);
  });
  var n = Object.keys(del).length;
  if (!n) return { deleted: 0 };
  rewrite_(sh, t, keep);
  [SHEET.logs, SHEET.consents].forEach(function (name) {
    var s2 = ss.getSheetByName(name);
    if (!s2) return;
    var t2 = table_(s2);
    rewrite_(s2, t2, t2.rows.filter(function (r) { return !blank_(r) && !del[r[t2.index.id]]; }));
  });
  var ps = sheet_(phoneBook_(), PHONE_SHEET, PHONE_HEADER);
  var t3 = table_(ps);
  rewrite_(ps, t3, t3.rows.filter(function (r) { return !blank_(r) && r[t3.index.kind] !== '테스트'; }));
  return { deleted: n };
}

function exportAll_() {
  var ss = ss_();
  ensureBase_(ss);
  var rs = ss.getSheetByName(SHEET.responses);
  return {
    responses: rs ? objects_(table_(rs)) : [],
    logs: objects_(table_(ss.getSheetByName(SHEET.logs))),
    consents: objects_(table_(ss.getSheetByName(SHEET.consents))),
    consentTexts: objects_(table_(ss.getSheetByName(SHEET.consentTexts))),
    now: Date.now()
  };
}

/* ───────────────────────── 시트 도우미 ───────────────────────── */

function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function phoneBook_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('PHONE_SS_ID');
  if (id) return SpreadsheetApp.openById(id);
  var book = SpreadsheetApp.create('SBCX 추첨 번호 (응답과 분리 보관)');
  book.setSpreadsheetTimeZone('Asia/Seoul');
  props.setProperty('PHONE_SS_ID', book.getId());
  var first = book.getSheets()[0];
  first.setName(PHONE_SHEET);
  sheet_(book, PHONE_SHEET, PHONE_HEADER);
  return book;
}

function ensureBase_(ss) {
  sheet_(ss, SHEET.logs, LOG_HEADER);
  sheet_(ss, SHEET.consents, CONSENT_HEADER);
  sheet_(ss, SHEET.consentTexts, CONSENT_TEXT_HEADER);
  settings_(ss);
}

// 시트가 없으면 만들고, 머리글에 없는 열은 오른쪽에 덧붙인다.
function sheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (header && header.length) {
    var lastCol = sh.getLastColumn();
    var cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    while (cur.length && cur[cur.length - 1] === '') cur.pop();
    var missing = header.filter(function (h) { return cur.indexOf(h) < 0; });
    if (missing.length) {
      sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

function table_(sh) {
  if (!sh) return { header: [], rows: [], index: {} };
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return { header: [], rows: [], index: {} };
  var v = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var header = v[0].map(String);
  var index = {};
  header.forEach(function (h, i) {
    if (h && index[h] == null) index[h] = i;
  });
  return { header: header, rows: v.slice(1), index: index };
}

function objects_(t) {
  var out = [];
  t.rows.forEach(function (r) {
    if (blank_(r)) return;
    var o = {};
    t.header.forEach(function (h, i) {
      if (!h) return;
      var v = r[i];
      o[h] = isDate_(v) ? v.getTime() : v;
    });
    out.push(o);
  });
  return out;
}

function findRow_(t, id) {
  var c = t.index.id;
  if (c == null || !id) return -1;
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i][c]) === String(id)) return i;
  return -1;
}

function appendObjects_(sh, header, objs) {
  var cur = table_(sh).header;
  var cols = cur.length ? cur : header;
  appendRows_(
    sh,
    objs.map(function (o) {
      return cols.map(function (h) { return o.hasOwnProperty(h) ? cell_(h, o[h]) : ''; });
    })
  );
}

function appendRows_(sh, rows) {
  if (!rows.length) return;
  var start = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

function rewrite_(sh, t, rows) {
  var w = t.header.length;
  if (!w) return;
  if (t.rows.length) sh.getRange(2, 1, t.rows.length, w).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, w).setValues(rows.map(function (r) { return r.map(requote_); }));
}

function settings_(ss) {
  var sh = sheet_(ss, SHEET.settings, SETTINGS_HEADER);
  var t = table_(sh);
  var cur = {};
  Object.keys(DEFAULTS).forEach(function (k) { cur[k] = DEFAULTS[k]; });
  var seen = 0;
  t.rows.forEach(function (r) {
    var k = String(r[0]);
    if (!DEFAULTS.hasOwnProperty(k)) return;
    seen++;
    cur[k] = k === 'mode' ? String(r[1]) : Number(r[1]);
  });
  if (seen < Object.keys(DEFAULTS).length) writeSettings_(ss, cur);
  return cur;
}

function writeSettings_(ss, cur) {
  var sh = sheet_(ss, SHEET.settings, SETTINGS_HEADER);
  var t = table_(sh);
  var rows = Object.keys(DEFAULTS).map(function (k) { return [k, cur[k], SETTING_NOTES[k] || '']; });
  rewrite_(sh, { header: SETTINGS_HEADER, rows: t.rows }, rows);
}

function writeDictionary_(ss, header, rows, version) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('DICT_VERSION') === version) return;
  var sh = ss.getSheetByName(SHEET.dictionary) || ss.insertSheet(SHEET.dictionary);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow && lastCol) sh.getRange(1, 1, lastRow, lastCol).clearContent();
  var all = [header].concat(rows).map(function (r) { return r.map(function (v) { return q_(String(v)); }); });
  sh.getRange(1, 1, all.length, header.length).setValues(all);
  sh.setFrozenRows(1);
  props.setProperty('DICT_VERSION', version);
}

function saveConsentText_(ss, version, text) {
  var sh = sheet_(ss, SHEET.consentTexts, CONSENT_TEXT_HEADER);
  var t = table_(sh);
  var have = t.rows.some(function (r) { return String(r[0]) === version; });
  if (!have) appendRows_(sh, [[q_(version), new Date(), q_(text)]]);
}

/* ───────────────────────── 값 도우미 ───────────────────────── */

function cell_(k, v) {
  if (v === null || v === undefined) return '';
  if (DATE_KEYS[k] && typeof v === 'number') return v ? new Date(v) : '';
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (isDate_(v)) return v;
  return q_(String(v).slice(0, 2000));
}

// 시트가 숫자·날짜·수식으로 바꿔 버릴 수 있는 글자는 앞에 '를 붙여 글자 그대로 둔다.
function q_(s) {
  if (typeof s !== 'string' || s === '') return s;
  if (s.charAt(0) === "'") return s;
  if (/^[=+\-@]/.test(s) || /^[\d\s.,:\/\-]+$/.test(s) || /^(true|false)$/i.test(s)) return "'" + s;
  return s;
}

function requote_(v) {
  return typeof v === 'string' ? q_(v) : v;
}

function isDate_(v) {
  return v !== null && typeof v === 'object' && typeof v.getTime === 'function';
}

function ms_(v) {
  if (isDate_(v)) return v.getTime();
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function blank_(r) {
  for (var i = 0; i < r.length; i++) if (r[i] !== '' && r[i] !== null) return false;
  return true;
}

function randomId_(n) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var s = '';
  for (var i = 0; i < n; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

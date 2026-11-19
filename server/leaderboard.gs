/**
 * 꽃정원 순위 서버 — Google Apps Script (구글 시트에 붙여 쓰는 웹 앱)
 *
 * 설치: server/SETUP.md 참고 (구글 시트 → 확장 프로그램 → Apps Script → 이 코드 붙여넣기 → 웹 앱으로 배포)
 *
 * GET  ?device=..&name=..            → { ok, total, top:[{name,score,level,mine}], rank }
 * POST {name,score,level,popped,turns,device}  (Content-Type: text/plain)
 *                                     → { ok, total, top, rank }  /  { ok:false, msg }
 *
 * 순위는 '기기 + 이름' 하나당 최고 점수만 센다. 같은 이름이라도 다른 기기면 다른 사람.
 * 시트에서 줄을 지우면 그 기록이 순위에서 빠진다(관리자는 시트만 보면 됨).
 */
var SHEET_NAME = 'scores';
var HEADER = ['시각', '이름', '점수', '단계', '꽃', '턴', '기기'];
var MAX_NAME = 10;
var TOP_N = 30;
var MIN_GAP_SEC = 8; // 같은 기기에서 이 시간 안에 또 보내면 거절

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADER);
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** 이름 다듬기: 제어문자·꺾쇠 제거, 공백 정리, 10자. 시트 수식(=,+,-,@ 로 시작)은 글자로 */
function cleanName_(s) {
  s = String(s == null ? '' : s)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  s = Array.from ? Array.from(s).slice(0, MAX_NAME).join('') : s.slice(0, MAX_NAME);
  return s;
}
function sheetSafe_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function isInt_(v, lo, hi) {
  return typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= lo && v <= hi;
}

function rows_() {
  var sh = sheet_();
  var n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, HEADER.length).getValues();
}

/** 기기+이름별 최고 점수 → 점수 내림차순(같으면 먼저 낸 사람) */
function board_(rows) {
  var best = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var name = String(r[1]).replace(/^'/, '');
    var score = Number(r[2]);
    if (!name || !isFinite(score)) continue;
    var key = String(r[6]) + '|' + name;
    var t = r[0] instanceof Date ? r[0].getTime() : Number(new Date(r[0])) || 0;
    var cur = best[key];
    if (!cur || score > cur.score || (score === cur.score && t < cur.t)) {
      best[key] = { key: key, name: name, score: score, level: Number(r[3]) || 1, t: t };
    }
  }
  var list = [];
  for (var k in best) list.push(best[k]);
  list.sort(function (a, b) {
    return b.score - a.score || a.t - b.t;
  });
  return list;
}

function result_(list, myKey) {
  var rank = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].key === myKey) {
      rank = i + 1;
      break;
    }
  }
  var top = list.slice(0, TOP_N).map(function (e) {
    return { name: e.name, score: e.score, level: e.level, mine: e.key === myKey };
  });
  return { ok: true, total: list.length, top: top, rank: rank };
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var myKey = p.device && p.name ? String(p.device) + '|' + cleanName_(p.name) : '';
  return json_(result_(board_(rows_()), myKey));
}

function doPost(e) {
  var d;
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, msg: '형식이 잘못됐어요' });
  }
  var name = cleanName_(d.name);
  if (!name) return json_({ ok: false, msg: '이름을 써 주세요' });
  if (!/^[a-z0-9-]{8,40}$/.test(String(d.device || ''))) return json_({ ok: false, msg: '기기 정보가 없어요' });
  if (!isInt_(d.score, 0, 10000000) || !isInt_(d.level, 1, 999) || !isInt_(d.popped, 0, 1000000) || !isInt_(d.turns, 0, 1000000)) {
    return json_({ ok: false, msg: '기록이 이상해요' });
  }
  // 말이 되는 점수인지: 꽃 한 송이 최대 약 90점(연쇄 배수 포함) · 한 턴에 최대 50송이
  if (d.score > d.popped * 120 || d.popped > d.turns * 50) return json_({ ok: false, msg: '기록이 이상해요' });

  var cache = CacheService.getScriptCache();
  var ck = 'gap_' + d.device;
  if (cache.get(ck)) return json_({ ok: false, msg: '잠시 뒤에 다시 올려 주세요' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet_().appendRow([new Date(), sheetSafe_(name), d.score, d.level, d.popped, d.turns, d.device]);
    cache.put(ck, '1', MIN_GAP_SEC);
    return json_(result_(board_(rows_()), d.device + '|' + name));
  } finally {
    lock.releaseLock();
  }
}

// 참가자 상태를 바꾸는 순수 함수 모음. App이 복사본(d)을 넘기면 그대로 고친다.
// 아무것도 바뀌지 않으면 false를 돌려준다.
import { ITEMS, itemKey } from '../shared/items.js';
import { FIRST, DEF, DIMS, calcResults } from '../shared/products.js';
import { GROUPS, condCode } from '../shared/schema.js';
import { buildFlow } from './flow.js';

export function newTask(x1, set) {
  return {
    x1,
    set,
    screen: 'home',
    mode: 'browse',
    exclP: [false, false, false],
    exclB: [false, false, false],
    conds: { ...DEF },
    results: null,
    showOrig: false,
    found: false,
    foundMs: null,
    foundBeforeHelp: null,
    helpMs: null,
    skipped: false,
    visMs: 0,
    startAt: null,
    rerecMs: null,
    doneMs: null,
    reverts: 0,
    clicks: 0,
    settingsIn: 0,
    toast: '',
    toastUntil: 0
  };
}

export function newSession(a, meta) {
  const g = GROUPS[a.group];
  const x1 = a.o === 0 ? ['결정', '행동'] : ['행동', '결정'];
  const sets = a.s === 0 ? ['가', '나'] : ['나', '가'];
  const now = Date.now();
  const d = {
    v: 1,
    id: a.id,
    kind: a.kind,
    group: a.group,
    W: g.W,
    X2: g.X2,
    x1,
    sets,
    settings: a.settings,
    consent: meta.consent,
    device: meta.device,
    flow: buildFlow(),
    pi: 0,
    pageEnter: now,
    answers: {},
    tasks: [newTask(x1[0], sets[0]), newTask(x1[1], sets[1])],
    logs: [],
    seq: 0,
    startMs: now,
    endMs: null,
    finished: false,
    phoneGiven: null,
    savedFinished: false
  };
  addLog(d, 'consent', `연구 참여 ✓ · 응답 수집 ✓ · 번호 수집 ${meta.consent.phone ? '✓' : '✗'}`);
  addLog(d, 'assign', `집단 ${a.group} (${g.W} × ${g.X2}) · ${x1.join('→')} · 세트 ${sets.join('→')}`);
  goto(d, 1);
  return d;
}

export const page = (d) => d.flow[d.pi];
export const curTask = (d) => {
  const pg = page(d);
  return pg.task != null ? d.tasks[pg.task] : null;
};

export function addLog(d, event, detail = '', taskIdx) {
  const pg = page(d);
  const now = Date.now();
  const t = taskIdx != null ? taskIdx : pg && pg.task != null ? pg.task : null;
  d.seq += 1;
  d.logs.push({
    seq: d.seq,
    at: now,
    elapsed_s: Math.round((now - d.startMs) / 100) / 10,
    task: t == null ? '' : `과업 ${t + 1}`,
    page: pg ? pg.id : '',
    event,
    detail: String(detail)
  });
}

export function goto(d, idx) {
  if (idx < 0 || idx >= d.flow.length) return false;
  d.pi = idx;
  d.pageEnter = Date.now();
  const pg = d.flow[idx];
  if (pg.kind === 'task') {
    const T = d.tasks[pg.task];
    T.startAt = Date.now();
    T.visMs = 0;
    T.screen = 'home';
  }
  if (pg.kind === 'result') {
    const T = d.tasks[pg.task];
    T.mode = 'result';
    T.screen = 'home';
    T.showOrig = false;
  }
  if (pg.kind === 'thanks') {
    d.finished = true;
    d.endMs = Date.now();
  }
  addLog(d, 'screen', `${pg.id} ${pg.name}`);
}

export function keyOf(pg, id) {
  return itemKey(pg.task != null ? pg.task : null, id);
}

export function ageOk(v) {
  const n = Number(v);
  return v !== '' && v != null && Number.isInteger(n) && n >= 19 && n <= 99;
}

export function pageComplete(d, pg) {
  if (pg.kind !== 'q') return true;
  return pg.items.every((id) => {
    const a = d.answers[keyOf(pg, id)];
    if (!a || a.v === '' || a.v == null) return false;
    return ITEMS[id].type === 'number' ? ageOk(a.v) : true;
  });
}

export function answer(d, key, v, log = true) {
  const prev = d.answers[key];
  if (prev && prev.v === v) return false;
  d.answers[key] = { v, at: Date.now() };
  if (log) addLog(d, 'answer', `${key}=${v}`);
}

export function next(d, waitSec) {
  const pg = page(d);
  if (pg.kind === 'q') {
    if (!pageComplete(d, pg)) return false;
    pg.items.forEach((id) => {
      if (ITEMS[id].type === 'number') addLog(d, 'answer', `${keyOf(pg, id)}=${d.answers[keyOf(pg, id)].v}`);
    });
  }
  if (pg.kind === 'scenario' && Date.now() - d.pageEnter < waitSec * 1000) return false;
  if (d.pi >= d.flow.length - 1) return false;
  goto(d, d.pi + 1);
}

/* ── 과업 중 앱 조작 ── */

const live = (d) => page(d).kind === 'task';

function markFound(d, T, how) {
  if (T.found) return;
  T.found = true;
  T.foundMs = T.visMs;
  T.foundBeforeHelp = T.helpMs == null;
  addLog(d, 'found', `${how} · ${T.helpMs == null ? '스스로' : '안내 후'} · ${Math.round(T.visMs / 1000)}초`);
}

export function togExcl(d, kind, i) {
  if (!live(d)) return false;
  const T = curTask(d);
  const arr = kind === 'p' ? T.exclP : T.exclB;
  arr[i] = !arr[i];
  T.clicks += 1;
  const p = FIRST[T.set][i];
  markFound(d, T, T.screen === 'settings' ? '설정 화면 체크' : '제외 버튼');
  addLog(d, kind === 'p' ? 'excl_product' : 'excl_brand', `${kind === 'p' ? `${p.brand} ${p.name}` : p.brand} ${arr[i] ? '제외' : '제외 취소'}`);
}

export function pickCond(d, key, val) {
  if (!live(d)) return false;
  const T = curTask(d);
  T.clicks += 1;
  markFound(d, T, T.screen === 'settings' ? '설정 화면 조건' : '조건 칩');
  if (T.conds[key] === val) return;
  T.conds[key] = val;
  addLog(d, 'condition', `${DIMS.find((x) => x.key === key).label} → ${val}`);
}

export function openSettings(d) {
  if (!live(d)) return false;
  const T = curTask(d);
  T.screen = 'settings';
  T.settingsIn += 1;
  T.clicks += 1;
  markFound(d, T, '띠배너');
  addLog(d, 'settings_in', '띠배너 → 추천 설정');
}

export function closeSettings(d) {
  if (!live(d)) return false;
  const T = curTask(d);
  T.screen = 'home';
  T.clicks += 1;
  addLog(d, 'settings_out', '저장하지 않고 뒤로');
}

export function changeSummary(T) {
  if (T.x1 === '결정') {
    const parts = [];
    FIRST[T.set].forEach((p, i) => {
      if (T.exclP[i]) parts.push(`${p.brand} ${p.name}(상품)`);
      if (T.exclB[i]) parts.push(`${p.brand}(브랜드)`);
    });
    return '제외: ' + parts.join(', ');
  }
  return `핏 ${T.conds.fit} · 소재 ${T.conds.mat} · 기장 ${T.conds.len}`;
}

export function rerec(d) {
  if (!live(d)) return false;
  const T = curTask(d);
  T.clicks += 1;
  const nothing =
    T.x1 === '결정'
      ? !(T.exclP.some(Boolean) || T.exclB.some(Boolean))
      : T.conds.fit === DEF.fit && T.conds.mat === DEF.mat && T.conds.len === DEF.len;
  if (nothing) {
    T.toast = T.x1 === '결정' ? '제외한 상품이 없어요' : '바뀐 조건이 없어요';
    T.toastUntil = Date.now() + 2500;
    addLog(d, 'rerec_empty', T.x1 === '결정' ? '제외 없이 누름' : '조건 그대로 누름');
    return;
  }
  T.results = calcResults(T);
  T.rerecMs = T.visMs;
  T.toast = '';
  addLog(d, 'rerec', `${changeSummary(T)} · ${Math.round(T.visMs / 1000)}초`);
  goto(d, d.pi + 1);
}

export function complete(d) {
  if (page(d).kind !== 'result') return false;
  const T = curTask(d);
  T.doneMs = Date.now() - T.startAt;
  T.showOrig = false;
  addLog(d, 'complete', '결과 확인 후 [완료]');
  goto(d, d.pi + 1);
}

export function toggleOrig(d) {
  if (page(d).kind !== 'result') return false;
  const T = curTask(d);
  T.showOrig = !T.showOrig;
  if (T.showOrig) T.reverts += 1;
  addLog(d, T.showOrig ? 'revert' : 'unrevert', T.showOrig ? '처음 추천 보기' : '바뀐 추천 다시 보기');
}

export function skip(d) {
  const pg = page(d);
  if (pg.kind !== 'task') return false;
  const T = curTask(d);
  T.skipped = true;
  T.screen = 'home';
  addLog(d, 'skip', '안내 뒤에도 바꾸지 못함 · 미사용(매개 분석 제외)');
  const idx = d.flow.findIndex((p, k) => k > d.pi && p.id === 'T2-Y3' && p.task === pg.task);
  goto(d, idx);
}

// 0.5초마다: 화면을 보고 있을 때만 과업 시간을 센다. 제한 시간이 지나면 위치 안내.
export function tick(d, dt, helpSec) {
  if (!live(d)) return false;
  const T = curTask(d);
  T.visMs += dt;
  if (!T.found && T.helpMs == null && T.visMs >= helpSec * 1000) {
    T.helpMs = T.visMs;
    addLog(d, 'help', helpText(d, T));
  }
}

export function helpText(d, T) {
  const c = condCode(T.x1, d.X2);
  if (c === 'C1') return '추천 상품 아래 버튼으로 추천을 바꿀 수 있어요.';
  if (c === 'C3') return '상품 목록 위 ‘AI가 추천에 쓰는 조건’에서 추천을 바꿀 수 있어요.';
  return '화면 위 ‘추천 설정’에서 추천을 바꿀 수 있어요.';
}

export function setPhoneGiven(d, given) {
  if (page(d).kind !== 'done') return false;
  d.phoneGiven = given;
  addLog(d, 'phone', given ? '추첨 번호 제출 (응답과 분리 저장)' : '번호 없이 마침');
  goto(d, d.pi + 1);
}

export function logEvent(d, event, detail) {
  addLog(d, event, detail);
}

const r1 = (ms) => (ms == null ? '' : Math.round(ms / 100) / 10);

// 구글 시트 '응답' 줄 (참가자 브라우저가 쓸 수 있는 열만)
export function buildRecord(d, windowSize) {
  const pg = page(d);
  const r = {
    status: d.finished ? '완료' : '진행 중',
    page: `${pg.id} ${pg.name}`,
    finished_at: d.endMs || '',
    duration_s: d.endMs ? Math.round((d.endMs - d.startMs) / 1000) : '',
    device: d.device,
    window: windowSize,
    consent_phone: d.consent.phone ? 1 : 0
  };
  const a29 = d.answers.task2_q29;
  r.attn_pass = a29 ? (Number(a29.v) === 5 ? 1 : 0) : '';
  d.tasks.forEach((T, i) => {
    const p = `task${i + 1}_`;
    const started = T.startAt != null;
    r[p + 'set'] = T.set;
    r[p + 'cond'] = condCode(T.x1, d.X2);
    r[p + 'found'] = !started ? '' : T.found ? (T.foundBeforeHelp ? '스스로' : '안내 후') : '못 찾음';
    r[p + 'found_s'] = r1(T.foundMs);
    r[p + 'help'] = started ? (T.helpMs != null ? 1 : 0) : '';
    r[p + 'skip'] = started ? (T.skipped ? 1 : 0) : '';
    r[p + 'change_s'] = r1(T.rerecMs);
    r[p + 'done_s'] = r1(T.doneMs);
    r[p + 'revert'] = started ? T.reverts : '';
    r[p + 'clicks'] = started ? T.clicks : '';
    r[p + 'settings'] = started ? T.settingsIn : '';
    r[p + 'change'] = T.results ? changeSummary(T) : '';
  });
  Object.keys(d.answers).forEach((k) => {
    const v = d.answers[k].v;
    r[k] = k === 'q2' ? Number(v) : v;
  });
  return r;
}

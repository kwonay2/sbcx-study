// Code.gs(구글 시트 저장소)를 로컬 가짜 시트로 돌려 보는 점검 스크립트
//   npm run test:storage
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

process.env.LOCAL_SHEETS_FILE = path.join(os.tmpdir(), `sbcx-storage-test-${Date.now()}.json`);
const { callLocal, dumpLocal } = await import('../lib/gas-local.js');
const { RESPONSE_COLUMNS, dictionaryRows, DICTIONARY_HEADER, dictionaryVersion } = await import('../src/shared/schema.js');

const base = {
  columns: RESPONSE_COLUMNS,
  dictionary: dictionaryRows(),
  dictionaryHeader: DICTIONARY_HEADER,
  dictionaryVersion: dictionaryVersion(),
  consentVersion: 'v1-초안',
  consentText: '동의문 원문 테스트',
  consent: { participate: true, data: true, phone: true },
  device: 'Chrome · 창 1440×900',
  window: '1440×900'
};
const ok = (r) => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r;
};
const sheet = (name, book = 'main') => dumpLocal().books[book].sheets.find((s) => s.name === name);
const rows = (name, book) => {
  const s = sheet(name, book);
  const [h, ...rest] = s.data;
  return rest.filter((r) => r && r.some((v) => v !== '')).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
};

// 1. 블록 무작위 배정: 32명이면 16칸에 2명씩
const ids = [];
for (let i = 0; i < 32; i++) ids.push(ok(callLocal('assign', base)));
const cellCount = {};
ids.forEach((a) => {
  const k = `${a.group}-${a.o}-${a.s}`;
  cellCount[k] = (cellCount[k] || 0) + 1;
});
assert.equal(Object.keys(cellCount).length, 16, '16칸이 모두 채워져야 해요');
assert.ok(Object.values(cellCount).every((n) => n === 2), '각 칸 2명: ' + JSON.stringify(cellCount));
console.log('✓ 32명 배정 → 16칸에 2명씩');

// 2. 저장: 기록 갱신, 글자 보존, 보호 열은 안 바뀜
const p = ids[0];
ok(
  callLocal('save', {
    id: p.id,
    columns: RESPONSE_COLUMNS,
    record: { status: '진행 중', page: 'S2-1 사전 설문', q1: 2, q2: 24, group: 4, kind: '본실험', task1_change: '-제외: A사', window: '1-2' },
    logs: [
      { at: Date.now(), elapsed_s: 3, task: '', page: 'S2-1', event: 'answer', detail: 'q1=2' },
      { at: Date.now(), elapsed_s: 4, task: '과업 1', page: 'S7', event: 'detail', detail: '=SUM(A1)' }
    ]
  })
);
const r0 = rows('응답').find((r) => r.id === p.id);
assert.equal(r0.q1, 2);
assert.equal(r0.q2, 24);
assert.equal(r0.page, 'S2-1 사전 설문');
assert.equal(r0.group, p.group, '배정 집단은 참가자가 못 바꿔요');
assert.equal(r0.task1_change, '-제외: A사', '-로 시작하는 글자도 그대로');
assert.equal(r0.window, '1-2', '날짜처럼 생긴 글자도 그대로');
const logRows = rows('행동 로그');
assert.equal(logRows.length, 2);
assert.equal(logRows[1].detail, '=SUM(A1)', '수식으로 실행되지 않고 글자로');
console.log('✓ 저장·글자 보존·보호 열');

// 3. 모르는 ID, 잘못된 비밀 키
assert.equal(callLocal('save', { id: 'P-XXXXXX', record: {}, columns: RESPONSE_COLUMNS }).error, 'unknown_id');
console.log('✓ 없는 ID 거절');

// 4. 추첨 번호: 별도 파일, ID 없음, 앞자리 0 유지
ok(callLocal('save', { id: p.id, columns: RESPONSE_COLUMNS, record: { attn_pass: 1, status: '완료' } }));
ok(callLocal('phone', { id: p.id, phone: '01012345678' }));
const book = Object.keys(dumpLocal().books).find((k) => k !== 'main');
const phones = rows('추첨 번호', book);
assert.equal(phones.length, 1);
assert.equal(phones[0].phone, '01012345678');
assert.equal(phones[0].attn_pass, 1);
assert.ok(!('id' in phones[0]), '추첨 번호 시트에는 ID가 없어야 해요');
console.log('✓ 추첨 번호 분리 저장');

// 5. 설정·파일럿 모드·테스트 강제 배정
ok(callLocal('admin_settings', { settings: { mode: '파일럿', help_seconds: 60 } }));
const pilot = ok(callLocal('assign', base));
assert.equal(pilot.kind, '파일럿');
assert.equal(pilot.settings.help_seconds, 60);
const t1 = ok(callLocal('assign', { ...base, test: true, force: { g: 3, o: 1, s: 0 } }));
assert.equal(t1.kind, '테스트');
assert.deepEqual([t1.group, t1.o, t1.s], [3, 1, 0]);
ok(callLocal('save', { id: t1.id, columns: RESPONSE_COLUMNS, record: { status: '완료' }, logs: [{ at: Date.now(), elapsed_s: 1, page: 'S1', event: 'x', detail: '' }] }));
ok(callLocal('phone', { id: t1.id, phone: '01099998888' }));
console.log('✓ 파일럿 모드, 테스트 조건 고정');

// 6. 관리자 데이터, 구분 변경, 테스트 삭제
const d = ok(callLocal('admin_data', {}));
assert.equal(d.responses.length, 34);
assert.equal(typeof d.responses[0].started_at, 'number');
assert.equal(d.phoneCount, 2);
ok(callLocal('admin_kind', { id: ids[1].id, kind: '테스트' }));
const del = ok(callLocal('admin_delete_tests', {}));
assert.equal(del.deleted, 2);
const after = ok(callLocal('export_all', {}));
assert.equal(after.responses.length, 32);
assert.ok(!after.responses.some((r) => r.kind === '테스트'));
assert.ok(!after.logs.some((l) => l.id === t1.id), '테스트 로그도 지워져요');
assert.ok(!after.consents.some((c) => c.id === t1.id));
assert.equal(rows('추첨 번호', book).length, 1, '테스트 추첨 번호도 지워져요');
assert.equal(rows('문항 사전').length, dictionaryRows().length);
assert.equal(rows('동의문 원문').length, 1);
const logs = ok(callLocal('admin_logs', { id: p.id }));
assert.equal(logs.logs.length, 2);
console.log('✓ 관리자 데이터·구분 변경·테스트 삭제·내보내기');

console.log('\n저장소 점검을 모두 통과했어요.');

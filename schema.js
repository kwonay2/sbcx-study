// 구글 시트 열 구성. 응답 시트의 열 이름은 SPSS·jamovi에서 바로 쓸 수 있게 영문으로 두고,
// 뜻은 '문항 사전' 시트에 적어요.
import { ITEMS, ITEM_KEYS, itemIdOfKey } from './items.js';

export const GROUPS = {
  1: { W: '목적형', X2: '직접 노출' },
  2: { W: '목적형', X2: '설정 경유' },
  3: { W: '탐색형', X2: '직접 노출' },
  4: { W: '탐색형', X2: '설정 경유' }
};

export function condCode(x1, X2) {
  return x1 === '결정' ? (X2 === '직접 노출' ? 'C1' : 'C2') : X2 === '직접 노출' ? 'C3' : 'C4';
}

const META = [
  ['id', '참가자 익명 ID', '문자'],
  ['kind', '구분', '본실험 / 파일럿 / 테스트'],
  ['status', '저장된 진행 상태 (중단·제외 후보는 관리자 화면이 계산)', '진행 중 / 완료'],
  ['page', '마지막으로 본 화면', '문자'],
  ['started_at', '동의하고 시작한 시각', '날짜·시각'],
  ['last_at', '마지막 저장 시각', '날짜·시각'],
  ['finished_at', '완료 시각', '날짜·시각'],
  ['duration_s', '시작부터 완료까지 걸린 시간', '초'],
  ['group', '집단', '1–4'],
  ['W', '쇼핑 목적 (시나리오)', '목적형 / 탐색형'],
  ['X2', '접근 위치', '직접 노출 / 설정 경유'],
  ['task1_x1', '과업 1의 통제 유형', '결정 / 행동'],
  ['task2_x1', '과업 2의 통제 유형', '결정 / 행동'],
  ['set_order', '니트 세트 순서', '가→나 / 나→가'],
  ['device', '브라우저', '문자'],
  ['window', '브라우저 창 크기', '가로×세로'],
  ['attn_pass', "주의 점검 통과 (task2_q29 = 5)", '1 / 0'],
  ['consent_phone', '추첨 번호 수집 동의', '1 / 0']
];

const TASK_FIELDS = [
  ['set', '니트 세트', '가 / 나'],
  ['cond', '조건 코드 (C1 결정×직접, C2 결정×설정, C3 행동×직접, C4 행동×설정)', 'C1–C4'],
  ['found', '통제 기능 발견', '스스로 / 안내 후 / 못 찾음'],
  ['found_s', '발견까지 걸린 시간 (화면을 보고 있던 시간만)', '초'],
  ['help', '위치 안내를 받았는지', '1 / 0'],
  ['skip', '[건너뛰기] = 미사용 (매개 분석에서 제외)', '1 / 0'],
  ['change_s', '[다시 추천받기]까지 걸린 시간', '초'],
  ['done_s', '과업 시작부터 [완료]까지', '초'],
  ['revert', '[처음 추천으로 되돌리기]를 누른 횟수', '횟수'],
  ['clicks', '과업 중 앱에서 누른 횟수', '횟수'],
  ['settings', '추천 설정 화면에 들어간 횟수', '횟수'],
  ['change', '바꾼 내용 (제외한 상품·브랜드 또는 고른 조건)', '문자']
];

export const TASK_COLUMNS = (n) => TASK_FIELDS.map((f) => `task${n}_${f[0]}`);

export const RESPONSE_COLUMNS = [
  ...META.map((m) => m[0]),
  ...TASK_COLUMNS(1),
  ...TASK_COLUMNS(2),
  ...ITEM_KEYS
];

// 참가자 브라우저가 바꿀 수 없는 열 (배정·구분은 서버만 쓴다)
export const SERVER_ONLY = ['id', 'kind', 'started_at', 'last_at', 'group', 'W', 'X2', 'task1_x1', 'task2_x1', 'set_order'];
export const CLIENT_COLUMNS = RESPONSE_COLUMNS.filter((c) => !SERVER_ONLY.includes(c));

export const DATE_COLUMNS = ['started_at', 'last_at', 'finished_at'];
// 시트가 숫자·날짜로 바꾸지 않게 글자 그대로 두는 열
export const TEXT_COLUMNS = ['id', 'kind', 'status', 'page', 'set_order', 'device', 'window', 'task1_set', 'task2_set', 'task1_change', 'task2_change'];

export const LOG_COLUMNS = ['at', 'id', 'elapsed_s', 'task', 'page', 'event', 'detail'];
export const CONSENT_COLUMNS = ['id', 'at', 'version', 'participate', 'data', 'phone'];

function itemResponse(it) {
  if (it.type === 'l7') return '7점 1–7' + (it.a ? ` (1 ${it.a[0]} ~ 7 ${it.a[1]})` : ' (1 전혀 그렇지 않다 ~ 7 매우 그렇다)');
  if (it.type === 'number') return '숫자';
  return it.opts.map((o, k) => `${k + 1}=${o.replace(/^[①②]\s*/, '')}`).join(', ');
}

// 문항 사전 (시트 4): 열 이름 ↔ 시점 · 변수 · 문구 · 응답 형식 · 역코딩
export const DICTIONARY_HEADER = ['열 이름', '시점', '변수', '문항·설명', '응답 형식', '역코딩', '비고'];
export function dictionaryRows() {
  const rows = [];
  META.forEach((m) => rows.push([m[0], '—', '참가자 정보', m[1], m[2], '', '']));
  [1, 2].forEach((n) =>
    TASK_FIELDS.forEach((f) => rows.push([`task${n}_${f[0]}`, `과업 ${n}`, '행동 로그 요약', f[1], f[2], '', '']))
  );
  ITEM_KEYS.forEach((key) => {
    const id = itemIdOfKey(key);
    const it = ITEMS[id];
    const where = key.startsWith('task') ? `과업 ${key.charAt(4)} · ${it.w}` : it.w;
    rows.push([key, where, it.v, it.full || it.q, itemResponse(it), it.rev ? '역 (8 − 점수)' : '', it.note || '']);
  });
  return rows;
}

export function dictionaryVersion() {
  const s = JSON.stringify(dictionaryRows());
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 'd' + (h >>> 0).toString(36);
}

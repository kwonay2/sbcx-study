// POST /api/save — 참가자 한 명의 응답 줄을 갱신하고 새 행동 로그를 덧붙인다.
// 화면을 넘길 때마다, 그리고 창을 닫거나 숨길 때(sendBeacon) 호출된다.
import { readJson, send, route, HttpError } from '../lib/http.js';
import { callStore } from '../lib/store.js';
import { RESPONSE_COLUMNS, CLIENT_COLUMNS } from '../src/shared/schema.js';

const ALLOWED = new Set(CLIENT_COLUMNS);
const ID = /^P-[A-Z0-9]{6}$/;

function cleanValue(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined) return '';
  return String(v).slice(0, 500);
}

export default route(['POST'], async (req, res) => {
  const b = await readJson(req);
  if (!ID.test(b.id || '')) throw new HttpError(400, '참가자 ID가 올바르지 않아요');
  const record = {};
  Object.keys(b.record || {}).forEach((k) => {
    if (ALLOWED.has(k)) record[k] = cleanValue(b.record[k]);
  });
  const logs = (Array.isArray(b.logs) ? b.logs : []).slice(0, 800).map((l) => ({
    at: Number(l.at) || Date.now(),
    elapsed_s: Number(l.elapsed_s) || 0,
    task: String(l.task || '').slice(0, 20),
    page: String(l.page || '').slice(0, 40),
    event: String(l.event || '').slice(0, 40),
    detail: String(l.detail == null ? '' : l.detail).slice(0, 500)
  }));
  await callStore('save', { id: b.id, record, logs, columns: RESPONSE_COLUMNS });
  send(res, 200, { ok: true });
});

// 엑셀(.xlsx) 내보내기: 시트 1 응답 · 2 행동 로그 · 3 동의 기록 · 4 문항 사전
// + 5 과업별(긴 형식, 다층모형용) · 6 동의문 원문
import ExcelJS from 'exceljs';
import { RESPONSE_COLUMNS, LOG_COLUMNS, CONSENT_COLUMNS, DICTIONARY_HEADER, dictionaryRows, TASK_COLUMNS, DATE_COLUMNS } from '../src/shared/schema.js';
import { TASK_ITEM_IDS } from '../src/shared/items.js';
import { deriveStates } from '../src/shared/status.js';

export function kst(ms) {
  const n = Number(ms);
  if (!n) return '';
  return new Date(n + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

function addSheet(wb, name, header, rows, widths) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(header);
  rows.forEach((r) => ws.addRow(r));
  const h = ws.getRow(1);
  h.font = { bold: true };
  h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  ws.columns.forEach((col, i) => {
    col.width = widths ? widths[i] || 12 : Math.min(Math.max(String(header[i]).length + 2, 9), 24);
  });
  return ws;
}

const val = (v) => (v === undefined || v === null ? '' : v);

export function filterRows(responses, { kind = '전체', state = '전체' } = {}, now = Date.now()) {
  return deriveStates(responses, now).filter(
    (r) => (kind === '전체' || r.kind === kind) && (state === '전체' || r.state === state)
  );
}

export async function buildWorkbook(data, filter) {
  const rows = filterRows(data.responses || [], filter, data.now);
  const ids = new Set(rows.map((r) => r.id));
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SBCX 실험 플랫폼';
  wb.created = new Date();

  // 1. 응답 (한 줄 = 한 참가자)
  const head = ['id', 'state', 'state_reason', ...RESPONSE_COLUMNS.filter((c) => c !== 'id')];
  addSheet(
    wb,
    '응답',
    head,
    rows.map((r) =>
      head.map((k) => {
        if (k === 'state_reason') return r.reason;
        if (DATE_COLUMNS.includes(k)) return kst(r[k]);
        return val(r[k]);
      })
    )
  );

  // 2. 행동 로그 (한 줄 = 한 이벤트)
  const logs = (data.logs || []).filter((l) => ids.has(l.id)).sort((a, b) => Number(a.at) - Number(b.at));
  addSheet(wb, '행동 로그', LOG_COLUMNS, logs.map((l) => LOG_COLUMNS.map((k) => (k === 'at' ? kst(l.at) : val(l[k])))), [20, 11, 10, 9, 18, 16, 60]);

  // 3. 동의 기록
  const consents = (data.consents || []).filter((c) => ids.has(c.id));
  addSheet(wb, '동의 기록', CONSENT_COLUMNS, consents.map((c) => CONSENT_COLUMNS.map((k) => (k === 'at' ? kst(c.at) : val(c[k])))), [11, 20, 12, 12, 10, 10]);

  // 4. 문항 사전
  const dict = [
    ['state', '—', '관리자 계산', '진행 상태: 진행 중 / 완료 / 중단(30분 넘게 반응 없음) / 제외 후보', '문자', '', ''],
    ['state_reason', '—', '관리자 계산', '제외 후보인 이유: 주의 점검 실패 / 소요 시간이 완료자 중앙값의 1/3 미만', '문자', '', ''],
    ...dictionaryRows()
  ];
  const ws4 = addSheet(wb, '문항 사전', DICTIONARY_HEADER, dict, [16, 22, 22, 60, 36, 12, 34]);
  ws4.getColumn(4).alignment = { wrapText: true, vertical: 'top' };

  // 5. 과업별 긴 형식 (한 줄 = 한 참가자 × 한 과업) — 다층모형용
  const fields = TASK_COLUMNS(1).map((c) => c.replace('task1_', ''));
  const person = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q30', 'q31', 'attn_pass'];
  const items = [...TASK_ITEM_IDS, 29].map((id) => 'q' + id);
  const longHead = ['id', 'kind', 'state', 'group', 'W', 'X2', 'task', 'x1', ...fields, ...items, ...person];
  const longRows = [];
  rows.forEach((r) =>
    [1, 2].forEach((n) => {
      longRows.push([
        r.id,
        r.kind,
        r.state,
        val(r.group),
        val(r.W),
        val(r.X2),
        n,
        val(r[`task${n}_x1`]),
        ...fields.map((f) => val(r[`task${n}_${f}`])),
        ...items.map((q) => val(r[`task${n}_${q}`])),
        ...person.map((p) => val(r[p]))
      ]);
    })
  );
  addSheet(wb, '과업별(긴 형식)', longHead, longRows);

  // 6. 동의문 원문 (버전별)
  addSheet(
    wb,
    '동의문 원문',
    ['version', 'saved_at', 'text'],
    (data.consentTexts || []).map((t) => [val(t.version), kst(t.saved_at), val(t.text)]),
    [14, 20, 100]
  ).getColumn(3).alignment = { wrapText: true, vertical: 'top' };

  return { buffer: await wb.xlsx.writeBuffer(), count: rows.length };
}

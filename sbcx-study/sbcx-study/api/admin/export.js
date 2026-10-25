// GET /api/admin/export?kind=본실험&state=완료 — 엑셀 내려받기
import { route, query } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { callStore } from '../../lib/store.js';
import { buildWorkbook, kst } from '../../lib/export.js';

const KINDS = ['전체', '본실험', '파일럿', '테스트'];
const STATES = ['전체', '진행 중', '완료', '중단', '제외 후보'];

export default route(['GET'], async (req, res) => {
  requireAdmin(req);
  const q = query(req);
  const kind = KINDS.includes(q.get('kind')) ? q.get('kind') : '전체';
  const state = STATES.includes(q.get('state')) ? q.get('state') : '전체';
  const data = await callStore('export_all', {});
  const { buffer } = await buildWorkbook(data, { kind, state });
  const stamp = kst(Date.now()).replace(/[-: ]/g, '').slice(0, 12);
  const name = `sbcx_${kind}_${state}_${stamp}.xlsx`.replace(/\s/g, '');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="sbcx_${stamp}.xlsx"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(Buffer.from(buffer));
});

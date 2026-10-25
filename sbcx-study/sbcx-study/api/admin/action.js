// POST /api/admin/action — 관리 도구
//   {type:'settings', settings:{mode, help_seconds, skip_seconds, scenario_wait, target_per_group}}
//   {type:'kind', id, kind:'본실험'|'파일럿'|'테스트'}
//   {type:'delete_tests'}
import { readJson, send, route, HttpError } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { callStore } from '../../lib/store.js';

export default route(['POST'], async (req, res) => {
  requireAdmin(req);
  const b = await readJson(req);
  let d;
  if (b.type === 'settings') d = await callStore('admin_settings', { settings: b.settings || {} });
  else if (b.type === 'kind') {
    if (!/^P-[A-Z0-9]{6}$/.test(b.id || '')) throw new HttpError(400, '참가자 ID가 올바르지 않아요');
    d = await callStore('admin_kind', { id: b.id, kind: b.kind });
  } else if (b.type === 'delete_tests') d = await callStore('admin_delete_tests', {});
  else throw new HttpError(400, '알 수 없는 관리 작업이에요');
  delete d.ok;
  send(res, 200, { ok: true, ...d });
});

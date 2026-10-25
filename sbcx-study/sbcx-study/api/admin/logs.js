// GET /api/admin/logs?id=P-XXXXXX&limit=500 — 행동 로그 (최근 것부터)
import { send, route, query } from '../../lib/http.js';
import { requireAdmin } from '../../lib/auth.js';
import { callStore } from '../../lib/store.js';

export default route(['GET'], async (req, res) => {
  requireAdmin(req);
  const q = query(req);
  const id = /^P-[A-Z0-9]{6}$/.test(q.get('id') || '') ? q.get('id') : '';
  const limit = Math.min(Number(q.get('limit')) || 500, 5000);
  const d = await callStore('admin_logs', { id, limit });
  send(res, 200, { ok: true, logs: d.logs });
});

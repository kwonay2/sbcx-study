// POST /api/admin/logout
import { send, route } from '../../lib/http.js';
import { clearSession } from '../../lib/auth.js';

export default route(['POST'], async (req, res) => {
  clearSession(res);
  send(res, 200, { ok: true });
});

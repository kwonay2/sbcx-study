// POST /api/admin/login {password}
import { readJson, send, route, HttpError } from '../../lib/http.js';
import { checkPassword, setSession, passwordConfigured } from '../../lib/auth.js';

export default route(['POST'], async (req, res) => {
  if (!passwordConfigured()) throw new HttpError(500, 'ADMIN_PASSWORD 환경 변수가 설정되지 않았어요');
  const b = await readJson(req);
  if (!checkPassword(b.password)) {
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError(401, '비밀번호가 맞지 않아요');
  }
  setSession(res);
  send(res, 200, { ok: true });
});

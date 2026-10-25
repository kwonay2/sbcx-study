// POST /api/phone — 추첨용 휴대전화 번호. 응답과 다른 파일에, 참가자 ID 없이 저장한다.
import { readJson, send, route, HttpError } from '../lib/http.js';
import { callStore } from '../lib/store.js';

export default route(['POST'], async (req, res) => {
  const b = await readJson(req);
  const phone = String(b.phone || '').replace(/[^0-9]/g, '');
  if (!/^P-[A-Z0-9]{6}$/.test(b.id || '')) throw new HttpError(400, '참가자 ID가 올바르지 않아요');
  if (!/^01[0-9]{8,9}$/.test(phone)) throw new HttpError(400, '휴대전화 번호 형식이 맞지 않아요');
  await callStore('phone', { id: b.id, phone });
  send(res, 200, { ok: true });
});

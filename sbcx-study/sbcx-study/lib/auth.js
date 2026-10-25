// 관리자 로그인: 비밀번호(ADMIN_PASSWORD)를 맞히면 12시간짜리 서명 쿠키를 준다.
import crypto from 'node:crypto';
import { HttpError } from './http.js';

const COOKIE = 'sbcx_admin';
const TTL_MS = 12 * 60 * 60 * 1000;
export const LOCAL_PASSWORD = 'sbcx-local';

function key() {
  return (
    process.env.SESSION_SECRET ||
    'sbcx|' + (process.env.ADMIN_PASSWORD || LOCAL_PASSWORD) + '|' + (process.env.APPS_SCRIPT_SECRET || '')
  );
}
function sign(s) {
  return crypto.createHmac('sha256', key()).update(s).digest('base64url');
}
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

export function passwordConfigured() {
  return !!process.env.ADMIN_PASSWORD || !process.env.VERCEL;
}

export function checkPassword(pw) {
  const expected = process.env.ADMIN_PASSWORD || (process.env.VERCEL ? null : LOCAL_PASSWORD);
  if (!expected) return false;
  return same(pw || '', expected);
}

export function setSession(res) {
  const exp = String(Date.now() + TTL_MS);
  const token = exp + '.' + sign(exp);
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_MS / 1000}${secure}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

export function isAdmin(req) {
  const raw = req.headers.cookie || '';
  const m = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE + '='));
  if (!m) return false;
  const [exp, sig] = m.slice(COOKIE.length + 1).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return same(sign(exp), sig);
}

export function requireAdmin(req) {
  if (!isAdmin(req)) throw new HttpError(401, '로그인이 필요해요');
}

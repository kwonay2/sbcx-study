// Vercel 함수와 로컬 개발 서버에서 똑같이 쓰는 요청·응답 도우미

export async function readJson(req) {
  const b = req.body;
  if (b !== undefined && b !== null && !(typeof b === 'string' && b === '')) {
    if (typeof b === 'string') return JSON.parse(b);
    if (Buffer.isBuffer(b)) return JSON.parse(b.toString('utf8') || '{}');
    return b;
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 2_000_000) throw new HttpError(413, '요청이 너무 커요');
    chunks.push(c);
  }
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}

export function query(req) {
  return new URL(req.url || '/', 'http://localhost').searchParams;
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 핸들러를 감싸서 메서드 확인과 오류 응답을 한곳에서 처리
export function route(methods, fn) {
  return async function handler(req, res) {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, '허용되지 않은 요청이에요');
      await fn(req, res);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error('[api]', e);
      if (!res.headersSent) send(res, status, { ok: false, error: e.message || '서버 오류' });
    }
  };
}

export function clip(v, n) {
  return typeof v === 'string' ? v.slice(0, n) : '';
}

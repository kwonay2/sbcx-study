// 저장소 호출: APPS_SCRIPT_URL이 있으면 구글 Apps Script 웹 앱으로,
// 없으면(로컬 개발) 같은 Code.gs를 Node에서 돌려 .data/local-sheets.json에 저장한다.
import { HttpError } from './http.js';

const MESSAGES = {
  unauthorized: 'Apps Script 비밀 키(APPS_SCRIPT_SECRET)가 맞지 않아요',
  unknown_id: '참가자 ID를 찾지 못했어요',
  bad_phone: '휴대전화 번호 형식이 맞지 않아요',
  bad_kind: '구분 값이 맞지 않아요',
  unknown_action: '알 수 없는 요청이에요'
};

function fail(code) {
  const status = code === 'unknown_id' ? 404 : code === 'bad_phone' || code === 'bad_kind' ? 400 : 502;
  return new HttpError(status, MESSAGES[code] || code || '저장소 오류');
}

async function callAppsScript(url, action, payload) {
  const body = JSON.stringify({ ...payload, action, secret: process.env.APPS_SCRIPT_SECRET || '' });
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow'
      });
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new HttpError(
          502,
          'Apps Script가 JSON이 아닌 응답을 보냈어요. 웹 앱 배포의 액세스 권한이 “모든 사용자”인지 확인해 주세요.'
        );
      }
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError) throw e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new HttpError(502, '구글 시트에 연결하지 못했어요: ' + (lastErr && lastErr.message));
}

export async function callStore(action, payload = {}) {
  const url = process.env.APPS_SCRIPT_URL;
  let data;
  if (url) {
    data = await callAppsScript(url, action, payload);
  } else {
    if (process.env.VERCEL) throw new HttpError(500, 'APPS_SCRIPT_URL 환경 변수가 설정되지 않았어요');
    const { callLocal } = await import('./gas-local.js');
    data = callLocal(action, payload);
  }
  if (!data || !data.ok) throw fail(data && data.error);
  return data;
}

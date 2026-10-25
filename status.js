// 관리자 화면과 엑셀 내보내기가 같은 기준으로 상태를 계산하도록 한곳에 둔다.
import { ACTIVE_MS } from './config.js';

export const STATES = ['진행 중', '완료', '중단', '제외 후보'];

function median(xs) {
  if (!xs.length) return null;
  const a = xs.slice().sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// rows: 응답 시트의 행 (날짜는 ms 숫자). 반환: state(진행 중/완료/중단/제외 후보)와 reason이 붙은 행
export function deriveStates(rows, now = Date.now()) {
  const byKind = {};
  rows.forEach((r) => {
    if (r.status === '완료' && Number(r.duration_s) > 0) (byKind[r.kind] = byKind[r.kind] || []).push(Number(r.duration_s));
  });
  const med = {};
  Object.keys(byKind).forEach((k) => {
    med[k] = byKind[k].length >= 5 ? median(byKind[k]) : null; // 완료자가 5명 이상일 때만 '빠름' 판정
  });
  return rows.map((r) => {
    let state;
    const reasons = [];
    if (r.status === '완료') {
      if (String(r.attn_pass) === '0') reasons.push('주의 점검 실패');
      const m = med[r.kind];
      if (m && Number(r.duration_s) > 0 && Number(r.duration_s) < m / 3) reasons.push('소요 시간이 중앙값의 1/3 미만');
      state = reasons.length ? '제외 후보' : '완료';
    } else {
      const last = Number(r.last_at) || Number(r.started_at) || 0;
      state = now - last > ACTIVE_MS ? '중단' : '진행 중';
    }
    return { ...r, state, reason: reasons.join(', ') };
  });
}

export function isComplete(r) {
  return r.state === '완료' || r.state === '제외 후보';
}

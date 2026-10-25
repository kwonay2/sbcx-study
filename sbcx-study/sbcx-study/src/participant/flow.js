// 참가자 한 명의 화면 순서 (계획서 8절 화면 명세)
// 문항 화면은 변수당 한 화면, 화면 안 문항 순서는 참가자마다 섞는다.

export function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const T1_CONTEXT = '왼쪽은 방금 추천을 바꾼 화면이에요. 이 과정에 대해 답해 주세요.';
const T2_CONTEXT = '왼쪽은 방금 본 바뀐 추천이에요.';

export function buildFlow() {
  const f = [];
  f.push({ kind: 'consent', id: 'S1', name: '시작·동의', sec: '시작' });
  f.push({ kind: 'q', id: 'S2-1', name: '사전 설문 · 기본 정보', sec: '사전 설문 · 1 / 2', title: '먼저 몇 가지만 여쭤볼게요', items: [1, 2, 3] });
  f.push({ kind: 'q', id: 'S2-2', name: '사전 설문 · 상품관여도', sec: '사전 설문 · 2 / 2', lead: '“나에게 옷(의류)은”', sub: '두 말 중 더 가까운 쪽을 골라 주세요.', items: shuffle([4, 5, 6]) });
  f.push({ kind: 'intro', id: 'S3', name: '상황 안내', sec: '상황 안내' });
  f.push({ kind: 'scenario', id: 'S4', name: '시나리오 카드', sec: '상황' });
  f.push({ kind: 'q', id: 'S5', name: 'W 조작점검', sec: '상황 · 질문', items: [7] });
  for (let t = 0; t < 2; t++) {
    const n = t + 1;
    if (t === 1) f.push({ kind: 'scenario2', id: 'S11', task: t, name: '두 번째 과업 안내', sec: '과업 2 / 2 · 안내' });
    f.push({ kind: 'taskIntro', id: 'S6', task: t, name: `과업 ${n} 안내`, sec: `과업 ${n} / 2 · 안내` });
    f.push({ kind: 'task', id: 'S7', task: t, name: `과업 ${n} 추천 화면`, sec: `과업 ${n} / 2 · 진행 중` });
    f.push({ kind: 'q', id: 'T1-M1', task: t, lock: true, name: `과업 ${n} ▼T1 M1`, sec: `과업 ${n} · 화면 1 / 6`, context: T1_CONTEXT, items: shuffle([8, 9, 10]) });
    f.push({ kind: 'q', id: 'T1-M2', task: t, lock: true, name: `과업 ${n} ▼T1 M2`, sec: `과업 ${n} · 화면 2 / 6`, context: T1_CONTEXT, items: shuffle([11, 12, 13]) });
    f.push({ kind: 'result', id: 'S9', task: t, name: `과업 ${n} 바뀐 결과`, sec: `과업 ${n} / 2 · 결과 확인` });
    f.push({ kind: 'q', id: 'T2-Y3', task: t, lock: true, name: `과업 ${n} ▼T2 Y3`, sec: `과업 ${n} · 화면 3 / 6`, context: T2_CONTEXT, items: shuffle([14, 15, 16]) });
    // 주의 점검(29)은 과업 2의 ▼T2 중간에 한 번만
    f.push({ kind: 'q', id: 'T2-Y1', task: t, lock: true, name: `과업 ${n} ▼T2 Y1`, sec: `과업 ${n} · 화면 4 / 6`, context: T2_CONTEXT, items: shuffle(t === 1 ? [17, 18, 19, 29] : [17, 18, 19]) });
    f.push({ kind: 'q', id: 'T2-Y2', task: t, lock: true, name: `과업 ${n} ▼T2 Y2·만족`, sec: `과업 ${n} · 화면 5 / 6`, context: T2_CONTEXT, items: shuffle([20, 21, 22]).concat([23]) });
    f.push({ kind: 'q', id: 'X-CHK', task: t, name: `과업 ${n} 조작점검`, sec: `과업 ${n} · 화면 6 / 6`, context: '방금 한 과업을 떠올리며 답해 주세요.', items: [24, 25, 26, 27, 28] });
  }
  f.push({ kind: 'q', id: 'S12', name: '두 과업 끝 질문', sec: '마지막 질문', items: [30, 31] });
  f.push({ kind: 'debrief', id: "S12'", name: '디브리핑', sec: '연구 안내' });
  f.push({ kind: 'done', id: 'S13', name: '완료·추첨 안내', sec: '완료' });
  f.push({ kind: 'thanks', id: 'END', name: '종료', sec: '완료' });
  return f;
}

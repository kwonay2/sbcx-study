// ─────────────────────────────────────────────────────────────
// 연구팀이 직접 고치는 문구·설정은 이 파일에 모았어요.
// 동의 문구를 고치면 CONSENT_VERSION도 함께 올려 주세요(v1 → v2).
// 버전별 원문은 구글 시트 '동의문 원문' 탭에 자동으로 보관돼요.
// ─────────────────────────────────────────────────────────────

export const STUDY = {
  title: '쇼핑앱 AI 추천 경험 연구',
  meta: '약 15분 · PC나 노트북으로 참여해 주세요',
  intro:
    '쇼핑앱에서 AI 추천을 볼 때의 경험을 알아보는 연구예요. 가상의 쇼핑앱 화면을 직접 눌러 보고, 그때 느낀 점에 답하게 됩니다. 정답은 없어요. 이름은 받지 않아요.',
  contact: '[연구팀 연락처]',
  reward:
    '완료하신 분 중 추첨으로 20명에게 네이버페이 1만 원을 드려요. 주의 점검 문항에 맞게 답하지 않았거나 중복으로 참여한 경우는 추첨에서 빠지고, 당첨되신 분께는 문자로 보내 드려요.',
  debrief: [
    '이번 실험의 쇼핑앱 ‘모아’와 A~F사 브랜드·상품은 모두 연구용으로 만든 가상입니다. 상황도 가상 시나리오였습니다.',
    '이 연구는 추천을 바꾸는 기능의 종류와 위치가 통제감과 추천 의도 판단에 어떤 영향을 주는지 알아보려는 것입니다.'
  ]
};

export const CONSENT_VERSION = 'v1-초안';

export const CONSENT_ITEMS = [
  {
    key: 'participate',
    required: true,
    title: '연구 참여에 동의합니다',
    desc: '언제든 그만둘 수 있고, 그만두어도 불이익이 없어요.'
  },
  {
    key: 'data',
    required: true,
    title: '응답 수집에 동의합니다',
    desc: '응답과 화면 사용 기록(누른 버튼·걸린 시간)은 익명 ID로만 저장되고 연구 분석에만 쓰여요.'
  },
  {
    key: 'phone',
    required: false,
    title: '추첨용 휴대전화 번호 수집·이용에 동의합니다',
    desc: '목적: 보상 추첨·발송 / 보관: 발송 후 즉시 파기 / 거부해도 참여할 수 있지만 추첨에서 빠져요.'
  }
];

export function consentFullText() {
  const lines = [STUDY.title, STUDY.meta, '', STUDY.intro, ''];
  CONSENT_ITEMS.forEach((c) => lines.push(`[${c.required ? '필수' : '선택'}] ${c.title} — ${c.desc}`));
  return lines.join('\n');
}

// 관리자 화면 '관리 도구'에서 바꾸면 구글 시트 '설정' 탭 값이 우선해요.
export const DEFAULT_SETTINGS = {
  mode: '본실험', // 본실험 | 파일럿
  help_seconds: 90, // 혼자 찾기 제한 시간 → 지나면 위치 안내
  skip_seconds: 180, // 안내 뒤 이 시간이 지나면 [건너뛰기]
  scenario_wait: 10, // 상황 카드 최소 체류 시간
  target_per_group: 45
};

export const MIN_WIDTH = 1280; // 이보다 좁은 창이면 키워 달라는 안내
export const ACTIVE_MS = 30 * 60 * 1000; // 30분 넘게 반응이 없으면 '중단'

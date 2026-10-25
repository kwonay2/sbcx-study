// 왼쪽 휴대폰 프레임 안의 가상 쇼핑앱 '모아'
// ★칸(조건마다 다른 부분)만 C1~C4에 따라 바뀌고, 나머지 화면·문구는 모두 같다.
import { FIRST, DEF, DIMS, SHADE, sweaterPath, hemPath, won } from '../shared/products.js';

function Sweater({ p, size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d={sweaterPath(p.len)} fill={SHADE[p.color] || '#B0B2B6'} stroke="#6B7280" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={hemPath(p.len)} fill="none" stroke="#6B7280" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}

function Chips({ T, onPick, highlight }) {
  return (
    <div className={'m-conds' + (highlight ? ' m-hl' : '')}>
      <span className="m-conds-title">AI가 추천에 쓰는 조건</span>
      {DIMS.map((dm) => (
        <div className="m-dim" key={dm.key}>
          <span className="m-dim-label">{dm.label}</span>
          <div className="m-chips">
            {dm.opts.map((v) => {
              const on = T.conds[dm.key] === v;
              return (
                <button type="button" key={v} className={'m-chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onPick(dm.key, v)}>
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Standby() {
  return (
    <div className="m-standby">
      <span className="m-logo-lg">모아</span>
    </div>
  );
}

function Home({ T, X2, live, h }) {
  const direct = X2 === '직접 노출';
  const dec = T.x1 === '결정';
  const res = T.mode === 'result' && !!T.results;
  const showRes = res && !T.showOrig;
  const highlight = live && T.helpMs != null && !T.found;
  const first = FIRST[T.set];
  const list = showRes ? T.results : first.map((p) => ({ ...p, isNew: false }));
  const tags = showRes && !dec ? T.conds : DEF;

  let cta = null;
  if (res) cta = { label: '완료', onClick: h.complete };
  else if (direct) cta = { label: dec ? '제외한 상품 빼고 다시 추천받기' : '이 조건으로 다시 추천받기', onClick: h.rerec };

  return (
    <div className="m-screen">
      <header className="m-bar">
        <span className="m-logo">모아</span>
        <div className="m-icons" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 13H7L6 7z" />
            <path d="M9 7a3 3 0 0 1 6 0" />
          </svg>
        </div>
      </header>
      <nav className="m-tabs" aria-hidden="true">
        <span className="on">홈</span>
        <span>랭킹</span>
        <span>세일</span>
        <span>브랜드</span>
      </nav>
      <div className="m-scroll">
        <div className="m-title">
          <h2>회원님의 이용 기록 기반 AI 추천</h2>
          <span>AI 맞춤 추천 · AI가 니트를 골라봤어요</span>
        </div>

        {!direct && !res && (
          <button type="button" className={'m-banner' + (highlight ? ' m-hl' : '')} onClick={h.openSettings}>
            <span>추천이 마음에 들지 않으면 바꿀 수 있어요</span>
            <strong>추천 설정 ›</strong>
          </button>
        )}

        {res && (
          <div className="m-notice" role="status">
            <strong>{T.showOrig ? '처음 추천을 보고 있어요' : '변경한 내용으로 다시 추천했어요'}</strong>
            <button type="button" onClick={h.toggleOrig}>
              {T.showOrig ? '바뀐 추천 다시 보기' : '처음 추천으로 되돌리기'}
            </button>
          </div>
        )}

        <div className="m-reason">
          <strong>AI가 고려한 점</strong>
          <span>최근 검색하고 본 상품, 비슷한 고객이 산 상품, 요즘 계절(가을·겨울)을 참고했어요.</span>
          <div className="m-reason-tags">
            <span>#{tags.fit}</span>
            <span>#{tags.mat}</span>
            <span>#{tags.len}</span>
          </div>
        </div>

        {direct && dec && !res && <span className="m-line">추천이 마음에 들지 않으면 바꿀 수 있어요</span>}
        {direct && !dec && !res && (
          <div className="m-stack8">
            <span className="m-line">추천이 마음에 들지 않으면 바꿀 수 있어요</span>
            <Chips T={T} onPick={h.pickCond} highlight={highlight} />
          </div>
        )}

        <div className="m-list">
          {list.map((p, i) => {
            const offP = !res && T.exclP[i];
            const offB = !res && T.exclB[i];
            const off = offP || offB;
            return (
              <div className="m-card" key={p.brand + p.name}>
                <div className="m-card-main" style={{ opacity: off ? 0.45 : 1 }}>
                  <div className="m-thumb">
                    <Sweater p={p} />
                  </div>
                  <div className="m-info">
                    <div className="m-brandrow">
                      <span className="m-brand">{p.brand}</span>
                      {showRes && p.isNew && <span className="m-badge">새 추천</span>}
                      {off && <span className="m-badge dark">제외 선택됨</span>}
                    </div>
                    <span className="m-name">
                      {p.name} · {p.color}
                    </span>
                    <span className="m-price">{won(p.price)}</span>
                    <span className="m-tags">
                      {p.fit} · {p.mat} · {p.len}
                    </span>
                  </div>
                </div>
                {direct && dec && !res && (
                  <div className={'m-excl' + (highlight ? ' m-hl' : '')}>
                    <button type="button" className={offP ? 'on' : ''} aria-pressed={offP} onClick={() => h.togExcl('p', i)}>
                      {offP ? '상품 제외 취소' : '이 상품 제외'}
                    </button>
                    <button type="button" className={offB ? 'on' : ''} aria-pressed={offB} onClick={() => h.togExcl('b', i)}>
                      {offB ? `${p.brand} 제외 취소` : '이 브랜드 제외'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {cta && (
        <div className="m-cta">
          <button type="button" onClick={cta.onClick}>
            {cta.label}
          </button>
        </div>
      )}
    </div>
  );
}

function Settings({ T, h }) {
  const dec = T.x1 === '결정';
  const first = FIRST[T.set];
  return (
    <div className="m-screen">
      <header className="m-bar m-bar-back">
        <button type="button" className="m-back" aria-label="뒤로" onClick={h.closeSettings}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="m-bar-title">추천 설정</span>
      </header>
      <div className="m-scroll">
        {dec ? (
          <div>
            <span className="m-section">추천 결과에서 제외</span>
            {first.map((p, i) => (
              <div className="m-excl-row" key={p.brand}>
                <div className="m-thumb sm">
                  <Sweater p={p} size={46} />
                </div>
                <div className="m-excl-body">
                  <span className="m-name">
                    {p.brand} · {p.name} · {p.color}
                  </span>
                  <label>
                    <input type="checkbox" checked={T.exclP[i]} onChange={() => h.togExcl('p', i)} />이 상품 제외
                  </label>
                  <label>
                    <input type="checkbox" checked={T.exclB[i]} onChange={() => h.togExcl('b', i)} />
                    {p.brand} 브랜드 제외
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Chips T={T} onPick={h.pickCond} highlight={false} />
        )}
      </div>
      <div className="m-cta">
        <button type="button" onClick={h.rerec}>
          저장하고 다시 추천받기
        </button>
      </div>
    </div>
  );
}

export default function PhoneApp({ scale, view, T, X2, live, locked, toast, h }) {
  const w = Math.round(414 * scale);
  const hgt = Math.round(868 * scale);
  return (
    <div className="phone-wrap" style={{ width: w, height: hgt }}>
      <div className="phone" style={{ transform: `scale(${scale})` }}>
        <div className="phone-screen">
          {view === 'standby' && <Standby />}
          {view === 'home' && <Home T={T} X2={X2} live={live} h={h} />}
          {view === 'settings' && <Settings T={T} h={h} />}
          {toast && (
            <div className="m-toast" role="status">
              {toast}
            </div>
          )}
          {locked && (
            <div className="m-lock">
              <span>질문에 답하는 동안 화면은 잠겨요</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

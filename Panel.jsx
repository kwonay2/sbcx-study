// 오른쪽 연구 패널: 진행 단계 · 과업 지시 · 질문
import { ITEMS, L7 } from '../shared/items.js';
import { STUDY, CONSENT_ITEMS } from '../shared/config.js';
import { keyOf, ageOk } from './logic.js';

const TASK_TEXT =
  '앱이 추천한 니트가 내 취향과 달라서 마음에 들지 않아요. 추천을 마음에 드는 쪽으로 바꿔 보세요. 다 됐으면 [완료]를 누르세요.';

const W_FIRST = {
  목적형: '이번 주말에 입을 회색 니트를 사려고 해요. 살 품목과 색은 이미 정해져 있어요.',
  탐색형: '딱히 정한 건 없지만 날이 추워져서, 가을·겨울 옷을 둘러보고 싶어요.'
};
const W_COMMON = '그래서 평소 자주 쓰는 쇼핑앱 ‘모아’를 열었어요. 자주 써서 그동안 검색하고 본 기록이 남아 있어요.';

export function PanelHead({ sec, pct }) {
  return (
    <div className="p-head">
      <span className="p-pill">연구 패널</span>
      <span className="p-sec">{sec}</span>
      <div className="p-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="진행률">
        <div style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

function Primary({ children, disabled, onClick, busy }) {
  return (
    <button type="button" className="btn-primary" disabled={disabled || busy} onClick={onClick}>
      {busy ? '잠시만요…' : children}
    </button>
  );
}

export function Consent({ consent, setConsent, onStart, busy, error }) {
  const ok = consent.participate && consent.data;
  return (
    <div className="p-stack24">
      <div className="p-stack8">
        <h1 className="p-h1">{STUDY.title}</h1>
        <span className="p-meta">{STUDY.meta}</span>
      </div>
      <p className="p-body">{STUDY.intro}</p>
      <div className="p-stack10">
        {CONSENT_ITEMS.map((c) => (
          <label key={c.key} className={'p-consent' + (consent[c.key] ? ' on' : '')}>
            <input type="checkbox" checked={!!consent[c.key]} onChange={() => setConsent({ ...consent, [c.key]: !consent[c.key] })} />
            <span className="p-stack4">
              <span className="p-consent-title">
                {c.title} <span className={c.required ? 'req' : 'opt'}>({c.required ? '필수' : '선택'})</span>
              </span>
              <span className="p-consent-desc">{c.desc}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <div className="p-error" role="alert">
          {error}
        </div>
      )}
      <div className="p-actions">
        <Primary disabled={!ok} busy={busy} onClick={onStart}>
          동의하고 시작
        </Primary>
        <span className="p-hint">필수 항목 두 가지에 동의하면 시작할 수 있어요</span>
      </div>
    </div>
  );
}

function Scale({ item, value, onPick }) {
  const an = item.a || L7;
  return (
    <>
      <div className="p-scale">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <button
            type="button"
            key={n}
            className={value === n ? 'on' : ''}
            aria-pressed={value === n}
            aria-label={`${n}점${n === 1 ? ', ' + an[0] : n === 7 ? ', ' + an[1] : ''}`}
            onClick={() => onPick(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="p-anchors">
        <span>{an[0]}</span>
        <span>{an[1]}</span>
      </div>
    </>
  );
}

export function Questions({ s, pg, T, onAnswer, onNext, complete }) {
  let context = pg.context || '';
  if (T && T.skipped && pg.lock) context = '왼쪽은 처음 추천 화면이에요.';
  return (
    <div className="p-stack28">
      {context && <div className="p-context">{context}</div>}
      {pg.title && <h1 className="p-h2">{pg.title}</h1>}
      {pg.lead && (
        <div className="p-stack6">
          <span className="p-lead">{pg.lead}</span>
          <span className="p-hint">{pg.sub}</span>
        </div>
      )}
      <div className="p-items">
        {pg.items.map((id) => {
          const it = ITEMS[id];
          const key = keyOf(pg, id);
          const a = s.answers[key];
          const v = a ? a.v : null;
          return (
            <fieldset key={key} className="p-item">
              <legend>{it.q}</legend>
              {it.type === 'l7' && <Scale item={it} value={v} onPick={(n) => onAnswer(key, n)} />}
              {it.type === 'choice' && (
                <div className="p-choices">
                  {it.opts.map((o, k) => (
                    <button type="button" key={o} className={v === k + 1 ? 'on' : ''} aria-pressed={v === k + 1} onClick={() => onAnswer(key, k + 1)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {it.type === 'number' && (
                <>
                  <div className="p-number">
                    <input
                      type="text"
                      inputMode="numeric"
                      aria-label={it.q}
                      placeholder="예: 24"
                      value={v == null ? '' : String(v)}
                      onChange={(e) => onAnswer(key, e.target.value.replace(/[^0-9]/g, '').slice(0, 3), false)}
                    />
                    <span>세</span>
                  </div>
                  {v !== null && v !== '' && !ageOk(v) && (
                    <span className="p-field-error">{Number(v) < 19 ? '이 연구는 만 19세 이상 성인만 참여할 수 있어요.' : '나이를 다시 확인해 주세요.'}</span>
                  )}
                </>
              )}
            </fieldset>
          );
        })}
      </div>
      <div className="p-actions">
        <Primary disabled={!complete} onClick={onNext}>
          다음
        </Primary>
        {!complete && <span className="p-hint">모든 문항에 답하면 [다음]이 켜져요</span>}
      </div>
    </div>
  );
}

export function Intro({ onNext }) {
  return (
    <div className="p-stack28">
      <p className="p-big">지금부터 한 가지 상황을 상상해 주세요. 그 상황 속 쇼핑앱 화면을 직접 눌러 보게 됩니다. 정답은 없습니다.</p>
      <div>
        <Primary onClick={onNext}>다음</Primary>
      </div>
    </div>
  );
}

export function Scenario({ W, second, remain, onNext }) {
  return (
    <div className="p-stack18">
      <div className="p-card">
        <span className="p-card-tag">상황</span>
        <p>
          {W_FIRST[W]} {W_COMMON}
        </p>
      </div>
      <span className="p-hint">이 상황 속의 나라고 생각해 주세요.</span>
      {second && <p className="p-big2">같은 상황에서 다른 날 다시 ‘모아’를 열었다고 생각해 주세요. 이번에는 화면이 조금 다릅니다.</p>}
      <div className="p-actions">
        <Primary disabled={remain > 0} onClick={onNext}>
          다음
        </Primary>
        {remain > 0 && <span className="p-hint">{remain}초 뒤에 [다음]이 켜져요</span>}
      </div>
    </div>
  );
}

export function TaskIntro({ onNext }) {
  return (
    <div className="p-stack22">
      <span className="p-label">과업</span>
      <p className="p-big">{TASK_TEXT}</p>
      <span className="p-hint">[시작]을 누르면 왼쪽 앱이 열려요.</span>
      <div>
        <Primary onClick={onNext}>시작</Primary>
      </div>
    </div>
  );
}

export function TaskPanel({ help, helpText, canSkip, onSkip, result }) {
  return (
    <div className="p-stack22">
      <span className="p-label">과업</span>
      <p className="p-big">{TASK_TEXT}</p>
      <ul className="p-bullets">
        <li>왼쪽 앱만 누를 수 있어요</li>
        <li>[완료]는 추천을 바꾼 뒤 앱 안에 나타나요</li>
        <li>질문은 바꾼 뒤 이 자리에 나와요</li>
      </ul>
      {help && (
        <div className="p-help" role="status">
          <span>도움말</span>
          <p>{helpText}</p>
        </div>
      )}
      {canSkip && (
        <div className="p-skip">
          <span>바꾸기 어렵다면 이 과업은 건너뛰고 다음으로 넘어가도 괜찮아요.</span>
          <div>
            <button type="button" className="btn-secondary" onClick={onSkip}>
              건너뛰기
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="p-info" role="status">
          추천이 바뀌었어요. 결과를 확인한 뒤 앱 아래 [완료]를 누르세요.
        </div>
      )}
    </div>
  );
}

export function Debrief({ onNext }) {
  return (
    <div className="p-stack20">
      <h1 className="p-h2">연구 안내</h1>
      {STUDY.debrief.map((t) => (
        <p className="p-body" key={t}>
          {t}
        </p>
      ))}
      <span className="p-hint">문의: {STUDY.contact}</span>
      <div>
        <Primary onClick={onNext}>다음</Primary>
      </div>
    </div>
  );
}

export function Done({ canPhone, phone, setPhone, onSubmit, onSkip, busy, error }) {
  const valid = /^01[0-9]{8,9}$/.test(phone);
  const showFormatErr = phone.length >= 10 && !valid;
  return (
    <div className="p-stack20">
      <h1 className="p-h2">참여해 주셔서 감사합니다</h1>
      <div className="p-reward">{STUDY.reward}</div>
      {canPhone ? (
        <div className="p-stack8">
          <label htmlFor="raffle-phone" className="p-label-strong">
            추첨용 휴대전화 번호
          </label>
          <input
            id="raffle-phone"
            className={'p-phone' + (showFormatErr ? ' err' : '')}
            type="tel"
            autoComplete="tel"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
          />
          <span className="p-hint">이름 없이 번호만 받아요. 응답과 다른 표에 저장하고, 발송이 끝나면 지워요.</span>
          {showFormatErr && <span className="p-field-error">번호 형식을 확인해 주세요. (예: 01012345678)</span>}
        </div>
      ) : (
        <p className="p-body">휴대전화 번호 수집에 동의하지 않으셔서 이번 추첨 대상에서는 빠져요.</p>
      )}
      {error && (
        <div className="p-error" role="alert">
          {error}
        </div>
      )}
      <div className="p-actions">
        {canPhone ? (
          <>
            <Primary disabled={!valid} busy={busy} onClick={onSubmit}>
              제출하고 마치기
            </Primary>
            <button type="button" className="btn-secondary lg" disabled={busy} onClick={onSkip}>
              번호 없이 마치기
            </button>
          </>
        ) : (
          <Primary busy={busy} onClick={onSkip}>
            마치기
          </Primary>
        )}
      </div>
    </div>
  );
}

export function Thanks({ saved, failed, onRetry }) {
  return (
    <div className="p-stack14">
      <h1 className="p-h2">{saved ? '응답이 모두 저장되었어요' : '응답을 저장하고 있어요'}</h1>
      {saved && <p className="p-body">참여해 주셔서 감사합니다. 이제 이 창을 닫으셔도 돼요.</p>}
      {!saved && !failed && <p className="p-body">잠시만 기다려 주세요. 저장이 끝나기 전에 창을 닫지 말아 주세요.</p>}
      {!saved && failed && (
        <div className="p-stack14">
          <div className="p-error" role="alert">
            인터넷 연결이 불안정해서 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요. 지금까지의 응답은 이 브라우저에 안전하게 남아 있어요.
          </div>
          <div>
            <Primary onClick={onRetry}>다시 저장하기</Primary>
          </div>
        </div>
      )}
    </div>
  );
}

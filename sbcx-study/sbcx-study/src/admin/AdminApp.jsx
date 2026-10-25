import { useCallback, useEffect, useMemo, useState } from 'react';
import { deriveStates, isComplete, STATES } from '../shared/status.js';
import { GROUPS, DICTIONARY_HEADER, dictionaryRows } from '../shared/schema.js';
import { DEFAULT_SETTINGS } from '../shared/config.js';

const KINDS = ['본실험', '파일럿', '테스트'];
const EVENT_LABEL = {
  consent: '동의',
  assign: '배정',
  screen: '화면 진입',
  answer: '응답',
  found: '기능 발견',
  settings_in: '설정 화면 진입',
  settings_out: '설정 화면 나감',
  excl_product: '상품 제외',
  excl_brand: '브랜드 제외',
  condition: '조건 변경',
  rerec: '다시 추천받기',
  rerec_empty: '변경 없이 누름',
  help: '위치 안내 표시',
  skip: '건너뛰기 (미사용)',
  revert: '처음 추천 보기',
  unrevert: '바뀐 추천 보기',
  complete: '완료',
  hidden: '창 숨김',
  visible: '창 복귀',
  resume: '이어서 진행',
  phone: '추첨 번호'
};
const STATE_CLASS = { '진행 중': 'st-run', 완료: 'st-done', 중단: 'st-stop', '제외 후보': 'st-ex' };
const DAY = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n) => String(n).padStart(2, '0');
function kstParts(ms) {
  const d = new Date(Number(ms) + 9 * 3600 * 1000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), w: d.getUTCDay() };
}
function fmtTime(ms) {
  if (!ms) return '—';
  const p = kstParts(ms);
  return `${pad(p.m)}/${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}`;
}
function fmtClock(ms) {
  if (!ms) return '—';
  const p = kstParts(ms);
  return `${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`;
}
function fmtDur(sec) {
  const s = Number(sec);
  if (!s) return '—';
  return `${Math.floor(s / 60)}분 ${pad(Math.round(s % 60))}초`;
}
function dayKey(ms) {
  const p = kstParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...opts });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data || !data.ok) {
    const e = new Error((data && data.error) || `서버 오류 (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}
const post = (url, body) => api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export default function AdminApp() {
  const [auth, setAuth] = useState('checking');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');
  const [logsId, setLogsId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const d = await api('/api/admin/data');
      setData(d);
      setAuth('in');
    } catch (e) {
      if (e.status === 401) setAuth('login');
      else {
        setErr(e.message);
        setAuth((a) => (a === 'checking' ? 'error' : a));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (auth !== 'in') return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && (tab === 'overview' || tab === 'list')) load();
    }, 60000);
    return () => clearInterval(t);
  }, [auth, tab, load]);

  if (auth === 'checking') return <div className="a-center">불러오는 중…</div>;
  if (auth === 'login') return <Login onDone={load} />;
  if (auth === 'error')
    return (
      <div className="a-center">
        <div className="a-error">{err}</div>
        <button type="button" className="a-btn" onClick={load}>
          다시 시도
        </button>
      </div>
    );

  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const rows = deriveStates(data.responses || [], data.now);

  const openLogs = (id) => {
    setLogsId(id);
    setTab('logs');
  };

  return (
    <div className="a-page">
      <header className="a-header">
        <div className="a-title">
          <span className="a-kicker">연구팀 전용</span>
          <h1>SBCX 실험 관리</h1>
        </div>
        <div className="a-header-right">
          <span className={'a-mode ' + (settings.mode === '파일럿' ? 'pilot' : '')}>지금 모드: {settings.mode}</span>
          <span className="a-muted">갱신 {fmtClock(data.now)}</span>
          <button type="button" className="a-btn" onClick={load} disabled={loading}>
            {loading ? '불러오는 중…' : '새로고침'}
          </button>
          <button
            type="button"
            className="a-btn ghost"
            onClick={async () => {
              await post('/api/admin/logout', {}).catch(() => {});
              setAuth('login');
            }}
          >
            로그아웃
          </button>
        </div>
      </header>
      {data.storage === 'local' && (
        <div className="a-banner">로컬 개발 모드예요. 응답이 구글 시트가 아니라 이 컴퓨터의 .data/local-sheets.json 파일에 저장되고 있어요.</div>
      )}
      {err && <div className="a-error">{err}</div>}
      <nav className="a-tabs" role="tablist" aria-label="관리 메뉴">
        {[
          ['overview', '현황'],
          ['list', '응답 목록'],
          ['logs', '행동 로그'],
          ['consent', '동의 기록'],
          ['dict', '문항 사전'],
          ['tools', '관리 도구']
        ].map(([k, label]) => (
          <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </nav>
      <main className="a-main">
        {tab === 'overview' && <Overview rows={rows} settings={settings} phoneCount={data.phoneCount} />}
        {tab === 'list' && <ResponseList rows={rows} defaultKind={settings.mode} onLogs={openLogs} />}
        {tab === 'logs' && <Logs initialId={logsId} ids={rows.map((r) => r.id)} />}
        {tab === 'consent' && <Consents consents={data.consents || []} texts={data.consentTexts || []} rows={rows} />}
        {tab === 'dict' && <Dictionary />}
        {tab === 'tools' && <Tools settings={settings} rows={rows} data={data} onChanged={load} />}
      </main>
    </div>
  );
}

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await post('/api/admin/login', { password: pw });
      await onDone();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="a-center">
      <form className="a-login" onSubmit={submit}>
        <span className="a-kicker">연구팀 전용</span>
        <h1>SBCX 실험 관리</h1>
        <label htmlFor="pw">관리자 비밀번호</label>
        <input id="pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <div className="a-error">{err}</div>}
        <button type="submit" className="a-btn primary" disabled={!pw || busy}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="a-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={o} className={value === o ? 'on' : ''} aria-pressed={value === o} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function Table({ head, rows, empty = '아직 기록이 없어요.', widths, wrap = [] }) {
  return (
    <div className="a-table-wrap">
      <table className="a-table">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} style={widths && widths[i] ? { minWidth: widths[i] } : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="a-empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className={wrap.includes(j) ? 'wrap' : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── 현황 ───────── */
function Overview({ rows, settings, phoneCount }) {
  const [kind, setKind] = useState(settings.mode);
  const xs = rows.filter((r) => r.kind === kind);
  const target = Number(settings.target_per_group) || 45;
  const count = (list, st) => list.filter((r) => r.state === st).length;
  const done = xs.filter(isComplete);

  const groups = [1, 2, 3, 4].map((g) => {
    const gx = xs.filter((r) => Number(r.group) === g);
    const ok = count(gx, '완료');
    return { g, ok, run: count(gx, '진행 중'), stop: count(gx, '중단'), ex: count(gx, '제외 후보'), pct: Math.min(100, (ok / target) * 100) };
  });

  // 16칸 배정 균형: 완료 + 진행 중 (배정 계산과 같은 기준)
  const combos = [
    ['결정', '가'],
    ['결정', '나'],
    ['행동', '가'],
    ['행동', '나']
  ];
  const balance = [1, 2, 3, 4].map((g) => [
    `집단 ${g}`,
    ...combos.map(([x1, set]) => {
      const c = xs.filter((r) => Number(r.group) === g && r.task1_x1 === x1 && String(r.set_order).startsWith(set));
      const ok = c.filter(isComplete).length;
      const run = c.filter((r) => r.state === '진행 중').length;
      return run ? `${ok} (+${run})` : String(ok);
    })
  ]);

  const gender = (list, v) => list.filter((r) => Number(r.q1) === v).length;
  const ageStat = (list) => {
    const a = list.map((r) => Number(r.q2)).filter((n) => n > 0);
    if (!a.length) return ['—', '—'];
    const mean = a.reduce((x, y) => x + y, 0) / a.length;
    return [mean.toFixed(1), `${Math.min(...a)}–${Math.max(...a)}`];
  };
  const demo = [1, 2, 3, 4]
    .map((g) => ['집단 ' + g, done.filter((r) => Number(r.group) === g)])
    .concat([['전체', done]])
    .map(([name, list]) => [name, list.length, gender(list, 1), gender(list, 2), gender(list, 3), ...ageStat(list)]);

  const byDay = {};
  done.forEach((r) => {
    const k = dayKey(r.finished_at || r.last_at);
    byDay[k] = (byDay[k] || 0) + 1;
  });
  const days = Object.keys(byDay).sort();
  const maxDay = Math.max(1, ...days.map((d) => byDay[d]));

  return (
    <div className="a-stack">
      <div className="a-row-between">
        <Segmented label="구분" options={KINDS} value={kind} onChange={setKind} />
        <span className="a-muted">
          완료 {count(xs, '완료')} / {target * 4} · 진행 중 {count(xs, '진행 중')} · 중단 {count(xs, '중단')} · 제외 후보 {count(xs, '제외 후보')} · 추첨 번호 {phoneCount}건 (전체 구분, 응답과 분리 저장)
        </span>
      </div>
      <div className="a-cards">
        {groups.map((g) => (
          <div className="a-card" key={g.g}>
            <span className="a-card-title">집단 {g.g}</span>
            <span className="a-muted">
              {GROUPS[g.g].W} × {GROUPS[g.g].X2}
            </span>
            <span className="a-big">
              {g.ok}
              <small> / {target} 완료</small>
            </span>
            <div className="a-meter" role="meter" aria-valuemin={0} aria-valuemax={target} aria-valuenow={g.ok} aria-label={`집단 ${g.g} 완료 인원`}>
              <div style={{ width: g.pct + '%' }} />
            </div>
            <span className="a-muted">
              진행 중 {g.run} · 중단 {g.stop} · 제외 후보 {g.ex}
            </span>
          </div>
        ))}
      </div>

      <section className="a-section">
        <h2>배정 균형 (16칸)</h2>
        <p className="a-muted">과업 1의 통제 유형 × 첫 니트 세트. 숫자는 완료(제외 후보 포함), 괄호는 지금 진행 중인 사람이에요. 새 참가자는 가장 적은 칸으로 배정돼요.</p>
        <Table head={['', '결정 먼저 · 세트 가', '결정 먼저 · 세트 나', '행동 먼저 · 세트 가', '행동 먼저 · 세트 나']} rows={balance} />
      </section>

      <section className="a-section">
        <h2>성별·나이 (완료자)</h2>
        <Table head={['', '완료', '남', '여', '응답하지 않음', '나이 평균', '나이 범위']} rows={demo} />
      </section>

      <section className="a-section">
        <h2>일별 완료 수</h2>
        {days.length === 0 ? (
          <p className="a-muted">아직 완료한 사람이 없어요.</p>
        ) : (
          <div className="a-days">
            {days.map((d) => {
              const p = d.split('-').map(Number);
              const w = DAY[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
              return (
                <div className="a-day" key={d} title={`${d}: ${byDay[d]}명 완료`}>
                  <span className="a-day-label">
                    {pad(p[1])}/{pad(p[2])} ({w})
                  </span>
                  <div className="a-day-track">
                    <div style={{ width: (byDay[d] / maxDay) * 100 + '%' }} />
                  </div>
                  <span className="a-day-n">{byDay[d]}명</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* ───────── 응답 목록 ───────── */
function ResponseList({ rows, defaultKind, onLogs }) {
  const [kind, setKind] = useState(defaultKind);
  const [state, setState] = useState('전체');
  const [q, setQ] = useState('');
  const list = rows
    .filter((r) => (kind === '전체' || r.kind === kind) && (state === '전체' || r.state === state) && (!q || String(r.id).includes(q.toUpperCase())))
    .sort((a, b) => Number(b.started_at) - Number(a.started_at));
  const yn = (v) => (Number(v) === 1 ? '예' : v === '' || v == null ? '—' : '아니오');
  const exportUrl = `/api/admin/export?kind=${encodeURIComponent(kind)}&state=${encodeURIComponent(state)}`;
  return (
    <div className="a-stack">
      <div className="a-filters">
        <Segmented label="구분" options={['전체', ...KINDS]} value={kind} onChange={setKind} />
        <Segmented label="상태" options={['전체', ...STATES]} value={state} onChange={setState} />
        <input className="a-input" placeholder="ID 검색" aria-label="ID 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="a-muted">{list.length}명</span>
        <a className="a-btn primary" href={exportUrl} download>
          엑셀 내려받기 (이 목록)
        </a>
      </div>
      <Table
        head={['ID', '구분', '접속', '집단', '제시 순서', '세트', '상태', '현재 단계', '소요 시간', '안내 받음 (과업 1·2)', '미사용 (1·2)', '주의 점검', '기기', '']}
        rows={list.map((r) => [
          <strong key="id">{r.id}</strong>,
          r.kind,
          fmtTime(r.started_at),
          `${r.group} · ${r.W} × ${r.X2}`,
          `${r.task1_x1}→${r.task2_x1}`,
          r.set_order,
          <span key="st" className={'a-state ' + STATE_CLASS[r.state]} title={r.reason || undefined}>
            {r.state}
            {r.reason ? ` · ${r.reason}` : ''}
          </span>,
          r.page,
          fmtDur(r.duration_s),
          `${yn(r.task1_help)} · ${yn(r.task2_help)}`,
          `${yn(r.task1_skip)} · ${yn(r.task2_skip)}`,
          r.attn_pass === '' ? '—' : Number(r.attn_pass) === 1 ? '통과' : <span className="a-fail">실패</span>,
          r.device,
          <button key="log" type="button" className="a-link" onClick={() => onLogs(r.id)}>
            로그
          </button>
        ])}
        empty="조건에 맞는 응답이 없어요."
      />
      <p className="a-muted">진행 중이라도 30분 넘게 반응이 없으면 ‘중단’으로 보여요. 제외 후보는 주의 점검 실패이거나, 완료자가 5명 이상일 때 소요 시간이 중앙값의 1/3보다 짧은 경우예요.</p>
    </div>
  );
}

/* ───────── 행동 로그 ───────── */
function Logs({ initialId, ids }) {
  const [id, setId] = useState(initialId || '');
  const [logs, setLogs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fetchLogs = useCallback(async (which) => {
    setBusy(true);
    setErr('');
    try {
      const d = await api('/api/admin/logs?limit=500' + (which ? '&id=' + encodeURIComponent(which) : ''));
      setLogs(d.logs);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    fetchLogs(initialId || '');
  }, [initialId, fetchLogs]);
  return (
    <div className="a-stack">
      <div className="a-filters">
        <input className="a-input" list="ids" placeholder="참가자 ID (비우면 최근 500건)" aria-label="참가자 ID" value={id} onChange={(e) => setId(e.target.value.trim().toUpperCase())} />
        <datalist id="ids">
          {ids.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <button type="button" className="a-btn" onClick={() => fetchLogs(id)} disabled={busy}>
          {busy ? '불러오는 중…' : '불러오기'}
        </button>
        {logs && <span className="a-muted">{logs.length}건 · 최근 것부터</span>}
      </div>
      {err && <div className="a-error">{err}</div>}
      {logs && (
        <Table
          head={['시각', 'ID', '과업', '경과(초)', '화면', '이벤트', '내용']}
          rows={logs.map((l) => [fmtClock(l.at), l.id, l.task, l.elapsed_s, l.page, EVENT_LABEL[l.event] || l.event, l.detail])}
          wrap={[6]}
        />
      )}
    </div>
  );
}

/* ───────── 동의 기록 ───────── */
function Consents({ consents, texts, rows }) {
  const kindOf = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r.kind])), [rows]);
  const o = (v) => (Number(v) === 1 ? '동의' : '—');
  return (
    <div className="a-stack">
      <Table
        head={['ID', '구분', '동의 시각', '문구 버전', '연구 참여', '응답 수집', '추첨 번호 수집·이용']}
        rows={consents
          .slice()
          .reverse()
          .map((c) => [c.id, kindOf[c.id] || '—', fmtTime(c.at), c.version, o(c.participate), o(c.data), o(c.phone)])}
      />
      <section className="a-section">
        <h2>동의문 원문 (버전별)</h2>
        {texts.length === 0 && <p className="a-muted">아직 저장된 원문이 없어요. 첫 참가자가 동의하면 저장돼요.</p>}
        {texts.map((t) => (
          <details key={t.version} className="a-details">
            <summary>
              {t.version} · {fmtTime(t.saved_at)} 처음 사용
            </summary>
            <pre>{t.text}</pre>
          </details>
        ))}
      </section>
    </div>
  );
}

/* ───────── 문항 사전 ───────── */
function Dictionary() {
  const rows = useMemo(() => dictionaryRows(), []);
  return (
    <div className="a-stack">
      <p className="a-muted">응답 시트·엑셀의 열 이름과 뜻이에요. 과업 문항은 task1_ / task2_ 로 과업 순서를 붙였고, 결정·행동은 task1_x1 · task2_x1 열에 있어요.</p>
      <Table head={DICTIONARY_HEADER} rows={rows} wrap={[3, 4, 6]} />
    </div>
  );
}

/* ───────── 관리 도구 ───────── */
function Tools({ settings, rows, data, onChanged }) {
  const [draft, setDraft] = useState(settings);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [fast, setFast] = useState(true);
  const [kindId, setKindId] = useState('');
  const [kindVal, setKindVal] = useState('테스트');
  const [confirmDel, setConfirmDel] = useState(false);
  const tests = rows.filter((r) => r.kind === '테스트').length;
  const origin = window.location.origin;

  const run = async (label, fn) => {
    setBusy(label);
    setMsg('');
    try {
      const m = await fn();
      setMsg(m);
      await onChanged();
    } catch (e) {
      setMsg('실패: ' + e.message);
    } finally {
      setBusy('');
    }
  };
  const num = (k) => (
    <input
      className="a-input sm"
      type="number"
      min={0}
      max={3600}
      value={draft[k]}
      onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
      aria-label={k}
    />
  );

  return (
    <div className="a-stack">
      {msg && (
        <div className="a-banner" role="status">
          {msg}
        </div>
      )}
      <section className="a-section">
        <h2>실험 모드와 시간</h2>
        <div className="a-form">
          <div className="a-field">
            <span>모드</span>
            <Segmented label="실험 모드" options={['본실험', '파일럿']} value={draft.mode} onChange={(v) => setDraft({ ...draft, mode: v })} />
            <small>파일럿으로 두면 새로 들어오는 참가자가 ‘파일럿’으로 저장되고, 배정 균형도 본실험과 따로 세요.</small>
          </div>
          <label className="a-field">
            <span>혼자 찾기 제한 시간 (초)</span>
            {num('help_seconds')}
            <small>지나면 오른쪽에 도움말, 앱에는 위치 테두리가 나와요.</small>
          </label>
          <label className="a-field">
            <span>안내 뒤 [건너뛰기]까지 (초)</span>
            {num('skip_seconds')}
          </label>
          <label className="a-field">
            <span>상황 카드 최소 시간 (초)</span>
            {num('scenario_wait')}
          </label>
          <label className="a-field">
            <span>집단당 목표 완료 인원</span>
            {num('target_per_group')}
          </label>
        </div>
        <div>
          <button
            type="button"
            className="a-btn primary"
            disabled={!!busy}
            onClick={() => run('settings', async () => {
              await post('/api/admin/action', { type: 'settings', settings: draft });
              return '설정을 저장했어요. 새로 시작하는 참가자부터 적용돼요.';
            })}
          >
            {busy === 'settings' ? '저장 중…' : '설정 저장'}
          </button>
        </div>
      </section>

      <section className="a-section">
        <h2>조건 미리보기 (테스트 응답으로 저장)</h2>
        <label className="a-check">
          <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} />
          시간 짧게 (도움말 10초 · 건너뛰기 20초 · 상황 카드 2초)
        </label>
        <Table
          head={['집단', '조건', '결정 먼저 (과업 1 결정)', '행동 먼저 (과업 1 행동)']}
          rows={[1, 2, 3, 4].map((g) => {
            const direct = GROUPS[g].X2 === '직접 노출';
            const link = (o) => `${origin}/?test=1&g=${g}&o=${o}${fast ? '&fast=1' : ''}`;
            return [
              `집단 ${g}`,
              `${GROUPS[g].W} × ${GROUPS[g].X2}`,
              <a key="a" href={link(0)} target="_blank" rel="noopener noreferrer">
                {direct ? 'C1 → C3' : 'C2 → C4'} 열기
              </a>,
              <a key="b" href={link(1)} target="_blank" rel="noopener noreferrer">
                {direct ? 'C3 → C1' : 'C4 → C2'} 열기
              </a>
            ];
          })}
        />
        <p className="a-muted">같은 브라우저에서는 진행 상황이 이어지므로, 다른 조건을 보려면 테스트 화면 위쪽의 [처음부터 다시]를 누르세요.</p>
      </section>

      <section className="a-section">
        <h2>응답 구분 바꾸기</h2>
        <div className="a-filters">
          <input className="a-input" list="ids2" placeholder="참가자 ID" aria-label="참가자 ID" value={kindId} onChange={(e) => setKindId(e.target.value.trim().toUpperCase())} />
          <datalist id="ids2">
            {rows.map((r) => (
              <option key={r.id} value={r.id} />
            ))}
          </datalist>
          <Segmented label="바꿀 구분" options={KINDS} value={kindVal} onChange={setKindVal} />
          <button
            type="button"
            className="a-btn"
            disabled={!kindId || !!busy}
            onClick={() => run('kind', async () => {
              await post('/api/admin/action', { type: 'kind', id: kindId, kind: kindVal });
              return `${kindId}를 ‘${kindVal}’(으)로 바꿨어요.`;
            })}
          >
            바꾸기
          </button>
        </div>
      </section>

      <section className="a-section">
        <h2>테스트 응답 지우기</h2>
        <p className="a-muted">구분이 ‘테스트’인 응답 {tests}건과 그 행동 로그·동의 기록·추첨 번호를 지워요. 되돌릴 수 없어요.</p>
        {!confirmDel ? (
          <div>
            <button type="button" className="a-btn danger" disabled={!tests || !!busy} onClick={() => setConfirmDel(true)}>
              테스트 응답 {tests}건 지우기
            </button>
          </div>
        ) : (
          <div className="a-filters">
            <span>정말 지울까요?</span>
            <button
              type="button"
              className="a-btn danger"
              disabled={!!busy}
              onClick={() => run('delete', async () => {
                const d = await post('/api/admin/action', { type: 'delete_tests' });
                setConfirmDel(false);
                return `테스트 응답 ${d.deleted}건을 지웠어요.`;
              })}
            >
              {busy === 'delete' ? '지우는 중…' : '네, 지울게요'}
            </button>
            <button type="button" className="a-btn ghost" onClick={() => setConfirmDel(false)}>
              취소
            </button>
          </div>
        )}
      </section>

      <section className="a-section">
        <h2>링크</h2>
        <ul className="a-links">
          <li>
            참가자 링크: <code>{origin}/</code>
          </li>
          <li>
            저장소: {data.storage === 'google' ? '구글 시트' : '로컬 파일 (개발용)'}
            {data.storage === 'google' && (
              <>
                {' · '}
                <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer">
                  응답 시트 열기
                </a>
                {' · '}
                <a href={data.phoneUrl} target="_blank" rel="noopener noreferrer">
                  추첨 번호 시트 열기
                </a>
              </>
            )}
          </li>
        </ul>
      </section>
    </div>
  );
}

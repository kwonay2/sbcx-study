import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as L from './logic.js';
import { assign, save, beacon, sendPhone, deviceLabel, isMobileUA } from './api.js';
import { MIN_WIDTH, STUDY } from '../shared/config.js';
import { condCode } from '../shared/schema.js';
import PhoneApp from './PhoneApp.jsx';
import { PanelHead, Consent, Questions, Intro, Scenario, TaskIntro, TaskPanel, Debrief, Done, Thanks } from './Panel.jsx';

const STORE_KEY = 'sbcx_session_v1';
const DONE_KEY = 'sbcx_done_v1';

const storage = {
  get(k) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* 저장 공간을 못 쓰는 브라우저: 새로고침하면 처음부터 */
    }
  },
  del(k) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* 무시 */
    }
  }
};

function readParams() {
  const q = new URLSearchParams(window.location.search);
  const test = q.get('test') === '1';
  const int = (k, lo, hi) => {
    const v = q.get(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
  };
  return {
    test,
    force: test ? { g: int('g', 1, 4), o: int('o', 0, 1), s: int('s', 0, 1) } : null,
    fast: test && q.get('fast') === '1'
  };
}

function loadSession() {
  const raw = storage.get(STORE_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s && s.v === 1 && Array.isArray(s.flow) ? s : null;
  } catch {
    return null;
  }
}

function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const f = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return size;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const winLabel = () => `${window.innerWidth}×${window.innerHeight}`;
const stripSeq = ({ seq, ...l }) => l;

export default function App() {
  const params = useMemo(readParams, []);
  const win = useWindowSize();
  const [session, setSession] = useState(loadSession);
  const [dup] = useState(() => !params.test && !loadSession() && !!storage.get(DONE_KEY));
  const ref = useRef(session);
  ref.current = session;

  const [consent, setConsent] = useState({ participate: false, data: false, phone: false });
  const [startBusy, setStartBusy] = useState(false);
  const [startErr, setStartErr] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneErr, setPhoneErr] = useState('');
  const [saveFailed, setSaveFailed] = useState(false);
  const [, setClock] = useState(0);

  const act = useCallback((fn, ...args) => {
    setSession((prev) => {
      if (!prev) return prev;
      const d = structuredClone(prev);
      return fn(d, ...args) === false ? prev : d;
    });
  }, []);

  /* ── 저장: 화면을 넘길 때마다, 로그가 쌓이면, 15초마다, 창을 숨길 때 ── */
  const saver = useRef({ busy: false, again: false, fails: 0, sentSeq: 0, waiters: [] });

  const runSave = useCallback(async () => {
    const sv = saver.current;
    if (sv.busy) {
      sv.again = true;
      return;
    }
    sv.busy = true;
    try {
      do {
        sv.again = false;
        const cur = ref.current;
        if (!cur) break;
        const logs = cur.logs.filter((l) => l.seq > sv.sentSeq);
        const maxSeq = logs.length ? logs[logs.length - 1].seq : sv.sentSeq;
        const finished = cur.finished;
        try {
          await save({ id: cur.id, record: L.buildRecord(cur, winLabel()), logs: logs.map(stripSeq) });
          sv.fails = 0;
          sv.sentSeq = maxSeq;
          setSaveFailed(false);
          setSession((prev) =>
            prev ? { ...prev, logs: prev.logs.filter((l) => l.seq > maxSeq), savedFinished: prev.savedFinished || finished } : prev
          );
        } catch (e) {
          sv.fails += 1;
          if (e.status === 400 || e.status === 404) {
            setSaveFailed(true);
            break;
          }
          if (sv.fails >= 2) setSaveFailed(true);
          if (sv.fails > 8) break;
          await wait(Math.min(20000, 1500 * 2 ** Math.min(sv.fails, 4)));
          sv.again = true;
        }
      } while (sv.again);
    } finally {
      sv.busy = false;
      const ws = sv.waiters;
      sv.waiters = [];
      ws.forEach((w) => w());
    }
  }, []);

  const flushNow = useCallback(
    () =>
      new Promise((resolve) => {
        saver.current.waiters.push(resolve);
        runSave();
      }),
    [runSave]
  );

  const pi = session ? session.pi : -1;
  const pending = session ? session.logs.length : 0;
  useEffect(() => {
    if (ref.current) runSave();
  }, [pi, runSave]);
  useEffect(() => {
    if (pending >= 40) runSave();
  }, [pending, runSave]);
  useEffect(() => {
    const t = setInterval(() => {
      const s = ref.current;
      if (s && s.logs.some((l) => l.seq > saver.current.sentSeq)) runSave();
    }, 15000);
    return () => clearInterval(t);
  }, [runSave]);

  // 새로고침·다시 열기 후 이어서
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    if (ref.current && !ref.current.finished) act(L.logEvent, 'resume', '새로고침·다시 열기 후 이어서');
  }, [act]);

  // 창을 숨기거나 닫을 때: 쌓인 로그를 sendBeacon으로 보낸다
  useEffect(() => {
    const flushBeacon = () => {
      const s = ref.current;
      const sv = saver.current;
      if (!s || sv.busy) return;
      const logs = s.logs.filter((l) => l.seq > sv.sentSeq);
      const ok = beacon({ id: s.id, record: L.buildRecord(s, winLabel()), logs: logs.map(stripSeq) });
      if (ok && logs.length) sv.sentSeq = logs[logs.length - 1].seq;
    };
    const onVis = () => {
      if (!ref.current) return;
      if (document.visibilityState === 'hidden') {
        flushBeacon();
        act(L.logEvent, 'hidden', '다른 탭·창으로 이동');
      } else {
        act(L.logEvent, 'visible', '돌아옴');
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flushBeacon);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flushBeacon);
    };
  }, [act]);

  // 브라우저에 진행 상황 보관 (새로고침해도 이어서)
  useEffect(() => {
    if (!session) return;
    storage.set(STORE_KEY, JSON.stringify(session));
    if (session.finished && session.savedFinished && session.kind !== '테스트') storage.set(DONE_KEY, session.id);
  }, [session]);

  // 0.5초 시계: 과업 시간(화면을 보고 있을 때만), 상황 카드 카운트다운
  const lastTick = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(now - lastTick.current, 2000);
      lastTick.current = now;
      const s = ref.current;
      if (!s) return;
      const k = s.flow[s.pi].kind;
      if (k === 'task') {
        if (document.visibilityState !== 'hidden') act(L.tick, dt, s.settings.help_seconds);
      } else if (k === 'scenario') setClock(now);
    }, 500);
    return () => clearInterval(t);
  }, [act]);

  const h = useMemo(
    () => ({
      togExcl: (kind, i) => act(L.togExcl, kind, i),
      pickCond: (key, v) => act(L.pickCond, key, v),
      openSettings: () => act(L.openSettings),
      closeSettings: () => act(L.closeSettings),
      rerec: () => act(L.rerec),
      complete: () => act(L.complete),
      toggleOrig: () => act(L.toggleOrig)
    }),
    [act]
  );

  async function start() {
    setStartBusy(true);
    setStartErr('');
    try {
      const a = await assign({ consent, test: params.test, force: params.force, device: deviceLabel(), window: winLabel() });
      const settings = params.fast ? { ...a.settings, help_seconds: 10, skip_seconds: 20, scenario_wait: 2 } : a.settings;
      saver.current.sentSeq = 0;
      setSession(L.newSession({ ...a, settings }, { consent, device: deviceLabel() }));
    } catch (e) {
      setStartErr(`시작하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. (${e.message})`);
    } finally {
      setStartBusy(false);
    }
  }

  async function submitPhone() {
    setPhoneBusy(true);
    setPhoneErr('');
    try {
      await flushNow();
      await sendPhone(session.id, phone);
      setPhone('');
      act(L.setPhoneGiven, true);
    } catch {
      setPhoneErr('번호를 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    } finally {
      setPhoneBusy(false);
    }
  }

  function resetTest() {
    storage.del(STORE_KEY);
    window.location.reload();
  }

  /* ── 화면 ── */
  if (win.w < 768 || isMobileUA()) return <MobileNotice />;
  if (dup && !session) return <DupNotice />;

  const pg = session ? session.flow[session.pi] : { kind: 'consent', sec: '시작' };
  const pct = session ? Math.round((session.pi / (session.flow.length - 1)) * 100) : 0;
  const T = session && pg.task != null ? session.tasks[pg.task] : null;
  const appPage = !!T && (pg.kind === 'task' || pg.kind === 'result' || !!pg.lock);
  const isTest = (session && session.kind === '테스트') || (!session && params.test);
  const scale = Math.max(0.45, Math.min(1, (win.h - 48 - (isTest ? 34 : 0)) / 868, ((win.w * 5) / 12 - 48) / 414));
  const settings = session ? session.settings : null;
  const toast = T && pg.kind === 'task' && T.toast && Date.now() < T.toastUntil ? T.toast : '';

  let panel = null;
  if (!session) {
    panel = <Consent consent={consent} setConsent={setConsent} onStart={start} busy={startBusy} error={startErr} />;
  } else if (pg.kind === 'q') {
    panel = (
      <Questions
        s={session}
        pg={pg}
        T={T}
        complete={L.pageComplete(session, pg)}
        onAnswer={(key, v, log) => act(L.answer, key, v, log)}
        onNext={() => act(L.next, settings.scenario_wait)}
      />
    );
  } else if (pg.kind === 'intro') panel = <Intro onNext={() => act(L.next, settings.scenario_wait)} />;
  else if (pg.kind === 'scenario' || pg.kind === 'scenario2') {
    const remain = pg.kind === 'scenario' ? Math.max(0, Math.ceil(settings.scenario_wait - (Date.now() - session.pageEnter) / 1000)) : 0;
    panel = <Scenario W={session.W} second={pg.kind === 'scenario2'} remain={remain} onNext={() => act(L.next, settings.scenario_wait)} />;
  } else if (pg.kind === 'taskIntro') panel = <TaskIntro onNext={() => act(L.next, settings.scenario_wait)} />;
  else if (pg.kind === 'task' || pg.kind === 'result') {
    const helpMs = settings.help_seconds * 1000;
    const skipMs = settings.skip_seconds * 1000;
    const canSkip = pg.kind === 'task' && ((T.helpMs != null && T.visMs - T.helpMs >= skipMs) || T.visMs >= helpMs + skipMs);
    panel = (
      <TaskPanel
        help={pg.kind === 'task' && T.helpMs != null}
        helpText={L.helpText(session, T)}
        canSkip={canSkip}
        onSkip={() => act(L.skip)}
        result={pg.kind === 'result'}
      />
    );
  } else if (pg.kind === 'debrief') panel = <Debrief onNext={() => act(L.next, settings.scenario_wait)} />;
  else if (pg.kind === 'done')
    panel = (
      <Done
        canPhone={!!session.consent.phone}
        phone={phone}
        setPhone={setPhone}
        onSubmit={submitPhone}
        onSkip={() => act(L.setPhoneGiven, false)}
        busy={phoneBusy}
        error={phoneErr}
      />
    );
  else if (pg.kind === 'thanks') panel = <Thanks saved={!!session.savedFinished} failed={saveFailed} onRetry={() => runSave()} />;

  return (
    <div className="layout">
      {isTest && (
        <div className="test-bar">
          <strong>테스트 응답</strong>
          {session ? (
            <>
              <span>{session.id}</span>
              <span>
                집단 {session.group} · {session.W} × {session.X2}
              </span>
              <span>{session.x1.join('→')}</span>
              <span>세트 {session.sets.join('→')}</span>
              <span className="now">
                현재 {pg.id}
                {T ? ' · ' + condCode(T.x1, session.X2) : ''}
              </span>
            </>
          ) : (
            <span>이 링크로 들어온 응답은 ‘테스트’로 저장되고 관리자 화면에서 지울 수 있어요</span>
          )}
          <button type="button" onClick={resetTest}>
            처음부터 다시
          </button>
        </div>
      )}
      <div className="stage">
        <section className="left" aria-label="쇼핑앱 화면">
          <PhoneApp
            scale={scale}
            view={appPage ? T.screen : 'standby'}
            T={T}
            X2={session ? session.X2 : ''}
            live={pg.kind === 'task'}
            locked={appPage && !!pg.lock}
            toast={toast}
            h={h}
          />
        </section>
        <main className="right">
          <div className="panel">
            {win.w < MIN_WIDTH && (
              <div className="p-warn" role="status">
                브라우저 창을 가로 {MIN_WIDTH}px 이상으로 키워 주세요. 지금은 {win.w}px이에요.
              </div>
            )}
            <PanelHead sec={pg.sec} pct={pct} />
            {panel}
          </div>
        </main>
      </div>
    </div>
  );
}

function MobileNotice() {
  const [copied, setCopied] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };
  return (
    <div className="notice">
      <span className="notice-kicker">{STUDY.title}</span>
      <h1>PC로 접속해 주세요</h1>
      <p>이 연구는 PC나 노트북 화면(가로 {MIN_WIDTH}px 이상)에서만 참여할 수 있어요. 아래 버튼으로 링크를 복사해 PC에서 열어 주세요.</p>
      <div>
        <button type="button" className="btn-primary" onClick={copy}>
          {copied === 'ok' ? '링크를 복사했어요' : copied === 'fail' ? '주소창의 링크를 직접 복사해 주세요' : '링크 복사'}
        </button>
      </div>
    </div>
  );
}

function DupNotice() {
  return (
    <div className="notice">
      <span className="notice-kicker">{STUDY.title}</span>
      <h1>이미 참여하신 기기예요</h1>
      <p>이 연구는 한 사람당 한 번만 참여할 수 있어요. 참여해 주셔서 감사합니다.</p>
    </div>
  );
}

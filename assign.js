// POST /api/assign — 동의 후 익명 ID를 만들고 16칸 블록 무작위로 배정한다.
import { readJson, send, route, clip, HttpError } from '../lib/http.js';
import { callStore } from '../lib/store.js';
import { RESPONSE_COLUMNS, DICTIONARY_HEADER, dictionaryRows, dictionaryVersion } from '../src/shared/schema.js';
import { CONSENT_VERSION, consentFullText, DEFAULT_SETTINGS } from '../src/shared/config.js';

const int = (v, lo, hi) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
};

export default route(['POST'], async (req, res) => {
  const b = await readJson(req);
  const c = b.consent || {};
  if (!c.participate || !c.data) throw new HttpError(400, '필수 동의 항목이 빠졌어요');
  const test = b.test === true;
  const force = test && b.force ? { g: int(b.force.g, 1, 4), o: int(b.force.o, 0, 1), s: int(b.force.s, 0, 1) } : null;
  const data = await callStore('assign', {
    test,
    force,
    device: clip(b.device, 120),
    window: clip(b.window, 30),
    consent: { participate: true, data: true, phone: !!c.phone },
    consentVersion: CONSENT_VERSION,
    consentText: consentFullText(),
    columns: RESPONSE_COLUMNS,
    dictionary: dictionaryRows(),
    dictionaryHeader: DICTIONARY_HEADER,
    dictionaryVersion: dictionaryVersion()
  });
  send(res, 200, {
    ok: true,
    id: data.id,
    group: data.group,
    o: data.o,
    s: data.s,
    kind: data.kind,
    settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }
  });
});

// 로컬 개발용 저장소: apps-script/Code.gs를 그대로 Node에서 돌리고,
// 구글 시트 대신 .data/local-sheets.json 파일에 저장한다.
// (Vercel에 배포하면 이 파일은 쓰이지 않고 진짜 Apps Script로 보낸다)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const CODE = path.join(ROOT, 'apps-script', 'Code.gs');
const FILE = process.env.LOCAL_SHEETS_FILE || path.join(ROOT, '.data', 'local-sheets.json');

let db = null;
let ctx = null;
let codeMtime = 0;

function revive(v) {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    if (Object.keys(v).length === 1 && typeof v.$d === 'number') return new Date(v.$d);
    const o = {};
    Object.keys(v).forEach((k) => (o[k] = revive(v[k])));
    return o;
  }
  return v;
}
function dry(v) {
  if (v && typeof v === 'object' && typeof v.getTime === 'function') return { $d: v.getTime() };
  if (Array.isArray(v)) return v.map(dry);
  if (v && typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach((k) => (o[k] = dry(v[k])));
    return o;
  }
  return v;
}
function load() {
  if (db) return;
  try {
    db = revive(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    db = { props: {}, books: {} };
  }
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(dry(db)));
}

// 구글 시트처럼: '로 시작하면 글자 그대로, 숫자처럼 생긴 글자는 숫자로 바뀐다.
function norm(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') {
    if (v.startsWith("'")) return v.slice(1);
    if (/^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
    return v;
  }
  return v;
}

class Range {
  constructor(sheet, r, c, nr, nc) {
    if (!(r >= 1 && c >= 1 && nr >= 1 && nc >= 1)) {
      throw new Error(`범위가 잘못됐어요: getRange(${r}, ${c}, ${nr}, ${nc}) — 행·열 수는 1 이상이어야 해요`);
    }
    Object.assign(this, { sheet, r, c, nr, nc });
  }
  getValues() {
    const d = this.sheet.raw.data;
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = d[this.r - 1 + i] ? d[this.r - 1 + i][this.c - 1 + j] : undefined;
        row.push(v === undefined || v === null ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some((row) => row.length !== this.nc)) {
      throw new Error(`setValues 크기가 범위와 달라요: 범위 ${this.nr}×${this.nc}, 값 ${vals.length}×${vals[0] ? vals[0].length : 0}`);
    }
    const d = this.sheet.raw.data;
    for (let i = 0; i < this.nr; i++) {
      const ri = this.r - 1 + i;
      while (d.length <= ri) d.push([]);
      for (let j = 0; j < this.nc; j++) d[ri][this.c - 1 + j] = norm(vals[i][j]);
    }
    return this;
  }
  clearContent() {
    const d = this.sheet.raw.data;
    for (let i = 0; i < this.nr; i++) {
      const row = d[this.r - 1 + i];
      if (!row) continue;
      for (let j = 0; j < this.nc; j++) row[this.c - 1 + j] = '';
    }
    return this;
  }
  setNumberFormat() {
    return this;
  }
}

const filled = (v) => v !== '' && v !== null && v !== undefined;

class Sheet {
  constructor(raw) {
    this.raw = raw;
  }
  getName() {
    return this.raw.name;
  }
  setName(n) {
    this.raw.name = n;
    return this;
  }
  getRange(r, c, nr = 1, nc = 1) {
    return new Range(this, r, c, nr, nc);
  }
  getLastRow() {
    const d = this.raw.data;
    for (let i = d.length - 1; i >= 0; i--) if (d[i] && d[i].some(filled)) return i + 1;
    return 0;
  }
  getLastColumn() {
    let m = 0;
    this.raw.data.forEach((row) => {
      if (!row) return;
      for (let j = row.length - 1; j >= 0; j--) if (filled(row[j])) { m = Math.max(m, j + 1); break; }
    });
    return m;
  }
  getMaxRows() {
    return Math.max(1000, this.raw.data.length);
  }
  setFrozenRows() {
    return this;
  }
}

class Book {
  constructor(id) {
    this.id = id;
    this.raw = db.books[id];
  }
  getId() {
    return this.id;
  }
  getUrl() {
    return 'local://' + this.raw.name;
  }
  getName() {
    return this.raw.name;
  }
  getSheets() {
    return this.raw.sheets.map((s) => new Sheet(s));
  }
  getSheetByName(n) {
    const s = this.raw.sheets.find((x) => x.name === n);
    return s ? new Sheet(s) : null;
  }
  insertSheet(n) {
    const s = { name: n, data: [] };
    this.raw.sheets.push(s);
    return new Sheet(s);
  }
  setSpreadsheetTimeZone() {
    return this;
  }
}

function newBook(name) {
  const id = 'local-' + crypto.randomBytes(4).toString('hex');
  db.books[id] = { name, sheets: [{ name: '시트1', data: [] }] };
  return new Book(id);
}

function makeContext() {
  const globals = {
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        if (!db.books.main) db.books.main = { name: 'SBCX 실험 데이터 (로컬)', sheets: [] };
        return new Book('main');
      },
      openById(id) {
        if (!db.books[id]) throw new Error('없는 스프레드시트: ' + id);
        return new Book(id);
      },
      create(name) {
        return newBook(name);
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (db.props[k] === undefined ? null : db.props[k]),
        setProperty: (k, v) => {
          db.props[k] = String(v);
        }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock: () => true, releaseLock() {} }) },
    Utilities: { getUuid: () => crypto.randomUUID() },
    ContentService: {
      createTextOutput: (s) => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }),
      MimeType: { JSON: 'application/json', TEXT: 'text/plain' }
    },
    Logger: { log: () => {} }
  };
  const c = vm.createContext(globals);
  vm.runInContext(fs.readFileSync(CODE, 'utf8'), c, { filename: 'Code.gs' });
  return c;
}

export function callLocal(action, payload = {}) {
  load();
  const m = fs.statSync(CODE).mtimeMs;
  if (!ctx || m !== codeMtime) {
    ctx = makeContext();
    codeMtime = m;
  }
  if (!db.props.SECRET) ctx.setup();
  const out = ctx.doPost({ postData: { contents: JSON.stringify({ ...payload, action, secret: db.props.SECRET }) } });
  persist();
  return JSON.parse(out.getContent());
}

// 테스트용: 로컬 시트 내용을 그대로 돌려준다
export function dumpLocal() {
  load();
  return db;
}
export function resetLocal() {
  db = { props: {}, books: {} };
  ctx = null;
  persist();
}

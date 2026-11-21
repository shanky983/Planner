/* Planner — Sanyam's day, from ritual to shutdown.
   One file, no framework, so it opens instantly and works offline.
   Data lives on the phone (IndexedDB) and is backed up to a Google Sheet when sync is set up. */

const VERSION = '1.0.0';
const BRIEF_URL = 'https://claude.ai/artifact/TPpDVAzU8PCFHAsQEd3aqi';
const DAY_START_HOUR = 4; // a new day begins at 04:00
const AREAS = ['Health', 'Wealth', 'Relationships', 'Mind', 'Purpose'];
const AREA_INK = { Health: ['#2F7A4F', '#3E9A63', '#D5E6DA'], Wealth: ['#145A43', '#145A43', '#CFDDD6'], Relationships: ['#A3324F', '#C2466A', '#F0D3DB'], Mind: ['#26487A', '#3A64A6', '#D3DCEB'], Purpose: ['#8A5A00', '#E0A21B', '#F3E2B6'] };
const AREA_SOFT = { Health: '#9ED3B2', Wealth: '#8FD3B6', Relationships: '#F0A9BC', Mind: '#A9C2EC', Purpose: '#F2C14E' };
const LENS = [10, 20, 30, 45, 60, 120];

/* ---------- small helpers ---------- */
const pad = (n) => String(n).padStart(2, '0');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseISO = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const toMin = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; };
const hm = (mins) => { mins = ((Math.round(mins) % 1440) + 1440) % 1440; return pad(Math.floor(mins / 60)) + ':' + pad(mins % 60); };
const lenLabel = (m) => m >= 60 ? (m % 60 ? Math.floor(m / 60) + ' h ' + (m % 60) : (m / 60) + ' h') : m + ' min';
const round5 = (m) => Math.round(m / 5) * 5;
const ceil30 = (m) => Math.ceil(m / 30) * 30;
function todayISO() { const d = new Date(); if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1); return iso(d); }
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
const fmtLong = (s) => parseISO(s).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (s) => parseISO(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDM = (s) => parseISO(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const weekday = (s) => parseISO(s).getDay();
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];
const fmtFormal = (s) => { const d = parseISO(s); return d.toLocaleDateString('en-IN', { weekday: 'long' }) + ', the ' + ORD[d.getDate()] + ' of ' + d.toLocaleDateString('en-IN', { month: 'long' }); };

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  alarm: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M19 3l3 3"/></svg>',
  next: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  prev: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
};

/* ---------- sun and Brahma Muhurta (NOAA solar equations) ---------- */
function sunTimes(dateISO, lat, lon) {
  const d = parseISO(dateISO);
  const start = new Date(d.getFullYear(), 0, 0);
  const N = Math.round((d - start) / 86400000);
  const tzMin = -d.getTimezoneOffset();
  const calc = (rise) => {
    const g = 2 * Math.PI / 365 * (N - 1 + ((rise ? 6 : 18) - 12) / 24);
    const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const rad = Math.PI / 180;
    const ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(dec)) - Math.tan(lat * rad) * Math.tan(dec)) / rad;
    const utc = 720 - 4 * (lon + (rise ? ha : -ha)) - eqt;
    return utc + tzMin;
  };
  // Matches the Drik / Vedic panchang times for Ahmedabad to within a minute.
  return { rise: Math.round(calc(true)), set: Math.round(calc(false)) };
}
function brahma(dateISO) {
  const s = state.settings;
  const t = sunTimes(dateISO, s.lat, s.lon);
  return { sunrise: t.rise, sunset: t.set, start: t.rise - 96, end: t.rise - 48, alarm: t.rise - 96 - 10 };
}
function wakeFor(dateISO) {
  const day = state.days[dateISO];
  if (day && day.wake) return toMin(day.wake);
  if (day && day.alarm) return brahma(dateISO).alarm;
  const t = state.days[todayISO()];
  return t && t.wake ? toMin(t.wake) : 7 * 60;
}
function peakFor(dateISO) { const s = round5(wakeFor(dateISO) + 150); return { start: s, end: s + 150 }; }

/* ---------- storage ---------- */
const DB_NAME = 'planner', STORE = 'kv';
function idb() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in self)) return rej(new Error('no idb'));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function dbGet(key) {
  try { const db = await idb(); return await new Promise((res) => { const q = db.transaction(STORE).objectStore(STORE).get(key); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); }
  catch (e) { try { const v = localStorage.getItem('planner.' + key); return v ? JSON.parse(v) : undefined; } catch (_) { return undefined; } }
}
async function dbSet(key, val) {
  try { const db = await idb(); await new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(val, key); tx.oncomplete = res; tx.onerror = res; }); }
  catch (e) { try { localStorage.setItem('planner.' + key, JSON.stringify(val)); } catch (_) { /* storage full or blocked */ } }
}

/* ---------- default data (his real plan) ---------- */
function seed() {
  const t = todayISO();
  const R = (id, name, area, freq, len, extra) => Object.assign({ id, name, area, freq, len, nextDue: t, last: null, skips: [], done: [] }, extra || {});
  return {
    v: 1,
    settings: {
      name: 'Sanyam', initials: 'SS', city: 'Ahmedabad', lat: 23.0225, lon: 72.5714,
      affStart: '2026-11-01', msgWindows: ['11:30', '16:30', '19:30'],
      limits: { projects: 3, three: 3, buffer: 20, deep: 120 },
      lunch: { from: '11:00', to: '14:30', mins: 45 },
      toggles: { calendar: true, notifications: true, focus: true, drive: true, birthday: false },
      syncUrl: '', syncKey: '', lastSync: null,
    },
    plan: {
      vision: 'KCM STIICH at ₹150 crore a year by 2029, running on systems, while I lead and grow.',
      cycleStart: '2026-11-16', cycleEnd: '2027-03-31',
      constraint: { title: 'Sales', detail: '₹13 crore more to bill by 31 March, about ₹68 lakh a week.' },
      sales: { start: 14, target: 27, weeks: [] },
      goals: [
        { area: 'Wealth', title: 'Sales of ₹27 crore by 31 March', lead: 'Calls and orders booked every week', kind: 'sales' },
        { area: 'Health', title: 'Gym 6 days a week, and a proper diet', lead: 'Gym days each week', kind: 'gym' },
        { area: 'Relationships', title: '10 minutes daily with Mom and Dad; my sister every other day', lead: 'Calls kept each week', kind: 'family' },
      ],
      vital: ['₹68 lakh of sales billed this week', 'Gym 6 days · diet on plan', 'Mom and Dad daily · my sister every other day'],
    },
    notes: [],
    tasks: [],
    rhythms: [
      R('ritual', 'Morning ritual and plan', 'Purpose', { t: 'auto' }, 15, { when: 'Daily', fixedNote: 'The first time you open the app' }),
      R('shutdown', 'Shutdown · close every loop', 'Purpose', { t: 'auto' }, 10, { when: 'Daily', fixedNote: 'End of your day' }),
      R('gym', 'Gym', 'Health', { t: 'week6' }, 90, { when: '6 days', fixed: true, note: '15 min going · 1 h workout · 15 min back' }),
      R('mom', '10 minutes with Mom and Dad', 'Relationships', { t: 'daily' }, 10, { when: 'Daily', family: true }),
      R('sister', '10 minutes with my sister', 'Relationships', { t: 'every', n: 2 }, 10, { when: 'Every 2 days', family: true }),
      R('steam', 'Steam bath', 'Health', { t: 'every', n: 7 }, 45, { when: 'Weekly', note: 'A morning', nextDue: addDays(t, 1) }),
      R('temple', 'Temple visit', 'Purpose', { t: 'every', n: 7 }, 45, { when: 'Weekly', nextDue: addDays(t, 2) }),
      R('skin', 'Skin care', 'Health', { t: 'every', n: 7 }, 30, { when: 'Weekly', nextDue: addDays(t, 3) }),
      R('laundry', 'Laundry', 'Mind', { t: 'every', n: 7 }, 30, { when: 'Weekly', nextDue: addDays(t, 4) }),
      R('haircut', 'Haircut', 'Health', { t: 'every', n: 15 }, 45, { when: 'Every 15 days', nextDue: addDays(t, 5) }),
      R('shopping', 'Shopping', 'Mind', { t: 'every', n: 40 }, 120, { when: 'Every 40 days', nextDue: addDays(t, 12) }),
      R('sunday', 'The Sunday review', 'Purpose', { t: 'dow', d: 0 }, 30, { when: 'Weekly', screen: '#review' }),
      R('money', 'Money review · the ledger', 'Wealth', { t: 'month' }, 30, { when: 'Monthly', nextDue: nextDueAfter({ freq: { t: 'month' } }, t) }),
      R('cycle', 'Cycle review, pre-mortem, new constraint', 'Purpose', { t: 'none' }, 240, { when: 'Each cycle', fixedNote: 'Review week, early April' }),
      R('think', 'Think Week · read, think, decide the big things', 'Mind', { t: 'none' }, 0, { when: 'Thrice a year', fixedNote: 'Every 4 months · 3 days · dates to set' }),
      R('birthday', 'Birthday letter · the year reviewed', 'Purpose', { t: 'none' }, 0, { when: 'Each year', fixedNote: '23 May' }),
    ],
    days: {},
    wishes: [],
    away: [],
    reviews: {},
    aff: { overrides: {} },
    focus: null,
    reportsSent: {},
  };
}

/* ---------- app state ---------- */
let state = null;
let AFF = null;
const ui = { decide: { i: 0, choice: -1, day: 0, pickDate: '', slot: 0, len: 2, dday: 1, ddate: '', rep: 0, customTime: '' }, listTab: 0, planEdit: false, addRhythm: null, editRhythm: null, ritual: { i: 0 }, wish: null, toast: null, openRow: null };
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { dbSet('state', state); queueSync(); }, 250);
}
function day(dateISO) { const k = dateISO || todayISO(); if (!state.days[k]) state.days[k] = {}; return state.days[k]; }

/* ---------- sync with the Google Sheet (Apps Script web app) ---------- */
let syncTimer = null;
function queueSync() { if (!state.settings.syncUrl) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncPush, 4000); }
function calendarEvents() {
  const t = todayISO(), last = addDays(t, 14);
  return state.tasks.filter((x) => x.date && x.time && x.date >= t && x.date <= last && !x.done && x.list === 'todo')
    .map((x) => ({ id: x.id, title: x.title, date: x.date, time: x.time, mins: x.mins || 30 }));
}
async function syncPush() {
  const s = state.settings; if (!s.syncUrl || !navigator.onLine) return;
  try {
    const body = JSON.stringify({ op: 'save', key: s.syncKey, state, events: s.toggles.calendar ? calendarEvents() : [] });
    const r = await fetch(s.syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body });
    const j = await r.json().catch(() => ({}));
    if (j && j.ok) { s.lastSync = new Date().toISOString(); dbSet('state', state); }
  } catch (e) { /* offline: the next change retries */ }
}
async function syncPull(silent) {
  const s = state.settings; if (!s.syncUrl || !navigator.onLine) return false;
  try {
    const r = await fetch(s.syncUrl + (s.syncUrl.includes('?') ? '&' : '?') + 'op=pull&key=' + encodeURIComponent(s.syncKey));
    const j = await r.json();
    if (!j || !j.ok) { if (!silent) toast('Sync said no. Check the secret word.'); return false; }
    const got = (j.captures || []).filter((c) => c && c.text && !state.notes.some((n) => n.id === c.id));
    got.forEach((c) => state.notes.push({ id: c.id, text: String(c.text).slice(0, 500), at: c.at || new Date().toISOString(), src: 'back tap' }));
    if (got.length) { save(); if (!silent) toast(got.length + ' note' + (got.length > 1 ? 's' : '') + ' from back tap'); render(); }
    return true;
  } catch (e) { if (!silent) toast('Could not reach your Google Sheet.'); return false; }
}
async function syncReport(html, name) {
  const s = state.settings; if (!s.syncUrl) { toast('Set up the Google Sheet first, in Rules.'); return false; }
  try {
    const r = await fetch(s.syncUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ op: 'report', key: s.syncKey, name, html }) });
    const j = await r.json(); return !!(j && j.ok);
  } catch (e) { return false; }
}

/* ---------- rhythms ---------- */
function awayOn(dateISO) { return state.away.find((a) => !a.ended && dateISO >= a.from && dateISO <= a.to) || null; }
function rhythmOpenTask(r) { const t = todayISO(); return state.tasks.find((x) => x.rhythm === r.id && !x.done && x.date && x.date >= t); }
function placedOn(r, dateISO) { return state.tasks.some((x) => x.rhythm === r.id && x.date === dateISO && x.list !== 'gone'); }
function weekStart(dateISO) { const wd = (weekday(dateISO) + 6) % 7; return addDays(dateISO, -wd); }
function isDue(r, dateISO) {
  const t = r.freq.t;
  if (t === 'auto' || t === 'none') return false;
  const a = awayOn(dateISO);
  if (a && a.opts.pause && !(r.family && a.opts.family)) return false;
  if (r.skips.includes(dateISO) || placedOn(r, dateISO)) return false;
  if (t === 'daily') return true;
  if (t === 'week6') { const ws = weekStart(dateISO); return r.done.filter((d) => d >= ws && d < dateISO).length < 6; }
  if (t === 'dow') return weekday(dateISO) === r.freq.d;
  // every N days, monthly: due from nextDue on, unless an open task already holds it
  if (rhythmOpenTask(r)) return false;
  return dateISO >= (r.nextDue || dateISO);
}
function nextDueAfter(r, dateISO) {
  if (r.freq.t === 'every') return addDays(dateISO, r.freq.n);
  if (r.freq.t === 'month') { const d = parseISO(dateISO); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1); while (n.getDay() !== 0) n.setDate(n.getDate() + 1); return iso(n); }
  return addDays(dateISO, 1);
}
function freqLabel(r) {
  const f = r.freq;
  if (f.t === 'daily') return 'every day'; if (f.t === 'week6') return '6 days a week'; if (f.t === 'dow') return 'every Sunday';
  if (f.t === 'month') return 'every month'; if (f.t === 'every') return f.n === 7 ? 'once a week' : f.n === 2 ? 'every other day' : 'every ' + f.n + ' days';
  return '';
}
function rhythmDone(r, dateISO) {
  if (!r.done.includes(dateISO)) r.done.push(dateISO);
  r.last = dateISO; r.nextDue = nextDueAfter(r, dateISO);
}

/* ---------- tasks and scheduling ---------- */
function tasksOn(dateISO) { return state.tasks.filter((x) => x.date === dateISO && x.list === 'todo').sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999)); }
function busyOn(dateISO, exceptId) {
  const b = [];
  tasksOn(dateISO).forEach((x) => { if (x.id !== exceptId && x.time && !x.done) { const s = toMin(x.time); b.push([s, s + (x.mins || 30)]); } });
  const d = state.days[dateISO]; if (d && d.lunchAt) b.push([toMin(d.lunchAt), toMin(d.lunchAt) + state.settings.lunch.mins]);
  return b;
}
function freeSlots(dateISO, len, max) {
  const busy = busyOn(dateISO);
  const pk = peakFor(dateISO);
  const isToday = dateISO === todayISO();
  let from = Math.max(isToday ? ceil30(nowMin() + 5) : 0, ceil30(wakeFor(dateISO) + 15), 6 * 60);
  const to = 22 * 60;
  const out = [];
  for (let s = from; s + len <= to && out.length < (max || 9); s += 30) {
    if (busy.some(([a, b]) => s < b && s + len > a)) continue;
    const tag = s >= pk.start && s < pk.end ? 'peak' : (s >= 14 * 60 && s < 15 * 60 ? 'dip' : (s >= 18 * 60 ? 'evening' : 'free'));
    out.push({ time: hm(s), tag });
  }
  return out;
}
function addTask(t) { const x = Object.assign({ id: uid(), list: 'todo', mins: 30, area: 'Wealth', created: new Date().toISOString(), done: false }, t); state.tasks.push(x); return x; }
function completeTask(x, done) {
  x.done = done; x.doneAt = done ? new Date().toISOString() : null;
  if (done && x.started && !x.actual) x.actual = Math.max(1, Math.round((Date.now() - new Date(x.started).getTime()) / 60000));
  if (x.rhythm) { const r = state.rhythms.find((y) => y.id === x.rhythm); if (r) { if (done) rhythmDone(r, x.date || todayISO()); else r.done = r.done.filter((d) => d !== x.date); } }
  if (done && x.repeat && x.repeat !== 'once' && !x.spawned) {
    x.spawned = true;
    const nd = x.repeat === 'week' ? addDays(x.date, 7) : (() => { const d = parseISO(x.date); d.setMonth(d.getMonth() + 1); return iso(d); })();
    addTask({ title: x.title, list: 'dated', date: nd, mins: x.mins, repeat: x.repeat, area: x.area });
  }
}

/* ---------- Decide queue ---------- */
function decideQueue() {
  const t = todayISO();
  const q = [];
  const d = state.days[t] || {};
  if (d.oneText && !d.onePlaced) q.push({ kind: 'one', text: d.oneText, meta: 'Your ONE Thing · chosen last night', len: 90 });
  state.rhythms.forEach((r) => { if (isDue(r, t)) q.push({ kind: 'rhythm', r, text: r.name, meta: 'Rhythm · due today · ' + freqLabel(r), len: r.len, fixed: !!r.fixed, note: r.note || '' }); });
  state.tasks.filter((x) => x.list === 'dated' && x.date <= t).forEach((x) => q.push({ kind: 'dated', x, text: x.title, meta: (x.date < t ? 'Was due ' + fmtDM(x.date) : 'On a date · today') + (x.repeat && x.repeat !== 'once' ? ' · every ' + x.repeat : ''), len: x.mins || 30 }));
  state.notes.forEach((n) => q.push({ kind: 'note', n, text: n.text, meta: 'Captured ' + capturedLabel(n.at) + ' · ' + (n.src || 'typed') }));
  return q;
}
function capturedLabel(at) {
  const d = new Date(at); const k = iso(d);
  const time = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (k === iso(new Date())) return time; if (k === addDays(iso(new Date()), -1)) return 'yesterday'; return fmtDM(k);
}
function decideCount() { return decideQueue().length; }

/* ---------- affirmations ---------- */
function affDay(dateISO) { const n = daysBetween(state.settings.affStart, dateISO); return ((n % 30) + 30) % 30; }
function affFor(dateISO) {
  const k = affDay(dateISO);
  return AREAS.map((a, i) => ({ area: a, text: state.aff.overrides[k + ':' + i] || (AFF && AFF[a] ? AFF[a][k] : '') }));
}

/* ---------- cycle and goals ---------- */
function cycleInfo() {
  const p = state.plan, t = todayISO();
  const total = Math.max(1, Math.floor((daysBetween(p.cycleStart, p.cycleEnd) + 1) / 7));
  const week = Math.min(total, Math.max(1, Math.floor(daysBetween(p.cycleStart, t) / 7) + 1));
  const salesNow = p.sales.start + p.sales.weeks.reduce((s, w) => s + (w.lakh || 0), 0) / 100;
  const weeksLeft = Math.max(1, total - week + 1);
  const needWeekly = Math.max(0, (p.sales.target - salesNow) * 100 / weeksLeft);
  return { total, week, salesNow, weeksLeft, needWeekly };
}

/* ---------- toast ---------- */
function toast(msg) { ui.toast = msg; const el = document.querySelector('.toast'); if (el) el.remove(); const n = document.createElement('div'); n.className = 'toast'; n.setAttribute('role', 'status'); n.textContent = msg; document.body.appendChild(n); clearTimeout(toast.t); toast.t = setTimeout(() => n.remove(), 2600); }

/* =====================================================================
   SCREENS
   ===================================================================== */
const routes = {};
function tabs(active) {
  const n = decideCount();
  const L = [['today', 'Today'], ['plan', 'Plan'], ['decide', 'Decide'], ['lists', 'Lists'], ['review', 'Review']];
  return '<div class="tabs noprint"><nav aria-label="Main">' + L.map(([k, l]) => '<a href="#' + k + '"' + (k === active ? ' aria-current="page"' : '') + '>' + l + (k === 'decide' && n ? '<span class="badge" aria-label="' + n + ' to decide">' + n + '</span>' : '') + '</a>').join('') + '</nav></div>';
}
const fab = () => '<a class="fab noprint" href="#capture" aria-label="Quick capture">' + ICON.plus + '</a>';
const backBtn = (href, label) => '<a class="iconbtn" href="' + href + '" aria-label="' + esc(label || 'Back') + '">' + ICON.back + '</a>';

/* ----- 1 · Morning ritual ----- */
routes.ritual = () => {
  const t = todayISO(), d = day(t);
  const list = affFor(t);
  if (!d.said) d.said = [false, false, false, false, false];
  const wishes = state.wishes.filter((w) => w.status === 'active');
  const total = 5 + (wishes.length ? 1 : 0);
  const i = Math.min(ui.ritual.i, total - 1);
  document.body.className = 'theme-green';
  const bars = Array.from({ length: total }, (_, k) => '<i style="background:' + (k < 5 ? (d.said[k] ? AREA_SOFT[AREAS[k]] : (k === i ? '#CFE0D7' : '#3E7562')) : (k === i ? '#F2C14E' : '#3E7562')) + '"></i>').join('');
  let body;
  if (i < 5) {
    const c = list[i];
    body = '<span class="kicker" style="color:' + AREA_SOFT[c.area] + ';letter-spacing:.3em">' + ['I', 'II', 'III', 'IV', 'V'][i] + ' · ' + c.area + '</span>'
      + '<p class="quote">“' + esc(c.text) + '”</p>'
      + '<div style="display:flex;align-items:center;gap:16px;padding-top:6px"><svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" stroke="#3E7562" stroke-width="1.5"/><circle cx="32" cy="32" r="18" fill="' + AREA_SOFT[c.area] + '" opacity=".9"><animate attributeName="r" values="12;24;24;12" keyTimes="0;.29;.57;1" dur="14s" repeatCount="indefinite"/></circle></svg>'
      + '<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px">Breathe in for 4 · hold 4 · out for 6</span><span class="small">Say it slowly, and picture it already true</span></div></div>';
  } else {
    body = '<span class="kicker" style="color:#F2C14E;letter-spacing:.3em">Your wishes</span>' + wishes.map((w) => '<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #3E7562;padding-top:12px"><span class="small">' + esc(w.title) + ' · ' + Math.max(0, daysBetween(t, w.by)) + ' days</span><p class="quote" style="font-size:24px">“' + esc(w.say) + '”</p><span class="small">See it: ' + esc(w.see) + '</span><span class="small">If, then: ' + esc(w.ifthen) + '</span></div>').join('');
  }
  const wake = d.wake || hm(nowMin());
  const said = i < 5 ? d.said[i] : false;
  return '<div class="screen notab green" style="gap:18px">'
    + '<div class="top"><a class="iconbtn" href="#today" aria-label="Close the ritual">' + ICON.close + '</a><span class="eyebrow" style="color:#CFE0D7">First open today · ' + wake + ' · Day ' + (affDay(t) + 1) + ' of 30</span></div>'
    + '<div class="seg" style="grid-template-columns:repeat(' + total + ',1fr)" aria-hidden="true">' + bars + '</div>'
    + '<main style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:22px">' + body + '</main>'
    + '<div style="display:grid;grid-template-columns:56px 1fr 56px;gap:10px;align-items:center">'
    + '<button class="iconbtn" style="width:56px;height:56px;border-radius:28px;border:1px solid #4F8370" data-a="ritualPrev" aria-label="Previous">' + ICON.prev + '</button>'
    + (i < 5 ? '<button class="btn gold" style="border-radius:28px;min-height:56px" data-a="ritualSay" aria-pressed="' + said + '">' + (said ? 'Spoken' : 'I have said it') + '</button>' : '<button class="btn gold" style="border-radius:28px;min-height:56px" data-a="ritualDone">Begin the day</button>')
    + '<button class="iconbtn" style="width:56px;height:56px;border-radius:28px;border:1px solid #4F8370" data-a="ritualNext" aria-label="Next">' + ICON.next + '</button></div>'
    + '<button class="link" style="color:#F2C14E;justify-content:center;min-height:44px" data-a="ritualDone">' + (decideCount() ? 'Then empty Decide · ' + decideCount() + ' waiting' : 'Then your day re-plans from ' + wake) + '</button>'
    + '</div>';
};

/* ----- 2 · Capture ----- */
routes.capture = (q) => {
  const recent = state.notes.slice(-4).reverse();
  return '<div class="screen notab">'
    + '<div class="top">' + backBtn('#today', 'Back to today') + '<span class="eyebrow">Layer I · Capture</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><h1>Out of your head.</h1><p class="lede">No sorting now. Just keep it, and decide later.</p></div>'
    + '<label class="field"><span class="sr">Your note</span><textarea id="capText" class="input" rows="4" placeholder="Type, or tap the mic on the keyboard to speak" style="font-family:var(--text);font-size:19px;background:var(--card)">' + esc(q.text || '') + '</textarea></label>'
    + '<button class="btn" data-a="capSave">Keep it · decide later</button>'
    + (recent.length ? '<section class="sec"><div class="sechead"><span class="kicker" style="color:var(--muted)">Waiting in Decide · ' + state.notes.length + '</span><a class="link" href="#decide">Decide now</a></div>' + recent.map((n) => '<div class="row"><span class="grow"><span class="t">' + esc(n.text) + '</span><span class="s">' + capturedLabel(n.at) + ' · ' + esc(n.src || 'typed') + '</span></span></div>').join('') + '</section>' : '')
    + '<div class="card"><span class="kicker">Back tap</span><span class="small">Double-tap the back of your iPhone to capture from anywhere. Set it up once in Rules → Shortcuts.</span></div>'
    + '</div>';
};

/* ----- 3 · Decide ----- */
routes.decide = () => {
  const q = decideQueue();
  const s = ui.decide;
  if (s.i >= q.length) s.i = 0;
  const cur = q[s.i];
  const t = todayISO();
  if (!cur) {
    return '<div class="screen"><div class="top"><span class="eyebrow">Layer II · Decide</span></div><h1>Empty it, every day</h1>'
      + '<section class="panel green"><span class="kicker" style="color:#F2C14E;letter-spacing:.24em">Notes · 0</span><span class="serif" style="font-size:30px;line-height:1.15">Empty. Your mind is clear.</span><span class="small">Every rhythm has its slot, and every note has a place.</span><a class="btn gold" href="#today">See today</a></section>'
      + '</div>' + tabs('decide');
  }
  const isRhythm = cur.kind === 'rhythm' || cur.kind === 'one', isDated = cur.kind === 'dated';
  const defs = isRhythm
    ? [['todo', 'Place it', 'Pick a day and an hour', '#8A5A00'], ['skip', cur.kind === 'one' ? 'Not tomorrow' : 'Skip this time', cur.kind === 'one' ? 'Choose another tonight' : 'Shows as missed in the report', '#6E7771']]
    : isDated ? [['todo', 'Place it', 'Pick an hour for it', '#8A5A00'], ['date', 'Another date', 'Bring it back later', '#A3324F'], ['go', 'Let it go', 'Delete it', '#6E7771']]
    : [['todo', 'To-do', 'Pick a day and an hour', '#8A5A00'], ['date', 'On a date', 'No hour yet · it comes back that day', '#A3324F'], ['wait', 'Waiting list', 'Do it when a slot frees up', '#26487A'], ['someday', 'Someday', 'Keep it for later', '#2F7A4F'], ['go', 'Let it go', 'Delete it', '#6E7771']];
  if (s.choice >= defs.length) s.choice = -1;
  const key = s.choice >= 0 ? defs[s.choice][0] : '';
  const days = [['Today', fmtShort(t), t], ['Tomorrow', fmtShort(addDays(t, 1)), addDays(t, 1)], ['Pick a date', s.pickDate ? fmtShort(s.pickDate) : 'calendar', s.pickDate || addDays(t, 2)]];
  const dsel = days[s.day][2];
  const fixedLen = cur.fixed ? cur.len : null;
  if (!s.lenTouched && cur.len && !fixedLen) s.len = nearestLen(cur.len);
  const lenIdx = fixedLen ? -1 : s.len;
  const lenMins = fixedLen || LENS[s.len];
  const slots = freeSlots(dsel, lenMins, 9);
  if (s.slot >= slots.length) s.slot = 0;
  const slot = s.customTime || (slots[s.slot] && slots[s.slot].time) || '';
  const bars = q.map((_, k) => '<i style="background:' + (k < s.i ? 'var(--emerald)' : k === s.i ? 'var(--sun)' : 'var(--faint)') + '"></i>').join('');
  let panel = '';
  if (key === 'todo') {
    panel = '<div style="border-top:1px solid var(--ink);padding-top:14px;display:flex;flex-direction:column;gap:12px">'
      + (isDated ? '' : '<span class="kicker">Which day</span><div class="grid3">' + days.map((d, k) => '<button class="chip" data-a="dDay" data-k="' + k + '" aria-pressed="' + (s.day === k) + '">' + d[0] + '<small>' + esc(d[1]) + '</small></button>').join('') + '</div>'
      + (s.day === 2 ? '<input type="date" class="input" data-in="pickDate" value="' + esc(s.pickDate) + '" min="' + t + '" aria-label="Pick a date">' : ''))
      + '<span class="kicker">Free slots · ' + (s.day === 0 || isDated ? 'today' : s.day === 1 ? 'tomorrow' : fmtShort(dsel)) + '</span>'
      + (slots.length ? '<div class="grid3">' + slots.map((x, k) => '<button class="chip" data-a="dSlot" data-k="' + k + '" aria-pressed="' + (!s.customTime && s.slot === k) + '" style="min-height:52px"><span class="num" style="font-size:15px">' + x.time + '</span><small>' + x.tag + '</small></button>').join('') + '</div>' : '<div class="empty">No free slot of that length left. Try tomorrow or a shorter time.</div>')
      + '<label class="pill">Or a time of your own <input type="time" class="input" style="width:130px;min-height:40px;padding:4px 8px" data-in="customTime" value="' + esc(s.customTime) + '"></label>'
      + '<span class="kicker">' + (fixedLen ? 'How long · fixed' : 'How long') + '</span>'
      + '<div class="grid3">' + (fixedLen ? '<button class="chip" aria-pressed="true">' + lenLabel(fixedLen) + '</button>' : LENS.map((m, k) => '<button class="chip" data-a="dLen" data-k="' + k + '" aria-pressed="' + (lenIdx === k) + '">' + lenLabel(m) + '</button>').join('')) + '</div>'
      + (cur.note ? '<span class="small">' + esc(cur.note) + '</span>' : '')
      + '</div>';
  } else if (key === 'date') {
    const dd = [['Tomorrow', fmtShort(addDays(t, 1)), addDays(t, 1)], ['1st of month', fmtShort(firstOfNextMonth(t)), firstOfNextMonth(t)], ['Pick a date', s.ddate ? fmtShort(s.ddate) : 'calendar', s.ddate || addDays(t, 7)]];
    panel = '<div style="border-top:1px solid var(--ink);padding-top:14px;display:flex;flex-direction:column;gap:12px"><span class="kicker" style="color:var(--rose)">Which date</span><div class="grid3">'
      + dd.map((d, k) => '<button class="chip" style="--c:var(--rose)" data-a="dDDay" data-k="' + k + '" aria-pressed="' + (s.dday === k) + '">' + d[0] + '<small>' + esc(d[1]) + '</small></button>').join('') + '</div>'
      + (s.dday === 2 ? '<input type="date" class="input" data-in="ddate" value="' + esc(s.ddate) + '" min="' + addDays(t, 1) + '" aria-label="Pick a date">' : '')
      + (isDated ? '' : '<span class="kicker" style="color:var(--rose)">Repeat</span><div class="grid3">' + ['Once', 'Every week', 'Every month'].map((r, k) => '<button class="chip" style="--c:var(--rose)" data-a="dRep" data-k="' + k + '" aria-pressed="' + (s.rep === k) + '">' + r + '</button>').join('') + '</div>')
      + '<p class="small" style="margin:0;font-size:13px">No hour needed now. That morning it comes back to Decide with your rhythms, and you place it in a slot.</p></div>';
  } else if (key === 'wait') {
    panel = '<div style="border-top:1px solid var(--ink);padding-top:14px;display:flex;flex-direction:column;gap:12px"><span class="kicker" style="color:var(--sapphire)">How long does it take?</span><div class="grid3">'
      + LENS.map((m, k) => '<button class="chip" style="--c:var(--sapphire)" data-a="dLen" data-k="' + k + '" aria-pressed="' + (s.len === k) + '">' + lenLabel(m) + '</button>').join('') + '</div><p class="small" style="margin:0;font-size:13px">A backup task. When a planned task can’t happen, the app offers Waiting list tasks that fit the free time.</p></div>';
  } else if (key === 'someday') panel = '<p class="small" style="margin:0;border-top:1px solid var(--ink);padding-top:14px;font-size:13px">Kept safe in Someday. You’ll see it again in Sunday’s review.</p>';
  else if (key === 'go') panel = '<p class="small" style="margin:0;border-top:1px solid var(--ink);padding-top:14px;font-size:13px">It will be deleted. If it matters, it will come back to you.</p>';
  else if (key === 'skip') panel = '<p class="small" style="margin:0;border-top:1px solid var(--ink);padding-top:14px;font-size:13px">' + (cur.kind === 'one' ? 'Tonight’s shutdown will ask again.' : 'It comes back next time it is due. The report shows it as missed.') + '</p>';
  const ddList = [addDays(t, 1), firstOfNextMonth(t), s.ddate || ''];
  const cta = {
    todo: (slot ? (isRhythm || isDated ? 'Book it · ' : 'Add to ') + (isDated ? 'today' : s.day === 0 ? 'today' : s.day === 1 ? 'tomorrow' : fmtShort(dsel)) + ' · ' + slot + ' · ' + lenLabel(lenMins) : 'Pick a slot first'),
    date: (ddList[s.dday] ? 'Bring it back · ' + fmtShort(ddList[s.dday]) + (s.rep && !isDated ? ' · ' + ['', 'every week', 'every month'][s.rep] : '') : 'Pick a date first'),
    wait: 'Add to Waiting list · ' + lenLabel(LENS[s.len]), someday: 'Move to Someday', go: 'Let it go', skip: cur.kind === 'one' ? 'Not this one' : 'Skip it this time',
  }[key];
  return '<div class="screen" style="gap:18px">'
    + '<div class="top"><span class="eyebrow">Layer II · Decide</span><span class="small">' + (s.i + 1) + ' of ' + q.length + '</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><h1 style="font-size:34px">Empty it, every day</h1><div class="seg" style="grid-template-columns:repeat(' + q.length + ',1fr)">' + bars + '</div></div>'
    + '<div class="card" style="gap:6px"><span class="small" style="font-weight:500;color:' + (isRhythm ? 'var(--sapphire)' : isDated ? 'var(--rose)' : 'var(--muted)') + '">' + esc(cur.meta) + '</span><p style="margin:0;font-family:var(--text);font-style:italic;font-size:21px;line-height:1.35">' + esc(cur.text) + '</p>' + (cur.note && key !== 'todo' ? '<span class="small">' + esc(cur.note) + '</span>' : '') + '</div>'
    + '<div class="grid2">' + defs.map((d, k) => '<button class="choice' + (defs.length % 2 && k === defs.length - 1 ? ' wide' : '') + '" style="--c:' + d[3] + '" data-a="dChoice" data-k="' + k + '" aria-pressed="' + (s.choice === k) + '"><b>' + d[1] + '</b><span>' + d[2] + '</span></button>').join('') + '</div>'
    + panel
    + (key ? '<button class="btn" data-a="dConfirm" ' + ((key === 'todo' && !slot) || (key === 'date' && !ddList[s.dday]) ? 'disabled' : '') + '>' + esc(cta) + '</button>' : '<div class="btn quiet">Choose where it goes</div>')
    + (q.length > 1 ? '<div style="display:flex;justify-content:space-between"><button class="link" data-a="dPrev" ' + (s.i === 0 ? 'disabled style="opacity:.4"' : '') + '>‹ Previous</button><button class="link" data-a="dSkipItem">Later in the list ›</button></div>' : '')
    + '<p class="small" style="margin:0">The day can’t close until this list is empty. At the end of your day, the shutdown asks you to sort anything left.</p>'
    + '</div>' + tabs('decide');
};
function nearestLen(m) { let b = 0; LENS.forEach((x, k) => { if (Math.abs(x - m) < Math.abs(LENS[b] - m)) b = k; }); return b; }
function firstOfNextMonth(t) { const d = parseISO(t); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

/* ----- 4 · Today ----- */
routes.today = () => {
  const t = todayISO(), d = day(t), tm = addDays(t, 1);
  const b = brahma(t), b2 = brahma(tm);
  const pk = peakFor(t);
  const ci = cycleInfo();
  const now = nowMin();
  const hr = new Date().getHours();
  const greet = hr < 12 && hr >= 4 ? 'Good morning,' : hr < 17 && hr >= 12 ? 'Good afternoon,' : 'Good evening,';
  const list = tasksOn(t);
  const one = d.one ? state.tasks.find((x) => x.id === d.one) : list.find((x) => x.one);
  const planned = list.reduce((s, x) => s + (x.mins || 0), 0);
  const avail = Math.max(60, 22 * 60 - Math.max(wakeFor(t), 6 * 60));
  const deep = (d.focus || []).reduce((s, f) => s + f.mins, 0);
  // sun arc
  const span = Math.max(1, b.sunset - b.sunrise);
  const pos = Math.min(1, Math.max(0, (now - b.sunrise) / span));
  const px = 10 + 322 * pos, py = 62 - Math.sin(Math.PI * pos) * 52;
  const three = (d.three || []).map((id) => state.tasks.find((x) => x.id === id)).filter(Boolean);
  const threeRows = three.length ? three : list.filter((x) => !x.rhythm).slice(0, 3);
  const nextUp = list.find((x) => !x.done && x.time && toMin(x.time) + (x.mins || 30) > now && x !== one);
  const alarmOn = !!(state.days[tm] && state.days[tm].alarm);
  const away = awayOn(t);
  const html = '<div class="screen">'
    + '<div class="top"><a class="avatar" href="#rules" aria-label="Rules and settings">' + esc(state.settings.initials) + '</a><span class="eyebrow">Week ' + ci.week + ' of ' + ci.total + ' · to ' + fmtDM(state.plan.cycleEnd) + '</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><h1 style="font-size:44px;line-height:1.02">' + greet + '<br><span style="color:var(--emerald)">' + esc(state.settings.name) + '</span></h1><p class="lede" style="font-size:16px">' + fmtFormal(t) + '</p></div>'
    + (away ? '<div class="card" style="border-color:var(--sapphire)"><span class="kicker" style="color:var(--sapphire)">Away mode · ' + esc(away.kind) + '</span><span class="small">Until ' + fmtShort(away.to) + '. Rhythms paused, streaks frozen.</span><a class="link" href="#away">Change or end early</a></div>' : '')
    + '<div class="brahma"><span style="display:flex;justify-content:space-between;align-items:baseline"><span class="kicker">Brahma Muhurta</span><span class="small">' + esc(state.settings.city) + ' · sunrise ' + hm(b.sunrise) + '</span></span>'
    + '<span class="grid2" style="gap:10px"><span class="stat"><span>Today</span><b class="num" style="font-family:var(--sans);font-size:17px;font-weight:600">' + hm(b.start) + ' – ' + hm(b.end) + '</b></span><span class="stat"><span>Tomorrow</span><b class="num" style="font-family:var(--sans);font-size:17px;font-weight:600">' + hm(b2.start) + ' – ' + hm(b2.end) + '</b></span></span>'
    + '<button class="btn ghost" style="min-height:44px;color:var(--saffron);border-color:var(--saffron);' + (alarmOn ? 'background:var(--saffron);color:#F6F5F0' : '') + '" data-a="alarm" aria-pressed="' + alarmOn + '">' + ICON.alarm + (alarmOn ? 'Alarm set · tomorrow ' + hm(b2.alarm) + ' · tap to undo' : 'Set alarm for tomorrow · ' + hm(b2.alarm)) + '</button></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px"><svg viewBox="0 0 342 70" width="100%" height="70" role="img" aria-label="Where the sun is now"><path d="M10 62 Q171 -42 332 62" fill="none" stroke="#CFCBB8" stroke-width="1.5" stroke-dasharray="3 5"/><line x1="0" y1="62" x2="342" y2="62" stroke="#1F2A24"/><circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="11" fill="#F6D78A"/><circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6" fill="#E0A21B"/></svg>'
    + '<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted)" class="num"><span>Sunrise ' + hm(b.sunrise) + '</span><span style="color:var(--saffron);font-weight:600">Peak ' + hm(pk.start) + ' – ' + hm(pk.end) + '</span><span>Sunset ' + hm(b.sunset) + '</span></div></div>'
    + (one ? '<section class="panel green" style="margin:0 -20px;padding:24px 20px"><span style="display:flex;justify-content:space-between;align-items:baseline"><span class="kicker" style="color:#F2C14E;letter-spacing:.24em">Your ONE Thing</span><span class="small">' + (one.time ? one.time + ' · ' : '') + (one.time && toMin(one.time) >= pk.start && toMin(one.time) < pk.end ? 'peak hours' : lenLabel(one.mins || 90)) + '</span></span>'
      + '<p class="serif" style="margin:0;font-size:28px;line-height:1.2">' + esc(one.title) + '</p>'
      + (one.done ? '<span class="small" style="color:#9ED3B2">Done today. The day is already a win.</span>' : '<a class="btn gold" href="#focus/' + one.id + '">Start the quiet hour</a>')
      + '<button class="link" style="color:#CFE0D7" data-a="pickOne">Change</button></section>'
      : '<section class="card" style="border-color:var(--emerald)"><span class="kicker" style="color:var(--emerald)">Your ONE Thing</span><span class="small">Pick the one task that makes everything else easier today.</span>' + (list.filter((x) => !x.done).length ? '<button class="btn" data-a="pickOne">Choose from today</button>' : '<a class="btn" href="#decide">Plan today in Decide</a>') + '</section>')
    + (ui.pickOne ? '<section class="card"><span class="kicker">Choose the ONE Thing</span>' + list.filter((x) => !x.done && !x.rhythm).map((x) => '<button class="row" style="border:none;border-bottom:1px solid var(--rule);background:transparent;text-align:left" data-a="setOne" data-id="' + x.id + '"><span class="grow"><span class="t">' + esc(x.title) + '</span><span class="s">' + (x.time || '') + ' · ' + lenLabel(x.mins || 30) + '</span></span></button>').join('') + '<button class="link" data-a="pickOneClose">Cancel</button></section>' : '')
    + '<div class="grid3" style="gap:0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)">'
    + '<span class="stat" style="padding:12px 8px 12px 0"><b class="num">' + lenLabel(planned).replace(' min', 'm') + '</b><span>planned of ' + Math.round(avail / 60) + ' h awake</span></span>'
    + '<span class="stat" style="padding:12px 8px;border-left:1px solid var(--rule)"><b class="num" style="color:var(--sapphire)">' + (deep >= 60 ? (deep / 60).toFixed(1) + ' h' : deep + 'm') + '</b><span>deep work · min ' + state.settings.limits.deep / 60 + ' h</span></span>'
    + '<span class="stat" style="padding:12px 0 12px 8px;border-left:1px solid var(--rule)"><b class="num" style="color:var(--saffron)">' + decideCount() + '</b><span>to decide</span></span></div>'
    + (threeRows.length ? '<section class="sec"><div class="sechead"><h2>The day’s three</h2><span class="small">limit of three</span></div>' + threeRows.slice(0, 3).map((x, k) => '<div class="row" style="min-height:64px"><span class="serif" style="width:22px;font-size:20px;color:' + AREA_INK[x.area || 'Wealth'][0] + '">' + ['I', 'II', 'III'][k] + '</span><span class="grow"><span class="t" style="' + (x.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(x.title) + '</span><span class="s">' + esc(x.area || '') + (x.time ? ' · ' + x.time : '') + ' · ' + lenLabel(x.mins || 30) + '</span></span><button class="tick" style="--c:' + AREA_INK[x.area || 'Wealth'][0] + '" data-a="done" data-id="' + x.id + '" aria-pressed="' + !!x.done + '" aria-label="Done"></button></div>').join('') + '</section>' : '')
    + (ui.cant && state.tasks.find((x) => x.id === ui.cant) ? (() => { const c = state.tasks.find((x) => x.id === ui.cant); return '<section class="card" style="border-color:var(--sapphire)"><span class="kicker" style="color:var(--sapphire)">Freed up · ' + (c.cantFrom && c.cantFrom.time ? c.cantFrom.time : 'now') + '</span><span class="serif" style="font-size:20px">' + esc(c.title) + '</span>' + cantPanel(c) + '</section>'; })()
      : nextUp ? '<section class="card" style="border-color:var(--sapphire)"><span class="kicker" style="color:var(--sapphire)">Next up · ' + nextUp.time + '</span><span class="serif" style="font-size:20px">' + esc(nextUp.title) + '</span><span class="small">' + lenLabel(nextUp.mins || 30) + (nextUp.rhythm ? ' · rhythm' : '') + '</span>'
      + '<div class="grid2"><a class="btn" style="min-height:46px" href="#focus/' + nextUp.id + '">Start</a><button class="btn ghost" style="min-height:46px;color:var(--sapphire)" data-a="cant" data-id="' + nextUp.id + '">Can’t do it now</button></div></section>' : '')
    + '<section class="sec"><div class="sechead"><h2>The plan</h2><span class="small">placed by you in Decide</span></div>'
    + (list.length ? list.map((x) => planRow(x, pk)).join('') : '<div class="empty" style="margin-top:12px">Nothing placed yet. <a href="#decide">Empty Decide</a> to build your day.</div>')
    + lunchRow(t)
    + '</section>'
    + '<div class="grid2"><a class="card" href="' + BRIEF_URL + '" target="_blank" rel="noopener" style="color:var(--ink)"><span class="kicker">Morning brief</span><span class="small">The world today · ready by 9 AM</span></a><a class="card" href="#manifest" style="color:var(--ink)"><span class="kicker" style="color:var(--emerald)">Wishes</span><span class="small">' + state.wishes.filter((w) => w.status === 'active').length + ' active · read each morning</span></a></div>'
    + '</div>' + fab() + tabs('today');
  return html;
};
function planRow(x, pk) {
  const inPeak = x.time && toMin(x.time) >= pk.start && toMin(x.time) < pk.end;
  const ink = AREA_INK[x.area || 'Wealth'];
  return '<div class="row"><span class="num" style="width:44px;font-size:13px;font-weight:600;color:' + (inPeak ? 'var(--emerald)' : 'var(--muted)') + '">' + (x.time || '—') + '</span><span class="dot" style="background:' + ink[1] + '"></span><span class="grow"><span class="t" style="' + (x.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(x.title) + '</span><span class="s" style="color:' + ink[0] + '">' + (x.rhythm ? 'Rhythm · ' : '') + lenLabel(x.mins || 30) + (inPeak ? ' · peak hours' : '') + (x.filled ? ' · from Waiting list' : '') + '</span></span><button class="tick" style="--c:' + ink[0] + '" data-a="done" data-id="' + x.id + '" aria-pressed="' + !!x.done + '" aria-label="Mark done"></button></div>';
}
function lunchRow(t) {
  const d = state.days[t] || {}; const L = state.settings.lunch;
  return '<div class="row"><span class="num" style="width:44px;font-size:13px;font-weight:600;color:var(--jade)">' + (d.lunchAt || 'Flex') + '</span><span class="dot" style="background:var(--jade-2)"></span><span class="grow"><span class="t">Lunch · whenever you go</span><span class="s" style="color:var(--jade)">' + (d.lunchAt ? lenLabel(L.mins) + ' · the plan moved around it' : 'Any time ' + L.from + '–' + L.to) + '</span></span>' + (d.lunchAt ? '' : '<button class="chip" style="width:auto;min-height:36px;padding:0 12px;--c:var(--jade)" data-a="lunch">Lunch now</button>') + '</div>';
}
function cantPanel(x) {
  const fillers = state.tasks.filter((w) => w.list === 'waiting' && (w.mins || 30) <= (x.mins || 30));
  const used = state.tasks.filter((w) => w.filledFor === x.id).reduce((s, w) => s + (w.mins || 0), 0);
  return '<p class="small" style="margin:0;font-size:13px;color:var(--ink)">Moved to tomorrow, back in Decide. <b>' + lenLabel(x.mins || 30) + ' free</b> now. Fill it from your Waiting list:</p>'
    + (fillers.length ? fillers.slice(0, 4).map((w) => '<button class="row" style="border:none;border-bottom:1px solid var(--rule);background:transparent;text-align:left;width:100%" data-a="fill" data-id="' + w.id + '" data-for="' + x.id + '"><span class="grow"><span class="t">' + esc(w.title) + '</span><span class="s">' + lenLabel(w.mins || 30) + ' · from your Waiting list</span></span><span class="chip" style="width:auto;padding:0 12px;min-height:36px;--c:var(--sapphire)">Do it now</span></button>').join('') : '<div class="empty">Your Waiting list is empty. Rest, or pick something from Lists.</div>')
    + '<span class="small">' + used + ' of ' + (x.mins || 30) + ' free minutes filled</span><button class="btn ghost" style="min-height:44px" data-a="cantDone" data-id="' + x.id + '">Done</button>';
}

/* ----- 5 · Plan ----- */
routes.plan = () => {
  const p = state.plan, ci = cycleInfo();
  const segs = Array.from({ length: ci.total }, (_, k) => '<i style="background:' + (k < ci.week - 1 ? 'var(--emerald)' : k === ci.week - 1 ? 'var(--gold)' : 'var(--faint)') + '"></i>').join('');
  const salesPct = Math.round(ci.salesNow / p.sales.target * 100);
  const wk = weekStart(todayISO());
  const gymDays = (state.rhythms.find((r) => r.id === 'gym') || { done: [] }).done.filter((d) => d >= wk).length;
  const fam = state.rhythms.filter((r) => r.family).reduce((s, r) => s + r.done.filter((d) => d >= wk).length, 0);
  const goalVal = { sales: ['₹' + ci.salesNow.toFixed(1) + ' of ' + p.sales.target + ' cr', salesPct], gym: [gymDays + ' of 6 this week', Math.round(gymDays / 6 * 100)], family: [fam + ' calls this week', Math.min(100, Math.round(fam / 11 * 100))] };
  const ed = ui.planEdit;
  return '<div class="screen">'
    + '<div class="top"><span class="eyebrow">Layer III · Plan</span><button class="link" data-a="planEdit">' + (ed ? 'Done' : 'Edit') + '</button></div>'
    + '<section class="sec" style="gap:8px"><span class="kicker">The vision · 2029</span>' + (ed ? '<textarea class="input" rows="3" data-in="vision">' + esc(p.vision) + '</textarea>' : '<p class="serif" style="margin:0;font-size:26px;line-height:1.2">' + esc(p.vision) + '</p>') + '</section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>This cycle</h2><span class="small">now to ' + fmtDM(p.cycleEnd) + '</span></div><div class="seg" style="grid-template-columns:repeat(' + ci.total + ',1fr)">' + segs + '</div><span class="small">Week ' + ci.week + ' of ' + ci.total + ' · then a review week</span></section>'
    + '<section class="panel green" style="margin:0 -20px;padding:22px 20px"><span class="kicker" style="color:#F2C14E;letter-spacing:.24em">The constraint · Theory of Constraints</span>'
    + (ed ? '<input class="input" data-in="constraintTitle" value="' + esc(p.constraint.title) + '"><textarea class="input" rows="2" data-in="constraintDetail">' + esc(p.constraint.detail) + '</textarea>' : '<p class="serif" style="margin:0;font-size:26px">' + esc(p.constraint.title) + '.</p><span class="small">' + esc(p.constraint.detail) + '</span>')
    + '<span class="small">To stay on the path now: <b style="color:#F2C14E">₹' + Math.round(ci.needWeekly) + ' lakh a week</b> · ₹' + ci.salesNow.toFixed(2) + ' cr billed so far</span></section>'
    + '<section class="sec"><div class="sechead"><h2>Three goals</h2><span class="small">by ' + fmtDM(p.cycleEnd) + '</span></div>'
    + p.goals.map((g, k) => { const v = goalVal[g.kind] || ['', 0]; return '<div style="padding:14px 0;border-bottom:1px solid var(--rule);display:flex;flex-direction:column;gap:6px"><span class="kicker" style="color:' + AREA_INK[g.area][0] + '">' + ['I', 'II', 'III'][k] + ' · ' + g.area + '</span>' + (ed ? '<input class="input" data-in="goal" data-k="' + k + '" value="' + esc(g.title) + '">' : '<span style="font-size:16px;font-weight:500">' + esc(g.title) + '</span>') + '<span class="bar" style="--c:' + AREA_INK[g.area][1] + '"><i style="width:' + Math.min(100, v[1]) + '%"></i></span><span class="small">' + v[0] + ' · lead: ' + esc(g.lead) + '</span></div>'; }).join('') + '</section>'
    + '<section class="sec"><div class="sechead"><h2>This week’s vital three</h2><span class="small">from Sunday</span></div>' + p.vital.map((v, k) => '<div class="row"><span class="serif" style="width:22px;color:var(--saffron)">' + ['I', 'II', 'III'][k] + '</span>' + (ed ? '<input class="input" data-in="vital" data-k="' + k + '" value="' + esc(v) + '">' : '<span class="grow"><span class="t">' + esc(v) + '</span></span>') + '</div>').join('') + '</section>'
    + rhythmSection()
    + '<div class="grid2"><a class="card" href="#away" style="color:var(--ink)"><span class="kicker" style="color:var(--sapphire)">Going away?</span><span class="small">Trip, tour or class · pause the plan</span></a><a class="card" href="#manifest" style="color:var(--ink)"><span class="kicker" style="color:var(--emerald)">Wishes</span><span class="small">Want it · see it · plan for it</span></a></div>'
    + '</div>' + fab() + tabs('plan');
};
function rhythmSection() {
  const editing = !!ui.rhythmEdit;
  const rows = state.rhythms.map((r) => {
    const open = editing && ui.editRhythm === r.id;
    const ink = AREA_INK[r.area] ? AREA_INK[r.area][0] : 'var(--muted)';
    const sub = r.fixedNote ? r.fixedNote : (lenLabel(r.len) + (r.note ? ' · ' + r.note : '') + (['every', 'month'].includes(r.freq.t) && r.nextDue ? ' · next due ' + fmtDM(r.nextDue) : ''));
    const editable = editing && !['auto', 'none'].includes(r.freq.t);
    return '<div style="border-bottom:1px solid var(--rule)"><div class="row" style="border:none;align-items:baseline"><span style="width:92px;flex-shrink:0;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:' + ink + '">' + esc(r.when || freqLabel(r)) + '</span><span class="grow"><span class="t">' + esc(r.name) + '</span><span class="s">' + esc(sub) + '</span></span>'
      + (editable ? '<button class="link" style="color:var(--saffron)" data-a="rEdit" data-id="' + r.id + '">' + (open ? 'Close' : 'Edit') + '</button>' : '') + '</div>'
      + (open ? '<div style="padding:0 0 16px;display:flex;flex-direction:column;gap:10px"><span class="kicker">' + (r.fixed ? 'How long · fixed' : 'How long') + '</span><div class="grid3">' + (r.fixed ? '<button class="chip" aria-pressed="true">' + lenLabel(r.len) + '</button>' : LENS.map((m) => '<button class="chip" data-a="rLen" data-id="' + r.id + '" data-m="' + m + '" aria-pressed="' + (r.len === m) + '">' + lenLabel(m) + '</button>').join('')) + '</div>'
        + (r.custom ? '<button class="link" style="color:var(--rose)" data-a="rDelete" data-id="' + r.id + '">Remove this rhythm</button>' : '') + '<span class="small">No fixed time. On the day it is due, it shows up in Decide and you place it.</span></div>' : '')
      + '</div>';
  }).join('');
  const add = ui.addRhythm;
  const freqs = [['Daily', { t: 'daily' }], ['Every 2 days', { t: 'every', n: 2 }], ['Weekly', { t: 'every', n: 7 }], ['Every 15 days', { t: 'every', n: 15 }], ['Monthly', { t: 'month' }], ['Custom', { t: 'custom' }]];
  return '<section class="sec"><div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--ink)"><h2>The rhythm</h2><button class="chip" style="width:auto;padding:0 14px;min-height:40px;--c:var(--saffron);' + (editing ? '' : 'color:var(--saffron);border-color:var(--saffron)') + '" data-a="rhythmEdit" aria-pressed="' + editing + '">' + (editing ? 'Done' : 'Add or edit') + '</button></div>'
    + '<p class="small" style="margin:10px 0 4px;font-size:13px">No rhythm has a fixed time. When one is due, it appears in Decide and you place it in a free slot, that morning or the night before.</p>'
    + rows
    + (editing && !add ? '<button class="btn quiet" style="margin-top:14px;color:var(--saffron);border-color:var(--saffron);font-weight:600" data-a="addRhythm">+ Add a rhythm</button>' : '')
    + (editing && add ? '<div class="card" style="margin-top:14px;background:var(--tint);border-color:var(--saffron)"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="serif" style="font-size:22px">New rhythm</span><button class="link" style="color:var(--muted)" data-a="addRhythmCancel">Cancel</button></div>'
      + '<label class="field"><span>What</span><input class="input" data-in="rName" value="' + esc(add.name) + '" placeholder="e.g. Read 20 pages"></label>'
      + '<span class="kicker">How often</span><div class="grid3">' + freqs.map((f, k) => '<button class="chip" data-a="rFreq" data-k="' + k + '" aria-pressed="' + (add.f === k) + '">' + f[0] + '</button>').join('') + '</div>'
      + (add.f === 5 ? '<label class="pill" style="font-size:15px;color:var(--ink)">Every <input type="number" min="1" max="365" class="input" style="width:80px;text-align:center" data-in="rEvery" value="' + esc(add.every) + '"> days</label>' : '')
      + '<span class="kicker">How long</span><div class="grid3">' + LENS.map((m) => '<button class="chip" data-a="rNewLen" data-m="' + m + '" aria-pressed="' + (add.len === m) + '">' + lenLabel(m) + '</button>').join('') + '</div>'
      + '<span class="kicker">Area</span><div class="grid3">' + AREAS.map((a) => '<button class="chip" style="--c:' + AREA_INK[a][0] + '" data-a="rArea" data-v="' + a + '" aria-pressed="' + (add.area === a) + '">' + a + '</button>').join('') + '</div>'
      + '<button class="btn" data-a="rAdd">Add rhythm</button></div>' : '')
    + '</section>';
}

/* ----- 6 · Focus ----- */
routes.focus = (q, id) => {
  const t = todayISO();
  const task = state.tasks.find((x) => x.id === id) || (state.days[t] && state.tasks.find((x) => x.id === state.days[t].one));
  let f = state.focus;
  if (!f || (task && f.taskId !== task.id && !f.running)) { f = state.focus = { taskId: task ? task.id : null, total: 50 * 60, left: 50 * 60, running: false, endAt: null, mins: 50 }; }
  document.body.className = 'theme-dark';
  const parked = state.notes.filter((n) => n.src === 'focus' && n.at.slice(0, 10) === iso(new Date()));
  return '<div class="screen notab dark" style="gap:24px">'
    + '<div class="top"><a class="iconbtn" href="#today" aria-label="Leave focus">' + ICON.close + '</a><span class="eyebrow">Layer V · Execute</span></div>'
    + '<section style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center"><span class="kicker" style="color:var(--sun);letter-spacing:.26em">The quiet hour' + (task && task.one ? ' · ONE Thing' : '') + '</span>'
    + '<p class="serif" style="margin:0;font-size:26px;line-height:1.2">' + esc(task ? task.title : 'Deep work') + '</p>'
    + '<div role="group" aria-label="Block length" style="display:grid;grid-template-columns:repeat(2,96px);border:1px solid #4A5E84">' + [25, 50].map((n) => '<button class="chip" style="border:none;min-height:40px;--c:var(--sun);' + (f.mins === n ? 'color:#1C2B45' : '') + '" data-a="fLen" data-m="' + n + '" aria-pressed="' + (f.mins === n) + '">' + n + ' min</button>').join('') + '</div>'
    + '<div style="position:relative;width:240px;height:240px"><svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="120" r="108" fill="none" stroke="#2C3E5E" stroke-width="6"/><circle id="ring" cx="120" cy="120" r="108" fill="none" stroke="#F2C14E" stroke-width="6" stroke-linecap="round" stroke-dasharray="678.6" stroke-dashoffset="0" transform="rotate(-90 120 120)"/></svg>'
    + '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px"><span id="clock" class="serif num" style="font-size:56px;line-height:1" role="timer" aria-live="off">50:00</span><span id="clockState" class="small">ready</span></div></div>'
    + '<div style="display:flex;gap:10px;width:100%"><button id="fToggle" class="btn gold" style="flex:2" data-a="fToggle">Start</button><button class="btn ghost" style="flex:1;color:var(--cream);border-color:#4A5E84" data-a="fPlus">+10 min</button></div>'
    + (task ? '<button class="link" style="color:#9ED3B2" data-a="fDone">Finished · mark it done</button>' : '')
    + '<p class="small" style="margin:0">Turn on iPhone Focus (Do Not Disturb) so notifications wait. The timer keeps time even if you leave the app.</p></section>'
    + '<section class="panel navy" style="gap:6px"><span class="kicker" style="color:var(--sky);letter-spacing:.22em">Only the next step</span><input class="input line" data-in="nextStep" data-id="' + (task ? task.id : '') + '" value="' + esc(task && task.next ? task.next : '') + '" placeholder="The first thing your hands do"></section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2 style="font-size:22px">The parking lot</h2></div><p class="small" style="margin:0">A thought arrives? Park it here and keep going. It goes to Decide.</p>'
    + '<div style="display:flex;gap:10px;align-items:center"><input id="parkText" class="input line" placeholder="Park a thought…" aria-label="Park a thought"><button class="link" style="color:var(--sun)" data-a="park">PARK</button></div>'
    + parked.map((n) => '<span style="font-size:14px;color:#D6DDEA">· ' + esc(n.text) + '</span>').join('') + '</section>'
    + '</div>';
};
let tickTimer = null;
function focusTick() {
  const f = state.focus; const clock = document.getElementById('clock'); if (!f || !clock) { clearInterval(tickTimer); tickTimer = null; return; }
  let left = f.running ? Math.max(0, Math.round((f.endAt - Date.now()) / 1000)) : f.left;
  if (f.running && left === 0) { finishFocus(true); left = 0; }
  clock.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
  const ring = document.getElementById('ring'); if (ring) ring.setAttribute('stroke-dashoffset', (678.6 * (1 - left / f.total)).toFixed(1));
  const st = document.getElementById('clockState'); if (st) st.textContent = f.running ? 'in progress' : (left === 0 ? 'complete' : (left === f.total ? 'ready' : 'paused'));
  const b = document.getElementById('fToggle'); if (b) b.textContent = f.running ? 'Pause' : (left === f.total ? 'Start' : left === 0 ? 'Again' : 'Resume');
}
function finishFocus(natural) {
  const f = state.focus; if (!f) return;
  const usedSec = f.total - (f.running ? Math.max(0, Math.round((f.endAt - Date.now()) / 1000)) : f.left);
  const mins = Math.round(usedSec / 60);
  if (mins >= 5) { const d = day(); (d.focus = d.focus || []).push({ at: new Date().toISOString(), mins, task: f.taskId, len: f.mins }); }
  f.running = false; f.left = natural ? 0 : f.total; f.endAt = null;
  if (natural) { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* no vibration */ } toast('Block complete · ' + mins + ' min of deep work'); }
  save();
}

/* ----- 7 · Lists ----- */
routes.lists = () => {
  const groups = [
    ['To-do', '#E0A21B', '#8A5A00', 'Today first, then upcoming days. Dated items get their slot on the day.', state.tasks.filter((x) => (x.list === 'todo' && !x.done && x.date >= todayISO()) || x.list === 'dated').sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')))],
    ['Waiting list', '#3A64A6', '#26487A', 'Backup tasks. When a planned task can’t happen, these fill the free slot.', state.tasks.filter((x) => x.list === 'waiting')],
    ['Someday', '#3E9A63', '#2F7A4F', 'Good ideas, kept for the right time. Revisited every Sunday.', state.tasks.filter((x) => x.list === 'someday')],
  ];
  const tab = ui.listTab;
  const all = groups.reduce((s, g) => s + g[4].length, 0);
  const tabsL = [['All', '#1F2A24', all], ['To-do', '#E0A21B', groups[0][4].length], ['Waiting', '#3A64A6', groups[1][4].length], ['Someday', '#3E9A63', groups[2][4].length]];
  const shown = tab === 0 ? groups : [groups[tab - 1]];
  return '<div class="screen">'
    + '<div style="display:flex;flex-direction:column;gap:14px"><span class="eyebrow">Every task, in one place</span><h1>Lists</h1>'
    + '<div role="tablist" class="grid7" style="grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--ink)">' + tabsL.map((x, k) => '<button role="tab" aria-selected="' + (k === tab) + '" data-a="lTab" data-k="' + k + '" style="min-height:52px;border:none;border-bottom:3px solid ' + (k === tab ? x[1] : 'transparent') + ';background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:' + (k === tab ? 'var(--ink)' : 'var(--muted)') + '"><span style="font-size:12px;font-weight:' + (k === tab ? 600 : 500) + '">' + x[0] + '</span><span style="font-size:11px">' + x[2] + '</span></button>').join('') + '</div></div>'
    + shown.map((g) => { const items = tab === 0 ? g[4].slice(0, 3) : g[4]; return '<section class="sec"><div class="sechead" style="border-bottom-color:' + g[1] + '"><h2 style="color:' + g[2] + '">' + g[0] + '</h2><span class="small">' + g[4].length + '</span></div><p class="small" style="margin:8px 0 2px">' + g[3] + '</p>'
      + (items.length ? items.map((x) => listRow(x, g)).join('') : '<div class="empty" style="margin-top:8px">Nothing here yet.</div>')
      + (tab === 0 && g[4].length > 3 ? '<button class="link" style="color:' + g[2] + ';align-self:flex-start" data-a="lTab" data-k="' + (groups.indexOf(g) + 1) + '">See all ' + g[4].length + '</button>' : '') + '</section>'; }).join('')
    + '</div>' + fab() + tabs('lists');
};
function listRow(x, g) {
  const open = ui.openRow === x.id;
  const meta = x.list === 'dated' ? fmtShort(x.date) + (x.repeat && x.repeat !== 'once' ? ' · every ' + x.repeat : '') + ' · on a date' : x.list === 'todo' ? (x.date === todayISO() ? 'Today' : fmtShort(x.date)) + (x.time ? ' · ' + x.time : '') + (x.rhythm ? ' · rhythm' : '') + (x.one ? ' · ONE Thing' : '') : 'Added ' + fmtDM(x.created.slice(0, 10));
  return '<div style="border-bottom:1px solid var(--rule)"><button class="row" style="border:none;width:100%;background:transparent;text-align:left;min-height:58px" data-a="lOpen" data-id="' + x.id + '"><span class="dot" style="background:' + g[1] + '"></span><span class="grow"><span class="t" style="font-weight:500">' + esc(x.title) + '</span><span class="s">' + esc(meta) + '</span></span><span class="num" style="font-size:12px;font-weight:600;color:' + g[2] + '">' + (x.list !== 'someday' ? lenLabel(x.mins || 30) : '') + '</span></button>'
    + (open ? '<div class="grid3" style="padding:0 0 12px">' + (x.list === 'todo' ? '<button class="chip" style="--c:var(--emerald)" data-a="lDone" data-id="' + x.id + '">Done</button>' : '<button class="chip" style="--c:var(--saffron)" data-a="lToday" data-id="' + x.id + '">Do today</button>') + '<button class="chip" data-a="lBack" data-id="' + x.id + '">Back to Decide</button><button class="chip" style="color:var(--rose)" data-a="lDel" data-id="' + x.id + '">Delete</button></div>' : '') + '</div>';
}

/* ----- 8 · Shutdown ----- */
routes.shutdown = () => {
  const t = todayISO(), d = day(t), tm = addDays(t, 1);
  document.body.className = 'theme-dark';
  const loops = [];
  state.notes.forEach((n) => loops.push({ kind: 'note', id: n.id, text: n.text }));
  tasksOn(t).filter((x) => !x.done && !x.rhythm).forEach((x) => loops.push({ kind: 'task', id: x.id, text: x.title + (x.time ? ' (' + x.time + ')' : '') }));
  tasksOn(t).filter((x) => !x.done && x.rhythm).forEach((x) => loops.push({ kind: 'rtask', id: x.id, text: x.title + ' · rhythm, not ticked' }));
  const doneT = tasksOn(t).filter((x) => x.done);
  const one = d.one ? state.tasks.find((x) => x.id === d.one) : null;
  const three = tasksOn(t).filter((x) => !x.rhythm);
  const deep = (d.focus || []).reduce((s, f) => s + f.mins, 0);
  const sugg = shutdownSuggestions();
  const dueTm = state.rhythms.filter((r) => isDue(r, tm)).map((r) => r.name.replace('10 minutes with ', ''));
  const b2 = brahma(tm); const alarmOn = !!(state.days[tm] && state.days[tm].alarm);
  const ratio = doneT.filter((x) => x.actual).length ? (doneT.reduce((s, x) => s + (x.actual || x.mins || 0), 0) / Math.max(1, doneT.reduce((s, x) => s + (x.mins || 0), 0))) : null;
  return '<div class="screen notab dark" style="gap:28px">'
    + '<div class="top">' + backBtn('#review', 'Back') + '<span class="eyebrow">Layer VI · Review · end of day</span></div>'
    + '<header style="display:flex;flex-direction:column;gap:8px;margin-top:-12px"><h1 style="font-size:40px">The shutdown</h1><p class="small" style="margin:0;font-size:13px">' + (one && one.done ? 'ONE Thing done · ' : one ? 'ONE Thing not done · ' : '') + three.filter((x) => x.done).length + ' of ' + three.length + ' tasks · ' + (deep >= 60 ? (deep / 60).toFixed(1) + ' h' : deep + ' min') + ' of deep work</p></header>'
    + '<section class="sec"><div class="sechead"><h2 style="font-size:22px"><span style="color:var(--sun)">I.</span> Close every loop</h2><span class="small" style="color:' + (loops.length ? 'var(--rose-soft)' : '#9ED3B2') + '">' + (loops.length ? loops.length + ' still open' : 'All closed · the mind can rest') + '</span></div>'
    + loops.map((l) => '<div style="padding:12px 0;border-bottom:1px solid var(--navy-line);display:flex;flex-direction:column;gap:8px"><span style="font-size:15px">' + esc(l.text) + '</span><div style="display:flex;gap:6px;flex-wrap:wrap">'
      + (l.kind === 'rtask' ? '<button class="chip" style="width:auto;padding:0 12px;min-height:38px;color:var(--sun);border-color:var(--sun)" data-a="loop" data-k="did" data-id="' + l.id + '" data-kind="' + l.kind + '">I did it</button><button class="chip" style="width:auto;padding:0 12px;min-height:38px" data-a="loop" data-k="miss" data-id="' + l.id + '" data-kind="' + l.kind + '">Missed today</button>'
        : ['Tomorrow', 'Waiting list', 'Someday', 'Let go'].map((b, k) => '<button class="chip" style="width:auto;padding:0 12px;min-height:38px;' + (k === 0 ? 'color:var(--sun);border-color:var(--sun)' : '') + '" data-a="loop" data-k="' + ['tomorrow', 'wait', 'someday', 'go'][k] + '" data-id="' + l.id + '" data-kind="' + l.kind + '">' + b + '</button>').join(''))
      + '</div></div>').join('') + '</section>'
    + '<section class="sec"><div class="sechead"><h2 style="font-size:22px"><span style="color:var(--sun)">II.</span> Time, as it really was</h2><span class="small">teaches your multiplier</span></div>'
    + (doneT.length ? '<div style="display:grid;grid-template-columns:1fr 64px 64px;gap:8px;padding:10px 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--navy-soft)"><span></span><span style="text-align:right">Planned</span><span style="text-align:right">Actual</span></div>' + doneT.map((x) => '<div class="num" style="display:grid;grid-template-columns:1fr 64px 64px;gap:8px;padding:8px 0;border-bottom:1px solid var(--navy-line);font-size:14px"><span>' + esc(x.title) + '</span><span style="text-align:right;color:var(--navy-soft)">' + (x.mins || 30) + ' min</span><span style="text-align:right;' + ((x.actual || x.mins) > (x.mins || 30) * 1.2 ? 'color:var(--rose-soft)' : '') + '">' + (x.actual || x.mins || 30) + ' min</span></div>').join('') + (ratio ? '<p class="small" style="margin:10px 0 0">Today ran ' + ratio.toFixed(2) + '× your estimates.</p>' : '<p class="small" style="margin:10px 0 0">Press Start on a task to record its real time.</p>') : '<p class="small">Nothing ticked done today yet.</p>') + '</section>'
    + '<section class="sec" style="gap:12px"><div class="sechead"><h2 style="font-size:22px"><span style="color:var(--sun)">III.</span> Reflect</h2></div>'
    + '<label class="field"><span style="color:var(--sun)">Three wins</span><input class="input line" data-in="wins" value="' + esc(d.wins || '') + '" placeholder="What went well today"></label>'
    + '<span style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--navy-soft);padding-top:6px">Energy today</span><div role="radiogroup" aria-label="Energy" class="grid7" style="grid-template-columns:repeat(5,1fr);gap:8px">'
    + [1, 2, 3, 4, 5].map((n) => '<button role="radio" aria-checked="' + (d.energy === n) + '" data-a="energy" data-k="' + n + '" style="height:50px;border-radius:25px;border:1px solid ' + (d.energy === n ? 'var(--sun)' : '#4A5E84') + ';background:' + (d.energy === n ? 'var(--sun)' : 'transparent') + ';color:' + (d.energy === n ? '#1C2B45' : 'var(--cream)') + ';font-family:var(--serif);font-size:20px">' + n + '</button>').join('') + '</div></section>'
    + '<section class="sec"><div class="sechead"><h2 style="font-size:22px"><span style="color:var(--sun)">IV.</span> Tomorrow, decided tonight</h2></div>'
    + '<div style="padding:14px 0;border-bottom:1px solid var(--navy-line);display:flex;flex-direction:column;gap:8px"><span style="font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--sun)">ONE Thing · suggested from your sales goal</span>'
    + '<input class="input line" data-in="oneText" value="' + esc((state.days[tm] && state.days[tm].oneText) || '') + '" placeholder="' + esc(sugg[0] || 'The one task that matters most') + '">'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + sugg.slice(0, 3).map((s) => '<button class="chip" style="width:auto;padding:0 10px;min-height:34px;font-size:12px;font-weight:500" data-a="oneSugg" data-v="' + esc(s) + '">' + esc(s.length > 38 ? s.slice(0, 36) + '…' : s) + '</button>').join('') + '</div></div>'
    + (dueTm.length ? '<a href="#decide" style="min-height:52px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--navy-line);color:var(--sky);font-size:14px"><span aria-hidden="true" style="width:22px">↻</span><span>Rhythms due tomorrow · ' + esc(dueTm.slice(0, 3).join(' · ')) + '<br><span class="small">Place them in the morning, in Decide</span></span></a>' : '')
    + '<button data-a="alarm" aria-pressed="' + alarmOn + '" style="min-height:56px;display:flex;align-items:center;gap:12px;border:none;background:transparent;padding:0;text-align:left;color:' + (alarmOn ? '#9ED3B2' : 'var(--sun)') + ';font-size:14px">' + ICON.alarm + '<span>' + (alarmOn ? '✓ Alarm set for ' + hm(b2.alarm) + ' · tap to undo' : 'Wake for Brahma Muhurta? Set alarm ' + hm(b2.alarm)) + '<br><span class="small">Brahma Muhurta tomorrow · ' + hm(b2.start) + ' – ' + hm(b2.end) + '</span></span></button></section>'
    + (loops.length ? '<div class="btn quiet" style="color:var(--navy-soft);border-color:#4A5E84">Close every loop first · ' + loops.length + ' still open</div>' : '<button class="btn gold" data-a="closeDay">' + (d.shutdown ? '✓ Day closed · good night' : 'Close the day · good night') + '</button>')
    + '</div>';
};
function shutdownSuggestions() {
  const tm = addDays(todayISO(), 1);
  const s = [];
  tasksOn(tm).filter((x) => !x.rhythm && x.area === 'Wealth').forEach((x) => s.push(x.title));
  if (state.plan.vital[0]) s.push('Call ten active buyers and book their orders');
  state.tasks.filter((x) => x.list === 'waiting' && x.area === 'Wealth').forEach((x) => s.push(x.title));
  return [...new Set(s)];
}

/* ----- 9 · Review hub and Sunday review ----- */
routes.review = () => {
  const t = todayISO();
  const wk = weekKey(t);
  const r = state.reviews[wk] || {};
  const isSun = weekday(t) === 0;
  const d = state.days[t] || {};
  const balance = r.balance || [3, 3, 3, 3, 3];
  let low = 0; balance.forEach((v, k) => { if (v < balance[low]) low = k; });
  const sugg = reportFor(lastWeekEnd()).next.map((n) => n.text);
  const vital = r.vital || [state.plan.vital[0] || '', sugg[1] || state.plan.vital[1] || '', ''];
  return '<div class="screen">'
    + '<div class="top"><span class="eyebrow">Layer VI · Review</span><a class="link" href="#rules">Rules</a></div>'
    + '<div class="grid2"><a class="card" href="#shutdown" style="color:var(--ink);border-color:var(--navy)"><span class="kicker" style="color:var(--navy)">Tonight</span><span class="serif" style="font-size:20px">The shutdown</span><span class="small">' + (d.shutdown ? '✓ Closed' : '10 minutes · close every loop') + '</span></a>'
    + '<a class="card" href="#report" style="color:var(--ink);border-color:var(--emerald)"><span class="kicker" style="color:var(--emerald)">' + (isSun ? 'Ready today' : 'Last week') + '</span><span class="serif" style="font-size:20px">Week report</span><span class="small">Every chart and measure</span></a></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Sunday · week ' + cycleInfo().week + ' of ' + cycleInfo().total + '</span><h1>The Sunday review</h1><p class="lede">An after-action review, as the army runs it. About twenty minutes.</p></div>'
    + '<section class="sec" style="gap:14px"><div class="sechead"><h2>The after-action review</h2></div>'
    + [['What was planned?', state.plan.vital[0] || '', '#145A43'], ['What actually happened?', 'The honest result', '#26487A'], ['Why the difference?', 'The honest cause, not the excuse', '#A3324F'], ['Keep doing · do differently', 'One of each', '#8A5A00']]
      .map((x, k) => '<label class="field"><span style="color:' + x[2] + '">' + ['I', 'II', 'III', 'IV'][k] + ' · ' + x[0] + '</span><input class="input line" data-in="aar" data-k="' + k + '" value="' + esc((r.aar || [])[k] || '') + '" placeholder="' + esc(x[1]) + '"></label>').join('')
    + '<label class="field"><span style="color:var(--emerald)">Sales billed this week · ₹ lakh</span><input class="input line" type="number" inputmode="decimal" min="0" step="0.5" data-in="salesWeek" value="' + esc(r.sales != null ? r.sales : '') + '" placeholder="e.g. 52"></label></section>'
    + '<section class="sec" style="gap:14px"><div class="sechead"><h2>Life balance</h2><span class="small">tap to rate, 1 to 5</span></div>'
    + AREAS.map((a, k) => '<div style="display:grid;grid-template-columns:112px 1fr 18px;gap:10px;align-items:center"><span style="font-size:14px;font-weight:500;color:' + AREA_INK[a][0] + '">' + a + '</span><span class="grid7" style="grid-template-columns:repeat(5,1fr)">' + [1, 2, 3, 4, 5].map((v) => '<button data-a="bal" data-k="' + k + '" data-v="' + v + '" aria-label="' + a + ' ' + v + ' of 5" style="height:26px;border:none;padding:0;background:transparent;display:flex;align-items:center"><span style="width:100%;height:8px;border-radius:4px;background:' + (v <= balance[k] ? AREA_INK[a][1] : AREA_INK[a][2]) + '"></span></button>').join('') + '</span><span class="serif" style="font-size:17px;text-align:right">' + balance[k] + '</span></div>').join('') + '</section>'
    + '<section class="sec" style="gap:12px"><div class="sechead"><h2>Next week’s vital three</h2></div><p class="small" style="margin:0">The first must serve the constraint. The report’s suggestions are filled in; change any.</p>'
    + ['I · The constraint', 'II · A goal', 'III · ' + AREAS[low] + ', your lowest area'].map((l, k) => '<label class="field"><span style="color:' + ['#145A43', '#26487A', AREA_INK[AREAS[low]][0]][k] + '">' + l + '</span><input class="input line" data-in="rvital" data-k="' + k + '" value="' + esc(vital[k] || '') + '" placeholder="One thing for it"></label>').join('') + '</section>'
    + '<button class="btn" data-a="seal">' + (r.sealed ? '✓ Week sealed · update it' : 'Seal the week · plan the next') + '</button>'
    + '</div>' + fab() + tabs('review');
};
function weekKey(t) { return weekStart(t); }
function lastWeekEnd() { const t = todayISO(); const wd = weekday(t); return wd === 0 ? t : addDays(t, -wd); }

/* ----- 10 · Week report ----- */
function reportFor(endISO) {
  const start = addDays(endISO, -6);
  const dates = Array.from({ length: 7 }, (_, k) => addDays(start, k));
  const inWeek = (s) => s && s >= start && s <= endISO;
  const planned = state.tasks.filter((x) => x.list === 'todo' && inWeek(x.date));
  const done = planned.filter((x) => x.done);
  const exec = planned.length ? Math.round(done.length / planned.length * 100) : 0;
  const oneDays = dates.filter((d) => { const day0 = state.days[d]; const o = day0 && day0.one && state.tasks.find((x) => x.id === day0.one); return o && o.done; });
  const oneSet = dates.filter((d) => state.days[d] && state.days[d].one).length;
  const oneInPeak = oneDays.filter((d) => { const o = state.tasks.find((x) => x.id === state.days[d].one); const pk = peakFor(d); return o.time && toMin(o.time) >= pk.start && toMin(o.time) < pk.end; }).length;
  const deep = dates.map((d) => ((state.days[d] && state.days[d].focus) || []).reduce((s, f) => s + f.mins, 0) / 60);
  const blocks = dates.reduce((s, d) => s.concat((state.days[d] && state.days[d].focus) || []), []);
  const energy = dates.map((d) => (state.days[d] && state.days[d].energy) || null);
  const rh = state.rhythms.filter((r) => !['auto', 'none'].includes(r.freq.t)).map((r) => ({ name: r.name.replace('10 minutes with ', '').replace(' · the ledger', ''), cells: dates.map((d) => r.done.includes(d) ? 'done' : (r.skips.includes(d) || (state.tasks.some((x) => x.rhythm === r.id && x.date === d && !x.done) && d < todayISO())) ? 'miss' : 'none'), count: r.done.filter(inWeek).length, r })).filter((x) => x.cells.some((c) => c !== 'none') || ['gym', 'mom', 'sister'].includes(x.r.id));
  const gymR = state.rhythms.find((r) => r.id === 'gym');
  const gym = gymR ? gymR.done.filter(inWeek).length : 0;
  const fam = state.rhythms.filter((r) => r.family).reduce((s, r) => s + r.done.filter(inWeek).length, 0);
  const areaP = {}, areaA = {};
  AREAS.forEach((a) => { areaP[a] = 0; areaA[a] = 0; });
  planned.forEach((x) => { const a = x.area || 'Wealth'; areaP[a] += (x.mins || 30) / 60; if (x.done) areaA[a] += (x.actual || x.mins || 30) / 60; });
  const plannedH = done.reduce((s, x) => s + (x.mins || 30), 0), actualH = done.reduce((s, x) => s + (x.actual || x.mins || 30), 0);
  const multiplier = plannedH ? actualH / plannedH : 1;
  const captured = state.tasks.filter((x) => inWeek((x.created || '').slice(0, 10))).length + state.notes.filter((n) => inWeek(n.at.slice(0, 10))).length;
  const emptyNights = dates.filter((d) => state.days[d] && state.days[d].shutdown).length;
  const fills = state.tasks.filter((x) => x.filled && inWeek(x.date));
  const wins = dates.map((d) => state.days[d] && state.days[d].wins).filter(Boolean);
  const rv = state.reviews[weekKey(endISO)] || {};
  const salesWeek = rv.sales != null && rv.sales !== '' ? +rv.sales : null;
  const ci = cycleInfo();
  const gymEnergy = dates.filter((d, k) => energy[k] && gymR && gymR.done.includes(d)).map((d) => state.days[d].energy);
  const otherEnergy = dates.filter((d, k) => energy[k] && !(gymR && gymR.done.includes(d))).map((d) => state.days[d].energy);
  const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const deepDays = deep.filter((h) => h >= state.settings.limits.deep / 60).length;
  const totalDeep = deep.reduce((s, h) => s + h, 0);
  const next = [];
  if (salesWeek != null && salesWeek < ci.needWeekly) next.push({ k: 'I', text: 'Sales were ₹' + Math.round(ci.needWeekly - salesWeek) + ' lakh short. Add buyer calls on Monday, in your peak hours.' });
  else next.push({ k: 'I', text: 'Keep the constraint first: about ₹' + Math.round(ci.needWeekly) + ' lakh of sales this week.' });
  const worst = deep.indexOf(Math.min(...deep));
  next.push({ k: 'II', text: totalDeep < 7 * state.settings.limits.deep / 60 ? 'Deep work was thin on ' + fmtShort(dates[worst]).split(',')[0] + '. Protect your peak hours from meetings.' : 'Deep work held. Keep the quiet hour in your peak window.' });
  next.push({ k: 'III', text: gym < 6 ? 'Gym ' + gym + ' of 6. Place the gym first when you empty Decide.' : 'Gym 6 of 6. Keep the streak; never miss twice.' });
  return { start, end: endISO, dates, planned: planned.length, done: done.length, exec, oneDays: oneDays.length, oneSet, oneInPeak, deep, blocks, totalDeep, deepDays, energy, rh, gym, fam, areaP, areaA, multiplier, captured, emptyNights, fills, wins, salesWeek, ci, gymE: avg(gymEnergy), otherE: avg(otherEnergy), next };
}
routes.report = () => {
  const R = reportFor(lastWeekEnd());
  const p = state.plan, ci = R.ci;
  const salesPct = R.salesWeek != null ? Math.min(100, Math.round(R.salesWeek / Math.max(1, ci.needWeekly) * 100)) : 0;
  const pathX = (wk) => 30 + 306 * (wk / ci.total);
  const pathY = (cr) => 104 - 92 * ((cr - p.sales.start) / Math.max(0.1, p.sales.target - p.sales.start));
  const cx = pathX(ci.week - 1), cy = pathY(ci.salesNow);
  const maxDeep = Math.max(3, ...R.deep);
  const line = R.energy.map((e, k) => e ? (24 + k * 48) + ',' + (86 - (e - 1) * 18) : null).filter(Boolean).join(' ');
  const headline = (R.exec >= 85 ? 'A strong week of execution' : R.planned ? 'Execution below the 85% bar' : 'A quiet week in the app') + (R.salesWeek != null ? (R.salesWeek >= ci.needWeekly ? ', and sales on the path.' : ', and sales behind the path.') : '. Add sales in the Sunday review.');
  const cell = { done: '#2F7A4F', miss: '#C2466A', none: '#E4E1D6' };
  return '<div class="screen" id="report">'
    + '<div class="top noprint">' + backBtn('#review', 'Back to review') + '<span class="eyebrow">Week report</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Week ' + Math.max(1, Math.floor(daysBetween(state.plan.cycleStart, R.end) / 7) + 1) + ' · ' + fmtDM(R.start) + ' – ' + fmtDM(R.end) + '</span><h1>The week report</h1><span class="small">Made on its own · ready every Sunday morning</span></div>'
    + '<div class="grid3 noprint"><button class="btn" style="min-height:46px" data-a="repView">View</button><button class="btn ghost" style="min-height:46px" data-a="repPdf">PDF</button><button class="btn ghost" style="min-height:46px" data-a="repDrive">To Drive</button></div>'
    + '<section class="panel green" style="margin:0 -20px;padding:22px 20px"><span class="kicker" style="color:#F2C14E;letter-spacing:.24em">The week in one line</span><p style="margin:0;font-family:var(--text);font-style:italic;font-size:19px;line-height:1.4">' + headline + '</p>'
    + '<div class="grid3" style="border-top:1px solid #3E7562;padding-top:12px;gap:8px"><span class="stat"><b style="color:#F2C14E">' + R.exec + '%</b><span>actions done · bar is 85%</span></span><span class="stat"><b style="color:#F0A9BC">' + (R.salesWeek != null ? '₹' + R.salesWeek + ' L' : '—') + '</b><span>sales · need ₹' + Math.round(ci.needWeekly) + ' L</span></span><span class="stat"><b style="color:#9ED3B2">' + R.totalDeep.toFixed(1) + ' h</b><span>deep work · ' + (7 * state.settings.limits.deep / 60) + ' h target</span></span></div></section>'
    + '<section class="sec" style="gap:12px"><div class="sechead"><h2>I · The goals</h2><span class="small">results · lag measures</span></div>'
    + '<span style="font-size:13px;font-weight:600;color:var(--emerald)">Sales this week</span><div style="display:grid;grid-template-columns:54px 1fr 64px;gap:8px;align-items:center;font-size:12px"><span class="small">Billed</span><span class="bar" style="height:12px;--c:var(--emerald)"><i style="width:' + salesPct + '%"></i></span><span class="num" style="text-align:right;font-weight:600">' + (R.salesWeek != null ? '₹' + R.salesWeek + ' L' : '—') + '</span><span class="small">Needed</span><span class="bar" style="height:12px;background:#CFDDD6"></span><span class="num small" style="text-align:right">₹' + Math.round(ci.needWeekly) + ' L</span></div>'
    + '<span style="font-size:13px;font-weight:600;color:var(--emerald);padding-top:4px">₹' + p.sales.target + ' crore by ' + fmtDM(p.cycleEnd) + '</span>'
    + '<svg viewBox="0 0 342 122" width="100%" role="img" aria-label="Sales so far against the path"><line x1="30" y1="104" x2="336" y2="104" stroke="#1F2A24"/><line x1="30" y1="104" x2="336" y2="12" stroke="#8A5A00" stroke-width="1.2" stroke-dasharray="4 4"/><polyline points="30,104 ' + cx.toFixed(1) + ',' + cy.toFixed(1) + '" fill="none" stroke="#145A43" stroke-width="3" stroke-linecap="round"/><circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="4.5" fill="#145A43"/><text x="0" y="107" font-size="10" fill="#4C5650">' + p.sales.start + '</text><text x="0" y="16" font-size="10" fill="#4C5650">' + p.sales.target + ' cr</text><text x="' + (cx + 8).toFixed(0) + '" y="' + (cy - 8).toFixed(0) + '" font-size="10" fill="#145A43">₹' + ci.salesNow.toFixed(1) + ' cr</text><text x="230" y="40" font-size="10" fill="#8A5A00">the path</text><text x="30" y="120" font-size="10" fill="#4C5650">Week 1</text><text x="290" y="120" font-size="10" fill="#4C5650">' + fmtDM(p.cycleEnd) + '</text></svg>'
    + '<p class="small" style="margin:0;font-size:13px;color:#33403A">To stay on the path, the next ' + ci.weeksLeft + ' weeks need <b>₹' + Math.round(ci.needWeekly) + ' lakh a week</b>.</p>'
    + [['Health · gym 6 days', R.gym + ' of 6', R.gym / 6, '#2F7A4F'], ['Family · Mom and Dad, my sister', R.fam + ' calls', Math.min(1, R.fam / 11), '#A3324F']].map((g) => '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px 0;border-top:1px solid var(--rule)"><span style="display:flex;flex-direction:column;gap:4px"><span style="font-size:14px;font-weight:500;color:' + g[3] + '">' + g[0] + '</span><span class="bar" style="--c:' + g[3] + '"><i style="width:' + Math.round(g[2] * 100) + '%"></i></span></span><span class="num" style="font-size:13px;font-weight:600">' + g[1] + '</span></div>').join('') + '</section>'
    + '<section class="sec" style="gap:12px"><div class="sechead"><h2>II · Execution</h2><span class="small">actions · lead measures</span></div><div style="display:flex;align-items:baseline;gap:12px"><span class="serif" style="font-size:52px;line-height:1;color:var(--emerald)">' + R.exec + '%</span><span class="small">' + R.done + ' of ' + R.planned + ' planned actions done.<br>85% or more is the bar that predicts the goal.</span></div>'
    + [['ONE Thing done', R.oneDays + ' of ' + R.oneSet + ' days'], ['…and done in peak hours', R.oneInPeak + ' of ' + R.oneDays], ['Freed slots filled from the Waiting list', R.fills.length + '']].map((x) => '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--rule);font-size:14px"><span>' + x[0] + '</span><b style="color:var(--emerald)">' + x[1] + '</b></div>').join('') + '</section>'
    + '<section class="sec" style="gap:12px"><div class="sechead"><h2>III · Deep work</h2><span class="small">' + R.totalDeep.toFixed(1) + ' h this week</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;align-items:end;height:110px;position:relative" role="img" aria-label="Deep work hours each day">' + R.deep.map((h) => '<span style="height:' + Math.max(2, Math.round(h / maxDeep * 100)) + '%;background:' + (h >= state.settings.limits.deep / 60 ? '#3A64A6' : '#A9B9D6') + '"></span>').join('') + '<span style="position:absolute;left:0;right:0;bottom:' + (state.settings.limits.deep / 60 / maxDeep * 100).toFixed(1) + '%;border-top:1px dashed #8A5A00"></span></div>'
    + '<div class="grid7" style="gap:8px;font-size:11px;font-weight:600;color:var(--muted);text-align:center">' + R.dates.map((d) => '<span>' + 'SMTWTFS'[weekday(d)] + '</span>').join('') + '</div>'
    + '<p class="small" style="margin:0;font-size:13px;color:#33403A">' + R.deepDays + ' of 7 days cleared the ' + (state.settings.limits.deep / 60) + '-hour line. ' + R.blocks.length + ' focus blocks: ' + R.blocks.filter((b) => b.len === 50).length + ' of 50 min, ' + R.blocks.filter((b) => b.len === 25).length + ' of 25.</p></section>'
    + '<section class="sec" style="gap:8px"><div class="sechead"><h2>IV · Rhythms</h2><span class="small">toward 66 days</span></div>'
    + '<div style="display:grid;grid-template-columns:110px repeat(7,1fr) 28px;gap:4px;font-size:10px;font-weight:600;color:var(--muted);text-align:center"><span></span>' + R.dates.map((d) => '<span>' + 'SMTWTFS'[weekday(d)] + '</span>').join('') + '<span></span></div>'
    + R.rh.map((x) => '<div style="display:grid;grid-template-columns:110px repeat(7,1fr) 28px;gap:4px;align-items:center"><span style="font-size:12px;line-height:1.2">' + esc(x.name) + '</span>' + x.cells.map((c) => '<span style="height:18px;border-radius:3px;background:' + cell[c] + '"></span>').join('') + '<b style="font-size:12px;text-align:right">' + x.count + '</b></div>').join('')
    + '<div style="display:flex;gap:14px;font-size:11px;color:var(--muted)"><span class="pill"><span class="dot" style="background:#2F7A4F"></span>done</span><span class="pill"><span class="dot" style="background:#C2466A"></span>missed</span><span class="pill"><span class="dot" style="background:#E4E1D6"></span>not due</span></div>'
    + '<p class="small" style="margin:0;font-size:13px;color:#33403A">Habits take about 66 days to become automatic. Miss once, fine; never miss twice. Brahma Muhurta alarm set on ' + R.dates.filter((d) => state.days[d] && state.days[d].alarm).length + ' days.</p></section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>V · Where the time went</h2><span class="small">planned · actual</span></div>'
    + AREAS.map((a) => { const mx = Math.max(1, ...AREAS.map((b) => Math.max(R.areaP[b], R.areaA[b]))); return '<div style="display:grid;grid-template-columns:96px 1fr 70px;gap:10px;align-items:center"><span style="font-size:13px;font-weight:500;color:' + AREA_INK[a][0] + '">' + a + '</span><span style="display:flex;flex-direction:column;gap:3px"><span style="height:6px;width:' + (R.areaP[a] / mx * 100).toFixed(0) + '%;background:' + AREA_INK[a][2] + '"></span><span style="height:6px;width:' + (R.areaA[a] / mx * 100).toFixed(0) + '%;background:' + AREA_INK[a][1] + '"></span></span><span class="num small" style="text-align:right">' + R.areaP[a].toFixed(1) + ' · ' + R.areaA[a].toFixed(1) + ' h</span></div>'; }).join('')
    + '<p class="small" style="margin:0;font-size:13px;color:#33403A">Work ran <b>' + R.multiplier.toFixed(2) + '×</b> your estimates. The app sizes next week’s blocks with this.</p></section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>VI · Energy</h2><span class="small">from your shutdown</span></div>'
    + '<svg viewBox="0 0 342 96" width="100%" role="img" aria-label="Energy each night"><line x1="0" y1="86" x2="342" y2="86" stroke="#1F2A24"/>' + (line ? '<polyline points="' + line + '" fill="none" stroke="#3A64A6" stroke-width="2"/>' : '') + R.energy.map((e, k) => e ? '<circle cx="' + (24 + k * 48) + '" cy="' + (86 - (e - 1) * 18) + '" r="5" fill="' + ((state.rhythms.find((r) => r.id === 'gym') || { done: [] }).done.includes(R.dates[k]) ? '#3A64A6' : '#EFEDE5') + '" stroke="#3A64A6" stroke-width="2"/>' : '').join('') + '</svg>'
    + '<p class="small" style="margin:0;font-size:13px;color:#33403A">' + (R.gymE != null && R.otherE != null ? 'On gym days (filled dots) energy was <b>' + R.gymE.toFixed(1) + '</b>; on other days <b>' + R.otherE.toFixed(1) + '</b>.' : 'Rate your energy each night in the shutdown to see the pattern.') + '</p></section>'
    + '<section class="sec" style="gap:8px"><div class="sechead"><h2>VII · A clear mind</h2><span class="small">capture and decide</span></div>'
    + [['Notes and tasks captured', R.captured], ['Nights the day was closed', R.emptyNights + ' of 7'], ['Still waiting in Decide', state.notes.length]].map((x) => '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--rule);font-size:14px"><span>' + x[0] + '</span><b class="num">' + x[1] + '</b></div>').join('') + '</section>'
    + '<section class="sec" style="gap:8px"><div class="sechead"><h2>VIII · Wins &amp; wishes</h2></div>' + (R.wins.length ? R.wins.map((w) => '<span style="font-family:var(--text);font-style:italic;font-size:15px">· ' + esc(w) + '</span>').join('') : '<span class="small">Write three wins each night in the shutdown.</span>')
    + state.wishes.filter((w) => w.status === 'active').map((w) => '<span class="small" style="font-size:13px;color:#33403A">' + esc(w.title) + ' · <b>' + Math.max(0, daysBetween(todayISO(), w.by)) + ' days</b> left</span>').join('') + '</section>'
    + '<section class="panel tint" style="gap:10px"><span class="kicker">IX · Three changes for next week</span>' + R.next.map((n) => '<div style="display:grid;grid-template-columns:22px 1fr;gap:8px;font-size:14px;line-height:1.45"><span class="serif" style="color:var(--saffron)">' + n.k + '</span><span>' + esc(n.text) + '</span></div>').join('') + '<span class="small">These fill your Sunday review’s vital three.</span></section>'
    + '<p class="small" style="margin:0;font-size:11px;color:#6E7771">Built on: the 12 Week Year (85% execution), lead and lag measures (4 Disciplines of Execution), habit formation in about 66 days (Lally, UCL), deep work (Newport), the planning fallacy (Kahneman and Tversky), open loops (Masicampo and Baumeister), WOOP (Oettingen), and the army’s after-action review.</p>'
    + '</div>' + tabs('review');
};

/* ----- 11 · Rules ----- */
routes.rules = () => {
  const s = state.settings, t = todayISO(), b = brahma(t), pk = peakFor(t);
  const words = affFor(t);
  const sw = (k, label, sub) => '<button class="switch" role="switch" aria-checked="' + !!s.toggles[k] + '" data-a="toggle" data-k="' + k + '"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:15px">' + label + '</span><span class="small">' + sub + '</span></span><span class="k" aria-hidden="true"></span></button>';
  const grp = (title, src, ink, rows) => '<section class="sec"><div class="sechead"><h2>' + title + '</h2><span class="small" style="color:' + ink + '">' + src + '</span></div>' + rows.map((r) => '<div class="row" style="min-height:50px"><span class="grow"><span class="t">' + r[0] + '</span><span class="s">' + r[1] + '</span></span><span class="num" style="font-size:14px;font-weight:600;color:' + ink + ';text-align:right">' + r[2] + '</span></div>').join('') + '</section>';
  return '<div class="screen">'
    + '<div class="top">' + backBtn('#today', 'Back to today') + '<span class="eyebrow">v' + VERSION + '</span></div>'
    + '<div style="display:flex;align-items:center;gap:16px"><span class="avatar" style="width:64px;height:64px;border-radius:32px;font-size:22px">' + esc(s.initials) + '</span><div><h1 style="font-size:28px">The rules of the system</h1><span class="small">Set once. The app follows them every day.</span></div></div>'
    + grp('Your body clock', 'worked out every day', '#8A5A00', [['Brahma Muhurta', '96 to 48 min before sunrise · ' + esc(s.city), hm(b.start) + ' – ' + hm(b.end)], ['Peak hours today', 'Start 2½ h after you wake, for 2½ h · ONE Thing goes here', hm(pk.start) + ' – ' + hm(pk.end)], ['If you wake later', 'Same rule from your first open of the day', 'Auto'], ['Energy dip', 'After lunch · admin and errands go here', '14:00 – 15:00']])
    + '<section class="sec"><div class="sechead"><h2>Limits</h2><span class="small" style="color:var(--emerald)">Lean · work in progress</span></div>'
    + [['projects', 'Active projects', 'A fourth waits until one finishes', ''], ['three', 'Tasks in the day’s three', 'The ONE Thing is always first', ''], ['buffer', 'Buffer kept free', 'So one delay never ruins the day', '%'], ['deep', 'Deep work, daily minimum', 'Minutes, protected like a meeting', ' min']].map((x) => '<label class="row" style="min-height:50px"><span class="grow"><span class="t">' + x[1] + '</span><span class="s">' + x[2] + '</span></span><input class="input num" style="width:82px;min-height:40px;text-align:right;font-weight:600;color:var(--emerald)" type="number" inputmode="numeric" data-in="limit" data-k="' + x[0] + '" value="' + s.limits[x[0]] + '" aria-label="' + x[1] + '"></label>').join('') + '</section>'
    + '<section class="sec"><div class="sechead"><h2>Your time</h2><span class="small" style="color:var(--rose)">batching</span></div><div class="row"><span class="grow"><span class="t">Message windows</span><span class="s">Check messages and calls only at these times</span></span></div><div class="grid3">' + s.msgWindows.map((w, k) => '<input class="input num" type="time" data-in="msgw" data-k="' + k + '" value="' + w + '" aria-label="Message window ' + (k + 1) + '">').join('') + '</div>'
    + '<div class="row"><span class="grow"><span class="t">Lunch</span><span class="s">Flexible · tap “Lunch now” on Today and the plan shifts</span></span><span class="num" style="font-weight:600;color:var(--rose)">' + s.lunch.mins + ' min</span></div></section>'
    + '<section class="sec"><div class="sechead"><h2>The morning words</h2><span class="small" style="color:var(--saffron)">day ' + (affDay(t) + 1) + ' of 30 · 150 lines</span></div>' + words.map((w, k) => '<label style="display:flex;flex-direction:column;gap:4px;padding:12px 0;border-bottom:1px solid var(--rule)"><span style="font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:' + AREA_INK[w.area][0] + '">' + ['I', 'II', 'III', 'IV', 'V'][k] + ' · ' + w.area + '</span><input class="input line" data-in="aff" data-k="' + k + '" value="' + esc(w.text) + '" aria-label="' + w.area + ' affirmation"></label>').join('') + '</section>'
    + '<section class="sec"><div class="sechead"><h2>Connected</h2></div>'
    + sw('calendar', 'Google Calendar', 'Placed blocks appear in a “Planner” calendar on your iPhone') + sw('drive', 'Week report to Google Drive', 'Every Sunday · a PDF in Planner / Week reports') + sw('notifications', 'Reminders', '10 min before each block · needs one more setup step') + sw('focus', 'iPhone Focus with the quiet hour', 'Through a Shortcut · notifications held') + sw('birthday', 'A letter on my birthday', 'Your year, summarised on 23 May') + '</section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>Google Sheet sync</h2><span class="small" style="color:' + (s.syncUrl ? 'var(--emerald)' : 'var(--rose)') + '">' + (s.syncUrl ? (s.lastSync ? 'saved ' + capturedLabel(s.lastSync) : 'connected') : 'not set up') + '</span></div>'
    + '<label class="field"><span>Web app link</span><input class="input" data-in="syncUrl" value="' + esc(s.syncUrl) + '" placeholder="https://script.google.com/macros/s/…/exec" inputmode="url" autocapitalize="off" autocorrect="off"></label>'
    + '<label class="field"><span>Secret word</span><input class="input" data-in="syncKey" value="' + esc(s.syncKey) + '" placeholder="The same word you put in the script" autocapitalize="off" autocorrect="off"></label>'
    + '<div class="grid2"><button class="btn" data-a="syncTest">Test and save now</button><button class="btn ghost" data-a="syncRestore">Restore from Sheet</button></div></section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>Shortcuts</h2><span class="small">set up once</span></div>'
    + '<details class="card"><summary><b>Back tap twice → Quick capture</b></summary><ol class="small" style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6"><li>Open the Shortcuts app → + → name it <b>Quick Capture</b>.</li><li>Add <b>Dictate Text</b> (or <b>Ask for Input</b> to type).</li><li>Add <b>Get Contents of URL</b>: your web app link above, Method <b>POST</b>, Request Body <b>JSON</b> with fields <b>op</b> = capture, <b>key</b> = your secret word, <b>text</b> = Dictated Text.</li><li>Add <b>Show Notification</b>: “Captured”.</li><li>Settings → Accessibility → Touch → <b>Back Tap</b> → <b>Double Tap</b> → choose <b>Quick Capture</b>.</li></ol><p class="small" style="margin:8px 0 0">The note lands in Decide the next time you open the app. No sync yet? Use <b>Open URLs</b> with this app’s link ending in <b>#capture</b> instead.</p></details>'
    + '<details class="card"><summary><b>Brahma Muhurta alarm</b></summary><ol class="small" style="margin:8px 0 0;padding-left:18px;font-size:13px;line-height:1.6"><li>New shortcut named exactly <b>Brahma Alarm</b>.</li><li>Add <b>Get Dates from Input</b> (Shortcut Input), then <b>Create Alarm</b> at that time, label “Brahma Muhurta”.</li><li>Turn on “Show in Share Sheet” is not needed. Done.</li></ol><p class="small" style="margin:8px 0 0">Now “Set alarm for tomorrow” on Today sets a real alarm in your Clock app.</p></details>'
    + '</section>'
    + '<section class="sec" style="gap:10px"><div class="sechead"><h2>Your data</h2></div><div class="grid2"><button class="btn ghost" data-a="exportData">Back up to a file</button><label class="btn ghost" style="cursor:pointer">Restore a file<input type="file" accept="application/json" data-in="importData" class="sr"></label></div><span class="small">Everything lives on this phone first, so the app opens instantly and works offline.</span></section>'
    + '</div>' + tabs('');
};

/* ----- 12 · Away ----- */
routes.away = () => {
  const t = todayISO();
  const cur = state.away.find((a) => !a.ended && a.to >= t);
  const f = ui.awayForm || (ui.awayForm = { kind: 0, from: addDays(t, 1), to: addDays(t, 3), opts: { pause: true, family: true, noOne: true, brief: true, freeze: true } });
  const kinds = [['Vacation', 'Rest · everything pauses'], ['Business tour', 'Travel for work'], ['Class or course', 'A few days of learning'], ['Other', 'Wedding, family, anything']];
  const rows = [['pause', 'Pause rhythms', 'Gym, steam bath, haircut and the rest wait till you are back'], ['family', 'Keep the family calls', 'Mom and Dad daily, my sister every other day'], ['noOne', 'No ONE Thing, no shutdown gate', 'Nothing to close at night'], ['brief', 'Keep the morning brief', 'Still there at 9 AM, read it when you like'], ['freeze', 'Streaks frozen', 'Away days never count as missed']];
  const n = Math.max(1, daysBetween(f.from, f.to) + 1);
  return '<div class="screen notab">'
    + '<div class="top">' + backBtn('#plan', 'Back to plan') + '<span class="eyebrow">Away mode</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:8px"><h1>Going away</h1><p class="lede">A trip, a tour or a class. The plan steps aside, and nothing counts as missed.</p></div>'
    + (cur ? '<section class="panel green"><span class="kicker" style="color:#F2C14E">Away · ' + esc(cur.kind) + '</span><span class="serif" style="font-size:24px">' + fmtShort(cur.from) + ' → ' + fmtShort(cur.to) + '</span><button class="btn gold" data-a="awayEnd" data-id="' + cur.id + '">End away mode now</button></section>' : '')
    + '<section class="sec" style="gap:10px"><span class="kicker">What is it</span><div class="grid2">' + kinds.map((k, i) => '<button class="choice" style="--c:var(--saffron);min-height:64px" data-a="awayKind" data-k="' + i + '" aria-pressed="' + (f.kind === i) + '"><b style="font-size:19px">' + k[0] + '</b><span>' + k[1] + '</span></button>').join('') + '</div></section>'
    + '<section class="sec" style="gap:10px"><span class="kicker">When</span><div style="display:grid;grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr);align-items:center;gap:6px"><label class="field"><span class="sr">From</span><input type="date" class="input" data-in="awayFrom" value="' + f.from + '" min="' + t + '" style="background:var(--tint);border-color:var(--saffron)"></label><span aria-hidden="true" style="text-align:center">→</span><label class="field"><span class="sr">To</span><input type="date" class="input" data-in="awayTo" value="' + f.to + '" min="' + f.from + '" style="background:var(--tint);border-color:var(--saffron)"></label></div><span class="small">' + n + ' day' + (n > 1 ? 's' : '') + ' · back on ' + fmtShort(addDays(f.to, 1)) + '</span></section>'
    + '<section class="sec"><span class="kicker" style="margin-bottom:4px">While you are away</span>' + rows.map((r) => '<button class="switch" role="switch" aria-checked="' + !!f.opts[r[0]] + '" data-a="awayOpt" data-k="' + r[0] + '"><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:15px">' + r[1] + '</span><span class="small">' + r[2] + '</span></span><span class="k" aria-hidden="true"></span></button>').join('') + '</section>'
    + '<section class="sec" style="gap:10px"><span class="kicker">Each morning away, one pop-up</span><div style="border-radius:18px;background:#E4E1D6;padding:12px 14px;display:flex;gap:10px"><span class="avatar" style="width:34px;height:34px;border-radius:8px;background:var(--emerald);color:var(--sun);border:none;font-size:13px">' + esc(state.settings.initials) + '</span><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:12px">Planned for today</b><span style="font-size:13px">Anything you had placed on that day. Tap to keep, move, or let it wait.</span></span></div><span class="small">Nothing is moved for you. If a day has nothing planned, there is no pop-up.</span></section>'
    + '<button class="btn" data-a="awayStart">Start away mode · ' + kinds[f.kind][0].toLowerCase() + ' · ' + fmtDM(f.from) + ' – ' + fmtDM(f.to) + '</button>'
    + '<p class="small" style="margin:0">On the day you are back, the morning opens with a short re-entry: sort what came in, then re-plan the week.</p>'
    + '</div>';
};

/* ----- 13 · Manifest ----- */
routes.manifest = () => {
  const w = ui.wish;
  const t = todayISO();
  return '<div class="screen notab">'
    + '<div class="top">' + backBtn('#today', 'Back') + '<span class="eyebrow">Manifest</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:10px"><h1>Want it. See it.<br>Plan for it.</h1><p class="small" style="margin:0;font-size:13px">Write a wish in plain words. It becomes an affirmation, a picture to hold, and a plan for what stands in the way.</p></div>'
    + '<section class="sec" style="gap:10px"><span class="kicker">Your wish</span><div style="display:flex;gap:8px"><input id="wishText" class="input" style="font-family:var(--text);font-style:italic;font-size:18px;background:var(--card)" placeholder="e.g. A BMW by January" value="' + esc(w ? w.raw : '') + '"><button class="btn gold" style="width:auto;flex-shrink:0;background:var(--saffron);color:#F6F5F0" data-a="wishTurn">Turn it</button></div></section>'
    + (w ? '<section class="panel green" style="gap:14px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="kicker" style="color:#F2C14E;letter-spacing:.24em">' + esc(w.title) + ' · by ' + fmtDM(w.by) + '</span><span class="small">' + Math.max(0, daysBetween(t, w.by)) + ' days</span></div>'
      + [['say', 'I · Say it', '#9ED3B2'], ['see', 'II · See it · 20 seconds', '#9ED3B2'], ['obstacle', 'III · What stands in the way', '#F0A9BC'], ['ifthen', 'IV · If, then', '#F2C14E'], ['step', 'V · First step', '#A9C2EC']].map((f) => '<label style="display:flex;flex-direction:column;gap:4px;border-top:1px solid #3E7562;padding-top:10px"><span style="font-size:10px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:' + f[2] + '">' + f[1] + '</span><textarea class="input" rows="2" data-in="wishField" data-k="' + f[0] + '" style="background:transparent;border:none;padding:0;color:#F4F1E6;' + (f[0] === 'say' ? 'font-family:var(--text);font-style:italic;font-size:20px' : 'font-size:14px') + '">' + esc(w[f[0]]) + '</textarea></label>').join('')
      + '<button class="btn gold" data-a="wishSave">' + (w.saved ? '✓ Saved' : 'Save it') + '</button><span class="small">Read each morning, after your five affirmations, until ' + fmtDM(w.by) + '.</span></section>' : '')
    + '<section class="sec"><div class="sechead"><h2>Your wishes</h2></div>' + (state.wishes.length ? state.wishes.map((x) => { const left = daysBetween(t, x.by); return '<div class="row"><span class="grow"><span class="t">' + esc(x.title) + '</span><span class="s">By ' + fmtDM(x.by) + ' · ' + (x.status === 'active' ? 'read every morning' : x.status) + '</span></span>' + (x.status === 'active' && left < 0 ? '<span style="display:flex;gap:4px"><button class="chip" style="width:auto;padding:0 8px;min-height:34px;--c:var(--emerald)" data-a="wishGot" data-id="' + x.id + '">Got it</button><button class="chip" style="width:auto;padding:0 8px;min-height:34px" data-a="wishExtend" data-id="' + x.id + '">+30 days</button></span>' : '<span class="num small" style="font-weight:600;color:var(--emerald)">' + (x.status === 'active' ? left + ' days' : '✓') + '</span>') + '<button class="link" style="color:var(--rose);padding-left:8px" data-a="wishDel" data-id="' + x.id + '" aria-label="Remove">×</button></div>'; }).join('') : '<div class="empty" style="margin-top:10px">Nothing saved yet. Save a wish and it joins your morning ritual.</div>') + '</section>'
    + '<section style="border-left:3px solid var(--sapphire);padding:2px 0 2px 14px;display:flex;flex-direction:column;gap:6px"><span class="kicker" style="color:var(--sapphire)">Why it is built this way</span><p class="small" style="margin:0;font-size:13px;color:#33403A">Psychologist Gabriele Oettingen found that only dreaming about a wish can lower the energy to chase it. Pairing the dream with the obstacle and an if-then plan (her “WOOP” method) raised follow-through. So every wish here gets all five parts.</p></section>'
    + '</div>';
};
function turnWish(raw) {
  const t = todayISO();
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  let text = raw.trim().replace(/[.!]+$/, '');
  let by = addDays(t, 90);
  const m = /\s+(?:by|before|till|until)\s+(.+)$/i.exec(text);
  if (m) {
    const when = m[1].toLowerCase().trim();
    text = text.slice(0, m.index).trim();
    const mi = months.findIndex((x) => when.startsWith(x.slice(0, 3)));
    const dm = /(\d{1,2})/.exec(when);
    if (mi >= 0) { const now = parseISO(t); let y = now.getFullYear(); const yd = /(20\d\d)/.exec(when); if (yd) y = +yd[1]; else if (mi < now.getMonth()) y += 1; const dd = dm && !yd ? +dm[1] : new Date(y, mi + 1, 0).getDate(); by = iso(new Date(y, mi, Math.min(dd, new Date(y, mi + 1, 0).getDate()))); }
    else if (/(\d+)\s*(day|week|month)/.test(when)) { const q = /(\d+)\s*(day|week|month)/.exec(when); by = addDays(t, +q[1] * (q[2] === 'day' ? 1 : q[2] === 'week' ? 7 : 30)); }
  }
  const thing = text.replace(/^(i want|i need|i wish for|i will get|get|buy|a |an )/i, '').trim() || text;
  const title = thing.charAt(0).toUpperCase() + thing.slice(1);
  const isBuy = /car|bmw|merc|audi|house|flat|watch|phone|bike|home|rolex/i.test(thing);
  const dateWords = parseISO(by).getDate() + ' ' + parseISO(by).toLocaleDateString('en-IN', { month: 'long' });
  return {
    raw, title, by,
    say: isBuy ? 'I own ' + (/^(a|an|the|my)\s/i.test(thing) ? thing.replace(/^(a|an|the)\s/i, 'my ') : 'my ' + thing) + ', paid for by the business I built, by ' + dateWords + '.' : 'I have ' + thing + ', fully and gratefully, by ' + dateWords + '.',
    see: isBuy ? 'The keys in your hand. Bringing it home, and the look on Mom and Dad’s faces.' : 'The moment it is real: where you are, who is with you, how it feels.',
    obstacle: isBuy ? 'Sales falling short of the weekly target.' : 'The habit or fear that usually gets in the way.',
    ifthen: isBuy ? 'If a week ends short, then I add five buyer calls on Monday morning.' : 'If that obstacle shows up, then I take one small step the same day.',
    step: isBuy ? 'Choose the model and its on-road price, then set aside a fixed amount each month.' : 'Write the very first action, and place it in Decide today.',
  };
}

/* ----- 14 · Brief (opens the live page) ----- */
routes.brief = () => { location.href = BRIEF_URL; return routes.today(); };

/* =====================================================================
   ROUTER, RENDER, EVENTS
   ===================================================================== */
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  const q = {}; (qs || '').split('&').forEach((p) => { if (!p) return; const [k, v] = p.split('='); q[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' ')); });
  return { name: parts[0] || 'today', arg: parts[1], q };
}
let lastRoute = '';
function render() {
  const { name, arg, q } = parseHash();
  const fn = routes[name] || routes.today;
  document.body.className = '';
  const html = fn(q, arg);
  const app = document.getElementById('app');
  const keepScroll = lastRoute === location.hash;
  const y = window.scrollY;
  app.innerHTML = html;
  if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  lastRoute = location.hash;
  const theme = document.body.className === 'theme-dark' ? '#1C2B45' : document.body.className === 'theme-green' ? '#145A43' : '#EFEDE5';
  const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', theme);
  if (name === 'focus') { focusTick(); if (!tickTimer) tickTimer = setInterval(focusTick, 1000); }
  if (name === 'capture') { const ta = document.getElementById('capText'); if (ta) { ta.focus(); if (q.text && !q.done) { /* opened from a Shortcut with text */ } } }
}

const actions = {
  ritualSay() { const d = day(); d.said[ui.ritual.i] = true; ui.ritual.i = Math.min(ui.ritual.i + 1, 5 + (state.wishes.some((w) => w.status === 'active') ? 1 : 0) - 1); save(); render(); },
  ritualPrev() { ui.ritual.i = Math.max(0, ui.ritual.i - 1); render(); },
  ritualNext() { ui.ritual.i = Math.min(ui.ritual.i + 1, 5 + (state.wishes.some((w) => w.status === 'active') ? 1 : 0) - 1); render(); },
  ritualDone() { const d = day(); d.ritualDone = true; const r = state.rhythms.find((x) => x.id === 'ritual'); if (r) rhythmDone(r, todayISO()); save(); location.hash = decideCount() ? '#decide' : '#today'; },
  capSave() { const ta = document.getElementById('capText'); const v = (ta && ta.value || '').trim(); if (!v) { toast('Type or say something first.'); return; } state.notes.push({ id: uid(), text: v.slice(0, 500), at: new Date().toISOString(), src: 'typed' }); save(); ta.value = ''; toast('Kept. It waits in Decide.'); render(); },
  dChoice(el) { ui.decide.choice = +el.dataset.k; ui.decide.customTime = ''; render(); },
  dDay(el) { ui.decide.day = +el.dataset.k; ui.decide.slot = 0; ui.decide.customTime = ''; render(); },
  dSlot(el) { ui.decide.slot = +el.dataset.k; ui.decide.customTime = ''; render(); },
  dLen(el) { ui.decide.len = +el.dataset.k; ui.decide.lenTouched = true; ui.decide.slot = 0; render(); },
  dDDay(el) { ui.decide.dday = +el.dataset.k; render(); },
  dRep(el) { ui.decide.rep = +el.dataset.k; render(); },
  dPrev() { ui.decide.i = Math.max(0, ui.decide.i - 1); resetDecide(); render(); },
  dSkipItem() { ui.decide.i += 1; resetDecide(); render(); },
  dConfirm() { confirmDecide(); },
  alarm() {
    const tm = addDays(todayISO(), 1); const d = day(tm); d.alarm = !d.alarm; save(); render();
    if (d.alarm) { const at = hm(brahma(tm).alarm); toast('Setting your alarm for ' + at); setTimeout(() => { location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent('Brahma Alarm') + '&input=text&text=' + encodeURIComponent(at); }, 350); }
  },
  pickOne() { ui.pickOne = true; render(); },
  pickOneClose() { ui.pickOne = false; render(); },
  setOne(el) { const d = day(); state.tasks.forEach((x) => { if (x.date === todayISO()) x.one = false; }); const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) { x.one = true; d.one = x.id; } ui.pickOne = false; save(); render(); },
  done(el) { const x = state.tasks.find((y) => y.id === el.dataset.id); if (!x) return; completeTask(x, !x.done); save(); if (x.done) { try { navigator.vibrate && navigator.vibrate(15); } catch (e) { /* none */ } } render(); },
  cant(el) { ui.cant = el.dataset.id; const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) { x.cantFrom = { date: x.date, time: x.time }; x.list = 'dated'; x.date = addDays(todayISO(), 1); x.time = null; } save(); render(); },
  cantDone() { ui.cant = null; render(); },
  fill(el) { const w = state.tasks.find((y) => y.id === el.dataset.id); const src = state.tasks.find((y) => y.id === el.dataset.for); if (!w) return; const used = state.tasks.filter((y) => y.filledFor === el.dataset.for).reduce((s, y) => s + (y.mins || 0), 0); const start = src && src.cantFrom ? toMin(src.cantFrom.time) + used : ceil30(nowMin()); w.list = 'todo'; w.date = todayISO(); w.time = hm(Math.max(start, nowMin())); w.filled = true; w.filledFor = el.dataset.for; save(); toast('Placed at ' + w.time); render(); },
  lunch() { const t = todayISO(); const d = day(t); const L = state.settings.lunch.mins; const now = round5(nowMin()); d.lunchAt = hm(now); let cursor = now + L; tasksOn(t).filter((x) => x.time && !x.done && toMin(x.time) >= now - 5).forEach((x) => { if (toMin(x.time) < cursor) { x.time = hm(cursor); } cursor = Math.max(cursor, toMin(x.time) + (x.mins || 30)); }); save(); toast('Enjoy lunch. The plan moved by ' + L + ' min.'); render(); },
  planEdit() { ui.planEdit = !ui.planEdit; render(); },
  rhythmEdit() { ui.rhythmEdit = !ui.rhythmEdit; ui.editRhythm = null; ui.addRhythm = null; render(); },
  rEdit(el) { ui.editRhythm = ui.editRhythm === el.dataset.id ? null : el.dataset.id; render(); },
  rLen(el) { const r = state.rhythms.find((x) => x.id === el.dataset.id); if (r) { r.len = +el.dataset.m; save(); render(); } },
  rDelete(el) { state.rhythms = state.rhythms.filter((x) => x.id !== el.dataset.id); ui.editRhythm = null; save(); render(); },
  addRhythm() { ui.addRhythm = { name: '', f: 2, every: 10, len: 30, area: 'Health' }; render(); },
  addRhythmCancel() { ui.addRhythm = null; render(); },
  rFreq(el) { ui.addRhythm.f = +el.dataset.k; render(); },
  rNewLen(el) { ui.addRhythm.len = +el.dataset.m; render(); },
  rArea(el) { ui.addRhythm.area = el.dataset.v; render(); },
  rAdd() {
    const a = ui.addRhythm; if (!a.name.trim()) { toast('Type what the rhythm is first.'); return; }
    const F = [{ t: 'daily' }, { t: 'every', n: 2 }, { t: 'every', n: 7 }, { t: 'every', n: 15 }, { t: 'month' }, { t: 'every', n: Math.max(1, +a.every || 1) }][a.f];
    const r = { id: uid(), name: a.name.trim(), area: a.area, freq: F, len: a.len, nextDue: todayISO(), last: null, skips: [], done: [], custom: true };
    r.when = freqLabel(r).replace(/^./, (c) => c.toUpperCase());
    state.rhythms.splice(state.rhythms.length - 3, 0, r); ui.addRhythm = null; save(); toast('Rhythm added. It shows up in Decide when due.'); render();
  },
  fLen(el) { const f = state.focus; if (f.running) { toast('Pause first to change the length.'); return; } f.mins = +el.dataset.m; f.total = f.left = f.mins * 60; save(); render(); },
  fToggle() { const f = state.focus; if (f.running) { f.left = Math.max(0, Math.round((f.endAt - Date.now()) / 1000)); f.running = false; f.endAt = null; } else { if (f.left === 0) f.left = f.total; f.running = true; f.endAt = Date.now() + f.left * 1000; const x = state.tasks.find((y) => y.id === f.taskId); if (x && !x.started) x.started = new Date().toISOString(); } save(); focusTick(); },
  fPlus() { const f = state.focus; f.total += 600; if (f.running) f.endAt += 600000; else f.left += 600; save(); focusTick(); },
  fDone() { const f = state.focus; finishFocus(false); const x = state.tasks.find((y) => y.id === f.taskId); if (x && !x.done) completeTask(x, true); state.focus = null; save(); toast('Done. Well played.'); location.hash = '#today'; },
  park() { const i = document.getElementById('parkText'); const v = (i && i.value || '').trim(); if (!v) return; state.notes.push({ id: uid(), text: v, at: new Date().toISOString(), src: 'focus' }); save(); i.value = ''; render(); },
  lTab(el) { ui.listTab = +el.dataset.k; ui.openRow = null; render(); },
  lOpen(el) { ui.openRow = ui.openRow === el.dataset.id ? null : el.dataset.id; render(); },
  lDone(el) { const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) completeTask(x, true); ui.openRow = null; save(); render(); },
  lToday(el) { const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) { state.notes.push({ id: uid(), text: x.title, at: new Date().toISOString(), src: x.list }); state.tasks = state.tasks.filter((y) => y !== x); } ui.openRow = null; save(); location.hash = '#decide'; },
  lBack(el) { const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) { state.notes.push({ id: uid(), text: x.title, at: new Date().toISOString(), src: 'from ' + x.list }); state.tasks = state.tasks.filter((y) => y !== x); } ui.openRow = null; save(); render(); },
  lDel(el) { state.tasks = state.tasks.filter((y) => y.id !== el.dataset.id); ui.openRow = null; save(); toast('Deleted.'); render(); },
  loop(el) {
    const { id, kind } = el.dataset, k = el.dataset.k, tm = addDays(todayISO(), 1);
    if (kind === 'note') {
      const n = state.notes.find((x) => x.id === id); if (!n) return;
      if (k === 'tomorrow') addTask({ title: n.text, list: 'dated', date: tm, mins: 30 });
      if (k === 'wait') addTask({ title: n.text, list: 'waiting', mins: 30 });
      if (k === 'someday') addTask({ title: n.text, list: 'someday' });
      state.notes = state.notes.filter((x) => x !== n);
    } else if (kind === 'rtask') {
      const x = state.tasks.find((y) => y.id === id); if (!x) return;
      if (k === 'did') completeTask(x, true);
      else { const r = state.rhythms.find((y) => y.id === x.rhythm); if (r && !r.skips.includes(x.date)) r.skips.push(x.date); state.tasks = state.tasks.filter((y) => y !== x); }
    } else {
      const x = state.tasks.find((y) => y.id === id); if (!x) return;
      if (k === 'tomorrow') { x.list = 'dated'; x.date = tm; x.time = null; }
      if (k === 'wait') { x.list = 'waiting'; x.date = null; x.time = null; }
      if (k === 'someday') { x.list = 'someday'; x.date = null; x.time = null; }
      if (k === 'go') state.tasks = state.tasks.filter((y) => y !== x);
    }
    save(); render();
  },
  energy(el) { day().energy = +el.dataset.k; save(); render(); },
  oneSugg(el) { day(addDays(todayISO(), 1)).oneText = el.dataset.v; save(); render(); },
  closeDay() { const d = day(); d.shutdown = true; const r = state.rhythms.find((x) => x.id === 'shutdown'); if (r) rhythmDone(r, todayISO()); save(); toast('Day closed. Good night, ' + state.settings.name + '.'); render(); },
  bal(el) { const r = review(); r.balance = r.balance || [3, 3, 3, 3, 3]; r.balance[+el.dataset.k] = +el.dataset.v; save(); render(); },
  seal() {
    const r = review(); r.sealed = true;
    const inputs = [...document.querySelectorAll('[data-in="rvital"]')].map((i) => i.value.trim());
    r.vital = inputs; if (inputs.some(Boolean)) state.plan.vital = inputs.map((v, k) => v || state.plan.vital[k] || '');
    const wk = weekKey(todayISO());
    state.plan.sales.weeks = state.plan.sales.weeks.filter((w) => w.week !== wk);
    if (r.sales !== '' && r.sales != null && !isNaN(+r.sales)) state.plan.sales.weeks.push({ week: wk, lakh: +r.sales });
    const s = state.rhythms.find((x) => x.id === 'sunday'); if (s) rhythmDone(s, todayISO());
    save(); toast('Week sealed. The plan is updated.'); location.hash = '#plan';
  },
  repView() { document.getElementById('report').scrollIntoView({ behavior: 'smooth' }); },
  repPdf() { window.print(); },
  async repDrive() { toast('Saving to Google Drive…'); const ok = await syncReport(reportHTML(), 'Week report ' + lastWeekEnd()); toast(ok ? 'Saved to Drive · Planner / Week reports' : 'Could not save. Check Google Sheet sync in Rules.'); },
  toggle(el) { const k = el.dataset.k; state.settings.toggles[k] = !state.settings.toggles[k]; save(); render(); },
  async syncTest() { if (!state.settings.syncUrl) { toast('Paste the web app link first.'); return; } toast('Connecting…'); const ok = await syncPull(true); if (ok) { await syncPush(); toast('Connected. Saved to your Google Sheet.'); render(); } else toast('Could not connect. Check the link and the secret word.'); },
  async syncRestore() {
    const s = state.settings; if (!s.syncUrl) { toast('Paste the web app link first.'); return; }
    if (!ui.restoreArmed) { ui.restoreArmed = true; toast('Tap Restore again to replace this phone’s data with the Sheet copy.'); setTimeout(() => { ui.restoreArmed = false; }, 6000); return; }
    ui.restoreArmed = false;
    try { const r = await fetch(s.syncUrl + '?op=state&key=' + encodeURIComponent(s.syncKey)); const j = await r.json(); if (j && j.ok && j.state && j.state.v) { const keep = { syncUrl: s.syncUrl, syncKey: s.syncKey }; state = migrate(j.state); Object.assign(state.settings, keep); save(); toast('Restored from your Google Sheet.'); render(); } else toast('Nothing to restore yet.'); } catch (e) { toast('Could not reach your Google Sheet.'); }
  },
  exportData() { const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'planner-backup-' + todayISO() + '.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); },
  awayKind(el) { ui.awayForm.kind = +el.dataset.k; render(); },
  awayOpt(el) { const o = ui.awayForm.opts; o[el.dataset.k] = !o[el.dataset.k]; render(); },
  awayStart() { const f = ui.awayForm; if (f.to < f.from) { toast('The end date is before the start.'); return; } state.away.push({ id: uid(), kind: ['Vacation', 'Business tour', 'Class or course', 'Other'][f.kind], from: f.from, to: f.to, opts: Object.assign({}, f.opts) }); save(); toast('Away mode set. Enjoy it.'); location.hash = '#today'; },
  awayEnd(el) { const a = state.away.find((x) => x.id === el.dataset.id); if (a) { a.ended = true; a.to = addDays(todayISO(), -1); } save(); toast('Welcome back.'); render(); },
  wishTurn() { const i = document.getElementById('wishText'); const v = (i && i.value || '').trim(); if (!v) { toast('Write a wish first, like “A BMW by January”.'); return; } ui.wish = turnWish(v); render(); },
  wishSave() { const w = ui.wish; if (!w) return; if (!w.saved) { state.wishes.push({ id: uid(), title: w.title, by: w.by, say: w.say, see: w.see, obstacle: w.obstacle, ifthen: w.ifthen, step: w.step, status: 'active', created: todayISO() }); addTask({ title: 'First step · ' + w.title, list: 'dated', date: todayISO(), mins: 30, area: 'Purpose' }); w.saved = true; save(); toast('Saved. It joins your morning ritual, and its first step is in Decide.'); } render(); },
  wishGot(el) { const w = state.wishes.find((x) => x.id === el.dataset.id); if (w) w.status = 'got it'; save(); toast('Congratulations.'); render(); },
  wishExtend(el) { const w = state.wishes.find((x) => x.id === el.dataset.id); if (w) w.by = addDays(todayISO(), 30); save(); render(); },
  wishDel(el) { state.wishes = state.wishes.filter((x) => x.id !== el.dataset.id); save(); render(); },
};
function review() { const k = weekKey(todayISO()); if (!state.reviews[k]) state.reviews[k] = {}; return state.reviews[k]; }
function resetDecide() { Object.assign(ui.decide, { choice: -1, day: 0, slot: 0, len: 2, lenTouched: false, dday: 1, rep: 0, customTime: '' }); }
function confirmDecide() {
  const q = decideQueue(); const s = ui.decide; const cur = q[s.i]; if (!cur) return;
  const defsKey = (cur.kind === 'rhythm' || cur.kind === 'one') ? ['todo', 'skip'] : cur.kind === 'dated' ? ['todo', 'date', 'go'] : ['todo', 'date', 'wait', 'someday', 'go'];
  const key = defsKey[s.choice]; const t = todayISO();
  const dsel = cur.kind === 'dated' ? t : [t, addDays(t, 1), s.pickDate || addDays(t, 2)][s.day];
  const len = cur.fixed ? cur.len : LENS[s.len];
  const slots = freeSlots(dsel, len, 9);
  const time = s.customTime || (slots[s.slot] && slots[s.slot].time);
  const dd = [addDays(t, 1), firstOfNextMonth(t), s.ddate][s.dday];
  if (key === 'todo' && !time) { toast('Pick a slot first.'); return; }
  if (key === 'date' && !dd) { toast('Pick a date first.'); return; }
  let msg = '';
  if (cur.kind === 'rhythm') {
    if (key === 'todo') { addTask({ title: cur.r.name, rhythm: cur.r.id, date: dsel, time, mins: len, area: cur.r.area }); msg = cur.r.name + ' · ' + time; }
    else { cur.r.skips.push(t); if (['every', 'month'].includes(cur.r.freq.t)) cur.r.nextDue = nextDueAfter(cur.r, t); msg = 'Skipped this time.'; }
  } else if (cur.kind === 'one') {
    const d = day(t);
    if (key === 'todo') { const x = addTask({ title: cur.text, date: dsel, time, mins: len, area: 'Wealth', one: dsel === t }); if (dsel === t) d.one = x.id; d.onePlaced = true; msg = 'ONE Thing at ' + time; }
    else { d.onePlaced = true; msg = 'Okay. Pick one later.'; }
  } else if (cur.kind === 'dated') {
    const x = cur.x;
    if (key === 'todo') { x.list = 'todo'; x.date = t; x.time = time; x.mins = len; msg = 'Placed at ' + time; }
    if (key === 'date') { x.date = dd; msg = 'Back on ' + fmtShort(dd); }
    if (key === 'go') { state.tasks = state.tasks.filter((y) => y !== x); msg = 'Let go.'; }
  } else {
    const n = cur.n;
    if (key === 'todo') { addTask({ title: n.text, date: dsel, time, mins: len }); msg = 'Added · ' + time; }
    if (key === 'date') { addTask({ title: n.text, list: 'dated', date: dd, mins: 30, repeat: ['once', 'week', 'month'][s.rep] }); msg = 'Back on ' + fmtShort(dd); }
    if (key === 'wait') { addTask({ title: n.text, list: 'waiting', mins: LENS[s.len] }); msg = 'On the Waiting list.'; }
    if (key === 'someday') { addTask({ title: n.text, list: 'someday', mins: 0 }); msg = 'Kept in Someday.'; }
    state.notes = state.notes.filter((x) => x !== n);
  }
  resetDecide();
  save(); toast(msg); render();
}
function reportHTML() {
  const el = document.getElementById('report'); const css = [...document.styleSheets].map((ss) => { try { return [...ss.cssRules].map((r) => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Week report</title><style>' + css + ' .noprint,.tabs{display:none!important} body{background:#EFEDE5}</style></head><body><div id="app">' + (el ? el.outerHTML : '') + '</div></body></html>';
}

/* inputs: update state without re-rendering, so the keyboard stays open */
function onInput(e) {
  const el = e.target; const k = el.dataset.in; if (!k) return;
  const v = el.value; const d = ui.decide;
  switch (k) {
    case 'pickDate': d.pickDate = v; d.slot = 0; render(); return;
    case 'customTime': d.customTime = v; render(); return;
    case 'ddate': d.ddate = v; render(); return;
    case 'vision': state.plan.vision = v; break;
    case 'constraintTitle': state.plan.constraint.title = v; break;
    case 'constraintDetail': state.plan.constraint.detail = v; break;
    case 'goal': state.plan.goals[+el.dataset.k].title = v; break;
    case 'vital': state.plan.vital[+el.dataset.k] = v; break;
    case 'rName': ui.addRhythm.name = v; return;
    case 'rEvery': ui.addRhythm.every = v; return;
    case 'nextStep': { const x = state.tasks.find((y) => y.id === el.dataset.id); if (x) x.next = v; break; }
    case 'wins': day().wins = v; break;
    case 'oneText': day(addDays(todayISO(), 1)).oneText = v; break;
    case 'aar': { const r = review(); r.aar = r.aar || []; r.aar[+el.dataset.k] = v; break; }
    case 'salesWeek': review().sales = v; break;
    case 'rvital': { const r = review(); r.vital = r.vital || ['', '', '']; r.vital[+el.dataset.k] = v; break; }
    case 'limit': { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) state.settings.limits[el.dataset.k] = n; break; }
    case 'msgw': state.settings.msgWindows[+el.dataset.k] = v; break;
    case 'aff': state.aff.overrides[affDay(todayISO()) + ':' + el.dataset.k] = v; break;
    case 'syncUrl': state.settings.syncUrl = v.trim(); break;
    case 'syncKey': state.settings.syncKey = v.trim(); break;
    case 'awayFrom': ui.awayForm.from = v; if (ui.awayForm.to < v) ui.awayForm.to = v; render(); return;
    case 'awayTo': ui.awayForm.to = v; render(); return;
    case 'wishField': if (ui.wish) { ui.wish[el.dataset.k] = v; ui.wish.saved = false; } return;
    case 'importData': return;
    default: return;
  }
  save();
}
async function onChange(e) {
  const el = e.target;
  if (el.dataset.in === 'importData' && el.files && el.files[0]) {
    try { const j = JSON.parse(await el.files[0].text()); if (!j || !j.v) throw new Error('bad'); state = migrate(j); save(); toast('Restored from your backup.'); render(); } catch (err) { toast('That file is not a planner backup.'); }
  }
}

function migrate(s) {
  const base = seed();
  const out = Object.assign({}, base, s);
  out.settings = Object.assign({}, base.settings, s.settings || {});
  out.settings.toggles = Object.assign({}, base.settings.toggles, (s.settings || {}).toggles || {});
  out.settings.limits = Object.assign({}, base.settings.limits, (s.settings || {}).limits || {});
  out.plan = Object.assign({}, base.plan, s.plan || {});
  out.aff = Object.assign({ overrides: {} }, s.aff || {});
  ['notes', 'tasks', 'rhythms', 'wishes', 'away'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = base[k]; });
  ['days', 'reviews', 'reportsSent'].forEach((k) => { if (!out[k] || typeof out[k] !== 'object') out[k] = {}; });
  out.rhythms.forEach((r) => { r.skips = r.skips || []; r.done = r.done || []; });
  return out;
}

/* first open of the day → ritual; Sunday → week report to Drive */
function startOfDay() {
  const t = todayISO(), d = day(t);
  if (!d.wake) { d.wake = hm(nowMin()); save(); }
  if (state.focus && !state.focus.running && state.focus.left === 0) state.focus = null;
  const goRitual = !d.ritualDone && !/^#\/?capture/.test(location.hash) && !/^#\/?focus/.test(location.hash);
  if (goRitual) location.hash = '#ritual';
}
async function sundayReport() {
  const t = todayISO();
  if (weekday(t) !== 0 || !state.settings.toggles.drive || !state.settings.syncUrl || state.reportsSent[t]) return;
  const prev = location.hash; const holder = document.createElement('div'); holder.style.display = 'none';
  holder.innerHTML = routes.report(); document.body.appendChild(holder);
  const el = holder.querySelector('#report');
  const css = [...document.styleSheets].map((ss) => { try { return [...ss.cssRules].map((r) => r.cssText).join('\n'); } catch (e) { return ''; } }).join('\n');
  const html = '<!doctype html><html><head><meta charset="utf-8"><style>' + css + ' .noprint,.tabs{display:none!important}</style></head><body><div id="app">' + (el ? el.outerHTML : '') + '</div></body></html>';
  holder.remove(); document.body.className = '';
  const ok = await syncReport(html, 'Week report ' + t);
  if (ok) { state.reportsSent[t] = true; save(); }
  if (location.hash !== prev) render();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('input', onInput);
document.addEventListener('change', onChange);
window.addEventListener('hashchange', () => { if (!/^#\/?decide/.test(location.hash)) resetDecide(); if (!/^#\/?ritual/.test(location.hash)) ui.ritual.i = 0; ui.cant = null; render(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state) {
    const t = todayISO();
    if (!state.days[t] || !state.days[t].wake) startOfDay();
    syncPull(true); render();
  } else if (state) { clearTimeout(saveTimer); dbSet('state', state); }
});
window.addEventListener('online', () => { syncPull(true); queueSync(); });

async function boot() {
  const [saved, aff] = await Promise.all([dbGet('state'), fetch('affirmations.json').then((r) => r.json()).catch(() => null)]);
  AFF = aff;
  state = saved && saved.v ? migrate(saved) : seed();
  if (!saved) dbSet('state', state);
  const { name, q } = parseHash();
  if (name === 'capture' && q.text) { state.notes.push({ id: uid(), text: q.text.slice(0, 500), at: new Date().toISOString(), src: 'shortcut' }); save(); history.replaceState(null, '', '#decide'); }
  startOfDay();
  render();
  syncPull(true);
  sundayReport();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
window.addEventListener('error', (e) => { try { console.error('[planner]', e.message); } catch (_) { /* ignore */ } });
boot();

export { sunTimes, brahma, peakFor, freeSlots, isDue, turnWish, reportFor };

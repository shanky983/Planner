/**
 * Planner backend — Google Apps Script web app.
 * Saves a backup of the planner, receives back-tap captures, saves the
 * Sunday week report as a PDF in Drive, and puts placed blocks in a
 * "Planner" Google Calendar.
 *
 * SETUP (once, about 5 minutes):
 * 1. Open https://script.google.com → New project → paste this whole file.
 * 2. Change SECRET below to your own word (keep it private).
 * 3. Deploy → New deployment → type "Web app" → Execute as: Me →
 *    Who has access: Anyone → Deploy → allow the permissions.
 * 4. Copy the web app link (ends in /exec) into the app: Rules → Google Sheet sync,
 *    with the same secret word. Tap "Test and save now".
 */
const SECRET = 'change-this-word';
const FOLDER_NAME = 'Planner';
const REPORT_FOLDER = 'Week reports';
const SHEET_NAME = 'Planner data';
const CALENDAR_NAME = 'Planner';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.key !== SECRET) return json_({ ok: false, error: 'wrong key' });
  if (p.op === 'pull') return json_({ ok: true, captures: takeCaptures_() });
  if (p.op === 'state') return json_({ ok: true, state: readState_() });
  if (p.op === 'capture' && p.text) { addCapture_(p.text); return json_({ ok: true }); }
  return json_({ ok: true, hello: 'Planner backend is running' });
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (body.key !== SECRET) return json_({ ok: false, error: 'wrong key' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.op === 'capture') { addCapture_(String(body.text || '')); return json_({ ok: true }); }
    if (body.op === 'save') { writeState_(body.state); writeSheets_(body.state); if (body.events) syncCalendar_(body.events); return json_({ ok: true }); }
    if (body.op === 'report') { const url = saveReport_(String(body.name || 'Week report'), String(body.html || '')); return json_({ ok: true, url: url }); }
    return json_({ ok: false, error: 'unknown op' });
  } finally { lock.releaseLock(); }
}

/* ---------- storage ---------- */
function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
function subfolder_(name) {
  const f = folder_(); const it = f.getFoldersByName(name);
  return it.hasNext() ? it.next() : f.createFolder(name);
}
function stateFile_() {
  const f = folder_(); const it = f.getFilesByName('planner-state.json');
  return it.hasNext() ? it.next() : f.createFile('planner-state.json', '{}', 'application/json');
}
function writeState_(state) { if (state && state.v) stateFile_().setContent(JSON.stringify(state)); }
function readState_() { try { return JSON.parse(stateFile_().getBlob().getDataAsString()); } catch (e) { return null; } }

function book_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('sheetId');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* recreate */ } }
  const ss = SpreadsheetApp.create(SHEET_NAME);
  DriveApp.getFileById(ss.getId()).moveTo(folder_());
  props.setProperty('sheetId', ss.getId());
  return ss;
}
function tab_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); sh.getRange(1, 1, 1, header.length).setFontWeight('bold'); }
  return sh;
}

/* readable copies of the data, so the Sheet is useful on its own */
function writeSheets_(state) {
  const ss = book_();
  const put = (name, header, rows) => {
    const sh = tab_(ss, name, header);
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, header.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  };
  put('Tasks', ['List', 'Title', 'Date', 'Time', 'Minutes', 'Area', 'Done', 'Rhythm'],
    (state.tasks || []).map(function (t) { return [t.list || '', t.title || '', t.date || '', t.time || '', t.mins || '', t.area || '', t.done ? 'yes' : '', t.rhythm || '']; }));
  put('Notes', ['Captured', 'Note', 'From'], (state.notes || []).map(function (n) { return [n.at || '', n.text || '', n.src || '']; }));
  put('Days', ['Date', 'Woke', 'Energy', 'Wins', 'Deep work (min)', 'Day closed', 'Brahma alarm'],
    Object.keys(state.days || {}).sort().map(function (k) { const d = state.days[k] || {}; const deep = (d.focus || []).reduce(function (s, f) { return s + (f.mins || 0); }, 0); return [k, d.wake || '', d.energy || '', d.wins || '', deep, d.shutdown ? 'yes' : '', d.alarm ? 'yes' : '']; }));
  put('Rhythms', ['Rhythm', 'How often', 'Minutes', 'Last done', 'Next due', 'Times done'],
    (state.rhythms || []).map(function (r) { return [r.name, r.when || '', r.len || '', r.last || '', r.nextDue || '', (r.done || []).length]; }));
}

/* ---------- back-tap captures ---------- */
function addCapture_(text) {
  text = String(text || '').trim(); if (!text) return;
  const sh = tab_(book_(), 'Inbox', ['Id', 'Captured', 'Text', 'Picked up']);
  sh.appendRow([Utilities.getUuid(), new Date().toISOString(), text.slice(0, 500), '']);
}
function takeCaptures_() {
  const sh = tab_(book_(), 'Inbox', ['Id', 'Captured', 'Text', 'Picked up']);
  const last = sh.getLastRow(); if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, 4).getValues();
  const out = [];
  vals.forEach(function (r, i) {
    if (!r[3]) { out.push({ id: String(r[0]), at: String(r[1]), text: String(r[2]) }); sh.getRange(i + 2, 4).setValue(new Date().toISOString()); }
  });
  return out;
}

/* ---------- Sunday report as PDF ---------- */
function saveReport_(name, html) {
  const blob = Utilities.newBlob(html, 'text/html', name + '.html');
  const pdf = blob.getAs('application/pdf').setName(name + '.pdf');
  const f = subfolder_(REPORT_FOLDER);
  const old = f.getFilesByName(name + '.pdf'); while (old.hasNext()) old.next().setTrashed(true);
  return f.createFile(pdf).getUrl();
}

/* ---------- Google Calendar ---------- */
function calendar_() {
  const cals = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  return cals.length ? cals[0] : CalendarApp.createCalendar(CALENDAR_NAME, { color: CalendarApp.Color.GREEN });
}
function syncCalendar_(events) {
  const cal = calendar_();
  const props = PropertiesService.getScriptProperties();
  const map = JSON.parse(props.getProperty('events') || '{}');
  const seen = {};
  events.forEach(function (ev) {
    const p = ev.date.split('-'), t = ev.time.split(':');
    const start = new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]);
    const end = new Date(start.getTime() + (ev.mins || 30) * 60000);
    seen[ev.id] = true;
    let item = null;
    if (map[ev.id]) { try { item = cal.getEventById(map[ev.id]); } catch (e) { item = null; } }
    if (item) { item.setTitle(ev.title); item.setTime(start, end); }
    else { item = cal.createEvent(ev.title, start, end); item.addPopupReminder(10); map[ev.id] = item.getId(); }
  });
  // remove events for blocks that were moved away, done or deleted
  const now = new Date();
  Object.keys(map).forEach(function (id) {
    if (seen[id]) return;
    try { const item = cal.getEventById(map[id]); if (item && item.getStartTime() > now) item.deleteEvent(); } catch (e) { /* already gone */ }
    delete map[id];
  });
  props.setProperty('events', JSON.stringify(map));
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

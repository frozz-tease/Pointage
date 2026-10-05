"use strict";
/* =========================================================
   POINTAGE — v4 (refonte complète)
   Données en localStorage, compatibles avec les anciennes versions.
   ========================================================= */

const KEYS = {
  entries: "pointage_entries_v1",
  settings: "pointage_settings_v2",
  snaps: "pointage_snapshots_v1",
  meta: "pointage_meta_v1",
};
const RING_R = 86;
const RING_C = 2 * Math.PI * RING_R;

/* ---------- utilitaires ---------- */
const pad = (n) => String(n).padStart(2, "0");
const DAY_LETTER = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_NAME = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const keyOf = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const wdIndex = (k) => (parseKey(k).getDay() + 6) % 7; // lundi = 0
const weekStart = (k) => addDays(k, -wdIndex(k));
const monthOf = (k) => k.slice(0, 7);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtHM = (mins) => { const t = Math.round(mins); return `${Math.floor(t / 60)}h${pad(t % 60)}`; };
const hm = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toMin = (t) => { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fromMin = (m) => { const n = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`; };
const longDate = (k) => parseKey(k).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (k) => parseKey(k).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const monthLabel = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); };
const $ = (sel) => document.querySelector(sel);

/* ---------- icônes ---------- */
const ICONS = {
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  settings: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  play: '<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"/>',
  pause: '<path d="M18 8h1a3 3 0 010 6h-1M2 8h16v6a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 2v2M10 2v2M14 2v2"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  checkc: '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  bell: '<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  file: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  restore: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.7 3L3 8"/><path d="M3 3v5h5"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/>',
};
const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ""}</svg>`;

/* ---------- stockage ---------- */
const LS = {
  get(key, fallback) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { console.error("Écriture impossible", e); return false; }
  },
};

const defaultDay = (on) => ({ on, in: "07:00", pauseIn: "12:00", pauseOut: "12:30", out: "15:30" });
const defaultSettings = () => ({
  configured: false,
  days: [0, 1, 2, 3, 4, 5, 6].map((i) => defaultDay(i < 5)),
  reminders: { on: false, arrival: "06:45", departure: "15:15" },
  theme: "auto",
  backupEvery: 7,
});
function loadSettings() {
  const d = defaultSettings();
  const s = LS.get(KEYS.settings, null);
  if (!s || typeof s !== "object") return d;
  return {
    ...d, ...s,
    days: d.days.map((x, i) => ({ ...x, ...((s.days && s.days[i]) || {}) })),
    reminders: { ...d.reminders, ...(s.reminders || {}) },
  };
}
function loadEntries() {
  const e = LS.get(KEYS.entries, {});
  return e && typeof e === "object" && !Array.isArray(e) ? e : {};
}

const state = {
  entries: loadEntries(),
  settings: loadSettings(),
  meta: { lastBackupAt: null, snoozeBackupUntil: null, dismissed: [], notified: {}, ...LS.get(KEYS.meta, {}) },
  tab: "today",
  month: monthOf(keyOf()),
  setDay: wdIndex(keyOf()),
  sheet: null, // { key, pick }
  now: new Date(),
  today: keyOf(),
  persisted: null,
};

const commitEntries = () => { const ok = LS.set(KEYS.entries, state.entries); if (!ok) toast("Sauvegarde impossible : espace de stockage plein ?", "error"); return ok; };
const commitSettings = () => LS.set(KEYS.settings, state.settings);
const commitMeta = () => LS.set(KEYS.meta, state.meta);

/* ---------- versions de secours ---------- */
function takeSnapshot(reason) {
  if (!Object.keys(state.entries).length) return;
  const snaps = LS.get(KEYS.snaps, []);
  if (snaps.length && JSON.stringify(snaps[0].entries) === JSON.stringify(state.entries)) return;
  snaps.unshift({ at: new Date().toISOString(), reason, entries: state.entries });
  LS.set(KEYS.snaps, snaps.slice(0, 8));
}

/* ---------- calculs ---------- */
function statusOf(e) {
  if (!e || !e.in) return "off";
  if (e.out) return "done";
  if (e.pauseIn && !e.pauseOut) return "pause";
  return "on";
}
function worked(e, now = state.now) {
  if (!e || !e.in) return 0;
  const end = e.out ? new Date(e.out) : now;
  let mins = (end - new Date(e.in)) / 60000;
  if (e.pauseIn) {
    const pEnd = e.pauseOut ? new Date(e.pauseOut) : end;
    mins -= (pEnd - new Date(e.pauseIn)) / 60000;
  }
  return Math.max(0, mins);
}
const rawSpan = (e) => (e && e.in && e.out ? (new Date(e.out) - new Date(e.in)) / 60000 : 0);
function tplMinutes(t) {
  let span = toMin(t.out) - toMin(t.in);
  if (span <= 0) span += 1440;
  let p = 0;
  if (t.pauseIn && t.pauseOut) { p = toMin(t.pauseOut) - toMin(t.pauseIn); if (p < 0) p += 1440; }
  return Math.max(0, span - p);
}
function dayBase(key) {
  if (!state.settings.configured) return 0;
  const t = state.settings.days[wdIndex(key)];
  return t.on ? tplMinutes(t) : 0;
}
function overtime(key, e) {
  if (!state.settings.configured || !e || !e.in || !e.out) return 0;
  return Math.max(0, Math.round(worked(e)) - dayBase(key));
}
const sumKeys = (keys, fn) => keys.reduce((a, k) => (state.entries[k] ? a + fn(k, state.entries[k]) : a), 0);
const weekKeys = (k) => { const s = weekStart(k); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i)); };
const monthKeys = (m) => Object.keys(state.entries).filter((k) => k.startsWith(m) && state.entries[k] && state.entries[k].in).sort();

/** Construit une entrée à partir d'heures "HH:MM" ; gère le passage à minuit. */
function buildEntry(key, f) {
  const [y, m, d] = key.split("-").map(Number);
  const out = {};
  let prev = null;
  for (const field of ["in", "pauseIn", "pauseOut", "out"]) {
    const v = f[field];
    if (!v || (field === "pauseOut" && !f.pauseIn)) { out[field] = null; continue; }
    const [h, mi] = v.split(":").map(Number);
    let dt = new Date(y, m - 1, d, h, mi, 0);
    if (prev && dt < prev) dt.setDate(dt.getDate() + 1);
    out[field] = dt.toISOString();
    prev = dt;
  }
  out.note = (f.note || "").trim();
  return out;
}

/* ---------- actions de pointage ---------- */
function startNow() {
  const k = keyOf();
  const old = state.entries[k];
  if (old && old.in && !confirm("Une journée existe déjà aujourd'hui. La remplacer ?")) return;
  state.entries[k] = { in: new Date().toISOString(), out: null, pauseIn: null, pauseOut: null, note: "" };
  commitEntries(); render();
}
function pauseStart() {
  const e = state.entries[keyOf()];
  if (!e) return;
  e.pauseIn = new Date().toISOString(); e.pauseOut = null;
  commitEntries(); render();
}
function pauseEnd() {
  const e = state.entries[keyOf()];
  if (!e) return;
  e.pauseOut = new Date().toISOString();
  commitEntries(); render();
}
function endNow() {
  const e = state.entries[keyOf()];
  if (!e) return;
  e.out = new Date().toISOString();
  if (e.pauseIn && !e.pauseOut) e.pauseOut = e.out;
  commitEntries(); render();
}

/** Remplit une journée avec la journée type. Retourne true si fait. */
function applyTemplate(key, { silent = false } = {}) {
  if (!state.settings.configured) {
    toast("Règle d'abord ta journée type dans Réglages.");
    state.tab = "settings"; state.sheet = null; render(); window.scrollTo(0, 0);
    return false;
  }
  const t = state.settings.days[wdIndex(key)];
  if (!t.on) { toast(`${cap(DAY_NAME[wdIndex(key)])} n'est pas un jour travaillé dans ta journée type.`); return false; }
  const old = state.entries[key];
  if (!silent && old && old.in && !confirm("Une journée existe déjà à cette date. La remplacer par ta journée type ?")) return false;
  state.entries[key] = buildEntry(key, { in: t.in, pauseIn: t.pauseIn, pauseOut: t.pauseOut, out: t.out, note: (old && old.note) || "" });
  commitEntries();
  return true;
}
function normalToday() {
  const k = keyOf();
  if (applyTemplate(k)) { toast("Journée normale enregistrée ✓"); render(); }
}
function bumpOvertime(mins) {
  const k = keyOf(), e = state.entries[k];
  if (!e || !e.out) return;
  e.out = new Date(new Date(e.out).getTime() + mins * 60000).toISOString();
  commitEntries(); render();
}
function resetOvertime() {
  const k = keyOf(), e = state.entries[k], t = state.settings.days[wdIndex(k)];
  if (!e || !t.on) return;
  state.entries[k] = buildEntry(k, { in: hm(e.in), pauseIn: hm(e.pauseIn), pauseOut: hm(e.pauseOut), out: t.out, note: e.note });
  commitEntries(); render();
}

/* ---------- jours manquants ---------- */
function missingDays() {
  if (!state.settings.configured) return [];
  const today = keyOf();
  const res = [];
  for (let k = addDays(weekStart(today), -7); k < today; k = addDays(k, 1)) {
    if (state.settings.days[wdIndex(k)].on && !state.entries[k] && !state.meta.dismissed.includes(k)) res.push(k);
  }
  return res;
}
function fillMissing() {
  const days = missingDays();
  if (!days.length) return;
  takeSnapshot("avant remplissage");
  days.forEach((k) => applyTemplate(k, { silent: true }));
  toast(`${days.length} jour${days.length > 1 ? "s" : ""} rempli${days.length > 1 ? "s" : ""} ✓`);
  render();
}
function dismissMissing() {
  state.meta.dismissed = [...new Set([...state.meta.dismissed, ...missingDays()])].slice(-120);
  commitMeta(); render();
}

/* ---------- feuille d'édition ---------- */
function openSheet(key) { state.sheet = { key, pick: false }; render(); }
function openPick() { state.sheet = { key: keyOf(), pick: true }; render(); }
function closeSheet() { state.sheet = null; render(); }
function sheetDate() { return state.sheet.pick ? ($("#sh-date") || {}).value : state.sheet.key; }
function sheetNormal() {
  const date = sheetDate();
  if (!date) { toast("Choisis d'abord une date."); return; }
  if (applyTemplate(date)) { state.sheet = null; toast("Journée normale enregistrée ✓"); render(); }
}
function bumpOut(mins) {
  const date = sheetDate();
  const outEl = $("#sh-out");
  let base = outEl.value;
  if (!base) {
    const t = date ? state.settings.days[wdIndex(date)] : null;
    if (!t || !t.on) { toast("Indique d'abord l'heure de départ."); return; }
    base = t.out;
    ["in", "pauseIn", "pauseOut"].forEach((f) => { const el = $("#sh-" + f); if (el && !el.value) el.value = t[f]; });
  }
  outEl.value = fromMin(toMin(base) + mins);
}
function saveSheet() {
  const date = sheetDate();
  const f = { in: $("#sh-in").value, pauseIn: $("#sh-pauseIn").value, pauseOut: $("#sh-pauseOut").value, out: $("#sh-out").value, note: $("#sh-note").value };
  if (!date) { toast("Choisis une date."); return; }
  if (!f.in) { toast("Indique au moins l'heure d'arrivée."); return; }
  const existing = state.entries[date];
  if (state.sheet.pick && existing && existing.in && !confirm("Une journée existe déjà à cette date. La remplacer ?")) return;
  state.entries[date] = buildEntry(date, f);
  commitEntries();
  state.sheet = null; toast("Enregistré ✓"); render();
}
function deleteSheet() {
  const k = state.sheet.key;
  if (!confirm("Supprimer cette journée ?")) return;
  delete state.entries[k];
  commitEntries();
  state.sheet = null; toast("Journée supprimée"); render();
}

/* ---------- exports / import / sauvegarde ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function buildCSV(keys) {
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const dec = (mins) => (mins / 60).toFixed(2).replace(".", ",");
  const rows = [["Date", "Jour", "Arrivée", "Début pause", "Fin pause", "Départ", "Durée", "Heures (décimal)", "Heures sup", "Note"]];
  keys.forEach((k) => {
    const e = state.entries[k];
    const w = worked(e);
    rows.push([k, DAY_NAME[wdIndex(k)], hm(e.in), hm(e.pauseIn), hm(e.pauseOut), hm(e.out), fmtHM(w), dec(w), fmtHM(overtime(k, e)), e.note || ""]);
  });
  return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
}
function exportCSV() {
  const keys = monthKeys(state.month);
  if (!keys.length) { toast("Rien à exporter pour ce mois."); return; }
  downloadBlob(new Blob([buildCSV(keys)], { type: "text/csv;charset=utf-8" }), `pointage_${state.month}.csv`);
}
function printMonth() {
  const keys = monthKeys(state.month);
  const total = sumKeys(keys, (k, e) => worked(e));
  const rows = keys.map((k) => {
    const e = state.entries[k];
    return `<tr><td>${esc(shortDate(k))}</td><td>${hm(e.in) || "--:--"}</td><td>${hm(e.pauseIn) || "--"}</td><td>${hm(e.pauseOut) || "--"}</td><td>${hm(e.out) || "en cours"}</td><td>${fmtHM(worked(e))}</td><td>${esc(e.note || "")}</td></tr>`;
  }).join("");
  $("#print-area").innerHTML = `<h1>Relevé d'heures — ${esc(monthLabel(state.month))}</h1><div>Total du mois : ${fmtHM(total)}</div>
    <table><thead><tr><th>Jour</th><th>Arrivée</th><th>Pause début</th><th>Pause fin</th><th>Départ</th><th>Heures</th><th>Note</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="7">Aucune journée enregistrée ce mois-ci.</td></tr>'}</tbody></table>`;
  window.print();
}
function markBackup() { state.meta.lastBackupAt = new Date().toISOString(); state.meta.snoozeBackupUntil = null; commitMeta(); render(); }
async function shareBackup() {
  const payload = { app: "pointage", version: 2, exportedAt: new Date().toISOString(), settings: state.settings, entries: state.entries };
  const name = `pointage_sauvegarde_${keyOf()}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  try {
    const file = new File([blob], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Sauvegarde Pointage" });
      markBackup(); toast("Sauvegarde envoyée ✓");
      return;
    }
  } catch (err) {
    if (err && err.name === "AbortError") return;
  }
  downloadBlob(blob, name);
  markBackup(); toast("Fichier de sauvegarde téléchargé ✓");
}
function handleImportFile(ev) {
  const file = ev.target.files && ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = parsed.entries || parsed;
      const keys = Object.keys(imported).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k) && imported[k] && typeof imported[k] === "object" && imported[k].in);
      if (!keys.length) { toast("Ce fichier ne contient aucune journée reconnaissable.", "error"); return; }
      takeSnapshot("avant import");
      keys.forEach((k) => { state.entries[k] = imported[k]; });
      commitEntries();
      if (parsed.settings && Array.isArray(parsed.settings.days)) {
        const d = defaultSettings();
        state.settings = { ...d, ...parsed.settings, days: d.days.map((x, i) => ({ ...x, ...(parsed.settings.days[i] || {}) })), reminders: { ...d.reminders, ...(parsed.settings.reminders || {}) } };
        commitSettings();
      }
      toast(`${keys.length} journée(s) importée(s) ✓`); render();
    } catch (e) { toast("Fichier invalide.", "error"); }
  };
  reader.readAsText(file);
}
function restoreSnapshot(i) {
  const snaps = LS.get(KEYS.snaps, []);
  const s = snaps[i];
  if (!s) return;
  if (!confirm(`Revenir à la version du ${new Date(s.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} ? Tes données actuelles seront gardées comme version de secours.`)) return;
  takeSnapshot("avant restauration");
  state.entries = s.entries;
  commitEntries();
  toast("Version restaurée ✓"); render();
}

/* ---------- rappels ---------- */
async function notify(title, body, tag) {
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) { await reg.showNotification(title, { body, tag, icon: "icon-192.png", badge: "icon-192.png" }); return true; }
    new Notification(title, { body, tag, icon: "icon-192.png" });
    return true;
  } catch (e) { console.error(e); return false; }
}
async function ensureNotificationPermission() {
  if (!("Notification" in window)) { toast("Les notifications ne sont pas disponibles sur cet appareil.", "error"); return false; }
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") { toast("Notifications bloquées : autorise-les dans les réglages du navigateur.", "error"); return false; }
  const res = await Notification.requestPermission();
  return res === "granted";
}
function checkReminders() {
  const r = state.settings.reminders;
  if (!r.on) return;
  const k = keyOf(state.now);
  if (!state.settings.days[wdIndex(k)].on) return;
  const mins = state.now.getHours() * 60 + state.now.getMinutes();
  const e = state.entries[k];
  if (!(e && e.in) && mins >= toMin(r.arrival) && mins < toMin(r.arrival) + 120 && state.meta.notified.arrival !== k) {
    state.meta.notified.arrival = k; commitMeta();
    notify("Pointage", "N'oublie pas de pointer ton arrivée.", "arrival");
  }
  if (e && e.in && !e.out && mins >= toMin(r.departure) && mins < toMin(r.departure) + 180 && state.meta.notified.departure !== k) {
    state.meta.notified.departure = k; commitMeta();
    notify("Pointage", "C'est bientôt l'heure : pense à pointer ton départ.", "departure");
  }
}
function buildICS() {
  const r = state.settings.reminders, days = state.settings.days;
  const by = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].filter((_, i) => days[i].on);
  if (!by.length) return null;
  let k = keyOf();
  for (let i = 0; i < 7 && !days[wdIndex(k)].on; i++) k = addDays(k, 1);
  const dt = (key, t) => key.replace(/-/g, "") + "T" + t.replace(":", "") + "00";
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const ev = (uid, time, title) => [
    "BEGIN:VEVENT", `UID:pointage-${uid}@frozz-tease.github.io`, `DTSTAMP:${stamp}`,
    `DTSTART:${dt(k, time)}`, `DTEND:${dt(k, fromMin(toMin(time) + 5))}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${by.join(",")}`, `SUMMARY:${title}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${title}`, "TRIGGER:PT0S", "END:VALARM", "END:VEVENT",
  ];
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pointage//FR", "CALSCALE:GREGORIAN",
    ...ev("arrivee", r.arrival, "Pointer l'arrivée"), ...ev("depart", r.departure, "Pointer le départ"), "END:VCALENDAR"].join("\r\n");
}
function exportICS() {
  const ics = buildICS();
  if (!ics) { toast("Aucun jour travaillé dans ta journée type.", "error"); return; }
  downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "pointage-rappels.ics");
  toast("Ouvre le fichier pour l'ajouter à ton agenda");
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, kind) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "show" + (kind === "error" ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, 3200);
}

/* ---------- thème ---------- */
function applyTheme() {
  const t = state.settings.theme;
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  const dark = t === "dark" || (t === "auto" && !(window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches));
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute("content", dark ? "#0b0f14" : "#f3f6f9");
}

/* =========================================================
   RENDU
   ========================================================= */
function render() {
  const y = window.scrollY;
  let body = "";
  if (state.tab === "today") body = renderToday();
  else if (state.tab === "calendar") body = renderCalendar();
  else if (state.tab === "report") body = renderReport();
  else body = renderSettings();
  const tabs = [["today", "clock", "Aujourd'hui"], ["calendar", "calendar", "Calendrier"], ["report", "chart", "Bilan"], ["settings", "settings", "Réglages"]];
  $("#app").innerHTML = `<div class="shell">${body}</div>
    <div class="tabbar"><nav>${tabs.map(([id, ic, label]) => `<button class="tab ${state.tab === id ? "sel" : ""}" data-action="tab" data-tab="${id}">${icon(ic, 22)}<span>${label}</span></button>`).join("")}</nav></div>
    ${renderSheet()}`;
  document.body.classList.toggle("sheet-open", !!state.sheet);
  window.scrollTo(0, y);
  applyTheme();
  updateLive();
}

function renderBanners() {
  let h = "";
  const today = keyOf(state.now);
  const unclosed = Object.keys(state.entries).sort().filter((k) => k !== today && state.entries[k].in && !state.entries[k].out);
  if (unclosed.length) {
    h += `<div class="banner">${icon("alert", 22)}<div class="banner-body">
      <div class="banner-title">${unclosed.length === 1 ? "Une journée n'a pas de départ" : `${unclosed.length} journées n'ont pas de départ`}</div>
      <div class="banner-actions">${unclosed.slice(-4).map((k) => `<button class="btn sm" data-action="openDay" data-key="${k}">${esc(shortDate(k))}</button>`).join("")}</div></div></div>`;
  }
  const miss = missingDays();
  if (miss.length) {
    h += `<div class="banner info">${icon("calendar", 22)}<div class="banner-body">
      <div class="banner-title">${miss.length} jour${miss.length > 1 ? "s" : ""} sans pointage</div>
      <div class="banner-text">${miss.map((k) => esc(shortDate(k))).join(" · ")}</div>
      <div class="banner-actions"><button class="btn sm primary" data-action="fillMissing">${icon("checkc", 18)} Remplir avec ma journée type</button><button class="btn sm ghost" data-action="dismissMissing">Ignorer</button></div></div></div>`;
  }
  const n = Object.keys(state.entries).length;
  const last = state.meta.lastBackupAt ? Date.parse(state.meta.lastBackupAt) : 0;
  const due = n >= 3 && (!last || (Date.now() - last) / 86400000 >= state.settings.backupEvery);
  const snoozed = state.meta.snoozeBackupUntil && state.meta.snoozeBackupUntil > today;
  if (due && !snoozed) {
    h += `<div class="banner info">${icon("shield", 22)}<div class="banner-body">
      <div class="banner-title">Pense à sauvegarder tes données</div>
      <div class="banner-text">${last ? "Dernière sauvegarde il y a " + Math.floor((Date.now() - last) / 86400000) + " jours." : "Aucune sauvegarde envoyée hors du téléphone pour l'instant."}</div>
      <div class="banner-actions"><button class="btn sm primary" data-action="shareBackup">${icon("share", 18)} Sauvegarder</button><button class="btn sm ghost" data-action="snoozeBackup">Plus tard</button></div></div></div>`;
  }
  return h ? `<div class="stack" style="margin-bottom:14px">${h}</div>` : "";
}

function renderToday() {
  const now = state.now, k = keyOf(now), e = state.entries[k], st = statusOf(e), s = state.settings;
  const t = s.days[wdIndex(k)];
  const labels = { off: "Pas encore pointé", on: "En service", pause: "En pause", done: "Journée terminée" };
  const sub = !s.configured ? "Règle ta journée type pour gagner du temps"
    : t.on ? `Journée type ${t.in} → ${t.out}` : "Jour hors planning";
  let h = `<header class="top"><div><div class="eyebrow">${parseKey(k).getFullYear()}</div><h1 class="title">${esc(cap(longDate(k)))}</h1><div class="subtitle">${esc(sub)}</div></div></header>`;
  h += renderBanners();

  const pauseTxt = e && e.pauseIn ? `${hm(e.pauseIn)}–${e.pauseOut ? hm(e.pauseOut) : "…"}` : "—";
  h += `<section class="hero ${st}">
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 200 200" aria-hidden="true"><circle class="ring-track" cx="100" cy="100" r="${RING_R}"/><circle class="ring-bar" data-live="ring" cx="100" cy="100" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}" transform="rotate(-90 100 100)"/></svg>
      <div class="ring-center"><span class="pill ${st}"><span class="dot"></span>${labels[st]}</span><div class="worked" data-live="worked"></div><div class="eta" data-live="eta"></div></div>
    </div>
    <div class="times">
      <div class="time-cell"><span>Arrivée</span><b>${e && e.in ? hm(e.in) : "—"}</b></div>
      <div class="time-cell"><span>Pause</span><b>${pauseTxt}</b></div>
      <div class="time-cell"><span>Départ</span><b>${e && e.out ? hm(e.out) : "—"}</b></div>
    </div>`;

  if (st === "off") {
    if (!s.configured) {
      h += `<div class="btn-col"><button class="btn primary xl" data-action="startNow">${icon("play", 22)} Pointer l'arrivée</button>
        <button class="btn" data-action="tab" data-tab="settings">${icon("settings", 20)} Régler ma journée type</button></div>`;
    } else if (t.on) {
      h += `<div class="btn-col"><button class="btn primary xl" data-action="normalToday"><span>${icon("checkc", 22)} Journée normale</span><small>${t.in} → ${t.out} · pause ${tplPauseLabel(t)}</small></button>
        <div class="btn-row"><button class="btn" data-action="startNow">${icon("play", 18)} Pointer l'arrivée</button><button class="btn ghost" data-action="openDay" data-key="${k}">${icon("pencil", 18)} Saisir</button></div></div>`;
    } else {
      h += `<div class="btn-col"><button class="btn primary xl" data-action="startNow">${icon("play", 22)} Pointer l'arrivée</button>
        <button class="btn ghost" data-action="openDay" data-key="${k}">${icon("pencil", 18)} Saisir les horaires</button></div>`;
    }
  } else if (st === "on") {
    h += `<div class="btn-row"><button class="btn warn" style="flex:0 0 38%" data-action="pauseStart">${icon("pause", 20)} Pause</button><button class="btn danger" data-action="endNow">${icon("stop", 18)} Départ</button></div>`;
  } else if (st === "pause") {
    h += `<button class="btn warn xl" data-action="pauseEnd">${icon("play", 22)} Reprendre le service</button>`;
  } else {
    h += `<button class="btn ghost" data-action="openDay" data-key="${k}">${icon("pencil", 18)} Modifier la journée</button>`;
    if (s.configured) {
      h += `<div class="ot"><div class="ot-head">${icon("bolt", 18)} Heures sup <b data-live="otToday"></b></div>
        <div class="chips"><button class="chip" data-action="bumpOt" data-min="30">+30 min</button><button class="chip" data-action="bumpOt" data-min="60">+1 h</button><button class="chip" data-action="bumpOt" data-min="120">+2 h</button>${t.on ? `<button class="chip" data-action="resetOt">Heure normale</button>` : ""}</div></div>`;
    }
  }
  h += `</section>`;

  // semaine en cours
  const wk = weekKeys(k);
  h += `<section class="card" style="margin-top:14px"><h3>Cette semaine</h3><div class="week">${wk.map((d, i) => {
    const en = state.entries[d];
    const w = en ? worked(en) : 0;
    const miss = !en && d < k && s.configured && s.days[i].on;
    const pct = Math.min(100, Math.round((w / 600) * 100));
    return `<button class="wd ${d === k ? "today" : ""} ${miss ? "miss" : ""}" data-action="openDay" data-key="${d}">
      <div class="wd-bar"><i class="${overtime(d, en) > 0 ? "ot" : ""}" style="--h:${pct}%"></i></div><span>${DAY_LETTER[i]}</span><em>${en && en.in ? fmtHM(w).replace("h00", "h") : ""}</em></button>`;
  }).join("")}</div></section>`;

  h += `<div class="stats" style="margin-top:14px">
    <div class="stat"><span>Semaine</span><b data-live="week"></b></div>
    <div class="stat"><span>Mois</span><b data-live="month"></b></div>
    <div class="stat ot"><span>Heures sup</span><b data-live="otMonth"></b></div></div>`;
  return h;
}
function tplPauseLabel(t) {
  if (!t.pauseIn || !t.pauseOut) return "aucune";
  let p = toMin(t.pauseOut) - toMin(t.pauseIn);
  if (p < 0) p += 1440;
  return p >= 60 ? fmtHM(p).replace("h00", "h") : `${p} min`;
}

function renderCalendar() {
  const [cy, cm] = state.month.split("-").map(Number);
  const first = new Date(cy, cm - 1, 1), last = new Date(cy, cm, 0);
  const cells = [];
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(`${cy}-${pad(cm)}-${pad(d)}`);
  while (cells.length % 7) cells.push(null);
  const today = keyOf(state.now), s = state.settings;
  const mk = monthKeys(state.month);
  const total = sumKeys(mk, (k, e) => worked(e));
  const ot = sumKeys(mk, (k, e) => overtime(k, e));
  let h = `<header class="top"><div><div class="eyebrow">Calendrier</div><h1 class="title">${esc(cap(monthLabel(state.month)))}</h1><div class="subtitle">${fmtHM(total)} · ${mk.length} jour${mk.length > 1 ? "s" : ""}${ot ? ` · ${fmtHM(ot)} sup` : ""}</div></div>
    <button class="icon-btn" data-action="openPick" aria-label="Ajouter une journée">${icon("plus", 22)}</button></header>`;
  h += renderBanners();
  h += `<div class="month-nav"><button class="icon-btn" data-action="monthPrev" aria-label="Mois précédent">${icon("left")}</button><div class="month-label">${esc(monthLabel(state.month))}</div><button class="icon-btn" data-action="monthNext" aria-label="Mois suivant">${icon("right")}</button></div>`;
  h += `<div class="cal">${DAY_LETTER.map((d) => `<div class="cal-wd">${d}</div>`).join("")}${cells.map((k) => {
    if (!k) return `<div class="cell blank"></div>`;
    const e = state.entries[k], i = wdIndex(k);
    let cls = "cell";
    if (e && e.in) cls += e.out ? " done" : " open";
    else if (s.configured && s.days[i].on && k < today) cls += " miss";
    else if (!s.days[i].on) cls += " off";
    if (k === today) cls += " today";
    if (e && overtime(k, e) > 0) cls += " ot";
    return `<button class="${cls}" data-action="openDay" data-key="${k}"><span class="n">${Number(k.slice(-2))}</span><span class="h">${e && e.in ? fmtHM(worked(e)).replace("h00", "h") : ""}</span></button>`;
  }).join("")}</div>
  <div class="legend"><span><i style="background:color-mix(in srgb,var(--accent) 35%,transparent)"></i>Terminée</span><span><i style="background:color-mix(in srgb,var(--warn) 40%,transparent)"></i>Sans départ</span><span><i style="border:1.5px dashed var(--muted)"></i>À remplir</span><span><i style="background:var(--warn);border-radius:50%"></i>Heures sup</span></div>`;
  return h;
}

function renderReport() {
  const mk = monthKeys(state.month);
  const total = sumKeys(mk, (k, e) => worked(e));
  const ot = sumKeys(mk, (k, e) => overtime(k, e));
  const avg = mk.length ? total / mk.length : 0;
  const groups = {};
  mk.forEach((k) => { (groups[weekStart(k)] = groups[weekStart(k)] || []).push(k); });
  const wkRows = Object.keys(groups).sort().reverse().map((w) => ({ w, keys: groups[w] }));
  const maxW = Math.max(1, ...wkRows.map((r) => sumKeys(r.keys, (k, e) => worked(e))));
  let h = `<header class="top"><div><div class="eyebrow">Bilan</div><h1 class="title">${esc(cap(monthLabel(state.month)))}</h1></div></header>
    <div class="month-nav"><button class="icon-btn" data-action="monthPrev" aria-label="Mois précédent">${icon("left")}</button><div class="month-label">${esc(monthLabel(state.month))}</div><button class="icon-btn" data-action="monthNext" aria-label="Mois suivant">${icon("right")}</button></div>
    <div class="stack">
    <div class="stats"><div class="stat"><span>Total</span><b>${fmtHM(total)}</b></div><div class="stat"><span>Jours</span><b>${mk.length}</b></div><div class="stat"><span>Moy. / jour</span><b>${fmtHM(avg)}</b></div></div>`;
  if (state.settings.configured) h += `<div class="stats two"><div class="stat ot"><span>Heures sup</span><b>${fmtHM(ot)}</b></div><div class="stat"><span>Heures normales</span><b>${fmtHM(Math.max(0, total - ot))}</b></div></div>`;
  h += `<section class="card"><h3>Par semaine</h3>${wkRows.length ? wkRows.map(({ w, keys }) => {
    const mins = sumKeys(keys, (k, e) => worked(e)), o = sumKeys(keys, (k, e) => overtime(k, e));
    return `<div class="wk-row"><div><b>${fmtHM(mins)}</b> <span class="muted small">· ${keys.length} j</span></div><div class="wk-ot">${o ? "+" + fmtHM(o) + " sup" : ""}</div><div class="wk-bar"><i style="width:${Math.round((mins / maxW) * 100)}%"></i></div><div class="muted small" style="grid-column:1/-1">Semaine du ${esc(parseKey(w).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</div></div>`;
  }).join("") : `<p class="muted" style="margin-top:6px">Aucune journée enregistrée ce mois-ci.</p>`}</section>
    <div class="section-title">Exporter</div>
    <button class="list-btn" data-action="exportCSV">${icon("download", 22)}<span>Tableau CSV (Excel)<small>Le mois affiché, avec heures sup</small></span></button>
    <button class="list-btn" data-action="printMonth">${icon("print", 22)}<span>Imprimer / PDF<small>Relevé d'heures du mois affiché</small></span></button>
    </div>`;
  return h;
}

function renderSettings() {
  const s = state.settings, i = state.setDay, t = s.days[i], r = s.reminders;
  const lastBk = state.meta.lastBackupAt ? new Date(state.meta.lastBackupAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : "jamais";
  const snaps = LS.get(KEYS.snaps, []);
  let h = `<header class="top"><div><div class="eyebrow">Réglages</div><h1 class="title">Mon pointage</h1></div></header><div class="stack">`;

  h += `<section class="card"><h3>Ma journée type</h3><p class="muted small">Ces horaires servent au bouton « Journée normale » : un tap et ta journée est enregistrée. Ajuste ensuite les heures sup si besoin.</p>
    <div class="day-chips">${DAY_LETTER.map((l, d) => `<button class="day-chip ${d === i ? "sel" : ""} ${s.days[d].on ? "on" : ""}" data-action="selDay" data-idx="${d}" aria-label="${DAY_NAME[d]}">${l}</button>`).join("")}</div>
    <div class="row"><div class="lbl">Je travaille le ${DAY_NAME[i]}</div><label class="switch"><input type="checkbox" data-set="dayOn" ${t.on ? "checked" : ""} /><i></i></label></div>`;
  if (t.on) {
    h += `<div class="grid2" style="margin-top:6px">
      <label class="field">Arrivée<input type="time" data-set="dayTime" data-field="in" value="${t.in}" /></label>
      <label class="field">Départ<input type="time" data-set="dayTime" data-field="out" value="${t.out}" /></label>
      <label class="field">Début de pause<input type="time" data-set="dayTime" data-field="pauseIn" value="${t.pauseIn}" /></label>
      <label class="field">Fin de pause<input type="time" data-set="dayTime" data-field="pauseOut" value="${t.pauseOut}" /></label></div>
      <p class="muted small" style="margin-top:10px">Temps de travail effectif : <b style="color:var(--text)">${fmtHM(tplMinutes(t))}</b>. Au-delà, ce sont des heures sup.</p>
      <div class="btn-col" style="margin-top:12px"><button class="btn" data-action="copyDay">Copier sur les autres jours travaillés</button></div>`;
  }
  if (!s.configured) h += `<div class="btn-col" style="margin-top:10px"><button class="btn primary" data-action="validateTpl">${icon("check", 20)} Valider ma journée type</button></div>`;
  h += `</section>`;

  h += `<section class="card"><h3>Rappels</h3>
    <div class="row"><div class="lbl">Notifications de pointage<small>Quand l'application est ouverte ou active en arrière-plan</small></div><label class="switch"><input type="checkbox" data-set="remOn" ${r.on ? "checked" : ""} /><i></i></label></div>
    <div class="grid2" style="margin:6px 0 12px">
      <label class="field">Rappel d'arrivée<input type="time" data-set="remArrival" value="${r.arrival}" /></label>
      <label class="field">Rappel de départ<input type="time" data-set="remDeparture" value="${r.departure}" /></label></div>
    <p class="muted small" style="margin-bottom:12px">Sur Android, une application web ne peut pas toujours se réveiller quand elle est fermée. Pour des rappels qui sonnent à coup sûr, ajoute-les à ton agenda : ils se répètent chaque jour travaillé.</p>
    <div class="btn-col"><button class="btn primary" data-action="exportICS">${icon("calendar", 20)} Ajouter les rappels à mon agenda</button><button class="btn" data-action="testNotif">${icon("bell", 20)} Tester une notification</button></div></section>`;

  h += `<section class="card"><h3>Sauvegarde</h3>
    <p class="muted small">Tes données sont sur ce téléphone. Dernière sauvegarde envoyée : <b style="color:var(--text)">${esc(lastBk)}</b>${state.persisted === true ? " · stockage protégé ✓" : ""}.</p>
    <div class="btn-col" style="margin-top:12px"><button class="btn primary" data-action="shareBackup">${icon("share", 20)} Sauvegarder (Drive, mail, WhatsApp…)</button><button class="btn" data-action="triggerImport">${icon("upload", 20)} Importer une sauvegarde</button></div>
    <div class="row" style="margin-top:6px"><div class="lbl">Me le rappeler tous les<small>Bandeau sur l'écran d'accueil</small></div>
      <div class="seg" style="min-width:150px">${[7, 14, 30].map((n) => `<button class="${s.backupEvery === n ? "sel" : ""}" data-action="setBackupEvery" data-n="${n}">${n} j</button>`).join("")}</div></div>
    ${snaps.length ? `<div class="section-title" style="margin:16px 0 0">Versions de secours automatiques</div>${snaps.slice(0, 5).map((sn, idx) => `<div class="snap"><div>${esc(new Date(sn.at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }))}<small>${Object.keys(sn.entries).length} journées · ${esc(sn.reason)}</small></div><button class="btn sm" data-action="restoreSnap" data-i="${idx}">${icon("restore", 16)} Restaurer</button></div>`).join("")}` : ""}</section>`;

  h += `<section class="card"><h3>Apparence</h3><div class="seg" style="margin-top:10px">${[["auto", "Auto"], ["light", "Clair"], ["dark", "Sombre"]].map(([v, l]) => `<button class="${s.theme === v ? "sel" : ""}" data-action="setTheme" data-v="${v}">${l}</button>`).join("")}</div></section>`;
  h += `</div>`;
  return h;
}

function renderSheet() {
  const sh = state.sheet;
  if (!sh) return "";
  const key = sh.key, e = sh.pick ? null : state.entries[key];
  const tpl = state.settings.days[wdIndex(key)];
  const canNormal = state.settings.configured && (sh.pick || tpl.on);
  const normalLabel = sh.pick || !tpl.on ? "" : `<small>${tpl.in} → ${tpl.out}</small>`;
  const warn = e && rawSpan(e) > 360 && !e.pauseIn ? `<div class="banner">${icon("alert", 20)}<div class="banner-body"><div class="banner-title">Pas de pause enregistrée</div><div class="banner-text">Journée de plus de 6 h sans pause.</div></div></div>` : "";
  return `<div class="backdrop" data-action="closeSheet"><div class="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>
    <div class="sheet-head"><h2>${sh.pick ? "Ajouter une journée" : esc(longDate(key))}</h2><button class="icon-btn" data-action="closeSheet" aria-label="Fermer">${icon("x")}</button></div>
    <div class="stack">
      ${sh.pick ? `<label class="field">Date<input type="date" id="sh-date" value="${key}" max="${keyOf(state.now)}" /></label>` : ""}
      ${canNormal ? `<button class="btn primary xl" data-action="sheetNormal"><span>${icon("checkc", 22)} Journée normale</span>${normalLabel}</button>` : ""}
      ${warn}
      <div class="grid2">
        <label class="field">Arrivée<input type="time" id="sh-in" value="${e ? hm(e.in) : ""}" /></label>
        <label class="field">Départ<input type="time" id="sh-out" value="${e ? hm(e.out) : ""}" /></label>
        <label class="field">Début de pause<input type="time" id="sh-pauseIn" value="${e ? hm(e.pauseIn) : ""}" /></label>
        <label class="field">Fin de pause<input type="time" id="sh-pauseOut" value="${e ? hm(e.pauseOut) : ""}" /></label>
      </div>
      <div><div class="small muted" style="font-weight:650;margin-bottom:8px">Ajouter des heures sup au départ</div>
        <div class="chips"><button class="chip" data-action="bumpOut" data-min="15">+15 min</button><button class="chip" data-action="bumpOut" data-min="30">+30 min</button><button class="chip" data-action="bumpOut" data-min="60">+1 h</button><button class="chip" data-action="bumpOut" data-min="120">+2 h</button><button class="chip" data-action="bumpOut" data-min="-15">−15 min</button></div></div>
      <label class="field">Remarque<input type="text" id="sh-note" placeholder="Optionnel" value="${esc(e ? e.note : "")}" /></label>
      <div class="btn-row"><button class="btn primary" data-action="saveSheet">${icon("check", 20)} Enregistrer</button>${e ? `<button class="btn danger" style="flex:0 0 auto;width:auto" data-action="deleteSheet" aria-label="Supprimer">${icon("trash", 20)}</button>` : ""}</div>
    </div></div></div>`;
}

/* ---------- mises à jour "en direct" sans reconstruire l'écran ---------- */
function updateLive() {
  const now = state.now, k = keyOf(now), e = state.entries[k], st = statusOf(e);
  const set = (sel, html) => { const el = document.querySelector(sel); if (el && el.innerHTML !== html) el.innerHTML = html; };
  if (state.tab !== "today") return;
  const w = e ? worked(e, now) : 0, base = dayBase(k), live = st === "on" || st === "pause";
  set('[data-live="worked"]', `${fmtHM(w)}${live ? `<small>:${pad(now.getSeconds())}</small>` : ""}`);
  const ring = document.querySelector('[data-live="ring"]');
  if (ring) {
    const target = base || 480;
    ring.style.strokeDashoffset = String(RING_C * (1 - Math.min(1, w / target)));
    ring.classList.toggle("over", base > 0 && w > base);
  }
  let eta = "";
  if (st === "on") {
    if (base > 0 && w < base) eta = `Départ prévu vers ${fromMin(now.getHours() * 60 + now.getMinutes() + (base - w))}`;
    else if (base > 0) eta = `+${fmtHM(w - base)} d'heures sup`;
    else eta = `Arrivée à ${hm(e.in)}`;
  } else if (st === "pause") eta = `En pause depuis ${hm(e.pauseIn)}`;
  else if (st === "done") eta = base > 0 ? `${fmtHM(base)} prévues` : "Journée enregistrée";
  else eta = base > 0 ? `Objectif ${fmtHM(base)}` : "";
  set('[data-live="eta"]', esc(eta));
  const wk = weekKeys(k), mk = monthKeys(monthOf(k));
  set('[data-live="week"]', fmtHM(sumKeys(wk, (kk, en) => worked(en, now))));
  set('[data-live="month"]', fmtHM(sumKeys(mk, (kk, en) => worked(en, now))));
  set('[data-live="otMonth"]', fmtHM(sumKeys(mk, (kk, en) => overtime(kk, en))));
  set('[data-live="otToday"]', st === "done" ? (overtime(k, e) ? "+" + fmtHM(overtime(k, e)) : "aucune") : "");
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */
function goTab(tab) { state.tab = tab; state.sheet = null; render(); window.scrollTo(0, 0); }
function shiftMonth(delta) {
  const [y, m] = state.month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  render();
}

document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action;
  if (a === "closeSheet" && ev.target !== el && !el.classList.contains("icon-btn")) return;
  switch (a) {
    case "tab": goTab(el.dataset.tab); break;
    case "startNow": startNow(); break;
    case "pauseStart": pauseStart(); break;
    case "pauseEnd": pauseEnd(); break;
    case "endNow": endNow(); break;
    case "normalToday": normalToday(); break;
    case "bumpOt": bumpOvertime(Number(el.dataset.min)); break;
    case "resetOt": resetOvertime(); break;
    case "fillMissing": fillMissing(); break;
    case "dismissMissing": dismissMissing(); break;
    case "snoozeBackup": state.meta.snoozeBackupUntil = addDays(keyOf(), 3); commitMeta(); render(); break;
    case "openDay": openSheet(el.dataset.key); break;
    case "openPick": openPick(); break;
    case "closeSheet": closeSheet(); break;
    case "sheetNormal": sheetNormal(); break;
    case "bumpOut": bumpOut(Number(el.dataset.min)); break;
    case "saveSheet": saveSheet(); break;
    case "deleteSheet": deleteSheet(); break;
    case "monthPrev": shiftMonth(-1); break;
    case "monthNext": shiftMonth(1); break;
    case "exportCSV": exportCSV(); break;
    case "printMonth": printMonth(); break;
    case "shareBackup": shareBackup(); break;
    case "triggerImport": $("#import-file").click(); break;
    case "restoreSnap": restoreSnapshot(Number(el.dataset.i)); break;
    case "exportICS": exportICS(); break;
    case "testNotif":
      ensureNotificationPermission().then((ok) => {
        if (!ok) return;
        notify("Pointage", "Les notifications fonctionnent ✓", "test").then((sent) => { if (!sent) toast("Impossible d'afficher la notification.", "error"); });
      });
      break;
    case "selDay": state.setDay = Number(el.dataset.idx); render(); break;
    case "copyDay": {
      const src = state.settings.days[state.setDay];
      state.settings.days.forEach((d) => { if (d.on) { d.in = src.in; d.pauseIn = src.pauseIn; d.pauseOut = src.pauseOut; d.out = src.out; } });
      commitSettings(); toast("Horaires copiés sur les jours travaillés ✓"); break;
    }
    case "validateTpl":
      if (!state.settings.days.some((d) => d.on)) { toast("Choisis au moins un jour travaillé.", "error"); break; }
      state.settings.configured = true; commitSettings(); toast("Journée type enregistrée ✓"); render(); break;
    case "setBackupEvery": state.settings.backupEvery = Number(el.dataset.n); commitSettings(); render(); break;
    case "setTheme": state.settings.theme = el.dataset.v; commitSettings(); render(); break;
  }
});

document.addEventListener("change", (ev) => {
  const el = ev.target.closest("[data-set]");
  if (!el) return;
  const s = state.settings;
  switch (el.dataset.set) {
    case "dayOn": s.days[state.setDay].on = el.checked; commitSettings(); render(); break;
    case "dayTime":
      if (el.value) { s.days[state.setDay][el.dataset.field] = el.value; commitSettings(); render(); }
      break;
    case "remArrival": if (el.value) { s.reminders.arrival = el.value; commitSettings(); } break;
    case "remDeparture": if (el.value) { s.reminders.departure = el.value; commitSettings(); } break;
    case "remOn":
      if (el.checked) {
        ensureNotificationPermission().then((ok) => {
          s.reminders.on = ok; commitSettings(); render();
          if (ok) toast("Rappels activés ✓");
        });
      } else { s.reminders.on = false; commitSettings(); }
      break;
  }
});
$("#import-file").addEventListener("change", handleImportFile);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && state.sheet) closeSheet(); });

/* ---------- horloge ---------- */
function tick() {
  state.now = new Date();
  const k = keyOf(state.now);
  if (k !== state.today) { state.today = k; if (!state.sheet) render(); return; }
  updateLive();
  if (state.now.getSeconds() % 20 === 0) checkReminders();
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  state.now = new Date(); state.today = keyOf(state.now);
  if (!state.sheet) { state.entries = loadEntries(); render(); }
  checkReminders();
});

/* ---------- raccourcis (appui long sur l'icône) ---------- */
function handleUrlAction() {
  const a = new URLSearchParams(location.search).get("action");
  if (!a) return;
  history.replaceState(null, "", location.pathname);
  const e = state.entries[keyOf()];
  if (e && e.in) { toast("Tu as déjà pointé aujourd'hui."); return; }
  if (a === "normal") applyTemplate(keyOf(), { silent: true }) && toast("Journée normale enregistrée ✓");
  else if (a === "start") { state.entries[keyOf()] = { in: new Date().toISOString(), out: null, pauseIn: null, pauseOut: null, note: "" }; commitEntries(); toast("Arrivée pointée ✓"); }
}

/* ---------- démarrage ---------- */
(function init() {
  const snaps = LS.get(KEYS.snaps, []);
  if (!snaps.length || keyOf(new Date(snaps[0].at)) !== keyOf()) takeSnapshot("automatique");
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((ok) => { state.persisted = ok; }).catch(() => {});
  }
  handleUrlAction();
  render();
  checkReminders();
})();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((e) => console.error("SW error", e));
  });
}

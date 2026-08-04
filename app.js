// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h${pad(m)}`;
};
const fmtSeconds = (d) => `:${pad(d.getSeconds())}`;
const dayLabel = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
};
const weekKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dow = dt.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diffToMonday);
  return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
};
const monthKey = (key) => key.slice(0, 7);
const toTimeInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromTimeInput = (dateKey, timeStr) => {
  if (!timeStr) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, h, min, 0).toISOString();
};
const computeMinutes = (entry) => {
  if (!entry || !entry.in) return 0;
  const end = entry.out ? new Date(entry.out) : new Date();
  const start = new Date(entry.in);
  let mins = (end - start) / 60000;
  if (entry.pauseIn) {
    const pStart = new Date(entry.pauseIn);
    const pEnd = entry.pauseOut ? new Date(entry.pauseOut) : end;
    mins -= (pEnd - pStart) / 60000;
  }
  return Math.max(0, mins);
};
const rawSpanMinutes = (entry) => {
  if (!entry || !entry.in || !entry.out) return 0;
  return (new Date(entry.out) - new Date(entry.in)) / 60000;
};
const esc = (s) => (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- storage (localStorage: reliable, on-device, survives closing the app) ----------
const STORAGE_KEY = "pointage_entries_v1";
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error("Erreur de lecture du stockage", e);
    return {};
  }
}
function persistEntries(entries) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (e) {
    console.error("Erreur d'écriture du stockage", e);
    return false;
  }
}

// ---------- state ----------
const state = {
  entries: loadEntries(),
  now: new Date(),
  note: "",
  viewMode: "list",
  openHistory: true,
  calendarMonth: monthKey(todayKey()),
  editingKey: null,
  editForm: { in: "", pauseIn: "", pauseOut: "", out: "", note: "" },
  addingManual: false,
  manualForm: { date: "", in: "", pauseIn: "", pauseOut: "", out: "", note: "" },
  confirmDelete: null,
  exportMsg: "",
  showImportBox: false,
};

function saveEntry(dateKey, data) {
  state.entries[dateKey] = data;
  const ok = persistEntries(state.entries);
  state.exportMsg = ok ? "" : "Erreur de sauvegarde — vérifie l'espace de stockage de ton téléphone.";
  render();
}
function deleteEntryKey(dateKey) {
  delete state.entries[dateKey];
  persistEntries(state.entries);
  state.confirmDelete = null;
  render();
}

// ---------- actions ----------
function handleStart() {
  const today = todayKey(state.now);
  saveEntry(today, { in: new Date().toISOString(), out: null, pauseIn: null, pauseOut: null, note: state.note });
  state.note = "";
}
function handlePauseStart() {
  const today = todayKey(state.now);
  saveEntry(today, { ...state.entries[today], pauseIn: new Date().toISOString(), pauseOut: null });
}
function handlePauseEnd() {
  const today = todayKey(state.now);
  saveEntry(today, { ...state.entries[today], pauseOut: new Date().toISOString() });
}
function handleEnd() {
  const today = todayKey(state.now);
  saveEntry(today, { ...state.entries[today], out: new Date().toISOString() });
}
function openEdit(k) {
  const e = state.entries[k];
  state.editForm = {
    in: toTimeInput(e.in), pauseIn: toTimeInput(e.pauseIn), pauseOut: toTimeInput(e.pauseOut),
    out: toTimeInput(e.out), note: e.note || "",
  };
  state.editingKey = k;
  state.confirmDelete = null;
  state.addingManual = false;
  render();
}
function saveEdit(k) {
  saveEntry(k, {
    in: fromTimeInput(k, state.editForm.in), pauseIn: fromTimeInput(k, state.editForm.pauseIn),
    pauseOut: fromTimeInput(k, state.editForm.pauseOut), out: fromTimeInput(k, state.editForm.out),
    note: state.editForm.note,
  });
  state.editingKey = null;
}
function openManual(presetDate) {
  const today = todayKey(state.now);
  state.manualForm = { date: presetDate || today, in: "", pauseIn: "", pauseOut: "", out: "", note: "" };
  state.addingManual = true;
  state.editingKey = null;
  render();
}
function saveManual() {
  if (!state.manualForm.date || !state.manualForm.in) return;
  const f = state.manualForm;
  saveEntry(f.date, {
    in: fromTimeInput(f.date, f.in), pauseIn: fromTimeInput(f.date, f.pauseIn),
    pauseOut: fromTimeInput(f.date, f.pauseOut), out: fromTimeInput(f.date, f.out), note: f.note,
  });
  state.addingManual = false;
}
function goToDay(dateKey) {
  state.openHistory = true;
  state.viewMode = "list";
  if (state.entries[dateKey]) openEdit(dateKey);
  else openManual(dateKey);
}
function shiftCalendarMonth(delta) {
  const [y, m] = state.calendarMonth.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  state.calendarMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  render();
}

// ---------- export / import (real hosted page: normal download & file picker both work) ----------
function buildCSV(keys) {
  const rows = [["Date", "Arrivée", "Pause début", "Pause fin", "Départ", "Heures", "Note"]];
  keys.forEach((k) => {
    const e = state.entries[k];
    const mins = computeMinutes(e);
    rows.push([
      k,
      e.in ? new Date(e.in).toLocaleTimeString("fr-FR") : "",
      e.pauseIn ? new Date(e.pauseIn).toLocaleTimeString("fr-FR") : "",
      e.pauseOut ? new Date(e.pauseOut).toLocaleTimeString("fr-FR") : "",
      e.out ? new Date(e.out).toLocaleTimeString("fr-FR") : "",
      fmtHM(mins),
      (e.note || "").replace(/,/g, ";"),
    ]);
  });
  return rows.map((r) => r.join(",")).join("\n");
}
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function exportCSV() {
  const sortedKeys = Object.keys(state.entries).sort().reverse();
  const csv = buildCSV(sortedKeys);
  downloadBlob(csv, `pointage_${todayKey(state.now)}.csv`, "text/csv;charset=utf-8;");
}
function exportJSON() {
  const payload = { exportedAt: new Date().toISOString(), entries: state.entries };
  downloadBlob(JSON.stringify(payload, null, 2), `pointage_sauvegarde_${todayKey(state.now)}.json`, "application/json");
}
function printMonth() {
  const [calY, calM] = state.calendarMonth.split("-").map(Number);
  const monthLabel = new Date(calY, calM - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const monthKeys = Object.keys(state.entries).filter((k) => monthKey(k) === state.calendarMonth).sort();
  let total = 0;
  const rows = monthKeys.map((k) => {
    const e = state.entries[k];
    const mins = computeMinutes(e);
    total += mins;
    const inT = e.in ? new Date(e.in).toLocaleTimeString("fr-FR").slice(0, 5) : "--:--";
    const outT = e.out ? new Date(e.out).toLocaleTimeString("fr-FR").slice(0, 5) : "en cours";
    const pIn = e.pauseIn ? new Date(e.pauseIn).toLocaleTimeString("fr-FR").slice(0, 5) : "--";
    const pOut = e.pauseOut ? new Date(e.pauseOut).toLocaleTimeString("fr-FR").slice(0, 5) : "--";
    return `<tr><td>${dayLabel(k)}</td><td>${inT}</td><td>${pIn}</td><td>${pOut}</td><td>${outT}</td><td>${fmtHM(mins)}</td><td>${esc(e.note || "")}</td></tr>`;
  }).join("");
  document.getElementById("print-area").innerHTML = `
    <h1>Relevé d'heures — ${monthLabel}</h1>
    <div>Total du mois : ${fmtHM(total)}</div>
    <table>
      <thead><tr><th>Jour</th><th>Arrivée</th><th>Pause début</th><th>Pause fin</th><th>Départ</th><th>Heures</th><th>Note</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7">Aucune journée enregistrée ce mois-ci.</td></tr>`}</tbody>
    </table>`;
  window.print();
}
function triggerImport() {
  document.getElementById("import-file-input").click();
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
      const keys = Object.keys(imported).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
      if (keys.length === 0) {
        state.exportMsg = "Ce fichier ne contient aucune journée reconnaissable.";
        render();
        return;
      }
      keys.forEach((k) => { state.entries[k] = imported[k]; });
      persistEntries(state.entries);
      state.exportMsg = `${keys.length} journée(s) importée(s) avec succès.`;
      render();
    } catch (e) {
      state.exportMsg = "Fichier invalide.";
      render();
    }
  };
  reader.readAsText(file);
}

// ---------- rendering ----------
function icon(name, size = 16) {
  const s = size;
  const icons = {
    play: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
    square: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>`,
    coffee: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a3 3 0 010 6h-1M2 8h16v6a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>`,
    download: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>`,
    upload: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></svg>`,
    filetext: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    trash: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>`,
    pencil: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z"/></svg>`,
    check: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    x: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    chevrondown: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`,
    chevronup: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`,
    chevronleft: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>`,
    chevronright: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
    calendar: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    list: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    alert: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    truck: `<svg class="icon" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="15" height="12" rx="1"/><path d="M16 10h4l3 3v5h-7z"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>`,
  };
  return icons[name] || "";
}

function render() {
  const today = todayKey(state.now);
  const todayEntry = state.entries[today];
  const status = !todayEntry || !todayEntry.in ? "off"
    : todayEntry.out ? "done"
    : todayEntry.pauseIn && !todayEntry.pauseOut ? "pause"
    : "on";
  const statusColor = status === "on" ? "#3FA34D" : status === "pause" ? "#F2A93B" : status === "done" ? "#7C8791" : "#C1443C";
  const statusLabel = status === "on" ? "EN SERVICE" : status === "pause" ? "EN PAUSE" : status === "done" ? "JOURNÉE TERMINÉE" : "HORS SERVICE";
  const liveMinutes = todayEntry ? computeMinutes(todayEntry) : 0;

  const sortedKeys = Object.keys(state.entries).sort().reverse();
  const weekTotals = {}, monthTotals = {};
  sortedKeys.forEach((k) => {
    const mins = computeMinutes(state.entries[k]);
    weekTotals[weekKey(k)] = (weekTotals[weekKey(k)] || 0) + mins;
    monthTotals[monthKey(k)] = (monthTotals[monthKey(k)] || 0) + mins;
  });
  const thisWeek = weekTotals[weekKey(today)] || 0;
  const thisMonth = monthTotals[monthKey(today)] || 0;
  const unclosedKeys = sortedKeys.filter((k) => k !== today && state.entries[k].in && !state.entries[k].out);

  let html = "";

  // header
  html += `<div class="header">${icon("truck", 22)}<span class="header-title">POINTAGE</span></div>`;

  // unclosed banner
  if (unclosedKeys.length > 0) {
    html += `<div class="warn-banner">${icon("alert", 16)}<div style="flex:1">
      <div class="warn-title">${unclosedKeys.length === 1 ? "Une journée n'a pas été clôturée" : `${unclosedKeys.length} journées n'ont pas été clôturées`}</div>
      ${unclosedKeys.map((k) => `<button class="warn-link" data-action="goto" data-key="${k}">${dayLabel(k)} — corriger l'heure de départ</button>`).join("")}
    </div></div>`;
  }

  // status card
  html += `<div class="card" style="border-color:${statusColor}">
    <div class="status-row"><span class="dot" style="background:${statusColor}"></span><span class="status-label" style="color:${statusColor}">${statusLabel}</span></div>
    <div class="big-clock" id="big-clock">${fmtHM(liveMinutes)}<span class="big-clock-seconds">${(status === "on" || status === "pause") ? " " + fmtSeconds(state.now) : ""}</span></div>
    <div class="clock-caption">${todayEntry && todayEntry.in ? `Arrivée ${new Date(todayEntry.in).toLocaleTimeString("fr-FR").slice(0, 5)}` : "Pas encore pointé aujourd'hui"}${todayEntry && todayEntry.out ? ` · Départ ${new Date(todayEntry.out).toLocaleTimeString("fr-FR").slice(0, 5)}` : ""}</div>`;

  if (status === "off") {
    html += `<input type="text" id="note-input" placeholder="Remarque (optionnel)" value="${esc(state.note)}" />
      <button class="btn-main" style="background:#3FA34D" data-action="start">${icon("play")} Pointer arrivée</button>`;
  } else if (status === "on") {
    html += `<div class="btn-row">
      <button class="btn-small" style="background:#F2A93B" data-action="pauseStart">${icon("coffee")} Pause</button>
      <button class="btn-main" style="background:#C1443C;flex:1" data-action="end">${icon("square")} Pointer départ</button>
    </div>`;
  } else if (status === "pause") {
    html += `<button class="btn-main" style="background:#F2A93B" data-action="pauseEnd">${icon("play")} Reprendre le service</button>`;
  } else if (status === "done") {
    html += `<div class="done-note">Journée enregistrée. À demain.</div>`;
  }
  html += `</div>`;

  // totals
  html += `<div class="totals-row">
    <div class="total-card"><div class="total-label">CETTE SEMAINE</div><div class="total-value">${fmtHM(thisWeek)}</div></div>
    <div class="total-card"><div class="total-label">CE MOIS</div><div class="total-value">${fmtHM(thisMonth)}</div></div>
  </div>`;

  // manual add
  if (!state.addingManual) {
    html += `<button class="manual-btn" data-action="openManual">+ Ajouter une journée manuellement</button>`;
  } else {
    html += renderEditForm("manual", state.manualForm, "Nouvelle journée", true);
  }

  // history header + toggle
  html += `<div class="history-header" data-action="toggleHistory"><span>Historique</span>${icon(state.openHistory ? "chevronup" : "chevrondown")}</div>`;

  if (state.openHistory) {
    html += `<div class="view-toggle">
      <button class="view-toggle-btn ${state.viewMode === "list" ? "active" : ""}" data-action="setView" data-view="list">${icon("list", 14)} Liste</button>
      <button class="view-toggle-btn ${state.viewMode === "calendar" ? "active" : ""}" data-action="setView" data-view="calendar">${icon("calendar", 14)} Calendrier</button>
    </div>`;

    if (state.viewMode === "calendar") {
      html += renderCalendar(monthTotals);
    } else {
      html += `<div class="history-list">`;
      if (sortedKeys.length === 0) {
        html += `<div class="empty-msg">Aucune journée enregistrée pour l'instant.</div>`;
      } else {
        sortedKeys.forEach((k) => {
          if (state.editingKey === k) {
            html += renderEditForm(k, state.editForm, dayLabel(k), false);
            return;
          }
          const e = state.entries[k];
          const mins = computeMinutes(e);
          const missingPause = rawSpanMinutes(e) > 360 && !e.pauseIn;
          html += `<div class="history-row">
            <div class="history-date">${dayLabel(k)}</div>
            <div class="history-times">${e.in ? new Date(e.in).toLocaleTimeString("fr-FR").slice(0, 5) : "--:--"} → ${e.out ? new Date(e.out).toLocaleTimeString("fr-FR").slice(0, 5) : "en cours"}${e.note ? ` <span class="history-note">· ${esc(e.note)}</span>` : ""}${missingPause ? `<span class="pause-badge">${icon("alert", 11)} pas de pause</span>` : ""}</div>
            <div class="history-hours">${fmtHM(mins)}</div>`;
          if (state.confirmDelete === k) {
            html += `<div class="confirm-group">
              <button class="confirm-yes" data-action="confirmDeleteYes" data-key="${k}">Oui</button>
              <button class="confirm-no" data-action="confirmDeleteNo">Non</button>
            </div>`;
          } else {
            html += `<div class="row-actions">
              <button class="icon-btn" data-action="editKey" data-key="${k}">${icon("pencil", 15)}</button>
              <button class="icon-btn" data-action="askDelete" data-key="${k}">${icon("trash", 15)}</button>
            </div>`;
          }
          html += `</div>`;
        });
      }
      html += `</div>`;
    }
  }

  // export/import
  if (sortedKeys.length > 0) {
    html += `<div class="export-row">
      <button class="export-btn" data-action="exportCSV">${icon("download")} CSV</button>
      <button class="export-btn" data-action="printMonth">${icon("filetext")} Imprimer / PDF</button>
    </div>`;
  }
  html += `<div class="export-row">
    <button class="export-btn" data-action="exportJSON">${icon("download")} Sauvegarder (JSON)</button>
    <button class="export-btn" data-action="triggerImport">${icon("upload")} Importer</button>
  </div>
  <input type="file" id="import-file-input" accept="application/json,.json" class="hidden" />`;

  if (state.exportMsg) html += `<div class="export-error">${esc(state.exportMsg)}</div>`;

  document.getElementById("app-content").innerHTML = `<div class="container">${html}</div>`;
  attachHandlers();
}

function renderEditForm(key, form, title, isManual) {
  return `<div class="edit-row">
    <div class="edit-row-title">${esc(title)}</div>
    ${isManual ? `<label class="edit-label">Date<input type="date" id="manual-date" value="${form.date}" /></label>` : ""}
    <div class="edit-grid">
      <label class="edit-label">Arrivée<input type="time" id="${isManual ? "manual" : "edit"}-in" value="${form.in}" /></label>
      <label class="edit-label">Départ<input type="time" id="${isManual ? "manual" : "edit"}-out" value="${form.out}" /></label>
      <label class="edit-label">Pause début<input type="time" id="${isManual ? "manual" : "edit"}-pauseIn" value="${form.pauseIn}" /></label>
      <label class="edit-label">Pause fin<input type="time" id="${isManual ? "manual" : "edit"}-pauseOut" value="${form.pauseOut}" /></label>
    </div>
    <input type="text" id="${isManual ? "manual" : "edit"}-note" placeholder="Remarque (optionnel)" value="${esc(form.note)}" style="margin-top:8px" />
    ${isManual && state.entries[form.date] ? `<div class="manual-warning">Une journée existe déjà à cette date — l'enregistrer ici la remplacera.</div>` : ""}
    <div class="edit-actions">
      <button class="confirm-yes" data-action="${isManual ? "saveManual" : "saveEdit"}" data-key="${key}">${icon("check", 14)} Enregistrer</button>
      <button class="confirm-no" data-action="${isManual ? "cancelManual" : "cancelEdit"}">${icon("x", 14)} Annuler</button>
    </div>
  </div>`;
}

function renderCalendar(monthTotals) {
  const [calY, calM] = state.calendarMonth.split("-").map(Number);
  const firstOfMonth = new Date(calY, calM - 1, 1);
  const lastOfMonth = new Date(calY, calM, 0);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= lastOfMonth.getDate(); d++) cells.push(`${calY}-${pad(calM)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = firstOfMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const total = monthTotals[state.calendarMonth] || 0;
  const today = todayKey(state.now);

  let html = `<div class="calendar-box">
    <div class="calendar-nav">
      <button class="cal-nav-btn" data-action="calPrev">${icon("chevronleft")}</button>
      <div class="calendar-month-label">${monthLabel}</div>
      <button class="cal-nav-btn" data-action="calNext">${icon("chevronright")}</button>
    </div>
    <div class="calendar-total">Total du mois : ${fmtHM(total)}</div>
    <div class="calendar-grid">
      ${["L", "M", "M", "J", "V", "S", "D"].map((d) => `<div class="calendar-weekday">${d}</div>`).join("")}
      ${cells.map((dateKey) => {
        if (!dateKey) return `<div class="calendar-cell-empty"></div>`;
        const e = state.entries[dateKey];
        const dayNum = Number(dateKey.slice(-2));
        const isToday = dateKey === today;
        const missingPause = e && rawSpanMinutes(e) > 360 && !e.pauseIn;
        const unclosed = e && e.in && !e.out;
        let cls = "calendar-cell";
        if (e) cls += unclosed ? " has-entry open" : " has-entry closed";
        if (isToday) cls += " is-today";
        const mins = e ? computeMinutes(e) : 0;
        return `<button class="${cls}" data-action="goto" data-key="${dateKey}">
          <span class="calendar-day-num">${dayNum}</span>
          ${e ? `<span class="calendar-day-hours">${fmtHM(mins)}</span>` : ""}
          ${missingPause ? `<span class="calendar-warn-icon">${icon("alert", 9)}</span>` : ""}
        </button>`;
      }).join("")}
    </div>
    <div class="calendar-legend">
      <span><span class="legend-dot" style="background:#3FA34D"></span> journée clôturée</span>
      <span><span class="legend-dot" style="background:#F2A93B"></span> non clôturée</span>
    </div>
  </div>`;
  return html;
}

function attachHandlers() {
  const root = document.getElementById("app-content");

  const noteInput = document.getElementById("note-input");
  if (noteInput) noteInput.addEventListener("input", (e) => { state.note = e.target.value; });

  root.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const action = el.getAttribute("data-action");
      const key = el.getAttribute("data-key");
      switch (action) {
        case "start": handleStart(); break;
        case "pauseStart": handlePauseStart(); break;
        case "pauseEnd": handlePauseEnd(); break;
        case "end": handleEnd(); break;
        case "toggleHistory": state.openHistory = !state.openHistory; render(); break;
        case "setView": state.viewMode = el.getAttribute("data-view"); render(); break;
        case "openManual": openManual(); break;
        case "cancelManual": state.addingManual = false; render(); break;
        case "saveManual": {
          state.manualForm.date = document.getElementById("manual-date").value;
          state.manualForm.in = document.getElementById("manual-in").value;
          state.manualForm.out = document.getElementById("manual-out").value;
          state.manualForm.pauseIn = document.getElementById("manual-pauseIn").value;
          state.manualForm.pauseOut = document.getElementById("manual-pauseOut").value;
          state.manualForm.note = document.getElementById("manual-note").value;
          saveManual();
          render();
          break;
        }
        case "editKey": openEdit(key); break;
        case "cancelEdit": state.editingKey = null; render(); break;
        case "saveEdit": {
          state.editForm.in = document.getElementById("edit-in").value;
          state.editForm.out = document.getElementById("edit-out").value;
          state.editForm.pauseIn = document.getElementById("edit-pauseIn").value;
          state.editForm.pauseOut = document.getElementById("edit-pauseOut").value;
          state.editForm.note = document.getElementById("edit-note").value;
          saveEdit(key);
          render();
          break;
        }
        case "askDelete": state.confirmDelete = key; render(); break;
        case "confirmDeleteYes": deleteEntryKey(key); break;
        case "confirmDeleteNo": state.confirmDelete = null; render(); break;
        case "goto": goToDay(key); break;
        case "calPrev": shiftCalendarMonth(-1); break;
        case "calNext": shiftCalendarMonth(1); break;
        case "exportCSV": exportCSV(); break;
        case "exportJSON": exportJSON(); break;
        case "printMonth": printMonth(); break;
        case "triggerImport": triggerImport(); break;
      }
    });
  });

  const importInput = document.getElementById("import-file-input");
  if (importInput) importInput.addEventListener("change", handleImportFile);
}

// ---------- live clock + resync on foreground ----------
function isFormOpen() {
  return !!(state.addingManual || state.editingKey || state.showImportBox || state.confirmDelete);
}

function tick() {
  state.now = new Date();
  const active = document.activeElement;
  const activeIsFormField = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (isFormOpen() || activeIsFormField) {
    // don't rebuild the whole screen — that would close any open date/time picker
    // (or a native picker that briefly steals focus) and lose whatever is being typed.
    const today = todayKey(state.now);
    const todayEntry = state.entries[today];
    const status = !todayEntry || !todayEntry.in ? "off"
      : todayEntry.out ? "done"
      : todayEntry.pauseIn && !todayEntry.pauseOut ? "pause"
      : "on";
    const clockEl = document.getElementById("big-clock");
    if (clockEl && todayEntry) {
      const liveMinutes = computeMinutes(todayEntry);
      const secs = (status === "on" || status === "pause") ? " " + fmtSeconds(state.now) : "";
      clockEl.innerHTML = `${fmtHM(liveMinutes)}<span class="big-clock-seconds">${secs}</span>`;
    }
    return;
  }
  render();
}
setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => {
  const active = document.activeElement;
  const activeIsFormField = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (document.visibilityState === "visible" && !isFormOpen() && !activeIsFormField) {
    state.now = new Date();
    state.entries = loadEntries();
    render();
  }
});
window.addEventListener("focus", () => {
  const active = document.activeElement;
  const activeIsFormField = active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
  if (!isFormOpen() && !activeIsFormField) { state.now = new Date(); render(); }
});

// ---------- service worker registration ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((e) => console.error("SW error", e));
  });
}

render();

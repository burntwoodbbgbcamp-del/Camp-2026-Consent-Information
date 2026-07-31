/* ============================================================
   Camp 2026 Consent Lookup — app logic
   Data source: a CSV file kept in Dropbox (exported from the
   "GB Camp 2026 Consent Form" sheet of the master workbook).
   Column order below MUST match that sheet's column order.
   ============================================================ */

const FIELD_ORDER = [
  'timestamp', 'username', 'surname', 'firstName', 'dob',
  'address', 'town', 'county', 'postcode',
  'doctorName', 'doctorAddress', 'doctorPhone',
  'allergies', 'allergyDetails',
  'illness', 'illnessDetails',
  'medication', 'medicationDetails',
  'selfMedicates', 'tetanus', 'otherMedical',
  'ec1First', 'ec1Last', 'ec1Rel', 'ec1Phone',
  'ec2First', 'ec2Last', 'ec2Rel', 'ec2Phone',
  'consentAttend', 'consentInfoCorrect', 'consentMedicalTreatment', 'consentPhoto'
];

const LS_URL = 'campconsent_dropbox_url';
const LS_DATA = 'campconsent_data';
const LS_SYNCED = 'campconsent_last_synced';

let state = {
  tab: 'search',
  query: '',
  participants: [],
  selectedId: null,
  lastSynced: localStorage.getItem(LS_SYNCED),
  syncing: false,
  syncError: null
};

/* ---------------- CSV parsing (handles quoted commas/newlines) ---------------- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim() !== ''));
}

function normalizeDropboxUrl(url) {
  url = url.trim();
  if (!url) return url;
  // www.dropbox.com / dropbox.com links do NOT reliably send the CORS
  // header browsers require for fetch() — even with dl=1 or raw=1.
  // dl.dropboxusercontent.com (their direct-content domain) does.
  if (/(^|\/\/)(www\.)?dropbox\.com/i.test(url)) {
    url = url.replace(/(^|\/\/)(www\.)?dropbox\.com/i, '$1dl.dropboxusercontent.com');
  }
  if (/[?&]dl=0/.test(url)) return url.replace('dl=0', 'dl=1');
  if (!/[?&]dl=1/.test(url)) return url + (url.includes('?') ? '&dl=1' : '?dl=1');
  return url;
}

function rowsToParticipants(rows) {
  // Drop header row if it looks like a header (first cell contains "Timestamp")
  let dataRows = rows;
  if (rows.length && /timestamp/i.test(rows[0][0] || '')) dataRows = rows.slice(1);

  return dataRows.map((r, idx) => {
    const p = { rowId: idx };
    FIELD_ORDER.forEach((key, i) => { p[key] = (r[i] || '').trim(); });
    p.fullName = `${p.firstName} ${p.surname}`.trim();
    p.sortKey = `${p.surname} ${p.firstName}`.trim().toLowerCase();

    // Matches the "Medical Flags" tab logic from the source workbook exactly:
    // flagged if any Yes/No question is "Yes", OR any details box has real
    // content (not blank/NA/None/No/N.A./Nil).
    const yes = v => (v || '').trim().toLowerCase() === 'yes';
    const blanklike = v => ['', 'NA', 'N/A', 'NONE', 'NO', 'N.A.', 'NIL'].includes((v || '').trim().toUpperCase());
    p.medicalFlag = yes(p.allergies) || yes(p.illness) || yes(p.medication) ||
      !blanklike(p.allergyDetails) || !blanklike(p.illnessDetails) || !blanklike(p.medicationDetails);
    p.noPhoto = !yes(p.consentPhoto);
    p.allConsents = yes(p.consentAttend) && yes(p.consentInfoCorrect) &&
      yes(p.consentMedicalTreatment) && yes(p.consentPhoto);
    return p;
  }).filter(p => p.fullName);
}

/* ---------------- Sync ---------------- */
async function syncNow(showErrors = true) {
  const url = localStorage.getItem(LS_URL);
  if (!url) { state.syncError = 'No Dropbox link set yet.'; render(); return; }

  state.syncing = true; render();
  try {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Server returned ' + resp.status);
    const text = await resp.text();
    const rows = parseCSV(text);
    const participants = rowsToParticipants(rows);
    if (!participants.length) throw new Error('File loaded but no participant rows were found.');

    state.participants = participants;
    state.lastSynced = new Date().toISOString();
    state.syncError = null;
    localStorage.setItem(LS_DATA, JSON.stringify(participants));
    localStorage.setItem(LS_SYNCED, state.lastSynced);
  } catch (err) {
    state.syncError = 'Could not reach Dropbox (' + err.message + '). Showing last saved data.';
    if (!showErrors) state.syncError = null;
  } finally {
    state.syncing = false;
    render();
  }
}

function loadCachedData() {
  const cached = localStorage.getItem(LS_DATA);
  if (cached) {
    try { state.participants = JSON.parse(cached); } catch (e) { state.participants = []; }
  }
}

/* ---------------- Rendering helpers ---------------- */
function esc(s) {
  return (s || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fmtSynced(iso) {
  if (!iso) return 'Never synced';
  const d = new Date(iso);
  return 'Synced ' + d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function updateSyncPill() {
  const pill = document.getElementById('syncPill');
  if (state.syncing) { pill.textContent = 'Syncing…'; pill.className = 'sync-pill'; return; }
  if (!state.lastSynced) { pill.textContent = 'Not synced'; pill.className = 'sync-pill offline'; return; }
  const ageHrs = (Date.now() - new Date(state.lastSynced)) / 36e5;
  pill.textContent = fmtSynced(state.lastSynced);
  pill.className = 'sync-pill' + (ageHrs > 48 ? ' stale' : '');
}

function updateNavDots() {
  const medCount = state.participants.filter(p => p.medicalFlag).length;
  const photoCount = state.participants.filter(p => p.noPhoto).length;
  document.getElementById('medDot').style.display = medCount ? 'block' : 'none';
  document.getElementById('photoDot').style.display = photoCount ? 'block' : 'none';
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
}

/* ---------------- Views ---------------- */
function personRow(p, badgeType) {
  let badge = '';
  if (badgeType === 'consent') {
    badge = p.allConsents ? '<span class="badge ok">All consents</span>' : '<span class="badge warn">Missing</span>';
  } else if (badgeType === 'medical') {
    badge = '<span class="badge med">Flagged</span>';
  } else if (badgeType === 'photo') {
    badge = '<span class="badge warn">No photo</span>';
  }
  return `<div class="person-row" data-id="${p.rowId}">
    <div>
      <div class="pname">${esc(p.fullName)}</div>
      <div class="psub">${esc(p.town || '')}</div>
    </div>
    ${badge}
  </div>`;
}

function viewSearch() {
  const q = state.query.trim().toLowerCase();
  const list = state.participants
    .filter(p => !q || p.fullName.toLowerCase().includes(q))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const rows = list.length
    ? `<div class="card">${list.map(p => personRow(p, 'consent')).join('')}</div>`
    : `<div class="empty-state">${state.participants.length ? 'No one matches that search.' : 'No data yet — go to the Sync tab to load participants from Dropbox.'}</div>`;

  return `
    <div class="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
      <input id="searchInput" type="text" inputmode="search" placeholder="Search participant name…" value="${esc(state.query)}">
    </div>
    <div class="count-line">${state.participants.length} participant${state.participants.length === 1 ? '' : 's'} loaded</div>
    ${rows}`;
}

function fieldRow(label, value, opts = {}) {
  const isEmpty = !value || /^n\/?a$/i.test(value.trim());
  const cls = opts.flag && !isEmpty ? 'v flag' : (isEmpty ? 'v empty' : 'v');
  let display = isEmpty ? '—' : esc(value);
  if (opts.tel && !isEmpty) display = `<a class="phone-link" href="tel:${esc(value.replace(/\s+/g, ''))}">${esc(value)}</a>`;
  return `<div class="field-row"><span class="k">${esc(label)}</span><span class="${cls}">${display}</span></div>`;
}

function consentChip(label, value) {
  const yes = (value || '').trim().toLowerCase() === 'yes';
  return `<div class="consent-chip ${yes ? 'yes' : 'no'}"><span class="label">${esc(label)}</span>${yes ? 'Yes' : (value ? esc(value) : 'Not given')}</div>`;
}

function viewDetail(p) {
  return `
    <button class="back-btn" id="backBtn">&larr; Back</button>
    <div class="detail-name">${esc(p.fullName)}</div>
    <div class="detail-dob">${p.dob ? 'DOB: ' + esc(p.dob) : ''}</div>

    <div class="consent-strip">
      ${consentChip('Attend / take part', p.consentAttend)}
      ${consentChip('Info confirmed correct', p.consentInfoCorrect)}
      ${consentChip('Medical treatment', p.consentMedicalTreatment)}
      ${consentChip('Photo / video', p.consentPhoto)}
    </div>
    <div class="all-consent-banner ${p.allConsents ? 'ok' : 'warn'}">
      ${p.allConsents ? 'ALL CONSENTS GIVEN' : 'MISSING CONSENT — check above'}
    </div>

    <div class="field-group">
      <h3>Participant details</h3>
      ${fieldRow('Address', p.address)}
      ${fieldRow('Town', p.town)}
      ${fieldRow('County', p.county)}
      ${fieldRow('Postcode', p.postcode)}
    </div>

    <div class="field-group">
      <h3>Doctor / surgery</h3>
      ${fieldRow('Surgery name', p.doctorName)}
      ${fieldRow('Surgery address', p.doctorAddress)}
      ${fieldRow('Surgery phone', p.doctorPhone, { tel: true })}
    </div>

    <div class="field-group">
      <h3>Medical</h3>
      ${fieldRow('Allergies / dietary needs?', p.allergies, { flag: true })}
      ${fieldRow('Details', p.allergyDetails)}
      ${fieldRow('Illness / disability?', p.illness, { flag: true })}
      ${fieldRow('Details', p.illnessDetails)}
      ${fieldRow('Taking medication?', p.medication, { flag: true })}
      ${fieldRow('Medication details / frequency', p.medicationDetails)}
      ${fieldRow('Self-medicates?', p.selfMedicates)}
      ${fieldRow('Tetanus jab in last 5 yrs?', p.tetanus)}
      ${fieldRow('Other medical/health info', p.otherMedical)}
    </div>

    <div class="field-group">
      <h3>Emergency contact 1</h3>
      ${fieldRow('Name', `${p.ec1First} ${p.ec1Last}`.trim())}
      ${fieldRow('Relationship', p.ec1Rel)}
      ${fieldRow('Telephone', p.ec1Phone, { tel: true })}
    </div>

    <div class="field-group">
      <h3>Emergency contact 2</h3>
      ${fieldRow('Name', `${p.ec2First} ${p.ec2Last}`.trim())}
      ${fieldRow('Relationship', p.ec2Rel)}
      ${fieldRow('Telephone', p.ec2Phone, { tel: true })}
    </div>
  `;
}

function viewMedical() {
  const list = state.participants.filter(p => p.medicalFlag).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const rows = list.length
    ? `<div class="card">${list.map(p => personRow(p, 'medical')).join('')}</div>`
    : `<div class="empty-state">No one is currently flagged for allergies, illness or medication.</div>`;
  return `<div class="section-label">Medical summary</div><div class="count-line">${list.length} participant${list.length === 1 ? '' : 's'} flagged</div>${rows}`;
}

function viewPhoto() {
  const list = state.participants.filter(p => p.noPhoto).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const rows = list.length
    ? `<div class="card">${list.map(p => personRow(p, 'photo')).join('')}</div>`
    : `<div class="empty-state">Everyone has given photo / video permission.</div>`;
  return `<div class="section-label">No photo / video permission</div><div class="count-line">${list.length} participant${list.length === 1 ? '' : 's'} — includes blank answers</div>${rows}`;
}

function viewSettings() {
  const savedUrl = localStorage.getItem(LS_URL) || '';
  let statusHtml = '';
  if (state.syncError) statusHtml = `<div class="status-box err">${esc(state.syncError)}</div>`;
  else if (state.lastSynced) statusHtml = `<div class="status-box ok2">${fmtSynced(state.lastSynced)} · ${state.participants.length} participants loaded</div>`;

  return `
    <div class="section-label">Data source</div>
    ${statusHtml}
    <div class="field">
      <label for="urlInput">Dropbox CSV link</label>
      <input id="urlInput" type="url" placeholder="https://www.dropbox.com/scl/fi/.../form.csv?dl=0" value="${esc(savedUrl)}">
      <div class="hint">In Dropbox: Share → Copy link on the exported CSV. Paste it here — the app converts it automatically. Anyone with the link can view the file, so keep sharing set to "people with the link", not public search.</div>
    </div>
    <button class="primary" id="saveSyncBtn" ${state.syncing ? 'disabled' : ''}>${state.syncing ? 'Syncing…' : 'Save & sync now'}</button>
    <button class="secondary" id="syncOnlyBtn" ${state.syncing ? 'disabled' : ''}>Sync now</button>

    <div class="section-label">About this device</div>
    <div class="field-group" style="padding: 12px 14px;">
      <p style="font-size:0.85rem; line-height:1.5; margin: 8px 0;">
        Data is stored only on this phone, pulled directly from your Dropbox link. Nothing is sent to any other server.
        Once synced, the app works fully offline — open it any time, even with no signal, and it will show the last data it fetched.
      </p>
      <p style="font-size:0.85rem; line-height:1.5; margin: 8px 0;">
        Install it properly as an app: on iPhone use Share → Add to Home Screen. On Android use the browser menu → Install app / Add to Home screen.
      </p>
    </div>
    <button class="secondary" id="clearBtn">Clear saved data from this device</button>
  `;
}

/* ---------------- Main render ---------------- */
function render() {
  const main = document.getElementById('main');
  if (state.tab === 'search') {
    if (state.selectedId !== null) {
      const p = state.participants.find(p => p.rowId === state.selectedId);
      main.innerHTML = p ? viewDetail(p) : viewSearch();
    } else {
      main.innerHTML = viewSearch();
    }
  } else if (state.tab === 'medical') {
    main.innerHTML = state.selectedId !== null
      ? viewDetail(state.participants.find(p => p.rowId === state.selectedId))
      : viewMedical();
  } else if (state.tab === 'photo') {
    main.innerHTML = state.selectedId !== null
      ? viewDetail(state.participants.find(p => p.rowId === state.selectedId))
      : viewPhoto();
  } else if (state.tab === 'settings') {
    main.innerHTML = viewSettings();
  }

  updateSyncPill();
  updateNavDots();
  wireEvents();
}

function wireEvents() {
  document.querySelectorAll('.bottom-nav button').forEach(btn => {
    btn.onclick = () => {
      state.tab = btn.dataset.tab;
      state.selectedId = null;
      render();
    };
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.oninput = (e) => { state.query = e.target.value; render(); searchInput.focus(); searchInput.setSelectionRange(state.query.length, state.query.length); };
  }

  document.querySelectorAll('.person-row').forEach(row => {
    row.onclick = () => { state.selectedId = Number(row.dataset.id); render(); };
  });

  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.onclick = () => { state.selectedId = null; render(); };

  const saveSyncBtn = document.getElementById('saveSyncBtn');
  if (saveSyncBtn) saveSyncBtn.onclick = () => {
    const raw = document.getElementById('urlInput').value.trim();
    localStorage.setItem(LS_URL, normalizeDropboxUrl(raw));
    syncNow();
  };

  const syncOnlyBtn = document.getElementById('syncOnlyBtn');
  if (syncOnlyBtn) syncOnlyBtn.onclick = () => syncNow();

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.onclick = () => {
    if (confirm('Remove all cached participant data from this device? You can sync again any time.')) {
      localStorage.removeItem(LS_DATA);
      localStorage.removeItem(LS_SYNCED);
      state.participants = [];
      state.lastSynced = null;
      render();
    }
  };
}

/* ---------------- Boot ---------------- */
loadCachedData();
render();
if (localStorage.getItem(LS_URL)) syncNow(false);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

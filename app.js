/* =============================================================
   HCM Lite - app.js
   Vanilla JS · localStorage · No external dependencies
   ============================================================= */

'use strict';

/* ─────────────────────────────────────────────
   SECTION 1: STORAGE & DATA MODEL
───────────────────────────────────────────── */
const LS_KEYS = {
  COMPANY:     'hcm_company',
  USERS:       'hcm_users',
  EMPLOYEES:   'hcm_employees',
  ATTENDANCE:  'hcm_attendance',
  LEAVES:      'hcm_leaves',
  PAYSLIPS:    'hcm_payslips',
  ANNOUNCEMENTS:'hcm_announcements',
  SETTINGS:    'hcm_settings',
  INITIALIZED: 'hcm_initialized',
};
const SESSION_KEY = 'hcm_session';

function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch(e) { console.error('lsSet failed', key, e); return false; }
}
function sessGet(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function sessSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function sessClear() { sessionStorage.removeItem(SESSION_KEY); }

/* ── ID generators ── */
let _idSeq = Date.now();
function genId(prefix = '') { return prefix + (++_idSeq); }
function genEmpId(existing = []) {
  let n = existing.length + 1;
  while (existing.find(e => e.employeeId === 'EMP-' + String(n).padStart(3,'0'))) n++;
  return 'EMP-' + String(n).padStart(3,'0');
}

/* ── Default settings ── */
const DEFAULT_SETTINGS = {
  workStart: '09:00',
  workEnd:   '17:00',
  graceMinutes: 15,
  workDays: [1,2,3,4,5],   // Mon-Fri
  annualLeaveQuota: 20,
  currency: 'PKR',
};

/* ── App state ── */
const STATE = {
  currentUser: null,
  currentEmployee: null,
  currentPage: null,
};

function isInitialized() { return !!lsGet(LS_KEYS.INITIALIZED); }
function getCompany()     { return lsGet(LS_KEYS.COMPANY, {}); }
function getUsers()       { return lsGet(LS_KEYS.USERS, []); }
function getEmployees()   { return lsGet(LS_KEYS.EMPLOYEES, []); }
function getAttendance()  { return lsGet(LS_KEYS.ATTENDANCE, []); }
function getLeaves()      { return lsGet(LS_KEYS.LEAVES, []); }
function getPayslips()    { return lsGet(LS_KEYS.PAYSLIPS, []); }
function getAnnouncements(){ return lsGet(LS_KEYS.ANNOUNCEMENTS, []); }
function getSettings()    { return Object.assign({}, DEFAULT_SETTINGS, lsGet(LS_KEYS.SETTINGS, {})); }

function saveUsers(arr)         { lsSet(LS_KEYS.USERS, arr); }
function saveEmployees(arr)     { lsSet(LS_KEYS.EMPLOYEES, arr); }
function saveAttendance(arr)    { lsSet(LS_KEYS.ATTENDANCE, arr); }
function saveLeaves(arr)        { lsSet(LS_KEYS.LEAVES, arr); }
function savePayslips(arr)      { lsSet(LS_KEYS.PAYSLIPS, arr); }
function saveAnnouncements(arr) { lsSet(LS_KEYS.ANNOUNCEMENTS, arr); }
function saveSettings(obj)      { lsSet(LS_KEYS.SETTINGS, obj); }

/* ─────────────────────────────────────────────
   SECTION 2: UTILITIES
───────────────────────────────────────────── */
function escHtml(str) {
  if (str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return isNaN(d) ? dateStr : d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function fmtMoney(n, currency='PKR') {
  if (n == null || n === '') return '—';
  return currency + ' ' + Number(n).toLocaleString('en-PK',{minimumFractionDigits:0,maximumFractionDigits:0});
}
function fmtTime(timeStr) { return timeStr || '--:--'; }
function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function nowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0,5);
}
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}
function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m)-1, 1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
function hashPassword(pw) {
  // Simple deterministic hash for localStorage (NOT cryptographically secure)
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = (Math.imul(31,h) + pw.charCodeAt(i)) | 0; }
  return 'sha_' + Math.abs(h).toString(16) + '_' + pw.length;
}
function checkPasswordStrength(pw) {
  let score = 0;
  const has = {
    len: pw.length >= 8,
    num: /\d/.test(pw),
    upper: /[A-Z]/.test(pw),
    special: /[^a-zA-Z0-9]/.test(pw),
  };
  if (has.len) score++;
  if (has.num) score++;
  if (has.upper) score++;
  if (has.special) score++;
  return { score, has };
}
function workingDaysBetween(startStr, endStr, workDays = [1, 2, 3, 4, 5]) {
  const s = new Date(startStr + 'T00:00:00');
  const e = new Date(endStr   + 'T00:00:00');
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  const daysList = Array.isArray(workDays) && workDays.length ? workDays : [1, 2, 3, 4, 5];
  let count = 0, cur = new Date(s);
  while (cur <= e) {
    if (daysList.includes(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
function numToWords(n) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function words(num) {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num/10)] + (num%10 ? ' ' + a[num%10] : '');
    if (num < 1000) return a[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + words(num%100) : '');
    if (num < 100000) return words(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + words(num%1000) : '');
    if (num < 10000000) return words(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + words(num%100000) : '');
    return words(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + words(num%10000000) : '');
  }
  n = Math.round(Number(n));
  if (!n) return 'Zero';
  return words(n) + ' Pakistani Rupees Only.';
}

/* ─────────────────────────────────────────────
   SECTION 3: TOAST NOTIFICATIONS
───────────────────────────────────────────── */
function toast(type, title, msg, dur=4000) {
  const icons = {
    success:'<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
    error:  '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
    warn:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
    info:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
  };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]||icons.info}</span><div class="toast-body"><div class="toast-title">${escHtml(title)}</div>${msg?`<div class="toast-msg">${escHtml(msg)}</div>`:''}</div><button class="toast-dismiss" onclick="this.parentElement.remove()"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/></svg></button>`;
  const container = document.getElementById('toast-container');
  if (container) container.appendChild(el);
  if (dur > 0) setTimeout(() => { el.classList.add('toast-exit'); setTimeout(()=>el.remove(), 350); }, dur);
}

/* ─────────────────────────────────────────────
   SECTION 4: MODAL HELPER
───────────────────────────────────────────── */
let _activeModal = null;
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); _activeModal = id; }
}
function closeModal(id) {
  const el = document.getElementById(id || _activeModal);
  if (el) { el.classList.remove('open'); }
  _activeModal = null;
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  _activeModal = null;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllModals(); });

/* ─────────────────────────────────────────────
   SECTION 5: SVG ICON LIBRARY
───────────────────────────────────────────── */
const ICONS = {
  dashboard: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2V4zM10 4a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2V4zM2 12a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4zM10 12a2 2 0 012-2h4a2 2 0 012 2v4a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4z"/></svg>',
  employees: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>',
  leaves:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/></svg>',
  payslip:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/></svg>',
  settings:  '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>',
  portal:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd"/></svg>',
  logout:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>',
  attendance:'<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>',
  announce:  '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>',
  plus:      '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>',
  edit:      '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>',
  trash:     '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
  check:     '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>',
  x:         '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>',
  eye:       '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>',
  eyeoff:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"/><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"/></svg>',
  info:      '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>',
  robot:     '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 000 2 1 1 0 001 1v1H8V6a1 1 0 001-1 1 1 0 100-2H9zM7 7a1 1 0 00-1 1v7a1 1 0 001 1h6a1 1 0 001-1V8a1 1 0 00-1-1H7zm2 2h2v2H9V9zm0 4h2v1H9v-1z"/></svg>',
  send:      '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>',
  search:    '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>',
  menu:      '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>',
  warning:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
  lock:      '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>',
  print:     '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v-2h10v2H6zm1 2v-1h6v1H7z" clip-rule="evenodd"/></svg>',
  clock:     '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>',
  user:      '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/></svg>',
  refresh:   '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>',
};


/* ─────────────────────────────────────────────
   SECTION 6: ROUTER / RENDER ENGINE
───────────────────────────────────────────── */
function navigate(page, params = {}) {
  if (!STATE.currentUser) { renderAuthScreen(); return; }
  const role = STATE.currentUser.role;
  if (role === 'employee') {
    const employees = getEmployees();
    const emp = employees.find(e => e.id === STATE.currentUser.employeeId || e.employeeId === STATE.currentUser.employeeId);
    const u = getUsers().find(usr => usr.id === STATE.currentUser.id);
    if (!emp || emp.status !== 'active' || (u && u.disabled)) {
      logout();
      toast('error', 'Account Inactive', 'Your employee account is not active. Please contact administrator.');
      return;
    }
    STATE.currentEmployee = emp;
  }
  const adminPages  = ['dashboard','employees','attendance','leaves','payslips','announcements','settings'];
  const employeePages = ['emp-dashboard','emp-attendance','emp-leaves','emp-payslips','emp-announcements','emp-profile'];
  if (role === 'employee' && !employeePages.includes(page)) page = 'emp-dashboard';
  if (role === 'admin' && !adminPages.includes(page) && !employeePages.includes(page)) page = 'dashboard';
  STATE.currentPage = page;
  STATE.currentParams = params;
  renderShell();
  renderPage(page, params);
  closeSidebar();
}

function renderPage(page, params) {
  const content = document.getElementById('page-content');
  if (!content) return;
  const adminPages = ['dashboard','employees','attendance','leaves','payslips','announcements','settings'];
  if (STATE.currentUser?.role === 'employee' && adminPages.includes(page)) {
    page = 'emp-dashboard';
  }
  const pages = {
    'dashboard':       renderAdminDashboard,
    'employees':       renderEmployees,
    'attendance':      renderAttendance,
    'leaves':          renderLeaves,
    'payslips':        renderPayslips,
    'announcements':   renderAnnouncements,
    'settings':        renderSettings,
    'emp-dashboard':   renderEmpDashboard,
    'emp-attendance':  renderEmpAttendance,
    'emp-leaves':      renderEmpLeaves,
    'emp-payslips':    renderEmpPayslips,
    'emp-announcements': renderEmpAnnouncements,
    'emp-profile':     renderEmpProfile,
  };
  if (pages[page]) pages[page](params);
  else content.innerHTML = '<div class="empty-state"><p>Page not found.</p></div>';
}

/* ─────────────────────────────────────────────
   SECTION 7: AUTH SCREENS
───────────────────────────────────────────── */
function renderAuthScreen() {
  const app = document.getElementById('app');
  const initialized = isInitialized();
  app.innerHTML = `
  <div class="screen-auth">
    <div class="auth-card">
      <div class="auth-header">
        <div class="auth-logo">
          <div class="logo-mark"><svg viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
          <div class="logo-text">
            <strong>HCM<span>Lite</span></strong>
            <small>Saylani Hackathon Edition</small>
          </div>
        </div>
        <p class="auth-tagline">Human Capital Management · Local-First</p>
      </div>
      <div class="auth-tabs">
        ${!initialized ? `<button class="auth-tab active" id="tab-setup" onclick="showAuthTab('setup')">Setup Wizard</button>` : ''}
        <button class="auth-tab ${initialized?'active':''}" id="tab-admin" onclick="showAuthTab('admin')">Admin Login</button>
        <button class="auth-tab" id="tab-employee" onclick="showAuthTab('employee')">Employee Portal</button>
      </div>
      <div class="auth-body" id="auth-body">
        ${!initialized ? renderSetupForm() : renderLoginForm('admin')}
      </div>
      <div class="auth-footer">
        Vanilla JS + HTML5 + CSS3 &bull; Browser localStorage &bull; Zero Backend Dependencies<br>
        HCM Lite v1.0 &bull; Client Storage Sandbox
      </div>
    </div>
  </div>`;
}

function showAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
  const body = document.getElementById('auth-body');
  if (tab === 'setup') body.innerHTML = renderSetupForm();
  else body.innerHTML = renderLoginForm(tab);
}

function renderSetupForm() {
  return `
  <div class="info-banner">
    ${ICONS.info}
    <p><strong>System Initialization</strong><br>No company configuration detected. Create your organization profile and Admin account to initialize the system.</p>
  </div>
  <form id="setup-form" onsubmit="handleSetup(event)" novalidate>
    <div class="form-group" id="fg-company">
      <label class="form-label" for="setup-company">Company Name <span class="req">*</span></label>
      <input class="form-control" id="setup-company" type="text" placeholder="e.g., Acme Global Technologies" required>
      <div class="form-error-msg">Company name is required.</div>
    </div>
    <div class="form-row">
      <div class="form-group" id="fg-adminname">
        <label class="form-label" for="setup-name">Admin Full Name <span class="req">*</span></label>
        <input class="form-control" id="setup-name" type="text" placeholder="Full Name" required>
        <div class="form-error-msg">Full name is required.</div>
      </div>
      <div class="form-group" id="fg-adminemail">
        <label class="form-label" for="setup-email">Work Email <span class="req">*</span></label>
        <input class="form-control" id="setup-email" type="email" placeholder="admin@company.com" required>
        <div class="form-error-msg">Valid email required.</div>
      </div>
    </div>
    <div class="form-group" id="fg-pw">
      <label class="form-label" for="setup-pw">Password <span class="req">*</span></label>
      <div class="input-password-wrap">
        <input class="form-control" id="setup-pw" type="password" placeholder="Min 8 characters" oninput="updatePwStrength(this.value)" required>
        <button type="button" class="btn-toggle-pw" onclick="togglePw('setup-pw',this)">${ICONS.eye}</button>
      </div>
      <div class="pw-strength">
        <div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-bar"></div></div>
        <div class="pw-requirements">
          <span class="pw-req" id="req-len">Min 8 chars</span>
          <span class="pw-req" id="req-num">1 Number</span>
          <span class="pw-req" id="req-upper">1 Uppercase</span>
        </div>
      </div>
      <div class="form-error-msg">Password must be min 8 chars with 1 number and 1 uppercase.</div>
    </div>
    <div class="form-group" id="fg-confirm">
      <label class="form-label" for="setup-confirm">Confirm Password <span class="req">*</span></label>
      <div class="input-password-wrap">
        <input class="form-control" id="setup-confirm" type="password" required>
        <button type="button" class="btn-toggle-pw" onclick="togglePw('setup-confirm',this)">${ICONS.eye}</button>
      </div>
      <div class="form-error-msg">Passwords do not match.</div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:8px">
      ${ICONS.lock} Initialize Company &amp; Create Admin
    </button>
  </form>`;
}

function renderLoginForm(role) {
  return `
  <form id="login-form" onsubmit="handleLogin(event,'${role}')" novalidate>
    <div class="form-group" id="fg-le">
      <label class="form-label" for="login-email">${role === 'admin' ? 'Email Address' : 'Email Address or Employee ID'} <span class="req">*</span></label>
      <input class="form-control" id="login-email" type="${role === 'admin' ? 'email' : 'text'}" placeholder="${role === 'admin' ? 'admin@company.com' : 'employee@company.com or EMP-001'}" required autocomplete="username">
      <div class="form-error-msg" id="login-err">Invalid email or password. Please try again.</div>
    </div>
    <div class="form-group" id="fg-lp">
      <label class="form-label" for="login-pw">Password <span class="req">*</span></label>
      <div class="input-password-wrap">
        <input class="form-control" id="login-pw" type="password" required autocomplete="current-password" placeholder="Enter your password">
        <button type="button" class="btn-toggle-pw" onclick="togglePw('login-pw',this)">${ICONS.eye}</button>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:8px">
      ${ICONS.lock} Sign In as ${role === 'admin' ? 'Administrator' : 'Employee'}
    </button>
  </form>`;
}

function updatePwStrength(pw, barId = 'pw-bar', reqPrefix = 'req-') {
  const { score, has } = checkPasswordStrength(pw);
  const bar = document.getElementById(barId);
  if (bar) {
    const pct = [0, 25, 50, 75, 100][score];
    bar.style.width = pct + '%';
    bar.className = 'pw-strength-fill' + (score >= 4 ? ' strong' : score === 3 ? ' good' : score >= 2 ? ' fair' : '');
  }
  const setReq = (id, met) => {
    const el = document.getElementById(reqPrefix + id);
    if (el) el.className = 'pw-req' + (met ? ' met' : '');
  };
  setReq('len', has.len);
  setReq('num', has.num);
  setReq('upper', has.upper);
}

function togglePw(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  if (btn) btn.innerHTML = isHidden ? ICONS.eyeoff : ICONS.eye;
}

function handleSetup(e) {
  e.preventDefault();
  let valid = true;
  const setErr = (id, show) => { const fg = document.getElementById('fg-' + id); if (fg) fg.classList.toggle('has-error', show); };
  const company = (document.getElementById('setup-company')?.value || '').trim();
  const name    = (document.getElementById('setup-name')?.value || '').trim();
  const email   = (document.getElementById('setup-email')?.value || '').trim().toLowerCase();
  const pw      = document.getElementById('setup-pw')?.value || '';
  const confirm = document.getElementById('setup-confirm')?.value || '';

  if (!company) { setErr('company', true); valid = false; } else setErr('company', false);
  if (!name)    { setErr('adminname', true); valid = false; } else setErr('adminname', false);
  if (!email || !/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) { setErr('adminemail', true); valid = false; } else setErr('adminemail', false);
  const { has } = checkPasswordStrength(pw);
  if (!has.len || !has.num || !has.upper) { setErr('pw', true); valid = false; } else setErr('pw', false);
  if (pw !== confirm) { setErr('confirm', true); valid = false; } else setErr('confirm', false);
  if (!valid) return;

  const adminUser = {
    id: genId('usr_'),
    role: 'admin',
    name,
    email,
    passwordHash: hashPassword(pw),
    createdAt: new Date().toISOString(),
    employeeId: null
  };
  lsSet(LS_KEYS.COMPANY, { name: company, createdAt: new Date().toISOString() });
  saveUsers([adminUser]);
  lsSet(LS_KEYS.INITIALIZED, true);
  toast('success', 'Company initialized!', `Welcome, ${name}. Please sign in.`);
  setTimeout(() => {
    renderAuthScreen();
    showAuthTab('admin');
  }, 800);
}

function handleLogin(e, role) {
  e.preventDefault();
  const input = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
  const pw    = document.getElementById('login-pw')?.value || '';
  const fgLe  = document.getElementById('fg-le');
  const errEl = document.getElementById('login-err');

  const showErr = (msg) => {
    if (fgLe) fgLe.classList.add('has-error');
    if (errEl) {
      if (msg) errEl.textContent = msg;
      errEl.style.display = 'block';
    }
  };

  if (!input || !pw) {
    showErr('Please enter both your ' + (role === 'admin' ? 'email' : 'email or Employee ID') + ' and password.');
    return;
  }

  const users = getUsers();
  const employees = getEmployees();
  const hashed = hashPassword(pw);

  const user = users.find(u => {
    if (u.role !== role || u.disabled) return false;
    if (u.passwordHash !== hashed) return false;
    if (u.email && u.email.toLowerCase() === input) return true;
    if (role === 'employee') {
      if (u.employeeCode && u.employeeCode.toLowerCase() === input) return true;
      if (u.employeeId && u.employeeId.toLowerCase() === input) return true;
      const linkedEmp = employees.find(emp => emp.id === u.employeeId || emp.employeeId === u.employeeId);
      if (linkedEmp && linkedEmp.employeeId && linkedEmp.employeeId.toLowerCase() === input) return true;
    }
    return false;
  });

  if (!user) {
    showErr('Invalid credentials or account disabled. Please try again.');
    return;
  }

  let emp = null;
  if (role === 'employee') {
    emp = employees.find(e => e.id === user.employeeId || (e.employeeId && e.employeeId === user.employeeId)) || null;
    if (!emp) {
      showErr('No active employee profile linked to this account. Please contact administrator.');
      return;
    }
    if (emp.status !== 'active' || user.disabled) {
      showErr('This employee account has been deactivated. Please contact your administrator.');
      return;
    }
  }

  sessSet(SESSION_KEY, {
    userId: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    employeeId: user.employeeId || null
  });

  STATE.currentUser = { ...user };
  STATE.currentEmployee = emp;
  navigate(role === 'admin' ? 'dashboard' : 'emp-dashboard');
}

function logout() {
  sessClear();
  resetHelperHistory();
  STATE.currentUser = null;
  STATE.currentEmployee = null;
  STATE.currentPage = null;
  renderAuthScreen();
}

﻿/* SECTION 8: SHELL */
function renderShell() {
  const app=document.getElementById('app');
  const role=STATE.currentUser.role; const user=STATE.currentUser; const company=getCompany();
  const adminNav=[
    {page:'dashboard',label:'Overview',icon:ICONS.dashboard},
    {page:'employees',label:'Employees',icon:ICONS.employees},
    {page:'attendance',label:'Attendance',icon:ICONS.attendance},
    {page:'leaves',label:'Leave Management',icon:ICONS.leaves},
    {page:'payslips',label:'Monthly Payslips',icon:ICONS.payslip},
    {page:'announcements',label:'Announcements',icon:ICONS.announce},
    {page:'settings',label:'Company Settings',icon:ICONS.settings},
  ];
  const empNav=[
    {page:'emp-dashboard',label:'My Dashboard',icon:ICONS.dashboard},
    {page:'emp-attendance',label:'Attendance',icon:ICONS.attendance},
    {page:'emp-leaves',label:'Leave Requests',icon:ICONS.leaves},
    {page:'emp-payslips',label:'My Payslips',icon:ICONS.payslip},
    {page:'emp-announcements',label:'Announcements',icon:ICONS.announce},
    {page:'emp-profile',label:'My Profile',icon:ICONS.user},
  ];
  const navItems=role==='admin'?adminNav:empNav;
  const navHtml=navItems.map(n=>`<button class="nav-item ${STATE.currentPage===n.page?'active':''}" onclick="navigate('${n.page}')">${n.icon} ${escHtml(n.label)}</button>`).join('');
  const switchBtn=role==='admin'?`<div class="nav-divider"></div><button class="nav-item" onclick="navigate('emp-dashboard')" style="color:rgba(255,255,255,.55)">${ICONS.portal} Switch to Portal</button>`:'';
  const breadMap={'dashboard':'Overview','employees':'Employee Management','attendance':'Attendance',
    'leaves':'Leave Management','payslips':'Monthly Payslips','announcements':'Announcements','settings':'Company Settings',
    'emp-dashboard':'My Dashboard','emp-attendance':'My Attendance','emp-leaves':'Leave Requests',
    'emp-payslips':'My Payslips','emp-announcements':'Announcements','emp-profile':'My Profile'};
  app.innerHTML=`<div class="app-shell">
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div>
        <div class="logo-text"><strong>HCM<span>Lite</span></strong><small>${escHtml(company.name||'Enterprise Suite')}</small></div>
      </div>
      <div class="sidebar-section-label">${role==='admin'?'Admin Modules':'Employee Portal'}</div>
      <nav class="sidebar-nav">${navHtml}${switchBtn}</nav>
      <div class="sidebar-footer">
        <div class="version-tag"><span><span class="version-dot"></span>Local Data Mode</span><span>v1.0</span></div>
        <button class="btn-signout" onclick="logout()">${ICONS.logout} Sign Out</button>
      </div>
    </nav>
    <div class="main-area">
      <header class="topbar">
        <button class="hamburger" id="hamburger-btn" onclick="toggleSidebar()">${ICONS.menu}</button>
        <div class="topbar-breadcrumb"><span>Portal</span><span class="crumb-sep">&rsaquo;</span><span class="crumb-active">${escHtml(breadMap[STATE.currentPage]||STATE.currentPage)}</span></div>
        <div class="topbar-datetime" id="topbar-clock">${ICONS.clock} Loading...</div>
        <div class="topbar-user">
          <div class="topbar-avatar">${initials(user.name)}</div>
          <div class="topbar-user-info"><div class="u-name">${escHtml(user.name)}</div><div class="u-role">${role==='admin'?'Administrator':'Employee'}</div></div>
        </div>
      </header>
      <main class="page-content" id="page-content"><div class="empty-state"><p>Loading...</p></div></main>
    </div>
  </div>`;
  startClock();
}
function startClock() {
  const el=document.getElementById('topbar-clock'); if(!el) return;
  const update=()=>{
    const now=new Date();
    const d=now.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
    const t=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    if(el) el.innerHTML=`${ICONS.clock} ${d} &bull; ${t}`;
  };
  update(); clearInterval(window._clockInterval); window._clockInterval=setInterval(update,10000);
}
function toggleSidebar() {
  const sb=document.getElementById('sidebar'); const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.toggle('mobile-open'); if(ov) ov.classList.toggle('open');
}
function closeSidebar() {
  const sb=document.getElementById('sidebar'); const ov=document.getElementById('sidebar-overlay');
  if(sb) sb.classList.remove('mobile-open'); if(ov) ov.classList.remove('open');
}
document.addEventListener('DOMContentLoaded',()=>{
  const ov=document.getElementById('sidebar-overlay');
  if(ov) ov.addEventListener('click',closeSidebar);
});


﻿/* SECTION 9: ADMIN DASHBOARD */
function renderAdminDashboard() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content=document.getElementById('page-content');
  const employees=getEmployees().filter(e=>e.status==='active');
  const allEmps=getEmployees(); const today=todayStr();
  const attendance=getAttendance(); const todayAtt=attendance.filter(a=>a.date===today);
  const presentToday=todayAtt.filter(a=>['present','late','half-day'].includes(a.status) && employees.some(e=>e.id===a.employeeId)).length;
  const leaves=getLeaves(); const pendingLeaves=leaves.filter(l=>l.status==='pending').length;
  const payslips=getPayslips(); const company=getCompany(); const settings=getSettings();
  const paidSlips=payslips.filter(p=>p.status==='paid');
  const totalPayrollDisbursed=paidSlips.reduce((sum,p)=>sum+(Number(p.netSalary)||0),0);
  const deptMap={};
  employees.forEach(e=>{deptMap[e.department]=(deptMap[e.department]||0)+1;});
  const depts=Object.entries(deptMap).sort((a,b)=>b[1]-a[1]);
  const maxDept=depts.length?depts[0][1]:1;
  const deptHtml=depts.length?depts.map(([dept,cnt])=>`<div class="dept-row"><span class="dept-name">${escHtml(dept)}</span><div class="dept-bar-wrap"><div class="dept-bar-fill" style="width:${Math.round(cnt/maxDept*100)}%"></div></div><span class="dept-count">${cnt}</span></div>`).join(''):'<p class="text-muted" style="font-size:13px;padding:12px 0">No departments yet.</p>';
  const recentAtt=todayAtt.map(a=>{
    const emp=allEmps.find(e=>e.id===a.employeeId); if(!emp) return '';
    const bc=a.status==='present'?'badge-success':a.status==='late'?'badge-warn':'badge-error';
    return `<tr><td><div style="display:flex;align-items:center;gap:8px"><div class="avatar-initials" style="width:28px;height:28px;font-size:10px">${initials(emp.name)}</div>${escHtml(emp.name)}</div></td><td>${escHtml(emp.department||'—')}</td><td>${fmtTime(a.checkIn)}</td><td>${fmtTime(a.checkOut)}</td><td><span class="badge ${bc}">${a.status}</span></td></tr>`;
  }).join('');
  content.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><h1 class="page-title">Organization Overview</h1><p class="page-subtitle">Real-time workforce attendance, leave oversight and announcements.</p></div>
    <div class="page-header-actions">
      <button class="btn btn-secondary" onclick="navigate('employees')">${ICONS.employees} Manage Employees</button>
      <button class="btn btn-primary" onclick="navigate('employees')">${ICONS.plus} Add Employee</button>
    </div>
  </div>
  <div class="stat-grid">
    <div class="stat-card"><div class="stat-icon">${ICONS.employees}</div><div class="stat-label">Total Active Employees</div><div class="stat-value tabular">${employees.length}</div><div class="stat-sub">${allEmps.filter(e=>e.status!=='active').length} deactivated</div></div>
    <div class="stat-card"><div class="stat-icon">${ICONS.attendance}</div><div class="stat-label">Today's Attendance</div><div class="stat-value tabular">${presentToday}<span style="font-size:18px;color:var(--color-text-muted)"> / ${employees.length}</span></div><div class="stat-sub">${employees.length?Math.round(presentToday/employees.length*100):0}% present</div></div>
    <div class="stat-card"><div class="stat-icon">${ICONS.leaves}</div><div class="stat-label">Pending Leave Requests</div><div class="stat-value tabular">${pendingLeaves}</div><div class="stat-sub">${pendingLeaves?'Requires review':'All reviewed'}</div></div>
    <div class="stat-card"><div class="stat-icon">${ICONS.payslip}</div><div class="stat-label">Total Payroll Disbursed</div><div class="stat-value tabular">${fmtMoney(totalPayrollDisbursed, settings.currency)}</div><div class="stat-sub">${paidSlips.length} paid (${payslips.length - paidSlips.length} draft pending)</div></div>
  </div>
  <div class="dash-grid">
    <div>
      <div class="card section-gap">
        <div class="card-header"><h3>Today's Live Attendance Stream</h3><span class="live-dot">Live</span></div>
        <div class="table-responsive"><table class="data-table"><thead><tr><th>Employee</th><th>Department</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
          <tbody>${recentAtt||`<tr><td colspan="5"><div class="empty-state" style="padding:32px"><div class="empty-icon">${ICONS.attendance}</div><h3>No Attendance Today</h3><p>Employees have not checked in yet.</p></div></td></tr>`}</tbody>
        </table></div>
        <div class="card-footer"><span>${todayAtt.length} logged today</span><button class="btn btn-ghost btn-sm" onclick="navigate('attendance')">View All &rarr;</button></div>
      </div>
      <div class="card section-gap">
        <div class="card-header"><h3>Department Breakdown</h3><span class="badge badge-draft">${depts.length} Depts</span></div>
        <div class="card-body">${deptHtml}</div>
      </div>
    </div>
    <div>
      <div class="card section-gap">
        <div class="card-header"><h3>Pending Leave Requests</h3><button class="btn btn-ghost btn-sm" onclick="navigate('leaves')">View All &rarr;</button></div>
        <div class="card-body" id="dash-pending-leaves">${renderPendingLeavesWidget()}</div>
      </div>
      <div class="card section-gap">
        <div class="card-header"><h3>${ICONS.announce} Broadcast Announcement</h3></div>
        <div class="card-body">
          <form onsubmit="quickAnnounce(event)" novalidate>
            <div class="form-group"><label class="form-label" for="quick-ann-title">Title</label><input class="form-control" id="quick-ann-title" placeholder="Announcement title" required></div>
            <div class="form-group"><label class="form-label" for="quick-ann-body">Message</label><textarea class="form-control" id="quick-ann-body" rows="3" placeholder="Draft message..." required></textarea></div>
            <button type="submit" class="btn btn-primary w-full" style="justify-content:center">${ICONS.announce} Publish</button>
          </form>
        </div>
      </div>
      <div id="dash-helper-widget">${renderHelperWidget()}</div>
    </div>
  </div>`;
}
function renderPendingLeavesWidget() {
  const leaves=getLeaves().filter(l=>l.status==='pending'); const employees=getEmployees();
  if(!leaves.length) return '<p class="text-muted" style="font-size:13px">No pending requests. All reviewed.</p>';
  return leaves.slice(0,4).map(l=>{
    const emp=employees.find(e=>e.id===l.employeeId);
    return `<div style="padding:10px 0;border-bottom:1px solid var(--color-border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-weight:600;font-size:13px">${escHtml(emp?.name||'Unknown')}</span><span class="badge badge-warn">Pending</span></div>
      <div style="font-size:12px;color:var(--color-text-muted)">${escHtml(l.leaveType)} &bull; ${fmtDate(l.startDate)} &ndash; ${fmtDate(l.endDate)}</div>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button class="btn btn-accent btn-sm" onclick="quickLeaveAction('${l.id}','approved')">${ICONS.check} Approve</button>
        <button class="btn btn-danger btn-sm" onclick="quickLeaveAction('${l.id}','rejected')">${ICONS.x} Reject</button>
      </div></div>`;
  }).join('')+(leaves.length>4?`<p class="text-muted" style="font-size:12px;margin-top:8px">+${leaves.length-4} more</p>`:'');
}
function quickLeaveAction(id,status) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can approve or reject leaves.');
    return;
  }
  const leaves=getLeaves(); const idx=leaves.findIndex(l=>l.id===id); if(idx===-1) return;
  leaves[idx].status=status; leaves[idx].reviewedAt=new Date().toISOString(); leaves[idx].reviewedBy=STATE.currentUser.name;
  saveLeaves(leaves); toast('success',`Leave ${status}`,'');
  const w=document.getElementById('dash-pending-leaves'); if(w) w.innerHTML=renderPendingLeavesWidget();
}
function quickAnnounce(e) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can broadcast announcements.');
    return;
  }
  const title=document.getElementById('quick-ann-title').value.trim();
  const body=document.getElementById('quick-ann-body').value.trim();
  if(!title||!body){toast('warn','Missing fields','Title and message required.');return;}
  const anns=getAnnouncements();
  anns.unshift({id:genId('ann_'),title,body,category:'General',createdAt:new Date().toISOString(),author:STATE.currentUser.name});
  saveAnnouncements(anns);
  document.getElementById('quick-ann-title').value=''; document.getElementById('quick-ann-body').value='';
  toast('success','Announcement published!','');
}


/* SECTION: SMART HELPER (LOCAL RULE-BASED HR ASSISTANT) */
const _HELPER_INITIAL_MSG = {
  sender: 'ai',
  text: 'Hello! I am your local HR Assistant. Ask me about employee headcount, today\'s attendance, pending leaves, company policy, or shortcut keys.'
};
let _helperHistoryByUser = {};

function getHelperHistory() {
  const uid = STATE.currentUser?.id || 'guest';
  if (!_helperHistoryByUser[uid]) {
    _helperHistoryByUser[uid] = [{ ..._HELPER_INITIAL_MSG }];
  }
  return _helperHistoryByUser[uid];
}

function resetHelperHistory(uid) {
  if (uid) {
    delete _helperHistoryByUser[uid];
  } else {
    _helperHistoryByUser = {};
  }
}

function renderHelperWidget(isEmp = false) {
  const isEmployee = STATE.currentUser?.role === 'employee';
  const history = getHelperHistory();
  const msgs = history.map(m => `<div class="helper-msg ${m.sender}"><p>${escHtml(m.text)}</p></div>`).join('');
  const quickChips = isEmployee ? [
    'Leave balance', 'Work hours', 'How to check in', 'View my payslip'
  ] : [
    'Employee count', "Today's attendance", 'Pending leaves', 'Payroll total', 'Work hours'
  ];
  const chipsHtml = quickChips.map(c => `<button type="button" class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;border:1px solid var(--color-border);background:var(--color-surface);border-radius:var(--radius-full)" onclick="handleHelperChip('${c}', ${isEmployee})">${escHtml(c)}</button>`).join('');

  return `<div class="helper-widget">
    <div class="helper-header">
      <h3 style="display:flex;align-items:center;gap:6px">${ICONS.robot} HR Smart Assistant</h3>
      <span class="helper-badge">Offline Helper</span>
    </div>
    <div class="helper-messages" id="helper-messages-container">${msgs}</div>
    <div class="helper-chips-bar" style="padding:8px 14px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--color-border);background:var(--color-bg);">${chipsHtml}</div>
    <form class="helper-input-bar" onsubmit="handleHelperSubmit(event, ${isEmployee})" style="display:flex;padding:10px 14px;gap:8px;border-top:1px solid var(--color-border);">
      <input type="text" id="helper-input" class="form-control" placeholder="Ask a question..." autocomplete="off" style="flex:1;height:36px;font-size:13px">
      <button type="submit" class="btn btn-primary btn-sm" style="height:36px;padding:0 14px">${ICONS.send}</button>
    </form>
  </div>`;
}

function handleHelperChip(text, isEmp) {
  const input = document.getElementById('helper-input');
  if (input) input.value = text;
  processHelperQuery(text, isEmp);
}

function handleHelperSubmit(e, isEmp) {
  e.preventDefault();
  const input = document.getElementById('helper-input');
  if (!input) return;
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  processHelperQuery(q, isEmp);
}

function processHelperQuery(q, isEmp) {
  const isEmployee = STATE.currentUser?.role === 'employee';
  if (isEmployee) {
    const curEmp = getEmployees().find(e => e.id === STATE.currentEmployee?.id);
    if (!curEmp || curEmp.status !== 'active') {
      logout();
      toast('error', 'Account Inactive', 'Your employee account is not active.');
      return;
    }
  }

  const history = getHelperHistory();
  history.push({ sender: 'user', text: q });
  const lower = q.toLowerCase();
  let reply = '';

  const emps = getEmployees().filter(e => e.status === 'active');
  const allEmps = getEmployees();
  const att = getAttendance();
  const leaves = getLeaves();
  const payslips = getPayslips();
  const settings = getSettings();
  const today = todayStr();
  const todayAtt = att.filter(a => a.date === today && emps.some(e => e.id === a.employeeId));

  if (lower.includes('count') || lower.includes('headcount') || lower.includes('employee') || lower.includes('staff')) {
    if (isEmployee) {
      reply = `Our company currently has ${emps.length} active employee(s) across departments.`;
    } else {
      reply = `We have ${emps.length} active employee(s) (plus ${allEmps.filter(e => e.status !== 'active').length} deactivated). You can manage them in Employee Management.`;
    }
  } else if (lower.includes('attendance') || lower.includes('check in') || lower.includes('present') || lower.includes('absent')) {
    if (isEmployee) {
      const myId = STATE.currentEmployee?.id;
      const myRec = att.find(a => a.date === today && a.employeeId === myId);
      if (!myRec) {
        reply = "You haven't checked in yet today. Use the Check In button on your dashboard.";
      } else {
        reply = `Today you checked in at ${myRec.checkIn || '—'}${myRec.checkOut ? ' and checked out at ' + myRec.checkOut : ' (still active)'}. Status: ${myRec.status}.`;
      }
    } else {
      const presentCount = todayAtt.filter(a => ['present','late','half-day'].includes(a.status)).length;
      reply = `Today (${today}), ${presentCount} of ${emps.length} active employees have logged attendance.`;
    }
  } else if (lower.includes('leave') || lower.includes('vacation') || lower.includes('off')) {
    if (isEmployee) {
      const myId = STATE.currentEmployee?.id;
      const myLeaves = leaves.filter(l => l.employeeId === myId);
      const pending = myLeaves.filter(l => l.status === 'pending').length;
      const approved = myLeaves.filter(l => l.status === 'approved').length;
      reply = `You have ${pending} pending leave request(s) and ${approved} approved request(s). Company annual quota is ${settings.annualLeaveQuota || 20} days.`;
    } else {
      const pending = leaves.filter(l => l.status === 'pending').length;
      reply = `There are currently ${pending} pending leave request(s) awaiting your review in Leave Management.`;
    }
  } else if (lower.includes('payroll') || lower.includes('payslip') || lower.includes('salary')) {
    if (isEmployee) {
      const myId = STATE.currentEmployee?.id;
      const mySlips = payslips.filter(p => p.employeeId === myId && p.status !== 'draft');
      reply = `You have ${mySlips.length} issued payslip(s) on file. Go to 'My Payslips' to view detailed breakdowns.`;
    } else {
      const paidSlips = payslips.filter(p => p.status === 'paid');
      const totalNet = paidSlips.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
      reply = `Total ${paidSlips.length} payslip(s) disbursed, totaling ${fmtMoney(totalNet, settings.currency)} (${payslips.length - paidSlips.length} draft pending).`;
    }
  } else if (lower.includes('hour') || lower.includes('time') || lower.includes('policy') || lower.includes('start') || lower.includes('schedule')) {
    reply = `Standard working hours: ${settings.workStart || '09:00'} to ${settings.workEnd || '17:00'} (Grace period: ${settings.graceMinutes || 15} mins). Working days: Monday - Friday.`;
  } else if (lower.includes('shortcut') || lower.includes('navigation') || lower.includes('menu')) {
    reply = isEmployee
      ? "Employee modules: My Dashboard, Attendance, Leave Requests, My Payslips, Announcements, My Profile."
      : "Admin modules: Overview, Employees, Attendance, Leave Management, Monthly Payslips, Announcements, Company Settings.";
  } else {
    reply = "I can answer questions regarding headcount, attendance, leaves, payroll, company hours, and navigation.";
  }

  history.push({ sender: 'ai', text: reply });
  if (history.length > 20) history.shift();

  const container = document.getElementById('helper-messages-container');
  if (container) {
    container.innerHTML = history.map(m => `<div class="helper-msg ${m.sender}"><p>${escHtml(m.text)}</p></div>`).join('');
    container.scrollTop = container.scrollHeight;
  }
}


﻿/* SECTION 10: EMPLOYEE MANAGEMENT */
let _empSearch='',_empDeptFilter='all',_empStatusFilter='all',_empPage=0;
let _aeLoginEmailTouched = false;
const EMP_PAGE_SIZE=10;

function syncAddEmpLoginEmail(val) {
  const loginInput = document.getElementById('ae-login-email');
  if (loginInput && !_aeLoginEmailTouched) {
    loginInput.value = val;
  }
}

function toggleAddEmpAccountFields(checked) {
  const fields = document.getElementById('ae-account-fields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
  if (checked) {
    const empEmail = document.getElementById('ae-email')?.value || '';
    const loginInput = document.getElementById('ae-login-email');
    if (loginInput && !loginInput.value) {
      loginInput.value = empEmail;
    }
  }
}

function renderEmployees() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content=document.getElementById('page-content');
  const employees=getEmployees();
  const departments=[...new Set(employees.map(e=>e.department).filter(Boolean))];
  content.innerHTML=`
  <div class="page-header">
    <div class="page-header-left"><h1 class="page-title">Employee Management</h1><p class="page-subtitle">Manage company roster, credentials and employment details.</p></div>
    <div class="page-header-actions"><button class="btn btn-primary" onclick="openAddEmployeeModal()">${ICONS.plus} Add New Employee</button></div>
  </div>
  <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value tabular">${employees.filter(e=>e.status==='active').length}</div></div>
    <div class="stat-card"><div class="stat-label">Departments</div><div class="stat-value tabular">${departments.length}</div></div>
    <div class="stat-card"><div class="stat-label">Total Records</div><div class="stat-value tabular">${employees.length}</div></div>
  </div>
  <div class="table-wrap">
    <div class="table-toolbar">
      <div class="search-input-wrap" style="flex:1;min-width:180px"><span class="search-icon">${ICONS.search}</span>
        <input class="form-control" id="emp-search" placeholder="Search name, email or ID..." value="${escHtml(_empSearch)}" oninput="filterEmployees(this.value)"></div>
      <select class="form-control" style="width:auto;min-width:150px" onchange="filterEmployeesByDept(this.value)">
        <option value="all">All Departments</option>
        ${departments.map(d=>`<option value="${escHtml(d)}" ${_empDeptFilter===d?'selected':''}>${escHtml(d)}</option>`).join('')}
      </select>
      <select class="form-control" style="width:auto" onchange="filterEmployeesByStatus(this.value)">
        <option value="all">All Statuses</option>
        <option value="active" ${_empStatusFilter==='active'?'selected':''}>Active</option>
        <option value="inactive" ${_empStatusFilter==='inactive'?'selected':''}>Inactive</option>
      </select>
    </div>
    <div class="table-responsive"><table class="data-table">
      <thead><tr><th>ID</th><th>Name &amp; Email</th><th>Department</th><th>Designation</th><th>Base Salary</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="emp-table-body"></tbody>
    </table></div>
    <div class="table-footer"><span id="emp-count-label">Loading...</span><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" id="emp-prev" onclick="empPrevPage()">Previous</button><button class="btn btn-secondary btn-sm" id="emp-next" onclick="empNextPage()">Next</button></div></div>
  </div>
  <div class="modal-overlay" id="modal-add-employee"><div class="modal modal-lg">
    <div class="modal-header"><h2>${ICONS.plus} Add New Employee</h2><button class="btn-modal-close" onclick="closeModal('modal-add-employee')">${ICONS.x}</button></div>
    <div class="modal-body"><form id="add-emp-form" onsubmit="handleAddEmployee(event)" novalidate>
      <div class="form-row">
        <div class="form-group" id="fg-ae-name"><label class="form-label" for="ae-name">Full Name <span class="req">*</span></label><input class="form-control" id="ae-name" required placeholder="Employee full name"><div class="form-error-msg">Full name is required.</div></div>
        <div class="form-group" id="fg-ae-email"><label class="form-label" for="ae-email">Email <span class="req">*</span></label><input class="form-control" id="ae-email" type="email" required placeholder="employee@company.com" oninput="syncAddEmpLoginEmail(this.value)"><div class="form-error-msg">Valid unique email required.</div></div>
      </div>
      <div class="form-row">
        <div class="form-group" id="fg-ae-dept"><label class="form-label" for="ae-dept">Department <span class="req">*</span></label><input class="form-control" id="ae-dept" required placeholder="e.g., Engineering" list="ae-dept-list"><datalist id="ae-dept-list">${departments.map(d=>`<option value="${escHtml(d)}">`).join('')}</datalist><div class="form-error-msg">Department is required.</div></div>
        <div class="form-group" id="fg-ae-desig"><label class="form-label" for="ae-desig">Designation <span class="req">*</span></label><input class="form-control" id="ae-desig" required placeholder="e.g., Software Engineer"><div class="form-error-msg">Designation is required.</div></div>
      </div>
      <div class="form-row">
        <div class="form-group" id="fg-ae-join"><label class="form-label" for="ae-join">Joining Date <span class="req">*</span></label><input class="form-control" id="ae-join" type="date" required><div class="form-error-msg">Joining date is required.</div></div>
        <div class="form-group" id="fg-ae-salary"><label class="form-label" for="ae-salary">Base Monthly Salary <span class="req">*</span></label><input class="form-control" id="ae-salary" type="number" min="0" required placeholder="e.g., 50000"><div class="form-error-msg">Valid amount required.</div></div>
      </div>
      <div class="form-group"><label class="form-label" for="ae-phone">Phone</label><input class="form-control" id="ae-phone" placeholder="+92 300 0000000"></div>

      <!-- Account Credentials Section -->
      <div class="account-creation-box">
        <label style="font-weight:600;font-size:13.5px;cursor:pointer;display:flex;align-items:center;gap:10px;user-select:none">
          <input type="checkbox" id="ae-create-account" onchange="toggleAddEmpAccountFields(this.checked)" checked style="width:16px;height:16px;accent-color:var(--color-accent);cursor:pointer">
          <span style="display:flex;align-items:center;gap:6px">${ICONS.lock} Create Portal Login Credentials for this Employee</span>
        </label>
        <p style="font-size:12px;color:var(--color-text-muted);margin:4px 0 0 26px">Allows the employee to sign in to the Employee Portal immediately.</p>
        
        <div id="ae-account-fields" style="display:block;margin-top:14px;padding-top:14px;border-top:1px dashed var(--color-border)">
          <div class="form-group" id="fg-ae-login-email">
            <label class="form-label" for="ae-login-email">Portal Login Email <span class="req">*</span></label>
            <input class="form-control" id="ae-login-email" type="email" placeholder="employee@company.com" oninput="_aeLoginEmailTouched=true">
            <div class="form-error-msg">Valid unique login email required.</div>
          </div>
          <div class="form-row">
            <div class="form-group" id="fg-ae-pw">
              <label class="form-label" for="ae-pw">Initial Password <span class="req">*</span></label>
              <div class="input-password-wrap">
                <input class="form-control" id="ae-pw" type="password" placeholder="Min 8 chars, 1 num, 1 upper" oninput="updatePwStrength(this.value, 'ae-pw-bar', 'ae-req-')">
                <button type="button" class="btn-toggle-pw" onclick="togglePw('ae-pw',this)">${ICONS.eye}</button>
              </div>
              <div class="pw-strength">
                <div class="pw-strength-bar"><div class="pw-strength-fill" id="ae-pw-bar"></div></div>
                <div class="pw-requirements">
                  <span class="pw-req" id="ae-req-len">Min 8 chars</span>
                  <span class="pw-req" id="ae-req-num">1 Number</span>
                  <span class="pw-req" id="ae-req-upper">1 Uppercase</span>
                </div>
              </div>
              <div class="form-error-msg">Password must be min 8 chars with 1 number and 1 uppercase.</div>
            </div>
            <div class="form-group" id="fg-ae-confirm">
              <label class="form-label" for="ae-confirm">Confirm Password <span class="req">*</span></label>
              <div class="input-password-wrap">
                <input class="form-control" id="ae-confirm" type="password" placeholder="Re-enter password">
                <button type="button" class="btn-toggle-pw" onclick="togglePw('ae-confirm',this)">${ICONS.eye}</button>
              </div>
              <div class="form-error-msg">Passwords do not match.</div>
            </div>
          </div>
        </div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-add-employee')">Cancel</button><button class="btn btn-primary" onclick="document.getElementById('add-emp-form').requestSubmit()">${ICONS.plus} Add Employee</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-edit-employee"><div class="modal modal-lg">
    <div class="modal-header"><h2>Edit Employee</h2><button class="btn-modal-close" onclick="closeModal('modal-edit-employee')">${ICONS.x}</button></div>
    <div class="modal-body" id="edit-emp-body"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-edit-employee')">Cancel</button><button class="btn btn-primary" onclick="document.getElementById('edit-emp-form')?.requestSubmit()">Save Changes</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-delete-employee"><div class="modal" style="max-width:420px">
    <div class="modal-header"><h2>Confirm Deactivation</h2><button class="btn-modal-close" onclick="closeModal('modal-delete-employee')">${ICONS.x}</button></div>
    <div class="modal-body text-center">
      <div class="confirm-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></div>
      <h3 style="margin-bottom:8px" id="del-emp-title">Deactivate Employee?</h3>
      <p id="del-emp-msg" style="font-size:13px;color:var(--color-text-muted)">Employee will be marked inactive.</p>
    </div>
    <div class="modal-footer" style="justify-content:center;gap:12px"><button class="btn btn-secondary" onclick="closeModal('modal-delete-employee')">Cancel</button><button class="btn btn-danger" id="del-emp-confirm-btn">Deactivate</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-create-account"><div class="modal">
    <div class="modal-header"><h2 id="create-acc-title">${ICONS.lock} Create Employee Login</h2><button class="btn-modal-close" onclick="closeModal('modal-create-account')">${ICONS.x}</button></div>
    <div class="modal-body" id="create-acc-body"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-create-account')">Cancel</button><button class="btn btn-primary" id="create-acc-submit-btn" onclick="document.getElementById('create-acc-form')?.requestSubmit()">Create Login</button></div>
  </div></div>`;
  _empPage=0; renderEmpTable();
}

function getFilteredEmployees() {
  let emps=getEmployees();
  if(_empSearch){const q=_empSearch.toLowerCase();emps=emps.filter(e=>e.name.toLowerCase().includes(q)||e.email.toLowerCase().includes(q)||(e.employeeId||'').toLowerCase().includes(q));}
  if(_empDeptFilter!=='all') emps=emps.filter(e=>e.department===_empDeptFilter);
  if(_empStatusFilter!=='all') emps=emps.filter(e=>e.status===_empStatusFilter);
  return emps;
}

function renderEmpTable() {
  const emps=getFilteredEmployees(); const start=_empPage*EMP_PAGE_SIZE; const page=emps.slice(start,start+EMP_PAGE_SIZE);
  const users=getUsers(); const settings=getSettings();
  const tbody=document.getElementById('emp-table-body'); if(!tbody) return;
  if(!page.length){
    tbody.innerHTML=`<tr><td colspan="8"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.employees}</div><h3>No Employees Registered</h3><p>Add the first employee to get started.</p><button class="btn btn-primary" onclick="openAddEmployeeModal()">${ICONS.plus} Add Employee</button></div></td></tr>`;
  } else {
    tbody.innerHTML=page.map(emp=>{
      const hasAcc=users.some(u=>(u.employeeId===emp.id || u.employeeId===emp.employeeId || (u.email && u.email.toLowerCase()===emp.email.toLowerCase())) && !u.disabled);
      const bc=emp.status==='active'?'badge-success':'badge-draft';
      return `<tr>
        <td><span class="badge badge-accent">${escHtml(emp.employeeId)}</span></td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar-initials" style="width:30px;height:30px;font-size:11px">${initials(emp.name)}</div><div><div style="font-weight:600">${escHtml(emp.name)}</div><div class="cell-sub">${escHtml(emp.email)}</div></div></div></td>
        <td>${escHtml(emp.department||'—')}</td>
        <td>${escHtml(emp.designation||'—')}</td>
        <td class="tabular">${fmtMoney(emp.salary,settings.currency)}</td>
        <td>${fmtDate(emp.joinDate)}</td>
        <td><span class="badge ${bc}">${emp.status}</span></td>
        <td><div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-secondary btn-sm btn-icon" title="Edit Employee" onclick="openEditEmployee('${emp.id}')">${ICONS.edit}</button>
          ${!hasAcc ? 
            `<button class="btn btn-accent btn-sm" onclick="openCreateAccount('${emp.id}')" title="Create Login Account">${ICONS.lock} Create Login</button>` : 
            `<button class="btn btn-secondary btn-sm" onclick="openCreateAccount('${emp.id}')" title="Update / Reset Login Credentials" style="color:var(--color-teal);border-color:var(--color-teal)"><span class="badge badge-teal" style="margin-right:2px;padding:0 4px;font-size:10px">&#10003;</span> Reset Login</button>`
          }
          <button class="btn btn-danger btn-sm btn-icon" title="Deactivate" onclick="openDeleteEmployee('${emp.id}')">${ICONS.trash}</button>
        </div></td>
      </tr>`;
    }).join('');
  }
  const cl=document.getElementById('emp-count-label');
  if(cl) cl.textContent=`Showing ${emps.length?start+1:0}–${Math.min(start+EMP_PAGE_SIZE,emps.length)} of ${emps.length} entries`;
  const prev=document.getElementById('emp-prev'); const next=document.getElementById('emp-next');
  if(prev) prev.disabled=_empPage===0;
  if(next) next.disabled=start+EMP_PAGE_SIZE>=emps.length;
}

function filterEmployees(q){_empSearch=q;_empPage=0;renderEmpTable();}
function filterEmployeesByDept(v){_empDeptFilter=v;_empPage=0;renderEmpTable();}
function filterEmployeesByStatus(v){_empStatusFilter=v;_empPage=0;renderEmpTable();}
function empPrevPage(){if(_empPage>0){_empPage--;renderEmpTable();}}
function empNextPage(){const e=getFilteredEmployees();if((_empPage+1)*EMP_PAGE_SIZE<e.length){_empPage++;renderEmpTable();}}

function openAddEmployeeModal() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can add employees.');
    return;
  }
  const form = document.getElementById('add-emp-form');
  if (form) form.reset();
  const joinInput = document.getElementById('ae-join');
  if (joinInput) joinInput.value = todayStr();
  _aeLoginEmailTouched = false;
  const chk = document.getElementById('ae-create-account');
  if (chk) chk.checked = true;
  const accFields = document.getElementById('ae-account-fields');
  if (accFields) accFields.style.display = 'block';
  const pwBar = document.getElementById('ae-pw-bar');
  if (pwBar) pwBar.style.width = '0%';
  ['name','email','dept','desig','join','salary','login-email','pw','confirm'].forEach(id => {
    const fg = document.getElementById('fg-ae-' + id);
    if (fg) fg.classList.remove('has-error');
  });
  ['ae-req-len','ae-req-num','ae-req-upper'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('met');
  });
  openModal('modal-add-employee');
}

function handleAddEmployee(e) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can add employees.');
    return;
  }
  let valid = true;
  const setErr = (id, show, customMsg) => {
    const fg = document.getElementById('fg-ae-' + id);
    if (fg) {
      fg.classList.toggle('has-error', show);
      if (customMsg) {
        const msgEl = fg.querySelector('.form-error-msg');
        if (msgEl) msgEl.textContent = customMsg;
      }
    }
  };

  const name   = (document.getElementById('ae-name')?.value || '').trim();
  const email  = (document.getElementById('ae-email')?.value || '').trim().toLowerCase();
  const dept   = (document.getElementById('ae-dept')?.value || '').trim();
  const desig  = (document.getElementById('ae-desig')?.value || '').trim();
  const join   = (document.getElementById('ae-join')?.value || '').trim();
  const salary = (document.getElementById('ae-salary')?.value || '').trim();
  const phone  = (document.getElementById('ae-phone')?.value || '').trim();

  if (!name) { setErr('name', true); valid = false; } else setErr('name', false);

  const employees = getEmployees();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    setErr('email', true, 'Valid unique email required.');
    valid = false;
  } else if (employees.some(emp => emp.email && emp.email.toLowerCase() === email)) {
    setErr('email', true, 'An employee with this email already exists.');
    valid = false;
  } else {
    setErr('email', false);
  }

  if (!dept) { setErr('dept', true); valid = false; } else setErr('dept', false);
  if (!desig) { setErr('desig', true); valid = false; } else setErr('desig', false);
  if (!join) { setErr('join', true); valid = false; } else setErr('join', false);
  if (!salary || isNaN(salary) || Number(salary) < 0) { setErr('salary', true); valid = false; } else setErr('salary', false);

  const createAccount = document.getElementById('ae-create-account')?.checked;
  let loginEmail = '';
  let pw = '';
  const users = getUsers();

  if (createAccount) {
    loginEmail = (document.getElementById('ae-login-email')?.value || email).trim().toLowerCase();
    pw = document.getElementById('ae-pw')?.value || '';
    const confirm = document.getElementById('ae-confirm')?.value || '';

    if (!loginEmail || !emailRegex.test(loginEmail)) {
      setErr('login-email', true, 'Valid unique login email required.');
      valid = false;
    } else if (users.some(u => u.email && u.email.toLowerCase() === loginEmail)) {
      setErr('login-email', true, 'A login account with this email already exists.');
      valid = false;
    } else {
      setErr('login-email', false);
    }

    const { has } = checkPasswordStrength(pw);
    if (!has.len || !has.num || !has.upper) {
      setErr('pw', true);
      valid = false;
    } else {
      setErr('pw', false);
    }

    if (!confirm || pw !== confirm) {
      setErr('confirm', true);
      valid = false;
    } else {
      setErr('confirm', false);
    }
  }

  if (!valid) return;

  const newEmpCode = genEmpId(employees);
  const emp = {
    id: genId('emp_'),
    employeeId: newEmpCode,
    name,
    email,
    department: dept,
    designation: desig,
    joinDate: join,
    salary: Number(salary),
    phone,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  employees.push(emp);
  saveEmployees(employees);

  if (createAccount) {
    users.push({
      id: genId('usr_'),
      role: 'employee',
      name: emp.name,
      email: loginEmail,
      passwordHash: hashPassword(pw),
      employeeId: emp.id,
      employeeCode: emp.employeeId,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
  }

  closeModal('modal-add-employee');
  toast('success', 'Employee Added', createAccount ? `${name} (${emp.employeeId}) registered with portal credentials.` : `${name} (${emp.employeeId}) registered.`);
  renderEmployees();
}

function openEditEmployee(empId) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can edit employees.');
    return;
  }
  const emp=getEmployees().find(e=>e.id===empId); if(!emp) return;
  const departments=[...new Set(getEmployees().map(e=>e.department).filter(Boolean))];
  const body=document.getElementById('edit-emp-body');
  body.innerHTML=`<form id="edit-emp-form" onsubmit="handleEditEmployee(event,'${empId}')" novalidate>
    <div class="form-row">
      <div class="form-group" id="fg-ee-name"><label class="form-label">Full Name <span class="req">*</span></label><input class="form-control" id="ee-name" value="${escHtml(emp.name)}" required><div class="form-error-msg">Required.</div></div>
      <div class="form-group" id="fg-ee-email"><label class="form-label">Email <span class="req">*</span></label><input class="form-control" id="ee-email" type="email" value="${escHtml(emp.email)}" required><div class="form-error-msg">Valid unique email required.</div></div>
    </div>
    <div class="form-row">
      <div class="form-group" id="fg-ee-dept"><label class="form-label">Department <span class="req">*</span></label><input class="form-control" id="ee-dept" value="${escHtml(emp.department||'')}" required list="ee-dept-list"><datalist id="ee-dept-list">${departments.map(d=>`<option value="${escHtml(d)}">`).join('')}</datalist><div class="form-error-msg">Required.</div></div>
      <div class="form-group" id="fg-ee-desig"><label class="form-label">Designation <span class="req">*</span></label><input class="form-control" id="ee-desig" value="${escHtml(emp.designation||'')}" required><div class="form-error-msg">Required.</div></div>
    </div>
    <div class="form-row">
      <div class="form-group" id="fg-ee-salary"><label class="form-label">Base Salary <span class="req">*</span></label><input class="form-control" id="ee-salary" type="number" min="0" value="${emp.salary||0}" required><div class="form-error-msg">Required.</div></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="ee-status"><option value="active" ${emp.status==='active'?'selected':''}>Active</option><option value="inactive" ${emp.status==='inactive'?'selected':''}>Inactive</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="ee-phone" value="${escHtml(emp.phone||'')}"></div>
  </form>`;
  openModal('modal-edit-employee');
}

function handleEditEmployee(e,empId) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can edit employees.');
    return;
  }
  let valid=true;
  const setErr=(id,show)=>{const fg=document.getElementById('fg-ee-'+id);if(fg)fg.classList.toggle('has-error',show);};
  const name=document.getElementById('ee-name').value.trim();
  const email=document.getElementById('ee-email').value.trim().toLowerCase();
  const dept=document.getElementById('ee-dept').value.trim();
  const desig=document.getElementById('ee-desig').value.trim();
  const salary=document.getElementById('ee-salary').value;
  const status=document.getElementById('ee-status').value;
  const phone=document.getElementById('ee-phone').value.trim();
  if(!name){setErr('name',true);valid=false;}else setErr('name',false);
  const employees=getEmployees();
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||employees.some(emp=>emp.email===email&&emp.id!==empId)){setErr('email',true);valid=false;}else setErr('email',false);
  if(!dept){setErr('dept',true);valid=false;}else setErr('dept',false);
  if(!desig){setErr('desig',true);valid=false;}else setErr('desig',false);
  if(!salary||Number(salary)<0){setErr('salary',true);valid=false;}else setErr('salary',false);
  if(!valid) return;
  const idx=employees.findIndex(e=>e.id===empId); if(idx===-1) return;
  Object.assign(employees[idx],{name,email,department:dept,designation:desig,salary:Number(salary),status,phone});
  saveEmployees(employees);

  // Keep user record synchronized if employee details changed
  const users = getUsers();
  const uIdx = users.findIndex(u => u.employeeId === empId || u.employeeId === employees[idx].employeeId);
  if (uIdx !== -1) {
    users[uIdx].name = name;
    users[uIdx].employeeCode = employees[idx].employeeId;
    if (status === 'inactive') {
      users[uIdx].disabled = true;
    }
    saveUsers(users);
  }

  closeModal('modal-edit-employee'); toast('success','Employee updated','');
  renderEmployees();
}

function openDeleteEmployee(empId) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can deactivate employees.');
    return;
  }
  const emp=getEmployees().find(e=>e.id===empId); if(!emp) return;
  const title=document.getElementById('del-emp-title'); const btn=document.getElementById('del-emp-confirm-btn');
  if(title) title.textContent=`Deactivate ${emp.name}?`;
  if(btn) btn.onclick=()=>confirmDeleteEmployee(empId);
  openModal('modal-delete-employee');
}

function confirmDeleteEmployee(empId) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can deactivate employees.');
    return;
  }
  const employees=getEmployees(); const idx=employees.findIndex(e=>e.id===empId); if(idx===-1) return;
  employees[idx].status='inactive'; saveEmployees(employees);
  const users=getUsers(); const ui=users.findIndex(u=>u.employeeId===empId || u.employeeId===employees[idx].employeeId);
  if(ui!==-1){users[ui].disabled=true;saveUsers(users);}
  closeModal('modal-delete-employee'); toast('success','Employee deactivated','');
  renderEmployees();
}

function openCreateAccount(empId) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can manage login credentials.');
    return;
  }
  const emp = getEmployees().find(e => e.id === empId);
  if (!emp) return;
  if (emp.status !== 'active') {
    toast('warn', 'Employee Deactivated', 'Cannot create or modify credentials for a deactivated employee. Activate the employee first.');
    return;
  }

  const users = getUsers();
  const existingUser = users.find(u => u.employeeId === empId || u.employeeId === emp.employeeId);
  const isEdit = !!existingUser;

  const body = document.getElementById('create-acc-body');
  const modalTitle = document.getElementById('create-acc-title');
  const submitBtn = document.getElementById('create-acc-submit-btn');

  if (modalTitle) {
    modalTitle.innerHTML = `${ICONS.lock} ${isEdit ? 'Update / Reset Employee Login' : 'Create Employee Login'}`;
  }
  if (submitBtn) {
    submitBtn.textContent = isEdit ? 'Update Credentials' : 'Create Login';
  }

  body.innerHTML = `
    <div class="alert alert-info">
      ${ICONS.info}
      <div>
        <strong>${escHtml(emp.name)}</strong> (${escHtml(emp.employeeId)}) &bull; ${escHtml(emp.department || 'General')}
        <div style="font-size:12px;margin-top:2px">${isEdit ? 'Existing login found. You can update the sign-in email or assign a new password.' : 'Configure portal sign-in credentials for this employee.'}</div>
      </div>
    </div>
    <form id="create-acc-form" onsubmit="handleCreateAccount(event,'${empId}')" novalidate>
      <div class="form-group" id="fg-ca-email">
        <label class="form-label" for="ca-email">Login Email (Username) <span class="req">*</span></label>
        <input class="form-control" id="ca-email" type="email" value="${escHtml(existingUser ? existingUser.email : emp.email)}" required placeholder="employee@company.com">
        <div class="form-error-msg" id="ca-email-err">Valid unique email required.</div>
      </div>
      <div class="form-group" id="fg-ca-pw">
        <label class="form-label" for="ca-pw">${isEdit ? 'New Password' : 'Initial Password'} <span class="req">*</span></label>
        <div class="input-password-wrap">
          <input class="form-control" id="ca-pw" type="password" required placeholder="Min 8 chars, 1 number, 1 uppercase" oninput="updatePwStrength(this.value, 'ca-pw-bar', 'ca-req-')">
          <button type="button" class="btn-toggle-pw" onclick="togglePw('ca-pw',this)">${ICONS.eye}</button>
        </div>
        <div class="pw-strength">
          <div class="pw-strength-bar"><div class="pw-strength-fill" id="ca-pw-bar"></div></div>
          <div class="pw-requirements">
            <span class="pw-req" id="ca-req-len">Min 8 chars</span>
            <span class="pw-req" id="ca-req-num">1 Number</span>
            <span class="pw-req" id="ca-req-upper">1 Uppercase</span>
          </div>
        </div>
        <div class="form-error-msg">Must be 8+ chars with 1 number and 1 uppercase.</div>
      </div>
      <div class="form-group" id="fg-ca-confirm">
        <label class="form-label" for="ca-confirm">Confirm Password <span class="req">*</span></label>
        <div class="input-password-wrap">
          <input class="form-control" id="ca-confirm" type="password" required placeholder="Re-enter password">
          <button type="button" class="btn-toggle-pw" onclick="togglePw('ca-confirm',this)">${ICONS.eye}</button>
        </div>
        <div class="form-error-msg">Passwords do not match.</div>
      </div>
    </form>`;

  openModal('modal-create-account');
}

function handleCreateAccount(e, empId) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can manage login credentials.');
    return;
  }

  const emp = getEmployees().find(e => e.id === empId);
  if (!emp) return;
  if (emp.status !== 'active') {
    toast('error', 'Employee Deactivated', 'Cannot enable login credentials for a deactivated employee.');
    return;
  }

  const users = getUsers();
  const existingUserIndex = users.findIndex(u => u.employeeId === empId || u.employeeId === emp.employeeId);
  const existingUser = existingUserIndex !== -1 ? users[existingUserIndex] : null;

  const emailInput = document.getElementById('ca-email');
  const loginEmail = (emailInput?.value || '').trim().toLowerCase();
  const pw = document.getElementById('ca-pw')?.value || '';
  const confirm = document.getElementById('ca-confirm')?.value || '';

  let valid = true;
  const setErr = (id, show, customMsg) => {
    const fg = document.getElementById('fg-ca-' + id);
    if (fg) {
      fg.classList.toggle('has-error', show);
      if (customMsg) {
        const msgEl = fg.querySelector('.form-error-msg');
        if (msgEl) msgEl.textContent = customMsg;
      }
    }
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!loginEmail || !emailRegex.test(loginEmail)) {
    setErr('email', true, 'Valid email required.');
    valid = false;
  } else if (users.some(u => u.email && u.email.toLowerCase() === loginEmail && u.id !== existingUser?.id)) {
    setErr('email', true, 'This login email is already in use by another account.');
    valid = false;
  } else {
    setErr('email', false);
  }

  const { has } = checkPasswordStrength(pw);
  if (!has.len || !has.num || !has.upper) {
    setErr('pw', true);
    valid = false;
  } else {
    setErr('pw', false);
  }

  if (!confirm || pw !== confirm) {
    setErr('confirm', true);
    valid = false;
  } else {
    setErr('confirm', false);
  }

  if (!valid) return;

  if (existingUser) {
    users[existingUserIndex].email = loginEmail;
    users[existingUserIndex].passwordHash = hashPassword(pw);
    users[existingUserIndex].disabled = false;
    users[existingUserIndex].name = emp.name;
    users[existingUserIndex].employeeCode = emp.employeeId;
    users[existingUserIndex].updatedAt = new Date().toISOString();
    saveUsers(users);
    closeModal('modal-create-account');
    toast('success', 'Credentials Updated', `Login credentials for ${emp.name} have been updated.`);
  } else {
    users.push({
      id: genId('usr_'),
      role: 'employee',
      name: emp.name,
      email: loginEmail,
      passwordHash: hashPassword(pw),
      employeeId: emp.id,
      employeeCode: emp.employeeId,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    closeModal('modal-create-account');
    toast('success', 'Login Created', `${emp.name} can now sign in using ${loginEmail} or ${emp.employeeId}.`);
  }

  renderEmployees();
}

/* SECTION 11: ATTENDANCE MANAGEMENT (ADMIN) */
let _attDateFilter = todayStr();
let _attDeptFilter = 'all';

function renderAttendance() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content = document.getElementById('page-content');
  const allEmps = getEmployees().filter(e => e.status === 'active');
  const allAtt = getAttendance();
  const dateStr = _attDateFilter || todayStr();

  // Filter attendance for the chosen date
  const dayRecords = allAtt.filter(a => a.date === dateStr && allEmps.some(e => e.id === a.employeeId));
  const presentCount = dayRecords.filter(a => a.status === 'present').length;
  const lateCount = dayRecords.filter(a => a.status === 'late').length;
  const halfDayCount = dayRecords.filter(a => a.status === 'half-day').length;
  const absentCount = dayRecords.filter(a => a.status === 'absent').length;
  const totalAttended = presentCount + lateCount + halfDayCount;

  // Filter employees by department
  const filteredEmps = allEmps.filter(e => {
    if (_attDeptFilter !== 'all' && e.department !== _attDeptFilter) return false;
    return true;
  });

  const depts = [...new Set(allEmps.map(e => e.department).filter(Boolean))];

  // Rows for each employee
  const rows = filteredEmps.map(emp => {
    const rec = dayRecords.find(a => a.employeeId === emp.id);
    let statusBadge = '<span class="badge badge-draft">Not Logged</span>';
    let checkIn = '—';
    let checkOut = '—';
    let hoursStr = '—';

    if (rec) {
      if (rec.status === 'present') statusBadge = '<span class="badge badge-success">Present</span>';
      else if (rec.status === 'late') statusBadge = '<span class="badge badge-warn">Late</span>';
      else if (rec.status === 'half-day') statusBadge = '<span class="badge badge-draft">Half-day</span>';
      else if (rec.status === 'absent') statusBadge = '<span class="badge badge-error">Absent</span>';

      checkIn = fmtTime(rec.checkIn);
      checkOut = fmtTime(rec.checkOut);

      if (rec.checkIn && rec.checkOut) {
        const [inH, inM] = rec.checkIn.split(':').map(Number);
        const [outH, outM] = rec.checkOut.split(':').map(Number);
        let mins = (outH * 60 + outM) - (inH * 60 + inM);
        if (mins > 0) {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          hoursStr = `${h}h ${m}m`;
        }
      } else if (rec.checkIn && !rec.checkOut) {
        hoursStr = '<span class="text-muted">In Progress</span>';
      }
    }

    return `<tr>
      <td><strong>${escHtml(emp.employeeId || emp.id)}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar-initials" style="width:28px;height:28px;font-size:10px">${initials(emp.name)}</div>
          <div>
            <div style="font-weight:500">${escHtml(emp.name)}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${escHtml(emp.email)}</div>
          </div>
        </div>
      </td>
      <td>${escHtml(emp.department || '—')}</td>
      <td>${statusBadge}</td>
      <td>${checkIn}</td>
      <td>${checkOut}</td>
      <td>${hoursStr}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openEditAttendanceModal('${emp.id}', '${dateStr}')">
          ${ICONS.edit} Edit
        </button>
      </td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Attendance Oversight</h1>
      <p class="page-subtitle">Track, review, and manually adjust employee work check-in logs.</p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-secondary" onclick="exportAttendanceCSV('${dateStr}')">${ICONS.print} Export CSV</button>
      <button class="btn btn-primary" onclick="openManualAttendanceModal('${dateStr}')">${ICONS.plus} Log Record</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.employees}</div>
      <div class="stat-label">Active Employees</div>
      <div class="stat-value tabular">${allEmps.length}</div>
      <div class="stat-sub">Scheduled for ${fmtDate(dateStr)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.attendance}</div>
      <div class="stat-label">Attended / Present</div>
      <div class="stat-value tabular">${totalAttended}<span style="font-size:18px;color:var(--color-text-muted)"> / ${allEmps.length}</span></div>
      <div class="stat-sub">${allEmps.length ? Math.round(totalAttended / allEmps.length * 100) : 0}% turn-out</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.warning}</div>
      <div class="stat-label">Late Arrivals</div>
      <div class="stat-value tabular">${lateCount}</div>
      <div class="stat-sub">After scheduled grace time</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.x}</div>
      <div class="stat-label">Absences Logged</div>
      <div class="stat-value tabular">${absentCount}</div>
      <div class="stat-sub">${halfDayCount} half-day records</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <label class="form-label" style="margin:0;font-size:12px">Select Date:</label>
          <input type="date" class="form-control" style="width:160px;height:34px;font-size:13px" value="${dateStr}" onchange="changeAttendanceDate(this.value)">
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <label class="form-label" style="margin:0;font-size:12px">Department:</label>
          <select class="form-control" style="width:160px;height:34px;font-size:13px" onchange="changeAttendanceDept(this.value)">
            <option value="all">All Departments</option>
            ${depts.map(d => `<option value="${escHtml(d)}" ${_attDeptFilter === d ? 'selected' : ''}>${escHtml(d)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:13px;color:var(--color-text-muted)">
        Showing <strong>${filteredEmps.length}</strong> active staff members
      </div>
    </div>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Employee ID</th>
            <th>Name</th>
            <th>Department</th>
            <th>Status</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Duration</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.attendance}</div><h3>No Employees Found</h3><p>No active employees registered yet.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal: Edit / Log Attendance -->
  <div class="modal-overlay" id="modal-attendance-edit">
    <div class="modal">
      <div class="modal-header">
        <h2 id="modal-att-title">${ICONS.attendance} Edit Attendance Record</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-attendance-edit')">${ICONS.x}</button>
      </div>
      <div class="modal-body" id="modal-att-body"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-attendance-edit')">Cancel</button>
        <button class="btn btn-primary" onclick="submitAttendanceForm()">Save Attendance</button>
      </div>
    </div>
  </div>
  `;
}

function changeAttendanceDate(val) {
  _attDateFilter = val || todayStr();
  renderAttendance();
}

function changeAttendanceDept(val) {
  _attDeptFilter = val;
  renderAttendance();
}

function openEditAttendanceModal(empId, dateStr) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can edit attendance.');
    return;
  }
  const emp = getEmployees().find(e => e.id === empId);
  if (!emp) return;
  const att = getAttendance();
  const rec = att.find(a => a.employeeId === empId && a.date === dateStr) || {
    status: 'present',
    checkIn: '09:00',
    checkOut: '17:00',
    notes: ''
  };

  document.getElementById('modal-att-title').innerHTML = `${ICONS.attendance} Update Attendance &ndash; ${escHtml(emp.name)}`;
  const body = document.getElementById('modal-att-body');
  body.innerHTML = `
    <form id="form-edit-attendance" onsubmit="event.preventDefault();submitAttendanceForm();">
      <input type="hidden" id="att-emp-id" value="${escHtml(empId)}">
      <input type="hidden" id="att-date" value="${escHtml(dateStr)}">
      <div class="form-group">
        <label class="form-label">Employee</label>
        <input class="form-control" value="${escHtml(emp.name)} (${escHtml(emp.employeeId || emp.id)})" disabled readonly>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-control" value="${escHtml(dateStr)}" disabled readonly>
        </div>
        <div class="form-group">
          <label class="form-label">Status <span class="req">*</span></label>
          <select class="form-control" id="att-status" required>
            <option value="present" ${rec.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="late" ${rec.status === 'late' ? 'selected' : ''}>Late</option>
            <option value="half-day" ${rec.status === 'half-day' ? 'selected' : ''}>Half-day</option>
            <option value="absent" ${rec.status === 'absent' ? 'selected' : ''}>Absent</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Check In Time</label>
          <input type="time" class="form-control" id="att-checkin" value="${escHtml(rec.checkIn || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Check Out Time</label>
          <input type="time" class="form-control" id="att-checkout" value="${escHtml(rec.checkOut || '')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes / Remarks</label>
        <input type="text" class="form-control" id="att-notes" placeholder="e.g. Approved early leave, doctor visit" value="${escHtml(rec.notes || '')}">
      </div>
    </form>
  `;
  openModal('modal-attendance-edit');
}

function openManualAttendanceModal(dateStr) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can record attendance.');
    return;
  }
  const emps = getEmployees().filter(e => e.status === 'active');
  if (!emps.length) {
    toast('warn', 'No Employees', 'Add active employees before logging attendance.');
    return;
  }
  openEditAttendanceModal(emps[0].id, dateStr);
}

function submitAttendanceForm() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can modify attendance records.');
    return;
  }
  const empId = document.getElementById('att-emp-id')?.value;
  const dateStr = document.getElementById('att-date')?.value;
  const status = document.getElementById('att-status')?.value;
  const checkIn = document.getElementById('att-checkin')?.value || null;
  const checkOut = document.getElementById('att-checkout')?.value || null;
  const notes = document.getElementById('att-notes')?.value.trim() || '';

  if (!empId || !dateStr || !status) return;

  const att = getAttendance();
  const idx = att.findIndex(a => a.employeeId === empId && a.date === dateStr);

  const newRec = {
    id: idx >= 0 ? att[idx].id : genId('att_'),
    employeeId: empId,
    date: dateStr,
    status,
    checkIn,
    checkOut,
    notes,
    updatedAt: new Date().toISOString()
  };

  if (idx >= 0) {
    att[idx] = newRec;
  } else {
    att.push(newRec);
  }

  saveAttendance(att);
  closeModal('modal-attendance-edit');
  toast('success', 'Attendance Saved', `Record updated for ${dateStr}.`);
  renderAttendance();
}

function exportAttendanceCSV(dateStr) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can export attendance data.');
    return;
  }
  const allEmps = getEmployees().filter(e => e.status === 'active');
  const dayRecords = getAttendance().filter(a => a.date === dateStr);

  const headers = ['Employee ID', 'Name', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Notes'];
  const rows = allEmps.map(emp => {
    const rec = dayRecords.find(a => a.employeeId === emp.id);
    return [
      `"${emp.employeeId || emp.id}"`,
      `"${emp.name}"`,
      `"${emp.department || ''}"`,
      `"${dateStr}"`,
      `"${rec ? rec.status : 'not logged'}"`,
      `"${rec ? (rec.checkIn || '') : ''}"`,
      `"${rec ? (rec.checkOut || '') : ''}"`,
      `"${rec ? (rec.notes || '') : ''}"`
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('success', 'CSV Exported', `Downloaded attendance for ${dateStr}.`);
}


/* SECTION 12: LEAVE MANAGEMENT (ADMIN) */
let _leaveStatusFilter = 'all';
let _leaveTypeFilter = 'all';

function renderLeaves() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content = document.getElementById('page-content');
  const allLeaves = getLeaves();
  const allEmps = getEmployees();

  const pendingCount = allLeaves.filter(l => l.status === 'pending').length;
  const approvedCount = allLeaves.filter(l => l.status === 'approved').length;
  const rejectedCount = allLeaves.filter(l => l.status === 'rejected').length;

  const filtered = allLeaves.filter(l => {
    if (_leaveStatusFilter !== 'all' && l.status !== _leaveStatusFilter) return false;
    if (_leaveTypeFilter !== 'all' && l.leaveType !== _leaveTypeFilter) return false;
    return true;
  });

  const rows = filtered.map(l => {
    const emp = allEmps.find(e => e.id === l.employeeId);
    let statusBadge = '<span class="badge badge-warn">Pending</span>';
    if (l.status === 'approved') statusBadge = '<span class="badge badge-success">Approved</span>';
    else if (l.status === 'rejected') statusBadge = '<span class="badge badge-error">Rejected</span>';

    const days = l.days || workingDaysBetween(l.startDate, l.endDate) || 1;

    let actionBtns = '';
    if (l.status === 'pending') {
      actionBtns = `
        <div style="display:flex;gap:6px">
          <button class="btn btn-accent btn-sm" onclick="adminApproveLeave('${l.id}')">${ICONS.check} Approve</button>
          <button class="btn btn-danger btn-sm" onclick="adminRejectLeave('${l.id}')">${ICONS.x} Reject</button>
        </div>
      `;
    } else {
      actionBtns = `<span style="font-size:12px;color:var(--color-text-muted)">Reviewed by ${escHtml(l.reviewedBy || 'Admin')}</span>`;
    }

    return `<tr>
      <td><strong>#${escHtml(l.id.slice(-6))}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar-initials" style="width:28px;height:28px;font-size:10px">${initials(emp?.name || 'Unknown')}</div>
          <div>
            <div style="font-weight:500">${escHtml(emp?.name || 'Unknown Employee')}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${escHtml(emp?.department || '—')}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-draft">${escHtml(l.leaveType || 'Annual')}</span></td>
      <td>
        <div><strong>${fmtDate(l.startDate)}</strong> &ndash; <strong>${fmtDate(l.endDate)}</strong></div>
        <div style="font-size:11px;color:var(--color-text-muted)">${days} working day${days > 1 ? 's' : ''}</div>
      </td>
      <td style="max-width:240px;white-space:normal;font-size:12px;line-height:1.4">${escHtml(l.reason || 'No reason provided')}</td>
      <td style="font-size:12px">${fmtDate(l.appliedAt?.slice(0,10) || l.createdAt?.slice(0,10) || todayStr())}</td>
      <td>${statusBadge}</td>
      <td>${actionBtns}</td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Leave Management</h1>
      <p class="page-subtitle">Review, approve, and track employee time-off and leave requests.</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.leaves}</div>
      <div class="stat-label">Pending Requests</div>
      <div class="stat-value tabular">${pendingCount}</div>
      <div class="stat-sub">${pendingCount > 0 ? 'Action required' : 'All caught up'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.check}</div>
      <div class="stat-label">Approved Leaves</div>
      <div class="stat-value tabular">${approvedCount}</div>
      <div class="stat-sub">Across all staff</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.x}</div>
      <div class="stat-label">Rejected Requests</div>
      <div class="stat-value tabular">${rejectedCount}</div>
      <div class="stat-sub">Denied applications</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.dashboard}</div>
      <div class="stat-label">Total Applications</div>
      <div class="stat-value tabular">${allLeaves.length}</div>
      <div class="stat-sub">Historical recorded</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px">
          <label class="form-label" style="margin:0;font-size:12px">Status Filter:</label>
          <select class="form-control" style="width:140px;height:34px;font-size:13px" onchange="changeLeaveStatusFilter(this.value)">
            <option value="all" ${_leaveStatusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="pending" ${_leaveStatusFilter === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="approved" ${_leaveStatusFilter === 'approved' ? 'selected' : ''}>Approved</option>
            <option value="rejected" ${_leaveStatusFilter === 'rejected' ? 'selected' : ''}>Rejected</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <label class="form-label" style="margin:0;font-size:12px">Leave Type:</label>
          <select class="form-control" style="width:140px;height:34px;font-size:13px" onchange="changeLeaveTypeFilter(this.value)">
            <option value="all" ${_leaveTypeFilter === 'all' ? 'selected' : ''}>All Types</option>
            <option value="Annual" ${_leaveTypeFilter === 'Annual' ? 'selected' : ''}>Annual</option>
            <option value="Sick" ${_leaveTypeFilter === 'Sick' ? 'selected' : ''}>Sick</option>
            <option value="Casual" ${_leaveTypeFilter === 'Casual' ? 'selected' : ''}>Casual</option>
            <option value="Unpaid" ${_leaveTypeFilter === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
          </select>
        </div>
      </div>
      <div style="font-size:13px;color:var(--color-text-muted)">
        Showing <strong>${filtered.length}</strong> record(s)
      </div>
    </div>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Employee</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Applied</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.leaves}</div><h3>No Leave Requests</h3><p>No leave requests found matching the current filter.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

function changeLeaveStatusFilter(val) {
  _leaveStatusFilter = val;
  renderLeaves();
}

function changeLeaveTypeFilter(val) {
  _leaveTypeFilter = val;
  renderLeaves();
}

function adminApproveLeave(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can approve leave requests.');
    return;
  }
  const leaves = getLeaves();
  const idx = leaves.findIndex(l => l.id === id);
  if (idx === -1) return;
  leaves[idx].status = 'approved';
  leaves[idx].reviewedAt = new Date().toISOString();
  leaves[idx].reviewedBy = STATE.currentUser.name;
  saveLeaves(leaves);
  toast('success', 'Leave Approved', 'The leave request has been approved.');
  renderLeaves();
}

function adminRejectLeave(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can reject leave requests.');
    return;
  }
  const leaves = getLeaves();
  const idx = leaves.findIndex(l => l.id === id);
  if (idx === -1) return;
  leaves[idx].status = 'rejected';
  leaves[idx].reviewedAt = new Date().toISOString();
  leaves[idx].reviewedBy = STATE.currentUser.name;
  saveLeaves(leaves);
  toast('error', 'Leave Rejected', 'The leave request has been rejected.');
  renderLeaves();
}


/* SECTION 13: MONTHLY PAYSLIPS & PAYROLL (ADMIN) */
let _payslipMonthFilter = todayStr().slice(0, 7);

function renderPayslips() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content = document.getElementById('page-content');
  const allEmps = getEmployees();
  const allSlips = getPayslips();
  const company = getCompany();
  const settings = getSettings();
  const month = _payslipMonthFilter || todayStr().slice(0, 7);

  const monthSlips = allSlips.filter(p => p.month === month);
  const totalPayroll = monthSlips.reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);
  const paidCount = monthSlips.filter(p => p.status === 'paid').length;
  const draftCount = monthSlips.filter(p => p.status === 'draft').length;

  const rows = monthSlips.map(p => {
    const emp = allEmps.find(e => e.id === p.employeeId);
    let statusBadge = p.status === 'paid'
      ? '<span class="badge badge-success">Paid</span>'
      : '<span class="badge badge-draft">Draft</span>';

    return `<tr>
      <td><strong>${escHtml(p.slipNumber || p.id)}</strong></td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="avatar-initials" style="width:28px;height:28px;font-size:10px">${initials(emp?.name || 'Unknown')}</div>
          <div>
            <div style="font-weight:500">${escHtml(emp?.name || 'Unknown')}</div>
            <div style="font-size:11px;color:var(--color-text-muted)">${escHtml(emp?.department || '—')}</div>
          </div>
        </div>
      </td>
      <td>${monthLabel(p.month)}</td>
      <td class="tabular">${fmtMoney(p.basicSalary, settings.currency)}</td>
      <td class="tabular" style="color:var(--color-success)">+${fmtMoney(p.allowances || 0, settings.currency)}</td>
      <td class="tabular" style="color:var(--color-error)">-${fmtMoney(p.deductions || 0, settings.currency)}</td>
      <td class="tabular"><strong>${fmtMoney(p.netSalary, settings.currency)}</strong></td>
      <td>${statusBadge}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openViewPayslipModal('${p.id}')">${ICONS.print} View</button>
          <button class="btn btn-ghost btn-sm" onclick="togglePayslipStatus('${p.id}')">
            ${p.status === 'paid' ? 'Mark Draft' : 'Mark Paid'}
          </button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deletePayslip('${p.id}')">${ICONS.trash}</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Monthly Payslip Engine</h1>
      <p class="page-subtitle">Generate, record, and print official payroll statements and pay vouchers.</p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-secondary" onclick="autoGenerateMonthlyPayroll('${month}')">${ICONS.refresh} Auto-Generate All</button>
      <button class="btn btn-primary" onclick="openCreatePayslipModal()">${ICONS.plus} Issue Payslip</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.payslip}</div>
      <div class="stat-label">Total Net Payroll</div>
      <div class="stat-value tabular">${fmtMoney(totalPayroll, settings.currency)}</div>
      <div class="stat-sub">For ${monthLabel(month)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.check}</div>
      <div class="stat-label">Disbursed (Paid)</div>
      <div class="stat-value tabular">${paidCount}</div>
      <div class="stat-sub">${monthSlips.length ? Math.round(paidCount / monthSlips.length * 100) : 0}% settled</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.clock}</div>
      <div class="stat-label">Pending (Draft)</div>
      <div class="stat-value tabular">${draftCount}</div>
      <div class="stat-sub">Awaiting confirmation</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.employees}</div>
      <div class="stat-label">Payslips Issued</div>
      <div class="stat-value tabular">${monthSlips.length}</div>
      <div class="stat-sub">Employees covered</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="card-body" style="padding:14px 16px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div style="display:flex;align-items:center;gap:12px">
        <label class="form-label" style="margin:0;font-size:12px">Select Pay Period:</label>
        <input type="month" class="form-control" style="width:170px;height:34px;font-size:13px" value="${month}" onchange="changePayslipMonth(this.value)">
      </div>
      <div style="font-size:13px;color:var(--color-text-muted)">
        Company Currency: <strong>${escHtml(settings.currency)}</strong>
      </div>
    </div>

    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Voucher #</th>
            <th>Employee</th>
            <th>Month</th>
            <th>Basic Salary</th>
            <th>Allowances</th>
            <th>Deductions</th>
            <th>Net Salary</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="9"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.payslip}</div><h3>No Payslips for ${monthLabel(month)}</h3><p>Click "Auto-Generate All" or "Issue Payslip" to create records.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal: Create Payslip -->
  <div class="modal-overlay" id="modal-create-payslip">
    <div class="modal">
      <div class="modal-header">
        <h2>${ICONS.payslip} Record Individual Payslip</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-create-payslip')">${ICONS.x}</button>
      </div>
      <div class="modal-body" id="modal-create-payslip-body"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-create-payslip')">Cancel</button>
        <button class="btn btn-primary" onclick="submitCreatePayslip()">Save Payslip</button>
      </div>
    </div>
  </div>

  <!-- Modal: View Printable Payslip -->
  <div class="modal-overlay" id="modal-view-payslip">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <h2>${ICONS.payslip} Official Pay Statement</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-view-payslip')">${ICONS.x}</button>
      </div>
      <div class="modal-body" id="modal-view-payslip-body" style="padding:24px"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-view-payslip')">Close</button>
        <button class="btn btn-primary" onclick="window.print()">${ICONS.print} Print Statement</button>
      </div>
    </div>
  </div>
  `;
}

function changePayslipMonth(val) {
  _payslipMonthFilter = val || todayStr().slice(0, 7);
  renderPayslips();
}

function openCreatePayslipModal() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can create payslips.');
    return;
  }
  const emps = getEmployees().filter(e => e.status === 'active');
  if (!emps.length) {
    toast('warn', 'No Employees', 'Create active employees before issuing payslips.');
    return;
  }
  const settings = getSettings();
  const month = _payslipMonthFilter || todayStr().slice(0, 7);

  const body = document.getElementById('modal-create-payslip-body');
  body.innerHTML = `
    <form id="form-new-payslip" onsubmit="event.preventDefault();submitCreatePayslip();">
      <div class="form-group">
        <label class="form-label" for="ps-emp">Select Employee <span class="req">*</span></label>
        <select class="form-control" id="ps-emp" onchange="onPayslipEmpChange(this.value)" required>
          ${emps.map(e => `<option value="${escHtml(e.id)}" data-salary="${e.salary || 0}">${escHtml(e.name)} (${escHtml(e.employeeId || e.id)}) - ${escHtml(e.department || '')}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Pay Period <span class="req">*</span></label>
          <input type="month" class="form-control" id="ps-month" value="${month}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="ps-status">
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Basic Salary (${escHtml(settings.currency)}) <span class="req">*</span></label>
          <input type="number" class="form-control" id="ps-basic" min="0" value="${emps[0].salary || 0}" oninput="calcPayslipNet()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Allowances (${escHtml(settings.currency)})</label>
          <input type="number" class="form-control" id="ps-allowances" min="0" value="0" oninput="calcPayslipNet()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Deductions (${escHtml(settings.currency)})</label>
          <input type="number" class="form-control" id="ps-deductions" min="0" value="0" oninput="calcPayslipNet()">
        </div>
        <div class="form-group">
          <label class="form-label">Net Salary (Calculated)</label>
          <input type="text" class="form-control" id="ps-net" value="${fmtMoney(emps[0].salary || 0, settings.currency)}" disabled readonly style="font-weight:700">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Remarks / Description</label>
        <input type="text" class="form-control" id="ps-remarks" placeholder="e.g. Regular monthly payroll">
      </div>
    </form>
  `;
  openModal('modal-create-payslip');
}

function onPayslipEmpChange(empId) {
  const emp = getEmployees().find(e => e.id === empId);
  if (emp) {
    document.getElementById('ps-basic').value = emp.salary || 0;
    calcPayslipNet();
  }
}

function calcPayslipNet() {
  const basic = Number(document.getElementById('ps-basic')?.value) || 0;
  const allow = Number(document.getElementById('ps-allowances')?.value) || 0;
  const ded = Number(document.getElementById('ps-deductions')?.value) || 0;
  const net = Math.max(0, basic + allow - ded);
  const settings = getSettings();
  const netEl = document.getElementById('ps-net');
  if (netEl) netEl.value = fmtMoney(net, settings.currency);
}

function submitCreatePayslip() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can issue payslips.');
    return;
  }
  const empId = document.getElementById('ps-emp')?.value;
  const month = document.getElementById('ps-month')?.value;
  const status = document.getElementById('ps-status')?.value || 'draft';
  const basic = Number(document.getElementById('ps-basic')?.value) || 0;
  const allow = Number(document.getElementById('ps-allowances')?.value) || 0;
  const ded = Number(document.getElementById('ps-deductions')?.value) || 0;
  const remarks = document.getElementById('ps-remarks')?.value.trim() || '';

  if (!empId || !month) return;

  const net = Math.max(0, basic + allow - ded);
  const allSlips = getPayslips();

  // Check duplicate slip for employee + month
  const existing = allSlips.find(p => p.employeeId === empId && p.month === month);
  if (existing) {
    toast('warn', 'Slip Exists', 'A payslip already exists for this employee for ' + monthLabel(month) + '.');
    return;
  }

  const newSlip = {
    id: genId('ps_'),
    slipNumber: 'PAY-' + month.replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000),
    employeeId: empId,
    month,
    basicSalary: basic,
    allowances: allow,
    deductions: ded,
    netSalary: net,
    status,
    remarks,
    createdAt: new Date().toISOString()
  };

  allSlips.unshift(newSlip);
  savePayslips(allSlips);
  closeModal('modal-create-payslip');
  toast('success', 'Payslip Recorded', `Created pay voucher for ${monthLabel(month)}.`);
  _payslipMonthFilter = month;
  renderPayslips();
}

function autoGenerateMonthlyPayroll(month) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can generate batch payroll.');
    return;
  }
  const emps = getEmployees().filter(e => e.status === 'active');
  if (!emps.length) {
    toast('warn', 'No Employees', 'No active employees to generate payroll for.');
    return;
  }

  const allSlips = getPayslips();
  let createdCount = 0;

  emps.forEach(emp => {
    const exists = allSlips.some(p => p.employeeId === emp.id && p.month === month);
    if (!exists) {
      const basic = Number(emp.salary) || 0;
      const allow = 0;
      const ded = 0;
      allSlips.push({
        id: genId('ps_'),
        slipNumber: 'PAY-' + month.replace('-', '') + '-' + Math.floor(1000 + Math.random() * 9000),
        employeeId: emp.id,
        month,
        basicSalary: basic,
        allowances: allow,
        deductions: ded,
        netSalary: basic,
        status: 'draft',
        remarks: 'Batch generated payroll',
        createdAt: new Date().toISOString()
      });
      createdCount++;
    }
  });

  savePayslips(allSlips);
  if (createdCount > 0) {
    toast('success', 'Payroll Generated', `Created ${createdCount} payslip(s) for ${monthLabel(month)}.`);
  } else {
    toast('info', 'Up to Date', `All active employees already have payslips for ${monthLabel(month)}.`);
  }
  renderPayslips();
}

function togglePayslipStatus(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can modify payslip status.');
    return;
  }
  const slips = getPayslips();
  const idx = slips.findIndex(p => p.id === id);
  if (idx === -1) return;
  slips[idx].status = slips[idx].status === 'paid' ? 'draft' : 'paid';
  savePayslips(slips);
  toast('success', 'Status Updated', `Payslip marked as ${slips[idx].status}.`);
  renderPayslips();
}

function deletePayslip(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can delete payslips.');
    return;
  }
  if (!confirm('Are you sure you want to delete this payslip record?')) return;
  const slips = getPayslips().filter(p => p.id !== id);
  savePayslips(slips);
  toast('success', 'Deleted', 'Payslip removed.');
  renderPayslips();
}

function openViewPayslipModal(id) {
  const slips = getPayslips();
  const slip = slips.find(p => p.id === id);
  if (!slip) return;
  if (STATE.currentUser?.role === 'employee') {
    if (slip.employeeId !== STATE.currentEmployee?.id) {
      toast('error', 'Access Denied', 'You are not authorized to view other employees\' payslips.');
      return;
    }
    if (slip.status === 'draft') {
      toast('error', 'Access Denied', 'This payslip is currently in draft state and is not yet available.');
      return;
    }
  }
  const emp = getEmployees().find(e => e.id === slip.employeeId);
  const company = getCompany();
  const settings = getSettings();

  const netWords = numToWords(slip.netSalary) + ' ' + (settings.currency || 'PKR') + ' only';

  const body = document.getElementById('modal-view-payslip-body');
  body.innerHTML = `
    <div class="payslip-voucher" style="font-family:var(--font-sans)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--color-primary);padding-bottom:16px;margin-bottom:16px">
        <div>
          <h2 style="margin:0;color:var(--color-primary);font-size:20px;font-weight:700">${escHtml(company.name || 'Executive Slate HCM')}</h2>
          <p style="margin:4px 0 0;font-size:12px;color:var(--color-text-muted)">Official Salary Disbursal Voucher</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700">${escHtml(slip.slipNumber || slip.id)}</div>
          <div style="font-size:12px;color:var(--color-text-muted)">Period: ${monthLabel(slip.month)}</div>
          <span class="badge ${slip.status === 'paid' ? 'badge-success' : 'badge-draft'}" style="margin-top:4px">${slip.status.toUpperCase()}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--color-bg);padding:12px;border-radius:var(--radius-md);margin-bottom:16px;font-size:12px">
        <div><strong>Employee Name:</strong> ${escHtml(emp?.name || 'Unknown')}</div>
        <div><strong>Employee ID:</strong> ${escHtml(emp?.employeeId || emp?.id || '—')}</div>
        <div><strong>Designation:</strong> ${escHtml(emp?.designation || 'Staff')}</div>
        <div><strong>Department:</strong> ${escHtml(emp?.department || 'General')}</div>
        <div><strong>Email:</strong> ${escHtml(emp?.email || '—')}</div>
        <div><strong>Joining Date:</strong> ${fmtDate(emp?.joiningDate)}</div>
      </div>

      <table class="data-table" style="margin-bottom:16px">
        <thead>
          <tr>
            <th>Earnings</th>
            <th class="tabular">Amount (${escHtml(settings.currency)})</th>
            <th>Deductions</th>
            <th class="tabular">Amount (${escHtml(settings.currency)})</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td class="tabular">${fmtMoney(slip.basicSalary, '')}</td>
            <td>Standard Deductions / Tax</td>
            <td class="tabular">${fmtMoney(slip.deductions || 0, '')}</td>
          </tr>
          <tr>
            <td>Allowances / Bonuses</td>
            <td class="tabular">${fmtMoney(slip.allowances || 0, '')}</td>
            <td>Unpaid Leave / Other</td>
            <td class="tabular">0</td>
          </tr>
          <tr style="font-weight:700;border-top:2px solid var(--color-border);background:var(--color-bg)">
            <td>Total Gross Earnings</td>
            <td class="tabular">${fmtMoney((Number(slip.basicSalary) || 0) + (Number(slip.allowances) || 0), settings.currency)}</td>
            <td>Total Deductions</td>
            <td class="tabular">${fmtMoney(slip.deductions || 0, settings.currency)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background:var(--color-surface);border:1px solid var(--color-border);padding:14px;border-radius:var(--radius-md);margin-bottom:20px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:11px;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.05em">Net Payable Salary</div>
          <div style="font-size:12px;font-style:italic;color:var(--color-text)">"${escHtml(netWords)}"</div>
        </div>
        <div style="font-size:22px;font-weight:800;color:var(--color-primary)" class="tabular">
          ${fmtMoney(slip.netSalary, settings.currency)}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;padding-top:24px;border-top:1px dashed var(--color-border);font-size:11px;color:var(--color-text-muted)">
        <div>
          <div style="border-top:1px solid var(--color-border);width:140px;margin-bottom:4px"></div>
          Employer Signature
        </div>
        <div style="text-align:right">
          <div style="border-top:1px solid var(--color-border);width:140px;margin-bottom:4px"></div>
          Employee Signature
        </div>
      </div>
    </div>
  `;
  openModal('modal-view-payslip');
}


/* SECTION 14: ANNOUNCEMENTS (ADMIN) */
function renderAnnouncements() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-announcements'); return; }
  const content = document.getElementById('page-content');
  const anns = getAnnouncements();
  const allEmps = getEmployees();
  const depts = [...new Set(allEmps.map(e => e.department).filter(Boolean))];

  // Sort pinned first, then by date descending
  const sorted = [...anns].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const cardsHtml = sorted.map(a => {
    const catBadge = a.category === 'Urgent'
      ? '<span class="badge badge-error">Urgent</span>'
      : a.category === 'Policy'
      ? '<span class="badge badge-warn">Policy</span>'
      : a.category === 'Event'
      ? '<span class="badge badge-success">Event</span>'
      : '<span class="badge badge-draft">General</span>';

    return `
    <div class="card" style="margin-bottom:16px;border-left:4px solid ${a.pinned ? 'var(--color-primary)' : 'var(--color-border)'}">
      <div class="card-header" style="padding:14px 18px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${a.pinned ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:var(--color-primary)">${ICONS.warning} PINNED</span>` : ''}
          ${catBadge}
          <h3 style="margin:0;font-size:16px">${escHtml(a.title)}</h3>
          <span class="badge badge-draft" style="font-size:11px">Target: ${escHtml(a.targetDept || 'All Staff')}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="togglePinAnnouncement('${a.id}')">
            ${a.pinned ? 'Unpin' : 'Pin to Top'}
          </button>
          <button class="btn btn-ghost btn-sm text-danger" onclick="deleteAnnouncement('${a.id}')">${ICONS.trash}</button>
        </div>
      </div>
      <div class="card-body" style="padding:16px 18px">
        <p style="white-space:pre-wrap;line-height:1.6;font-size:14px;color:var(--color-text)">${escHtml(a.body)}</p>
      </div>
      <div class="card-footer" style="padding:10px 18px;font-size:12px;color:var(--color-text-muted)">
        <span>Posted by <strong>${escHtml(a.author || 'Admin')}</strong></span>
        <span>${fmtDate(a.createdAt?.slice(0, 10))}</span>
      </div>
    </div>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Company Announcements</h1>
      <p class="page-subtitle">Publish internal bulletins, workplace memos, and policy notifications.</p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-primary" onclick="openCreateAnnouncementModal()">${ICONS.plus} New Announcement</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.announce}</div>
      <div class="stat-label">Total Announcements</div>
      <div class="stat-value tabular">${anns.length}</div>
      <div class="stat-sub">Published to portal</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.warning}</div>
      <div class="stat-label">Pinned Bulletins</div>
      <div class="stat-value tabular">${anns.filter(a => a.pinned).length}</div>
      <div class="stat-sub">Featured at top</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.employees}</div>
      <div class="stat-label">Audience Scope</div>
      <div class="stat-value tabular">${allEmps.filter(e => e.status === 'active').length}</div>
      <div class="stat-sub">Active team members</div>
    </div>
  </div>

  <div style="margin-top:20px">
    ${cardsHtml || `
      <div class="card">
        <div class="empty-state" style="padding:48px">
          <div class="empty-icon">${ICONS.announce}</div>
          <h3>No Announcements Yet</h3>
          <p>Click "New Announcement" to broadcast your first company update.</p>
        </div>
      </div>
    `}
  </div>

  <!-- Modal: Create Announcement -->
  <div class="modal-overlay" id="modal-announcement">
    <div class="modal">
      <div class="modal-header">
        <h2>${ICONS.announce} Publish Announcement</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-announcement')">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <form id="form-announcement" onsubmit="event.preventDefault();submitAnnouncement();">
          <div class="form-group">
            <label class="form-label" for="ann-title">Title <span class="req">*</span></label>
            <input class="form-control" id="ann-title" placeholder="e.g. Office holiday notice, Health policy update" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="ann-cat">Category</label>
              <select class="form-control" id="ann-cat">
                <option value="General">General</option>
                <option value="Urgent">Urgent</option>
                <option value="Policy">Policy</option>
                <option value="Event">Event</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ann-dept">Target Audience</label>
              <select class="form-control" id="ann-dept">
                <option value="All Staff">All Staff (Company-wide)</option>
                ${depts.map(d => `<option value="${escHtml(d)}">${escHtml(d)} Only</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="ann-body">Announcement Message <span class="req">*</span></label>
            <textarea class="form-control" id="ann-body" rows="5" placeholder="Type the announcement message details here..." required></textarea>
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
              <input type="checkbox" id="ann-pinned">
              <span><strong>Pin this announcement</strong> to the top of the board</span>
            </label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-announcement')">Cancel</button>
        <button class="btn btn-primary" onclick="submitAnnouncement()">Publish</button>
      </div>
    </div>
  </div>
  `;
}

function openCreateAnnouncementModal() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can create announcements.');
    return;
  }
  const titleEl = document.getElementById('ann-title');
  const bodyEl = document.getElementById('ann-body');
  if (titleEl) titleEl.value = '';
  if (bodyEl) bodyEl.value = '';
  const pinEl = document.getElementById('ann-pinned');
  if (pinEl) pinEl.checked = false;
  openModal('modal-announcement');
}

function submitAnnouncement() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can publish announcements.');
    return;
  }
  const title = document.getElementById('ann-title')?.value.trim();
  const body = document.getElementById('ann-body')?.value.trim();
  const category = document.getElementById('ann-cat')?.value || 'General';
  const targetDept = document.getElementById('ann-dept')?.value || 'All Staff';
  const pinned = !!document.getElementById('ann-pinned')?.checked;

  if (!title || !body) {
    toast('warn', 'Missing Information', 'Please provide a title and announcement message.');
    return;
  }

  const anns = getAnnouncements();
  anns.unshift({
    id: genId('ann_'),
    title,
    body,
    category,
    targetDept,
    pinned,
    author: STATE.currentUser.name || 'Admin',
    createdAt: new Date().toISOString()
  });

  saveAnnouncements(anns);
  closeModal('modal-announcement');
  toast('success', 'Announcement Published', 'All permitted employees can now see this post.');
  renderAnnouncements();
}

function togglePinAnnouncement(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can pin announcements.');
    return;
  }
  const anns = getAnnouncements();
  const idx = anns.findIndex(a => a.id === id);
  if (idx === -1) return;
  anns[idx].pinned = !anns[idx].pinned;
  saveAnnouncements(anns);
  toast('success', 'Updated', anns[idx].pinned ? 'Announcement pinned.' : 'Announcement unpinned.');
  renderAnnouncements();
}

function deleteAnnouncement(id) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can delete announcements.');
    return;
  }
  if (!confirm('Are you sure you want to delete this announcement?')) return;
  const anns = getAnnouncements().filter(a => a.id !== id);
  saveAnnouncements(anns);
  toast('success', 'Deleted', 'Announcement removed.');
  renderAnnouncements();
}


/* SECTION 15: COMPANY SETTINGS (ADMIN) */
function renderSettings() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') { navigate('emp-dashboard'); return; }
  const content = document.getElementById('page-content');
  const company = getCompany();
  const settings = getSettings();

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Company Settings</h1>
      <p class="page-subtitle">Configure enterprise profile, work schedule, leave entitlements, and local data backups.</p>
    </div>
  </div>

  <div class="dash-grid">
    <div>
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.settings} Enterprise Profile</h3>
        </div>
        <div class="card-body">
          <form id="form-company-profile" onsubmit="saveCompanyProfile(event)">
            <div class="form-group">
              <label class="form-label" for="set-comp-name">Company Name <span class="req">*</span></label>
              <input class="form-control" id="set-comp-name" value="${escHtml(company.name || '')}" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="set-currency">Default Currency</label>
                <select class="form-control" id="set-currency">
                  <option value="PKR" ${settings.currency === 'PKR' ? 'selected' : ''}>PKR (Pakistani Rupee)</option>
                  <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD (US Dollar)</option>
                  <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (Euro)</option>
                  <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (British Pound)</option>
                  <option value="AED" ${settings.currency === 'AED' ? 'selected' : ''}>AED (UAE Dirham)</option>
                  <option value="SAR" ${settings.currency === 'SAR' ? 'selected' : ''}>SAR (Saudi Riyal)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="set-comp-phone">Official Phone</label>
                <input class="form-control" id="set-comp-phone" value="${escHtml(company.phone || '')}" placeholder="+92 21 111-222-333">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="set-comp-address">Office Address</label>
              <input class="form-control" id="set-comp-address" value="${escHtml(company.address || '')}" placeholder="Shahrah-e-Faisal, Karachi, Pakistan">
            </div>
            <button type="submit" class="btn btn-primary">${ICONS.check} Save Company Profile</button>
          </form>
        </div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.clock} Work Hours & Leave Policy</h3>
        </div>
        <div class="card-body">
          <form id="form-work-policy" onsubmit="saveWorkPolicy(event)">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="set-work-start">Shift Start Time</label>
                <input type="time" class="form-control" id="set-work-start" value="${escHtml(settings.workStart || '09:00')}" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="set-work-end">Shift End Time</label>
                <input type="time" class="form-control" id="set-work-end" value="${escHtml(settings.workEnd || '17:00')}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="set-grace">Grace Period (Minutes)</label>
                <input type="number" class="form-control" id="set-grace" min="0" max="120" value="${settings.graceMinutes || 15}" required>
                <div style="font-size:11px;color:var(--color-text-muted);margin-top:4px">Check-ins beyond this are flagged as Late.</div>
              </div>
              <div class="form-group">
                <label class="form-label" for="set-quota-annual">Annual Leave Quota (Days)</label>
                <input type="number" class="form-control" id="set-quota-annual" min="0" max="60" value="${settings.annualLeaveQuota || 20}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="set-quota-sick">Sick Leave Quota (Days)</label>
                <input type="number" class="form-control" id="set-quota-sick" min="0" max="30" value="${settings.sickLeaveQuota || 10}">
              </div>
              <div class="form-group">
                <label class="form-label" for="set-quota-casual">Casual Leave Quota (Days)</label>
                <input type="number" class="form-control" id="set-quota-casual" min="0" max="30" value="${settings.casualLeaveQuota || 10}">
              </div>
            </div>
            <button type="submit" class="btn btn-primary">${ICONS.check} Save Policies</button>
          </form>
        </div>
      </div>
    </div>

    <div>
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.dashboard} Data Management (Local Storage)</h3>
        </div>
        <div class="card-body">
          <p style="font-size:13px;line-height:1.5;color:var(--color-text-muted);margin-bottom:16px">
            HCM Lite saves all data directly inside your browser's local storage. You can create a full JSON export for safekeeping, transfer to another device, or restore past backups.
          </p>

          <div style="display:flex;flex-direction:column;gap:12px">
            <button class="btn btn-secondary w-full" style="justify-content:center" onclick="exportDatabaseJSON()">
              ${ICONS.print} Download Complete Backup (JSON)
            </button>

            <div style="position:relative;overflow:hidden">
              <button class="btn btn-secondary w-full" style="justify-content:center">
                ${ICONS.refresh} Restore Backup from JSON
              </button>
              <input type="file" accept=".json" onchange="importDatabaseJSON(event)" style="position:absolute;left:0;top:0;opacity:0;width:100%;height:100%;cursor:pointer">
            </div>

            <div style="border-top:1px solid var(--color-border);padding-top:14px;margin-top:6px">
              <h4 style="font-size:13px;color:var(--color-error);margin-bottom:6px">Danger Zone</h4>
              <p style="font-size:12px;color:var(--color-text-muted);margin-bottom:10px">
                Permanently wipes all company data, employee accounts, leaves, attendance, and payroll records from this browser.
              </p>
              <button class="btn btn-danger w-full" style="justify-content:center" onclick="factoryResetDatabase()">
                ${ICONS.trash} Factory Reset &amp; Clear All Data
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.lock} Storage Notice</h3>
        </div>
        <div class="card-body" style="font-size:12px;color:var(--color-text-muted);line-height:1.6">
          <p>
            <strong>Storage Engine:</strong> HTML5 Web Storage API (localStorage + sessionStorage).
          </p>
          <p style="margin-top:8px">
            Data is origin-specific and remains on this browser until cleared. It does not sync over internet servers. Always keep a JSON backup before clearing browser cache.
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}

function saveCompanyProfile(e) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can modify company profile.');
    return;
  }
  const name = document.getElementById('set-comp-name').value.trim();
  const currency = document.getElementById('set-currency').value;
  const phone = document.getElementById('set-comp-phone').value.trim();
  const address = document.getElementById('set-comp-address').value.trim();

  if (!name) {
    toast('warn', 'Company Name Required', 'Please enter a company name.');
    return;
  }

  const comp = getCompany();
  comp.name = name;
  comp.phone = phone;
  comp.address = address;
  lsSet(LS_KEYS.COMPANY, comp);

  const settings = getSettings();
  settings.currency = currency;
  saveSettings(settings);

  toast('success', 'Profile Updated', 'Company settings saved successfully.');
  renderShell();
  renderSettings();
}

function saveWorkPolicy(e) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can modify company policy.');
    return;
  }
  const workStart = document.getElementById('set-work-start').value || '09:00';
  const workEnd = document.getElementById('set-work-end').value || '17:00';
  const graceMinutes = Number(document.getElementById('set-grace').value) || 15;
  const annualLeaveQuota = Number(document.getElementById('set-quota-annual').value) || 20;
  const sickLeaveQuota = Number(document.getElementById('set-quota-sick').value) || 10;
  const casualLeaveQuota = Number(document.getElementById('set-quota-casual').value) || 10;

  const settings = getSettings();
  settings.workStart = workStart;
  settings.workEnd = workEnd;
  settings.graceMinutes = graceMinutes;
  settings.annualLeaveQuota = annualLeaveQuota;
  settings.sickLeaveQuota = sickLeaveQuota;
  settings.casualLeaveQuota = casualLeaveQuota;

  saveSettings(settings);
  toast('success', 'Policy Saved', 'Attendance and leave policies updated.');
  renderSettings();
}

function exportDatabaseJSON() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can export database backups.');
    return;
  }
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    exportedBy: STATE.currentUser.email,
    payload: {}
  };
  for (const [key, val] of Object.entries(LS_KEYS)) {
    data.payload[val] = lsGet(val, null);
    data[val] = lsGet(val, null);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hcm_backup_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast('success', 'Backup Exported', 'Downloaded full database JSON file.');
}

function importDatabaseJSON(e) {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can restore backups.');
    if (e.target) e.target.value = '';
    return;
  }
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const raw = JSON.parse(evt.target.result);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Backup root must be a JSON object.');
      }
      const data = (raw.payload && typeof raw.payload === 'object' && !Array.isArray(raw.payload)) ? raw.payload : raw;
      const allowedKeys = new Set(Object.values(LS_KEYS));
      const foundKeys = Object.keys(data).filter(k => allowedKeys.has(k));

      if (foundKeys.length === 0) {
        throw new Error('Backup file contains no valid HCM Lite tables.');
      }

      // Validate core table schemas
      if (data[LS_KEYS.USERS] !== undefined && !Array.isArray(data[LS_KEYS.USERS])) {
        throw new Error('Corrupted users table in backup.');
      }
      if (data[LS_KEYS.EMPLOYEES] !== undefined && !Array.isArray(data[LS_KEYS.EMPLOYEES])) {
        throw new Error('Corrupted employees table in backup.');
      }
      if (data[LS_KEYS.ATTENDANCE] !== undefined && !Array.isArray(data[LS_KEYS.ATTENDANCE])) {
        throw new Error('Corrupted attendance table in backup.');
      }
      if (data[LS_KEYS.LEAVES] !== undefined && !Array.isArray(data[LS_KEYS.LEAVES])) {
        throw new Error('Corrupted leaves table in backup.');
      }
      if (data[LS_KEYS.PAYSLIPS] !== undefined && !Array.isArray(data[LS_KEYS.PAYSLIPS])) {
        throw new Error('Corrupted payslips table in backup.');
      }
      if (data[LS_KEYS.ANNOUNCEMENTS] !== undefined && !Array.isArray(data[LS_KEYS.ANNOUNCEMENTS])) {
        throw new Error('Corrupted announcements table in backup.');
      }
      if (data[LS_KEYS.SETTINGS] !== undefined && (typeof data[LS_KEYS.SETTINGS] !== 'object' || Array.isArray(data[LS_KEYS.SETTINGS]))) {
        throw new Error('Corrupted settings profile in backup.');
      }
      if (data[LS_KEYS.COMPANY] !== undefined && (typeof data[LS_KEYS.COMPANY] !== 'object' || Array.isArray(data[LS_KEYS.COMPANY]))) {
        throw new Error('Corrupted company information in backup.');
      }

      // Whitelist storage import
      for (const [key, val] of Object.entries(data)) {
        if (allowedKeys.has(key) && val !== undefined) {
          lsSet(key, val);
        }
      }
      toast('success', 'Database Restored', 'Backup verified and imported successfully! Reloading...');
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      toast('error', 'Import Failed', err.message || 'Invalid or corrupted JSON backup file.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };
  reader.readAsText(file);
}

function factoryResetDatabase() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'admin') {
    toast('error', 'Unauthorized', 'Only administrators can perform a factory reset.');
    return;
  }
  if (!confirm('DANGER: This will delete ALL employees, users, attendance, leaves, payroll records and reset to first-run setup. Proceed?')) {
    return;
  }
  if (!confirm('Are you absolutely certain? This action cannot be undone!')) {
    return;
  }
  localStorage.clear();
  sessionStorage.clear();
  toast('info', 'Reset Complete', 'Database cleared. Returning to setup.');
  setTimeout(() => location.reload(), 800);
}


/* SECTION 16: EMPLOYEE SELF-SERVICE PORTAL */

/* ── Check In / Check Out Handler ── */
function empCheckIn() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    toast('error', 'Unauthorized', 'Only linked employee accounts can check in.');
    return;
  }
  const curEmp = getEmployees().find(e => e.id === STATE.currentEmployee.id);
  if (!curEmp || curEmp.status !== 'active') {
    logout();
    toast('error', 'Account Inactive', 'Your employee profile is not active.');
    return;
  }
  const empId = STATE.currentEmployee.id;
  const today = todayStr();
  const time = nowTimeStr();
  const att = getAttendance();

  // Validate: Check if already checked in today
  const existing = att.find(a => a.employeeId === empId && a.date === today);
  if (existing && existing.checkIn) {
    toast('warn', 'Already Checked In', `You already checked in today at ${existing.checkIn}.`);
    return;
  }

  const settings = getSettings();
  const [startH, startM] = (settings.workStart || '09:00').split(':').map(Number);
  const [nowH, nowM] = time.split(':').map(Number);
  const grace = Number(settings.graceMinutes) || 15;
  const isLate = (nowH * 60 + nowM) > (startH * 60 + startM + grace);
  const status = isLate ? 'late' : 'present';

  if (existing) {
    existing.checkIn = time;
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
  } else {
    att.push({
      id: genId('att_'),
      employeeId: empId,
      date: today,
      status: status,
      checkIn: time,
      checkOut: null,
      notes: isLate ? 'Late check-in via employee portal' : 'Portal check-in',
      createdAt: new Date().toISOString()
    });
  }

  saveAttendance(att);
  toast('success', 'Checked In Successfully', `Recorded at ${time} (${status === 'late' ? 'Marked Late' : 'On Time'}).`);
  renderPage(STATE.currentPage);
}

function empCheckOut() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    toast('error', 'Unauthorized', 'Only linked employee accounts can check out.');
    return;
  }
  const curEmp = getEmployees().find(e => e.id === STATE.currentEmployee.id);
  if (!curEmp || curEmp.status !== 'active') {
    logout();
    toast('error', 'Account Inactive', 'Your employee profile is not active.');
    return;
  }
  const empId = STATE.currentEmployee.id;
  const today = todayStr();
  const time = nowTimeStr();
  const att = getAttendance();

  const existing = att.find(a => a.employeeId === empId && a.date === today);
  if (!existing || !existing.checkIn) {
    toast('warn', 'Check In First', 'You must check in before checking out.');
    return;
  }
  if (existing.checkOut) {
    toast('warn', 'Already Checked Out', `You already checked out today at ${existing.checkOut}.`);
    return;
  }

  existing.checkOut = time;
  existing.updatedAt = new Date().toISOString();
  saveAttendance(att);
  toast('success', 'Checked Out Successfully', `Recorded departure at ${time}. Have a good evening!`);
  renderPage(STATE.currentPage);
}

/* ── 16.1: Employee Dashboard ── */
function renderEmpDashboard() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee') {
    content.innerHTML = `<div class="empty-state"><p>Access restricted to employees.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  if (!emp) {
    content.innerHTML = `<div class="card" style="padding:40px"><div class="alert alert-error">Your login is not linked to an active employee record. Please contact the administrator.</div></div>`;
    return;
  }

  const today = todayStr();
  const att = getAttendance();
  const myTodayAtt = att.find(a => a.employeeId === emp.id && a.date === today);

  const leaves = getLeaves().filter(l => l.employeeId === emp.id);
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const approvedLeaves = leaves.filter(l => l.status === 'approved').length;

  const payslips = getPayslips().filter(p => p.employeeId === emp.id && p.status !== 'draft');
  const latestSlip = payslips.sort((a,b) => (b.month || '').localeCompare(a.month || ''))[0];

  const anns = getAnnouncements().filter(a => !a.targetDept || a.targetDept === 'All Staff' || a.targetDept === emp.department);
  const settings = getSettings();

  // Terminal status
  let termStatusHtml = '';
  let canCheckIn = false;
  let canCheckOut = false;

  if (!myTodayAtt || !myTodayAtt.checkIn) {
    termStatusHtml = `<span class="badge badge-draft">Not Checked In</span>`;
    canCheckIn = true;
  } else if (myTodayAtt.checkIn && !myTodayAtt.checkOut) {
    termStatusHtml = `<span class="badge badge-success">Active &bull; Checked in at ${myTodayAtt.checkIn}</span>`;
    canCheckOut = true;
  } else {
    termStatusHtml = `<span class="badge badge-success">Completed &bull; ${myTodayAtt.checkIn} - ${myTodayAtt.checkOut}</span>`;
  }

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Welcome back, ${escHtml(emp.name)}</h1>
      <p class="page-subtitle">${escHtml(emp.designation || 'Staff')} &bull; ${escHtml(emp.department || 'General')} &bull; ID: <strong>${escHtml(emp.employeeId || emp.id)}</strong></p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-primary" onclick="openEmpRequestLeaveModal()">${ICONS.plus} Request Leave</button>
    </div>
  </div>

  <!-- Attendance Terminal Card -->
  <div class="card section-gap" style="background:linear-gradient(135deg, #0F172A 0%, #1E293B 100%);color:#fff;border:none">
    <div class="card-body" style="padding:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px">
      <div>
        <div style="font-size:12px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.05em">Today's Attendance Terminal</div>
        <div style="font-size:28px;font-weight:700;margin:6px 0" id="emp-live-time">${nowTimeStr()}</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);display:flex;align-items:center;gap:10px">
          <span>${fmtDate(today)}</span>
          ${termStatusHtml}
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-accent btn-lg" onclick="empCheckIn()" ${canCheckIn ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}>
          ${ICONS.check} Check In
        </button>
        <button class="btn btn-secondary btn-lg" onclick="empCheckOut()" ${canCheckOut ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}>
          ${ICONS.clock} Check Out
        </button>
      </div>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.attendance}</div>
      <div class="stat-label">Today's Status</div>
      <div class="stat-value" style="font-size:18px">${myTodayAtt?.status ? myTodayAtt.status.toUpperCase() : 'ABSENT'}</div>
      <div class="stat-sub">${myTodayAtt?.checkIn ? 'In at ' + myTodayAtt.checkIn : 'No check-in yet'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.leaves}</div>
      <div class="stat-label">Pending Leaves</div>
      <div class="stat-value tabular">${pendingLeaves}</div>
      <div class="stat-sub">${approvedLeaves} approved this cycle</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.payslip}</div>
      <div class="stat-label">Latest Payslip</div>
      <div class="stat-value tabular" style="font-size:20px">${latestSlip ? fmtMoney(latestSlip.netSalary, settings.currency) : '—'}</div>
      <div class="stat-sub">${latestSlip ? monthLabel(latestSlip.month) : 'No payslips issued'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.announce}</div>
      <div class="stat-label">Announcements</div>
      <div class="stat-value tabular">${anns.length}</div>
      <div class="stat-sub">Relevant to your role</div>
    </div>
  </div>

  <div class="dash-grid">
    <div>
      <!-- Recent Personal Attendance -->
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.attendance} My Recent Attendance</h3>
          <button class="btn btn-ghost btn-sm" onclick="navigate('emp-attendance')">View All &rarr;</button>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
            <tbody>
              ${renderEmpRecentAttendanceRows(emp.id)}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Announcements -->
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.announce} Notice Board</h3>
          <button class="btn btn-ghost btn-sm" onclick="navigate('emp-announcements')">View All &rarr;</button>
        </div>
        <div class="card-body">
          ${anns.slice(0, 3).map(a => `
            <div style="padding:12px 0;border-bottom:1px solid var(--color-border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <strong style="font-size:14px">${escHtml(a.title)}</strong>
                <span class="badge badge-draft" style="font-size:10px">${fmtDate(a.createdAt?.slice(0,10))}</span>
              </div>
              <p style="font-size:13px;color:var(--color-text-muted);margin:0;line-height:1.4">${escHtml(a.body.slice(0, 140))}${a.body.length > 140 ? '...' : ''}</p>
            </div>
          `).join('') || '<p class="text-muted" style="font-size:13px">No bulletins posted.</p>'}
        </div>
      </div>
    </div>

    <div>
      <!-- Leave Status Card -->
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.leaves} Leave Requests</h3>
          <button class="btn btn-ghost btn-sm" onclick="navigate('emp-leaves')">View All &rarr;</button>
        </div>
        <div class="card-body">
          ${leaves.slice(0, 3).map(l => {
            const bc = l.status === 'approved' ? 'badge-success' : l.status === 'rejected' ? 'badge-error' : 'badge-warn';
            return `
            <div style="padding:10px 0;border-bottom:1px solid var(--color-border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span style="font-weight:600;font-size:13px">${escHtml(l.leaveType)}</span>
                <span class="badge ${bc}">${l.status}</span>
              </div>
              <div style="font-size:12px;color:var(--color-text-muted)">${fmtDate(l.startDate)} &ndash; ${fmtDate(l.endDate)}</div>
            </div>`;
          }).join('') || '<p class="text-muted" style="font-size:13px">No active leave requests.</p>'}
        </div>
      </div>

      <!-- Smart Helper for Employee -->
      ${renderHelperWidget(true)}
    </div>
  </div>

  ${renderEmpLeaveModalHtml()}
  `;
}

function renderEmpRecentAttendanceRows(empId) {
  const att = getAttendance().filter(a => a.employeeId === empId)
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);
  if (!att.length) {
    return `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--color-text-muted)">No attendance records logged yet.</td></tr>`;
  }
  return att.map(a => {
    const bc = a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warn' : 'badge-error';
    return `<tr>
      <td><strong>${fmtDate(a.date)}</strong></td>
      <td>${fmtTime(a.checkIn)}</td>
      <td>${fmtTime(a.checkOut)}</td>
      <td><span class="badge ${bc}">${a.status}</span></td>
    </tr>`;
  }).join('');
}

/* ── 16.2: Employee Attendance History ── */
function renderEmpAttendance() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    content.innerHTML = `<div class="empty-state"><p>Access restricted.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  const allAtt = getAttendance().filter(a => a.employeeId === emp.id)
    .sort((a,b) => (b.date || '').localeCompare(a.date || ''));

  const presentDays = allAtt.filter(a => a.status === 'present').length;
  const lateDays = allAtt.filter(a => a.status === 'late').length;
  const halfDays = allAtt.filter(a => a.status === 'half-day').length;

  const rows = allAtt.map(a => {
    const bc = a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warn' : 'badge-error';
    let duration = '—';
    if (a.checkIn && a.checkOut) {
      const [inH, inM] = a.checkIn.split(':').map(Number);
      const [outH, outM] = a.checkOut.split(':').map(Number);
      const mins = (outH * 60 + outM) - (inH * 60 + inM);
      if (mins > 0) duration = `${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
    return `<tr>
      <td><strong>${fmtDate(a.date)}</strong></td>
      <td><span class="badge ${bc}">${a.status}</span></td>
      <td>${fmtTime(a.checkIn)}</td>
      <td>${fmtTime(a.checkOut)}</td>
      <td>${duration}</td>
      <td style="font-size:12px;color:var(--color-text-muted)">${escHtml(a.notes || '—')}</td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">My Attendance History</h1>
      <p class="page-subtitle">Your personal check-in logs, punctuality metrics, and work session hours.</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.check}</div>
      <div class="stat-label">On-Time Days</div>
      <div class="stat-value tabular">${presentDays}</div>
      <div class="stat-sub">Present on time</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.warning}</div>
      <div class="stat-label">Late Arrivals</div>
      <div class="stat-value tabular">${lateDays}</div>
      <div class="stat-sub">Recorded as late</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.clock}</div>
      <div class="stat-label">Half-Day Sessions</div>
      <div class="stat-value tabular">${halfDays}</div>
      <div class="stat-sub">Partial hours</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.attendance}</div>
      <div class="stat-label">Total Days Logged</div>
      <div class="stat-value tabular">${allAtt.length}</div>
      <div class="stat-sub">All historical entries</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Duration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="6"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.attendance}</div><h3>No Attendance Records</h3><p>Use the Check In button on your dashboard to log attendance.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>
  `;
}

/* ── 16.3: Employee Leave Portal ── */
function renderEmpLeaves() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    content.innerHTML = `<div class="empty-state"><p>Access restricted.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  const settings = getSettings();
  const allLeaves = getLeaves().filter(l => l.employeeId === emp.id)
    .sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Calculate used leaves
  const approvedLeaves = allLeaves.filter(l => l.status === 'approved');
  const usedAnnual = approvedLeaves.filter(l => l.leaveType === 'Annual').reduce((sum, l) => sum + (l.days || 1), 0);
  const usedSick = approvedLeaves.filter(l => l.leaveType === 'Sick').reduce((sum, l) => sum + (l.days || 1), 0);
  const usedCasual = approvedLeaves.filter(l => l.leaveType === 'Casual').reduce((sum, l) => sum + (l.days || 1), 0);

  const annualQuota = settings.annualLeaveQuota || 20;
  const sickQuota = settings.sickLeaveQuota || 10;
  const casualQuota = settings.casualLeaveQuota || 10;

  const rows = allLeaves.map(l => {
    const bc = l.status === 'approved' ? 'badge-success' : l.status === 'rejected' ? 'badge-error' : 'badge-warn';
    const days = l.days || workingDaysBetween(l.startDate, l.endDate) || 1;

    return `<tr>
      <td><strong>#${escHtml(l.id.slice(-6))}</strong></td>
      <td><span class="badge badge-draft">${escHtml(l.leaveType)}</span></td>
      <td>
        <div><strong>${fmtDate(l.startDate)}</strong> &ndash; <strong>${fmtDate(l.endDate)}</strong></div>
        <div style="font-size:11px;color:var(--color-text-muted)">${days} working day${days > 1 ? 's' : ''}</div>
      </td>
      <td style="max-width:280px;white-space:normal;font-size:12px">${escHtml(l.reason || '—')}</td>
      <td style="font-size:12px">${fmtDate(l.createdAt?.slice(0,10) || todayStr())}</td>
      <td><span class="badge ${bc}">${l.status}</span></td>
      <td style="font-size:12px;color:var(--color-text-muted)">${l.reviewedBy ? 'Reviewed by ' + escHtml(l.reviewedBy) : 'Pending Admin review'}</td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">My Leave Requests</h1>
      <p class="page-subtitle">Track your leave balances, view status updates, and apply for time off.</p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-primary" onclick="openEmpRequestLeaveModal()">${ICONS.plus} Apply for Leave</button>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.leaves}</div>
      <div class="stat-label">Annual Leave Balance</div>
      <div class="stat-value tabular">${Math.max(0, annualQuota - usedAnnual)}<span style="font-size:16px;color:var(--color-text-muted)"> / ${annualQuota}</span></div>
      <div class="stat-sub">${usedAnnual} days taken this year</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.check}</div>
      <div class="stat-label">Sick Leave Balance</div>
      <div class="stat-value tabular">${Math.max(0, sickQuota - usedSick)}<span style="font-size:16px;color:var(--color-text-muted)"> / ${sickQuota}</span></div>
      <div class="stat-sub">${usedSick} days taken</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.clock}</div>
      <div class="stat-label">Casual Leave Balance</div>
      <div class="stat-value tabular">${Math.max(0, casualQuota - usedCasual)}<span style="font-size:16px;color:var(--color-text-muted)"> / ${casualQuota}</span></div>
      <div class="stat-sub">${usedCasual} days taken</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.dashboard}</div>
      <div class="stat-label">Pending Requests</div>
      <div class="stat-value tabular">${allLeaves.filter(l => l.status === 'pending').length}</div>
      <div class="stat-sub">Awaiting decision</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Type</th>
            <th>Duration</th>
            <th>Reason</th>
            <th>Applied On</th>
            <th>Status</th>
            <th>Review Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.leaves}</div><h3>No Leave Applications</h3><p>Click "Apply for Leave" above to submit your first request.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  ${renderEmpLeaveModalHtml()}
  `;
}

function renderEmpLeaveModalHtml() {
  return `
  <!-- Modal: Employee Request Leave -->
  <div class="modal-overlay" id="modal-emp-leave">
    <div class="modal">
      <div class="modal-header">
        <h2>${ICONS.leaves} Submit Leave Request</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-emp-leave')">${ICONS.x}</button>
      </div>
      <div class="modal-body">
        <form id="form-emp-leave" onsubmit="event.preventDefault();submitEmpLeave();">
          <div class="form-group">
            <label class="form-label" for="el-type">Leave Category <span class="req">*</span></label>
            <select class="form-control" id="el-type" required>
              <option value="Annual">Annual Leave (Vacation)</option>
              <option value="Sick">Sick Leave (Medical)</option>
              <option value="Casual">Casual Leave</option>
              <option value="Unpaid">Unpaid Leave</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="el-start">Start Date <span class="req">*</span></label>
              <input type="date" class="form-control" id="el-start" required onchange="calcLeaveDaysPreview()">
            </div>
            <div class="form-group">
              <label class="form-label" for="el-end">End Date <span class="req">*</span></label>
              <input type="date" class="form-control" id="el-end" required onchange="calcLeaveDaysPreview()">
            </div>
          </div>
          <div id="el-days-preview" style="font-size:12px;color:var(--color-text-muted);margin-bottom:12px"></div>
          <div class="form-group">
            <label class="form-label" for="el-reason">Reason for Leave <span class="req">*</span></label>
            <textarea class="form-control" id="el-reason" rows="3" placeholder="Provide details for your manager to review..." required></textarea>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-emp-leave')">Cancel</button>
        <button class="btn btn-primary" onclick="submitEmpLeave()">Submit Request</button>
      </div>
    </div>
  </div>`;
}

function openEmpRequestLeaveModal() {
  const sEl = document.getElementById('el-start');
  const eEl = document.getElementById('el-end');
  const rEl = document.getElementById('el-reason');
  if (sEl) sEl.value = todayStr();
  if (eEl) eEl.value = todayStr();
  if (rEl) rEl.value = '';
  calcLeaveDaysPreview();
  openModal('modal-emp-leave');
}

function calcLeaveDaysPreview() {
  const start = document.getElementById('el-start')?.value;
  const end = document.getElementById('el-end')?.value;
  const preview = document.getElementById('el-days-preview');
  if (!preview) return;
  if (!start || !end) { preview.innerHTML = ''; return; }
  if (end < start) {
    preview.innerHTML = `<span style="color:var(--color-error)">End date cannot be earlier than start date.</span>`;
    return;
  }
  const days = workingDaysBetween(start, end);
  preview.innerHTML = `Calculated duration: <strong>${days} working day${days > 1 ? 's' : ''}</strong> (excludes weekends).`;
}

function submitEmpLeave() {
  if (!STATE.currentUser || STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    toast('error', 'Unauthorized', 'Only authenticated employees can request leave.');
    return;
  }
  const curEmp = getEmployees().find(e => e.id === STATE.currentEmployee.id);
  if (!curEmp || curEmp.status !== 'active') {
    logout();
    toast('error', 'Account Inactive', 'Your employee profile is not active.');
    return;
  }
  const type = document.getElementById('el-type')?.value;
  const start = document.getElementById('el-start')?.value;
  const end = document.getElementById('el-end')?.value;
  const reason = document.getElementById('el-reason')?.value.trim();

  if (!type || !start || !end || !reason) {
    toast('warn', 'Missing Fields', 'Please fill in all leave request fields.');
    return;
  }
  if (end < start) {
    toast('error', 'Invalid Dates', 'End date must be on or after start date.');
    return;
  }

  const days = workingDaysBetween(start, end);
  if (days <= 0) {
    toast('warn', 'Zero Working Days', 'Selected period has 0 working days (e.g. only weekend days).');
    return;
  }

  const emp = STATE.currentEmployee;
  const leaves = getLeaves();

  leaves.unshift({
    id: genId('lv_'),
    employeeId: emp.id,
    leaveType: type,
    startDate: start,
    endDate: end,
    days: days,
    reason: reason,
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString()
  });

  saveLeaves(leaves);
  closeModal('modal-emp-leave');
  toast('success', 'Leave Submitted', 'Your request has been sent for administrator review.');
  renderPage(STATE.currentPage);
}

/* ── 16.4: Employee Payslips ── */
function renderEmpPayslips() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    content.innerHTML = `<div class="empty-state"><p>Access restricted.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  const settings = getSettings();
  const slips = getPayslips().filter(p => p.employeeId === emp.id && p.status !== 'draft')
    .sort((a,b) => (b.month || '').localeCompare(a.month || ''));

  const totalEarned = slips.filter(p => p.status === 'paid').reduce((sum, p) => sum + (Number(p.netSalary) || 0), 0);

  const rows = slips.map(p => {
    const statusBadge = p.status === 'paid'
      ? '<span class="badge badge-success">Paid</span>'
      : '<span class="badge badge-draft">Draft</span>';

    return `<tr>
      <td><strong>${escHtml(p.slipNumber || p.id)}</strong></td>
      <td><strong>${monthLabel(p.month)}</strong></td>
      <td class="tabular">${fmtMoney(p.basicSalary, settings.currency)}</td>
      <td class="tabular" style="color:var(--color-success)">+${fmtMoney(p.allowances || 0, settings.currency)}</td>
      <td class="tabular" style="color:var(--color-error)">-${fmtMoney(p.deductions || 0, settings.currency)}</td>
      <td class="tabular"><strong>${fmtMoney(p.netSalary, settings.currency)}</strong></td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="openViewPayslipModal('${p.id}')">
          ${ICONS.print} View / Print
        </button>
      </td>
    </tr>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">My Payslips</h1>
      <p class="page-subtitle">View, download, and print your verified salary statements.</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card">
      <div class="stat-icon">${ICONS.payslip}</div>
      <div class="stat-label">Total Disbursed</div>
      <div class="stat-value tabular">${fmtMoney(totalEarned, settings.currency)}</div>
      <div class="stat-sub">Paid salary to date</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.check}</div>
      <div class="stat-label">Vouchers on File</div>
      <div class="stat-value tabular">${slips.length}</div>
      <div class="stat-sub">Available statements</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">${ICONS.employees}</div>
      <div class="stat-label">Base Compensation</div>
      <div class="stat-value tabular">${fmtMoney(emp.salary, settings.currency)}</div>
      <div class="stat-sub">Monthly contracted rate</div>
    </div>
  </div>

  <div class="card section-gap">
    <div class="table-responsive">
      <table class="data-table">
        <thead>
          <tr>
            <th>Voucher #</th>
            <th>Month</th>
            <th>Basic</th>
            <th>Allowances</th>
            <th>Deductions</th>
            <th>Net Pay</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="8"><div class="empty-state" style="padding:40px"><div class="empty-icon">${ICONS.payslip}</div><h3>No Payslips Available</h3><p>Your employer has not issued any payslips for your account yet.</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal: View Printable Payslip -->
  <div class="modal-overlay" id="modal-view-payslip">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <h2>${ICONS.payslip} Pay Statement</h2>
        <button class="btn-modal-close" onclick="closeModal('modal-view-payslip')">${ICONS.x}</button>
      </div>
      <div class="modal-body" id="modal-view-payslip-body" style="padding:24px"></div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal('modal-view-payslip')">Close</button>
        <button class="btn btn-primary" onclick="window.print()">${ICONS.print} Print Statement</button>
      </div>
    </div>
  </div>
  `;
}

/* ── 16.5: Employee Announcements ── */
function renderEmpAnnouncements() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    content.innerHTML = `<div class="empty-state"><p>Access restricted.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  const anns = getAnnouncements().filter(a => !a.targetDept || a.targetDept === 'All Staff' || a.targetDept === emp.department)
    .sort((a,b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const cardsHtml = anns.map(a => {
    const catBadge = a.category === 'Urgent'
      ? '<span class="badge badge-error">Urgent</span>'
      : a.category === 'Policy'
      ? '<span class="badge badge-warn">Policy</span>'
      : a.category === 'Event'
      ? '<span class="badge badge-success">Event</span>'
      : '<span class="badge badge-draft">General</span>';

    return `
    <div class="card" style="margin-bottom:16px;border-left:4px solid ${a.pinned ? 'var(--color-primary)' : 'var(--color-border)'}">
      <div class="card-header" style="padding:14px 18px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          ${a.pinned ? `<span style="font-size:11px;font-weight:600;color:var(--color-primary)">${ICONS.warning} PINNED</span>` : ''}
          ${catBadge}
          <h3 style="margin:0;font-size:16px">${escHtml(a.title)}</h3>
        </div>
      </div>
      <div class="card-body" style="padding:16px 18px">
        <p style="white-space:pre-wrap;line-height:1.6;font-size:14px;color:var(--color-text)">${escHtml(a.body)}</p>
      </div>
      <div class="card-footer" style="padding:10px 18px;font-size:12px;color:var(--color-text-muted)">
        <span>Posted by <strong>${escHtml(a.author || 'Company Admin')}</strong></span>
        <span>${fmtDate(a.createdAt?.slice(0, 10))}</span>
      </div>
    </div>`;
  }).join('');

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">Company Bulletins &amp; Announcements</h1>
      <p class="page-subtitle">Official communications, company updates, and policy notifications.</p>
    </div>
  </div>

  <div style="margin-top:20px">
    ${cardsHtml || `
      <div class="card">
        <div class="empty-state" style="padding:48px">
          <div class="empty-icon">${ICONS.announce}</div>
          <h3>No Announcements</h3>
          <p>There are no active bulletins for your department at this time.</p>
        </div>
      </div>
    `}
  </div>
  `;
}

/* ── 16.6: Employee Profile & Security ── */
function renderEmpProfile() {
  const content = document.getElementById('page-content');
  if (STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    content.innerHTML = `<div class="empty-state"><p>Access restricted.</p></div>`;
    return;
  }
  const emp = STATE.currentEmployee;
  const user = STATE.currentUser;
  const settings = getSettings();

  content.innerHTML = `
  <div class="page-header">
    <div class="page-header-left">
      <h1 class="page-title">My Account &amp; Profile</h1>
      <p class="page-subtitle">Manage personal employee details and sign-in password.</p>
    </div>
  </div>

  <div class="dash-grid">
    <div>
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.user} Employee Record</h3>
          <span class="badge badge-success">Active Staff</span>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
            <div class="avatar-initials" style="width:54px;height:54px;font-size:18px">${initials(emp.name)}</div>
            <div>
              <h2 style="font-size:18px;margin:0">${escHtml(emp.name)}</h2>
              <div style="font-size:13px;color:var(--color-text-muted)">${escHtml(emp.designation || 'Staff')} &bull; ${escHtml(emp.department || 'General')}</div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:13px;border-top:1px solid var(--color-border);padding-top:16px">
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Employee ID</div>
              <div style="font-weight:600">${escHtml(emp.employeeId || emp.id)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Work Email</div>
              <div style="font-weight:600">${escHtml(emp.email)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Phone Number</div>
              <div style="font-weight:600">${escHtml(emp.phone || '—')}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Date of Joining</div>
              <div style="font-weight:600">${fmtDate(emp.joiningDate)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Monthly Base Salary</div>
              <div style="font-weight:600" class="tabular">${fmtMoney(emp.salary, settings.currency)}</div>
            </div>
            <div>
              <div class="text-muted" style="font-size:11px;text-transform:uppercase">Account Role</div>
              <div style="font-weight:600">Employee (Self-Service)</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="card section-gap">
        <div class="card-header">
          <h3>${ICONS.lock} Change Password</h3>
        </div>
        <div class="card-body">
          <form id="form-emp-pw" onsubmit="handleEmpPasswordChange(event)">
            <div class="form-group" id="fg-old-pw">
              <label class="form-label" for="emp-old-pw">Current Password <span class="req">*</span></label>
              <div class="input-password-wrap">
                <input class="form-control" id="emp-old-pw" type="password" required>
                <button type="button" class="btn-toggle-pw" onclick="togglePw('emp-old-pw', this)">${ICONS.eye}</button>
              </div>
              <div class="form-error-msg">Incorrect current password.</div>
            </div>
            <div class="form-group" id="fg-new-pw">
              <label class="form-label" for="emp-new-pw">New Password <span class="req">*</span></label>
              <div class="input-password-wrap">
                <input class="form-control" id="emp-new-pw" type="password" required placeholder="Min 8 chars, 1 number, 1 uppercase" oninput="updatePwStrength(this.value)">
                <button type="button" class="btn-toggle-pw" onclick="togglePw('emp-new-pw', this)">${ICONS.eye}</button>
              </div>
              <div class="pw-strength"><div class="pw-strength-bar"><div class="pw-strength-fill" id="pw-bar"></div></div></div>
              <div class="form-error-msg">Must be 8+ chars with at least 1 number and 1 uppercase letter.</div>
            </div>
            <div class="form-group" id="fg-confirm-pw">
              <label class="form-label" for="emp-confirm-pw">Confirm New Password <span class="req">*</span></label>
              <div class="input-password-wrap">
                <input class="form-control" id="emp-confirm-pw" type="password" required>
                <button type="button" class="btn-toggle-pw" onclick="togglePw('emp-confirm-pw', this)">${ICONS.eye}</button>
              </div>
              <div class="form-error-msg">Passwords do not match.</div>
            </div>
            <button type="submit" class="btn btn-primary">${ICONS.check} Update Password</button>
          </form>
        </div>
      </div>
    </div>
  </div>
  `;
}

function handleEmpPasswordChange(e) {
  e.preventDefault();
  if (!STATE.currentUser || STATE.currentUser.role !== 'employee' || !STATE.currentEmployee) {
    toast('error', 'Unauthorized', 'Only employees can update their portal password.');
    return;
  }
  const curEmp = getEmployees().find(e => e.id === STATE.currentEmployee.id);
  if (!curEmp || curEmp.status !== 'active') {
    logout();
    toast('error', 'Account Inactive', 'Your employee profile is not active.');
    return;
  }
  const oldPw = document.getElementById('emp-old-pw')?.value;
  const newPw = document.getElementById('emp-new-pw')?.value;
  const confirmPw = document.getElementById('emp-confirm-pw')?.value;

  const user = STATE.currentUser;
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx === -1) return;

  let valid = true;
  const setErr = (id, show) => {
    const fg = document.getElementById('fg-' + id);
    if (fg) fg.classList.toggle('has-error', show);
  };

  // Validate old password
  if (users[idx].passwordHash !== hashPassword(oldPw)) {
    setErr('old-pw', true);
    valid = false;
  } else {
    setErr('old-pw', false);
  }

  // Validate new password strength
  const { has } = checkPasswordStrength(newPw);
  if (!has.len || !has.num || !has.upper) {
    setErr('new-pw', true);
    valid = false;
  } else {
    setErr('new-pw', false);
  }

  // Validate match
  if (newPw !== confirmPw) {
    setErr('confirm-pw', true);
    valid = false;
  } else {
    setErr('confirm-pw', false);
  }

  if (!valid) return;

  users[idx].passwordHash = hashPassword(newPw);
  users[idx].updatedAt = new Date().toISOString();
  saveUsers(users);
  if (STATE.currentUser && STATE.currentUser.id === users[idx].id) {
    STATE.currentUser.passwordHash = users[idx].passwordHash;
  }

  toast('success', 'Password Updated', 'Your sign-in password has been changed successfully.');
  document.getElementById('emp-old-pw').value = '';
  document.getElementById('emp-new-pw').value = '';
  document.getElementById('emp-confirm-pw').value = '';
  const pwBar = document.getElementById('pw-bar');
  if (pwBar) pwBar.style.width = '0%';
}


/* SECTION 17: APPLICATION BOOTSTRAP & EVENT LISTENERS */

function initApp() {
  const initialized = isInitialized();
  if (!initialized) {
    renderAuthScreen();
    showAuthTab('setup');
    return;
  }

  const session = sessGet(SESSION_KEY);
  if (!session || !session.userId) {
    renderAuthScreen();
    showAuthTab('admin');
    return;
  }

  const users = getUsers();
  const user = users.find(u => u.id === session.userId && !u.disabled);
  if (!user) {
    sessClear();
    renderAuthScreen();
    showAuthTab('admin');
    return;
  }

  STATE.currentUser = { ...user };
  if (user.role === 'employee') {
    const employees = getEmployees();
    const emp = employees.find(e => e.id === user.employeeId || (e.employeeId && e.employeeId === user.employeeId)) || null;
    if (!emp || emp.status !== 'active' || user.disabled) {
      sessClear();
      STATE.currentUser = null;
      STATE.currentEmployee = null;
      renderAuthScreen();
      showAuthTab('employee');
      toast('error', 'Account Inactive', 'Your employee profile is not active.');
      return;
    }
    STATE.currentEmployee = emp;
  } else {
    STATE.currentEmployee = null;
  }

  const defaultPage = user.role === 'admin' ? 'dashboard' : 'emp-dashboard';
  navigate(defaultPage);
}

// Global modal overlay click handler
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeAllModals();
  }
  if (e.target.id === 'sidebar-overlay') {
    closeSidebar();
  }
});

// Boot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
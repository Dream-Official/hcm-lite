const fs = require('fs');

let code = fs.readFileSync('app.js', 'utf8');

// 1. Replace the duplicated Sections 6 & 7 (from Line 240 up to Section 8 Shell)
const sec6Marker = '/* ─────────────────────────────────────────────\r\n   SECTION 6: ROUTER / RENDER ENGINE';
let sec6Start = code.indexOf(sec6Marker);
if (sec6Start === -1) {
  sec6Start = code.indexOf('/* ─────────────────────────────────────────────\n   SECTION 6: ROUTER / RENDER ENGINE');
}

const sec8Marker = '/* SECTION 8: SHELL */';
const sec8Idx = code.indexOf(sec8Marker);

if (sec6Start === -1 || sec8Idx === -1) {
  console.error('Markers not found! sec6Start:', sec6Start, 'sec8Idx:', sec8Idx);
  process.exit(1);
}

let replaceEnd = sec8Idx;
if (code.charCodeAt(replaceEnd - 1) === 0xFEFF) {
  replaceEnd--;
}

const consolidatedSec6And7 = `/* ─────────────────────────────────────────────
   SECTION 6: ROUTER / RENDER ENGINE
───────────────────────────────────────────── */
function navigate(page, params = {}) {
  if (!STATE.currentUser) { renderAuthScreen(); return; }
  const role = STATE.currentUser.role;
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
  app.innerHTML = \`
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
        \${!initialized ? \`<button class="auth-tab active" id="tab-setup" onclick="showAuthTab('setup')">Setup Wizard</button>\` : ''}
        <button class="auth-tab \${initialized?'active':''}" id="tab-admin" onclick="showAuthTab('admin')">Admin Login</button>
        <button class="auth-tab" id="tab-employee" onclick="showAuthTab('employee')">Employee Portal</button>
      </div>
      <div class="auth-body" id="auth-body">
        \${!initialized ? renderSetupForm() : renderLoginForm('admin')}
      </div>
      <div class="auth-footer">
        Vanilla JS + HTML5 + CSS3 &bull; Browser localStorage &bull; Zero Backend Dependencies<br>
        HCM Lite v1.0 &bull; Client Storage Sandbox
      </div>
    </div>
  </div>\`;
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
  return \`
  <div class="info-banner">
    \${ICONS.info}
    <p><strong>System Initialization</strong><br>No company configuration detected. Create your organization profile and master Admin account to initialize the system.</p>
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
      <label class="form-label" for="setup-pw">Master Password <span class="req">*</span></label>
      <div class="input-password-wrap">
        <input class="form-control" id="setup-pw" type="password" placeholder="Min 8 characters" oninput="updatePwStrength(this.value)" required>
        <button type="button" class="btn-toggle-pw" onclick="togglePw('setup-pw',this)">\${ICONS.eye}</button>
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
        <button type="button" class="btn-toggle-pw" onclick="togglePw('setup-confirm',this)">\${ICONS.eye}</button>
      </div>
      <div class="form-error-msg">Passwords do not match.</div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:8px">
      \${ICONS.lock} Initialize Company &amp; Create Master Admin
    </button>
  </form>\`;
}

function renderLoginForm(role) {
  return \`
  <form id="login-form" onsubmit="handleLogin(event,'\${role}')" novalidate>
    <div class="form-group" id="fg-le">
      <label class="form-label" for="login-email">\${role === 'admin' ? 'Email Address' : 'Email Address or Employee ID'} <span class="req">*</span></label>
      <input class="form-control" id="login-email" type="\${role === 'admin' ? 'email' : 'text'}" placeholder="\${role === 'admin' ? 'admin@company.com' : 'employee@company.com or EMP-001'}" required autocomplete="username">
      <div class="form-error-msg" id="login-err">Invalid email or password. Please try again.</div>
    </div>
    <div class="form-group" id="fg-lp">
      <label class="form-label" for="login-pw">Password <span class="req">*</span></label>
      <div class="input-password-wrap">
        <input class="form-control" id="login-pw" type="password" required autocomplete="current-password" placeholder="Enter your password">
        <button type="button" class="btn-toggle-pw" onclick="togglePw('login-pw',this)">\${ICONS.eye}</button>
      </div>
    </div>
    <button type="submit" class="btn btn-primary btn-lg w-full" style="justify-content:center;margin-top:8px">
      \${ICONS.lock} Sign In as \${role === 'admin' ? 'Administrator' : 'Employee'}
    </button>
  </form>\`;
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('adminemail', true); valid = false; } else setErr('adminemail', false);
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
  toast('success', 'Company initialized!', \`Welcome, \${name}. Please sign in.\`);
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
    if (emp.status === 'inactive') {
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
  STATE.currentUser = null;
  STATE.currentEmployee = null;
  STATE.currentPage = null;
  renderAuthScreen();
}

`;

code = code.substring(0, sec6Start) + consolidatedSec6And7 + code.substring(replaceEnd);

// 2. Update Section 10 (Employee Management)
const sec10Marker = '/* SECTION 10: EMPLOYEE MANAGEMENT */';
let sec10Start = code.indexOf(sec10Marker);
if (sec10Start === -1) {
  // Check with BOM
  sec10Start = code.indexOf('\uFEFF/* SECTION 10: EMPLOYEE MANAGEMENT */');
}

const sec11Marker = '/* SECTION 11: ATTENDANCE MANAGEMENT (ADMIN) */';
const sec11Idx = code.indexOf(sec11Marker);

if (sec10Start === -1 || sec11Idx === -1) {
  console.error('Section 10 or 11 markers not found! sec10Start:', sec10Start, 'sec11Idx:', sec11Idx);
  process.exit(1);
}

const newSec10 = `/* SECTION 10: EMPLOYEE MANAGEMENT */
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
  content.innerHTML=\`
  <div class="page-header">
    <div class="page-header-left"><h1 class="page-title">Employee Management</h1><p class="page-subtitle">Manage company roster, credentials and employment details.</p></div>
    <div class="page-header-actions"><button class="btn btn-primary" onclick="openAddEmployeeModal()">\${ICONS.plus} Add New Employee</button></div>
  </div>
  <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value tabular">\${employees.filter(e=>e.status==='active').length}</div></div>
    <div class="stat-card"><div class="stat-label">Departments</div><div class="stat-value tabular">\${departments.length}</div></div>
    <div class="stat-card"><div class="stat-label">Total Records</div><div class="stat-value tabular">\${employees.length}</div></div>
  </div>
  <div class="table-wrap">
    <div class="table-toolbar">
      <div class="search-input-wrap" style="flex:1;min-width:180px"><span class="search-icon">\${ICONS.search}</span>
        <input class="form-control" id="emp-search" placeholder="Search name, email or ID..." value="\${escHtml(_empSearch)}" oninput="filterEmployees(this.value)"></div>
      <select class="form-control" style="width:auto;min-width:150px" onchange="filterEmployeesByDept(this.value)">
        <option value="all">All Departments</option>
        \${departments.map(d=>\`<option value="\${escHtml(d)}" \${_empDeptFilter===d?'selected':''}>\${escHtml(d)}</option>\`).join('')}
      </select>
      <select class="form-control" style="width:auto" onchange="filterEmployeesByStatus(this.value)">
        <option value="all">All Statuses</option>
        <option value="active" \${_empStatusFilter==='active'?'selected':''}>Active</option>
        <option value="inactive" \${_empStatusFilter==='inactive'?'selected':''}>Inactive</option>
      </select>
    </div>
    <div class="table-responsive"><table class="data-table">
      <thead><tr><th>ID</th><th>Name &amp; Email</th><th>Department</th><th>Designation</th><th>Base Salary</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="emp-table-body"></tbody>
    </table></div>
    <div class="table-footer"><span id="emp-count-label">Loading...</span><div style="display:flex;gap:6px"><button class="btn btn-secondary btn-sm" id="emp-prev" onclick="empPrevPage()">Previous</button><button class="btn btn-secondary btn-sm" id="emp-next" onclick="empNextPage()">Next</button></div></div>
  </div>
  <div class="modal-overlay" id="modal-add-employee"><div class="modal modal-lg">
    <div class="modal-header"><h2>\${ICONS.plus} Add New Employee</h2><button class="btn-modal-close" onclick="closeModal('modal-add-employee')">\${ICONS.x}</button></div>
    <div class="modal-body"><form id="add-emp-form" onsubmit="handleAddEmployee(event)" novalidate>
      <div class="form-row">
        <div class="form-group" id="fg-ae-name"><label class="form-label" for="ae-name">Full Name <span class="req">*</span></label><input class="form-control" id="ae-name" required placeholder="Employee full name"><div class="form-error-msg">Full name is required.</div></div>
        <div class="form-group" id="fg-ae-email"><label class="form-label" for="ae-email">Email <span class="req">*</span></label><input class="form-control" id="ae-email" type="email" required placeholder="employee@company.com" oninput="syncAddEmpLoginEmail(this.value)"><div class="form-error-msg">Valid unique email required.</div></div>
      </div>
      <div class="form-row">
        <div class="form-group" id="fg-ae-dept"><label class="form-label" for="ae-dept">Department <span class="req">*</span></label><input class="form-control" id="ae-dept" required placeholder="e.g., Engineering" list="ae-dept-list"><datalist id="ae-dept-list">\${departments.map(d=>\`<option value="\${escHtml(d)}">\`).join('')}</datalist><div class="form-error-msg">Department is required.</div></div>
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
          <span style="display:flex;align-items:center;gap:6px">\${ICONS.lock} Create Portal Login Credentials for this Employee</span>
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
                <button type="button" class="btn-toggle-pw" onclick="togglePw('ae-pw',this)">\${ICONS.eye}</button>
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
                <button type="button" class="btn-toggle-pw" onclick="togglePw('ae-confirm',this)">\${ICONS.eye}</button>
              </div>
              <div class="form-error-msg">Passwords do not match.</div>
            </div>
          </div>
        </div>
      </div>
    </form></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-add-employee')">Cancel</button><button class="btn btn-primary" onclick="document.getElementById('add-emp-form').requestSubmit()">\${ICONS.plus} Add Employee</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-edit-employee"><div class="modal modal-lg">
    <div class="modal-header"><h2>Edit Employee</h2><button class="btn-modal-close" onclick="closeModal('modal-edit-employee')">\${ICONS.x}</button></div>
    <div class="modal-body" id="edit-emp-body"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-edit-employee')">Cancel</button><button class="btn btn-primary" onclick="document.getElementById('edit-emp-form')?.requestSubmit()">Save Changes</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-delete-employee"><div class="modal" style="max-width:420px">
    <div class="modal-header"><h2>Confirm Deactivation</h2><button class="btn-modal-close" onclick="closeModal('modal-delete-employee')">\${ICONS.x}</button></div>
    <div class="modal-body text-center">
      <div class="confirm-icon"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg></div>
      <h3 style="margin-bottom:8px" id="del-emp-title">Deactivate Employee?</h3>
      <p id="del-emp-msg" style="font-size:13px;color:var(--color-text-muted)">Employee will be marked inactive.</p>
    </div>
    <div class="modal-footer" style="justify-content:center;gap:12px"><button class="btn btn-secondary" onclick="closeModal('modal-delete-employee')">Cancel</button><button class="btn btn-danger" id="del-emp-confirm-btn">Deactivate</button></div>
  </div></div>
  <div class="modal-overlay" id="modal-create-account"><div class="modal">
    <div class="modal-header"><h2 id="create-acc-title">\${ICONS.lock} Create Employee Login</h2><button class="btn-modal-close" onclick="closeModal('modal-create-account')">\${ICONS.x}</button></div>
    <div class="modal-body" id="create-acc-body"></div>
    <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('modal-create-account')">Cancel</button><button class="btn btn-primary" id="create-acc-submit-btn" onclick="document.getElementById('create-acc-form')?.requestSubmit()">Create Login</button></div>
  </div></div>\`;
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
    tbody.innerHTML=\`<tr><td colspan="8"><div class="empty-state" style="padding:40px"><div class="empty-icon">\${ICONS.employees}</div><h3>No Employees Registered</h3><p>Add the first employee to get started.</p><button class="btn btn-primary" onclick="openAddEmployeeModal()">\${ICONS.plus} Add Employee</button></div></td></tr>\`;
  } else {
    tbody.innerHTML=page.map(emp=>{
      const hasAcc=users.some(u=>(u.employeeId===emp.id || u.employeeId===emp.employeeId || (u.email && u.email.toLowerCase()===emp.email.toLowerCase())) && !u.disabled);
      const bc=emp.status==='active'?'badge-success':'badge-draft';
      return \`<tr>
        <td><span class="badge badge-accent">\${escHtml(emp.employeeId)}</span></td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar-initials" style="width:30px;height:30px;font-size:11px">\${initials(emp.name)}</div><div><div style="font-weight:600">\${escHtml(emp.name)}</div><div class="cell-sub">\${escHtml(emp.email)}</div></div></div></td>
        <td>\${escHtml(emp.department||'—')}</td>
        <td>\${escHtml(emp.designation||'—')}</td>
        <td class="tabular">\${fmtMoney(emp.salary,settings.currency)}</td>
        <td>\${fmtDate(emp.joinDate)}</td>
        <td><span class="badge \${bc}">\${emp.status}</span></td>
        <td><div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-secondary btn-sm btn-icon" title="Edit Employee" onclick="openEditEmployee('\${emp.id}')">\${ICONS.edit}</button>
          \${!hasAcc ? 
            \`<button class="btn btn-accent btn-sm" onclick="openCreateAccount('\${emp.id}')" title="Create Login Account">\${ICONS.lock} Create Login</button>\` : 
            \`<button class="btn btn-secondary btn-sm" onclick="openCreateAccount('\${emp.id}')" title="Update / Reset Login Credentials" style="color:var(--color-teal);border-color:var(--color-teal)"><span class="badge badge-teal" style="margin-right:2px;padding:0 4px;font-size:10px">&#10003;</span> Reset Login</button>\`
          }
          <button class="btn btn-danger btn-sm btn-icon" title="Deactivate" onclick="openDeleteEmployee('\${emp.id}')">\${ICONS.trash}</button>
        </div></td>
      </tr>\`;
    }).join('');
  }
  const cl=document.getElementById('emp-count-label');
  if(cl) cl.textContent=\`Showing \${emps.length?start+1:0}–\${Math.min(start+EMP_PAGE_SIZE,emps.length)} of \${emps.length} entries\`;
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
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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
  toast('success', 'Employee Added', createAccount ? \`\${name} (\${emp.employeeId}) registered with portal credentials.\` : \`\${name} (\${emp.employeeId}) registered.\`);
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
  body.innerHTML=\`<form id="edit-emp-form" onsubmit="handleEditEmployee(event,'\${empId}')" novalidate>
    <div class="form-row">
      <div class="form-group" id="fg-ee-name"><label class="form-label">Full Name <span class="req">*</span></label><input class="form-control" id="ee-name" value="\${escHtml(emp.name)}" required><div class="form-error-msg">Required.</div></div>
      <div class="form-group" id="fg-ee-email"><label class="form-label">Email <span class="req">*</span></label><input class="form-control" id="ee-email" type="email" value="\${escHtml(emp.email)}" required><div class="form-error-msg">Valid unique email required.</div></div>
    </div>
    <div class="form-row">
      <div class="form-group" id="fg-ee-dept"><label class="form-label">Department <span class="req">*</span></label><input class="form-control" id="ee-dept" value="\${escHtml(emp.department||'')}" required list="ee-dept-list"><datalist id="ee-dept-list">\${departments.map(d=>\`<option value="\${escHtml(d)}">\`).join('')}</datalist><div class="form-error-msg">Required.</div></div>
      <div class="form-group" id="fg-ee-desig"><label class="form-label">Designation <span class="req">*</span></label><input class="form-control" id="ee-desig" value="\${escHtml(emp.designation||'')}" required><div class="form-error-msg">Required.</div></div>
    </div>
    <div class="form-row">
      <div class="form-group" id="fg-ee-salary"><label class="form-label">Base Salary <span class="req">*</span></label><input class="form-control" id="ee-salary" type="number" min="0" value="\${emp.salary||0}" required><div class="form-error-msg">Required.</div></div>
      <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="ee-status"><option value="active" \${emp.status==='active'?'selected':''}>Active</option><option value="inactive" \${emp.status==='inactive'?'selected':''}>Inactive</option></select></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="ee-phone" value="\${escHtml(emp.phone||'')}"></div>
  </form>\`;
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
  if(!email||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)||employees.some(emp=>emp.email===email&&emp.id!==empId)){setErr('email',true);valid=false;}else setErr('email',false);
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
  if(title) title.textContent=\`Deactivate \${emp.name}?\`;
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

  const users = getUsers();
  const existingUser = users.find(u => u.employeeId === empId || u.employeeId === emp.employeeId);
  const isEdit = !!existingUser;

  const body = document.getElementById('create-acc-body');
  const modalTitle = document.getElementById('create-acc-title');
  const submitBtn = document.getElementById('create-acc-submit-btn');

  if (modalTitle) {
    modalTitle.innerHTML = \`\${ICONS.lock} \${isEdit ? 'Update / Reset Employee Login' : 'Create Employee Login'}\`;
  }
  if (submitBtn) {
    submitBtn.textContent = isEdit ? 'Update Credentials' : 'Create Login';
  }

  body.innerHTML = \`
    <div class="alert alert-info">
      \${ICONS.info}
      <div>
        <strong>\${escHtml(emp.name)}</strong> (\${escHtml(emp.employeeId)}) &bull; \${escHtml(emp.department || 'General')}
        <div style="font-size:12px;margin-top:2px">\${isEdit ? 'Existing login found. You can update the sign-in email or assign a new password.' : 'Configure portal sign-in credentials for this employee.'}</div>
      </div>
    </div>
    <form id="create-acc-form" onsubmit="handleCreateAccount(event,'\${empId}')" novalidate>
      <div class="form-group" id="fg-ca-email">
        <label class="form-label" for="ca-email">Login Email (Username) <span class="req">*</span></label>
        <input class="form-control" id="ca-email" type="email" value="\${escHtml(existingUser ? existingUser.email : emp.email)}" required placeholder="employee@company.com">
        <div class="form-error-msg" id="ca-email-err">Valid unique email required.</div>
      </div>
      <div class="form-group" id="fg-ca-pw">
        <label class="form-label" for="ca-pw">\${isEdit ? 'New Password' : 'Initial Password'} <span class="req">*</span></label>
        <div class="input-password-wrap">
          <input class="form-control" id="ca-pw" type="password" required placeholder="Min 8 chars, 1 number, 1 uppercase" oninput="updatePwStrength(this.value, 'ca-pw-bar', 'ca-req-')">
          <button type="button" class="btn-toggle-pw" onclick="togglePw('ca-pw',this)">\${ICONS.eye}</button>
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
          <button type="button" class="btn-toggle-pw" onclick="togglePw('ca-confirm',this)">\${ICONS.eye}</button>
        </div>
        <div class="form-error-msg">Passwords do not match.</div>
      </div>
    </form>\`;

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

  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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
    toast('success', 'Credentials Updated', \`Login credentials for \${emp.name} have been updated.\`);
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
    toast('success', 'Login Created', \`\${emp.name} can now sign in using \${loginEmail} or \${emp.employeeId}.\`);
  }

  renderEmployees();
}

`;

code = code.substring(0, sec10Start) + newSec10 + code.substring(sec11Idx);

// 3. Update initApp in Section 17
const initAppOld = `  STATE.currentUser = { ...user };
  if (user.role === 'employee' && user.employeeId) {
    STATE.currentEmployee = getEmployees().find(e => e.id === user.employeeId) || null;
  } else {
    STATE.currentEmployee = null;
  }`;

const initAppNew = `  STATE.currentUser = { ...user };
  if (user.role === 'employee') {
    const employees = getEmployees();
    const emp = employees.find(e => e.id === user.employeeId || (e.employeeId && e.employeeId === user.employeeId)) || null;
    if (!emp || emp.status === 'inactive') {
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
  }`;

if (code.includes(initAppOld)) {
  code = code.replace(initAppOld, initAppNew);
  console.log('initApp updated successfully.');
} else {
  console.warn('initAppOld match not found, checking with alternate whitespace.');
  const regex = /STATE\.currentUser\s*=\s*\{\s*\.\.\.user\s*\};\s*if\s*\(\s*user\.role\s*===\s*'employee'\s*&&\s*user\.employeeId\s*\)\s*\{\s*STATE\.currentEmployee\s*=\s*getEmployees\(\)\.find\(\s*e\s*=>\s*e\.id\s*===\s*user\.employeeId\s*\)\s*\|\|\s*null;\s*\}\s*else\s*\{\s*STATE\.currentEmployee\s*=\s*null;\s*\}/;
  if (regex.test(code)) {
    code = code.replace(regex, initAppNew);
    console.log('initApp updated via regex.');
  } else {
    console.error('Failed to locate initApp section');
    process.exit(1);
  }
}

fs.writeFileSync('app.js', code, 'utf8');
console.log('app.js updated successfully!');

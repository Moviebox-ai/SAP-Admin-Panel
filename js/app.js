// ═══════════════════════════════════════════════════════════════
//  Self Attendance Pro — Admin Panel (Firebase Connected)
// ═══════════════════════════════════════════════════════════════

let currentPage = 'dashboard';
let isDark = false;
let sidebarOpen = false;
let charts = {};
let attSelectedUser = null;
let attSelectedYM   = null;

// ── Auth ──────────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');

  if (!email || !pass) {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Please enter email and password.';
    return;
  }
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Signing in…';

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    // onAuthStateChanged in firebase-config.js handles navigation
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Sign In with Firebase';
    errEl.classList.remove('hidden');
    const msgs = {
      'auth/user-not-found':         'No account found with this email.',
      'auth/wrong-password':         'Incorrect password.',
      'auth/invalid-credential':     'Invalid email or password.',
      'auth/invalid-email':          'Invalid email address.',
      'auth/too-many-requests':      'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    errEl.textContent = msgs[e.code] || e.message;
  }
}

function handleLogout() { auth.signOut(); }

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

document.addEventListener('keydown', e => {
  const loginVisible = !document.getElementById('loginScreen').classList.contains('hidden');
  if (e.key === 'Enter' && loginVisible) handleLogin();
});

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeLabel').textContent = isDark ? 'Dark' : 'Light';
  document.getElementById('themeIcon').innerHTML = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  setTimeout(() => {
    if (currentPage === 'dashboard') renderDashboardCharts();
    if (currentPage === 'analytics') initAnalyticsCharts();
  }, 60);
}

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  let ov = document.getElementById('sidebarOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'sidebarOverlay';
    ov.className = 'sidebar-overlay';
    ov.onclick = toggleSidebar;
    document.body.appendChild(ov);
  }
  ov.classList.toggle('show', sidebarOpen);
}

// ── Back-button support via History API ───────────────────────
// Intercept browser/Android back so it navigates between pages
// instead of closing the app.
window.addEventListener('popstate', (e) => {
  const page = e.state?.page;
  // Only handle popstate when the main app is visible
  const mainApp = document.getElementById('mainApp');
  if (!mainApp || mainApp.classList.contains('hidden')) return;
  if (page && page !== currentPage) {
    _navigateInternal(page); // navigate without pushing another history entry
  } else {
    // No previous page in history — stay on dashboard instead of closing
    if (currentPage !== 'dashboard') {
      history.pushState({ page: 'dashboard' }, '', '#dashboard');
      _navigateInternal('dashboard');
    } else {
      // Already on dashboard: push a dummy entry so next back press stays here
      history.pushState({ page: 'dashboard' }, '', '#dashboard');
    }
  }
});

// ── Navigation ────────────────────────────────────────────────
async function navigate(page) {
  // Push to browser history so back button works
  if (page !== currentPage || location.hash !== '#' + page) {
    history.pushState({ page }, '', '#' + page);
  }
  await _navigateInternal(page);
}

async function _navigateInternal(page) {
  currentPage = page;
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  charts = {};

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.page === page));

  const titles = {
    dashboard:  ['Dashboard',       'Live Firebase data'],
    analytics:  ['Analytics',       'Trends & insights'],
    users:      ['Users',           `${ALL_USERS.length} registered users`],
    attendance: ['Attendance',      'All attendance records'],
    salary:     ['Salary Reports',  'Salary breakdown'],
    settings:   ['Settings & Rules','Admin configuration'],
  };
  const [title, sub] = titles[page] || ['Admin', ''];
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('pageSubtitle').textContent = sub;

  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="flex items-center justify-center py-20"><div class="spinner"></div></div>';

  let html = '';
  try {
    html = await buildPage(page);
  } catch(e) {
    html = fbErrorBanner(e);
  }

  content.innerHTML = `<div class="page-enter">${html}</div>`;

  setTimeout(() => {
    if (page === 'dashboard') renderDashboardCharts();
    if (page === 'analytics') initAnalyticsCharts();
  }, 60);

  if (sidebarOpen) toggleSidebar();
}

// ── Global search ─────────────────────────────────────────────
function handleGlobalSearch(q) {
  if (!q.trim()) { closeSearchDropdown(); return; }
  const results = ALL_USERS.filter(u =>
    (u.name  || '').toLowerCase().includes(q.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(q.toLowerCase()) ||
    (u.uniqueId || '').includes(q) ||
    (u.id    || '').includes(q)
  ).slice(0, 6);

  let dd = document.getElementById('searchDropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'searchDropdown';
    dd.style.cssText = 'position:absolute;top:64px;right:16px;width:300px;z-index:50;background:var(--card-bg);border:1px solid var(--divider);border-radius:16px;padding:8px;box-shadow:0 16px 48px rgba(0,0,0,.15);';
    document.querySelector('.topbar').style.position = 'relative';
    document.querySelector('.topbar').appendChild(dd);
  }
  if (!results.length) {
    dd.innerHTML = '<div style="padding:16px;color:var(--text-secondary);font-size:14px;text-align:center;">No users found</div>';
    return;
  }
  dd.innerHTML = results.map(u => `
    <div class="search-result-item" onclick="showUserDetail('${u.id}');closeSearchDropdown()">
      ${avatar(u.name || '?')}
      <div style="min-width:0">
        <div style="font-weight:600;font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.name || 'Unnamed'}</div>
        <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.id} · #${u.uniqueId || '—'}</div>
      </div>
    </div>`).join('');
}

function closeSearchDropdown() {
  const dd = document.getElementById('searchDropdown');
  if (dd) dd.remove();
}
document.addEventListener('click', e => {
  if (!e.target.closest('#globalSearch') && !e.target.closest('#searchDropdown')) closeSearchDropdown();
});

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
function fmtINR(n, currency) {
  const syms = { INR:'₹',USD:'$',EUR:'€',GBP:'£',AED:'د.إ',SAR:'﷼',SGD:'S$',MYR:'RM',CAD:'C$',AUD:'A$',PKR:'₨' };
  return (syms[currency] || '₹') + Math.round(n || 0).toLocaleString('en-IN');
}

function avatar(name, extraStyle='') {
  const initials = (name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
  return `<div class="avatar" style="${extraStyle}">${initials}</div>`;
}

function statusBadge(status) {
  if (status === 'PRESENT')              return `<span class="badge badge-present">✓ Present</span>`;
  if (status === 'HALF' || status === 'HALF_DAY') return `<span class="badge badge-half">◐ Half Day</span>`;
  if (status === 'ABSENT')               return `<span class="badge badge-absent">✕ Absent</span>`;
  if (status === 'NONE')                 return `<span class="text-secondary text-sm">—</span>`;
  return `<span class="text-secondary text-sm">${status || '—'}</span>`;
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
}

function attSummary(records) {
  const present = records.filter(r => r.status === 'PRESENT').length;
  const half    = records.filter(r => r.status === 'HALF' || r.status === 'HALF_DAY').length;
  const absent  = records.filter(r => r.status === 'ABSENT').length;
  const total   = records.length;
  const pct     = total ? Math.round(((present + half * 0.5) / total) * 100) : 0;
  return { present, half, absent, total, pct };
}

function estimatedSalary(user, summary) {
  const wd  = user.workingDays || 26;
  const sal = user.monthlySalary || 0;
  const eff = summary.present + summary.half * 0.5;
  return wd > 0 ? Math.round((sal / wd) * eff) : 0;
}

function chartColors() {
  return {
    text: isDark ? '#B0A8CC' : '#6B7280',
    grid: isDark ? '#2D2460' : '#EDE9FE',
  };
}

function emptyState(msg) {
  return `<div class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
    <p class="text-base mt-2">${msg}</p>
  </div>`;
}

function fbErrorBanner(e) {
  const hint = e.code === 'permission-denied'
    ? '<br><small>Check that your UID is in <code>adminSettings/adminConfig.adminUids</code> and apply <strong>FIRESTORE_RULES_PATCH.md</strong>.</small>'
    : '';
  return `<div class="fb-error"><strong>Firebase Error:</strong> ${e.message}${hint}</div>`;
}

function attRulesMissingBanner() {
  return `<div class="fb-error" style="margin-bottom:16px">
    <strong>Attendance Read Blocked</strong> — Firestore rules need updating.<br>
    <small>Apply the <strong>attendance</strong> patch from <code>FIRESTORE_RULES_PATCH.md</code>:
    add <code>|| isAdmin()</code> to the read rule inside <code>match /attendance/{uid}/days/{date}</code>.</small>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  PAGE ROUTER
// ═══════════════════════════════════════════════════════════════
async function buildPage(page) {
  switch(page) {
    case 'dashboard':  return await buildDashboard();
    case 'analytics':  return buildAnalytics();
    case 'users':      return buildUsers();
    case 'attendance': return await buildAttendance();
    case 'salary':     return await buildSalary();
    case 'settings':   return buildSettings();
    default:           return '<p>Page not found</p>';
  }
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function buildDashboard() {
  const ym     = currentYM();
  const sample = ALL_USERS.slice(0, 8);

  // Load attendance for sample users in parallel
  const attData = await Promise.all(sample.map(u => loadAttendance(u.id, ym)));

  let totalPresent = 0, totalHalf = 0, totalAbsent = 0, totalRecs = 0;
  const attBlocked = attData.every(r => r.length === 0) && sample.length > 0;

  attData.forEach(recs => {
    const s = attSummary(recs);
    totalPresent += s.present; totalHalf += s.half; totalAbsent += s.absent; totalRecs += s.total;
  });

  const avgPct      = totalRecs ? Math.round(((totalPresent + totalHalf * 0.5) / totalRecs) * 100) : 0;
  const activeUsers = ALL_USERS.filter(u => u.name).length;
  const totalPayroll = ALL_USERS.reduce((s, u) => s + (u.monthlySalary || 0), 0);

  window._dashAttData = { sample, attData, totalPresent, totalHalf, totalAbsent };

  return `
  <div class="space-y-6">
    <!-- Firebase status bar -->
    <div class="flex items-center gap-3 p-3 rounded-xl bg-soft-surface border border-divider text-sm text-secondary flex-wrap gap-y-1">
      <div class="w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
      Project: <span class="font-semibold text-primary">selfattendance-42445</span>
      &nbsp;·&nbsp; Admin UID in config ✓
      &nbsp;·&nbsp; ${ALL_USERS.length} users loaded
    </div>

    ${attBlocked ? attRulesMissingBanner() : ''}

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('Total Users',     ALL_USERS.length,     'linear-gradient(135deg,#7C3AED,#A855F7)', ICONS.users,    'Firestore users')}
      ${statCard('Active Profiles', activeUsers,          'linear-gradient(135deg,#059669,#34D399)', ICONS.check,    'With profile setup')}
      ${statCard('Avg Attendance',  avgPct + '%',         'linear-gradient(135deg,#0891B2,#22D3EE)', ICONS.calendar, 'This month (sample)')}
      ${statCard('Total Payroll',   fmtINR(totalPayroll), 'linear-gradient(135deg,#D97706,#FCD34D)', ICONS.rupee,    'Monthly basis')}
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="font-bold text-primary">Attendance Breakdown</h3>
            <p class="text-secondary text-sm">First 8 users — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}</p>
          </div>
          <div class="flex gap-2 text-xs">
            <span class="badge badge-present">Present</span>
            <span class="badge badge-half">Half</span>
            <span class="badge badge-absent">Absent</span>
          </div>
        </div>
        <div class="chart-container"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Split</h3>
        <p class="text-secondary text-sm mb-4">Sample users this month</p>
        <div class="chart-container" style="height:180px"><canvas id="donutChart"></canvas></div>
        <div class="space-y-2 mt-4">
          ${legendRow('#00C853', 'Present',  totalPresent)}
          ${legendRow('#FFB300', 'Half Day', totalHalf)}
          ${legendRow('#E53935', 'Absent',   totalAbsent)}
        </div>
      </div>
    </div>

    <!-- Recent users + attendance progress -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-primary">Recent Users</h3>
          <button onclick="navigate('users')" class="btn-outline text-xs py-1.5 px-3">View All</button>
        </div>
        ${ALL_USERS.length === 0
          ? emptyState('No users found in Firestore')
          : `<div class="space-y-2">
              ${ALL_USERS.slice(0, 6).map(u => `
              <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-soft-surface transition-colors cursor-pointer" onclick="showUserDetail('${u.id}')">
                ${avatar(u.name || '?')}
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-primary text-sm">${u.name || '<span class="text-secondary italic">No name set</span>'}</div>
                  <div class="text-secondary text-xs font-mono">#${u.uniqueId || '—'}</div>
                </div>
                ${u.monthlySalary ? `<span class="text-sm font-semibold text-violet">${fmtINR(u.monthlySalary, u.currency)}</span>` : ''}
              </div>`).join('')}
            </div>`}
      </div>

      <div class="card p-6">
        <h3 class="font-bold text-primary mb-4">
          Attendance Rate
          ${attBlocked ? '<span class="text-xs font-normal text-red-400 ml-2">(rules patch needed)</span>' : '<span class="text-secondary font-normal text-sm">(this month)</span>'}
        </h3>
        <div class="space-y-3">
          ${sample.map((u, i) => {
            const s = attSummary(attData[i]);
            return `<div class="flex items-center gap-3">
              ${avatar(u.name || '?', 'width:32px;height:32px;font-size:11px')}
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-primary truncate">${u.name || u.id.slice(0, 14)}</div>
                <div class="progress-track mt-1"><div class="progress-fill" style="width:${s.pct}%"></div></div>
              </div>
              <span class="text-sm font-bold ${s.pct >= 75 ? 'text-green-500' : s.pct >= 50 ? 'text-yellow-500' : 'text-red-400'}">${s.total ? s.pct + '%' : '—'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function statCard(label, value, gradient, iconHtml, sub) {
  return `<div class="stat-card">
    <div class="flex items-start justify-between mb-4">
      <div class="icon-box" style="background:${gradient}">${iconHtml}</div>
      <span class="text-xs text-secondary font-medium">${sub}</span>
    </div>
    <div class="text-2xl font-bold text-primary count-animate">${value}</div>
    <div class="text-secondary text-sm mt-1">${label}</div>
  </div>`;
}

function legendRow(color, label, count) {
  return `<div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="legend-dot" style="background:${color}"></div>
      <span class="text-sm text-secondary">${label}</span>
    </div>
    <span class="font-semibold text-primary text-sm">${count}</span>
  </div>`;
}

function renderDashboardCharts() {
  const { text, grid } = chartColors();
  const d = window._dashAttData;
  if (!d) return;

  const ctx1 = document.getElementById('trendChart');
  if (ctx1) {
    charts.trend = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: d.sample.map(u => (u.name || u.id).split(' ')[0]),
        datasets: [
          { label:'Present', data: d.attData.map(r => attSummary(r).present), backgroundColor:'rgba(124,58,237,0.85)', borderRadius:8, borderSkipped:false },
          { label:'Half',    data: d.attData.map(r => attSummary(r).half),    backgroundColor:'rgba(255,179,0,0.75)',  borderRadius:8, borderSkipped:false },
          { label:'Absent',  data: d.attData.map(r => attSummary(r).absent),  backgroundColor:'rgba(229,57,53,0.65)',  borderRadius:8, borderSkipped:false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { color: text, font: { size: 11 } } },
          y: { stacked: true, grid: { color: grid }, ticks: { color: text }, beginAtZero: true }
        }
      }
    });
  }

  const ctx2 = document.getElementById('donutChart');
  if (ctx2) {
    const hasData = d.totalPresent + d.totalHalf + d.totalAbsent > 0;
    charts.donut = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Half Day', 'Absent'],
        datasets: [{
          data: hasData ? [d.totalPresent, d.totalHalf, d.totalAbsent] : [1, 0, 0],
          backgroundColor: hasData ? ['#00C853','#FFB300','#E53935'] : ['#DDD6FE','#DDD6FE','#DDD6FE'],
          borderWidth: 0, hoverOffset: 6
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════
function buildAnalytics() {
  const totalPayroll = ALL_USERS.reduce((s, u) => s + (u.monthlySalary || 0), 0);
  const avgSalary    = ALL_USERS.length ? totalPayroll / ALL_USERS.length : 0;
  const withSalary   = ALL_USERS.filter(u => u.monthlySalary > 0).length;

  return `
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('Total Users',      ALL_USERS.length,    'linear-gradient(135deg,#7C3AED,#A855F7)', ICONS.users,    'Firestore')}
      ${statCard('With Salary Set',  withSalary,          'linear-gradient(135deg,#0891B2,#22D3EE)', ICONS.check,    'Configured')}
      ${statCard('Average Salary',   fmtINR(avgSalary),   'linear-gradient(135deg,#059669,#34D399)', ICONS.rupee,    'Monthly')}
      ${statCard('Total Payroll',    fmtINR(totalPayroll),'linear-gradient(135deg,#D97706,#FCD34D)', ICONS.rupee,    'Combined')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Salary Distribution</h3>
        <p class="text-secondary text-sm mb-4">Users by monthly salary bracket</p>
        <div class="chart-container"><canvas id="salaryChart"></canvas></div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Working Days Config</h3>
        <p class="text-secondary text-sm mb-4">Users by configured working days</p>
        <div class="chart-container"><canvas id="wdChart"></canvas></div>
      </div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary mb-4">All Users — Firebase Data</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Firebase UID</th><th>Unique ID</th><th>Salary</th><th>Working Days</th><th>Std Hours</th><th>Coins</th></tr>
          </thead>
          <tbody>
            ${ALL_USERS.length === 0
              ? `<tr><td colspan="7">${emptyState('No users in Firestore')}</td></tr>`
              : ALL_USERS.map(u => `
              <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
                <td>
                  <div class="flex items-center gap-3">
                    ${avatar(u.name || '?')}
                    <div class="font-semibold text-sm">${u.name || '<span class="text-secondary italic">No name</span>'}</div>
                  </div>
                </td>
                <td><code class="text-xs text-secondary font-mono">${u.id.slice(0,16)}…</code></td>
                <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId || '—'}</code></td>
                <td class="font-semibold">${u.monthlySalary ? fmtINR(u.monthlySalary, u.currency) : '—'}</td>
                <td>${u.workingDays || '—'}</td>
                <td>${u.standardHours ? u.standardHours + 'h' : '—'}</td>
                <td>${u.rewards?.coinBalance != null ? `<span class="coin-badge">🪙 ${u.rewards.coinBalance}</span>` : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function initAnalyticsCharts() {
  const { text, grid } = chartColors();

  // Salary brackets
  const brackets = ['< ₹20k','₹20–30k','₹30–40k','₹40–50k','₹50–60k','₹60k+'];
  const counts   = [0,0,0,0,0,0];
  ALL_USERS.forEach(u => {
    const s = u.monthlySalary || 0;
    if      (s < 20000) counts[0]++;
    else if (s < 30000) counts[1]++;
    else if (s < 40000) counts[2]++;
    else if (s < 50000) counts[3]++;
    else if (s < 60000) counts[4]++;
    else                counts[5]++;
  });
  const ctx1 = document.getElementById('salaryChart');
  if (ctx1) charts.salary = new Chart(ctx1, {
    type: 'bar',
    data: { labels: brackets, datasets: [{ data: counts, backgroundColor:'rgba(124,58,237,0.82)', borderRadius:10, borderSkipped:false }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales: { x:{grid:{display:false},ticks:{color:text,font:{size:11}}}, y:{grid:{color:grid},ticks:{color:text,stepSize:1},beginAtZero:true} } }
  });

  // Working days
  const wdMap = {};
  ALL_USERS.forEach(u => { const d = (u.workingDays || 0).toString(); wdMap[d] = (wdMap[d] || 0) + 1; });
  const wdLabels = Object.keys(wdMap).sort((a,b) => +a - +b);
  const wdData   = wdLabels.map(k => wdMap[k]);
  const ctx2 = document.getElementById('wdChart');
  if (ctx2) charts.wd = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: wdLabels.map(l => l + ' days'), datasets:[{ data:wdData, backgroundColor:['#7C3AED','#059669','#0891B2','#D97706','#E11D48','#0EA5E9'], borderWidth:0 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:text,font:{size:12},boxWidth:12}}} }
  });
}

// ═══════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════
function buildUsers() {
  return `
  <div class="space-y-4">
    <div class="flex flex-wrap gap-3 items-center">
      <input id="userSearch" type="text" placeholder="Search name, UID, uniqueId…" class="input-field flex-1 min-w-48 max-w-sm py-2.5"
        oninput="filterUsers()" />
      <select id="salaryFilter" onchange="filterUsers()" class="py-2.5">
        <option value="">All Salaries</option>
        <option value="low">Below ₹30k</option>
        <option value="mid">₹30k – ₹60k</option>
        <option value="high">Above ₹60k</option>
        <option value="none">Not Set</option>
      </select>
      <button onclick="refreshUsers()" class="btn-primary py-2.5 px-5">↻ Refresh</button>
      <button onclick="exportUsersCSV()" class="btn-outline py-2.5 px-4">Export CSV</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Firebase UID</th><th>Unique ID</th><th>Monthly Salary</th><th>Working Days</th><th>Coins</th><th>Actions</th></tr>
          </thead>
          <tbody id="usersTbody">${usersTableRows(ALL_USERS)}</tbody>
        </table>
      </div>
      <div class="px-6 py-3 border-t border-divider flex items-center justify-between text-sm text-secondary">
        <span id="userCount">${ALL_USERS.length} users from Firestore</span>
      </div>
    </div>
  </div>`;
}

function usersTableRows(users) {
  if (!users.length) return `<tr><td colspan="7">${emptyState('No users found')}</td></tr>`;
  return users.map(u => `
  <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
    <td>
      <div class="flex items-center gap-3">
        ${avatar(u.name || '?')}
        <div>
          <div class="font-semibold text-primary text-sm">${u.name || '<span class="text-secondary italic">No name</span>'}</div>
          <div class="text-secondary text-xs">${u.email || ''}</div>
        </div>
      </div>
    </td>
    <td><code class="text-xs text-secondary font-mono">${u.id.slice(0,14)}…</code></td>
    <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId || '—'}</code></td>
    <td class="font-semibold">${u.monthlySalary ? fmtINR(u.monthlySalary, u.currency) : '—'}</td>
    <td>${u.workingDays ? u.workingDays + ' days' : '—'}</td>
    <td>${u.rewards?.coinBalance != null ? `<span class="coin-badge">🪙 ${u.rewards.coinBalance}</span>` : '—'}</td>
    <td onclick="event.stopPropagation()">
      <div class="flex gap-2">
        <button onclick="showUserDetail('${u.id}')" class="btn-outline py-1 px-3 text-xs">View</button>
        <button onclick="confirmDeleteUser('${u.id}','${(u.name||'').replace(/'/g,"\\'")}')" class="btn-danger py-1 px-3 text-xs">Delete</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterUsers() {
  const q  = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('salaryFilter')?.value || '';
  const filtered = ALL_USERS.filter(u => {
    const matchQ = !q ||
      (u.name     || '').toLowerCase().includes(q) ||
      (u.id       || '').includes(q) ||
      (u.uniqueId || '').includes(q) ||
      (u.email    || '').toLowerCase().includes(q);
    let matchS = true;
    if (sf === 'low')  matchS = (u.monthlySalary || 0) < 30000 && (u.monthlySalary || 0) > 0;
    if (sf === 'mid')  matchS = (u.monthlySalary || 0) >= 30000 && (u.monthlySalary || 0) < 60000;
    if (sf === 'high') matchS = (u.monthlySalary || 0) >= 60000;
    if (sf === 'none') matchS = !u.monthlySalary || u.monthlySalary === 0;
    return matchQ && matchS;
  });
  document.getElementById('usersTbody').innerHTML = usersTableRows(filtered);
  document.getElementById('userCount').textContent = `${filtered.length} of ${ALL_USERS.length} users`;
}

async function refreshUsers() {
  ATTENDANCE_CACHE = {};
  await loadAllUsers();
  if (currentPage === 'users') navigate('users');
  showToast('Users refreshed from Firebase!');
}

function exportUsersCSV() {
  const rows = ALL_USERS.map(u => [
    u.name || '', u.id, u.uniqueId || '', u.email || '',
    u.monthlySalary || 0, u.workingDays || 0, u.standardHours || 0,
    u.overtimeRate || 0, u.rewards?.coinBalance || 0,
  ]);
  const csv = [['Name','UID','UniqueID','Email','Salary','WorkingDays','StdHours','OvertimeRate','Coins'], ...rows]
    .map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'selfattendance_users.csv');
  showToast('Users CSV exported!');
}

// User detail modal
async function showUserDetail(uid) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) { showToast('User not found', 'error'); return; }

  const modal = openModal('userModal');
  modal.innerHTML = `
  <div class="modal">
    <div class="flex items-start justify-between mb-5">
      <div class="flex items-center gap-4">
        ${avatar(u.name || '?')}
        <div>
          <h2 class="text-xl font-bold text-primary">${u.name || 'No name set'}</h2>
          <code class="text-secondary text-xs font-mono">${u.id}</code>
        </div>
      </div>
      <button onclick="closeModal('userModal')" class="text-secondary hover:text-primary text-2xl leading-none mt-1">&times;</button>
    </div>
    <div id="userDetailBody"><div class="flex justify-center py-8"><div class="spinner"></div></div></div>
  </div>`;

  try {
    const ym      = currentYM();
    const records = await loadAttendance(uid, ym);
    const s       = attSummary(records);
    const estSal  = estimatedSalary(u, s);
    const attBlocked = records.length === 0 && u.name; // likely blocked, not just no records

    document.getElementById('userDetailBody').innerHTML = `
      <!-- Profile fields -->
      <div class="grid grid-cols-2 gap-2 mb-4">
        ${miniStat('Unique ID',      '#' + (u.uniqueId || '—'), 'text-violet font-mono')}
        ${miniStat('Monthly Salary', u.monthlySalary ? fmtINR(u.monthlySalary, u.currency) : 'Not set')}
        ${miniStat('Working Days',   u.workingDays ? u.workingDays + ' days' : 'Not set')}
        ${miniStat('Std Hours',      u.standardHours ? u.standardHours + 'h/day' : 'Not set')}
        ${miniStat('Overtime Rate',  u.overtimeRate ? u.overtimeRate + 'x' : '—')}
        ${miniStat('Coin Balance',   u.rewards?.coinBalance != null ? '🪙 ' + u.rewards.coinBalance : '—')}
      </div>

      ${u.rewards ? `
      <div class="bg-soft-surface rounded-2xl p-4 mb-4">
        <h4 class="font-semibold text-primary text-sm mb-2">Reward Details</h4>
        <div class="grid grid-cols-2 gap-2 text-sm">
          ${miniStat('Total Earned',    '🪙 ' + (u.rewards.totalCoinsEarned || 0))}
          ${miniStat('Daily Spins Used', u.rewards.dailySpinsUsed || 0)}
          ${miniStat('Last Spin Date',   u.rewards.lastSpinDate || '—')}
          ${miniStat('Last Login Date',  u.rewards.lastDailyLoginDate || '—')}
        </div>
      </div>` : ''}

      ${u.premiumUnlocks ? `
      <div class="bg-soft-surface rounded-2xl p-4 mb-4">
        <h4 class="font-semibold text-primary text-sm mb-2">Premium Unlocks</h4>
        <div class="flex flex-wrap gap-2">
          ${Object.entries(u.premiumUnlocks).map(([k,v]) => v
            ? `<span class="badge badge-present">${k}</span>`
            : `<span class="badge" style="background:var(--soft-surface);color:var(--text-secondary)">${k}</span>`
          ).join('')}
        </div>
      </div>` : ''}

      <!-- Attendance this month -->
      <div class="bg-soft-surface rounded-2xl p-4 mb-4">
        <h4 class="font-semibold text-primary mb-2">
          Attendance — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}
          ${attBlocked && records.length === 0 ? '<span class="text-xs text-red-400 font-normal ml-2">(rules patch needed)</span>' : ''}
        </h4>
        ${s.total === 0
          ? `<p class="text-secondary text-sm">${attBlocked ? 'Cannot read attendance — apply FIRESTORE_RULES_PATCH.md.' : 'No records this month.'}</p>`
          : `
          <div class="grid grid-cols-4 gap-2 text-center mb-3">
            <div><div class="text-xl font-bold text-violet">${s.pct}%</div><div class="text-xs text-secondary">Rate</div></div>
            <div><div class="text-xl font-bold text-green-500">${s.present}</div><div class="text-xs text-secondary">Present</div></div>
            <div><div class="text-xl font-bold text-yellow-500">${s.half}</div><div class="text-xs text-secondary">Half</div></div>
            <div><div class="text-xl font-bold text-red-400">${s.absent}</div><div class="text-xs text-secondary">Absent</div></div>
          </div>
          <div class="progress-track"><div class="progress-fill" style="width:${s.pct}%"></div></div>
          ${u.monthlySalary ? `<div class="mt-3 flex items-center justify-between"><span class="text-sm text-secondary">Estimated Salary</span><span class="font-bold text-primary">${fmtINR(estSal, u.currency)}</span></div>` : ''}`}
      </div>

      ${records.length > 0 ? `
      <div class="mb-4">
        <h4 class="font-semibold text-primary mb-2 text-sm">Recent Records</h4>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          ${records.slice(0, 10).map(r => `
          <div class="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-soft-surface text-sm">
            <span class="text-secondary w-28 shrink-0">${formatDate(r.date)}</span>
            ${statusBadge(r.status)}
            <span class="text-secondary">${r.workedHours > 0 ? r.workedHours + 'h' : '—'}</span>
            ${r.overtimeHours > 0 ? `<span class="badge badge-overtime">+${r.overtimeHours}h OT</span>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="flex gap-3">
        <button onclick="closeModal('userModal');navigate('attendance')" class="btn-outline flex-1">Go to Attendance</button>
        <button onclick="closeModal('userModal')" class="btn-ghost flex-1">Close</button>
      </div>`;
  } catch(e) {
    document.getElementById('userDetailBody').innerHTML = fbErrorBanner(e);
  }
}

function miniStat(label, value, cls = '') {
  return `<div class="bg-app rounded-xl p-3">
    <div class="text-xs text-secondary mb-0.5">${label}</div>
    <div class="font-semibold text-primary text-sm ${cls}">${value}</div>
  </div>`;
}

function confirmDeleteUser(uid, name) {
  const modal = openModal('deleteModal');
  modal.innerHTML = `
  <div class="modal max-w-sm">
    <h2 class="text-xl font-bold text-primary mb-2">Delete Profile?</h2>
    <p class="text-secondary text-sm mb-5">Deletes <strong>${name || uid}</strong>'s Firestore document. Firebase Auth account stays intact.</p>
    <div class="flex gap-3">
      <button onclick="deleteUserProfile('${uid}')" class="btn-danger flex-1 justify-center py-3">Delete from Firestore</button>
      <button onclick="closeModal('deleteModal')" class="btn-ghost flex-1 py-3">Cancel</button>
    </div>
  </div>`;
}

async function deleteUserProfile(uid) {
  try {
    await db.collection('users').doc(uid).delete();
    ALL_USERS = ALL_USERS.filter(u => u.id !== uid);
    document.getElementById('navUserCount').textContent = ALL_USERS.length;
    closeModal('deleteModal');
    showToast('User profile deleted from Firestore');
    navigate('users');
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════════════════════════
async function buildAttendance() {
  if (!attSelectedYM)   attSelectedYM   = currentYM();
  if (!attSelectedUser && ALL_USERS.length) attSelectedUser = ALL_USERS[0].id;

  let records   = [];
  let attBlocked = false;

  if (attSelectedUser) {
    records = await loadAttendance(attSelectedUser, attSelectedYM);
    // Heuristic: user has a profile (name set) but zero records → likely rules blocked
    const selU = ALL_USERS.find(u => u.id === attSelectedUser);
    attBlocked = records.length === 0 && !!selU?.name;
  }

  const ymOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    ymOptions.push(`<option value="${val}" ${val === attSelectedYM ? 'selected' : ''}>${d.toLocaleString('default',{month:'long',year:'numeric'})}</option>`);
  }

  const s       = attSummary(records);
  const selUser = ALL_USERS.find(u => u.id === attSelectedUser);

  return `
  <div class="space-y-4">
    ${attBlocked ? attRulesMissingBanner() : ''}

    <div class="flex flex-wrap gap-3 items-center">
      <select id="attUserSel" onchange="changeAttUser(this.value)" class="py-2.5 flex-1 min-w-40 max-w-xs">
        ${ALL_USERS.map(u => `<option value="${u.id}" ${u.id === attSelectedUser ? 'selected' : ''}>${u.name || u.id.slice(0,16)}</option>`).join('')}
      </select>
      <select id="attMonthSel" onchange="changeAttMonth(this.value)" class="py-2.5">${ymOptions.join('')}</select>
      ${!attBlocked ? `<button onclick="openAddAttendance()" class="btn-primary py-2.5 px-5">+ Add Record</button>` : ''}
      <button onclick="exportAttCSV()" class="btn-outline py-2.5 px-4">Export CSV</button>
    </div>

    ${s.total > 0 ? `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="card p-4 text-center"><div class="text-2xl font-bold text-violet">${s.pct}%</div><div class="text-secondary text-sm mt-1">Attendance Rate</div></div>
      <div class="card p-4 text-center"><div class="text-2xl font-bold text-green-500">${s.present}</div><div class="text-secondary text-sm mt-1">Present Days</div></div>
      <div class="card p-4 text-center"><div class="text-2xl font-bold text-yellow-500">${s.half}</div><div class="text-secondary text-sm mt-1">Half Days</div></div>
      <div class="card p-4 text-center"><div class="text-2xl font-bold text-red-400">${s.absent}</div><div class="text-secondary text-sm mt-1">Absent Days</div></div>
    </div>
    ${selUser?.monthlySalary ? `
    <div class="card p-4 flex items-center justify-between">
      <span class="text-secondary text-sm">Estimated salary for ${new Date(attSelectedYM).toLocaleString('default',{month:'long',year:'numeric'})}</span>
      <span class="text-2xl font-bold text-primary">${fmtINR(estimatedSalary(selUser, s), selUser.currency)}</span>
    </div>` : ''}` : ''}

    <div class="card">
      <div class="p-4 border-b border-divider flex items-center justify-between">
        <h3 class="font-bold text-primary">${selUser?.name || 'Select a user'} — Records</h3>
        <span class="text-secondary text-sm">${records.length} record${records.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Worked Hours</th><th>Overtime</th><th>Last Updated</th><th>Actions</th></tr></thead>
          <tbody>
            ${records.length === 0
              ? `<tr><td colspan="6">${emptyState(attBlocked ? 'Apply FIRESTORE_RULES_PATCH.md to enable admin attendance read.' : 'No records for this period.')}</td></tr>`
              : records.map(r => `
              <tr>
                <td class="font-medium">${formatDate(r.date)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.workedHours > 0 ? r.workedHours + 'h' : '—'}</td>
                <td>${r.overtimeHours > 0 ? `<span class="badge badge-overtime">+${r.overtimeHours}h</span>` : '—'}</td>
                <td class="text-secondary text-xs">${r.updatedAt?.toDate ? r.updatedAt.toDate().toLocaleDateString('en-IN') : '—'}</td>
                <td>
                  <div class="flex gap-2">
                    <button onclick="openEditAttendance('${r.date}','${r.status}',${r.workedHours||0},${r.overtimeHours||0})" class="btn-outline py-1 px-3 text-xs">Edit</button>
                    <button onclick="confirmDeleteAtt('${r.date}')" class="btn-danger py-1 px-3 text-xs">Delete</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

async function changeAttUser(uid) { attSelectedUser = uid; navigate('attendance'); }
async function changeAttMonth(ym) { attSelectedYM   = ym;  navigate('attendance'); }

function openAddAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  openAttModal('Add Attendance Record', today, 'PRESENT', 8, 0, async (date, status, wh, oh) => {
    await saveAttendance(attSelectedUser, date, status, wh, oh);
    showToast('Saved to Firebase!');
    navigate('attendance');
  });
}

function openEditAttendance(date, status, wh, oh) {
  openAttModal('Edit Record', date, status, wh, oh, async (_, newStatus, newWh, newOh) => {
    await saveAttendance(attSelectedUser, date, newStatus, newWh, newOh);
    showToast('Updated in Firebase!');
    navigate('attendance');
  });
}

function openAttModal(title, date, status, wh, oh, onSave) {
  const modal = openModal('attModal');
  modal.innerHTML = `
  <div class="modal max-w-sm">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-lg font-bold text-primary">${title}</h2>
      <button onclick="closeModal('attModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>
    <div class="space-y-4 mb-5">
      <div>
        <label class="text-sm font-medium text-secondary block mb-1.5">Date</label>
        <input type="date" id="attDate" value="${date}" class="input-field" />
      </div>
      <div>
        <label class="text-sm font-medium text-secondary block mb-1.5">Status</label>
        <div class="flex gap-2">
          ${[['PRESENT','✓ Present','green'],['HALF','◐ Half Day','yellow'],['ABSENT','✕ Absent','red']].map(([s,lbl,c]) => `
          <button id="btn_${s}" onclick="selectAttStatus('${s}')"
            class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors
              ${status===s||( s==='HALF'&&status==='HALF_DAY')
                ? `bg-${c}-${c==='yellow'?'400':'500'} text-white border-transparent`
                : `border-${c}-${c==='yellow'?'400':'400'} text-${c}-${c==='red'?'400':'500'}`}">${lbl}</button>`).join('')}
        </div>
      </div>
      <div>
        <label class="text-sm font-medium text-secondary block mb-1.5">Worked Hours</label>
        <input type="number" id="attWh" value="${wh}" step="0.5" min="0" max="24" class="input-field" />
      </div>
      <div>
        <label class="text-sm font-medium text-secondary block mb-1.5">Overtime Hours</label>
        <input type="number" id="attOh" value="${oh}" step="0.5" min="0" max="24" class="input-field" />
      </div>
    </div>
    <div class="flex gap-3">
      <button id="attSaveBtn" onclick="saveAttendanceForm()" class="btn-primary flex-1 py-3">Save to Firebase</button>
      <button onclick="closeModal('attModal')" class="btn-ghost flex-1 py-3">Cancel</button>
    </div>
  </div>`;
  window._attOnSave = onSave;
  window._attStatus = status;
}

function selectAttStatus(s) {
  window._attStatus = s;
  const map = { PRESENT:['green','500'], HALF:['yellow','400'], ABSENT:['red','500'] };
  ['PRESENT','HALF','ABSENT'].forEach(st => {
    const btn = document.getElementById('btn_' + st);
    if (!btn) return;
    const [c, shade] = map[st];
    btn.className = `flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${
      st === s
        ? `bg-${c}-${shade} text-white border-transparent`
        : `border-${c}-400 text-${c}-${st==='ABSENT'?'400':'500'}`
    }`;
  });
}

async function saveAttendanceForm() {
  const btn = document.getElementById('attSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await window._attOnSave(
      document.getElementById('attDate').value,
      window._attStatus,
      document.getElementById('attWh').value,
      document.getElementById('attOh').value,
    );
    closeModal('attModal');
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
    btn.disabled = false; btn.textContent = 'Save to Firebase';
  }
}

function confirmDeleteAtt(date) {
  if (!confirm(`Delete attendance for ${formatDate(date)}?`)) return;
  deleteAttendance(attSelectedUser, date)
    .then(() => { showToast('Record deleted'); navigate('attendance'); })
    .catch(e => showToast('Error: ' + e.message, 'error'));
}

function exportAttCSV() {
  const key     = `${attSelectedUser}_${attSelectedYM}`;
  const records = ATTENDANCE_CACHE[key] || [];
  const u       = ALL_USERS.find(x => x.id === attSelectedUser);
  const rows    = records.map(r => [r.date, r.status, r.workedHours || 0, r.overtimeHours || 0]);
  const csv     = [['Date','Status','WorkedHours','OvertimeHours'], ...rows].map(r => r.join(',')).join('\n');
  downloadCSV(csv, `attendance_${u?.name || attSelectedUser}_${attSelectedYM}.csv`);
  showToast('CSV exported!');
}

// ═══════════════════════════════════════════════════════════════
//  SALARY
// ═══════════════════════════════════════════════════════════════
async function buildSalary() {
  const ym      = currentYM();
  const sample  = ALL_USERS.slice(0, 20);
  const attData = await Promise.all(sample.map(u => loadAttendance(u.id, ym)));
  const attBlocked = attData.every(r => r.length === 0) && sample.length > 0;

  const rows = sample.map((u, i) => {
    const s = attSummary(attData[i]);
    return { ...u, ...s, estSal: estimatedSalary(u, s), deduction: Math.max(0, (u.monthlySalary || 0) - estimatedSalary(u, s)) };
  });

  const totalPayroll = rows.reduce((s, u) => s + (u.monthlySalary || 0), 0);
  const totalEst     = rows.reduce((s, u) => s + u.estSal, 0);
  const totalDed     = rows.reduce((s, u) => s + u.deduction, 0);

  window._salaryRows = rows;

  return `
  <div class="space-y-4">
    ${attBlocked ? attRulesMissingBanner() : ''}

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${statCard('Total Payroll',    fmtINR(totalPayroll), 'linear-gradient(135deg,#7C3AED,#A855F7)', ICONS.rupee, 'Monthly basis')}
      ${statCard('Estimated Payout', fmtINR(totalEst),     'linear-gradient(135deg,#059669,#34D399)', ICONS.check, 'Based on attendance')}
      ${statCard('Total Deductions', fmtINR(totalDed),     'linear-gradient(135deg,#E53935,#EF5350)', ICONS.rupee, 'Absence deductions')}
    </div>

    <div class="card">
      <div class="p-5 border-b border-divider flex items-center justify-between flex-wrap gap-3">
        <h3 class="font-bold text-primary">
          Salary Report — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}
        </h3>
        <button onclick="exportSalaryCSV()" class="btn-outline py-2 px-4 text-sm">Export CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Employee</th><th>Unique ID</th><th>Monthly Salary</th><th>Present</th><th>Half</th><th>Absent</th><th>Att %</th><th>Est. Payout</th><th>Deduction</th></tr>
          </thead>
          <tbody>
            ${rows.length === 0 ? `<tr><td colspan="9">${emptyState('No users found')}</td></tr>` :
              rows.map(u => `
              <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
                <td>
                  <div class="flex items-center gap-3">
                    ${avatar(u.name || '?')}
                    <span class="font-semibold text-primary text-sm">${u.name || 'No name'}</span>
                  </div>
                </td>
                <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId || '—'}</code></td>
                <td class="font-semibold">${u.monthlySalary ? fmtINR(u.monthlySalary, u.currency) : '—'}</td>
                <td><span class="badge badge-present">${u.present}</span></td>
                <td><span class="badge badge-half">${u.half}</span></td>
                <td><span class="badge badge-absent">${u.absent}</span></td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="progress-track w-14"><div class="progress-fill" style="width:${u.pct}%"></div></div>
                    <span class="text-sm font-semibold ${u.total===0?'text-secondary':u.pct>=75?'text-green-500':u.pct>=50?'text-yellow-500':'text-red-400'}">${u.total ? u.pct + '%' : '—'}</span>
                  </div>
                </td>
                <td class="font-bold text-primary">${u.monthlySalary && u.total ? fmtINR(u.estSal, u.currency) : '—'}</td>
                <td class="${u.deduction > 0 ? 'text-red-400 font-semibold' : 'text-secondary'}">${u.monthlySalary && u.deduction > 0 ? '−' + fmtINR(u.deduction, u.currency) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${sample.length < ALL_USERS.length ? `<div class="px-6 py-3 text-secondary text-sm border-t border-divider">Showing ${sample.length} of ${ALL_USERS.length} users</div>` : ''}
    </div>
  </div>`;
}

function exportSalaryCSV() {
  const rows = (window._salaryRows || []).map(u => [
    u.name || '', u.uniqueId || '', u.monthlySalary || 0,
    u.present, u.half, u.absent, u.pct + '%',
    u.total ? u.estSal : '', u.total && u.deduction > 0 ? u.deduction : '',
  ]);
  const csv = [['Name','UniqueID','MonthlySalary','Present','Half','Absent','AttPct','EstPayout','Deduction'], ...rows]
    .map(r => r.join(',')).join('\n');
  downloadCSV(csv, `salary_report_${currentYM()}.csv`);
  showToast('Salary CSV exported!');
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS & RULES
// ═══════════════════════════════════════════════════════════════
function buildSettings() {
  const uid   = currentAdmin?.uid   || '—';
  const email = currentAdmin?.email || '—';

  return `
  <div class="max-w-3xl space-y-5">

    <!-- Admin identity -->
    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-4">Your Admin Account</h3>
      <div class="space-y-3">
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Email</label>
          <span class="font-semibold text-primary">${email}</span>
        </div>
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Firebase UID</label>
          <div class="flex items-center gap-2">
            <code class="text-violet font-mono text-sm bg-soft-surface px-3 py-1.5 rounded-xl break-all">${uid}</code>
            <button onclick="navigator.clipboard.writeText('${uid}').then(()=>showToast('UID copied!'))" class="btn-outline py-1.5 px-3 text-xs">Copy</button>
          </div>
        </div>
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Admin Status</label>
          <span class="badge badge-present">✓ Verified — UID in adminConfig</span>
        </div>
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Dark Mode</label>
          <div class="toggle ${isDark ? 'on' : ''}" onclick="toggleTheme();this.classList.toggle('on')"></div>
        </div>
      </div>
    </div>

    <!-- Firebase project -->
    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-4">Firebase Project</h3>
      <div class="space-y-2">
        ${settingsRow('Project ID',    'selfattendance-42445')}
        ${settingsRow('Auth Domain',   'selfattendance-42445.firebaseapp.com')}
        ${settingsRow('Sender ID',     '611062377939')}
        ${settingsRow('Storage',       'selfattendance-42445.firebasestorage.app')}
        ${settingsRow('Admin Config',  'adminSettings/adminConfig · adminUids[]')}
      </div>
    </div>

    <!-- Firestore structure -->
    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-1">Firestore Collections</h3>
      <p class="text-secondary text-sm mb-4">Data structure used by the Android app</p>
      <div class="space-y-1">
        ${collectionRow('users/{uid}',                   'Profile, salary, rewards, premiumUnlocks',  true)}
        ${collectionRow('attendance/{uid}/days/{date}',  'Daily records — status, hours, overtime',   IS_ADMIN)}
        ${collectionRow('backup/{uid}/days/{date}',      'Backup copy of attendance records',         false)}
        ${collectionRow('adminSettings/adminConfig',     'adminUids[] — who can admin this panel',    true)}
        ${collectionRow('userIds/{6digit}',              '6-digit unique ID → uid reservation',       true)}
        ${collectionRow('referrals/{uid}',               'Referral tracking per user',                true)}
        ${collectionRow('weeklyPrize/{weekId}/entries',  'Leaderboard entries',                       true)}
        ${collectionRow('prizeRedemptions/{docId}',      'Prize redemption records',                  true)}
        ${collectionRow('bannedUsers/{uid}',             'Banned accounts',                           true)}
      </div>
    </div>

    <!-- Rules patch -->
    <div class="card p-6 border-2 border-yellow-400" style="border-color:#FFB300">
      <div class="flex items-start gap-3 mb-4">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:#FFF8E1">
          <span class="text-lg">⚠️</span>
        </div>
        <div>
          <h3 class="font-bold text-primary text-lg">Firestore Rules Patch Required</h3>
          <p class="text-secondary text-sm mt-0.5">Without this, the admin panel cannot read attendance records.</p>
        </div>
      </div>

      <p class="text-sm text-secondary mb-3">Add <code class="bg-soft-surface px-1.5 py-0.5 rounded text-xs text-violet">|| isAdmin()</code> to these 4 lines in your rules:</p>

      <div class="space-y-4">
        <div>
          <p class="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Find (attendance/days)</p>
          <pre class="bg-soft-surface rounded-xl p-4 text-xs overflow-x-auto text-secondary leading-relaxed">match /attendance/{uid} {
  allow read, write: if false;
  match /days/{date} {
    allow read:   if isActiveOwner(uid);
    allow create: if isActiveOwner(uid) && isValidAttendance() ...
    allow update: if isActiveOwner(uid) && isValidAttendance() ...
    allow delete: if isActiveOwner(uid);
  }
}</pre>
        </div>
        <div>
          <p class="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">Replace with</p>
          <pre class="bg-soft-surface rounded-xl p-4 text-xs overflow-x-auto leading-relaxed" style="color:var(--text-primary)">match /attendance/{uid} {
  allow read, write: if false;
  match /days/{date} {
    allow read:   if isActiveOwner(uid) <span style="background:#00C85322;color:#00C853;padding:1px 4px;border-radius:4px">|| isAdmin()</span>;
    allow create: if <span style="background:#00C85322;color:#00C853;padding:1px 4px;border-radius:4px">(isActiveOwner(uid) || isAdmin())</span> && isValidAttendance() ...
    allow update: if <span style="background:#00C85322;color:#00C853;padding:1px 4px;border-radius:4px">(isActiveOwner(uid) || isAdmin())</span> && isValidAttendance() ...
    allow delete: if isActiveOwner(uid) <span style="background:#00C85322;color:#00C853;padding:1px 4px;border-radius:4px">|| isAdmin()</span>;
  }
}</pre>
        </div>
      </div>

      <a href="https://console.firebase.google.com/project/selfattendance-42445/firestore/rules" target="_blank" class="btn-primary inline-flex mt-4 py-2.5 px-5 text-sm">
        Open Firestore Rules →
      </a>
      <p class="text-xs text-secondary mt-3">Full instructions also in <code class="bg-soft-surface px-1.5 py-0.5 rounded">FIRESTORE_RULES_PATCH.md</code> included in the ZIP.</p>
    </div>

    <!-- Admin tools -->
    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-4">Admin Tools</h3>
      <div class="settings-row">
        <div>
          <p class="font-medium text-primary text-sm">Load All Users</p>
          <p class="text-secondary text-xs">Re-fetch entire users collection (no limit)</p>
        </div>
        <button onclick="loadMoreUsers()" class="btn-outline py-2 px-4 text-sm">Load All</button>
      </div>
      <div class="settings-row">
        <div>
          <p class="font-medium text-primary text-sm">Clear Attendance Cache</p>
          <p class="text-secondary text-xs">Force fresh reads from Firestore</p>
        </div>
        <button onclick="clearCache()" class="btn-ghost py-2 px-4 text-sm">Clear Cache</button>
      </div>
      <div class="settings-row">
        <div>
          <p class="font-medium text-primary text-sm">Add Another Admin UID</p>
          <p class="text-secondary text-xs">Append a UID to adminSettings/adminConfig.adminUids</p>
        </div>
        <button onclick="addAdminUid()" class="btn-outline py-2 px-4 text-sm">Add UID</button>
      </div>
    </div>

  </div>`;
}

function settingsRow(label, value) {
  return `<div class="settings-row">
    <label class="font-medium text-primary text-sm">${label}</label>
    <code class="text-sm bg-soft-surface px-3 py-1.5 rounded-xl font-mono">${value}</code>
  </div>`;
}

function collectionRow(path, desc, canRead) {
  return `<div class="settings-row py-3">
    <div class="min-w-0">
      <code class="text-violet font-mono text-xs bg-soft-surface px-2 py-1 rounded-lg">${path}</code>
      <p class="text-secondary text-xs mt-1">${desc}</p>
    </div>
    <span class="shrink-0 text-xs font-semibold ${canRead ? 'text-green-500' : 'text-red-400'}">${canRead ? '✓ Admin read' : '✕ Rules needed'}</span>
  </div>`;
}

async function loadMoreUsers() {
  try {
    const snap = await db.collection('users').get();
    ALL_USERS = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    document.getElementById('navUserCount').textContent = ALL_USERS.length;
    showToast(`Loaded all ${ALL_USERS.length} users!`);
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function clearCache() {
  ATTENDANCE_CACHE = {};
  showToast('Attendance cache cleared!');
}

async function addAdminUid() {
  const uid = prompt('Enter Firebase UID to add as admin:');
  if (!uid || !uid.trim()) return;
  try {
    await db.doc('adminSettings/adminConfig').set({
      adminUids: firebase.firestore.FieldValue.arrayUnion(uid.trim())
    }, { merge: true });
    showToast('UID added to adminConfig!');
  } catch(e) {
    showToast('Error: ' + e.message + '\n(You must be admin to do this)', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════════════
function openModal(id) {
  closeModal(id);
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.id = id;
  el.addEventListener('click', e => { if (e.target === el) closeModal(id); });
  document.body.appendChild(el);
  return el;
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  const bg = type === 'error' ? '#E53935' : '#7C3AED';
  el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${bg};color:white;padding:12px 20px;border-radius:14px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:380px;word-break:break-word;animation:fadeIn .3s ease;`;
  el.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 4000);
}

// ═══════════════════════════════════════════════════════════════
//  CSV DOWNLOAD
// ═══════════════════════════════════════════════════════════════
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ═══════════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════════
const ICONS = {
  users:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  check:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  calendar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  rupee:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};

// ═══════════════════════════════════════════════════════════════
//  Self Attendance Pro — Admin Panel (Firebase Connected)
// ═══════════════════════════════════════════════════════════════

let currentPage = 'dashboard';
let isDark = false;
let sidebarOpen = false;
let charts = {};

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
    // onAuthStateChanged handles the rest
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Sign In with Firebase';
    errEl.classList.remove('hidden');
    const msgs = {
      'auth/user-not-found':  'No account found with this email.',
      'auth/wrong-password':  'Incorrect password.',
      'auth/invalid-email':   'Invalid email address.',
      'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    errEl.textContent = msgs[e.code] || e.message;
  }
}

function handleLogout() {
  auth.signOut();
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginScreen').classList.contains('hidden')) handleLogin();
});

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeLabel').textContent = isDark ? 'Dark' : 'Light';
  document.getElementById('themeIcon').innerHTML = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  setTimeout(() => { if (currentPage === 'dashboard') renderDashboardCharts(); if (currentPage === 'analytics') initAnalyticsCharts(); }, 60);
}

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  let ov = document.getElementById('sidebarOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id='sidebarOverlay'; ov.className='sidebar-overlay'; ov.onclick=toggleSidebar; document.body.appendChild(ov); }
  ov.classList.toggle('show', sidebarOpen);
}

// ── Navigation ────────────────────────────────────────────────
async function navigate(page) {
  currentPage = page;
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  charts = {};

  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));

  const titles = {
    dashboard:     ['Dashboard',        'Live Firebase data'],
    analytics:     ['Analytics',        'Trends & insights'],
    users:         ['Users',            `${ALL_USERS.length} registered users`],
    attendance:    ['Attendance',       'All attendance records'],
    salary:        ['Salary Reports',   'Salary breakdown'],
    notifications: ['Notifications',   'Push & alerts'],
    settings:      ['Settings',        'App configuration'],
  };
  const [title, sub] = titles[page] || ['Admin', ''];
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('pageSubtitle').textContent = sub;

  showPageLoading(true);
  let html = '';
  try {
    html = await buildPage(page);
  } catch(e) {
    html = errorPage(e);
  }
  showPageLoading(false);

  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="page-enter">${html}</div>`;

  setTimeout(() => {
    if (page === 'dashboard')  renderDashboardCharts();
    if (page === 'analytics')  initAnalyticsCharts();
    if (page === 'settings')   initToggles();
  }, 60);

  if (sidebarOpen) toggleSidebar();
}

function showPageLoading(show) {
  const el = document.getElementById('pageLoading');
  if (el) el.classList.toggle('hidden', !show);
}

function errorPage(e) {
  return `<div class="fb-error"><strong>Firebase Error:</strong> ${e.message}<br><small class="opacity-70">${e.code || ''}</small></div>`;
}

// ── Global search ─────────────────────────────────────────────
function handleGlobalSearch(q) {
  if (!q.trim()) { closeSearchDropdown(); return; }
  const results = ALL_USERS.filter(u =>
    (u.name||'').toLowerCase().includes(q.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(q.toLowerCase()) ||
    (u.uniqueId||'').includes(q)
  ).slice(0, 6);

  let dd = document.getElementById('searchDropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'searchDropdown';
    dd.className = 'card absolute top-16 right-4 w-80 z-50 p-2 shadow-xl';
    dd.style.cssText = 'background:var(--card-bg);border:1px solid var(--divider);';
    document.querySelector('.topbar').style.position = 'relative';
    document.querySelector('.topbar').appendChild(dd);
  }

  if (!results.length) {
    dd.innerHTML = '<div class="p-4 text-secondary text-sm text-center">No users found</div>';
    return;
  }
  dd.innerHTML = results.map(u => `
    <div class="search-result-item" onclick="showUserDetail('${u.id}');closeSearchDropdown()">
      ${avatar(u.name||'?')}
      <div class="min-w-0">
        <div class="font-semibold text-primary text-sm truncate">${u.name||'Unnamed'}</div>
        <div class="text-secondary text-xs truncate">${u.email||u.id} · #${u.uniqueId||'—'}</div>
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

// ── Helpers ───────────────────────────────────────────────────
function fmtINR(n, currency) {
  const sym = currencySymbol(currency);
  return sym + Math.round(n||0).toLocaleString('en-IN');
}
function currencySymbol(code) {
  const map = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'د.إ', SAR:'﷼', SGD:'S$', MYR:'RM', CAD:'C$', AUD:'A$', PKR:'₨' };
  return map[code] || '₹';
}
function avatar(name, cls='') {
  const initials = (name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
  return `<div class="avatar ${cls}">${initials}</div>`;
}
function statusBadge(status) {
  if (status==='PRESENT') return `<span class="badge badge-present">✓ Present</span>`;
  if (status==='HALF'||status==='HALF_DAY') return `<span class="badge badge-half">◐ Half Day</span>`;
  if (status==='ABSENT') return `<span class="badge badge-absent">✕ Absent</span>`;
  return `<span class="text-secondary">—</span>`;
}
function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; }
}
function attSummary(records) {
  const present = records.filter(r=>r.status==='PRESENT').length;
  const half    = records.filter(r=>r.status==='HALF'||r.status==='HALF_DAY').length;
  const absent  = records.filter(r=>r.status==='ABSENT').length;
  const total   = records.length;
  const pct     = total ? Math.round(((present + half*0.5)/total)*100) : 0;
  return { present, half, absent, total, pct };
}
function estimatedSalary(user, summary) {
  const workingDays = user.workingDays || 26;
  const salary = user.monthlySalary || 0;
  const effectiveDays = summary.present + summary.half * 0.5;
  return workingDays > 0 ? Math.round((salary / workingDays) * effectiveDays) : 0;
}
function chartColors() {
  return { text: isDark ? '#B0A8CC' : '#6B7280', grid: isDark ? '#2D2460' : '#EDE9FE' };
}
function loadingRow(cols) {
  return `<tr>${Array(cols).fill('<td><div class="h-4 bg-soft-surface rounded animate-pulse"></div></td>').join('')}</tr>`.repeat(4);
}
function emptyState(msg) {
  return `<div class="empty-state"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg><p class="text-base">${msg}</p></div>`;
}

// ═══════════════════════════════════════════════════════════════
//  PAGE BUILDER
// ═══════════════════════════════════════════════════════════════
async function buildPage(page) {
  switch(page) {
    case 'dashboard':     return await buildDashboard();
    case 'analytics':     return buildAnalytics();
    case 'users':         return buildUsers();
    case 'attendance':    return await buildAttendance();
    case 'salary':        return await buildSalary();
    case 'notifications': return buildNotifications();
    case 'settings':      return buildSettings();
    default:              return '<p>Page not found</p>';
  }
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
async function buildDashboard() {
  const ym = currentYM();
  // Load attendance for first 5 users in parallel
  const sample = ALL_USERS.slice(0, 8);
  const attData = await Promise.all(sample.map(u => loadAttendance(u.id, ym)));

  let totalPresent=0, totalHalf=0, totalAbsent=0, totalRecs=0;
  attData.forEach(recs => {
    const s = attSummary(recs);
    totalPresent += s.present; totalHalf += s.half; totalAbsent += s.absent; totalRecs += s.total;
  });
  const avgPct = totalRecs ? Math.round(((totalPresent + totalHalf*0.5)/totalRecs)*100) : 0;
  const activeUsers = ALL_USERS.filter(u => u.name).length;
  const totalPayroll = ALL_USERS.reduce((s,u)=>s+(u.monthlySalary||0),0);

  return `
  <div class="space-y-6">
    <!-- Firebase project info -->
    <div class="flex items-center gap-3 p-3 rounded-xl bg-soft-surface border border-divider text-sm text-secondary">
      <div class="w-2 h-2 rounded-full bg-green-400 shrink-0"></div>
      Connected to Firebase project: <span class="font-semibold text-primary">selfattendance-42445</span>
      &nbsp;·&nbsp; ${ALL_USERS.length} users loaded
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('Total Users',     ALL_USERS.length,    'linear-gradient(135deg,#7C3AED,#A855F7)', ICONS.users,    'Firestore users')}
      ${statCard('Active Profiles', activeUsers,         'linear-gradient(135deg,#059669,#34D399)', ICONS.check,    'With profile setup')}
      ${statCard('Avg Attendance',  avgPct+'%',          'linear-gradient(135deg,#0891B2,#22D3EE)', ICONS.calendar, 'Current month')}
      ${statCard('Total Payroll',   fmtINR(totalPayroll),'linear-gradient(135deg,#D97706,#FCD34D)', ICONS.rupee,    'Monthly basis')}
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-between mb-5">
          <div><h3 class="font-bold text-primary">Attendance Breakdown</h3><p class="text-secondary text-sm">Sample users — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}</p></div>
          <div class="flex gap-2 text-xs">
            <span class="badge badge-present">Present</span>
            <span class="badge badge-half">Half</span>
            <span class="badge badge-absent">Absent</span>
          </div>
        </div>
        <div class="chart-container"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Today's Split</h3>
        <p class="text-secondary text-sm mb-4">Based on loaded data</p>
        <div class="chart-container" style="height:180px"><canvas id="donutChart"></canvas></div>
        <div class="space-y-2 mt-4">
          ${legendRow('#00C853','Present',totalPresent)}
          ${legendRow('#FFB300','Half Day',totalHalf)}
          ${legendRow('#E53935','Absent',totalAbsent)}
        </div>
      </div>
    </div>

    <!-- Recent Users -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-primary">Recent Users</h3>
          <button onclick="navigate('users')" class="btn-outline text-xs py-1.5 px-3">View All</button>
        </div>
        ${ALL_USERS.length === 0 ? emptyState('No users found in Firestore') :
          `<div class="space-y-2">${ALL_USERS.slice(0,6).map((u,i) => `
          <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-soft-surface transition-colors cursor-pointer" onclick="showUserDetail('${u.id}')">
            ${avatar(u.name||'?')}
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-primary text-sm">${u.name||'<em class="text-secondary">No name</em>'}</div>
              <div class="text-secondary text-xs truncate">${u.id}</div>
            </div>
            ${u.monthlySalary ? `<span class="text-sm font-semibold text-violet">${fmtINR(u.monthlySalary,u.currency)}</span>` : ''}
          </div>`).join('')}</div>`}
      </div>

      <!-- Attendance summary table -->
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-4">Attendance Summary <span class="text-secondary font-normal text-sm">(This month)</span></h3>
        <div class="space-y-3">
          ${sample.map((u,i) => {
            const s = attSummary(attData[i]);
            return `<div class="flex items-center gap-3">
              ${avatar(u.name||'?','w-8 h-8 text-xs')}
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-primary truncate">${u.name||u.id.slice(0,12)}</div>
                <div class="progress-track mt-1"><div class="progress-fill" style="width:${s.pct}%"></div></div>
              </div>
              <span class="text-sm font-bold ${s.pct>=75?'text-green-500':s.pct>=50?'text-yellow-500':'text-red-400'}">${s.pct}%</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>`;

  // Save for chart rendering
  window._dashAttData = { sample, attData, totalPresent, totalHalf, totalAbsent };
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
    <div class="flex items-center gap-2"><div class="legend-dot" style="background:${color}"></div><span class="text-sm text-secondary">${label}</span></div>
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
      type:'bar',
      data:{
        labels: d.sample.map(u=>(u.name||u.id).split(' ')[0]),
        datasets:[
          {label:'Present', data:d.attData.map(r=>attSummary(r).present), backgroundColor:'rgba(124,58,237,0.85)', borderRadius:8, borderSkipped:false},
          {label:'Half',    data:d.attData.map(r=>attSummary(r).half),    backgroundColor:'rgba(255,179,0,0.7)',   borderRadius:8, borderSkipped:false},
          {label:'Absent',  data:d.attData.map(r=>attSummary(r).absent),  backgroundColor:'rgba(229,57,53,0.6)',   borderRadius:8, borderSkipped:false},
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{stacked:true, grid:{display:false}, ticks:{color:text, font:{size:11}}},
          y:{stacked:true, grid:{color:grid}, ticks:{color:text}, beginAtZero:true}
        }
      }
    });
  }

  const ctx2 = document.getElementById('donutChart');
  if (ctx2) {
    charts.donut = new Chart(ctx2, {
      type:'doughnut',
      data:{
        labels:['Present','Half Day','Absent'],
        datasets:[{data:[d.totalPresent, d.totalHalf, d.totalAbsent||1], backgroundColor:['#00C853','#FFB300','#E53935'], borderWidth:0, hoverOffset:6}]
      },
      options:{responsive:true, maintainAspectRatio:false, cutout:'72%', plugins:{legend:{display:false}}}
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════
function buildAnalytics() {
  return `
  <div class="space-y-6">
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${kpiCard('Total Users',    ALL_USERS.length, '',  false, 'Firestore')}
      ${kpiCard('With Salary Set', ALL_USERS.filter(u=>u.monthlySalary>0).length, '', false, 'Users')}
      ${kpiCard('Avg Salary',     fmtINR(ALL_USERS.length?ALL_USERS.reduce((s,u)=>s+(u.monthlySalary||0),0)/ALL_USERS.length:0), '', false, 'Monthly')}
      ${kpiCard('Total Payroll',  fmtINR(ALL_USERS.reduce((s,u)=>s+(u.monthlySalary||0),0)), '', false, 'Combined')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Salary Distribution</h3>
        <p class="text-secondary text-sm mb-4">Users by salary bracket</p>
        <div class="chart-container"><canvas id="salaryChart"></canvas></div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Working Days Config</h3>
        <p class="text-secondary text-sm mb-4">Users by working days set</p>
        <div class="chart-container"><canvas id="wdChart"></canvas></div>
      </div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary mb-4">Users Overview Table</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>UID</th><th>Unique ID</th><th>Salary</th><th>Working Days</th><th>Std Hours</th><th>Coins</th></tr></thead>
          <tbody>
            ${ALL_USERS.length === 0 ? `<tr><td colspan="7">${emptyState('No users in Firestore')}</td></tr>` :
              ALL_USERS.map(u => `
              <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
                <td><div class="flex items-center gap-3">${avatar(u.name||'?')}<div><div class="font-semibold text-sm">${u.name||'—'}</div></div></div></td>
                <td><code class="text-xs text-secondary font-mono">${u.id.slice(0,16)}…</code></td>
                <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId||'—'}</code></td>
                <td class="font-semibold">${u.monthlySalary?fmtINR(u.monthlySalary,u.currency):'—'}</td>
                <td>${u.workingDays||'—'}</td>
                <td>${u.standardHours||'—'}h</td>
                <td>${u.rewards?.coinBalance!=null?`<span class="coin-badge">🪙 ${u.rewards.coinBalance}</span>`:'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function kpiCard(label, value, change, positive, sub) {
  return `<div class="stat-card">
    <div class="text-secondary text-sm mb-2">${label}</div>
    <div class="text-2xl font-bold text-primary">${value}</div>
    <div class="text-xs text-secondary mt-1">${sub}</div>
  </div>`;
}

function initAnalyticsCharts() {
  const { text, grid } = chartColors();

  // Salary brackets
  const brackets = ['<20k','20-30k','30-40k','40-50k','50-60k','60k+'];
  const counts = [0,0,0,0,0,0];
  ALL_USERS.forEach(u => {
    const s = u.monthlySalary || 0;
    if (s < 20000) counts[0]++;
    else if (s < 30000) counts[1]++;
    else if (s < 40000) counts[2]++;
    else if (s < 50000) counts[3]++;
    else if (s < 60000) counts[4]++;
    else counts[5]++;
  });

  const ctx1 = document.getElementById('salaryChart');
  if (ctx1) charts.salary = new Chart(ctx1,{
    type:'bar',
    data:{labels:brackets, datasets:[{data:counts, backgroundColor:'rgba(124,58,237,0.8)', borderRadius:10, borderSkipped:false}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},ticks:{color:text}},y:{grid:{color:grid},ticks:{color:text,stepSize:1},beginAtZero:true}}}
  });

  // Working days
  const wdMap = {};
  ALL_USERS.forEach(u => { const d=(u.workingDays||0).toString(); wdMap[d]=(wdMap[d]||0)+1; });
  const wdLabels = Object.keys(wdMap).sort((a,b)=>+a-+b);
  const wdData   = wdLabels.map(k=>wdMap[k]);

  const ctx2 = document.getElementById('wdChart');
  if (ctx2) charts.wd = new Chart(ctx2,{
    type:'doughnut',
    data:{labels:wdLabels.map(l=>l+' days'), datasets:[{data:wdData, backgroundColor:['#7C3AED','#059669','#0891B2','#D97706','#E11D48'], borderWidth:0}]},
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:text,font:{size:12},boxWidth:12}}}}
  });
}

// ═══════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════
function buildUsers() {
  return `
  <div class="space-y-4">
    <div class="flex flex-wrap gap-3 items-center justify-between">
      <div class="flex gap-3 flex-1 min-w-0">
        <input id="userSearch" type="text" placeholder="Search name, UID, uniqueId…" class="input-field flex-1 max-w-sm py-2.5" oninput="filterUsers()" />
        <select id="salaryFilter" onchange="filterUsers()" class="py-2.5">
          <option value="">All Salaries</option>
          <option value="low">Below ₹30k</option>
          <option value="mid">₹30k–₹60k</option>
          <option value="high">Above ₹60k</option>
        </select>
      </div>
      <button class="btn-primary py-2.5 px-5" onclick="refreshUsers()">↻ Refresh</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>User</th><th>Firebase UID</th><th>Unique ID</th><th>Monthly Salary</th><th>Working Days</th><th>Coins</th><th>Actions</th></tr></thead>
          <tbody id="usersTbody">${usersTableRows(ALL_USERS)}</tbody>
        </table>
      </div>
      <div class="px-6 py-4 border-t border-divider flex items-center justify-between">
        <span class="text-sm text-secondary" id="userCount">${ALL_USERS.length} users from Firestore</span>
        <button onclick="exportUsersCSV()" class="btn-outline py-1.5 px-4 text-sm">Export CSV</button>
      </div>
    </div>
  </div>`;
}

function usersTableRows(users) {
  if (!users.length) return `<tr><td colspan="7">${emptyState('No users found')}</td></tr>`;
  return users.map(u => `
  <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
    <td><div class="flex items-center gap-3">${avatar(u.name||'?')}
      <div><div class="font-semibold text-primary text-sm">${u.name||'<span class="text-secondary italic">No name</span>'}</div>
      <div class="text-secondary text-xs">${u.email||'—'}</div></div></div></td>
    <td><code class="text-xs text-secondary font-mono">${u.id.slice(0,14)}…</code></td>
    <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId||'—'}</code></td>
    <td class="font-semibold">${u.monthlySalary?fmtINR(u.monthlySalary,u.currency):'—'}</td>
    <td>${u.workingDays?u.workingDays+' days':'—'}</td>
    <td>${u.rewards?.coinBalance!=null?`<span class="coin-badge">🪙 ${u.rewards.coinBalance}</span>`:'—'}</td>
    <td onclick="event.stopPropagation()">
      <div class="flex gap-2">
        <button onclick="showUserDetail('${u.id}')" class="btn-outline py-1 px-3 text-xs">View</button>
        <button onclick="confirmDeleteUser('${u.id}','${(u.name||'').replace(/'/g,"\\'")}') " class="btn-danger py-1 px-3 text-xs">Delete</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterUsers() {
  const q  = document.getElementById('userSearch').value.toLowerCase();
  const sf = document.getElementById('salaryFilter').value;
  const filtered = ALL_USERS.filter(u => {
    const matchQ = !q || (u.name||'').toLowerCase().includes(q) || (u.id||'').includes(q) || (u.uniqueId||'').includes(q) || (u.email||'').toLowerCase().includes(q);
    let matchS = true;
    if (sf === 'low')  matchS = (u.monthlySalary||0) < 30000;
    if (sf === 'mid')  matchS = (u.monthlySalary||0) >= 30000 && (u.monthlySalary||0) < 60000;
    if (sf === 'high') matchS = (u.monthlySalary||0) >= 60000;
    return matchQ && matchS;
  });
  document.getElementById('usersTbody').innerHTML = usersTableRows(filtered);
  document.getElementById('userCount').textContent = `${filtered.length} of ${ALL_USERS.length} users`;
}

async function refreshUsers() {
  ATTENDANCE_CACHE = {};
  await loadAllUsers();
  navigate('users');
  showToast('Users refreshed from Firebase!');
}

function exportUsersCSV() {
  const headers = ['UID','Name','Email','UniqueID','Salary','WorkingDays','StandardHours','Coins'];
  const rows = ALL_USERS.map(u => [u.id, u.name||'', u.email||'', u.uniqueId||'', u.monthlySalary||0, u.workingDays||0, u.standardHours||0, u.rewards?.coinBalance||0]);
  const csv = [headers, ...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='selfattendance_users.csv'; a.click();
  showToast('Users CSV exported!');
}

// User Detail Modal
async function showUserDetail(uid) {
  const u = ALL_USERS.find(x=>x.id===uid);
  if (!u) { showToast('User not found','error'); return; }

  // Load attendance
  const modal = openModal('userModal');
  modal.innerHTML = `
  <div class="modal">
    <div class="flex items-start justify-between mb-5">
      <div class="flex items-center gap-4">${avatar(u.name||'?')}<div>
        <h2 class="text-xl font-bold text-primary">${u.name||'No name'}</h2>
        <p class="text-secondary text-sm font-mono text-xs">${u.id}</p>
      </div></div>
      <button onclick="closeModal('userModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>
    <div id="userDetailBody"><div class="flex justify-center py-8"><div class="spinner"></div></div></div>
  </div>`;

  try {
    const ym = currentYM();
    const records = await loadAttendance(uid, ym);
    const s = attSummary(records);
    const estSal = estimatedSalary(u, s);

    document.getElementById('userDetailBody').innerHTML = `
      <div class="grid grid-cols-2 gap-3 mb-5">
        ${miniStat('Unique ID', '#'+(u.uniqueId||'—'), 'text-violet font-mono')}
        ${miniStat('Monthly Salary', u.monthlySalary?fmtINR(u.monthlySalary,u.currency):'Not set')}
        ${miniStat('Working Days', u.workingDays?(u.workingDays+' days'):'Not set')}
        ${miniStat('Std Hours', u.standardHours?(u.standardHours+'h/day'):'Not set')}
        ${miniStat('Overtime Rate', u.overtimeRate?(u.overtimeRate+'x'):'—')}
        ${miniStat('Coins', u.rewards?.coinBalance!=null?('🪙 '+u.rewards.coinBalance):'—')}
      </div>

      ${u.rewards ? `
      <div class="bg-soft-surface rounded-2xl p-4 mb-4">
        <h4 class="font-semibold text-primary text-sm mb-2">Reward Details</h4>
        <div class="grid grid-cols-2 gap-2 text-sm">
          ${miniStat('Coin Balance', '🪙 '+(u.rewards.coinBalance||0))}
          ${miniStat('Total Earned', '🪙 '+(u.rewards.totalCoinsEarned||0))}
          ${miniStat('Last Spin', u.rewards.lastSpinDate||'—')}
          ${miniStat('Daily Spins Used', u.rewards.dailySpinsUsed||0)}
        </div>
      </div>` : ''}

      <div class="bg-soft-surface rounded-2xl p-4 mb-5">
        <h4 class="font-semibold text-primary mb-3">Attendance — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}</h4>
        ${s.total === 0 ? '<p class="text-secondary text-sm">No records found this month.</p>' : `
        <div class="grid grid-cols-4 gap-3 text-center mb-3">
          <div><div class="text-xl font-bold text-violet">${s.pct}%</div><div class="text-xs text-secondary">Rate</div></div>
          <div><div class="text-xl font-bold text-green-500">${s.present}</div><div class="text-xs text-secondary">Present</div></div>
          <div><div class="text-xl font-bold text-yellow-500">${s.half}</div><div class="text-xs text-secondary">Half</div></div>
          <div><div class="text-xl font-bold text-red-400">${s.absent}</div><div class="text-xs text-secondary">Absent</div></div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${s.pct}%"></div></div>
        ${u.monthlySalary ? `<div class="mt-3 flex items-center justify-between">
          <span class="text-sm text-secondary">Estimated Salary</span>
          <span class="font-bold text-primary">${fmtINR(estSal,u.currency)}</span>
        </div>` : ''}`}
      </div>

      ${records.length ? `
      <div class="mb-5">
        <h4 class="font-semibold text-primary mb-2 text-sm">Recent Records</h4>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          ${records.slice(0,10).map(r=>`
          <div class="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-soft-surface text-sm">
            <span class="text-secondary">${formatDate(r.date)}</span>
            ${statusBadge(r.status)}
            <span class="text-secondary">${r.workedHours?r.workedHours+'h':'—'}</span>
            ${r.overtimeHours>0?`<span class="badge badge-overtime">+${r.overtimeHours}h OT</span>`:''}
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="flex gap-3">
        <button onclick="navigate('attendance')" class="btn-outline flex-1">View Attendance</button>
        <button onclick="closeModal('userModal')" class="btn-ghost flex-1">Close</button>
      </div>`;
  } catch(e) {
    document.getElementById('userDetailBody').innerHTML = `<div class="fb-error">Error loading user data: ${e.message}</div>`;
  }
}

function miniStat(label, value, cls='') {
  return `<div class="bg-app rounded-xl p-3"><div class="text-xs text-secondary mb-0.5">${label}</div><div class="font-semibold text-primary text-sm ${cls}">${value}</div></div>`;
}

function confirmDeleteUser(uid, name) {
  const modal = openModal('deleteModal');
  modal.innerHTML = `
  <div class="modal max-w-sm">
    <h2 class="text-xl font-bold text-primary mb-3">Delete User?</h2>
    <p class="text-secondary mb-5">This will delete the Firestore profile for <strong>${name}</strong>. Firebase Auth account remains. This cannot be undone.</p>
    <div class="flex gap-3">
      <button onclick="deleteUserProfile('${uid}')" class="btn-danger flex-1 justify-center">Delete Profile</button>
      <button onclick="closeModal('deleteModal')" class="btn-ghost flex-1">Cancel</button>
    </div>
  </div>`;
}

async function deleteUserProfile(uid) {
  try {
    await db.collection('users').doc(uid).delete();
    ALL_USERS = ALL_USERS.filter(u=>u.id!==uid);
    closeModal('deleteModal');
    showToast('User profile deleted from Firestore');
    navigate('users');
  } catch(e) {
    showToast('Error: '+e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════════════════════════
let attSelectedUser = null;
let attSelectedYM   = currentYM();

async function buildAttendance() {
  const ym = attSelectedYM;
  if (!attSelectedUser && ALL_USERS.length) attSelectedUser = ALL_USERS[0].id;

  let records = [];
  if (attSelectedUser) records = await loadAttendance(attSelectedUser, ym);

  const ymOptions = [];
  for (let i=0; i<6; i++) {
    const d = new Date(); d.setMonth(d.getMonth()-i);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = d.toLocaleString('default',{month:'long',year:'numeric'});
    ymOptions.push(`<option value="${val}" ${val===ym?'selected':''}>${lbl}</option>`);
  }

  const s = attSummary(records);
  const selUser = ALL_USERS.find(u=>u.id===attSelectedUser);

  return `
  <div class="space-y-4">
    <div class="flex flex-wrap gap-3 items-center">
      <select id="attUserSel" onchange="changeAttUser(this.value)" class="py-2.5">
        ${ALL_USERS.map(u=>`<option value="${u.id}" ${u.id===attSelectedUser?'selected':''}>${u.name||u.id.slice(0,16)}</option>`).join('')}
      </select>
      <select id="attMonthSel" onchange="changeAttMonth(this.value)" class="py-2.5">${ymOptions.join('')}</select>
      <button onclick="openAddAttendance()" class="btn-primary py-2.5 px-5">+ Add Record</button>
      <button onclick="exportAttCSV()" class="btn-outline py-2.5 px-4">Export CSV</button>
    </div>

    <!-- Summary cards -->
    ${selUser && s.total ? `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${miniStatCard('Attendance Rate', s.pct+'%', 'text-violet')}
      ${miniStatCard('Present Days', s.present, 'text-green-500')}
      ${miniStatCard('Half Days', s.half, 'text-yellow-500')}
      ${miniStatCard('Absent Days', s.absent, 'text-red-400')}
    </div>
    ${selUser?.monthlySalary ? `<div class="card p-4 flex items-center justify-between">
      <div class="text-secondary text-sm">Estimated salary for ${new Date(ym).toLocaleString('default',{month:'long',year:'numeric'})}</div>
      <div class="text-2xl font-bold text-primary">${fmtINR(estimatedSalary(selUser,s),selUser.currency)}</div>
    </div>` : ''}` : ''}

    <div class="card">
      <div class="p-4 border-b border-divider">
        <h3 class="font-bold text-primary">${selUser?.name||'Select user'} — Attendance Records</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Status</th><th>Worked Hours</th><th>Overtime</th><th>Updated</th><th>Actions</th></tr></thead>
          <tbody id="attTbody">
            ${records.length===0 ? `<tr><td colspan="6">${emptyState('No records for this period')}</td></tr>` :
              records.map(r=>`
              <tr>
                <td class="font-medium">${formatDate(r.date)}</td>
                <td>${statusBadge(r.status)}</td>
                <td>${r.workedHours>0?r.workedHours+'h':'—'}</td>
                <td>${r.overtimeHours>0?`<span class="badge badge-overtime">+${r.overtimeHours}h</span>`:'—'}</td>
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

function miniStatCard(label, value, cls) {
  return `<div class="card p-4 text-center"><div class="text-2xl font-bold ${cls}">${value}</div><div class="text-secondary text-sm mt-1">${label}</div></div>`;
}

async function changeAttUser(uid) { attSelectedUser = uid; navigate('attendance'); }
async function changeAttMonth(ym) { attSelectedYM = ym; navigate('attendance'); }

function initAttendanceFilters() {}

function openAddAttendance() {
  const today = new Date().toISOString().slice(0,10);
  openAttModal('Add Record', today, 'PRESENT', 8, 0, async (date,status,wh,oh)=>{
    await saveAttendance(attSelectedUser, date, status, wh, oh);
    showToast('Attendance saved to Firebase!');
    navigate('attendance');
  });
}

function openEditAttendance(date, status, wh, oh) {
  openAttModal('Edit Record', date, status, wh, oh, async (newDate,newStatus,newWh,newOh)=>{
    await saveAttendance(attSelectedUser, date, newStatus, newWh, newOh);
    showToast('Attendance updated in Firebase!');
    navigate('attendance');
  });
}

function openAttModal(title, date, status, wh, oh, onSave) {
  const modal = openModal('attModal');
  modal.innerHTML = `
  <div class="modal max-w-sm">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-lg font-bold text-primary">${title}</h2>
      <button onclick="closeModal('attModal')" class="text-secondary hover:text-primary text-2xl">&times;</button>
    </div>
    <div class="space-y-4 mb-5">
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Date</label>
        <input type="date" id="attDate" value="${date}" class="input-field" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Status</label>
        <div class="flex gap-2">
          <button id="btn_PRESENT" onclick="selectAttStatus('PRESENT')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${status==='PRESENT'?'bg-green-500 text-white border-transparent':'border-green-400 text-green-500'}">✓ Present</button>
          <button id="btn_HALF" onclick="selectAttStatus('HALF')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${status==='HALF'||status==='HALF_DAY'?'bg-yellow-400 text-white border-transparent':'border-yellow-400 text-yellow-500'}">◐ Half</button>
          <button id="btn_ABSENT" onclick="selectAttStatus('ABSENT')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${status==='ABSENT'?'bg-red-500 text-white border-transparent':'border-red-400 text-red-400'}">✕ Absent</button>
        </div>
      </div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Worked Hours</label>
        <input type="number" id="attWh" value="${wh}" step="0.5" class="input-field" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Overtime Hours</label>
        <input type="number" id="attOh" value="${oh}" step="0.5" class="input-field" /></div>
    </div>
    <div class="flex gap-3">
      <button id="attSaveBtn" class="btn-primary flex-1" onclick="saveAttendanceForm()">Save to Firebase</button>
      <button onclick="closeModal('attModal')" class="btn-ghost flex-1">Cancel</button>
    </div>
  </div>`;
  window._attOnSave = onSave;
  window._attStatus = status;
}

function selectAttStatus(status) {
  window._attStatus = status;
  ['PRESENT','HALF','ABSENT'].forEach(s => {
    const btn = document.getElementById('btn_'+s);
    if (!btn) return;
    const map = {PRESENT:'bg-green-500',HALF:'bg-yellow-400',ABSENT:'bg-red-500'};
    const borderMap = {PRESENT:'border-green-400 text-green-500',HALF:'border-yellow-400 text-yellow-500',ABSENT:'border-red-400 text-red-400'};
    if (s===status) {
      btn.className = `flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${map[s]} text-white border-transparent`;
    } else {
      btn.className = `flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors ${borderMap[s]}`;
    }
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
      document.getElementById('attOh').value
    );
    closeModal('attModal');
  } catch(e) {
    showToast('Error: '+e.message,'error');
    btn.disabled = false; btn.textContent = 'Save to Firebase';
  }
}

function confirmDeleteAtt(date) {
  if (!confirm(`Delete attendance for ${formatDate(date)}?`)) return;
  deleteAttendance(attSelectedUser, date)
    .then(() => { showToast('Record deleted'); navigate('attendance'); })
    .catch(e => showToast('Error: '+e.message,'error'));
}

function exportAttCSV() {
  const ym = attSelectedYM;
  const key = `${attSelectedUser}_${ym}`;
  const records = ATTENDANCE_CACHE[key] || [];
  const u = ALL_USERS.find(x=>x.id===attSelectedUser);
  const headers = ['Date','Status','WorkedHours','OvertimeHours'];
  const rows = records.map(r=>[r.date,r.status,r.workedHours||0,r.overtimeHours||0]);
  const csv = [headers,...rows].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`attendance_${u?.name||attSelectedUser}_${ym}.csv`; a.click();
  showToast('CSV exported!');
}

// ═══════════════════════════════════════════════════════════════
//  SALARY REPORTS
// ═══════════════════════════════════════════════════════════════
async function buildSalary() {
  const ym = currentYM();
  const sample = ALL_USERS.slice(0, 15);
  const attData = await Promise.all(sample.map(u => loadAttendance(u.id, ym)));

  const summaries = sample.map((u,i) => {
    const s = attSummary(attData[i]);
    return { ...u, ...s, estSal: estimatedSalary(u,s), deduction: (u.monthlySalary||0) - estimatedSalary(u,s) };
  });

  const totalPayroll = summaries.reduce((s,u)=>s+(u.monthlySalary||0),0);
  const totalEst     = summaries.reduce((s,u)=>s+u.estSal,0);
  const totalDed     = summaries.reduce((s,u)=>s+Math.max(0,u.deduction),0);

  return `
  <div class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${statCard('Total Payroll',    fmtINR(totalPayroll),'linear-gradient(135deg,#7C3AED,#A855F7)',ICONS.rupee,'Monthly basis')}
      ${statCard('Estimated Payout', fmtINR(totalEst),    'linear-gradient(135deg,#059669,#34D399)',ICONS.check,'Based on attendance')}
      ${statCard('Total Deductions', fmtINR(totalDed),    'linear-gradient(135deg,#E53935,#EF5350)',ICONS.rupee,'Absence deductions')}
    </div>

    <div class="card">
      <div class="p-5 border-b border-divider flex items-center justify-between flex-wrap gap-3">
        <h3 class="font-bold text-primary">Salary Breakdown — ${new Date().toLocaleString('default',{month:'long',year:'numeric'})}</h3>
        <div class="flex gap-2">
          <button onclick="exportSalaryCSV(${JSON.stringify(summaries).replace(/</g,'&lt;')})" class="btn-outline py-2 px-4 text-sm">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th>Unique ID</th><th>Monthly Salary</th><th>Present</th><th>Half</th><th>Absent</th><th>Attendance %</th><th>Est. Payout</th><th>Deduction</th></tr></thead>
          <tbody>
            ${summaries.length===0?`<tr><td colspan="9">${emptyState('No users found')}</td></tr>`:
              summaries.map(u=>`
              <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
                <td><div class="flex items-center gap-3">${avatar(u.name||'?')}<div>
                  <div class="font-semibold text-primary text-sm">${u.name||'No name'}</div>
                </div></div></td>
                <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId||'—'}</code></td>
                <td class="font-semibold">${u.monthlySalary?fmtINR(u.monthlySalary,u.currency):'—'}</td>
                <td><span class="badge badge-present">${u.present}</span></td>
                <td><span class="badge badge-half">${u.half}</span></td>
                <td><span class="badge badge-absent">${u.absent}</span></td>
                <td><div class="flex items-center gap-2">
                  <div class="progress-track w-16"><div class="progress-fill" style="width:${u.pct}%"></div></div>
                  <span class="text-sm font-semibold ${u.pct>=75?'text-green-500':u.pct>=50?'text-yellow-500':'text-red-400'}">${u.pct}%</span>
                </div></td>
                <td class="font-bold text-primary">${u.monthlySalary?fmtINR(u.estSal,u.currency):'—'}</td>
                <td class="${u.deduction>0?'text-red-400 font-semibold':'text-secondary'}">${u.monthlySalary&&u.deduction>0?'-'+fmtINR(u.deduction,u.currency):'—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${sample.length < ALL_USERS.length ? `<div class="px-6 py-3 text-secondary text-sm border-t border-divider">Showing ${sample.length} of ${ALL_USERS.length} users</div>` : ''}
    </div>
  </div>`;
}

function exportSalaryCSV() {
  const key = currentYM();
  const usersWithAtt = ALL_USERS.slice(0,15).map((u,i)=>{
    const recs = ATTENDANCE_CACHE[`${u.id}_${key}`]||[];
    const s = attSummary(recs);
    return [u.name||'',u.uniqueId||'',u.monthlySalary||0,s.present,s.half,s.absent,s.pct+'%',estimatedSalary(u,s)];
  });
  const headers=['Name','UniqueID','MonthlySalary','Present','Half','Absent','AttPct','EstPayout'];
  const csv=[headers,...usersWithAtt].map(r=>r.join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`salary_report_${key}.csv`;a.click();
  showToast('Salary CSV exported!');
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function buildNotifications() {
  return `
  <div class="space-y-4">
    <div class="card p-6">
      <h3 class="font-bold text-primary mb-4">Send Push Notification</h3>
      <p class="text-secondary text-sm mb-4">Uses Firebase Cloud Messaging. Ensure FCM is set up in your Firebase project.</p>
      <div class="space-y-3">
        <div><label class="text-sm font-medium text-secondary block mb-1.5">Target</label>
          <select class="w-full py-2.5"><option>All Users (FCM topic)</option><option>Specific User</option></select></div>
        <div><label class="text-sm font-medium text-secondary block mb-1.5">Title</label>
          <input id="notifTitle" type="text" class="input-field" placeholder="Attendance Reminder" /></div>
        <div><label class="text-sm font-medium text-secondary block mb-1.5">Message</label>
          <textarea id="notifBody" class="input-field" rows="3" placeholder="Don't forget to mark your attendance today!" style="resize:vertical"></textarea></div>
        <button onclick="sendNotification()" class="btn-primary py-3 px-6">Send via FCM</button>
      </div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary mb-3">FCM Setup Note</h3>
      <div class="space-y-2 text-sm text-secondary">
        <p>• Add your <strong class="text-primary">FCM Server Key</strong> in <code class="bg-soft-surface px-1.5 py-0.5 rounded text-xs">js/firebase-config.js</code></p>
        <p>• Notifications require a backend (Cloud Functions) or use FCM REST API from this panel</p>
        <p>• Firebase project: <code class="bg-soft-surface px-1.5 py-0.5 rounded text-xs">selfattendance-42445</code></p>
        <p>• Messaging Sender ID: <code class="bg-soft-surface px-1.5 py-0.5 rounded text-xs">611062377939</code></p>
      </div>
    </div>
  </div>`;
}

function sendNotification() {
  const t = document.getElementById('notifTitle').value;
  const b = document.getElementById('notifBody').value;
  if (!t||!b) { showToast('Fill in title and message','error'); return; }
  showToast('FCM notification queued (configure FCM server key to send)');
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
function buildSettings() {
  return `
  <div class="max-w-2xl space-y-4">
    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-4">Firebase Project</h3>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Project ID</label><code class="text-violet font-mono text-sm bg-soft-surface px-3 py-1.5 rounded-xl">selfattendance-42445</code></div>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Auth Domain</label><code class="text-sm bg-soft-surface px-3 py-1.5 rounded-xl">selfattendance-42445.firebaseapp.com</code></div>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Sender ID</label><code class="text-sm bg-soft-surface px-3 py-1.5 rounded-xl">611062377939</code></div>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Storage Bucket</label><code class="text-sm bg-soft-surface px-3 py-1.5 rounded-xl">selfattendance-42445.firebasestorage.app</code></div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-2">Firestore Collections</h3>
      <p class="text-secondary text-sm mb-4">Data structure used by the app</p>
      <div class="space-y-2 text-sm">
        ${collectionRow('users/{uid}','User profile, salary config, rewards, premiumUnlocks')}
        ${collectionRow('attendance/{uid}/days/{date}','Daily attendance records (status, hours, overtime)')}
        ${collectionRow('userIds/{6digit}','Unique ID registry to prevent collisions')}
        ${collectionRow('referrals/{uid}','Referral tracking per user')}
        ${collectionRow('referralCodes/{code}','Referral code → uid mapping')}
      </div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-4">Admin Features</h3>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Load More Users</label><button onclick="loadMoreUsers()" class="btn-outline py-2 px-4 text-sm">Load All Users</button></div>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Clear Cache</label><button onclick="clearCache()" class="btn-ghost py-2 px-4 text-sm">Clear Attendance Cache</button></div>
      <div class="settings-row"><label class="font-medium text-primary text-sm">Dark Mode</label>
        <div class="toggle ${isDark?'on':''}" id="toggle_dark" onclick="toggleTheme();this.classList.toggle('on')"></div>
      </div>
    </div>

    <div class="card p-6">
      <h3 class="font-bold text-primary text-lg mb-3">Firestore Security Rules</h3>
      <p class="text-secondary text-sm mb-3">Add these rules in Firebase Console to allow admin access:</p>
      <pre class="bg-soft-surface rounded-xl p-4 text-xs overflow-x-auto text-primary leading-relaxed">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin emails that can read all data
    function isAdmin() {
      return request.auth != null &&
        request.auth.token.email in [
          'your-admin@email.com'
        ];
    }
    match /users/{uid} {
      allow read: if isAdmin() || request.auth.uid == uid;
      allow write: if request.auth.uid == uid;
    }
    match /attendance/{uid}/days/{date} {
      allow read: if isAdmin() || request.auth.uid == uid;
      allow write: if request.auth.uid == uid;
    }
  }
}</pre>
    </div>
  </div>`;
}

function collectionRow(path, desc) {
  return `<div class="settings-row"><div><code class="text-violet font-mono text-xs bg-soft-surface px-2 py-1 rounded-lg">${path}</code><p class="text-secondary text-xs mt-1">${desc}</p></div></div>`;
}

function initToggles() {}

async function loadMoreUsers() {
  try {
    const snap = await usersCol().get();
    ALL_USERS = snap.docs.map(doc=>({id:doc.id,...doc.data()}));
    document.getElementById('navUserCount').textContent = ALL_USERS.length;
    showToast(`Loaded all ${ALL_USERS.length} users from Firestore!`);
  } catch(e) { showToast('Error: '+e.message,'error'); }
}

function clearCache() {
  ATTENDANCE_CACHE = {};
  showToast('Attendance cache cleared!');
}

// ═══════════════════════════════════════════════════════════════
//  MODAL HELPERS
// ═══════════════════════════════════════════════════════════════
function openModal(id) {
  closeModal(id);
  const el = document.createElement('div');
  el.className = 'modal-overlay'; el.id = id;
  el.addEventListener('click', e => { if(e.target===el) closeModal(id); });
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
function showToast(msg, type='success') {
  const el = document.createElement('div');
  const bg = type==='error' ? 'background:var(--red-accent)' : 'background:var(--violet)';
  el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;${bg};color:white;padding:12px 20px;border-radius:14px;font-family:Inter,sans-serif;font-size:14px;font-weight:500;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:fadeIn .3s ease;max-width:360px;`;
  el.innerHTML = (type==='success'?'✓ ':type==='error'?'✕ ':'')+msg;
  document.body.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);}, 3500);
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

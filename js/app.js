// ═══════════════════════════════════════════════════════════════
//  Self Attendance Pro — Admin Panel App Logic
// ═══════════════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────────────
const ADMIN_EMAIL = 'admin@selfattendance.app';
const ADMIN_PASS  = 'admin123';
let currentPage = 'dashboard';
let isDark = false;
let sidebarOpen = false;
let charts = {};

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  if (email === ADMIN_EMAIL && pass === ADMIN_PASS) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    navigate('dashboard');
  } else {
    errEl.classList.remove('hidden');
    errEl.textContent = 'Invalid email or password. Try admin@selfattendance.app / admin123';
  }
}

function handleLogout() {
  document.getElementById('mainApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// Enter key on login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !document.getElementById('loginScreen').classList.contains('hidden')) handleLogin();
});

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeLabel').textContent = isDark ? 'Dark Mode' : 'Light Mode';
  document.getElementById('themeIcon').innerHTML = isDark
    ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
    : '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  // Redraw charts for dark mode
  setTimeout(() => { if (currentPage === 'dashboard') renderDashboard(); if (currentPage === 'analytics') renderAnalytics(); }, 50);
}

// ── Sidebar ───────────────────────────────────────────────────
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', sidebarOpen);
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('show', sidebarOpen);
}

// ── Navigation ────────────────────────────────────────────────
function navigate(page) {
  currentPage = page;
  // Destroy old charts
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(_) {} });
  charts = {};

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update page title
  const titles = {
    dashboard:     ['Dashboard',        'Welcome back, Admin'],
    analytics:     ['Analytics',        'App usage & trends'],
    users:         ['Users',            `${MOCK_USERS.length} total users`],
    attendance:    ['Attendance',       'All attendance records'],
    salary:        ['Salary Reports',   'Salary breakdown by user'],
    notifications: ['Notifications',   `${MOCK_NOTIFICATIONS.filter(n=>n.unread).length} unread`],
    settings:      ['Settings',        'App configuration'],
  };
  const [title, sub] = titles[page] || ['Admin', ''];
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('pageSubtitle').textContent = sub;

  const content = document.getElementById('pageContent');
  content.innerHTML = '<div class="page-enter">' + renderPage(page) + '</div>';

  // Post-render hooks
  setTimeout(() => {
    if (page === 'dashboard')     initDashboardCharts();
    if (page === 'analytics')     initAnalyticsCharts();
    if (page === 'users')         initUserFilters();
    if (page === 'attendance')    initAttendanceFilters();
    if (page === 'settings')      initToggles();
  }, 50);

  // Close mobile sidebar
  if (sidebarOpen) toggleSidebar();
}

function renderPage(page) {
  switch(page) {
    case 'dashboard':     return renderDashboard();
    case 'analytics':     return renderAnalytics();
    case 'users':         return renderUsers();
    case 'attendance':    return renderAttendance();
    case 'salary':        return renderSalary();
    case 'notifications': return renderNotifications();
    case 'settings':      return renderSettings();
    default:              return '<p>Page not found</p>';
  }
}

// ── Helpers ───────────────────────────────────────────────────
function fmtINR(n) {
  return '₹' + n.toLocaleString('en-IN');
}
function avatar(name, size='md') {
  const initials = name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return `<div class="avatar ${size==='sm'?'w-8 h-8 text-xs':''}">${initials}</div>`;
}
function statusBadge(status) {
  const map = {
    PRESENT: ['badge-present','✓ Present'],
    HALF:    ['badge-half',   '◐ Half Day'],
    ABSENT:  ['badge-absent', '✕ Absent'],
  };
  const [cls, label] = map[status] || ['','—'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function renderDashboard() {
  const stats = getStats();
  const summaries = getSummaryByUser();

  return `
  <div class="space-y-6">
    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('Total Users', MOCK_USERS.length, 'linear-gradient(135deg,#7C3AED,#A855F7)', icons.users, '+3 this week')}
      ${statCard('Active Users', MOCK_USERS.filter(u=>u.status==='active').length, 'linear-gradient(135deg,#059669,#34D399)', icons.check, '83% of total')}
      ${statCard('Avg. Attendance', stats.total ? Math.round(((stats.present + stats.half*0.5)/stats.total)*100)+'%' : '0%', 'linear-gradient(135deg,#0891B2,#22D3EE)', icons.calendar, 'This month')}
      ${statCard('Total Payroll', '₹'+Math.round(MOCK_USERS.reduce((s,u)=>s+u.monthlySalary,0)/1000)+'K', 'linear-gradient(135deg,#D97706,#FCD34D)', icons.rupee, 'Monthly est.')}
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Attendance trend -->
      <div class="card p-6 lg:col-span-2">
        <div class="flex items-center justify-between mb-5">
          <div>
            <h3 class="font-bold text-primary">Attendance Trend</h3>
            <p class="text-secondary text-sm">Last 7 days overview</p>
          </div>
          <div class="flex gap-2">
            <span class="badge badge-present">Present</span>
            <span class="badge badge-half">Half</span>
            <span class="badge badge-absent">Absent</span>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="trendChart"></canvas>
        </div>
      </div>

      <!-- Donut -->
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Today's Status</h3>
        <p class="text-secondary text-sm mb-4">All users combined</p>
        <div class="chart-container" style="height:180px">
          <canvas id="donutChart"></canvas>
        </div>
        <div class="space-y-2 mt-4">
          ${legendRow('#00C853','Present', MOCK_USERS.filter(u=>u.status==='active').length)}
          ${legendRow('#FFB300','Half Day', 2)}
          ${legendRow('#E53935','Absent', MOCK_USERS.filter(u=>u.status==='inactive').length)}
        </div>
      </div>
    </div>

    <!-- Recent Users + Top Streaks -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Recent users -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-primary">Recent Users</h3>
          <button onclick="navigate('users')" class="btn-outline text-xs py-1.5 px-3">View All</button>
        </div>
        <div class="space-y-3">
          ${MOCK_USERS.slice(0,5).map(u => `
          <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-soft-surface transition-colors cursor-pointer" onclick="showUserDetail('${u.id}')">
            ${avatar(u.name)}
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-primary text-sm">${u.name}</div>
              <div class="text-secondary text-xs truncate">${u.email}</div>
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="badge ${u.status==='active'?'badge-active':'badge-inactive'} text-xs">${u.status}</span>
              <span class="text-xs text-secondary">${u.lastSeen}</span>
            </div>
          </div>`).join('')}
        </div>
      </div>

      <!-- Top streaks -->
      <div class="card p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-primary">Top Streaks</h3>
          <span class="text-secondary text-sm">This month</span>
        </div>
        <div class="space-y-3">
          ${[...MOCK_USERS].sort((a,b)=>b.streak-a.streak).slice(0,5).map((u,i) => `
          <div class="flex items-center gap-3">
            <div class="w-6 text-center font-bold text-xs ${i===0?'text-yellow-400':i===1?'text-secondary':i===2?'text-orange-400':'text-secondary'}">${i+1}</div>
            ${avatar(u.name)}
            <div class="flex-1">
              <div class="font-semibold text-primary text-sm">${u.name}</div>
              <div class="progress-track mt-1.5">
                <div class="progress-fill" style="width:${Math.min(u.streak/60*100,100)}%"></div>
              </div>
            </div>
            <div class="font-bold text-violet text-sm">${u.streak}d</div>
          </div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function statCard(label, value, gradient, iconHtml, sub) {
  return `
  <div class="stat-card">
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

function initDashboardCharts() {
  const textColor  = isDark ? '#B0A8CC' : '#6B7280';
  const gridColor  = isDark ? '#2D2460' : '#EDE9FE';

  // Trend chart
  const ctx1 = document.getElementById('trendChart');
  if (!ctx1) return;
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Mon'];
  charts.trend = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        { label:'Present', data:[8,9,7,10,8,6,9], backgroundColor:'rgba(124,58,237,0.85)', borderRadius:8, borderSkipped:false },
        { label:'Half',    data:[1,0,2,0,1,1,1],  backgroundColor:'rgba(255,179,0,0.7)',   borderRadius:8, borderSkipped:false },
        { label:'Absent',  data:[3,3,3,2,3,5,2],  backgroundColor:'rgba(229,57,53,0.6)',   borderRadius:8, borderSkipped:false },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ stacked:true, grid:{display:false}, ticks:{color:textColor, font:{size:12}} },
        y:{ stacked:true, grid:{color:gridColor}, ticks:{color:textColor, font:{size:12}}, beginAtZero:true },
      }
    }
  });

  // Donut
  const ctx2 = document.getElementById('donutChart');
  if (!ctx2) return;
  charts.donut = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Present','Half Day','Absent'],
      datasets:[{ data:[10,2,2], backgroundColor:['#00C853','#FFB300','#E53935'], borderWidth:0, hoverOffset:6 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'72%',
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:ctx=>`${ctx.label}: ${ctx.raw}` } } }
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS
// ═══════════════════════════════════════════════════════════════
function renderAnalytics() {
  return `
  <div class="space-y-6">
    <!-- Month selector -->
    <div class="flex flex-wrap gap-2">
      ${['Jan','Feb','Mar','Apr','May','Jun','Jul'].map((m,i)=>`
        <button class="month-btn ${i===6?'active':''}" onclick="selectMonth(this,'${m}')">${m} 2025</button>
      `).join('')}
    </div>

    <!-- KPI row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${kpiCard('Avg Attendance', '78.4%',  '+4.2%',  true)}
      ${kpiCard('DAU',            '9.8',    '+1.2',   true)}
      ${kpiCard('Retention',      '87.5%',  '-0.8%',  false)}
      ${kpiCard('Avg Salary',     '₹42.8K', '+₹2.1K', true)}
    </div>

    <!-- Monthly trend + Theme usage -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="card p-6 lg:col-span-2">
        <h3 class="font-bold text-primary mb-1">Monthly Attendance Rate</h3>
        <p class="text-secondary text-sm mb-4">Across all users — Jan to Jul 2025</p>
        <div class="chart-container">
          <canvas id="monthlyChart"></canvas>
        </div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Theme Usage</h3>
        <p class="text-secondary text-sm mb-4">Which theme users prefer</p>
        <div class="chart-container" style="height:200px">
          <canvas id="themeChart"></canvas>
        </div>
      </div>
    </div>

    <!-- User growth + Currency distribution -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">User Growth</h3>
        <p class="text-secondary text-sm mb-4">Cumulative new registrations</p>
        <div class="chart-container">
          <canvas id="growthChart"></canvas>
        </div>
      </div>
      <div class="card p-6">
        <h3 class="font-bold text-primary mb-1">Attendance Distribution</h3>
        <p class="text-secondary text-sm mb-4">Present vs Half vs Absent</p>
        <div class="chart-container">
          <canvas id="distChart"></canvas>
        </div>
      </div>
    </div>
  </div>`;
}

function kpiCard(label, value, change, positive) {
  return `<div class="stat-card">
    <div class="text-secondary text-sm mb-2">${label}</div>
    <div class="text-2xl font-bold text-primary">${value}</div>
    <div class="text-sm font-semibold mt-1 ${positive?'text-green-500':'text-red-400'}">${positive?'↑':'↓'} ${change} vs last month</div>
  </div>`;
}

function selectMonth(btn, m) {
  document.querySelectorAll('.month-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

function initAnalyticsCharts() {
  const textColor = isDark ? '#B0A8CC' : '#6B7280';
  const gridColor = isDark ? '#2D2460' : '#EDE9FE';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul'];

  // Monthly attendance line
  const ctx1 = document.getElementById('monthlyChart');
  if (ctx1) {
    charts.monthly = new Chart(ctx1, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label:'Attendance %',
          data: [72,75,68,80,78,82,78],
          borderColor:'#7C3AED', backgroundColor:'rgba(124,58,237,0.12)',
          borderWidth:2.5, pointBackgroundColor:'#7C3AED', pointRadius:4, fill:true, tension:0.4
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false} },
        scales:{
          x:{grid:{display:false}, ticks:{color:textColor}},
          y:{grid:{color:gridColor}, ticks:{color:textColor}, min:50, max:100}
        }
      }
    });
  }

  // Theme pie
  const ctx2 = document.getElementById('themeChart');
  if (ctx2) {
    charts.theme = new Chart(ctx2, {
      type:'pie',
      data:{
        labels:['Deep Violet','Emerald Pro','Ocean Teal','Rose & Slate','Warm Amber','Midnight Blue'],
        datasets:[{
          data:[42,20,15,10,8,5],
          backgroundColor:['#7C3AED','#059669','#0891B2','#E11D48','#D97706','#1D4ED8'],
          borderWidth:0, hoverOffset:6
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'right', labels:{ color:textColor, font:{size:11}, boxWidth:12, padding:10 } } }
      }
    });
  }

  // User growth
  const ctx3 = document.getElementById('growthChart');
  if (ctx3) {
    charts.growth = new Chart(ctx3, {
      type:'line',
      data:{
        labels: months,
        datasets:[{
          label:'Users',
          data:[100,340,620,980,1450,2050,2400],
          borderColor:'#059669', backgroundColor:'rgba(5,150,105,0.1)',
          borderWidth:2.5, fill:true, tension:0.4, pointBackgroundColor:'#059669', pointRadius:4
        }]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          x:{grid:{display:false}, ticks:{color:textColor}},
          y:{grid:{color:gridColor}, ticks:{color:textColor, callback:v=>v>=1000?v/1000+'k':v}}
        }
      }
    });
  }

  // Distribution bar
  const ctx4 = document.getElementById('distChart');
  if (ctx4) {
    charts.dist = new Chart(ctx4, {
      type:'bar',
      data:{
        labels: months,
        datasets:[
          {label:'Present', data:[65,68,58,74,72,76,71], backgroundColor:'rgba(0,200,83,0.8)', borderRadius:6, borderSkipped:false},
          {label:'Half',    data:[10,8,12,7,8,6,9],       backgroundColor:'rgba(255,179,0,0.8)', borderRadius:6, borderSkipped:false},
          {label:'Absent',  data:[25,24,30,19,20,18,20],  backgroundColor:'rgba(229,57,53,0.7)', borderRadius:6, borderSkipped:false},
        ]
      },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{labels:{color:textColor, font:{size:11}, boxWidth:10}}},
        scales:{
          x:{stacked:true, grid:{display:false}, ticks:{color:textColor}},
          y:{stacked:true, grid:{color:gridColor}, ticks:{color:textColor, callback:v=>v+'%'}, max:100}
        }
      }
    });
  }
}

// ═══════════════════════════════════════════════════════════════
//  USERS
// ═══════════════════════════════════════════════════════════════
function renderUsers() {
  return `
  <div class="space-y-4">
    <!-- Toolbar -->
    <div class="flex flex-wrap gap-3 items-center justify-between">
      <div class="flex gap-3 flex-1 min-w-0">
        <input id="userSearch" type="text" placeholder="Search by name, email, or ID…" class="input-field flex-1 max-w-sm py-2.5"
          oninput="filterUsers()" />
        <select id="statusFilter" onchange="filterUsers()" class="py-2.5">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      <button class="btn-primary py-2.5 px-5" onclick="showAddUser()">+ Add User</button>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="table-wrap">
        <table id="usersTable">
          <thead>
            <tr>
              <th>User</th>
              <th>Unique ID</th>
              <th>Monthly Salary</th>
              <th>Working Days</th>
              <th>Streak</th>
              <th>Status</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="usersTbody">
            ${usersRows(MOCK_USERS)}
          </tbody>
        </table>
      </div>
      <div class="px-6 py-4 border-t border-divider flex items-center justify-between">
        <span class="text-sm text-secondary" id="userCount">${MOCK_USERS.length} users</span>
        <div class="flex gap-2">
          <button class="btn-ghost py-1.5 px-4 text-sm">← Prev</button>
          <button class="btn-primary py-1.5 px-4 text-sm">Next →</button>
        </div>
      </div>
    </div>
  </div>`;
}

function usersRows(users) {
  return users.map(u => `
  <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer">
    <td>
      <div class="flex items-center gap-3">
        ${avatar(u.name)}
        <div>
          <div class="font-semibold text-primary text-sm">${u.name}</div>
          <div class="text-secondary text-xs">${u.email}</div>
        </div>
      </div>
    </td>
    <td><code class="text-violet font-mono text-sm bg-soft-surface px-2 py-0.5 rounded-lg">#${u.uniqueId}</code></td>
    <td class="font-semibold">${fmtINR(u.monthlySalary)}</td>
    <td>${u.workingDays} days</td>
    <td><span class="font-bold ${u.streak>20?'text-violet':u.streak>10?'text-yellow-500':'text-secondary'}">${u.streak}🔥</span></td>
    <td><span class="badge ${u.status==='active'?'badge-active':'badge-inactive'}">${u.status}</span></td>
    <td class="text-secondary text-sm">${u.lastSeen}</td>
    <td onclick="event.stopPropagation()">
      <div class="flex gap-2">
        <button onclick="showUserDetail('${u.id}')" class="btn-outline py-1 px-3 text-xs">View</button>
        <button onclick="toggleUserStatus('${u.id}')" class="btn-ghost py-1 px-3 text-xs">${u.status==='active'?'Disable':'Enable'}</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  const s = document.getElementById('statusFilter').value;
  let filtered = MOCK_USERS.filter(u =>
    (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.uniqueId.includes(q)) &&
    (!s || u.status === s)
  );
  document.getElementById('usersTbody').innerHTML = usersRows(filtered);
  document.getElementById('userCount').textContent = `${filtered.length} users`;
}

function initUserFilters() { /* wired inline */ }

function toggleUserStatus(id) {
  const u = MOCK_USERS.find(u=>u.id===id);
  if (u) { u.status = u.status==='active'?'inactive':'active'; filterUsers(); }
}

function showUserDetail(id) {
  const u = MOCK_USERS.find(u=>u.id===id);
  if (!u) return;
  const att = MOCK_ATTENDANCE[id] || [];
  const present = att.filter(r=>r.status==='PRESENT').length;
  const half    = att.filter(r=>r.status==='HALF').length;
  const absent  = att.filter(r=>r.status==='ABSENT').length;
  const total   = att.length;
  const pct     = total ? Math.round(((present+half*0.5)/total)*100) : 0;
  const estSal  = total ? Math.round((u.monthlySalary/u.workingDays)*(present+half*0.5)) : 0;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'userModal';
  modal.innerHTML = `
  <div class="modal max-w-lg">
    <div class="flex items-start justify-between mb-5">
      <div class="flex items-center gap-4">
        ${avatar(u.name)}
        <div>
          <h2 class="text-xl font-bold text-primary">${u.name}</h2>
          <p class="text-secondary text-sm">${u.email}</p>
        </div>
      </div>
      <button onclick="document.getElementById('userModal').remove()" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-5">
      ${miniStat('Unique ID','#'+u.uniqueId,'text-violet font-mono')}
      ${miniStat('Status', u.status==='active'?'Active':'Inactive', u.status==='active'?'text-green-500':'text-red-400')}
      ${miniStat('Monthly Salary', fmtINR(u.monthlySalary))}
      ${miniStat('Working Days', u.workingDays+' days')}
      ${miniStat('Current Streak', u.streak+' days 🔥')}
      ${miniStat('Joined', u.joinDate)}
    </div>

    <div class="bg-soft-surface rounded-2xl p-4 mb-5">
      <h4 class="font-semibold text-primary mb-3">Attendance Summary (Jul 2025)</h4>
      <div class="grid grid-cols-4 gap-3 text-center">
        <div><div class="text-xl font-bold text-violet">${pct}%</div><div class="text-xs text-secondary">Rate</div></div>
        <div><div class="text-xl font-bold text-green-500">${present}</div><div class="text-xs text-secondary">Present</div></div>
        <div><div class="text-xl font-bold text-yellow-500">${half}</div><div class="text-xs text-secondary">Half</div></div>
        <div><div class="text-xl font-bold text-red-400">${absent}</div><div class="text-xs text-secondary">Absent</div></div>
      </div>
      <div class="progress-track mt-3">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="mt-3 flex items-center justify-between">
        <span class="text-sm text-secondary">Estimated Salary</span>
        <span class="font-bold text-primary">${fmtINR(estSal)}</span>
      </div>
    </div>

    <div class="flex gap-3">
      <button onclick="navigate('attendance')" class="btn-outline flex-1">View Attendance</button>
      <button onclick="document.getElementById('userModal').remove()" class="btn-ghost flex-1">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function miniStat(label, value, cls='') {
  return `<div class="bg-soft-surface rounded-xl p-3">
    <div class="text-xs text-secondary mb-0.5">${label}</div>
    <div class="font-semibold text-primary text-sm ${cls}">${value}</div>
  </div>`;
}

function showAddUser() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'addModal';
  modal.innerHTML = `
  <div class="modal">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-xl font-bold text-primary">Add New User</h2>
      <button onclick="document.getElementById('addModal').remove()" class="text-secondary hover:text-primary text-2xl">&times;</button>
    </div>
    <div class="space-y-3 mb-5">
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Full Name</label><input type="text" class="input-field" placeholder="Enter full name" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Email</label><input type="email" class="input-field" placeholder="user@example.com" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Monthly Salary (₹)</label><input type="number" class="input-field" placeholder="35000" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Working Days</label><input type="number" class="input-field" value="26" /></div>
    </div>
    <div class="flex gap-3">
      <button class="btn-primary flex-1" onclick="document.getElementById('addModal').remove();showToast('User added successfully!')">Add User</button>
      <button onclick="document.getElementById('addModal').remove()" class="btn-ghost flex-1">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

// ═══════════════════════════════════════════════════════════════
//  ATTENDANCE
// ═══════════════════════════════════════════════════════════════
function renderAttendance() {
  const allRecords = [];
  MOCK_USERS.slice(0,6).forEach(u => {
    const recs = MOCK_ATTENDANCE[u.id] || generateAttendance(u.id, 2025, 7);
    recs.forEach(r => allRecords.push({ ...r, userName: u.name, userId: u.id }));
  });
  allRecords.sort((a,b) => b.date.localeCompare(a.date));

  return `
  <div class="space-y-4">
    <div class="flex flex-wrap gap-3 items-center">
      <input id="attSearch" type="text" placeholder="Search user…" class="input-field max-w-xs py-2.5" oninput="filterAtt()" />
      <select id="attStatus" onchange="filterAtt()" class="py-2.5">
        <option value="">All Status</option>
        <option value="PRESENT">Present</option>
        <option value="HALF">Half Day</option>
        <option value="ABSENT">Absent</option>
      </select>
      <select id="attMonth" onchange="filterAtt()" class="py-2.5">
        <option value="07">July 2025</option>
        <option value="06">June 2025</option>
        <option value="05">May 2025</option>
      </select>
      <button onclick="exportCSV()" class="btn-outline py-2.5 px-4">Export CSV</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Date</th>
              <th>Status</th>
              <th>Worked Hours</th>
              <th>Overtime</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="attTbody">
            ${attRows(allRecords)}
          </tbody>
        </table>
      </div>
      <div class="px-6 py-4 border-t border-divider">
        <span class="text-sm text-secondary" id="attCount">Showing ${Math.min(allRecords.length,50)} records</span>
      </div>
    </div>
  </div>`;
}

function attRows(records) {
  return records.slice(0,50).map(r => `
  <tr>
    <td>
      <div class="flex items-center gap-2">
        ${avatar(r.userName,'sm')}
        <span class="text-sm font-medium text-primary">${r.userName}</span>
      </div>
    </td>
    <td class="text-secondary">${formatDate(r.date)}</td>
    <td>${statusBadge(r.status)}</td>
    <td>${r.workedHours > 0 ? r.workedHours+'h' : '—'}</td>
    <td>${r.overtimeHours > 0 ? `<span class="badge badge-overtime">+${r.overtimeHours}h</span>` : '—'}</td>
    <td>
      <button onclick="editAttendance('${r.userId}','${r.date}')" class="btn-ghost py-1 px-3 text-xs">Edit</button>
    </td>
  </tr>`).join('');
}

function filterAtt() {
  const q = document.getElementById('attSearch').value.toLowerCase();
  const s = document.getElementById('attStatus').value;
  const allRecords = [];
  MOCK_USERS.slice(0,6).forEach(u => {
    const recs = MOCK_ATTENDANCE[u.id] || [];
    recs.forEach(r => allRecords.push({ ...r, userName: u.name, userId: u.id }));
  });
  const filtered = allRecords.filter(r =>
    (!q || r.userName.toLowerCase().includes(q)) &&
    (!s || r.status === s)
  ).sort((a,b) => b.date.localeCompare(a.date));
  document.getElementById('attTbody').innerHTML = attRows(filtered);
  document.getElementById('attCount').textContent = `Showing ${Math.min(filtered.length,50)} records`;
}

function initAttendanceFilters() {}

function editAttendance(uid, date) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'editAttModal';
  modal.innerHTML = `
  <div class="modal max-w-sm">
    <div class="flex items-center justify-between mb-5">
      <h2 class="text-lg font-bold text-primary">Edit Attendance</h2>
      <button onclick="document.getElementById('editAttModal').remove()" class="text-secondary hover:text-primary text-2xl">&times;</button>
    </div>
    <p class="text-secondary text-sm mb-4">${formatDate(date)}</p>
    <div class="space-y-3 mb-5">
      <div class="flex gap-2">
        <button onclick="selectStatus(this,'PRESENT')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 border-green-400 text-green-500 hover:bg-green-50 transition-colors">✓ Present</button>
        <button onclick="selectStatus(this,'HALF')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 border-yellow-400 text-yellow-500 hover:bg-yellow-50 transition-colors">◐ Half Day</button>
        <button onclick="selectStatus(this,'ABSENT')" class="flex-1 py-2.5 rounded-xl font-semibold text-sm border-2 border-red-400 text-red-400 hover:bg-red-50 transition-colors">✕ Absent</button>
      </div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Worked Hours</label><input type="number" class="input-field" value="8" step="0.5" /></div>
      <div><label class="text-sm font-medium text-secondary block mb-1.5">Overtime Hours</label><input type="number" class="input-field" value="0" step="0.5" /></div>
    </div>
    <div class="flex gap-3">
      <button class="btn-primary flex-1" onclick="document.getElementById('editAttModal').remove();showToast('Attendance updated!')">Save</button>
      <button onclick="document.getElementById('editAttModal').remove()" class="btn-ghost flex-1">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if(e.target===modal) modal.remove(); });
}

function selectStatus(btn, status) {
  btn.closest('.flex').querySelectorAll('button').forEach(b => {
    b.classList.remove('bg-green-500','bg-yellow-400','bg-red-400','text-white','border-transparent');
  });
  const map = { PRESENT:'bg-green-500', HALF:'bg-yellow-400', ABSENT:'bg-red-400' };
  btn.classList.add(map[status], 'text-white', 'border-transparent');
}

function exportCSV() {
  showToast('CSV exported successfully!');
}

function formatDate(d) {
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
}

// ═══════════════════════════════════════════════════════════════
//  SALARY REPORTS
// ═══════════════════════════════════════════════════════════════
function renderSalary() {
  const summaries = getSummaryByUser();
  return `
  <div class="space-y-4">
    <!-- Summary cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${statCard('Total Payroll', fmtINR(summaries.reduce((s,u)=>s+u.monthlySalary,0)), 'linear-gradient(135deg,#7C3AED,#A855F7)', icons.rupee, 'Monthly basis')}
      ${statCard('Estimated Payout', fmtINR(summaries.reduce((s,u)=>s+u.estimatedSalary,0)), 'linear-gradient(135deg,#059669,#34D399)', icons.check, 'Based on attendance')}
      ${statCard('Deductions', fmtINR(summaries.reduce((s,u)=>s+(u.monthlySalary-u.estimatedSalary),0)), 'linear-gradient(135deg,#E53935,#EF5350)', icons.rupee, 'Absence deductions')}
    </div>

    <div class="card">
      <div class="p-6 border-b border-divider flex items-center justify-between">
        <h3 class="font-bold text-primary">Salary Breakdown</h3>
        <div class="flex gap-2">
          <select class="py-2 text-sm">
            <option>July 2025</option><option>June 2025</option>
          </select>
          <button onclick="showToast('PDF exported!')" class="btn-outline py-2 px-4 text-sm">Export PDF</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Monthly Salary</th>
              <th>Present</th>
              <th>Half Day</th>
              <th>Absent</th>
              <th>Attendance %</th>
              <th>Estimated Payout</th>
              <th>Deduction</th>
            </tr>
          </thead>
          <tbody>
            ${summaries.map(u => `
            <tr>
              <td>
                <div class="flex items-center gap-3">
                  ${avatar(u.name)}
                  <div>
                    <div class="font-semibold text-primary text-sm">${u.name}</div>
                    <div class="text-xs text-secondary">#${u.uniqueId}</div>
                  </div>
                </div>
              </td>
              <td class="font-semibold">${fmtINR(u.monthlySalary)}</td>
              <td><span class="badge badge-present">${u.present}</span></td>
              <td><span class="badge badge-half">${u.half}</span></td>
              <td><span class="badge badge-absent">${u.absent}</span></td>
              <td>
                <div class="flex items-center gap-2">
                  <div class="progress-track w-16">
                    <div class="progress-fill" style="width:${u.pct}%"></div>
                  </div>
                  <span class="text-sm font-semibold ${u.pct>=75?'text-green-500':u.pct>=50?'text-yellow-500':'text-red-400'}">${u.pct}%</span>
                </div>
              </td>
              <td class="font-bold text-primary">${fmtINR(u.estimatedSalary)}</td>
              <td class="text-red-400 font-semibold">-${fmtINR(u.monthlySalary - u.estimatedSalary)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function renderNotifications() {
  const typeIcon = {
    user:'👤', alert:'⚠️', backup:'💾', payment:'💳', system:'⚙️'
  };
  return `
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div class="flex gap-2">
        <button class="tab-btn active" onclick="filterNotifs(this,'all')">All</button>
        <button class="tab-btn" onclick="filterNotifs(this,'unread')">Unread (${MOCK_NOTIFICATIONS.filter(n=>n.unread).length})</button>
        <button class="tab-btn" onclick="filterNotifs(this,'alert')">Alerts</button>
      </div>
      <button onclick="showToast('All marked as read!')" class="btn-ghost py-2 px-4 text-sm">Mark all read</button>
    </div>

    <div class="card p-4 space-y-1" id="notifList">
      ${MOCK_NOTIFICATIONS.map(n => `
      <div class="notif-item ${n.unread?'unread':''}">
        <div class="icon-box bg-soft-surface text-xl">${typeIcon[n.type]||'🔔'}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="font-semibold text-primary text-sm">${n.title}</div>
            <span class="text-xs text-secondary whitespace-nowrap">${n.time}</span>
          </div>
          <div class="text-secondary text-sm mt-0.5">${n.body}</div>
        </div>
        ${n.unread ? '<div class="w-2 h-2 rounded-full bg-violet shrink-0 mt-1.5"></div>' : ''}
      </div>`).join('')}
    </div>

    <!-- Send Notification -->
    <div class="card p-6">
      <h3 class="font-bold text-primary mb-4">Send Push Notification</h3>
      <div class="space-y-3">
        <div>
          <label class="text-sm font-medium text-secondary block mb-1.5">Target</label>
          <select class="w-full py-2.5"><option>All Users</option><option>Active Users</option><option>Inactive Users</option></select>
        </div>
        <div><label class="text-sm font-medium text-secondary block mb-1.5">Title</label><input type="text" class="input-field" placeholder="Notification title" /></div>
        <div><label class="text-sm font-medium text-secondary block mb-1.5">Message</label><textarea class="input-field" rows="3" placeholder="Enter notification message…" style="resize:vertical"></textarea></div>
        <button class="btn-primary py-3 px-6" onclick="showToast('Notification sent to all users!')">Send Notification</button>
      </div>
    </div>
  </div>`;
}

function filterNotifs(btn, filter) {
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
function renderSettings() {
  return `
  <div class="max-w-2xl space-y-4">
    ${settingsCard('General', [
      settingsRow('App Name', 'text', APP_SETTINGS.general.appName),
      settingsRow('Support Email', 'text', APP_SETTINGS.general.supportEmail),
      settingsRow('App Version', 'text', APP_SETTINGS.general.appVersion, true),
      settingsToggleRow('Maintenance Mode', 'maintenanceMode', APP_SETTINGS.general.maintenanceMode),
    ])}
    ${settingsCard('Advertisements', [
      settingsToggleRow('Banner Ads', 'bannerAds', APP_SETTINGS.ads.bannerAdsEnabled),
      settingsToggleRow('Interstitial Ads', 'interstitialAds', APP_SETTINGS.ads.interstitialAdsEnabled),
      settingsToggleRow('Rewarded Ads', 'rewardedAds', APP_SETTINGS.ads.rewardedAdsEnabled),
      settingsToggleRow('App Open Ads', 'appOpenAds', APP_SETTINGS.ads.appOpenAdsEnabled),
    ])}
    ${settingsCard('Features', [
      settingsToggleRow('Biometric Login', 'biometric', APP_SETTINGS.features.biometricLoginEnabled),
      settingsToggleRow('Daily Reminder', 'dailyReminder', APP_SETTINGS.features.dailyReminderEnabled),
      settingsToggleRow('Cloud Backup', 'backup', APP_SETTINGS.features.backupEnabled),
      settingsToggleRow('Referral Program', 'referral', APP_SETTINGS.features.referralProgramEnabled),
      settingsToggleRow('Daily Spin', 'dailySpin', APP_SETTINGS.features.dailySpinEnabled),
      settingsToggleRow('Premium Features', 'premium', APP_SETTINGS.features.premiumFeaturesEnabled),
    ])}
    ${settingsCard('Coin Rewards', [
      settingsRow('Daily Login Coins', 'number', APP_SETTINGS.coins.dailyLoginCoins),
      settingsRow('Streak Bonus Coins', 'number', APP_SETTINGS.coins.streakBonusCoins),
      settingsRow('Referral Coins', 'number', APP_SETTINGS.coins.referralCoins),
      settingsRow('Spin Max Coins', 'number', APP_SETTINGS.coins.spinMaxCoins),
    ])}

    <button class="btn-primary py-3 px-8" onclick="showToast('Settings saved successfully!')">Save Changes</button>
  </div>`;
}

function settingsCard(title, rows) {
  return `<div class="card p-6">
    <h3 class="font-bold text-primary text-lg mb-4">${title}</h3>
    <div>${rows.join('')}</div>
  </div>`;
}

function settingsRow(label, type, value, readonly=false) {
  return `<div class="settings-row">
    <label class="font-medium text-primary text-sm">${label}</label>
    <input type="${type}" value="${value}" ${readonly?'readonly':''} class="input-field w-48 py-2 text-sm ${readonly?'opacity-60 cursor-not-allowed':''}" />
  </div>`;
}

function settingsToggleRow(label, id, enabled) {
  return `<div class="settings-row">
    <label class="font-medium text-primary text-sm">${label}</label>
    <div class="toggle ${enabled?'on':''}" id="toggle_${id}" onclick="flipToggle('${id}')"></div>
  </div>`;
}

function initToggles() { /* rendered inline */ }

function flipToggle(id) {
  const el = document.getElementById('toggle_'+id);
  el.classList.toggle('on');
}

// ═══════════════════════════════════════════════════════════════
//  ICONS (SVG strings)
// ═══════════════════════════════════════════════════════════════
const icons = {
  users: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  check: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  calendar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  rupee: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
};

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════
function showToast(msg, type='success') {
  const el = document.createElement('div');
  const colors = type==='success' ? 'bg-violet text-white' : 'bg-red-500 text-white';
  el.className = `fixed bottom-6 right-6 z-50 ${colors} px-6 py-3.5 rounded-2xl shadow-lg font-medium text-sm flex items-center gap-2`;
  el.style.animation = 'fadeIn 0.3s ease';
  el.innerHTML = (type==='success'?'✓ ':'')+msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(()=>el.remove(),300); }, 3000);
}

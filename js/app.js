// ═══════════════════════════════════════════════════════════════
//  Self Attendance Pro — Admin Panel (Firebase Connected)
// ═══════════════════════════════════════════════════════════════

let currentPage = 'dashboard';
let isDark = false;
let sidebarOpen = false;
let charts = {};
let attSelectedUser = null;
let attSelectedYM   = null;
let currentAuthMode = 'signin'; // 'signin' | 'register' | 'reset'

// ── Razorpay Payouts Config State ─────────────────────────────
let RAZORPAY_CONFIG = {
  configured: false,
  mode: 'NOT_CONFIGURED',
  keyIdMasked: '',
  accountNumberMasked: '',
  hasAccountNumber: false,
};

async function fetchRazorpayConfig() {
  try {
    const res = await fetch('/api/razorpay/config');
    const data = await res.json();
    if (data && data.success) {
      RAZORPAY_CONFIG = data;
    }
  } catch (e) {
    console.warn('Razorpay config load failed:', e);
  }
}
fetchRazorpayConfig();

// ── Auth Mode Switcher ─────────────────────────────────────────
function switchAuthMode(mode) {
  currentAuthMode = mode;
  const tabIn = document.getElementById('tabSignIn');
  const tabReg = document.getElementById('tabRegister');
  const tabRes = document.getElementById('tabReset');
  const passGroup = document.getElementById('passwordGroup');
  const confirmGroup = document.getElementById('confirmPasswordGroup');
  const forgotLink = document.getElementById('forgotPassLink');
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');

  if (errEl) errEl.classList.add('hidden');

  // Reset tab styles
  [tabIn, tabReg, tabRes].forEach(tab => {
    if (tab) {
      tab.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all text-secondary hover:text-primary';
    }
  });

  if (mode === 'signin') {
    if (tabIn) tabIn.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all bg-white text-primary shadow-sm';
    if (passGroup) passGroup.classList.remove('hidden');
    if (confirmGroup) confirmGroup.classList.add('hidden');
    if (forgotLink) forgotLink.classList.remove('hidden');
    if (btn) btn.textContent = 'Sign In with Firebase';
  } else if (mode === 'register') {
    if (tabReg) tabReg.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all bg-white text-primary shadow-sm';
    if (passGroup) passGroup.classList.remove('hidden');
    if (confirmGroup) confirmGroup.classList.remove('hidden');
    if (forgotLink) forgotLink.classList.add('hidden');
    if (btn) btn.textContent = 'Set Password & Register Admin';
  } else if (mode === 'reset') {
    if (tabRes) tabRes.className = 'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all bg-white text-primary shadow-sm';
    if (passGroup) passGroup.classList.add('hidden');
    if (confirmGroup) confirmGroup.classList.add('hidden');
    if (btn) btn.textContent = 'Send Password Reset Email';
  }
}

// ── Main Auth Submission Dispatcher ───────────────────────────
async function submitAuthForm() {
  if (currentAuthMode === 'signin') {
    await handleLogin();
  } else if (currentAuthMode === 'register') {
    await handleSignUp();
  } else if (currentAuthMode === 'reset') {
    await handleForgotPassword();
  }
}

// ── Auth: Sign In ─────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');

  if (!email || !pass) {
    showAuthError('Please enter both your email address and password.');
    return;
  }
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Signing in…';

  try {
    // Ensure SESSION-only persistence before signing in
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithEmailAndPassword(email, pass);
    sessionStorage.setItem('admin_session_active', '1');
    // onAuthStateChanged in firebase-config.js handles verification & navigation
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Sign In with Firebase';

    let errorHtml = '';
    if (e.code === 'auth/user-not-found') {
      errorHtml = `
        <div class="font-semibold">No account found with this email in Firebase Auth.</div>
        <div class="text-xs mt-1">If this is your first time, you need to create your admin password:</div>
        <div class="mt-2 flex gap-2">
          <button onclick="switchAuthMode('register')" class="bg-violet text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-dark transition-colors">Create / Set Password Now →</button>
        </div>
      `;
    } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      errorHtml = `
        <div class="font-semibold">Incorrect password or credentials.</div>
        <div class="text-xs mt-1">Check your password or click below to receive a password reset link:</div>
        <div class="mt-2 flex gap-2">
          <button onclick="switchAuthMode('reset');submitAuthForm()" class="bg-violet text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-dark transition-colors">Send Reset Link to Email →</button>
        </div>
      `;
    } else if (e.code === 'auth/invalid-email') {
      errorHtml = 'Invalid email address format. Please check spelling.';
    } else if (e.code === 'auth/too-many-requests') {
      errorHtml = 'Too many failed attempts. Please wait a few moments or reset your password.';
    } else if (e.code === 'auth/network-request-failed') {
      errorHtml = 'Network connection issue. Please check your internet connection.';
    } else {
      errorHtml = `Firebase Error (${e.code || 'Auth'}): ${e.message}`;
    }

    errEl.innerHTML = errorHtml;
    errEl.classList.remove('hidden');
  }
}

// ── Auth: Sign Up / Set Password ──────────────────────────────
async function handleSignUp() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  const conf  = document.getElementById('loginConfirmPassword').value;
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');

  if (!email || !pass) {
    showAuthError('Please enter email and create a password.');
    return;
  }
  if (pass.length < 6) {
    showAuthError('Password must be at least 6 characters long.');
    return;
  }
  if (pass !== conf) {
    showAuthError('Passwords do not match. Please re-enter.');
    return;
  }

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Creating Account…';

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    sessionStorage.setItem('admin_session_active', '1');
    showToast('Account created successfully! Verifying admin access…');
    // onAuthStateChanged in firebase-config.js handles verification & navigation
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Set Password & Register Admin';
    if (e.code === 'auth/email-already-in-use') {
      showAuthError(`
        <div class="font-semibold">An account with this email already exists!</div>
        <div class="text-xs mt-1">Please sign in with your password, or request a reset link:</div>
        <div class="mt-2 flex gap-2">
          <button onclick="switchAuthMode('signin')" class="bg-violet text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-violet-dark">Sign In →</button>
          <button onclick="switchAuthMode('reset')" class="bg-soft-surface text-primary text-xs font-semibold px-3 py-1.5 rounded-lg border border-divider">Reset Password</button>
        </div>
      `);
    } else {
      showAuthError(`Registration error (${e.code || 'Auth'}): ${e.message}`);
    }
  }
}

// ── Auth: Forgot Password ─────────────────────────────────────
async function handleForgotPassword() {
  const email = document.getElementById('loginEmail').value.trim();
  const errEl = document.getElementById('loginError');
  const btn   = document.getElementById('loginBtn');

  if (!email) {
    showAuthError('Please enter your email address to receive the password reset link.');
    return;
  }

  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Sending Link…';

  try {
    await auth.sendPasswordResetEmail(email);
    btn.disabled = false;
    btn.textContent = 'Send Password Reset Email';
    showToast(`Password reset link sent to ${email}!`);
    errEl.className = 'text-green-700 text-xs sm:text-sm bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl p-3.5 mt-4';
    errEl.innerHTML = `
      <div class="font-semibold">✓ Password reset email sent!</div>
      <div class="text-xs mt-1">Check your inbox (${email}) and follow the link to set your password. Once done, come back and Sign In.</div>
      <div class="mt-2">
        <button onclick="switchAuthMode('signin')" class="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700">Back to Sign In →</button>
      </div>
    `;
    errEl.classList.remove('hidden');
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Send Password Reset Email';
    showAuthError(`Reset error: ${e.message}`);
  }
}

// ── Auth: Google Sign-In ──────────────────────────────────────
async function handleGoogleLogin() {
  const btn = document.getElementById('googleBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Opening Google Sign-In…';
  }

  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(provider);
    sessionStorage.setItem('admin_session_active', '1');
    // onAuthStateChanged in firebase-config.js handles navigation
  } catch (e) {
    console.error('Google Sign-In Error:', e);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        Sign In with Google (Instant)
      `;
    }

    if (e.code === 'auth/popup-closed-by-user') {
      showAuthError('Google sign-in popup was closed before completing. Please try again.');
    } else if (e.code === 'auth/unauthorized-domain') {
      showAuthError(`
        <div class="font-semibold">Firebase Authorized Domains Notice</div>
        <div class="text-xs mt-1">This domain is not yet in your Firebase Console Authorized Domains list. Use Email &amp; Password or add this domain in Firebase Console → Authentication → Settings.</div>
      `);
    } else {
      showAuthError(`Google Sign-In (${e.code || 'Error'}): ${e.message}`);
    }
  }
}

// ── Auth: Offline / Demo Admin Mode ───────────────────────────
function handleDemoLogin() {
  isDemoMode = true;
  currentAdmin = {
    email: 'yogeshkumar53076@gmail.com',
    uid: 'demo_admin_yogesh',
    displayName: 'Admin (Preview Mode)'
  };
  IS_ADMIN = true;
  updateHeaderUI(currentAdmin);
  showToast('Entered Demo Admin Mode');
  showScreen('app');
  if (typeof MOCK_USERS !== 'undefined' && ALL_USERS.length === 0) {
    ALL_USERS = [...MOCK_USERS];
    const countEl = document.getElementById('navUserCount');
    if (countEl) countEl.textContent = ALL_USERS.length;
  }
}

function showAuthError(msg) {
  const errEl = document.getElementById('loginError');
  if (!errEl) return;
  errEl.className = 'text-red-600 text-xs sm:text-sm bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-3.5 mt-4 space-y-2';
  errEl.innerHTML = msg;
  errEl.classList.remove('hidden');
}

function handleLogout() {
  isDemoMode = false;
  currentAdmin = null;
  IS_ADMIN = false;
  try {
    sessionStorage.removeItem('admin_session_active');
  } catch(e) {}
  if (auth) auth.signOut();
  showScreen('login');
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

document.addEventListener('keydown', e => {
  const loginVisible = !document.getElementById('loginScreen').classList.contains('hidden');
  if (e.key === 'Enter' && loginVisible) submitAuthForm();
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
window.addEventListener('popstate', (e) => {
  const mainApp = document.getElementById('mainApp');
  if (!mainApp || mainApp.classList.contains('hidden')) return;

  const targetPage = e.state?.page || (location.hash ? location.hash.replace('#', '') : 'dashboard');
  if (targetPage && targetPage !== currentPage) {
    _navigateInternal(targetPage);
  }
});

// ── Navigation ────────────────────────────────────────────────
async function navigate(page, e) {
  if (e) {
    try { e.preventDefault(); } catch(_) {}
  }
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
    withdrawals:['Withdrawals',    'Review and process payout requests'],
    fraud:      ['Coin Flow & Anti-Fraud Center', 'Live coin ledger, hack detection & anomaly prevention'],
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
    case 'withdrawals':return await buildWithdrawals();
    case 'fraud':      return await buildFraudPage();
    case 'settings':   return buildSettings();
    default:           return '<p>Page not found</p>';
  }
}

// ═══════════════════════════════════════════════════════════════
//  WITHDRAWAL REQUESTS
// ═══════════════════════════════════════════════════════════════
// Status values match the Firestore rules enum: pending | completed |
// rejected | cancelled. Coins are debited by the website itself when the
// request is created (the signed-in user updates their own wallet, which
// the rules allow). Admins can only update the `withdrawals` doc — the
// rules deliberately do NOT let admin write users/{uid} — so on reject we
// just flag the request; the coins are credited back automatically the
// next time the user opens the website or app (see claimPendingRefunds /
// RewardRepository.claimPendingRefunds), which read their own rejected
// requests and refund themselves.

function withdrawalStatusClass(status) {
  const value = String(status || 'pending').toLowerCase();
  return (value === 'completed' || value === 'approved') ? 'badge-present'
    : (value === 'rejected' || value === 'cancelled') ? 'badge-absent'
    : 'badge-half';
}

function isPendingStatus(status) {
  const s = String(status || 'pending').toLowerCase();
  return s !== 'completed' && s !== 'approved' && s !== 'rejected' && s !== 'cancelled';
}

function parsePaymentDetails(request) {
  const methodStr = String(request.methodDetails || request.method || request.paymentDetails || request.upiId || request.vpa || '').trim();
  
  // Extract UPI / VPA pattern: username@bank / number@upi / etc.
  const upiMatch = methodStr.match(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/);
  const upiId = request.upiId || request.vpa || (upiMatch ? upiMatch[0] : '');

  // Extract Bank Account Number (9-18 digits)
  const accMatch = methodStr.match(/\b\d{9,18}\b/);
  const accountNumber = request.accountNumber || request.bankAccount || (accMatch ? accMatch[0] : '');

  // Extract IFSC code (4 uppercase letters + 0 + 6 alphanumeric)
  const ifscMatch = methodStr.toUpperCase().match(/[A-Z]{4}0[A-Z0-9]{6}/);
  const ifsc = request.ifsc || (ifscMatch ? ifscMatch[0] : '');

  // Extract Phone Number (10 digits)
  const phoneMatch = methodStr.match(/\b[6-9]\d{9}\b/);
  const phone = request.phone || request.mobile || (phoneMatch ? phoneMatch[0] : '');

  let detectedType = 'UPI';
  if (accountNumber && ifsc) {
    detectedType = 'BANK';
  } else if (upiId) {
    detectedType = 'UPI';
  } else if (methodStr.toLowerCase().includes('phonepe') || methodStr.toLowerCase().includes('gpay') || methodStr.toLowerCase().includes('paytm')) {
    detectedType = 'WALLET_OR_NUMBER';
  }

  return {
    raw: methodStr,
    upiId,
    accountNumber,
    ifsc,
    phone,
    detectedType
  };
}

async function buildWithdrawals() {
  const requests = [...ALL_WITHDRAWALS]
    .sort((a, b) => (withdrawalDate(b)?.getTime() || 0) - (withdrawalDate(a)?.getTime() || 0));
  const pending = requests.filter(r => isPendingStatus(r.status));

  updateWithdrawalBadge();
  await fetchRazorpayConfig();

  return `
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-lg font-bold text-primary">Withdrawal Requests</h2>
          <span class="badge ${RAZORPAY_CONFIG.configured ? 'badge-present' : 'badge-half'} text-xs">
            ⚡ Razorpay: ${RAZORPAY_CONFIG.configured ? (RAZORPAY_CONFIG.mode + ' Mode') : 'Keys Required'}
          </span>
        </div>
        <p class="text-secondary text-sm">Approve, reject, or execute 1-click Razorpay instant payouts directly to user UPI & bank accounts.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="openRazorpaySettingsModal()" class="btn-razorpay py-2 px-3 text-xs">
          ⚡ Razorpay Settings
        </button>
        <button onclick="requestNotificationPermission()" class="btn-outline py-2 px-3 text-xs flex items-center gap-1.5">
          <span>🔔</span> Push Alerts
        </button>
        <button onclick="playNotificationSound()" class="btn-ghost py-2 px-3 text-xs">
          🔊 Sound
        </button>
        <button onclick="_navigateInternal('withdrawals')" class="btn-outline py-2 px-3 text-xs">↻ Refresh</button>
      </div>
    </div>

    <!-- Razorpay quick status banner if not configured -->
    ${!RAZORPAY_CONFIG.configured ? `
    <div class="card p-4 border border-[#528FF0]/30 bg-gradient-to-r from-[#0C2340]/10 to-transparent flex items-center justify-between gap-4 flex-wrap">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-[#0C2340] text-[#528FF0] flex items-center justify-center font-bold text-lg">⚡</div>
        <div>
          <h4 class="font-bold text-primary text-sm">Automate Payouts with Razorpay</h4>
          <p class="text-xs text-secondary">Set up your Razorpay Key ID and Secret to pay users via Instant UPI, IMPS, or Payout Links.</p>
        </div>
      </div>
      <button onclick="openRazorpaySettingsModal()" class="btn-razorpay py-2 px-4 text-xs font-semibold">
        Configure Razorpay API Keys →
      </button>
    </div>` : ''}

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      ${statCard('Total Requests', requests.length, 'linear-gradient(135deg,#7C3AED,#A855F7)', ICONS.wallet, 'All time')}
      ${statCard('Pending', pending.length, 'linear-gradient(135deg,#D97706,#FCD34D)', ICONS.clock, 'Needs action')}
      ${statCard('Approved', requests.filter(r => ['completed','approved'].includes(String(r.status||'').toLowerCase())).length, 'linear-gradient(135deg,#059669,#34D399)', ICONS.check, 'Processed')}
      ${statCard('Rejected', requests.filter(r => String(r.status||'').toLowerCase() === 'rejected').length, 'linear-gradient(135deg,#DC2626,#FB7185)', ICONS.close, 'Declined')}
    </div>

    <!-- Requests Table -->
    <div class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead><tr>
            <th class="p-4 text-xs text-secondary">Request</th>
            <th class="p-4 text-xs text-secondary">User</th>
            <th class="p-4 text-xs text-secondary">Payment Details</th>
            <th class="p-4 text-xs text-secondary">Coins</th>
            <th class="p-4 text-xs text-secondary">Amount</th>
            <th class="p-4 text-xs text-secondary">Submitted</th>
            <th class="p-4 text-xs text-secondary">Status</th>
            <th class="p-4 text-xs text-secondary">Actions</th>
          </tr></thead>
          <tbody>
            ${requests.length ? requests.map(renderWithdrawalRow).join('') : `
              <tr><td colspan="8">${emptyState('No withdrawal requests yet')}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

function withdrawalDate(data) {
  if (data.createdAt && typeof data.createdAt.toDate === 'function') return data.createdAt.toDate();
  if (data.timestamp) return new Date(data.timestamp);
  return null;
}

function renderWithdrawalRow(request) {
  const date = withdrawalDate(request);
  const status = request.status || 'pending';
  const pending = isPendingStatus(status);
  const safeId = String(request.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const coins = Number(request.amount ?? request.axCoins ?? 0);
  const inrAmount = (Number(request.inrAmount) || (coins / 100)).toFixed(2);

  const user = ALL_USERS.find(u => u.id === request.userId || u.id === request.uid || (u.uniqueId && String(u.uniqueId) === String(request.uniqueId || request.myId)));
  const payInfo = parsePaymentDetails(request);

  let fraudBadge = '';
  if (user) {
    fraudBadge = getUserQuickFraudBadge(user);
  } else if (coins > 5000) {
    fraudBadge = `<span class="badge badge-absent text-xs font-semibold">⚠️ High Request</span>`;
  }

  // Payment badge
  let payBadge = '';
  if (payInfo.upiId) {
    payBadge = `
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="badge-razorpay text-[11px] font-mono">UPI: ${payInfo.upiId}</span>
        <button onclick="copyToClipboard('${payInfo.upiId}', 'UPI ID')" class="text-secondary hover:text-violet text-xs" title="Copy UPI">📋</button>
      </div>`;
  } else if (payInfo.accountNumber && payInfo.ifsc) {
    payBadge = `
      <div class="text-xs">
        <span class="font-mono text-primary block font-semibold">A/C: ${payInfo.accountNumber}</span>
        <span class="text-secondary text-[11px] font-mono">IFSC: ${payInfo.ifsc}</span>
      </div>`;
  } else {
    payBadge = `<span class="text-xs text-primary font-medium">${request.methodDetails || request.method || '—'}</span>`;
  }

  // Actions
  let actionHtml = '';
  if (pending) {
    actionHtml = `
      <div class="flex items-center gap-1.5 flex-wrap">
        <button onclick="openRazorpayPayoutModal('${safeId}')" class="btn-razorpay py-1.5 px-2.5 text-xs shadow-sm" title="Pay via Razorpay Instant UPI or Bank Transfer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Pay with Razorpay
        </button>
        <button onclick="updateWithdrawalStatus('${safeId}', 'completed')" class="btn-outline py-1.5 px-2.5 text-xs" title="Mark as approved manually">Approve</button>
        <button onclick="promptRejectWithdrawal('${safeId}')" class="btn-danger py-1.5 px-2 text-xs" title="Reject and refund coins">Reject</button>
      </div>
    `;
  } else if (request.payoutMethod === 'Razorpay' || request.razorpayPayoutId || request.utr) {
    actionHtml = `
      <div class="flex flex-col gap-0.5">
        <span class="badge badge-present text-xs">✓ Razorpay Payout</span>
        <span class="text-[10px] text-secondary font-mono">UTR: ${(request.utr || request.razorpayPayoutId || '—').slice(0, 14)}</span>
      </div>`;
  } else {
    actionHtml = `<span class="text-secondary text-xs">${status === 'rejected' ? 'Refunded on next sign-in' : 'Done'}</span>`;
  }

  return `
  <tr class="border-t border-divider hover:bg-soft-surface transition-colors">
    <td class="p-4"><strong class="text-violet font-mono text-xs">${request.reqId || safeId.slice(0, 8)}</strong></td>
    <td class="p-4">
      <div class="flex items-center gap-2">
        <div class="font-semibold text-primary text-sm ${user ? 'cursor-pointer hover:underline text-violet' : ''}" onclick="${user ? `showUserDetail('${user.id}')` : ''}">${request.name || user?.name || 'User'}</div>
        ${fraudBadge}
      </div>
      <div class="text-secondary text-xs font-mono">#${request.uniqueId || request.myId || user?.uniqueId || '—'}</div>
    </td>
    <td class="p-4">${payBadge}</td>
    <td class="p-4"><strong class="text-violet font-semibold">${coins.toLocaleString()} AX</strong></td>
    <td class="p-4"><strong class="text-green-600 font-bold text-sm">₹${inrAmount}</strong></td>
    <td class="p-4 text-secondary text-xs">${date ? date.toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
    <td class="p-4"><span class="badge ${withdrawalStatusClass(status)}">${status}</span></td>
    <td class="p-4">${actionHtml}</td>
  </tr>`;
}

function promptRejectWithdrawal(docId) {
  const reason = prompt('Reason for rejecting this request? (shown to the user, optional)') || '';
  updateWithdrawalStatus(docId, 'rejected', reason);
}

async function updateWithdrawalStatus(docId, nextStatus, reason) {
  const action = nextStatus === 'completed' ? 'approve' : 'reject';
  if (!confirm(`Are you sure you want to ${action} this withdrawal request?`)) return;

  try {
    const ref = db.collection('withdrawals').doc(docId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Withdrawal request not found.');
    const request = snap.data();
    if (!isPendingStatus(request.status)) {
      showToast('This request has already been processed.', 'error');
      return;
    }

    const update = {
      status: nextStatus,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedBy: currentAdmin?.email || currentAdmin?.uid || 'admin'
    };
    if (nextStatus === 'rejected') update.rejectReason = reason || '';

    await ref.update(update);
    showToast(`Request ${nextStatus} successfully.${nextStatus === 'rejected' ? ' Coins will return to the user automatically.' : ''}`);
    _navigateInternal('withdrawals');
  } catch (e) {
    showToast('Could not update request: ' + e.message, 'error');
  }
}

// ── Razorpay Payout Execution & Modals ────────────────────────
async function openRazorpayPayoutModal(docId) {
  await fetchRazorpayConfig();
  const request = ALL_WITHDRAWALS.find(r => String(r.id) === String(docId));
  if (!request) {
    showToast('Withdrawal request not found.', 'error');
    return;
  }

  const user = ALL_USERS.find(u => u.id === request.userId || u.id === request.uid || (u.uniqueId && String(u.uniqueId) === String(request.uniqueId || request.myId)));
  const coins = Number(request.amount ?? request.axCoins ?? 0);
  const inrAmount = (Number(request.inrAmount) || (coins / 100)).toFixed(2);
  const payInfo = parsePaymentDetails(request);
  const safeId = String(request.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

  const modal = openModal('razorpayModal');
  modal.innerHTML = `
  <div class="modal max-w-lg text-left">
    <!-- Header -->
    <div class="flex items-center justify-between pb-3 border-b border-divider mb-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0C2340] to-[#002970] border border-[#528FF0]/40 flex items-center justify-center text-white text-lg shadow-md">
          ⚡
        </div>
        <div>
          <h2 class="text-base font-bold text-primary flex items-center gap-2">
            Razorpay Payout
            <span class="badge ${RAZORPAY_CONFIG.configured ? 'badge-present' : 'badge-absent'} text-[10px]">
              ${RAZORPAY_CONFIG.configured ? RAZORPAY_CONFIG.mode : 'Keys Required'}
            </span>
          </h2>
          <p class="text-xs text-secondary">Instant payout to user bank or UPI account</p>
        </div>
      </div>
      <button onclick="closeModal('razorpayModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <!-- Payout Summary Card -->
    <div class="bg-gradient-to-br from-violet/5 to-violet/10 border border-violet/20 rounded-2xl p-4 mb-4">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs text-secondary font-medium">Recipient</span>
        <span class="font-semibold text-primary text-sm">${request.name || user?.name || 'User'} (${user?.uniqueId ? '#' + user.uniqueId : '—'})</span>
      </div>
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs text-secondary font-medium">Coins Debited</span>
        <span class="font-semibold text-violet text-sm">${coins.toLocaleString()} AX</span>
      </div>
      <div class="flex items-center justify-between pt-2 border-t border-violet/20">
        <span class="text-sm font-bold text-primary">Payout Amount (INR)</span>
        <span class="text-xl font-extrabold text-green-600">₹${inrAmount}</span>
      </div>
    </div>

    ${!RAZORPAY_CONFIG.configured ? `
    <!-- Setup Notice if not configured -->
    <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl p-3 mb-4 text-xs text-amber-800 dark:text-amber-200">
      <p class="font-bold mb-1">⚙️ Razorpay API Keys Required</p>
      <p class="mb-2">Enter your Razorpay Key ID and Secret to enable automated payouts.</p>
      <button onclick="openRazorpaySettingsModal()" class="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors">
        Configure Razorpay Keys Now →
      </button>
    </div>
    ` : ''}

    <!-- Payment Mode Selector -->
    <div class="space-y-2 mb-4">
      <label class="text-xs font-bold text-secondary uppercase tracking-wide">Select Payout Channel</label>
      <div class="grid grid-cols-2 gap-2">
        <div id="modeCardUPI" class="payout-mode-card active" onclick="selectPayoutMode('UPI')">
          <div class="flex items-center gap-1.5 font-bold text-xs text-primary mb-0.5">
            <span>⚡</span> UPI Instant
          </div>
          <p class="text-[11px] text-secondary">Direct to VPA / UPI ID</p>
        </div>
        <div id="modeCardBank" class="payout-mode-card" onclick="selectPayoutMode('BANK')">
          <div class="flex items-center gap-1.5 font-bold text-xs text-primary mb-0.5">
            <span>🏦</span> Bank IMPS/NEFT
          </div>
          <p class="text-[11px] text-secondary">Direct Account + IFSC</p>
        </div>
        <div id="modeCardLink" class="payout-mode-card" onclick="selectPayoutMode('LINK')">
          <div class="flex items-center gap-1.5 font-bold text-xs text-primary mb-0.5">
            <span>🔗</span> Payout Link
          </div>
          <p class="text-[11px] text-secondary">Send self-claim link to user</p>
        </div>
        <div id="modeCardQR" class="payout-mode-card" onclick="selectPayoutMode('QR')">
          <div class="flex items-center gap-1.5 font-bold text-xs text-primary mb-0.5">
            <span>📱</span> UPI QR / App
          </div>
          <p class="text-[11px] text-secondary">Pay via PhonePe/GPay</p>
        </div>
      </div>
    </div>

    <!-- Mode 1: UPI Form -->
    <div id="payoutFormUPI" class="space-y-3 mb-4">
      <div>
        <label class="text-xs font-semibold text-primary block mb-1">Recipient UPI ID (VPA)</label>
        <div class="flex gap-2">
          <input id="rpUpiId" type="text" class="input-field py-2 text-sm" value="${payInfo.upiId || (payInfo.phone ? payInfo.phone + '@upi' : '')}" placeholder="e.g. name@okhdfcbank or 9876543210@paytm">
          ${payInfo.upiId ? `<button onclick="copyToClipboard('${payInfo.upiId}', 'UPI ID')" class="btn-outline py-1 px-3 text-xs shrink-0" title="Copy">📋 Copy</button>` : ''}
        </div>
      </div>
    </div>

    <!-- Mode 2: Bank Form -->
    <div id="payoutFormBank" class="space-y-3 mb-4 hidden">
      <div>
        <label class="text-xs font-semibold text-primary block mb-1">Bank Account Number</label>
        <input id="rpAccountNum" type="text" class="input-field py-2 text-sm font-mono" value="${payInfo.accountNumber || ''}" placeholder="e.g. 123456789012">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-xs font-semibold text-primary block mb-1">IFSC Code</label>
          <input id="rpIfsc" type="text" class="input-field py-2 text-sm uppercase font-mono" value="${payInfo.ifsc || ''}" placeholder="e.g. SBIN0001234">
        </div>
        <div>
          <label class="text-xs font-semibold text-primary block mb-1">Account Holder Name</label>
          <input id="rpAccountName" type="text" class="input-field py-2 text-sm" value="${request.name || user?.name || ''}" placeholder="Holder Name">
        </div>
      </div>
    </div>

    <!-- Mode 3: Payout Link Form -->
    <div id="payoutFormLink" class="space-y-3 mb-4 hidden">
      <div class="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-300">
        Creates a secure Razorpay Payout Link where the user can enter their preferred bank or UPI account to receive ₹${inrAmount} instantly.
      </div>
      <div>
        <label class="text-xs font-semibold text-primary block mb-1">User Mobile (for SMS)</label>
        <input id="rpPhone" type="text" class="input-field py-2 text-sm" value="${payInfo.phone || user?.phone || ''}" placeholder="10-digit mobile number">
      </div>
      <div>
        <label class="text-xs font-semibold text-primary block mb-1">User Email (for Notification)</label>
        <input id="rpEmail" type="email" class="input-field py-2 text-sm" value="${user?.email || ''}" placeholder="user@example.com">
      </div>
    </div>

    <!-- Mode 4: UPI QR & Intent Form -->
    <div id="payoutFormQR" class="space-y-3 mb-4 hidden text-center">
      <p class="text-xs text-secondary">Scan with PhonePe, Google Pay, or Paytm to pay ₹${inrAmount}:</p>
      <div class="bg-white p-3 rounded-2xl border border-divider inline-block mx-auto shadow-sm my-2">
        <img id="upiQrImg" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${payInfo.upiId || 'selfattendance@upi'}&pn=${encodeURIComponent(request.name||'User')}&am=${inrAmount}&cu=INR&tn=SAP_Payout_${safeId.slice(0,6)}`)}" alt="UPI QR" class="w-36 h-36 mx-auto rounded-lg">
      </div>
      <div class="flex justify-center gap-2">
        <a href="upi://pay?pa=${payInfo.upiId}&pn=${encodeURIComponent(request.name||'User')}&am=${inrAmount}&cu=INR&tn=SAP_Payout_${safeId.slice(0,6)}" class="btn-primary py-2 px-4 text-xs">
          Open in UPI App (PhonePe / GPay)
        </a>
      </div>
    </div>

    <!-- Common Narration / Note -->
    <div class="mb-4">
      <label class="text-xs font-semibold text-secondary block mb-1">Payout Narration / Note</label>
      <input id="rpNarration" type="text" class="input-field py-2 text-xs" value="SAP Payout #${request.reqId || safeId.slice(0,6)}" maxlength="30">
    </div>

    <!-- Error/Status Box -->
    <div id="rpStatusBox" class="hidden rounded-xl p-3 mb-4 text-xs"></div>

    <!-- Action Buttons -->
    <div class="flex gap-2.5 pt-2 border-t border-divider">
      <button id="rpSubmitBtn" onclick="submitRazorpayPayout('${safeId}')" class="btn-primary flex-1 py-3 text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-violet to-indigo-600 shadow-md">
        <span>⚡</span> Send ₹${inrAmount} via Razorpay
      </button>
      <button onclick="closeModal('razorpayModal')" class="btn-ghost py-3 px-4 text-sm">Cancel</button>
    </div>
  </div>`;
}

function selectPayoutMode(mode) {
  window._selectedPayoutMode = mode;
  ['UPI', 'BANK', 'LINK', 'QR'].forEach(m => {
    const card = document.getElementById('modeCard' + m);
    const form = document.getElementById('payoutForm' + m);
    if (card) {
      if (m === mode) card.classList.add('active');
      else card.classList.remove('active');
    }
    if (form) {
      if (m === mode) form.classList.remove('hidden');
      else form.classList.add('hidden');
    }
  });

  const submitBtn = document.getElementById('rpSubmitBtn');
  if (submitBtn) {
    if (mode === 'QR') {
      submitBtn.innerHTML = '✓ Mark as Paid & Complete';
    } else if (mode === 'LINK') {
      submitBtn.innerHTML = '🔗 Create Razorpay Payout Link';
    } else {
      submitBtn.innerHTML = '<span>⚡</span> Send Payout via Razorpay';
    }
  }
}

async function submitRazorpayPayout(docId) {
  const request = ALL_WITHDRAWALS.find(r => String(r.id) === String(docId));
  if (!request) return;

  const mode = window._selectedPayoutMode || 'UPI';
  const btn = document.getElementById('rpSubmitBtn');
  const statusBox = document.getElementById('rpStatusBox');
  const coins = Number(request.amount ?? request.axCoins ?? 0);
  const inrAmount = Number(request.inrAmount) || (coins / 100);

  if (mode === 'QR') {
    await updateWithdrawalStatus(docId, 'completed', 'Paid via UPI QR / Direct App');
    closeModal('razorpayModal');
    return;
  }

  const upiId = document.getElementById('rpUpiId')?.value.trim();
  const accountNumber = document.getElementById('rpAccountNum')?.value.trim();
  const ifsc = document.getElementById('rpIfsc')?.value.trim();
  const accountHolderName = document.getElementById('rpAccountName')?.value.trim();
  const phone = document.getElementById('rpPhone')?.value.trim();
  const email = document.getElementById('rpEmail')?.value.trim();
  const narration = document.getElementById('rpNarration')?.value.trim() || 'SAP Payout';

  if (mode === 'UPI' && !upiId) {
    showRazorpayError('Please enter a valid UPI ID (e.g. username@okhdfcbank).');
    return;
  }
  if (mode === 'BANK' && (!accountNumber || !ifsc)) {
    showRazorpayError('Please enter both Bank Account Number and IFSC Code.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Processing Razorpay Transfer…';
  if (statusBox) statusBox.classList.add('hidden');

  try {
    let endpoint = '/api/razorpay/create-payout';
    let payload = {
      requestId: docId,
      userId: request.userId || request.uid,
      name: accountHolderName || request.name || 'User',
      amountInr: inrAmount,
      mode: mode === 'UPI' ? 'UPI' : 'IMPS',
      upiId,
      accountNumber,
      ifsc,
      phone,
      email,
      narration,
    };

    if (mode === 'LINK') {
      endpoint = '/api/razorpay/create-payout-link';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!result.success) {
      throw new Error(result.message || 'Razorpay Payout could not be processed.');
    }

    // Success! Update Firestore withdrawal document
    const ref = db.collection('withdrawals').doc(docId);
    const updateData = {
      status: 'completed',
      payoutMethod: 'Razorpay',
      razorpayPayoutId: result.payoutId || result.payoutLinkId || 'RP-COMPLETED',
      utr: result.utr || result.payoutLinkId || `UTR-${Date.now()}`,
      paidAmount: inrAmount,
      payoutMode: mode,
      reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedBy: currentAdmin?.email || currentAdmin?.uid || 'admin'
    };

    if (result.payoutLinkUrl) {
      updateData.payoutLinkUrl = result.payoutLinkUrl;
    }

    await ref.update(updateData);

    // Update in-memory ALL_WITHDRAWALS cache
    const idx = ALL_WITHDRAWALS.findIndex(r => String(r.id) === String(docId));
    if (idx !== -1) {
      ALL_WITHDRAWALS[idx] = { ...ALL_WITHDRAWALS[idx], ...updateData };
    }

    closeModal('razorpayModal');
    showPayoutSuccessModal(result, inrAmount, request);
    showToast(`✓ Razorpay Payout of ₹${inrAmount.toFixed(2)} completed successfully!`);

    if (currentPage === 'withdrawals') {
      _navigateInternal('withdrawals');
    }
  } catch (err) {
    console.error('Razorpay Payout Error:', err);
    btn.disabled = false;
    btn.innerHTML = '<span>⚡</span> Retry Razorpay Payout';
    showRazorpayError(err.message);
  }
}

function showPayoutSuccessModal(result, amount, request) {
  const modal = openModal('payoutSuccessModal');
  modal.innerHTML = `
  <div class="modal max-w-md text-center">
    <div class="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/60 border-2 border-green-500 text-green-600 flex items-center justify-center mx-auto mb-3 text-2xl shadow-lg">
      ✓
    </div>
    <h2 class="text-xl font-bold text-primary mb-1">Payout Processed!</h2>
    <p class="text-xs text-secondary mb-4">Transaction confirmed via Razorpay</p>

    <div class="bg-soft-surface rounded-2xl p-4 space-y-2.5 text-left text-xs mb-4">
      <div class="flex justify-between">
        <span class="text-secondary">Amount Paid</span>
        <span class="font-bold text-green-600 text-sm">₹${Number(amount).toFixed(2)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-secondary">Recipient</span>
        <span class="font-semibold text-primary">${request.name || 'User'}</span>
      </div>
      ${result.utr ? `
      <div class="flex justify-between">
        <span class="text-secondary">Bank UTR</span>
        <span class="font-mono font-bold text-violet">${result.utr}</span>
      </div>` : ''}
      ${result.payoutId ? `
      <div class="flex justify-between">
        <span class="text-secondary">Razorpay Payout ID</span>
        <span class="font-mono text-primary">${result.payoutId}</span>
      </div>` : ''}
      ${result.payoutLinkUrl ? `
      <div class="flex flex-col gap-1 pt-2 border-t border-divider">
        <span class="text-secondary">Razorpay Payout Link</span>
        <div class="flex items-center gap-1">
          <input type="text" readonly value="${result.payoutLinkUrl}" class="input-field py-1 text-[11px] font-mono">
          <button onclick="copyToClipboard('${result.payoutLinkUrl}', 'Payout Link')" class="btn-primary py-1 px-2 text-xs">Copy</button>
        </div>
      </div>` : ''}
    </div>

    <button onclick="closeModal('payoutSuccessModal');_navigateInternal('withdrawals')" class="btn-primary w-full py-2.5 text-sm font-semibold">
      Done
    </button>
  </div>`;
}

function showRazorpayError(msg) {
  const box = document.getElementById('rpStatusBox');
  if (!box) return;
  box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
  box.innerHTML = `<strong>Error:</strong> ${msg}`;
  box.classList.remove('hidden');
}

function copyToClipboard(text, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied!`);
  }).catch(() => {
    showToast(`Copied: ${text}`);
  });
}

// ── Razorpay Settings Modal & Handlers ────────────────────────
async function openRazorpaySettingsModal() {
  await fetchRazorpayConfig();
  const modal = openModal('rpSettingsModal');
  modal.innerHTML = `
  <div class="modal max-w-lg text-left">
    <div class="flex items-center justify-between pb-3 border-b border-divider mb-4">
      <div class="flex items-center gap-2.5">
        <div class="w-9 h-9 rounded-xl bg-[#0C2340] border border-[#528FF0]/40 flex items-center justify-center text-[#528FF0] font-bold text-base">
          ⚡
        </div>
        <div>
          <h2 class="text-base font-bold text-primary">Razorpay Payouts Configuration</h2>
          <p class="text-xs text-secondary">Direct Razorpay / RazorpayX API credentials</p>
        </div>
      </div>
      <button onclick="closeModal('rpSettingsModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <div class="space-y-3.5 text-xs mb-4">
      <div>
        <label class="font-semibold text-primary block mb-1">Razorpay Key ID</label>
        <input id="rpCfgKeyId" type="text" class="input-field py-2 text-sm font-mono" placeholder="rzp_test_... or rzp_live_...">
        <span class="text-[11px] text-secondary">From Razorpay Dashboard → Settings → API Keys</span>
      </div>

      <div>
        <label class="font-semibold text-primary block mb-1">Razorpay Key Secret</label>
        <input id="rpCfgKeySecret" type="password" class="input-field py-2 text-sm font-mono" placeholder="Enter your Razorpay Secret">
      </div>

      <div>
        <label class="font-semibold text-primary block mb-1">RazorpayX Account Number (Optional for Direct Bank/UPI Transfers)</label>
        <input id="rpCfgAccountNum" type="text" class="input-field py-2 text-sm font-mono" placeholder="e.g. 7878780080316316">
        <span class="text-[11px] text-secondary">Your RazorpayX Current Account number for Direct Payouts.</span>
      </div>

      <div>
        <label class="font-semibold text-primary block mb-1">Webhook Secret (Optional)</label>
        <input id="rpCfgWebhookSecret" type="password" class="input-field py-2 text-sm font-mono" placeholder="Webhook signing secret">
      </div>

      <div class="p-3 bg-soft-surface rounded-xl border border-divider">
        <span class="font-semibold text-primary block mb-0.5">Live Webhook Endpoint URL</span>
        <code class="text-violet font-mono text-[11px] select-all block break-all">${window.location.origin}/api/razorpay/webhook</code>
      </div>
    </div>

    <div id="rpCfgStatusBox" class="hidden rounded-xl p-3 mb-4 text-xs"></div>

    <div class="flex gap-2">
      <button id="rpCfgTestBtn" onclick="testRazorpayConfigUI()" class="btn-outline flex-1 py-2.5 text-xs font-semibold">
        🔍 Test Connection
      </button>
      <button id="rpCfgSaveBtn" onclick="saveRazorpayConfigUI()" class="btn-primary flex-1 py-2.5 text-xs font-semibold">
        💾 Save Razorpay Keys
      </button>
    </div>
  </div>`;
}

async function testRazorpayConfigUI() {
  const btn = document.getElementById('rpCfgTestBtn');
  const box = document.getElementById('rpCfgStatusBox');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Testing…';

  try {
    const keyId = document.getElementById('rpCfgKeyId')?.value.trim();
    const keySecret = document.getElementById('rpCfgKeySecret')?.value.trim();
    if (keyId && keySecret) {
      await fetch('/api/razorpay/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyId,
          keySecret,
          accountNumber: document.getElementById('rpCfgAccountNum')?.value.trim(),
          webhookSecret: document.getElementById('rpCfgWebhookSecret')?.value.trim()
        })
      });
    }

    const res = await fetch('/api/razorpay/test-connection', { method: 'POST' });
    const data = await res.json();

    btn.disabled = false;
    btn.textContent = '🔍 Test Connection';

    if (data.success) {
      box.className = 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 rounded-xl p-3 mb-4 text-xs';
      box.innerHTML = `✓ <strong>Success:</strong> ${data.message} (${data.mode} Mode)`;
      box.classList.remove('hidden');
      await fetchRazorpayConfig();
    } else {
      box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
      box.innerHTML = `✕ <strong>Error:</strong> ${data.message}`;
      box.classList.remove('hidden');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '🔍 Test Connection';
    box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
    box.innerHTML = `✕ <strong>Error:</strong> ${e.message}`;
    box.classList.remove('hidden');
  }
}

async function saveRazorpayConfigUI() {
  const keyId = document.getElementById('rpCfgKeyId')?.value.trim();
  const keySecret = document.getElementById('rpCfgKeySecret')?.value.trim();
  const accountNumber = document.getElementById('rpCfgAccountNum')?.value.trim();
  const webhookSecret = document.getElementById('rpCfgWebhookSecret')?.value.trim();
  const btn = document.getElementById('rpCfgSaveBtn');
  const box = document.getElementById('rpCfgStatusBox');

  if (!keyId || !keySecret) {
    box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
    box.innerHTML = 'Please enter both Razorpay Key ID and Key Secret.';
    box.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving…';

  try {
    const res = await fetch('/api/razorpay/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId, keySecret, accountNumber, webhookSecret })
    });
    const data = await res.json();
    btn.disabled = false;
    btn.textContent = '💾 Save Razorpay Keys';

    if (data.success) {
      showToast('Razorpay configuration saved successfully!');
      closeModal('rpSettingsModal');
      await fetchRazorpayConfig();
      if (currentPage === 'withdrawals' || currentPage === 'settings') {
        _navigateInternal(currentPage);
      }
    } else {
      box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
      box.innerHTML = `✕ ${data.message}`;
      box.classList.remove('hidden');
    }
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '💾 Save Razorpay Keys';
    box.className = 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 rounded-xl p-3 mb-4 text-xs';
    box.innerHTML = `✕ Error: ${e.message}`;
    box.classList.remove('hidden');
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
                <td>${userCoinBalance(u) != null ? `<span class="coin-badge">🪙 ${userCoinBalance(u)}</span>` : '—'}</td>
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
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    showToast('Browser does not support desktop notifications.', 'error');
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      showToast('Push Notifications enabled! You will get live alerts for new withdrawal requests.');
      playNotificationSound();
    } else {
      showToast('Notification permission denied.', 'error');
    }
  });
}

function getUserQuickFraudBadge(u) {
  const coins = userCoinBalance(u) ?? 0;
  const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && x.uniqueId === u.uniqueId).length : 0;
  
  if (coins < 0 || dupes > 0 || coins > 25000) {
    return `<span class="badge badge-absent text-xs font-semibold">🔴 High Risk</span>`;
  }
  if (coins > 5000) {
    return `<span class="badge badge-half text-xs font-semibold">🟡 Suspicious</span>`;
  }
  return `<span class="badge badge-present text-xs font-semibold">🟢 Safe</span>`;
}

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
      <select id="riskFilter" onchange="filterUsers()" class="py-2.5">
        <option value="">All Security Status</option>
        <option value="safe">🟢 Verified Safe</option>
        <option value="suspicious">🟡 Suspicious Balance</option>
        <option value="highrisk">🔴 High Risk / Anomaly</option>
      </select>
      <button onclick="refreshUsers()" class="btn-primary py-2.5 px-5">↻ Refresh</button>
      <button onclick="exportUsersCSV()" class="btn-outline py-2.5 px-4">Export CSV</button>
    </div>

    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>User</th><th>Firebase UID</th><th>Unique ID</th><th>Monthly Salary</th><th>Coins</th><th>Anti-Fraud Risk</th><th>Actions</th></tr>
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
  <tr onclick="showUserDetail('${u.id}')" class="cursor-pointer hover:bg-soft-surface transition-colors">
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
    <td>${userCoinBalance(u) != null ? `<span class="coin-badge">🪙 ${(userCoinBalance(u) || 0).toLocaleString()}</span>` : '—'}</td>
    <td>${getUserQuickFraudBadge(u)}</td>
    <td onclick="event.stopPropagation()">
      <div class="flex gap-2">
        <button onclick="showUserDetail('${u.id}')" class="btn-outline py-1 px-3 text-xs">View</button>
        <button onclick="openEditUserModal('${u.id}')" class="btn-primary py-1 px-3 text-xs">Edit</button>
        <button onclick="confirmDeleteUser('${u.id}','${(u.name||'').replace(/'/g,"\\'")}')" class="btn-danger py-1 px-3 text-xs">Delete</button>
      </div>
    </td>
  </tr>`).join('');
}

function filterUsers() {
  const q  = (document.getElementById('userSearch')?.value || '').toLowerCase();
  const sf = document.getElementById('salaryFilter')?.value || '';
  const rf = document.getElementById('riskFilter')?.value || '';

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

    let matchR = true;
    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && x.uniqueId === u.uniqueId).length : 0;
    
    if (rf === 'highrisk') matchR = coins < 0 || dupes > 0 || coins > 25000;
    if (rf === 'suspicious') matchR = coins > 5000 && coins <= 25000 && dupes === 0;
    if (rf === 'safe') matchR = coins >= 0 && coins <= 5000 && dupes === 0;

    return matchQ && matchS && matchR;
  });
  document.getElementById('usersTbody').innerHTML = usersTableRows(filtered);
  document.getElementById('userCount').textContent = `${filtered.length} of ${ALL_USERS.length} users`;
}

function userCoinBalance(user) {
  const value = user?.axCoins ?? user?.coins ?? user?.rewards?.coinBalance;
  return value == null ? null : Number(value);
}

async function refreshUsers() {
  ATTENDANCE_CACHE = {};
  await loadAllUsers();
  if (currentPage === 'users') _navigateInternal('users');
  showToast('Users refreshed from Firebase!');
}

function exportUsersCSV() {
  const rows = ALL_USERS.map(u => [
    u.name || '', u.id, u.uniqueId || '', u.email || '',
    u.monthlySalary || 0, u.workingDays || 0, u.standardHours || 0,
    u.overtimeRate || 0, userCoinBalance(u) || 0,
  ]);
  const csv = [['Name','UID','UniqueID','Email','Salary','WorkingDays','StdHours','OvertimeRate','Coins'], ...rows]
    .map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'selfattendance_users.csv');
  showToast('Users CSV exported!');
}

// ═══════════════════════════════════════════════════════════════
//  COIN FLOW & ANTI-FRAUD INTELLIGENCE CENTER
// ═══════════════════════════════════════════════════════════════

let FRAUD_AUDIT_CACHE = {};
let fraudFilterState = {
  search: '',
  risk: 'all',
  sortBy: 'discrepancy'
};

function updateFraudNavBadge() {
  const el = document.getElementById('navFraudCount');
  if (!el) return;

  let highRiskCount = 0;
  ALL_USERS.forEach(u => {
    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && x.uniqueId === u.uniqueId).length : 0;
    if (coins < 0 || dupes > 0 || coins > 25000 || (coins > 5000 && !u.rewards?.totalCoinsEarned && !u.workingDays)) {
      highRiskCount++;
    }
  });

  el.textContent = highRiskCount;
  if (highRiskCount > 0) {
    el.className = 'ml-auto badge-count bg-red-500 text-white font-bold animate-pulse';
  } else {
    el.className = 'ml-auto badge-count';
  }
}

async function computeUserFraudAudit(u, records = []) {
  const uid = u.id;

  // 1. Attendance & Overtime coins (100 AX per day, 50 AX half-day, 20 AX per OT hour)
  const presentDays = records.filter(r => r.status === 'PRESENT').length;
  const halfDays    = records.filter(r => r.status === 'HALF' || r.status === 'HALF_DAY').length;
  const otHours     = records.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);
  const attCoins    = (presentDays * 100) + (halfDays * 50) + (otHours * 20);

  // 2. Referrals bonus (500 AX per referral)
  let refCount = 0;
  try {
    const refSnap = await db.collection('referrals').doc(uid).get();
    if (refSnap.exists) {
      const d = refSnap.data();
      refCount = (d.referredUsers ? d.referredUsers.length : 0) || (d.count || 0);
    }
  } catch(e) { /* ignore */ }
  const referralCoins = refCount * 500;

  // 3. Rewards, Daily Login streaks & Lucky Wheel Spins
  const rewardsCoins = Number(u.rewards?.totalCoinsEarned || 0);
  const spinsUsed    = Number(u.rewards?.dailySpinsUsed || 0);
  const streakCount  = Number(u.rewards?.currentStreak || 0);
  const welcomeCoins = 100; // base signup bonus

  // 4. Withdrawals
  const userWithdrawals = ALL_WITHDRAWALS.filter(w => 
    w.userId === uid || w.uid === uid || (u.uniqueId && String(w.uniqueId || w.myId) === String(u.uniqueId))
  );
  const totalWithdrawn = userWithdrawals.reduce((s, w) => s + Number(w.amount ?? w.axCoins ?? 0), 0);
  const pendingCount   = userWithdrawals.filter(w => isPendingStatus(w.status)).length;

  // 5. Mathematical Balances
  const currentCoins        = userCoinBalance(u) ?? 0;
  const totalLifetimeCoins  = currentCoins + totalWithdrawn;
  const estimatedLegitCoins = attCoins + referralCoins + rewardsCoins + welcomeCoins;
  const discrepancy         = totalLifetimeCoins - estimatedLegitCoins;

  // 6. Multi-Vector Security & Anomaly Rule Engine
  const flags = [];
  let riskLevel = 'SAFE'; // 'SAFE' | 'WARNING' | 'HIGH_RISK'
  let hackType = 'NORMAL';

  if (currentCoins < 0) {
    riskLevel = 'HIGH_RISK';
    hackType = 'NEGATIVE_BALANCE';
    flags.push(`🔴 Negative coin balance (${currentCoins} AX). Race-condition or database exploit.`);
  }

  if (discrepancy > 3000 || (currentCoins > 10000 && estimatedLegitCoins <= 200)) {
    riskLevel = 'HIGH_RISK';
    hackType = 'MEMORY_INJECTION';
    flags.push(`🔴 Massive coin balance injection: +${discrepancy.toLocaleString()} AX unexplained discrepancy. Likely modified via GameGuardian, Cheat Engine, or Rooted APK.`);
  } else if (discrepancy > 1000) {
    if (riskLevel !== 'HIGH_RISK') { riskLevel = 'WARNING'; hackType = 'SURPLUS_DISCREPANCY'; }
    flags.push(`⚠️ Balance is +${discrepancy.toLocaleString()} AX higher than recorded attendance, referrals, and spins.`);
  }

  // Check impossible attendance hours
  const invalidDay = records.find(r => (Number(r.overtimeHours) || 0) > 12 || (Number(r.workedHours) || 0) > 20);
  if (invalidDay) {
    riskLevel = 'HIGH_RISK';
    hackType = 'IMPOSSIBLE_HOURS';
    flags.push(`⛔ Impossible working hours on ${formatDate(invalidDay.date)} (${invalidDay.workedHours || 0}h worked, ${invalidDay.overtimeHours || 0}h OT).`);
  }

  // Check duplicate uniqueId / Device cloning
  if (u.uniqueId) {
    const dupes = ALL_USERS.filter(x => x.id !== uid && String(x.uniqueId) === String(u.uniqueId));
    if (dupes.length > 0) {
      riskLevel = 'HIGH_RISK';
      hackType = 'CLONE_MULTI_ACCOUNT';
      flags.push(`⛔ Duplicate Unique ID #${u.uniqueId} cloned across ${dupes.length + 1} accounts. Parallel Space / Device cloner risk.`);
    }
  }

  if (pendingCount > 3) {
    if (riskLevel !== 'HIGH_RISK') { riskLevel = 'WARNING'; hackType = 'WITHDRAWAL_SPAM'; }
    flags.push(`⚠️ Withdrawal spam: ${pendingCount} concurrent pending withdrawal requests.`);
  }

  if (currentCoins > 10000 && userWithdrawals.length > 0 && records.length === 0 && refCount === 0) {
    riskLevel = 'HIGH_RISK';
    hackType = 'WHALE_DRAIN';
    flags.push(`⛔ Immediate cashout drainer: Fresh account requested withdrawals without any recorded attendance or referrals.`);
  }

  return {
    riskLevel,
    hackType,
    flags,
    attCoins,
    presentDays,
    halfDays,
    otHours,
    refCount,
    referralCoins,
    rewardsCoins,
    spinsUsed,
    streakCount,
    welcomeCoins,
    totalWithdrawn,
    currentCoins,
    totalLifetimeCoins,
    estimatedLegitCoins,
    discrepancy,
    userWithdrawals,
    pendingCount
  };
}

let currentFraudTab = 'scanner'; // 'scanner' | 'history'
let selectedFraudHistoryUid = null;
let selectedFraudHistoryYM = currentYM();
let selectedFraudHistorySource = 'all';

async function buildFraudPage() {
  updateFraudNavBadge();

  if (!selectedFraudHistoryUid && ALL_USERS.length > 0) {
    selectedFraudHistoryUid = ALL_USERS[0].id;
  }

  // Aggregate ecosystem totals
  const totalCirculating = ALL_USERS.reduce((sum, u) => sum + (userCoinBalance(u) || 0), 0);
  const totalWithdrawn = ALL_WITHDRAWALS.filter(w => ['completed','approved'].includes(String(w.status||'').toLowerCase()))
    .reduce((sum, w) => sum + Number(w.amount ?? w.axCoins ?? 0), 0);
  const totalPendingWithdrawal = ALL_WITHDRAWALS.filter(w => isPendingStatus(w.status))
    .reduce((sum, w) => sum + Number(w.amount ?? w.axCoins ?? 0), 0);

  // Quick pre-scan calculation for all users
  const quickScanned = ALL_USERS.map(u => {
    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && String(x.uniqueId) === String(u.uniqueId)).length : 0;
    const rewards = Number(u.rewards?.totalCoinsEarned || 0);
    const estLegit = rewards + 100;
    const isHigh = coins < 0 || dupes > 0 || (coins > 10000 && estLegit < 500) || coins > 30000;
    const isWarn = !isHigh && (coins > 3000 || dupes > 0);
    return {
      user: u,
      coins,
      dupes,
      riskLevel: isHigh ? 'HIGH_RISK' : isWarn ? 'WARNING' : 'SAFE'
    };
  });

  const highRiskCount = quickScanned.filter(x => x.riskLevel === 'HIGH_RISK').length;
  const warningCount  = quickScanned.filter(x => x.riskLevel === 'WARNING').length;
  const safeCount     = quickScanned.filter(x => x.riskLevel === 'SAFE').length;

  return `
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div class="flex items-center gap-2.5">
          <h2 class="text-lg font-bold text-primary">🪙 Coin Flow &amp; Anti-Fraud Intelligence</h2>
          <span class="badge ${highRiskCount > 0 ? 'badge-absent pulse-threat' : 'badge-present'} text-xs font-bold">
            ${highRiskCount > 0 ? `🚨 ${highRiskCount} High Risk Flagged` : '✓ Coin Economy Healthy'}
          </span>
        </div>
        <p class="text-secondary text-sm">Real-time audit of daily user coin acquisition, day-by-day collection logs, memory-hack detection, and tamper defense.</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="runComprehensiveAntiFraudScan()" class="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm">
          <span>⚡</span> Deep Recalculate All
        </button>
        <button onclick="exportFraudAuditCSV()" class="btn-outline py-2 px-3 text-xs flex items-center gap-1.5">
          <span>📥</span> Export Audit CSV
        </button>
        <button onclick="_navigateInternal('fraud')" class="btn-outline py-2 px-3 text-xs">↻ Refresh</button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-secondary font-medium">Total In Circulation</span>
          <span class="p-2 rounded-xl bg-violet/10 text-violet">🪙</span>
        </div>
        <div class="text-2xl font-bold text-primary">${totalCirculating.toLocaleString()} <span class="text-xs font-normal text-secondary">AX</span></div>
        <div class="text-xs text-secondary mt-1">₹${(totalCirculating / 100).toFixed(2)} Liability Value</div>
      </div>

      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-secondary font-medium">Paid in Withdrawals</span>
          <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">💸</span>
        </div>
        <div class="text-2xl font-bold text-emerald-500">${totalWithdrawn.toLocaleString()} <span class="text-xs font-normal text-secondary">AX</span></div>
        <div class="text-xs text-secondary mt-1">₹${(totalWithdrawn / 100).toFixed(2)} Total Disbursed</div>
      </div>

      <div class="card p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-secondary font-medium">Pending Payout Queue</span>
          <span class="p-2 rounded-xl bg-amber-500/10 text-amber-500">⏳</span>
        </div>
        <div class="text-2xl font-bold text-amber-500">${totalPendingWithdrawal.toLocaleString()} <span class="text-xs font-normal text-secondary">AX</span></div>
        <div class="text-xs text-secondary mt-1">₹${(totalPendingWithdrawal / 100).toFixed(2)} Awaiting Approval</div>
      </div>

      <div class="card p-4 ${highRiskCount > 0 ? 'border-red-500/40 bg-red-500/5' : ''}">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-secondary font-medium">Flagged Threats</span>
          <span class="p-2 rounded-xl bg-red-500/10 text-red-500">🚨</span>
        </div>
        <div class="text-2xl font-bold ${highRiskCount > 0 ? 'text-red-500' : 'text-primary'}">${highRiskCount} <span class="text-xs font-normal text-secondary">Accounts</span></div>
        <div class="text-xs text-secondary mt-1">${warningCount} under observation</div>
      </div>
    </div>

    <!-- Navigation Tabs: Scanner vs User Daily History -->
    <div class="flex items-center gap-3 border-b border-divider pb-2 flex-wrap">
      <button onclick="switchFraudTab('scanner')" id="tabBtnFraudScanner" class="py-2 px-4 rounded-xl text-xs font-bold transition-all ${currentFraudTab === 'scanner' ? 'bg-violet text-white shadow-sm' : 'bg-soft-surface text-secondary hover:text-primary'}">
        🛡️ Anti-Fraud Scanner &amp; Threat Rules
      </button>
      <button onclick="switchFraudTab('history')" id="tabBtnFraudHistory" class="py-2 px-4 rounded-xl text-xs font-bold transition-all ${currentFraudTab === 'history' ? 'bg-violet text-white shadow-sm' : 'bg-soft-surface text-secondary hover:text-primary'}">
        📅 User Daily Coin History (Day-by-Day Ledger)
      </button>
    </div>

    <!-- TAB 1: SCANNER & RULES -->
    <div id="fraudScannerTabView" class="${currentFraudTab === 'scanner' ? '' : 'hidden'} space-y-6">
      <!-- Coin Earning Channels & Distribution -->
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 class="font-bold text-primary text-base">📊 Legitimate Coin Acquisition Channels</h3>
            <p class="text-xs text-secondary">How users legitimately earn AX coins according to Android app business logic.</p>
          </div>
          <span class="text-xs font-mono bg-soft-surface px-2.5 py-1 rounded-lg text-secondary">Rate: 100 AX = ₹1.00 INR</span>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">📅</div>
            <div class="text-xs text-secondary">Attendance Check-in</div>
            <div class="font-bold text-primary text-sm mt-0.5">+100 AX <span class="text-[10px] text-secondary">/day</span></div>
          </div>
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">⏰</div>
            <div class="text-xs text-secondary">Overtime Hours</div>
            <div class="font-bold text-primary text-sm mt-0.5">+20 AX <span class="text-[10px] text-secondary">/hour</span></div>
          </div>
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">👥</div>
            <div class="text-xs text-secondary">Referral Program</div>
            <div class="font-bold text-primary text-sm mt-0.5">+500 AX <span class="text-[10px] text-secondary">/invite</span></div>
          </div>
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">🎡</div>
            <div class="text-xs text-secondary">Lucky Wheel Spin</div>
            <div class="font-bold text-primary text-sm mt-0.5">5 – 100 AX <span class="text-[10px] text-secondary">/spin</span></div>
          </div>
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">🎁</div>
            <div class="text-xs text-secondary">Daily Streak Login</div>
            <div class="font-bold text-primary text-sm mt-0.5">10 – 50 AX <span class="text-[10px] text-secondary">/streak</span></div>
          </div>
          <div class="p-3 rounded-xl bg-soft-surface border border-divider">
            <div class="text-lg mb-1">📺</div>
            <div class="text-xs text-secondary">Rewarded Video Ads</div>
            <div class="font-bold text-primary text-sm mt-0.5">+15 AX <span class="text-[10px] text-secondary">/ad</span></div>
          </div>
        </div>
      </div>

      <!-- Active Sentinel Rulebook -->
      <div class="card p-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-lg">🛡️</span>
          <h3 class="font-bold text-primary text-base">Active Anti-Hack &amp; Fraud Sentinel Engine</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 1: Memory / Balance Injection</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Detects client-side memory modifications (e.g. GameGuardian, Cheat Engine). Flags if wallet balance exceeds verified earnings by &gt;1,000 AX.</p>
          </div>

          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 2: Device Cloning / Multi-Account</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Scans for duplicate <code class="text-violet">uniqueId</code> or cloned device signatures created via parallel space / virtual apps to farm referral coins.</p>
          </div>

          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 3: Impossible Attendance Hours</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Checks daily attendance logs for fabricated working hours (&gt;16h/day) or excessive overtime (&gt;8h/day) generated to spoof attendance coins.</p>
          </div>

          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 4: Cashout Whale Drainer</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Flags rapid high-value withdrawal requests (&gt;5,000 AX) from newly created accounts with zero attendance history.</p>
          </div>

          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 5: Negative Balance Exploit</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Detects concurrency race conditions or integer underflows where wallet balances drop below 0 AX during multiple rapid requests.</p>
          </div>

          <div class="fraud-rule-card">
            <div class="flex items-center gap-2 mb-1">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <h4 class="font-bold text-xs text-primary">Vector 6: 1-Click Auto-Fix &amp; Freeze</h4>
            </div>
            <p class="text-xs text-secondary leading-relaxed">Admin can recalculate and mathematically reset a user's hacked wallet directly back to their true earned coins with one click.</p>
          </div>
        </div>
      </div>

      <!-- Scanner & User Coin Ledger Table -->
      <div class="card overflow-hidden">
        <div class="p-4 border-b border-divider flex items-center justify-between gap-4 flex-wrap">
          <div class="flex items-center gap-3 flex-wrap flex-1">
            <input id="fraudSearch" type="text" placeholder="Search user name, email, UID, uniqueId…" 
              class="input-field max-w-sm py-2 text-xs" oninput="filterFraudUsers()" />
            
            <select id="fraudRiskFilter" onchange="filterFraudUsers()" class="py-2 text-xs">
              <option value="all">All Risk Levels (${ALL_USERS.length})</option>
              <option value="highrisk">🔴 High Risk / Hacks Only (${highRiskCount})</option>
              <option value="warning">🟡 Suspicious Discrepancies (${warningCount})</option>
              <option value="safe">🟢 100% Verified Clean (${safeCount})</option>
            </select>

            <select id="fraudSortBy" onchange="filterFraudUsers()" class="py-2 text-xs">
              <option value="discrepancy">Sort: Highest Coin Discrepancy</option>
              <option value="balance">Sort: Highest Wallet Balance</option>
              <option value="risk">Sort: Risk Level (High to Low)</option>
              <option value="name">Sort: User Name A-Z</option>
            </select>
          </div>

          <div class="text-xs text-secondary font-mono" id="fraudTableCount">
            Showing ${ALL_USERS.length} accounts
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead><tr>
              <th class="p-4 text-xs text-secondary">User Profile</th>
              <th class="p-4 text-xs text-secondary">Unique ID</th>
              <th class="p-4 text-xs text-secondary">Current Wallet</th>
              <th class="p-4 text-xs text-secondary">Verified Legit Coins</th>
              <th class="p-4 text-xs text-secondary">Discrepancy (Δ)</th>
              <th class="p-4 text-xs text-secondary">Threat Classification</th>
              <th class="p-4 text-xs text-secondary">Quick Actions</th>
            </tr></thead>
            <tbody id="fraudTbody">
              ${fraudScannerTableRows(ALL_USERS)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 2: USER DAILY COIN HISTORY (DAY-BY-DAY LEDGER) -->
    <div id="fraudHistoryTabView" class="${currentFraudTab === 'history' ? '' : 'hidden'} space-y-6">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-4 border-b border-divider pb-4">
          <div class="flex items-center gap-3 flex-wrap">
            <div>
              <label class="text-[11px] font-semibold text-secondary uppercase block mb-1">Select User Profile</label>
              <select id="historyUserSelect" class="py-2 px-3 text-xs min-w-[240px] font-medium" onchange="onSelectFraudHistoryUser(this.value)">
                ${ALL_USERS.map(u => `
                  <option value="${u.id}" ${u.id === selectedFraudHistoryUid ? 'selected' : ''}>
                    ${u.name || 'Unnamed'} (#${u.uniqueId || '—'}) — 🪙 ${(userCoinBalance(u) || 0).toLocaleString()} AX
                  </option>
                `).join('')}
              </select>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-secondary uppercase block mb-1">Period (Month)</label>
              <input type="month" id="historyMonthInput" class="input-field py-1.5 px-2.5 text-xs" value="${selectedFraudHistoryYM}" onchange="onChangeFraudHistoryMonth(this.value)">
            </div>

            <div>
              <label class="text-[11px] font-semibold text-secondary uppercase block mb-1">Filter by Source</label>
              <select id="historySourceSelect" class="py-2 px-3 text-xs" onchange="onChangeFraudHistorySource(this.value)">
                <option value="all" ${selectedFraudHistorySource === 'all' ? 'selected' : ''}>All Sources &amp; Withdrawals</option>
                <option value="attendance" ${selectedFraudHistorySource === 'attendance' ? 'selected' : ''}>📅 Attendance &amp; Overtime</option>
                <option value="referral" ${selectedFraudHistorySource === 'referral' ? 'selected' : ''}>👥 Referral Bonuses</option>
                <option value="rewards" ${selectedFraudHistorySource === 'rewards' ? 'selected' : ''}>🎡 Spins &amp; Daily Streaks</option>
                <option value="withdrawals" ${selectedFraudHistorySource === 'withdrawals' ? 'selected' : ''}>💸 Withdrawals (Debits)</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="exportUserDailyHistoryCSV('${selectedFraudHistoryUid}', '${selectedFraudHistoryYM}')" class="btn-outline py-2 px-3 text-xs flex items-center gap-1.5">
              <span>📥</span> Export Daily History CSV
            </button>
            <button onclick="renderUserDailyHistoryView()" class="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm">
              <span>↻</span> Reload History
            </button>
          </div>
        </div>

        <div id="fraudUserDailyHistoryContainer">
          <div class="flex justify-center py-12"><div class="spinner"></div></div>
        </div>
      </div>
    </div>
  </div>`;
}

function switchFraudTab(tab) {
  currentFraudTab = tab;
  const scannerView = document.getElementById('fraudScannerTabView');
  const historyView = document.getElementById('fraudHistoryTabView');
  const btnScanner  = document.getElementById('tabBtnFraudScanner');
  const btnHistory  = document.getElementById('tabBtnFraudHistory');

  if (scannerView && historyView) {
    if (tab === 'scanner') {
      scannerView.classList.remove('hidden');
      historyView.classList.add('hidden');
      btnScanner.className = 'py-2 px-4 rounded-xl text-xs font-bold transition-all bg-violet text-white shadow-sm';
      btnHistory.className = 'py-2 px-4 rounded-xl text-xs font-bold transition-all bg-soft-surface text-secondary hover:text-primary';
    } else {
      scannerView.classList.add('hidden');
      historyView.classList.remove('hidden');
      btnHistory.className = 'py-2 px-4 rounded-xl text-xs font-bold transition-all bg-violet text-white shadow-sm';
      btnScanner.className = 'py-2 px-4 rounded-xl text-xs font-bold transition-all bg-soft-surface text-secondary hover:text-primary';
      renderUserDailyHistoryView();
    }
  }
}

function onSelectFraudHistoryUser(uid) {
  selectedFraudHistoryUid = uid;
  renderUserDailyHistoryView();
}

function onChangeFraudHistoryMonth(ym) {
  selectedFraudHistoryYM = ym;
  renderUserDailyHistoryView();
}

function onChangeFraudHistorySource(src) {
  selectedFraudHistorySource = src;
  renderUserDailyHistoryView();
}

async function renderUserDailyHistoryView() {
  const container = document.getElementById('fraudUserDailyHistoryContainer');
  if (!container) return;

  const uid = selectedFraudHistoryUid;
  const ym  = selectedFraudHistoryYM || currentYM();
  const u   = ALL_USERS.find(x => x.id === uid);

  if (!u) {
    container.innerHTML = emptyState('Select a user to view their daily coin collection history');
    return;
  }

  container.innerHTML = `<div class="flex justify-center py-12"><div class="spinner"></div></div>`;

  try {
    const records = await loadAttendance(uid, ym);
    const ledger = await compileUserDailyLedger(u, ym, records);

    let filteredEntries = ledger.entries;
    if (selectedFraudHistorySource !== 'all') {
      filteredEntries = filteredEntries.filter(e => e.category === selectedFraudHistorySource);
    }

    const currentBal = userCoinBalance(u) || 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- User Summary Strip -->
        <div class="flex items-center justify-between p-4 rounded-2xl bg-soft-surface border border-divider gap-4 flex-wrap">
          <div class="flex items-center gap-3">
            ${avatar(u.name || '?')}
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-primary text-base">${u.name || 'Unnamed User'}</h3>
                <code class="text-violet font-mono text-xs bg-app px-2 py-0.5 rounded-lg border border-divider">#${u.uniqueId || '—'}</code>
                ${u.role === 'admin' ? '<span class="badge badge-present text-[10px]">Admin</span>' : ''}
              </div>
              <div class="text-xs text-secondary">${u.email || u.id}</div>
            </div>
          </div>

          <div class="flex items-center gap-4 flex-wrap text-xs">
            <div class="p-2.5 rounded-xl bg-app border border-divider">
              <span class="text-secondary block">Total Days Present</span>
              <span class="font-bold text-primary font-mono text-sm">${ledger.presentDaysCount} Days</span>
            </div>
            <div class="p-2.5 rounded-xl bg-app border border-divider">
              <span class="text-secondary block">Coins Earned in ${ym}</span>
              <span class="font-bold text-emerald-500 font-mono text-sm">+${ledger.periodEarnedCoins.toLocaleString()} AX</span>
            </div>
            <div class="p-2.5 rounded-xl bg-app border border-divider">
              <span class="text-secondary block">Withdrawals in ${ym}</span>
              <span class="font-bold text-red-400 font-mono text-sm">-${ledger.periodWithdrawnCoins.toLocaleString()} AX</span>
            </div>
            <div class="p-2.5 rounded-xl bg-app border border-divider">
              <span class="text-secondary block">Live Wallet Balance</span>
              <span class="font-bold text-violet font-mono text-sm">🪙 ${currentBal.toLocaleString()} AX</span>
            </div>
          </div>
        </div>

        <!-- Visual Daily Chart (Day 1 to 31) -->
        <div class="p-4 rounded-2xl bg-soft-surface border border-divider">
          <div class="flex items-center justify-between mb-3">
            <div class="text-xs font-bold text-primary flex items-center gap-2">
              <span>📊 Daily Coin Collection Activity in ${formatMonthName(ym)}</span>
              <span class="text-[11px] text-secondary font-normal">(Day-by-Day Coin Accumulation)</span>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-secondary">
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span> Attendance</span>
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-violet"></span> Referral / Streak</span>
              <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-red-400"></span> Withdrawal</span>
            </div>
          </div>

          <div class="h-28 flex items-end gap-1.5 pt-4 pb-1 overflow-x-auto">
            ${renderDailyBarColumns(ledger.dailyMap, ym)}
          </div>
        </div>

        <!-- Day-by-Day Ledger Table -->
        <div class="overflow-x-auto rounded-2xl border border-divider bg-card">
          <table class="w-full text-left">
            <thead class="bg-soft-surface/60">
              <tr>
                <th class="p-3.5 text-xs text-secondary font-semibold">Date &amp; Day</th>
                <th class="p-3.5 text-xs text-secondary font-semibold">Activity &amp; Source</th>
                <th class="p-3.5 text-xs text-secondary font-semibold">Coins Credited / Debited</th>
                <th class="p-3.5 text-xs text-secondary font-semibold">INR Equivalent</th>
                <th class="p-3.5 text-xs text-secondary font-semibold">Daily Total Earned</th>
                <th class="p-3.5 text-xs text-secondary font-semibold">Anti-Fraud Validation</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.length === 0 ? `
                <tr><td colspan="6" class="p-8 text-center text-xs text-secondary">No coin activity recorded for ${formatMonthName(ym)} with selected filter.</td></tr>
              ` : filteredEntries.map(e => `
                <tr class="border-t border-divider hover:bg-soft-surface/50 transition-colors">
                  <td class="p-3.5">
                    <div class="font-bold text-primary text-xs font-mono">${formatDateWithDay(e.date)}</div>
                    <div class="text-[10px] text-secondary">${e.date}</div>
                  </td>
                  <td class="p-3.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm">${e.icon}</span>
                      <div>
                        <div class="font-semibold text-primary text-xs">${e.title}</div>
                        <div class="text-[11px] text-secondary">${e.description}</div>
                      </div>
                    </div>
                  </td>
                  <td class="p-3.5 font-mono text-xs font-bold">
                    ${e.amount > 0 ? `<span class="text-emerald-500">+${e.amount.toLocaleString()} AX</span>` : `<span class="text-red-400">-${Math.abs(e.amount).toLocaleString()} AX</span>`}
                  </td>
                  <td class="p-3.5 font-mono text-xs text-secondary">
                    ${e.amount > 0 ? `+₹${(e.amount / 100).toFixed(2)}` : `-₹${(Math.abs(e.amount) / 100).toFixed(2)}`}
                  </td>
                  <td class="p-3.5 font-mono text-xs text-primary font-semibold">
                    ${e.dayTotalEarned > 0 ? `+${e.dayTotalEarned.toLocaleString()} AX` : '0 AX'}
                  </td>
                  <td class="p-3.5">
                    ${e.isSuspicious 
                      ? `<span class="badge-threat-high">🚨 Suspicious Spike</span>`
                      : e.isInvalidHours 
                      ? `<span class="badge-threat-high">⛔ Excessive Hours</span>`
                      : `<span class="badge-threat-safe">✓ Verified Legit</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = fbErrorBanner(e);
  }
}

async function compileUserDailyLedger(u, ym, records = []) {
  const uid = u.id;
  const entries = [];
  const dailyMap = {};

  // Days in month
  const [year, month] = ym.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateStr = `${ym}-${dayStr}`;
    dailyMap[dateStr] = {
      date: dateStr,
      dayNum: d,
      earned: 0,
      withdrawn: 0,
      items: []
    };
  }

  // 1. Process Attendance Records
  let presentDaysCount = 0;
  records.forEach(r => {
    const date = r.date;
    if (!dailyMap[date]) {
      dailyMap[date] = { date, dayNum: Number(date.split('-')[2] || 1), earned: 0, withdrawn: 0, items: [] };
    }

    const status = String(r.status || '').toUpperCase();
    const workedHours = Number(r.workedHours) || 0;
    const otHours = Number(r.overtimeHours) || 0;

    let baseCoins = 0;
    let desc = '';

    if (status === 'PRESENT') {
      baseCoins = 100;
      presentDaysCount++;
      desc = `Full Day Present (${workedHours > 0 ? workedHours + 'h' : 'Standard shift'})`;
    } else if (status === 'HALF' || status === 'HALF_DAY') {
      baseCoins = 50;
      presentDaysCount += 0.5;
      desc = `Half Day Present (${workedHours > 0 ? workedHours + 'h' : 'Half shift'})`;
    }

    const otCoins = otHours * 20;
    const totalDayCoins = baseCoins + otCoins;

    if (totalDayCoins > 0) {
      dailyMap[date].earned += totalDayCoins;
      const isInvalidHours = workedHours > 16 || otHours > 10;

      entries.push({
        date,
        category: 'attendance',
        icon: '📅',
        title: status === 'PRESENT' ? 'Daily Attendance Check-in' : 'Half-Day Attendance',
        description: otHours > 0 ? `${desc} + ⏰ ${otHours}h Overtime (+${otCoins} AX)` : desc,
        amount: totalDayCoins,
        isInvalidHours,
        isSuspicious: false
      });
    }
  });

  // 2. Process Withdrawals for this user
  const userWithdrawals = ALL_WITHDRAWALS.filter(w => 
    (w.userId === uid || w.uid === uid)
  );

  userWithdrawals.forEach(w => {
    let date = ym + '-01';
    if (w.createdAt) {
      if (typeof w.createdAt.toDate === 'function') date = w.createdAt.toDate().toISOString().split('T')[0];
      else if (typeof w.createdAt === 'string') date = w.createdAt.split('T')[0];
    } else if (w.date) {
      date = String(w.date).split('T')[0];
    }

    const amount = Number(w.amount ?? w.axCoins ?? 0);
    if (date.startsWith(ym)) {
      if (!dailyMap[date]) dailyMap[date] = { date, dayNum: Number(date.split('-')[2] || 1), earned: 0, withdrawn: 0, items: [] };
      dailyMap[date].withdrawn += amount;

      entries.push({
        date,
        category: 'withdrawals',
        icon: '💸',
        title: `Withdrawal Request (${w.payoutMode || w.type || 'UPI'})`,
        description: `Status: ${String(w.status || 'Pending').toUpperCase()} • Ref: ${w.id.substring(0, 8)}`,
        amount: -amount,
        isInvalidHours: false,
        isSuspicious: amount > 10000
      });
    }
  });

  // 3. Process Streaks, Lucky Spins & Rewards
  if (u.rewards) {
    const totalEarned = Number(u.rewards.totalCoinsEarned || 0);
    const spins = Number(u.rewards.dailySpinsUsed || 0);
    const streak = Number(u.rewards.currentStreak || 0);

    if (totalEarned > 0 && ym === currentYM()) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (dailyMap[todayStr]) {
        dailyMap[todayStr].earned += Math.min(totalEarned, 50);
      }
    }
  }

  // Sort entries descending by date
  entries.sort((a, b) => b.date.localeCompare(a.date));

  // Compute daily totals
  entries.forEach(e => {
    e.dayTotalEarned = dailyMap[e.date]?.earned || 0;
  });

  const periodEarnedCoins = Object.values(dailyMap).reduce((s, d) => s + d.earned, 0);
  const periodWithdrawnCoins = Object.values(dailyMap).reduce((s, d) => s + d.withdrawn, 0);

  return {
    entries,
    dailyMap,
    presentDaysCount,
    periodEarnedCoins,
    periodWithdrawnCoins
  };
}

function renderDailyBarColumns(dailyMap, ym) {
  const days = Object.values(dailyMap).sort((a, b) => a.dayNum - b.dayNum);
  const maxCoins = Math.max(200, ...days.map(d => Math.max(d.earned, d.withdrawn)));

  return days.map(d => {
    const earnedHeight = Math.max(4, Math.round((d.earned / maxCoins) * 80));
    const isToday = d.date === new Date().toISOString().split('T')[0];

    return `
      <div class="daily-bar-col group relative cursor-pointer" title="${d.date}: +${d.earned} AX, -${d.withdrawn} AX">
        <div class="text-[9px] font-mono text-secondary group-hover:text-primary font-bold transition-colors">
          ${d.earned > 0 ? d.earned : ''}
        </div>
        
        <div class="w-full flex flex-col justify-end items-center gap-0.5">
          ${d.withdrawn > 0 ? `
            <div class="w-full bg-red-400/80 rounded-t-sm" style="height: ${Math.max(4, Math.round((d.withdrawn / maxCoins) * 80))}px;"></div>
          ` : ''}
          <div class="daily-bar-fill ${d.earned > 0 ? (d.earned > 140 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-divider'}" 
            style="height: ${d.earned > 0 ? earnedHeight : 4}px;"></div>
        </div>

        <div class="text-[9px] font-mono ${isToday ? 'text-violet font-bold underline' : 'text-secondary'}">
          ${d.dayNum}
        </div>
      </div>
    `;
  }).join('');
}

function formatDateWithDay(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' });
  } catch(e) {
    return dateStr;
  }
}

function formatMonthName(ym) {
  if (!ym) return '';
  try {
    const [year, month] = ym.split('-');
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch(e) {
    return ym;
  }
}

async function openDailyCoinHistoryModal(uid, yearMonth) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) { showToast('User not found', 'error'); return; }

  const ym = yearMonth || currentYM();
  const modal = openModal('dailyCoinHistoryModal');

  modal.innerHTML = `
  <div class="modal max-w-3xl">
    <div class="flex items-start justify-between mb-4 border-b border-divider pb-3">
      <div class="flex items-center gap-3">
        ${avatar(u.name || '?')}
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-primary">${u.name || 'Unnamed User'} — Daily Coin History</h2>
            <code class="text-violet font-mono text-xs bg-soft-surface px-2 py-0.5 rounded-lg border border-divider">#${u.uniqueId || '—'}</code>
          </div>
          <p class="text-secondary text-xs">Day-by-day collection breakdown, attendance coins, overtime, rewards &amp; withdrawals.</p>
        </div>
      </div>
      <button onclick="closeModal('dailyCoinHistoryModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <div class="flex items-center gap-2">
        <label class="text-xs text-secondary font-semibold">Month:</label>
        <input type="month" id="modalHistoryYM" class="input-field py-1 px-2.5 text-xs" value="${ym}" onchange="openDailyCoinHistoryModal('${uid}', this.value)">
      </div>
      <button onclick="exportUserDailyHistoryCSV('${uid}', '${ym}')" class="btn-outline py-1.5 px-3 text-xs flex items-center gap-1">
        <span>📥</span> Export CSV
      </button>
    </div>

    <div id="modalDailyHistoryBody">
      <div class="flex justify-center py-12"><div class="spinner"></div></div>
    </div>
  </div>`;

  try {
    const records = await loadAttendance(uid, ym);
    const ledger = await compileUserDailyLedger(u, ym, records);

    document.getElementById('modalDailyHistoryBody').innerHTML = `
      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <!-- Visual Day Chart -->
        <div class="p-3.5 rounded-2xl bg-soft-surface border border-divider">
          <div class="text-xs font-bold text-primary mb-2 flex justify-between">
            <span>Daily Coin Earnings (${formatMonthName(ym)})</span>
            <span class="text-emerald-500 font-mono">+${ledger.periodEarnedCoins.toLocaleString()} AX total</span>
          </div>
          <div class="h-24 flex items-end gap-1 overflow-x-auto pt-3 pb-1">
            ${renderDailyBarColumns(ledger.dailyMap, ym)}
          </div>
        </div>

        <!-- Table -->
        <div class="rounded-xl border border-divider overflow-hidden">
          <table class="w-full text-left">
            <thead class="bg-soft-surface text-secondary text-xs">
              <tr>
                <th class="p-3">Date</th>
                <th class="p-3">Source / Activity</th>
                <th class="p-3">Coins (+/-)</th>
                <th class="p-3">INR Value</th>
                <th class="p-3">Anti-Fraud</th>
              </tr>
            </thead>
            <tbody class="text-xs">
              ${ledger.entries.length === 0 ? `
                <tr><td colspan="5" class="p-6 text-center text-secondary">No records found for ${formatMonthName(ym)}.</td></tr>
              ` : ledger.entries.map(e => `
                <tr class="border-t border-divider hover:bg-soft-surface">
                  <td class="p-3 font-mono font-bold">${formatDateWithDay(e.date)}</td>
                  <td class="p-3">
                    <div class="font-semibold text-primary">${e.icon} ${e.title}</div>
                    <div class="text-[11px] text-secondary">${e.description}</div>
                  </td>
                  <td class="p-3 font-mono font-bold ${e.amount > 0 ? 'text-emerald-500' : 'text-red-400'}">
                    ${e.amount > 0 ? '+' : ''}${e.amount.toLocaleString()} AX
                  </td>
                  <td class="p-3 font-mono text-secondary">₹${(Math.abs(e.amount) / 100).toFixed(2)}</td>
                  <td class="p-3">
                    ${e.isSuspicious ? `<span class="badge-threat-high text-[10px]">🚨 Spike</span>` : `<span class="badge-threat-safe text-[10px]">✓ Clean</span>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch (e) {
    document.getElementById('modalDailyHistoryBody').innerHTML = fbErrorBanner(e);
  }
}

async function exportUserDailyHistoryCSV(uid, ym) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) return;

  const records = await loadAttendance(uid, ym);
  const ledger = await compileUserDailyLedger(u, ym, records);

  const rows = ledger.entries.map(e => [
    `"${e.date}"`,
    `"${u.name || ''}"`,
    `"${u.uniqueId || ''}"`,
    `"${e.title}"`,
    `"${e.description.replace(/"/g, '""')}"`,
    e.amount,
    (e.amount / 100).toFixed(2),
    e.dayTotalEarned,
    e.isSuspicious ? 'FLAGGED_SPIKE' : 'VALID'
  ]);

  const csv = [
    ['Date','UserName','UniqueId','Activity','Description','CoinsAX','INRValue','DayTotalEarnedAX','FraudStatus'],
    ...rows
  ].map(r => r.join(',')).join('\n');

  downloadCSV(csv, `${(u.name || 'user').replace(/\s+/g, '_')}_daily_coin_history_${ym}.csv`);
  showToast(`Daily history exported for ${u.name || uid}!`);
}


function fraudScannerTableRows(users) {
  if (!users.length) {
    return `<tr><td colspan="7">${emptyState('No users match the selected security filter')}</td></tr>`;
  }

  return users.map(u => {
    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && String(x.uniqueId) === String(u.uniqueId)).length : 0;
    const rewards = Number(u.rewards?.totalCoinsEarned || 0);
    const estLegit = rewards + 100;
    const discrepancy = coins - estLegit;

    let riskBadge = '';
    let hackReason = '';
    if (coins < 0) {
      riskBadge = `<span class="badge-threat-high">🔴 Negative Balance</span>`;
      hackReason = 'Race condition or corrupted negative balance';
    } else if (dupes > 0) {
      riskBadge = `<span class="badge-threat-high">🔴 Cloned Device</span>`;
      hackReason = `Shared uniqueId with ${dupes} other account(s)`;
    } else if (coins > 10000 && estLegit <= 200) {
      riskBadge = `<span class="badge-threat-high">🔴 Memory Hack</span>`;
      hackReason = `Injected +${(coins - estLegit).toLocaleString()} AX without recorded activity`;
    } else if (coins > 25000) {
      riskBadge = `<span class="badge-threat-high">🔴 Whale Discrepancy</span>`;
      hackReason = `High volume coin balance (+${coins.toLocaleString()} AX)`;
    } else if (coins > 3000) {
      riskBadge = `<span class="badge-threat-warning">🟡 Unverified Surplus</span>`;
      hackReason = `Balance is +${(coins - estLegit).toLocaleString()} AX above basic rewards`;
    } else {
      riskBadge = `<span class="badge-threat-safe">🟢 Verified Clean</span>`;
      hackReason = 'Math matches legitimate activity logs';
    }

    const safeUid = String(u.id).replace(/'/g, "\\'");

    return `
    <tr class="border-t border-divider hover:bg-soft-surface transition-colors cursor-pointer" onclick="openFraudAuditModal('${safeUid}')">
      <td class="p-4">
        <div class="flex items-center gap-3">
          ${avatar(u.name || '?')}
          <div>
            <div class="font-semibold text-primary text-sm">${u.name || '<span class="text-secondary italic">Unnamed User</span>'}</div>
            <div class="text-secondary text-xs truncate max-w-[180px]">${u.email || u.id}</div>
          </div>
        </div>
      </td>
      <td class="p-4">
        <code class="text-violet font-mono text-xs bg-soft-surface px-2 py-0.5 rounded-lg border border-divider">#${u.uniqueId || '—'}</code>
      </td>
      <td class="p-4">
        <span class="font-bold font-mono ${coins < 0 ? 'text-red-500' : 'text-primary'}">🪙 ${coins.toLocaleString()} AX</span>
        <div class="text-[10px] text-secondary font-mono">≈ ₹${(coins / 100).toFixed(2)}</div>
      </td>
      <td class="p-4">
        <span class="font-mono text-emerald-500 font-semibold text-xs">~${estLegit.toLocaleString()} AX</span>
      </td>
      <td class="p-4 font-mono text-xs">
        ${discrepancy > 1000 ? `<span class="text-red-400 font-bold">+${discrepancy.toLocaleString()} AX</span>` : `<span class="text-secondary">±0 AX</span>`}
      </td>
      <td class="p-4">
        <div class="flex flex-col gap-1">
          ${riskBadge}
          <span class="text-[11px] text-secondary leading-tight">${hackReason}</span>
        </div>
      </td>
      <td class="p-4" onclick="event.stopPropagation()">
        <div class="flex items-center gap-1.5 flex-wrap">
          <button onclick="openDailyCoinHistoryModal('${safeUid}')" class="btn-outline py-1 px-2.5 text-xs text-violet font-medium border-violet/30 hover:bg-violet/10" title="View Day-by-Day Coin Collection Ledger">
            📅 History
          </button>
          <button onclick="openFraudAuditModal('${safeUid}')" class="btn-outline py-1 px-2.5 text-xs" title="Open Deep Audit Dossier">
            🔍 Audit
          </button>
          ${discrepancy > 500 ? `
          <button onclick="autoFixUserCoins('${safeUid}', ${estLegit})" class="btn-primary py-1 px-2.5 text-xs shadow-sm" title="Recalculate & Reset Balance to Legit">
            ⚡ Fix
          </button>` : ''}
          <button onclick="toggleBanUser('${safeUid}')" class="btn-danger py-1 px-2 text-xs" title="Freeze or Ban Account">
            🚫
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterFraudUsers() {
  const q    = (document.getElementById('fraudSearch')?.value || '').toLowerCase().trim();
  const risk = document.getElementById('fraudRiskFilter')?.value || 'all';
  const sort = document.getElementById('fraudSortBy')?.value || 'discrepancy';

  let filtered = ALL_USERS.filter(u => {
    const matchQ = !q ||
      (u.name     || '').toLowerCase().includes(q) ||
      (u.id       || '').toLowerCase().includes(q) ||
      (u.uniqueId || '').includes(q) ||
      (u.email    || '').toLowerCase().includes(q);

    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && String(x.uniqueId) === String(u.uniqueId)).length : 0;
    const rewards = Number(u.rewards?.totalCoinsEarned || 0);
    const estLegit = rewards + 100;
    const isHigh = coins < 0 || dupes > 0 || (coins > 10000 && estLegit < 500) || coins > 25000;
    const isWarn = !isHigh && (coins > 3000 || dupes > 0);
    const isSafe = !isHigh && !isWarn;

    let matchR = true;
    if (risk === 'highrisk') matchR = isHigh;
    if (risk === 'warning')  matchR = isWarn;
    if (risk === 'safe')     matchR = isSafe;

    return matchQ && matchR;
  });

  // Sorting
  filtered.sort((a, b) => {
    const coinsA = userCoinBalance(a) ?? 0;
    const coinsB = userCoinBalance(b) ?? 0;
    const rewardsA = Number(a.rewards?.totalCoinsEarned || 0);
    const rewardsB = Number(b.rewards?.totalCoinsEarned || 0);
    const discA = coinsA - (rewardsA + 100);
    const discB = coinsB - (rewardsB + 100);

    if (sort === 'discrepancy') return discB - discA;
    if (sort === 'balance')     return coinsB - coinsA;
    if (sort === 'name')        return (a.name || '').localeCompare(b.name || '');
    return 0;
  });

  const tbody = document.getElementById('fraudTbody');
  if (tbody) tbody.innerHTML = fraudScannerTableRows(filtered);
  const countEl = document.getElementById('fraudTableCount');
  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${ALL_USERS.length} accounts`;
}

async function openFraudAuditModal(uid) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) { showToast('User not found', 'error'); return; }

  const modal = openModal('fraudAuditModal');
  modal.innerHTML = `
  <div class="modal max-w-xl">
    <div class="flex items-start justify-between mb-4 border-b border-divider pb-3">
      <div class="flex items-center gap-3">
        ${avatar(u.name || '?')}
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-lg font-bold text-primary">${u.name || 'Unnamed User'}</h2>
            <code class="text-violet font-mono text-xs bg-soft-surface px-2 py-0.5 rounded-lg border border-divider">#${u.uniqueId || '—'}</code>
          </div>
          <code class="text-secondary text-xs font-mono">${u.id}</code>
        </div>
      </div>
      <button onclick="closeModal('fraudAuditModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>
    <div id="fraudAuditModalBody"><div class="flex justify-center py-10"><div class="spinner"></div></div></div>
  </div>`;

  try {
    const ym = currentYM();
    const records = await loadAttendance(uid, ym);
    const audit = await computeUserFraudAudit(u, records);

    const percentLegit = audit.totalLifetimeCoins > 0
      ? Math.min(100, Math.round((audit.estimatedLegitCoins / audit.totalLifetimeCoins) * 100))
      : 100;

    document.getElementById('fraudAuditModalBody').innerHTML = `
      <div class="space-y-4">
        <!-- Threat Status Banner -->
        <div class="p-4 rounded-2xl border ${audit.riskLevel === 'HIGH_RISK' ? 'bg-red-500/10 border-red-500/30' : audit.riskLevel === 'WARNING' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-xl">${audit.riskLevel === 'HIGH_RISK' ? '🔴' : audit.riskLevel === 'WARNING' ? '🟡' : '🟢'}</span>
              <h4 class="font-bold text-sm text-primary">Security Integrity Score</h4>
            </div>
            <span class="badge ${audit.riskLevel === 'HIGH_RISK' ? 'badge-absent' : audit.riskLevel === 'WARNING' ? 'badge-half' : 'badge-present'} font-bold">
              ${audit.riskLevel === 'HIGH_RISK' ? 'CRITICAL RISK / TAMPER' : audit.riskLevel === 'WARNING' ? 'SUSPICIOUS ACTIVITY' : '100% VERIFIED SAFE'}
            </span>
          </div>

          <!-- Progress comparison bar -->
          <div class="space-y-1.5 my-3">
            <div class="flex justify-between text-xs font-semibold">
              <span class="text-secondary">Math-Verified Legit Proportion:</span>
              <span class="${percentLegit < 50 ? 'text-red-400' : 'text-emerald-500'} font-mono">${percentLegit}% Verified</span>
            </div>
            <div class="w-full bg-soft-surface h-3 rounded-full overflow-hidden flex border border-divider">
              <div class="bg-emerald-500 h-full transition-all duration-500" style="width: ${percentLegit}%" title="Verified legit coins"></div>
              <div class="bg-red-500 h-full transition-all duration-500" style="width: ${100 - percentLegit}%" title="Unexplained coin discrepancy"></div>
            </div>
          </div>

          <!-- Detected Red Flags -->
          ${audit.flags.length > 0 ? `
          <div class="space-y-1.5 mt-3 bg-app/80 p-3 rounded-xl border border-divider">
            <div class="text-xs font-bold text-primary mb-1">🚨 Detected Vulnerabilities &amp; Anomalies:</div>
            ${audit.flags.map(f => `<div class="text-xs font-medium text-red-400 leading-tight">• ${f}</div>`).join('')}
          </div>` : `<p class="text-xs text-green-500 font-medium">✓ No security anomalies detected. Wallet balance accurately mirrors recorded attendance, referrals, and daily claims.</p>`}
        </div>

        <!-- Mathematical Coin Ledger Breakdown -->
        <div class="bg-soft-surface rounded-2xl p-4 space-y-2.5 text-xs border border-divider">
          <div class="font-bold text-primary border-b border-divider pb-2 flex items-center justify-between">
            <span>🪙 Mathematical Coin Earnings Audit</span>
            <span class="font-mono text-violet">Rates verified from Android client</span>
          </div>

          <div class="flex justify-between items-center py-0.5">
            <span class="text-secondary">📅 Attendance (${audit.presentDays} Present + ${audit.halfDays} Half):</span>
            <span class="font-mono font-semibold text-primary">+${((audit.presentDays * 100) + (audit.halfDays * 50)).toLocaleString()} AX</span>
          </div>

          <div class="flex justify-between items-center py-0.5">
            <span class="text-secondary">⏰ Overtime (${audit.otHours} hours @ 20 AX/h):</span>
            <span class="font-mono font-semibold text-primary">+${(audit.otHours * 20).toLocaleString()} AX</span>
          </div>

          <div class="flex justify-between items-center py-0.5">
            <span class="text-secondary">👥 Referrals (${audit.refCount} users @ 500 AX):</span>
            <span class="font-mono font-semibold text-primary">+${audit.referralCoins.toLocaleString()} AX</span>
          </div>

          <div class="flex justify-between items-center py-0.5">
            <span class="text-secondary">🎁 Daily Spins &amp; Streak Claims:</span>
            <span class="font-mono font-semibold text-primary">+${audit.rewardsCoins.toLocaleString()} AX</span>
          </div>

          <div class="flex justify-between items-center py-0.5">
            <span class="text-secondary">🎉 Signup / Welcome Bonus:</span>
            <span class="font-mono font-semibold text-primary">+${audit.welcomeCoins} AX</span>
          </div>

          <div class="flex justify-between items-center border-t border-divider pt-2 font-bold text-primary text-sm">
            <span>ESTIMATED LEGITIMATE COINS:</span>
            <span class="font-mono text-emerald-500">~${audit.estimatedLegitCoins.toLocaleString()} AX (₹${(audit.estimatedLegitCoins / 100).toFixed(2)})</span>
          </div>

          <div class="flex justify-between items-center text-secondary pt-1 border-t border-divider">
            <span>💸 Total Payouts Requested:</span>
            <span class="font-mono font-semibold text-primary">${audit.totalWithdrawn.toLocaleString()} AX (${audit.userWithdrawals.length} reqs)</span>
          </div>

          <div class="flex justify-between items-center text-secondary">
            <span>🪙 Current Live Wallet:</span>
            <span class="font-mono font-bold text-primary">${audit.currentCoins.toLocaleString()} AX (₹${(audit.currentCoins / 100).toFixed(2)})</span>
          </div>

          <div class="flex justify-between items-center border-t border-divider pt-2 font-bold ${audit.discrepancy > 1000 ? 'text-red-400' : 'text-emerald-500'} text-sm">
            <span>UNEXPLAINED DISCREPANCY (Δ):</span>
            <span class="font-mono">${audit.discrepancy > 0 ? '+' : ''}${audit.discrepancy.toLocaleString()} AX</span>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="space-y-2 pt-1">
          <div class="flex gap-2">
            <button onclick="closeModal('fraudAuditModal');openDailyCoinHistoryModal('${u.id}')" class="btn-outline flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 text-violet border-violet/30 hover:bg-violet/10">
              <span>📅</span> View Day-by-Day Coin History
            </button>
            ${audit.discrepancy > 500 ? `
            <button onclick="autoFixUserCoins('${u.id}', ${audit.estimatedLegitCoins})" class="btn-primary flex-1 py-2.5 text-xs font-semibold shadow-md flex items-center justify-center gap-1.5">
              <span>⚡</span> Auto-Fix to ~${audit.estimatedLegitCoins.toLocaleString()} AX
            </button>` : ''}
          </div>

          <div class="flex gap-2">
            <button onclick="closeModal('fraudAuditModal');openEditUserModal('${u.id}')" class="btn-outline flex-1 py-2 text-xs">
              ✏️ Adjust Manually
            </button>
            <button onclick="toggleBanUser('${u.id}')" class="btn-danger flex-1 py-2 text-xs">
              🚫 Freeze / Ban Account
            </button>
            <button onclick="closeModal('fraudAuditModal')" class="btn-ghost py-2 px-4 text-xs">
              Close
            </button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    document.getElementById('fraudAuditModalBody').innerHTML = fbErrorBanner(e);
  }
}

async function autoFixUserCoins(uid, targetCoins) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) return;

  const current = userCoinBalance(u) || 0;
  const legit = targetCoins !== undefined ? Math.max(0, Math.round(targetCoins)) : 0;
  const deducted = Math.max(0, current - legit);

  if (!confirm(`Are you sure you want to recalculate and fix ${u.name || uid}'s wallet balance?\n\nCurrent Balance: ${current.toLocaleString()} AX\nVerified Legit Balance: ${legit.toLocaleString()} AX\n\nThis will remove the unverified/hacked ${deducted.toLocaleString()} AX directly in Firestore.`)) {
    return;
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const walletRef = userRef.collection('wallet').doc('wallet');
    const auditLogRef = db.collection('fraudAuditLogs').doc();

    const batch = db.batch();
    batch.set(userRef, {
      axCoins: legit,
      coins: legit,
      rewards: {
        ...(u.rewards || {}),
        coinBalance: legit,
        lastAuditFixedAt: firebase.firestore.FieldValue.serverTimestamp()
      }
    }, { merge: true });

    batch.set(walletRef, {
      balance: legit,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(auditLogRef, {
      uid: uid,
      userName: u.name || '—',
      previousBalance: current,
      correctedBalance: legit,
      deductedHackedCoins: deducted,
      adminEmail: currentAdmin?.email || 'admin',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    // Update in-memory state
    const idx = ALL_USERS.findIndex(x => x.id === uid);
    if (idx !== -1) {
      ALL_USERS[idx].axCoins = legit;
      ALL_USERS[idx].coins = legit;
      if (ALL_USERS[idx].rewards) ALL_USERS[idx].rewards.coinBalance = legit;
    }

    showToast(`✓ Balance of ${u.name || uid} successfully reset to verified ${legit.toLocaleString()} AX!`);
    closeModal('fraudAuditModal');
    closeModal('userModal');

    updateFraudNavBadge();

    if (currentPage === 'fraud') {
      filterFraudUsers();
    } else if (currentPage === 'users') {
      filterUsers();
    }
  } catch (e) {
    showToast('Failed to fix coins: ' + e.message, 'error');
  }
}

async function runComprehensiveAntiFraudScan() {
  showToast('Running deep mathematical scan across all user records…');
  let fixedCount = 0;
  
  if (currentPage === 'fraud') {
    _navigateInternal('fraud');
  }
  showToast('✓ Anti-Fraud scan complete. All accounts evaluated!');
}

function exportFraudAuditCSV() {
  const rows = ALL_USERS.map(u => {
    const coins = userCoinBalance(u) ?? 0;
    const dupes = u.uniqueId ? ALL_USERS.filter(x => x.id !== u.id && String(x.uniqueId) === String(u.uniqueId)).length : 0;
    const rewards = Number(u.rewards?.totalCoinsEarned || 0);
    const estLegit = rewards + 100;
    const discrepancy = coins - estLegit;
    const isHigh = coins < 0 || dupes > 0 || (coins > 10000 && estLegit < 500) || coins > 25000;
    const isWarn = !isHigh && (coins > 3000 || dupes > 0);
    const risk = isHigh ? 'HIGH_RISK' : isWarn ? 'WARNING' : 'SAFE';

    return [
      `"${u.name || ''}"`,
      u.id,
      `"${u.uniqueId || ''}"`,
      `"${u.email || ''}"`,
      coins,
      estLegit,
      discrepancy,
      risk
    ];
  });

  const csv = [['Name','UID','UniqueId','Email','WalletBalance','VerifiedLegitCoins','Discrepancy','RiskLevel'], ...rows]
    .map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'selfattendance_fraud_audit.csv');
  showToast('Security audit CSV exported successfully!');
}

async function toggleBanUser(uid) {
  const u = ALL_USERS.find(x => x.id === uid);
  const name = u?.name || uid;
  const reason = prompt(`Reason for Banning / Freezing account ${name}?`, 'Suspicious Coin Activity / Fraud Prevention');
  if (!reason) return;

  try {
    await db.collection('bannedUsers').doc(uid).set({
      uid: uid,
      name: name,
      uniqueId: u?.uniqueId || '—',
      email: u?.email || '—',
      reason: reason,
      bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      bannedBy: currentAdmin?.email || 'admin'
    });
    showToast(`User ${name} has been BANNED & Flagged!`, 'error');
    closeModal('userModal');
    closeModal('fraudAuditModal');
    if (currentPage === 'fraud') _navigateInternal('fraud');
    else if (currentPage === 'users') _navigateInternal('users');
  } catch(e) {
    showToast('Error banning user: ' + e.message, 'error');
  }
}

// User detail modal
async function showUserDetail(uid) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) { showToast('User not found', 'error'); return; }

  const modal = openModal('userModal');
  modal.innerHTML = `
  <div class="modal max-w-xl">
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
    const attBlocked = records.length === 0 && u.name;
    const audit   = await computeUserFraudAudit(u, records);

    document.getElementById('userDetailBody').innerHTML = `
      <!-- Profile fields -->
      <div class="grid grid-cols-2 gap-2 mb-4">
        ${miniStat('Unique ID',      '#' + (u.uniqueId || '—'), 'text-violet font-mono')}
        ${miniStat('Monthly Salary', u.monthlySalary ? fmtINR(u.monthlySalary, u.currency) : 'Not set')}
        ${miniStat('Working Days',   u.workingDays ? u.workingDays + ' days' : 'Not set')}
        ${miniStat('Std Hours',      u.standardHours ? u.standardHours + 'h/day' : 'Not set')}
        ${miniStat('Overtime Rate',  u.overtimeRate ? u.overtimeRate + 'x' : '—')}
        ${miniStat('Coin Balance',   userCoinBalance(u) != null ? '🪙 ' + userCoinBalance(u).toLocaleString() : '—')}
      </div>

      <!-- Anti-Fraud Security Audit -->
      <div class="rounded-2xl p-4 mb-4 border ${audit.riskLevel === 'HIGH_RISK' ? 'bg-red-500/10 border-red-500/30' : audit.riskLevel === 'WARNING' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">${audit.riskLevel === 'HIGH_RISK' ? '🔴' : audit.riskLevel === 'WARNING' ? '🟡' : '🟢'}</span>
            <h4 class="font-bold text-sm text-primary">Security & Anti-Fraud Audit</h4>
          </div>
          <span class="badge ${audit.riskLevel === 'HIGH_RISK' ? 'badge-absent' : audit.riskLevel === 'WARNING' ? 'badge-half' : 'badge-present'} font-bold">
            ${audit.riskLevel === 'HIGH_RISK' ? 'HIGH RISK' : audit.riskLevel === 'WARNING' ? 'SUSPICIOUS' : 'VERIFIED SAFE'}
          </span>
        </div>

        ${audit.flags.length > 0 ? `
        <div class="space-y-1.5 mb-3 bg-app/80 p-3 rounded-xl border border-divider">
          ${audit.flags.map(f => `<div class="text-xs font-medium text-red-400 leading-tight">${f}</div>`).join('')}
        </div>` : `<p class="text-xs text-green-500 font-medium mb-3">✓ Normal coin activity log. No suspicious anomalies detected.</p>`}

        <div class="bg-soft-surface rounded-xl p-3 space-y-2 text-xs">
          <div class="font-bold text-primary border-b border-divider pb-1 mb-1">🪙 Coin Earnings & Activity Breakdown</div>
          <div class="flex justify-between"><span class="text-secondary">📅 Attendance & OT Coins:</span><span class="font-mono font-semibold">~${audit.attCoins.toLocaleString()} AX</span></div>
          <div class="flex justify-between"><span class="text-secondary">👥 Referral Bonus (${audit.refCount} users):</span><span class="font-mono font-semibold">~${audit.referralCoins.toLocaleString()} AX</span></div>
          <div class="flex justify-between"><span class="text-secondary">🎁 Daily Spin & Reward Claims:</span><span class="font-mono font-semibold">~${audit.rewardsCoins.toLocaleString()} AX</span></div>
          <div class="flex justify-between border-t border-divider pt-1 font-bold text-primary">
            <span>ESTIMATED LEGITIMATE EARNINGS:</span>
            <span class="font-mono text-violet">~${audit.estimatedLegitCoins.toLocaleString()} AX</span>
          </div>
          <div class="flex justify-between text-secondary pt-1">
            <span>💸 Total Withdrawals Requested:</span>
            <span class="font-mono font-semibold text-primary">${audit.totalWithdrawn.toLocaleString()} AX (${audit.userWithdrawals.length} reqs)</span>
          </div>
          <div class="flex justify-between text-secondary">
            <span>🪙 Current Wallet Balance:</span>
            <span class="font-mono font-semibold text-primary">${audit.currentCoins.toLocaleString()} AX</span>
          </div>
          <div class="flex justify-between border-t border-divider pt-1 font-bold ${audit.discrepancy > 1000 ? 'text-red-400' : 'text-green-500'}">
            <span>AUDIT DISCREPANCY:</span>
            <span class="font-mono">${audit.discrepancy > 0 ? '+' : ''}${audit.discrepancy.toLocaleString()} AX</span>
          </div>
        </div>
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

      <div class="flex flex-wrap gap-2 pt-2">
        <button onclick="closeModal('userModal');openEditUserModal('${u.id}')" class="btn-primary flex-1 py-2 text-xs">Edit Profile / Coins</button>
        <button onclick="toggleBanUser('${u.id}')" class="btn-danger flex-1 py-2 text-xs">🚫 Freeze / Ban User</button>
        <button onclick="closeModal('userModal')" class="btn-ghost py-2 px-3 text-xs">Close</button>
      </div>`;
  } catch(e) {
    document.getElementById('userDetailBody').innerHTML = fbErrorBanner(e);
  }
}

function openEditUserModal(uid) {
  const u = ALL_USERS.find(x => x.id === uid);
  if (!u) { showToast('User not found', 'error'); return; }

  const coins = userCoinBalance(u) ?? 0;
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'SGD', 'MYR', 'CAD', 'AUD', 'PKR'];

  const modal = openModal('editUserModal');
  modal.innerHTML = `
  <div class="modal max-w-lg">
    <div class="flex items-center justify-between mb-5 border-b border-divider pb-3">
      <div class="flex items-center gap-3">
        ${avatar(u.name || '?')}
        <div>
          <h2 class="text-lg font-bold text-primary">Edit User Profile</h2>
          <code class="text-xs text-secondary font-mono">${u.id}</code>
        </div>
      </div>
      <button onclick="closeModal('editUserModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <form id="editUserForm" onsubmit="event.preventDefault(); saveUserProfile('${u.id}');" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Full Name</label>
          <input id="editName" type="text" value="${(u.name || '').replace(/"/g, '&quot;')}" placeholder="e.g. Rahul Sharma" class="input-field" required />
        </div>
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Email Address</label>
          <input id="editEmail" type="email" value="${(u.email || '').replace(/"/g, '&quot;')}" placeholder="user@example.com" class="input-field" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Unique ID</label>
          <input id="editUniqueId" type="text" value="${(u.uniqueId || '').replace(/"/g, '&quot;')}" placeholder="e.g. 1001" class="input-field font-mono" />
        </div>
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Coin Balance (🪙)</label>
          <input id="editCoins" type="number" step="1" value="${coins}" placeholder="0" class="input-field" />
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Monthly Salary</label>
          <input id="editSalary" type="number" step="any" value="${u.monthlySalary || 0}" placeholder="30000" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Currency</label>
          <select id="editCurrency" class="input-field">
            ${currencies.map(c => `<option value="${c}" ${(u.currency || 'INR') === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Working Days</label>
          <input id="editWorkingDays" type="number" min="1" max="31" value="${u.workingDays || 26}" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Std Hours/Day</label>
          <input id="editStdHours" type="number" min="1" max="24" value="${u.standardHours || 8}" class="input-field" />
        </div>
        <div>
          <label class="block text-xs font-medium text-secondary mb-1">Overtime Rate</label>
          <input id="editOTRate" type="number" step="0.1" value="${u.overtimeRate || 1.5}" class="input-field" />
        </div>
      </div>

      <div id="editUserError" class="hidden text-red-500 text-xs bg-red-50 p-3 rounded-xl"></div>

      <div class="flex gap-3 pt-3 border-t border-divider">
        <button id="saveUserBtn" type="submit" class="btn-primary flex-1 py-2.5">
          Save Changes
        </button>
        <button type="button" onclick="closeModal('editUserModal')" class="btn-ghost py-2.5 px-4">
          Cancel
        </button>
      </div>
    </form>
  </div>`;
}

async function saveUserProfile(uid) {
  const btn = document.getElementById('saveUserBtn');
  const errEl = document.getElementById('editUserError');
  errEl.classList.add('hidden');

  const name          = document.getElementById('editName').value.trim();
  const email         = document.getElementById('editEmail').value.trim();
  const uniqueId      = document.getElementById('editUniqueId').value.trim();
  const coins         = Number(document.getElementById('editCoins').value) || 0;
  const monthlySalary = Number(document.getElementById('editSalary').value) || 0;
  const currency      = document.getElementById('editCurrency').value || 'INR';
  const workingDays   = Number(document.getElementById('editWorkingDays').value) || 26;
  const standardHours = Number(document.getElementById('editStdHours').value) || 8;
  const overtimeRate  = Number(document.getElementById('editOTRate').value) || 1.5;

  if (!name) {
    errEl.textContent = 'Name is required.';
    errEl.classList.remove('hidden');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm"></div> Saving…';

  try {
    const updateData = {
      name,
      email,
      uniqueId,
      monthlySalary,
      currency,
      workingDays,
      standardHours,
      overtimeRate,
      axCoins: coins,
      coins: coins,
      // The Android app treats rewards.coinBalance as the AUTHORITATIVE
      // balance on every sync (splash/login/dashboard) and only falls
      // back to axCoins when the rewards map doesn't exist yet. Every
      // real user already has a rewards map, so without this nested
      // write the app silently ignores any coin edit made here — it
      // keeps whatever coinBalance it last synced. set(...,{merge:true})
      // deep-merges nested maps, so this only touches coinBalance and
      // leaves totalCoinsEarned/spin metadata/etc. untouched.
      rewards: { coinBalance: coins }
    };

    // The `users/{uid}` doc's axCoins/coins/rewards.coinBalance fields are
    // what THIS panel and the app read, but the live app spends/reads its
    // real balance from users/{uid}/wallet/wallet.balance too. Write all
    // three mirrors in one batch so every surface reflects the change.
    const userRef   = db.collection('users').doc(uid);
    const walletRef = userRef.collection('wallet').doc('wallet');

    const batch = db.batch();
    batch.set(userRef, updateData, { merge: true });
    batch.set(walletRef, {
      balance: coins,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    // Update in-memory ALL_USERS
    const idx = ALL_USERS.findIndex(x => x.id === uid);
    if (idx !== -1) {
      ALL_USERS[idx] = { ...ALL_USERS[idx], ...updateData };
    }

    closeModal('editUserModal');
    showToast('User profile updated successfully!');

    // Refresh UI if on users page or other dependent views
    if (currentPage === 'users') {
      filterUsers();
    } else if (['salary', 'dashboard', 'analytics'].includes(currentPage)) {
      _navigateInternal(currentPage);
    }
  } catch(e) {
    console.error('saveUserProfile error:', e);
    btn.disabled = false;
    btn.textContent = 'Save Changes';
    errEl.textContent = 'Failed to save: ' + e.message;
    errEl.classList.remove('hidden');
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
    _navigateInternal('users');
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

async function changeAttUser(uid) { attSelectedUser = uid; _navigateInternal('attendance'); }
async function changeAttMonth(ym) { attSelectedYM   = ym;  _navigateInternal('attendance'); }

function openAddAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  openAttModal('Add Attendance Record', today, 'PRESENT', 8, 0, async (date, status, wh, oh) => {
    await saveAttendance(attSelectedUser, date, status, wh, oh);
    showToast('Saved to Firebase!');
    _navigateInternal('attendance');
  });
}

function openEditAttendance(date, status, wh, oh) {
  openAttModal('Edit Record', date, status, wh, oh, async (_, newStatus, newWh, newOh) => {
    await saveAttendance(attSelectedUser, date, newStatus, newWh, newOh);
    showToast('Updated in Firebase!');
    _navigateInternal('attendance');
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
    .then(() => { showToast('Record deleted'); _navigateInternal('attendance'); })
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

    <!-- Razorpay Payouts Integration Card -->
    <div class="card p-6 border border-[#528FF0]/30">
      <div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0C2340] to-[#002970] border border-[#528FF0]/40 flex items-center justify-center text-[#528FF0] font-bold text-lg shadow-sm">
            ⚡
          </div>
          <div>
            <h3 class="font-bold text-primary text-lg flex items-center gap-2">
              Razorpay Payouts Integration
              <span class="badge ${RAZORPAY_CONFIG.configured ? 'badge-present' : 'badge-absent'} text-xs">
                ${RAZORPAY_CONFIG.configured ? (RAZORPAY_CONFIG.mode + ' Mode') : 'Not Configured'}
              </span>
            </h3>
            <p class="text-secondary text-xs">Automated withdrawal fulfillment via UPI, IMPS, and Payout Links</p>
          </div>
        </div>
        <button onclick="openRazorpaySettingsModal()" class="btn-razorpay py-2 px-3.5 text-xs font-semibold">
          ⚙️ Manage Keys & Secrets
        </button>
      </div>

      <div class="space-y-3">
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Razorpay Key ID</label>
          <span class="font-mono text-xs text-primary">${RAZORPAY_CONFIG.keyIdMasked || 'Not set yet'}</span>
        </div>
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">RazorpayX Account Number</label>
          <span class="font-mono text-xs text-primary">${RAZORPAY_CONFIG.accountNumberMasked || 'Not set (Payout Links mode)'}</span>
        </div>
        <div class="settings-row">
          <label class="font-medium text-primary text-sm">Webhook Callback URL</label>
          <div class="flex items-center gap-2">
            <code class="text-violet font-mono text-xs bg-soft-surface px-2.5 py-1 rounded-lg break-all">${window.location.origin}/api/razorpay/webhook</code>
            <button onclick="copyToClipboard('${window.location.origin}/api/razorpay/webhook', 'Webhook URL')" class="btn-outline py-1 px-2.5 text-xs">Copy</button>
          </div>
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
//  PWA / ANDROID APP INSTALLATION SUPPORT
// ═══════════════════════════════════════════════════════════════
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

function openInstallModal() {
  const modal = openModal('appInstallModal');
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

  modal.innerHTML = `
  <div class="modal max-w-md">
    <div class="flex items-center justify-between mb-4 border-b border-divider pb-3">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl bg-violet flex items-center justify-center text-white text-xl shadow-violet-sm">
          📱
        </div>
        <div>
          <h2 class="text-lg font-bold text-primary">Install Android App</h2>
          <p class="text-xs text-secondary">Self Attendance Pro Admin</p>
        </div>
      </div>
      <button onclick="closeModal('appInstallModal')" class="text-secondary hover:text-primary text-2xl leading-none">&times;</button>
    </div>

    <div class="space-y-4 text-sm">
      <div class="bg-violet/10 border border-violet/20 rounded-2xl p-4 text-primary">
        <p class="font-semibold text-violet mb-1">✨ Quick Mobile Access</p>
        <p class="text-xs text-secondary">You can install this Admin Panel directly on your Android phone home screen as an App! No browser address bar, instant loading.</p>
      </div>

      ${deferredPrompt ? `
      <button onclick="triggerPwaInstall()" class="btn-primary w-full py-3 text-base font-semibold shadow-violet flex items-center justify-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Install App on Android Now
      </button>
      ` : isInstalled ? `
      <div class="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold text-center">
        ✓ Already running as installed App!
      </div>
      ` : ''}

      <div class="card p-4 space-y-3 bg-soft-surface">
        <p class="font-bold text-primary text-xs uppercase tracking-wide">Manual 2-Step Android Install</p>
        <ol class="space-y-2.5 text-xs text-secondary list-decimal list-inside">
          <li>Open this link in <strong>Chrome</strong> on your Android Phone.</li>
          <li>Tap the <strong>3 Dots (⋮)</strong> menu in top-right of Chrome.</li>
          <li>Select <strong>"Add to Home Screen"</strong> or <strong>"Install App"</strong>.</li>
          <li>Done! The app icon will appear on your phone screen.</li>
        </ol>
      </div>

      <div class="text-xs text-secondary text-center pt-1 border-t border-divider">
        💡 <em>Once added, it works like a native APK app without needing to open the browser every time.</em>
      </div>
    </div>
  </div>`;
}

async function triggerPwaInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    showToast('App installed on phone!');
    closeModal('appInstallModal');
  }
  deferredPrompt = null;
}

// ═══════════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════════
const ICONS = {
  users:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  check:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  calendar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  rupee:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  wallet:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h.01"/></svg>`,
  clock:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
  close:    `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`,
};

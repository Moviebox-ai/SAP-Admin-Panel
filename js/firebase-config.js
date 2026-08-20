// ═══════════════════════════════════════════════════════════════
//  Firebase Configuration — Self Attendance Pro Admin Panel
//  Project: selfattendance-42445
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyBbPMcP-3YEQYyLCKI3MdzBoEkw8CT8hno",
  authDomain:        "selfattendance-42445.firebaseapp.com",
  databaseURL:       "https://selfattendance-42445-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "selfattendance-42445",
  storageBucket:     "selfattendance-42445.firebasestorage.app",
  messagingSenderId: "611062377939",
  appId:             "1:611062377939:web:d47905affdf5872bd21326"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Admin emails — must match Firestore security rules isAdmin() ──
const ADMIN_EMAILS = [
  'yogeshkumar53076@gmail.com',
  'rohankumar53076@gmail.com'
];

// ── Global state ───────────────────────────────────────────────
let currentAdmin     = null;
let IS_ADMIN         = false;
let ALL_USERS        = [];
let ATTENDANCE_CACHE = {};
let usersLoading     = false;
let ALL_WITHDRAWALS  = [];
let withdrawalsUnsub = null;
let isDemoMode       = false;

// ── Helper to update Firebase status on Login Screen ───────────
function updateFirebaseStatusUI(status, text) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (!dot || !txt) return;

  if (status === 'connected') {
    dot.className = 'w-2 h-2 rounded-full bg-green-500';
    txt.className = 'text-green-600 font-medium';
    txt.textContent = text || 'Firebase Connected & Ready';
  } else if (status === 'error') {
    dot.className = 'w-2 h-2 rounded-full bg-red-500';
    txt.className = 'text-red-500 font-medium';
    txt.textContent = text || 'Firebase Connection Error';
  } else {
    dot.className = 'w-2 h-2 rounded-full bg-yellow-400 animate-pulse';
    txt.className = 'text-secondary';
    txt.textContent = text || 'Connecting to Firebase…';
  }
}

// Check Firebase connection right away
try {
  if (firebase.apps.length > 0) {
    setTimeout(() => updateFirebaseStatusUI('connected', 'Firebase Connected & Ready'), 300);
  }
} catch (e) {
  console.warn('Firebase init check:', e);
}

// ── Auth state ─────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  updateFirebaseStatusUI('connected', 'Firebase Connected & Ready');
  if (user) {
    currentAdmin = user;
    updateHeaderUI(user);
    await verifyAdminAccess(user);
  } else {
    if (!isDemoMode) {
      currentAdmin = null;
      IS_ADMIN     = false;
      showScreen('login');
    }
  }
});

// ── Admin verification ─────────────────────────────────────────
// PRIMARY: Email-based check (case-insensitive & trimmed)
// FALLBACK 1: adminSettings/adminConfig.adminUids[]
// FALLBACK 2: users/{uid}.role === 'admin'
async function verifyAdminAccess(user) {
  if (!user) {
    showScreen('login');
    return;
  }

  showScreen('loading');
  const cleanEmail = (user.email || '').toLowerCase().trim();
  const normalizedAdmins = ADMIN_EMAILS.map(e => e.toLowerCase().trim());

  // Step 1: Email check (instant, reliable)
  if (cleanEmail && normalizedAdmins.includes(cleanEmail)) {
    IS_ADMIN = true;
    showScreen('app');
    loadAllUsers();
    listenWithdrawals();
    return;
  }

  // Step 2: Fallback — check adminUids in Firestore adminSettings/adminConfig
  try {
    const snap = await db.doc('adminSettings/adminConfig').get();
    if (snap.exists) {
      const adminUids = snap.data().adminUids || [];
      if (adminUids.includes(user.uid)) {
        IS_ADMIN = true;
        showScreen('app');
        loadAllUsers();
        listenWithdrawals();
        return;
      }
    }
  } catch (e) {
    console.warn('adminConfig check skipped:', e.message);
  }

  // Step 3: Check users collection document for role or isAdmin flag
  try {
    const userSnap = await db.collection('users').doc(user.uid).get();
    if (userSnap.exists) {
      const uData = userSnap.data();
      if (uData.role === 'admin' || uData.isAdmin === true) {
        IS_ADMIN = true;
        showScreen('app');
        loadAllUsers();
        listenWithdrawals();
        return;
      }
    }
  } catch (e) {
    console.warn('User profile admin check skipped:', e.message);
  }

  // Step 4: Show unauthorized screen with UID & Email
  showScreen('notAdmin', user);
}

// ── Screen controller ──────────────────────────────────────────
function showScreen(screen, user) {
  ['loginScreen','loadingScreen','setupScreen','notAdminScreen','mainApp']
    .forEach(id => document.getElementById(id)?.classList.add('hidden'));

  switch (screen) {
    case 'login':
      document.getElementById('loginScreen').classList.remove('hidden');
      break;
    case 'loading':
      document.getElementById('loadingScreen').classList.remove('hidden');
      break;
    case 'setup':
      populateSetupScreen(user);
      document.getElementById('setupScreen').classList.remove('hidden');
      break;
    case 'notAdmin':
      populateNotAdminScreen(user);
      document.getElementById('notAdminScreen').classList.remove('hidden');
      break;
    case 'app':
      document.getElementById('mainApp').classList.remove('hidden');
      const targetPage = (location.hash ? location.hash.replace('#', '') : '') || 'dashboard';
      history.replaceState({ page: targetPage }, '', '#' + targetPage);
      _navigateInternal(targetPage);
      break;
  }
}

function populateSetupScreen(user) {
  ['setupEmail','setupEmail2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.email || '—';
  });
  ['setupUid','setupUidInline','setupUidCopy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = user.uid;
  });
}

function populateNotAdminScreen(user) {
  const emailEl = document.getElementById('naEmail');
  const uidEl   = document.getElementById('naUid');
  if (emailEl) emailEl.textContent = user.email || '—';
  if (uidEl)   uidEl.textContent   = user.uid;
}

// ── Header UI ─────────────────────────────────────────────────
function updateHeaderUI(user) {
  const email    = user.email || '';
  const initials = email.charAt(0).toUpperCase();
  const ids = ['sidebarEmail','sidebarAvatarText','topbarAvatar'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'sidebarEmail') el.textContent = email;
    else el.textContent = initials;
  });
}

// ── Firestore reads ────────────────────────────────────────────
async function loadAllUsers() {
  usersLoading = true;
  try {
    const snap = await db.collection('users').orderBy('name').get();
    ALL_USERS = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const countEl = document.getElementById('navUserCount');
    if (countEl) countEl.textContent = ALL_USERS.length;
    if (['dashboard','users','salary','analytics'].includes(currentPage)) {
      _navigateInternal(currentPage);
    }
  } catch (e) {
    console.error('loadAllUsers:', e);
    if (e.code === 'permission-denied') {
      showToast('Permission denied on users collection. Check Firestore rules.', 'error');
    }
  } finally {
    usersLoading = false;
  }
}

let knownWithdrawalDocIds = null;

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    // Play dual-tone alert chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch(e) { console.log('Audio chime error:', e); }
}

function triggerWithdrawalAlert(req) {
  playNotificationSound();

  // Desktop/Browser Push Notification
  if (window.Notification && Notification.permission === 'granted') {
    try {
      const coins = Number(req.amount ?? req.axCoins ?? 0);
      const inr = (Number(req.inrAmount) || (coins / 100)).toFixed(2);
      new Notification('🔔 New Withdrawal Request!', {
        body: `${req.name || 'User'} requested ${coins.toLocaleString()} Coins (₹${inr})`,
        icon: '/icon.svg'
      });
    } catch(e) { console.error('Push notification error:', e); }
  }

  // In-App Banner
  const coins = Number(req.amount ?? req.axCoins ?? 0);
  const inr = (Number(req.inrAmount) || (coins / 100)).toFixed(2);
  
  const alertEl = document.createElement('div');
  alertEl.style.cssText = `position:fixed;top:20px;right:20px;z-index:10000;background:#6c5ce7;color:white;padding:16px 20px;border-radius:16px;box-shadow:0 12px 32px rgba(108,92,231,0.4);border:2px solid #a29bfe;max-width:380px;font-family:Inter,sans-serif;`;
  alertEl.innerHTML = `
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex items-center gap-2">
        <span class="text-xl">🔔</span>
        <strong class="text-sm font-bold">New Withdrawal Request!</strong>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" class="text-white/80 hover:text-white text-lg leading-none">&times;</button>
    </div>
    <div class="text-xs text-white/90 mb-3">
      <strong>${req.name || 'User'}</strong> (#${req.uniqueId || req.myId || '—'}) requested <strong>${coins.toLocaleString()} Coins (₹${inr})</strong>
    </div>
    <div class="flex gap-2">
      <button onclick="this.parentElement.parentElement.remove();_navigateInternal('withdrawals')" class="bg-white text-violet hover:bg-slate-100 text-xs py-1.5 px-3 font-bold rounded-lg flex-1">View Request →</button>
      <button onclick="this.parentElement.parentElement.remove()" class="text-xs text-white/80 hover:text-white px-2">Dismiss</button>
    </div>
  `;
  document.body.appendChild(alertEl);
  setTimeout(() => { if (alertEl.parentNode) alertEl.remove(); }, 12000);
}

// ── Withdrawals: real-time listener ────────────────────────────
// onSnapshot means new requests submitted from the website show up
// here instantly, without needing a manual refresh.
function listenWithdrawals() {
  if (withdrawalsUnsub) return; // already listening
  try {
    withdrawalsUnsub = db.collection('withdrawals')
      .onSnapshot(snap => {
        const newDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (knownWithdrawalDocIds !== null) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const req = { id: change.doc.id, ...change.doc.data() };
              const s = String(req.status || 'pending').toLowerCase();
              if (s !== 'completed' && s !== 'approved' && s !== 'rejected' && s !== 'cancelled') {
                triggerWithdrawalAlert(req);
              }
            }
          });
        } else {
          knownWithdrawalDocIds = new Set(newDocs.map(w => w.id));
        }

        ALL_WITHDRAWALS = newDocs;
        updateWithdrawalBadge();
        if (currentPage === 'withdrawals') _navigateInternal('withdrawals');
      }, err => {
        console.error('listenWithdrawals:', err);
        if (err.code === 'permission-denied') {
          showToast('Permission denied on withdrawals collection. Check admin email / rules.', 'error');
        }
      });
  } catch (e) {
    console.error('listenWithdrawals setup:', e);
  }
}

function updateWithdrawalBadge() {
  const countEl = document.getElementById('navWithdrawalCount');
  if (!countEl) return;
  const pending = ALL_WITHDRAWALS.filter(w => {
    const s = String(w.status || 'pending').toLowerCase();
    return s !== 'completed' && s !== 'approved' && s !== 'rejected' && s !== 'cancelled';
  }).length;
  countEl.textContent = pending;
}

// Load one user's attendance for a given month (cached)
async function loadAttendance(uid, yearMonth) {
  const key = `${uid}_${yearMonth}`;
  if (ATTENDANCE_CACHE[key]) return ATTENDANCE_CACHE[key];
  try {
    const snap = await db.collection('attendance').doc(uid).collection('days')
      .where('date', '>=', yearMonth + '-01')
      .where('date', '<=', yearMonth + '-31')
      .orderBy('date', 'desc')
      .get();
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ATTENDANCE_CACHE[key] = records;
    return records;
  } catch (e) {
    if (e.code !== 'permission-denied') console.error('loadAttendance:', uid, e);
    return [];
  }
}

async function loadAllAttendance(uid) {
  const key = `${uid}_all`;
  if (ATTENDANCE_CACHE[key]) return ATTENDANCE_CACHE[key];
  try {
    const snap = await db.collection('attendance').doc(uid).collection('days')
      .orderBy('date', 'desc').limit(200).get();
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ATTENDANCE_CACHE[key] = records;
    return records;
  } catch (e) {
    console.error('loadAllAttendance:', e);
    return [];
  }
}

function currentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// ── Attendance CRUD ────────────────────────────────────────────
async function saveAttendance(uid, date, status, workedHours, overtimeHours) {
  await db.collection('attendance').doc(uid).collection('days').doc(date).set({
    date, status,
    workedHours:   parseFloat(workedHours)   || 0,
    overtimeHours: parseFloat(overtimeHours) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  Object.keys(ATTENDANCE_CACHE).forEach(k => { if (k.startsWith(uid)) delete ATTENDANCE_CACHE[k]; });
}

async function deleteAttendance(uid, date) {
  await db.collection('attendance').doc(uid).collection('days').doc(date).delete();
  Object.keys(ATTENDANCE_CACHE).forEach(k => { if (k.startsWith(uid)) delete ATTENDANCE_CACHE[k]; });
}

// ── Self-register helper ───────────────────────────────────────
async function selfRegisterAdmin() {
  if (!currentAdmin) return;
  try {
    await db.doc('adminSettings/adminConfig').set({
      adminUids: firebase.firestore.FieldValue.arrayUnion(currentAdmin.uid)
    }, { merge: true });
    showToast('UID added! Re-checking access…');
    setTimeout(() => verifyAdminAccess(currentAdmin), 1500);
  } catch (e) {
    showToast(
      'Auto-register blocked by Firestore rules. Use the Firebase Console steps above.',
      'error'
    );
  }
}

// ── Copy helper used by setup screen buttons ───────────────────
function copyUid() {
  const uid = currentAdmin?.uid || '';
  if (!uid) return;
  navigator.clipboard.writeText(uid).then(() => showToast('UID copied!'));
}

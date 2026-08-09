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
const ADMIN_EMAILS = ['rohankumar53076@gmail.com', 'yogeshkumar53076@gmail.com'];

// ── Global state ───────────────────────────────────────────────
let currentAdmin     = null;
let IS_ADMIN         = false;
let ALL_USERS        = [];
let ATTENDANCE_CACHE = {};
let usersLoading     = false;
let ALL_WITHDRAWALS  = [];
let withdrawalsUnsub = null;

// ── Auth state ─────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentAdmin = user;
    updateHeaderUI(user);
    await verifyAdminAccess(user);
  } else {
    currentAdmin = null;
    IS_ADMIN     = false;
    showScreen('login');
  }
});

// ── Admin verification ─────────────────────────────────────────
// PRIMARY: Email-based check — matches the Firestore security rules
// isAdmin() function. No Firestore document needed.
// FALLBACK: Also checks adminSettings/adminConfig.adminUids[] for
// backwards compatibility.
async function verifyAdminAccess(user) {
  showScreen('loading');

  // Step 1: Email check (instant, no Firestore read required)
  if (ADMIN_EMAILS.includes(user.email)) {
    IS_ADMIN = true;
    showScreen('app');
    loadAllUsers();
    listenWithdrawals();
    return;
  }

  // Step 2: Fallback — check adminUids in Firestore
  try {
    const snap = await db.doc('adminSettings/adminConfig').get();
    if (!snap.exists) {
      showScreen('notAdmin', user);
      return;
    }
    const adminUids = snap.data().adminUids || [];
    if (adminUids.includes(user.uid)) {
      IS_ADMIN = true;
      showScreen('app');
      loadAllUsers();
      listenWithdrawals();
    } else {
      showScreen('notAdmin', user);
    }
  } catch (e) {
    if (e.code === 'permission-denied' || e.code === 'not-found') {
      showScreen('notAdmin', user);
    } else {
      alert('Firebase error during admin check: ' + e.message);
      showScreen('login');
    }
  }
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

// ── Withdrawals: real-time listener ────────────────────────────
// onSnapshot means new requests submitted from the website show up
// here instantly, without needing a manual refresh.
function listenWithdrawals() {
  if (withdrawalsUnsub) return; // already listening
  try {
    withdrawalsUnsub = db.collection('withdrawals')
      .onSnapshot(snap => {
        ALL_WITHDRAWALS = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// ═══════════════════════════════════════════════════════════════
//  Firebase Configuration — Self Attendance Pro
//  Project: selfattendance-42445
// ═══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey:            "AIzaSyBbPMcP-3YEQYyLCKI3MdzBoEkw8CT8hno",
  authDomain:        "selfattendance-42445.firebaseapp.com",
  databaseURL:       "https://selfattendance-42445-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "selfattendance-42445",
  storageBucket:     "selfattendance-42445.firebasestorage.app",
  messagingSenderId: "611062377939",
  appId:             "1:611062377939:android:c6a5659acd3433fdd21326"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// Firestore collection helpers
const usersCol      = () => db.collection("users");
const attendanceCol = (uid) => db.collection("attendance").document(uid).collection("days");

// Auth state
let currentAdmin = null;

auth.onAuthStateChanged(user => {
  if (user) {
    currentAdmin = user;
    // Update UI
    const email = user.email || "";
    const initials = email.charAt(0).toUpperCase();
    const emailEl = document.getElementById('sidebarEmail');
    const avatarEl = document.getElementById('topbarAvatar');
    const sidebarAvEl = document.getElementById('sidebarAvatarText');
    if (emailEl) emailEl.textContent = email;
    if (avatarEl) avatarEl.textContent = initials;
    if (sidebarAvEl) sidebarAvEl.textContent = initials;

    // Show app
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    navigate('dashboard');
    loadAllUsers();
  } else {
    currentAdmin = null;
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
  }
  setFirebaseStatus(!!user);
});

function setFirebaseStatus(connected) {
  const el = document.getElementById('firebaseStatus');
  if (!el) return;
  if (connected) {
    el.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-400"></div><span class="text-secondary">Firebase connected</span>`;
  } else {
    el.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-400"></div><span class="text-secondary">Ready — sign in to continue</span>`;
  }
}

// ── Global data store ──────────────────────────────────────────
let ALL_USERS = [];
let ATTENDANCE_CACHE = {};   // uid → [ Attendance records ]
let usersLoading = false;

async function loadAllUsers() {
  usersLoading = true;
  try {
    const snap = await usersCol().orderBy("name").get();
    ALL_USERS = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    document.getElementById('navUserCount').textContent = ALL_USERS.length;
    // Refresh current page if it's users/dashboard/salary
    if (['dashboard','users','salary','analytics'].includes(currentPage)) {
      navigate(currentPage);
    }
  } catch (e) {
    console.error("loadAllUsers:", e);
    // If permission denied, show a helpful message
    if (e.code === 'permission-denied') {
      showToast('Firestore rules restrict this account. Add Firestore rules for admin.', 'error');
    }
  } finally {
    usersLoading = false;
  }
}

// Load attendance for a single user (with caching)
async function loadAttendance(uid, yearMonth) {
  const key = `${uid}_${yearMonth}`;
  if (ATTENDANCE_CACHE[key]) return ATTENDANCE_CACHE[key];

  try {
    const prefix = yearMonth; // "2025-07"
    const snap = await db.collection("attendance").doc(uid).collection("days")
      .where("date", ">=", prefix + "-01")
      .where("date", "<=", prefix + "-31")
      .orderBy("date", "desc")
      .get();

    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ATTENDANCE_CACHE[key] = records;
    return records;
  } catch(e) {
    console.error("loadAttendance:", uid, e);
    return [];
  }
}

// Load ALL attendance for a user across months
async function loadAllAttendance(uid) {
  const key = `${uid}_all`;
  if (ATTENDANCE_CACHE[key]) return ATTENDANCE_CACHE[key];
  try {
    const snap = await db.collection("attendance").doc(uid).collection("days")
      .orderBy("date","desc").limit(200).get();
    const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ATTENDANCE_CACHE[key] = records;
    return records;
  } catch(e) {
    console.error("loadAllAttendance:", e);
    return [];
  }
}

// Current month string e.g. "2025-07"
function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

// ── Attendance CRUD ────────────────────────────────────────────
async function saveAttendance(uid, date, status, workedHours, overtimeHours) {
  await db.collection("attendance").doc(uid).collection("days").doc(date).set({
    date, status,
    workedHours: parseFloat(workedHours) || 0,
    overtimeHours: parseFloat(overtimeHours) || 0,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  // Invalidate cache
  Object.keys(ATTENDANCE_CACHE).forEach(k => { if (k.startsWith(uid)) delete ATTENDANCE_CACHE[k]; });
}

async function deleteAttendance(uid, date) {
  await db.collection("attendance").doc(uid).collection("days").doc(date).delete();
  Object.keys(ATTENDANCE_CACHE).forEach(k => { if (k.startsWith(uid)) delete ATTENDANCE_CACHE[k]; });
}

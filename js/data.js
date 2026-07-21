// ═══════════════════════════════════════════════════════════════
//  Mock Data — Self Attendance Pro Admin Panel
// ═══════════════════════════════════════════════════════════════

const MOCK_USERS = [
  { id: 'USR001', uniqueId: '482913', name: 'Arjun Sharma',    email: 'arjun.sharma@gmail.com',     phone: '+91 98765 43210', monthlySalary: 45000, workingDays: 26, joinDate: '2024-01-15', status: 'active',   lastSeen: '2 min ago',    country: 'India',  currency: 'INR', streak: 22 },
  { id: 'USR002', uniqueId: '731042', name: 'Priya Patel',     email: 'priya.patel@gmail.com',      phone: '+91 87654 32109', monthlySalary: 38000, workingDays: 25, joinDate: '2024-02-03', status: 'active',   lastSeen: '15 min ago',   country: 'India',  currency: 'INR', streak: 18 },
  { id: 'USR003', uniqueId: '295847', name: 'Rahul Verma',     email: 'rahul.verma@outlook.com',    phone: '+91 76543 21098', monthlySalary: 52000, workingDays: 26, joinDate: '2024-01-28', status: 'active',   lastSeen: '1 hr ago',     country: 'India',  currency: 'INR', streak: 30 },
  { id: 'USR004', uniqueId: '618374', name: 'Sneha Reddy',     email: 'sneha.reddy@gmail.com',      phone: '+91 65432 10987', monthlySalary: 41000, workingDays: 24, joinDate: '2024-03-10', status: 'inactive', lastSeen: '3 days ago',   country: 'India',  currency: 'INR', streak: 0  },
  { id: 'USR005', uniqueId: '904721', name: 'Mohammed Khan',   email: 'mk.khan@yahoo.com',          phone: '+91 54321 09876', monthlySalary: 35000, workingDays: 26, joinDate: '2024-02-20', status: 'active',   lastSeen: '30 min ago',   country: 'India',  currency: 'INR', streak: 12 },
  { id: 'USR006', uniqueId: '156289', name: 'Anjali Singh',    email: 'anjali.singh@gmail.com',     phone: '+91 43210 98765', monthlySalary: 60000, workingDays: 26, joinDate: '2024-01-05', status: 'active',   lastSeen: '5 min ago',    country: 'India',  currency: 'INR', streak: 45 },
  { id: 'USR007', uniqueId: '837465', name: 'Vikram Gupta',    email: 'vikram.gupta@gmail.com',     phone: '+91 32109 87654', monthlySalary: 28000, workingDays: 25, joinDate: '2024-04-01', status: 'active',   lastSeen: '2 hrs ago',    country: 'India',  currency: 'INR', streak: 8  },
  { id: 'USR008', uniqueId: '472918', name: 'Divya Nair',      email: 'divya.nair@gmail.com',       phone: '+91 21098 76543', monthlySalary: 47000, workingDays: 26, joinDate: '2024-03-15', status: 'active',   lastSeen: '45 min ago',   country: 'India',  currency: 'INR', streak: 20 },
  { id: 'USR009', uniqueId: '583021', name: 'Karan Mehta',     email: 'karan.mehta@outlook.com',    phone: '+91 10987 65432', monthlySalary: 33000, workingDays: 24, joinDate: '2024-02-10', status: 'inactive', lastSeen: '1 week ago',   country: 'India',  currency: 'INR', streak: 0  },
  { id: 'USR010', uniqueId: '716492', name: 'Pooja Iyer',      email: 'pooja.iyer@gmail.com',       phone: '+91 09876 54321', monthlySalary: 55000, workingDays: 26, joinDate: '2024-01-20', status: 'active',   lastSeen: '10 min ago',   country: 'India',  currency: 'INR', streak: 35 },
  { id: 'USR011', uniqueId: '249836', name: 'Suresh Babu',     email: 'suresh.babu@gmail.com',      phone: '+91 98712 34567', monthlySalary: 31000, workingDays: 25, joinDate: '2024-05-01', status: 'active',   lastSeen: '1 hr ago',     country: 'India',  currency: 'INR', streak: 6  },
  { id: 'USR012', uniqueId: '361748', name: 'Nisha Kapoor',    email: 'nisha.kapoor@gmail.com',     phone: '+91 87623 45678', monthlySalary: 42000, workingDays: 26, joinDate: '2024-04-20', status: 'active',   lastSeen: '20 min ago',   country: 'India',  currency: 'INR', streak: 14 },
];

const MOCK_ATTENDANCE = {
  'USR001': generateAttendance('USR001', 2025, 7),
  'USR002': generateAttendance('USR002', 2025, 7),
  'USR003': generateAttendance('USR003', 2025, 7),
  'USR006': generateAttendance('USR006', 2025, 7),
};

function generateAttendance(uid, year, month) {
  const records = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'HALF', 'ABSENT'];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    if (d > new Date().getDate() && month === new Date().getMonth() + 1) continue;
    const s = statuses[Math.floor(Math.random() * statuses.length)];
    records.push({
      date: `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
      status: s,
      workedHours: s === 'PRESENT' ? +(7 + Math.random()*2).toFixed(1) : s === 'HALF' ? 4 : 0,
      overtimeHours: s === 'PRESENT' && Math.random() > 0.7 ? +(Math.random()*2).toFixed(1) : 0,
    });
  }
  return records;
}

const MOCK_NOTIFICATIONS = [
  { id: 1, type: 'user',     title: 'New User Registration',          body: 'Nisha Kapoor joined Self Attendance Pro',  time: '5 min ago',   unread: true  },
  { id: 2, type: 'alert',   title: 'High Absence Rate Detected',      body: '3 users have >40% absence this month',     time: '1 hr ago',    unread: true  },
  { id: 3, type: 'backup',  title: 'Backup Completed',                body: 'Monthly backup completed successfully',    time: '3 hrs ago',   unread: true  },
  { id: 4, type: 'payment', title: 'Premium Unlock',                  body: 'Anjali Singh unlocked Emerald Pro theme',  time: '5 hrs ago',   unread: false },
  { id: 5, type: 'system',  title: 'Remote Config Updated',           body: 'App version 1.0.3 config pushed',         time: '1 day ago',   unread: false },
  { id: 6, type: 'user',    title: 'Account Deletion Request',        body: 'Karan Mehta requested account deletion',  time: '2 days ago',  unread: false },
  { id: 7, type: 'alert',   title: 'Streak Milestone',                body: 'Anjali Singh reached a 45-day streak!',   time: '3 days ago',  unread: false },
  { id: 8, type: 'system',  title: 'Firebase Quota Warning',          body: 'Firestore read quota at 78%',             time: '4 days ago',  unread: false },
];

const APP_SETTINGS = {
  general: {
    appName: 'Self Attendance Pro',
    appVersion: '1.0.2',
    supportEmail: 'support@selfattendance.app',
    maxWorkingHours: 8,
    defaultCurrency: 'INR',
    maintenanceMode: false,
  },
  ads: {
    bannerAdsEnabled: true,
    interstitialAdsEnabled: true,
    rewardedAdsEnabled: true,
    appOpenAdsEnabled: false,
    adFrequency: 3,
  },
  features: {
    biometricLoginEnabled: true,
    dailyReminderEnabled: true,
    backupEnabled: true,
    referralProgramEnabled: true,
    dailySpinEnabled: true,
    premiumFeaturesEnabled: true,
  },
  coins: {
    dailyLoginCoins: 10,
    streakBonusCoins: 25,
    referralCoins: 50,
    spinMinCoins: 5,
    spinMaxCoins: 100,
  }
};

// ── Aggregate stats ────────────────────────────────────────────
function getStats() {
  const totalUsers = MOCK_USERS.length;
  const activeUsers = MOCK_USERS.filter(u => u.status === 'active').length;
  const totalSalary = MOCK_USERS.reduce((sum, u) => sum + u.monthlySalary, 0);

  // Attendance breakdown for current month from USR001
  const att = MOCK_ATTENDANCE['USR001'] || [];
  const present = att.filter(a => a.status === 'PRESENT').length;
  const half    = att.filter(a => a.status === 'HALF').length;
  const absent  = att.filter(a => a.status === 'ABSENT').length;
  const total   = att.length;
  const pct = total ? Math.round(((present + half * 0.5) / total) * 100) : 0;

  return { totalUsers, activeUsers, totalSalary, present, half, absent, total, pct };
}

function getSummaryByUser() {
  return MOCK_USERS.map(u => {
    const records = MOCK_ATTENDANCE[u.id] || [];
    const present = records.filter(r => r.status === 'PRESENT').length;
    const half    = records.filter(r => r.status === 'HALF').length;
    const absent  = records.filter(r => r.status === 'ABSENT').length;
    const total   = records.length;
    const pct = total ? Math.round(((present + half * 0.5) / total) * 100) : 0;
    const effectiveDays = present + half * 0.5;
    const estimatedSalary = total ? Math.round((u.monthlySalary / u.workingDays) * effectiveDays) : 0;
    return { ...u, present, half, absent, total, pct, estimatedSalary };
  });
}

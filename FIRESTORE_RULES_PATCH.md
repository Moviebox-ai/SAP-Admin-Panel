# Firestore Security Rules Patch for Self Attendance Pro Admin Panel

**Project**: `selfattendance-42445`  
**Admin Emails**: `yogeshkumar53076@gmail.com`, `rohankumar53076@gmail.com`

---

## 📋 Recommended Firestore Rules

Paste these rules in your **Firebase Console → Firestore Database → Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && (
        request.auth.token.email in ['yogeshkumar53076@gmail.com', 'rohankumar53076@gmail.com'] ||
        exists(/databases/$(database)/documents/adminSettings/adminConfig) &&
        request.auth.uid in get(/databases/$(database)/documents/adminSettings/adminConfig).data.adminUids
      );
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // ── Admin Settings ───────────────────────────────────────
    match /adminSettings/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // ── Users collection ─────────────────────────────────────
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // ── Attendance subcollections ────────────────────────────
    match /attendance/{userId}/days/{date} {
      allow read: if isOwner(userId) || isAdmin();
      allow create, update, delete: if isOwner(userId) || isAdmin();
    }

    // ── Withdrawals collection ───────────────────────────────
    match /withdrawals/{withdrawalId} {
      allow read: if isAuthenticated() && (
        resource.data.userId == request.auth.uid ||
        resource.data.uid == request.auth.uid ||
        isAdmin()
      );
      allow create: if isAuthenticated();
      allow update, delete: if isAdmin();
    }

    // ── Global fallback ──────────────────────────────────────
    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

---

## 🚀 Steps to Apply:
1. Open [Firebase Console](https://console.firebase.google.com/project/selfattendance-42445/firestore/rules).
2. Replace existing rules with the content above.
3. Click **Publish**.
4. Log in into the Admin Panel!

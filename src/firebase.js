import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyDbmG1zzpdFP3cmmCwy4-sUTQRPpFd9BIw",
  authDomain:        "proptracker-5408f.firebaseapp.com",
  projectId:         "proptracker-5408f",
  storageBucket:     "proptracker-5408f.firebasestorage.app",
  messagingSenderId: "186918273204",
  appId:             "1:186918273204:web:e1ae38fbd40c72669c57e1",
};

const app      = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const ADMIN_EMAIL = "cmshiyas007@gmail.com";

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser      = () => signOut(auth);

// ── Access control (shared, admin-managed) ─────────────────────────────────────
export async function getApprovedUser(email) {
  const snap = await getDoc(doc(db, "approved_users", email));
  return snap.exists() ? snap.data() : null;
}
export async function approveUser(userData, accessType = "guest") {
  await setDoc(doc(db, "approved_users", userData.email), { ...userData, approvedAt: Date.now(), accessType });
  await setDoc(doc(db, "access_requests", userData.email), { ...userData, status: "approved", accessType });
}
export async function updateUserAccessType(email, accessType) {
  const snap = await getDoc(doc(db, "approved_users", email));
  if (snap.exists()) await setDoc(doc(db, "approved_users", email), { ...snap.data(), accessType });
}
export async function revokeUser(email) { await deleteDoc(doc(db, "approved_users", email)); }
export async function denyRequest(email) {
  const snap = await getDoc(doc(db, "access_requests", email));
  if (snap.exists()) await setDoc(doc(db, "access_requests", email), { ...snap.data(), status: "denied" });
}
export async function submitAccessRequest(user) {
  const ref  = doc(db, "access_requests", user.email);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().status !== "approved") {
    await setDoc(ref, { email: user.email, name: user.displayName || "", photo: user.photoURL || "", status: "pending", requestedAt: Date.now() });
  }
}
export async function getPendingRequests() {
  const snap = await getDocs(collection(db, "access_requests"));
  return snap.docs.map(d => d.data()).filter(r => r.status === "pending");
}
export function onPendingCountChange(callback) {
  return onSnapshot(collection(db, "access_requests"), (snap) => {
    const count = snap.docs.filter(d => d.data().status === "pending").length;
    callback(count);
  });
}
export async function getApprovedUsers() {
  const snap = await getDocs(collection(db, "approved_users"));
  return snap.docs.map(d => d.data());
}

// ── Per-user helpers ───────────────────────────────────────────────────────────
const userDoc    = (uid, docName) => doc(db, "users", uid, "data", docName);
const sharedDoc  = (...path)       => doc(db, "shared", ...path);

// ── Tracker data (shared, all users read, admin-only write) ───────────────────
// Falls back to legacy paths (tracker/rows, tracker/cols) and auto-migrates
export async function loadTrackerData() {
  const [rowsSnap, colsSnap] = await Promise.all([
    getDoc(sharedDoc("tracker_rows")),
    getDoc(sharedDoc("tracker_cols")),
  ]);
  let rows = rowsSnap.exists() ? rowsSnap.data().value : null;
  let cols = colsSnap.exists() ? colsSnap.data().value : null;

  // If shared/ is empty, try the original legacy path tracker/rows & tracker/cols
  if (!rows || !cols) {
    const [legacyRows, legacyCols] = await Promise.all([
      getDoc(doc(db, "tracker", "rows")),
      getDoc(doc(db, "tracker", "cols")),
    ]);
    if (!rows && legacyRows.exists()) {
      rows = legacyRows.data().value;
      // Auto-migrate to new path
      await setDoc(sharedDoc("tracker_rows"), { value: rows });
    }
    if (!cols && legacyCols.exists()) {
      cols = legacyCols.data().value;
      await setDoc(sharedDoc("tracker_cols"), { value: cols });
    }
  }
  return { rows, cols };
}
export async function saveTrackerRows(rows) { await setDoc(sharedDoc("tracker_rows"), { value: rows }); }
export async function saveTrackerCols(cols) { await setDoc(sharedDoc("tracker_cols"), { value: cols }); }

// ── Per-user Tracker Data (each user has their own rows; cols shared) ──────────
export async function loadUserTrackerData(uid) {
  const [rowsSnap, colsSnap] = await Promise.all([
    getDoc(userDoc(uid, "tracker_rows")),
    getDoc(userDoc(uid, "tracker_cols")),
  ]);
  const rows = rowsSnap.exists() ? rowsSnap.data().value : null;
  const cols = colsSnap.exists() ? colsSnap.data().value : null;
  return { rows, cols };
}
export async function saveUserTrackerRows(uid, rows) {
  await setDoc(userDoc(uid, "tracker_rows"), { value: rows });
}
export async function saveUserTrackerCols(uid, cols) {
  await setDoc(userDoc(uid, "tracker_cols"), { value: cols });
}

// ── Purchase costs (shared, all users read, admin-only write) ──────────────────
export async function loadPurchaseCosts() {
  const snap = await getDoc(sharedDoc("purchase_costs"));
  if (snap.exists()) return snap.data();
  // Fallback: try legacy path settings/purchase_costs
  const legacy = await getDoc(doc(db, "settings", "purchase_costs"));
  if (legacy.exists()) {
    await setDoc(sharedDoc("purchase_costs"), legacy.data()); // auto-migrate
    return legacy.data();
  }
  return null;
}
export async function savePurchaseCosts(data) {
  await setDoc(sharedDoc("purchase_costs"), data);
}

// ── Shared reference data (all users read, admin-only write) ──────────────────

// ── Suburb Profiles (shared, admin-only write) ─────────────────────────────────
export async function loadSuburbProfiles() {
  const snap = await getDoc(sharedDoc("suburb_profiles"));
  return snap.exists() ? snap.data().profiles || [] : [];
}
export async function saveSuburbProfiles(profiles) {
  await setDoc(sharedDoc("suburb_profiles"), { profiles });
}

// ── Street PH Profiles (shared, admin-only write) ──────────────────────────────
export async function loadStreetProfiles() {
  const snap = await getDoc(sharedDoc("street_profiles"));
  return snap.exists() ? snap.data().entries || [] : [];
}
export async function saveStreetProfiles(entries) {
  await setDoc(sharedDoc("street_profiles"), { entries });
}

// ── Amenities Config (shared, admin-only write) ────────────────────────────────
export const DEFAULT_AMENITIES = [
  { id: 1, name: "Solar Panels",      score: 8 },
  { id: 2, name: "Shed",              score: 4 },
  { id: 3, name: "Backyard Access",   score: 6 },
  { id: 4, name: "Double Garage",     score: 5 },
  { id: 5, name: "Granny Flat",       score: 10 },
  { id: 6, name: "Swimming Pool",     score: 6 },
  { id: 7, name: "Ducted AC",         score: 7 },
  { id: 8, name: "Renovated Kitchen", score: 6 },
];
export async function loadAmenities() {
  const snap = await getDoc(sharedDoc("amenities_config"));
  return snap.exists() ? (snap.data().items || DEFAULT_AMENITIES) : DEFAULT_AMENITIES;
}
export async function saveAmenities(items) {
  await setDoc(sharedDoc("amenities_config"), { items });
}

// ── DSR Data (shared, admin-only write) ───────────────────────────────────────
export async function loadDsrData() {
  const snap = await getDoc(sharedDoc("dsr_data"));
  return snap.exists() ? snap.data().rows || [] : [];
}
export async function saveDsrData(rows) {
  await setDoc(sharedDoc("dsr_data"), { rows, updatedAt: Date.now() });
}

// ── Per-user Amenities Selections (each user has their own per-property selections) ──
export async function loadUserAmenitiesSelections(uid) {
  const snap = await getDoc(userDoc(uid, "amenities_selections"));
  return snap.exists() ? snap.data().selections || {} : {};
}
export async function saveUserAmenitiesSelections(uid, selections) {
  await setDoc(userDoc(uid, "amenities_selections"), { selections, updatedAt: Date.now() });
}

// ── Per-user Amenities Config (non-admin users store their own list here) ──────
// Falls back to shared admin config if user has no personal config yet
export async function loadUserAmenitiesConfig(uid) {
  const snap = await getDoc(userDoc(uid, "amenities_config"));
  return snap.exists() ? snap.data().items || null : null;
}
export async function saveUserAmenitiesConfig(uid, items) {
  await setDoc(userDoc(uid, "amenities_config"), { items, updatedAt: Date.now() });
}

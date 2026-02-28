import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

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

export const signInWithGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const signOutUser      = () => signOut(auth);

export async function getApprovedUser(email) {
  const snap = await getDoc(doc(db, "approved_users", email));
  return snap.exists() ? snap.data() : null;
}
export async function approveUser(userData) {
  await setDoc(doc(db, "approved_users", userData.email), { ...userData, approvedAt: Date.now() });
  await setDoc(doc(db, "access_requests", userData.email), { ...userData, status: "approved" });
}
export async function revokeUser(email) { await deleteDoc(doc(db, "approved_users", email)); }
export async function denyRequest(email) {
  const snap = await getDoc(doc(db, "access_requests", email));
  if (snap.exists()) await setDoc(doc(db, "access_requests", email), { ...snap.data(), status: "denied" });
}
export async function submitAccessRequest(user) {
  const ref  = doc(db, "access_requests", user.email);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().status === "pending") {
    await setDoc(ref, { email: user.email, name: user.displayName, photo: user.photoURL, status: "pending", requestedAt: Date.now() });
  }
}
export async function getPendingRequests() {
  const snap = await getDocs(collection(db, "access_requests"));
  return snap.docs.map(d => d.data()).filter(r => r.status === "pending");
}
export async function getApprovedUsers() {
  const snap = await getDocs(collection(db, "approved_users"));
  return snap.docs.map(d => d.data());
}

// ── Tracker data ───────────────────────────────────────────────────────────────
export async function loadTrackerData() {
  const [rowsSnap, colsSnap] = await Promise.all([
    getDoc(doc(db, "tracker", "rows")),
    getDoc(doc(db, "tracker", "cols")),
  ]);
  return {
    rows: rowsSnap.exists() ? rowsSnap.data().value : null,
    cols: colsSnap.exists() ? colsSnap.data().value : null,
  };
}
export async function saveTrackerRows(rows) { await setDoc(doc(db, "tracker", "rows"), { value: rows }); }
export async function saveTrackerCols(cols) { await setDoc(doc(db, "tracker", "cols"), { value: cols }); }

// ── Purchase costs ─────────────────────────────────────────────────────────────
export async function loadPurchaseCosts() {
  const snap = await getDoc(doc(db, "settings", "purchase_costs"));
  return snap.exists() ? snap.data() : null;
}
export async function savePurchaseCosts(data) {
  await setDoc(doc(db, "settings", "purchase_costs"), data);
}

// ── Suburb Profiles ────────────────────────────────────────────────────────────
export async function loadSuburbProfiles() {
  const snap = await getDoc(doc(db, "settings", "suburb_profiles"));
  return snap.exists() ? snap.data().profiles || [] : [];
}
export async function saveSuburbProfiles(profiles) {
  await setDoc(doc(db, "settings", "suburb_profiles"), { profiles });
}

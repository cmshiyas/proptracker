import { useState, useEffect } from "react";
import { auth, signOutUser, getApprovedUser, submitAccessRequest } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import AuthScreen    from "./components/AuthScreen.jsx";
import PendingScreen from "./components/PendingScreen.jsx";
import PropertyTracker from "./components/PropertyTracker.jsx";
import PurchaseCosts   from "./components/PurchaseCosts.jsx";

const ADMIN_EMAIL = "cmshiyas007@gmail.com";

function Spinner() {
  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter', sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:"3px solid #e2e8f0", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
        <div style={{ color:"#94a3b8", fontSize:14 }}>Loading…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function App() {
  const [user,   setUser]   = useState(undefined);
  const [access, setAccess] = useState("checking");
  const [page,   setPage]   = useState("dashboard"); // dashboard | purchase-costs

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) { setAccess("checking"); return; }
    if (user.email === ADMIN_EMAIL) { setAccess("approved"); return; }
    getApprovedUser(user.email).then(r => {
      if (r) setAccess("approved");
      else   submitAccessRequest(user).then(() => setAccess("pending"));
    });
  }, [user]);

  if (user === undefined)    return <Spinner />;
  if (!user)                 return <AuthScreen />;
  if (access === "checking") return <Spinner />;
  if (access === "pending")  return <PendingScreen user={user} onSignOut={signOutUser} />;

  if (page === "purchase-costs") return <PurchaseCosts onBack={() => setPage("dashboard")} />;

  return (
    <PropertyTracker
      user={user}
      onSignOut={signOutUser}
      isAdmin={user.email === ADMIN_EMAIL}
      onNavigate={setPage}
    />
  );
}

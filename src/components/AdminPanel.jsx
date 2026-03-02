import { useState, useEffect } from "react";
import { approveUser, denyRequest, revokeUser, updateUserAccessType } from "../firebase.js";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";

const db = getFirestore();

const ACCESS_TYPES = [
  { value: "guest",  label: "Guest",  color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  { value: "admin",  label: "Admin",  color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
];

function AccessBadge({ type }) {
  const t = ACCESS_TYPES.find(a => a.value === type) || ACCESS_TYPES[0];
  return (
    <span style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, padding: "3px 12px", color: t.color, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {t.label}
    </span>
  );
}

export default function AdminPanel({ onClose }) {
  const [tab,      setTab]      = useState("users");
  const [pending,  setPending]  = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [confirmRevoke, setConfirmRevoke] = useState(null);

  useEffect(() => {
    setLoading(true);
    const unsubReqs = onSnapshot(
      collection(db, "access_requests"),
      snap => {
        const all = snap.docs.map(d => d.data());
        setPending(all.filter(r => r.status === "pending"));
        setLoading(false);
      },
      err => { setError("Failed to load requests: " + (err.code || err.message)); setLoading(false); }
    );
    const unsubApproved = onSnapshot(
      collection(db, "approved_users"),
      snap => setApproved(snap.docs.map(d => d.data())),
      err => console.error("approved_users error:", err)
    );
    return () => { unsubReqs(); unsubApproved(); };
  }, []);

  const handleApprove = async (req, accessType = "guest") => {
    await approveUser(req, accessType);
  };
  const handleDeny    = async (req) => { await denyRequest(req.email); };
  const handleRevoke  = async (u)   => {
    await revokeUser(u.email);
    setConfirmRevoke(null);
  };
  const handleChangeType = async (u, newType) => {
    await updateUserAccessType(u.email, newType);
  };

  const tabs = [
    { id: "users",   label: `Users (${approved.length})` },
    { id: "pending", label: `Pending${pending.length > 0 ? ` (${pending.length})` : ""}`, badge: pending.length },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#fff", borderRadius:16, width:"min(680px,95vw)", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:22, color:"#0f172a" }}>Admin Panel</h2>
            <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>{approved.length} active user{approved.length !== 1 ? "s" : ""} · {pending.length} pending</div>
          </div>
          <button onClick={onClose} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, width:34, height:34, color:"#64748b", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 24px", gap:4 }}>
          {tabs.map(({ id, label, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ background:"transparent", border:"none", borderBottom: tab===id ? "2px solid #0ea5e9" : "2px solid transparent", padding:"12px 16px", color: tab===id ? "#0ea5e9" : "#64748b", cursor:"pointer", fontSize:13, fontWeight: tab===id ? 600 : 400, display:"flex", alignItems:"center", gap:6, transition:"color 0.1s" }}>
              {label}
              {badge > 0 && (
                <span style={{ background:"#ef4444", color:"#fff", borderRadius:"50%", width:17, height:17, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY:"auto", flex:1, padding:24 }}>
          {error && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", marginBottom:16, color:"#dc2626", fontSize:13 }}>⚠ {error}</div>}

          {loading ? (
            <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>Loading...</div>

          ) : tab === "users" ? (
            <>
              {/* Legend */}
              <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                {ACCESS_TYPES.map(t => (
                  <div key={t.value} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <AccessBadge type={t.value} />
                    <span style={{ fontSize:11, color:"#94a3b8" }}>{t.value === "guest" ? "Read & edit own data" : "Full admin access"}</span>
                  </div>
                ))}
              </div>

              {approved.length === 0 ? (
                <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>No approved users yet</div>
              ) : (
                approved.map(u => (
                  <div key={u.email} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"14px 18px", marginBottom:10, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                    {u.photo
                      ? <img src={u.photo} alt="" style={{ width:42, height:42, borderRadius:"50%", flexShrink:0, objectFit:"cover" }}/>
                      : <div style={{ width:42, height:42, borderRadius:"50%", background:"#e0f2fe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#0369a1", fontWeight:700, flexShrink:0 }}>{(u.name||u.email||"?")[0].toUpperCase()}</div>
                    }
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:"#0f172a", fontWeight:600, fontSize:14 }}>{u.name || "—"}</div>
                      <div style={{ color:"#64748b", fontSize:12 }}>{u.email}</div>
                      <div style={{ color:"#94a3b8", fontSize:11, marginTop:2 }}>
                        Approved {u.approvedAt ? new Date(u.approvedAt).toLocaleDateString("en-AU", { day:"numeric", month:"short", year:"numeric" }) : "—"}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      {/* Access type selector */}
                      <select
                        value={u.accessType || "guest"}
                        onChange={e => handleChangeType(u, e.target.value)}
                        style={{
                          border: `1px solid ${ACCESS_TYPES.find(a => a.value === (u.accessType||"guest"))?.border || "#bae6fd"}`,
                          background: ACCESS_TYPES.find(a => a.value === (u.accessType||"guest"))?.bg || "#f0f9ff",
                          color: ACCESS_TYPES.find(a => a.value === (u.accessType||"guest"))?.color || "#0369a1",
                          borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", outline:"none",
                        }}>
                        {ACCESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button onClick={() => setConfirmRevoke(u)}
                        style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"5px 12px", color:"#dc2626", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
                        Remove Access
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>

          ) : (
            /* Pending tab */
            pending.length === 0 ? (
              <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>
                <div style={{ fontSize:40, marginBottom:12 }}>✓</div>
                No pending requests
              </div>
            ) : (
              pending.map(req => (
                <div key={req.email} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"14px 18px", marginBottom:10, display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                  {req.photo
                    ? <img src={req.photo} alt="" style={{ width:42, height:42, borderRadius:"50%", flexShrink:0, objectFit:"cover" }}/>
                    : <div style={{ width:42, height:42, borderRadius:"50%", background:"#fef3c7", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, color:"#b45309", fontWeight:700, flexShrink:0 }}>{(req.name||req.email||"?")[0].toUpperCase()}</div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#0f172a", fontWeight:600, fontSize:14 }}>{req.name || "—"}</div>
                    <div style={{ color:"#64748b", fontSize:12 }}>{req.email}</div>
                    <div style={{ color:"#94a3b8", fontSize:11, marginTop:2 }}>Requested {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : ""}</div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                    {/* Approve as Guest or Admin */}
                    <button onClick={() => handleApprove(req, "guest")}
                      style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:6, padding:"6px 14px", color:"#16a34a", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      ✓ Guest
                    </button>
                    <button onClick={() => handleApprove(req, "admin")}
                      style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:6, padding:"6px 14px", color:"#7c3aed", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      ✓ Admin
                    </button>
                    <button onClick={() => handleDeny(req)}
                      style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"6px 14px", color:"#dc2626", cursor:"pointer", fontSize:12 }}>
                      Deny
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* Confirm revoke modal */}
      {confirmRevoke && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:32, width:"min(400px,92vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", textAlign:"center" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🚫</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#0f172a", margin:"0 0 10px" }}>Remove Access?</h3>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 8px" }}>
              <strong>{confirmRevoke.name || confirmRevoke.email}</strong> will lose access immediately.
            </p>
            <p style={{ color:"#94a3b8", fontSize:12, margin:"0 0 24px" }}>Their data will be preserved if access is re-granted later.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setConfirmRevoke(null)}
                style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 22px", color:"#64748b", cursor:"pointer", fontSize:14 }}>
                Cancel
              </button>
              <button onClick={() => handleRevoke(confirmRevoke)}
                style={{ background:"#dc2626", border:"none", borderRadius:8, padding:"10px 22px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                Remove Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

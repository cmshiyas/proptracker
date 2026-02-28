import { useState, useEffect, useCallback } from "react";
import { getPendingRequests, getApprovedUsers, approveUser, denyRequest, revokeUser } from "../firebase.js";

export default function AdminPanel({ onClose }) {
  const [tab,      setTab]      = useState("pending");
  const [pending,  setPending]  = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, a] = await Promise.all([getPendingRequests(), getApprovedUsers()]);
    setPending(p); setApproved(a);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req) => { await approveUser(req); load(); };
  const handleDeny    = async (req) => { await denyRequest(req.email); load(); };
  const handleRevoke  = async (u)   => { await revokeUser(u.email); load(); };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, width:"min(600px,95vw)", maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,0.12)", fontFamily:"'Inter',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <h2 style={{ margin:0, fontFamily:"'Playfair Display', serif", fontSize:22, color:"#0f172a" }}>Admin Panel</h2>
            <div style={{ color:"#94a3b8", fontSize:12, marginTop:2 }}>Manage user access</div>
          </div>
          <button onClick={onClose} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, width:34, height:34, color:"#64748b", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>&#10005;</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid #f1f5f9", padding:"0 24px" }}>
          {[["pending",`Pending (${pending.length})`],["approved",`Approved (${approved.length})`]].map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{ background:"transparent", border:"none", borderBottom:tab===t?"2px solid #0ea5e9":"2px solid transparent", padding:"12px 16px", color:tab===t?"#0ea5e9":"#64748b", cursor:"pointer", fontSize:13, fontWeight:tab===t?600:400 }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ overflowY:"auto", flex:1, padding:24 }}>
          {loading ? (
            <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>Loading...</div>
          ) : tab==="pending" ? (
            pending.length===0
              ? <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>
                  <div style={{ fontSize:40, marginBottom:12 }}>&#10003;</div>
                  No pending requests
                </div>
              : pending.map(req=>(
                <div key={req.email} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"14px 18px", marginBottom:10, display:"flex", alignItems:"center", gap:14 }}>
                  {req.photo && <img src={req.photo} alt="" style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, objectFit:"cover" }}/>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#0f172a", fontWeight:600, fontSize:14 }}>{req.name}</div>
                    <div style={{ color:"#64748b", fontSize:12 }}>{req.email}</div>
                    <div style={{ color:"#94a3b8", fontSize:11, marginTop:2 }}>{new Date(req.requestedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>handleApprove(req)}
                      style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:6, padding:"6px 14px", color:"#16a34a", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      Approve
                    </button>
                    <button onClick={()=>handleDeny(req)}
                      style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"6px 14px", color:"#dc2626", cursor:"pointer", fontSize:12 }}>
                      Deny
                    </button>
                  </div>
                </div>
              ))
          ) : (
            approved.length===0
              ? <div style={{ textAlign:"center", color:"#94a3b8", padding:40 }}>No approved users yet</div>
              : approved.map(u=>(
                <div key={u.email} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:10, padding:"14px 18px", marginBottom:10, display:"flex", alignItems:"center", gap:14 }}>
                  {u.photo && <img src={u.photo} alt="" style={{ width:40, height:40, borderRadius:"50%", flexShrink:0, objectFit:"cover" }}/>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ color:"#0f172a", fontWeight:600, fontSize:14 }}>{u.name}</div>
                    <div style={{ color:"#64748b", fontSize:12 }}>{u.email}</div>
                    <div style={{ color:"#94a3b8", fontSize:11, marginTop:2 }}>Approved {new Date(u.approvedAt).toLocaleString()}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"3px 12px", color:"#16a34a", fontSize:11, fontWeight:600 }}>Active</span>
                    <button onClick={()=>handleRevoke(u)}
                      style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:6, padding:"5px 12px", color:"#94a3b8", cursor:"pointer", fontSize:12 }}>
                      Revoke
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

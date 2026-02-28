const ADMIN_EMAIL = "cmshiyas007@gmail.com";

export default function PendingScreen({ user, onSignOut }) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
      `}</style>
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#fffbeb 0%,#f8fafc 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter', sans-serif", padding:"0 16px" }}>
        <div style={{ width:"100%", maxWidth:440 }}>
          <div style={{ background:"#fff", borderRadius:20, padding:"48px 40px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", border:"1px solid #e2e8f0", textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>&#9203;</div>
            <h2 style={{ fontFamily:"'Playfair Display', serif", fontSize:28, color:"#0f172a", margin:"0 0 8px" }}>Access Pending</h2>
            <p style={{ color:"#64748b", fontSize:14, margin:"0 0 24px" }}>Your request has been submitted for review.</p>

            <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 20px", marginBottom:24, display:"flex", alignItems:"center", gap:14, textAlign:"left" }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width:44, height:44, borderRadius:"50%", objectFit:"cover", flexShrink:0 }}/>}
              <div>
                <div style={{ color:"#0f172a", fontWeight:600, fontSize:15 }}>{user.displayName}</div>
                <div style={{ color:"#64748b", fontSize:13 }}>{user.email}</div>
              </div>
            </div>

            <p style={{ color:"#64748b", fontSize:14, lineHeight:1.8, marginBottom:28 }}>
              The administrator will approve your account shortly.<br/>
              To follow up, contact{" "}
              <a href={`mailto:${ADMIN_EMAIL}`} style={{ color:"#0ea5e9", textDecoration:"none", fontWeight:500 }}>{ADMIN_EMAIL}</a>
            </p>

            <button onClick={onSignOut}
              style={{ background:"transparent", border:"1.5px solid #e2e8f0", borderRadius:10, padding:"10px 28px", color:"#64748b", cursor:"pointer", fontSize:14, fontWeight:500 }}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

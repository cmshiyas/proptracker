import { useState } from "react";
import { signInWithGoogle } from "../firebase.js";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const signIn = async () => {
    setLoading(true); setError(null);
    try { await signInWithGoogle(); }
    catch (e) { setError(e.message || "Sign-in failed. Please try again."); }
    finally   { setLoading(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
      `}</style>
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#f0f9ff 0%,#f8fafc 50%,#f0fdf4 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter', sans-serif", padding:"0 16px" }}>
        <div style={{ width:"100%", maxWidth:420 }}>
          {/* Card */}
          <div style={{ background:"#fff", borderRadius:20, padding:"48px 40px", boxShadow:"0 4px 24px rgba(0,0,0,0.08)", border:"1px solid #e2e8f0", textAlign:"center" }}>
            <div style={{ display:"flex", justifyContent:"center", marginBottom:28 }}>
              <div style={{ width:72, height:72, borderRadius:20, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, boxShadow:"0 8px 24px rgba(14,165,233,0.3)" }}>
                &#127968;
              </div>
            </div>

            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:36, fontWeight:700, color:"#0f172a", margin:"0 0 10px", letterSpacing:-0.5 }}>
              Property Analysis
            </h1>
            <p style={{ color:"#64748b", fontSize:15, margin:"0 0 36px", lineHeight:1.7 }}>
              Property portfolio analysis<br/>for serious investors.
            </p>

            <button onClick={signIn} disabled={loading}
              style={{
                width:"100%", background:"#fff", border:"1.5px solid #e2e8f0",
                borderRadius:12, padding:"14px 24px", cursor:loading?"not-allowed":"pointer",
                fontSize:15, fontWeight:600, color:"#1e293b",
                display:"flex", alignItems:"center", justifyContent:"center", gap:12,
                boxShadow:"0 2px 8px rgba(0,0,0,0.06)", transition:"all 0.2s",
              }}
              onMouseEnter={e=>{ if(!loading){ e.currentTarget.style.borderColor="#0ea5e9"; e.currentTarget.style.boxShadow="0 4px 12px rgba(14,165,233,0.15)"; }}}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor="#e2e8f0"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }}
            >
              {loading ? (
                <>
                  <span style={{ width:18, height:18, border:"2px solid #e2e8f0", borderTopColor:"#0ea5e9", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>
                  Signing in...
                </>
              ) : (
                <><GoogleIcon /> Continue with Google</>
              )}
            </button>

            {error && (
              <div style={{ marginTop:16, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", color:"#dc2626", fontSize:13 }}>
                {error}
              </div>
            )}

            <p style={{ color:"#94a3b8", fontSize:12, marginTop:28, lineHeight:1.8 }}>
              Access is by invitation only.<br/>
              New accounts are reviewed by the administrator.
            </p>
          </div>

          <p style={{ textAlign:"center", color:"#cbd5e1", fontSize:12, marginTop:20 }}>
            Property Analysis &copy; {new Date().getFullYear()}
          </p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
}

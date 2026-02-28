import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { loadSuburbProfiles, saveSuburbProfiles } from "../firebase.js";

const STATES = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];

// ── Suburb card popup via portal ───────────────────────────────────────────────
function SuburbPopup({ suburb, anchorRef, onMouseEnter, onMouseLeave }) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const popW = 380;
    let left = r.left + window.scrollX;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    setPos({ top: r.bottom + window.scrollY + 6, left });
  }, [anchorRef]);

  return createPortal(
    <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{
        position: "absolute", top: pos.top, left: pos.left, zIndex: 99999,
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.15)", padding: 20, width: 380,
        maxHeight: 480, overflowY: "auto", pointerEvents: "all", cursor: "default",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ background: "linear-gradient(135deg,#0ea5e9,#0369a1)", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 11, fontWeight: 700 }}>
          {suburb.state}
        </div>
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          {suburb.suburb}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, whiteSpace: "pre-line" }}>
        {suburb.summary || <em style={{ color: "#94a3b8" }}>No description added.</em>}
      </div>
    </div>,
    document.body
  );
}

// ── Individual suburb card ─────────────────────────────────────────────────────
function SuburbCard({ suburb, onDelete, isAdmin }) {
  const [show,    setShow]   = useState(false);
  const cardRef   = useRef();
  const hideTimer = useRef(null);

  const cancelHide  = () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  const scheduleHide = () => { hideTimer.current = setTimeout(() => setShow(false), 120); };

  return (
    <div ref={cardRef}
      onMouseEnter={() => { cancelHide(); setShow(true); }}
      onMouseLeave={scheduleHide}
      style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
        padding: "12px 14px", cursor: "default", position: "relative",
        transition: "all 0.15s",
        boxShadow: show ? "0 4px 16px rgba(14,165,233,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
        borderColor: show ? "#bae6fd" : "#e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      }}>
      <div style={{ overflow: "hidden" }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {suburb.suburb}
        </div>
        {suburb.summary && (
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {suburb.summary.slice(0, 60)}{suburb.summary.length > 60 ? "\u2026" : ""}
          </div>
        )}
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14, padding: "2px 4px", flexShrink: 0, opacity: show ? 1 : 0, transition: "opacity 0.15s" }}>
        &#10005;
      </button>
      {show && suburb.summary && (
        <SuburbPopup suburb={suburb} anchorRef={cardRef}
          onMouseEnter={cancelHide} onMouseLeave={scheduleHide} />
      )}
    </div>
  );
}

// ── Add Suburb Modal ───────────────────────────────────────────────────────────
function AddSuburbModal({ onAdd, onClose, existingSuburbs }) {
  const [suburb,  setSuburb]  = useState("");
  const [state,   setState]   = useState("NSW");
  const [summary, setSummary] = useState("");
  const [error,   setError]   = useState("");

  const handleAdd = () => {
    const s = suburb.trim();
    if (!s) { setError("Suburb name is required."); return; }
    const dup = existingSuburbs.find(e => e.suburb.toLowerCase() === s.toLowerCase() && e.state === state);
    if (dup) { setError(`${s}, ${state} already exists.`); return; }
    onAdd({ id: Date.now(), suburb: s, state, summary: summary.trim() });
    onClose();
  };

  const inp = { width: "100%", boxSizing: "border-box", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", color: "#1e293b", fontSize: 14, outline: "none", fontFamily: "inherit" };
  const lbl = { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "min(500px,95vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#0f172a" }}>Add Suburb Profile</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 16, marginBottom: 16 }}>
          <div>
            <label style={lbl}>Suburb</label>
            <input value={suburb} onChange={e => { setSuburb(e.target.value); setError(""); }}
              placeholder="e.g. Newtown" style={inp} onKeyDown={e => e.key === "Enter" && handleAdd()} autoFocus />
          </div>
          <div>
            <label style={lbl}>State</label>
            <select value={state} onChange={e => setState(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Suburb Summary</label>
          <textarea value={summary} onChange={e => setSummary(e.target.value)}
            placeholder="Describe the suburb — lifestyle, amenities, investment potential, demographics, growth trends..."
            style={{ ...inp, height: 140, resize: "vertical", lineHeight: 1.7 }} />
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 20px", color: "#64748b", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleAdd}
            style={{ background: "#0ea5e9", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            Add Suburb
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Suburb Profiles Page ──────────────────────────────────────────────────
export default function SuburbProfiles({ onBack, isAdmin }) {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    loadSuburbProfiles().then(p => { setProfiles(p); setLoading(false); });
  }, []);

  const save = async (updated) => {
    setProfiles(updated);
    setSaving(true);
    await saveSuburbProfiles(updated);
    setSaving(false);
  };

  const handleAdd = (entry) => save([...profiles, entry]);
  const handleDelete = (id) => save(profiles.filter(p => p.id !== id));

  // Filter by search
  const filtered = profiles.filter(p =>
    !search || p.suburb.toLowerCase().includes(search.toLowerCase()) ||
    p.state.toLowerCase().includes(search.toLowerCase()) ||
    p.summary.toLowerCase().includes(search.toLowerCase())
  );

  // Group by state — only include states that have entries
  const grouped = STATES.reduce((acc, state) => {
    const items = filtered.filter(p => p.state === state).sort((a, b) => a.suburb.localeCompare(b.suburb));
    if (items.length > 0) acc[state] = items;
    return acc;
  }, {});

  const stateColors = { NSW:"#0ea5e9", VIC:"#8b5cf6", QLD:"#f59e0b", WA:"#10b981", SA:"#f97316", TAS:"#06b6d4", ACT:"#ec4899", NT:"#84cc16" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>

        {/* Navbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 32px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <button onClick={onBack} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", color: "#64748b", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            ← Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#0ea5e9,#0369a1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏘</div>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 18, color: "#0f172a" }}>PropTracker</span>
          </div>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600 }}>Suburb Profiles</span>
          {saving && <span style={{ color: "#94a3b8", fontSize: 11, background: "#f1f5f9", borderRadius: 20, padding: "2px 10px" }}>Saving...</span>}
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Suburb Profiles</h1>
              <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                {profiles.length} suburb{profiles.length !== 1 ? "s" : ""} across {Object.keys(grouped).length} state{Object.keys(grouped).length !== 1 ? "s" : ""}. Hover any card to read the full profile.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* Search */}
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search suburbs..."
                style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#1e293b", outline: "none", width: 200 }} />
              {isAdmin && (
                <button onClick={() => setShowAdd(true)}
                  style={{ background: "#0ea5e9", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 2px 8px rgba(14,165,233,0.3)", whiteSpace: "nowrap" }}>
                  + Add Suburb
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading profiles...</div>
          )}

          {/* Empty state */}
          {!loading && profiles.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 24px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏘</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#0f172a", marginBottom: 8 }}>No suburb profiles yet</div>
              <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add your first suburb to start building your research library.</div>
              {isAdmin && (
                <button onClick={() => setShowAdd(true)}
                  style={{ background: "#0ea5e9", border: "none", borderRadius: 8, padding: "11px 28px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                  + Add First Suburb
                </button>
              )}
            </div>
          )}

          {/* Search no results */}
          {!loading && profiles.length > 0 && Object.keys(grouped).length === 0 && (
            <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 14 }}>
              No suburbs match "{search}"
            </div>
          )}

          {/* State groups */}
          {!loading && Object.entries(grouped).map(([state, suburbs]) => (
            <div key={state} style={{ marginBottom: 36 }}>
              {/* State header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ background: stateColors[state] || "#64748b", borderRadius: 8, padding: "4px 14px", color: "#fff", fontSize: 13, fontWeight: 700 }}>
                  {state}
                </div>
                <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                <span style={{ color: "#94a3b8", fontSize: 12 }}>{suburbs.length} suburb{suburbs.length !== 1 ? "s" : ""}</span>
              </div>

              {/* Suburb cards grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                {suburbs.map(s => (
                  <SuburbCard key={s.id} suburb={s} onDelete={() => handleDelete(s.id)} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddSuburbModal
          onAdd={handleAdd}
          onClose={() => setShowAdd(false)}
          existingSuburbs={profiles}
        />
      )}
    </>
  );
}

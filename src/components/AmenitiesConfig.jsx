import { useState, useEffect } from "react";
import { loadAmenities, saveAmenities } from "../firebase.js";

const DEFAULT_AMENITIES = [
  { id: 1, name: "Solar Panels",    score: 8 },
  { id: 2, name: "Shed",            score: 4 },
  { id: 3, name: "Backyard Access", score: 6 },
  { id: 4, name: "Double Garage",   score: 5 },
  { id: 5, name: "Granny Flat",     score: 10 },
  { id: 6, name: "Swimming Pool",   score: 6 },
  { id: 7, name: "Ducted AC",       score: 7 },
  { id: 8, name: "Renovated Kitchen", score: 6 },
];

function ScoreBar({ score, max = 10 }) {
  const pct = Math.min(100, (score / max) * 100);
  const color = score >= 8 ? "#10b981" : score >= 5 ? "#f59e0b" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
      <div style={{ flex: 1, height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 24, textAlign: "right" }}>{score}</span>
    </div>
  );
}

export default function AmenitiesConfig({ onBack, isAdmin }) {
  const [items,     setItems]   = useState([]);
  const [loading,   setLoading] = useState(true);
  const [saving,    setSaving]  = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null); // null = add new

  useEffect(() => {
    loadAmenities().then(d => {
      setItems(d.length ? d : (isAdmin ? DEFAULT_AMENITIES : []));
      setLoading(false);
    });
  }, [isAdmin]);

  const persist = async (updated) => {
    setItems(updated);
    setSaving(true);
    await saveAmenities(updated);
    setSaving(false);
  };

  const handleSave = (item) => {
    const updated = items.find(i => i.id === item.id)
      ? items.map(i => i.id === item.id ? item : i)
      : [...items, item];
    persist(updated);
  };

  const handleDelete = (id) => persist(items.filter(i => i.id !== id));

  const totalMax = items.reduce((s, i) => s + i.score, 0);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>

        {/* Navbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <button onClick={onBack} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
            ← Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>⭐</div>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: "#0f172a" }}>PropTracker</span>
          </div>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600 }}>Amenities & Scoring</span>
          {saving && <span style={{ color: "#94a3b8", fontSize: 11, background: "#f1f5f9", borderRadius: 20, padding: "2px 10px" }}>Saving...</span>}
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(20px,5vw,28px)", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                Amenities & Scoring
              </h1>
              <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
                {items.length} feature{items.length !== 1 ? "s" : ""} configured · Max possible score: <strong style={{ color: "#0f172a" }}>{totalMax}</strong>
              </p>
            </div>
            {isAdmin && (
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                style={{ background: "#8b5cf6", border: "none", borderRadius: 8, padding: "10px 18px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 2px 8px rgba(139,92,246,0.3)", whiteSpace: "nowrap" }}>
                + Add Feature
              </button>
            )}
          </div>

          {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}

          {!loading && items.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 24px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>⭐</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#0f172a", marginBottom: 8 }}>No features configured yet</div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 24 }}>
                {isAdmin ? "Add amenities like Solar, Shed, Backyard and assign score points to each." : "No amenities have been configured by the admin yet."}
              </div>
              {isAdmin && (
                <button onClick={() => { setEditing(null); setShowModal(true); }}
                  style={{ background: "#8b5cf6", border: "none", borderRadius: 8, padding: "11px 24px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  + Add First Feature
                </button>
              )}
            </div>
          )}

          {!loading && items.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 80px", gap: 0, background: "#f8fafc", borderBottom: "2px solid #e2e8f0", padding: "10px 20px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Feature / Amenity</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Score (out of 10)</span>
                {isAdmin && <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Actions</span>}
              </div>
              {items.map((item, idx) => (
                <div key={item.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 180px 80px", gap: 0,
                  padding: "14px 20px", alignItems: "center",
                  background: idx % 2 === 0 ? "#fff" : "#fafbfc",
                  borderBottom: idx < items.length - 1 ? "1px solid #f1f5f9" : "none",
                  transition: "background 0.1s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.score >= 8 ? "#10b981" : item.score >= 5 ? "#f59e0b" : "#f87171", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>{item.name}</span>
                  </div>
                  <ScoreBar score={item.score} />
                  {isAdmin && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setEditing(item); setShowModal(true); }}
                        style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "4px 10px", color: "#0369a1", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item.id)}
                        style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {/* Total */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 80px", padding: "12px 20px", background: "#f0fdf4", borderTop: "2px solid #bbf7d0" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#14532d" }}>Maximum Total Score</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, height: 6, background: "#bbf7d0", borderRadius: 3 }}>
                    <div style={{ width: "100%", height: "100%", background: "#10b981", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#10b981", minWidth: 24, textAlign: "right" }}>{totalMax}</span>
                </div>
                <div />
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && isAdmin && (
        <FeatureModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
          existingItems={items}
        />
      )}
    </>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────────
function FeatureModal({ initial, onSave, onClose, existingItems }) {
  const [name,  setName]  = useState(initial?.name  || "");
  const [score, setScore] = useState(initial?.score ?? 5);
  const [error, setError] = useState("");
  const isEdit = !!initial;

  const handleSave = () => {
    const n = name.trim();
    if (!n) { setError("Feature name is required."); return; }
    const dup = existingItems.find(i => i.name.toLowerCase() === n.toLowerCase() && i.id !== initial?.id);
    if (dup) { setError(`"${n}" already exists.`); return; }
    if (score < 1 || score > 10) { setError("Score must be between 1 and 10."); return; }
    onSave({ id: initial?.id || Date.now(), name: n, score: Number(score) });
    onClose();
  };

  const inp = { width: "100%", boxSizing: "border-box", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", color: "#1e293b", fontSize: 14, outline: "none", fontFamily: "inherit" };
  const lbl = { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "min(440px,95vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 20, color: "#0f172a" }}>
            {isEdit ? "Edit Feature" : "Add Feature"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={lbl}>Feature / Amenity Name</label>
          <input value={name} onChange={e => { setName(e.target.value); setError(""); }}
            placeholder="e.g. Solar Panels, Shed, Granny Flat..."
            autoFocus style={inp}
            onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={lbl}>Score Points (1–10)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <input type="range" min={1} max={10} step={1} value={score}
              onChange={e => setScore(Number(e.target.value))}
              style={{ flex: 1, accentColor: "#8b5cf6", cursor: "pointer" }} />
            <div style={{
              width: 48, height: 48, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              background: score >= 8 ? "#dcfce7" : score >= 5 ? "#fef3c7" : "#fee2e2",
              color: score >= 8 ? "#14532d" : score >= 5 ? "#92400e" : "#991b1b",
              fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display',serif",
            }}>
              {score}
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <span key={n} style={{ fontSize: 10, color: n === score ? "#8b5cf6" : "#cbd5e1", fontWeight: n === score ? 700 : 400 }}>{n}</span>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ background: "transparent", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 20px", color: "#64748b", cursor: "pointer", fontSize: 14 }}>
            Cancel
          </button>
          <button onClick={handleSave}
            style={{ background: "#8b5cf6", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {isEdit ? "Save Changes" : "Add Feature"}
          </button>
        </div>
      </div>
    </div>
  );
}

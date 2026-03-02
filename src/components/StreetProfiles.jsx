import { useState, useEffect, useRef } from "react"; // useRef still used for search input
import { loadStreetProfiles, saveStreetProfiles } from "../firebase.js";

const PH_COLOURS = ["Black", "Pink", "Amber", "Green"];

const COLOUR_STYLES = {
  Black: { bg: "#1e293b", text: "#fff",    border: "#0f172a" },
  Pink:  { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  Amber: { bg: "#fef3c7", text: "#92400e", border: "#fbbf24" },
  Green: { bg: "#dcfce7", text: "#14532d", border: "#4ade80" },
};

function PhTag({ colour, small }) {
  const s = COLOUR_STYLES[colour] || { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
  return (
    <span style={{
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: small ? "2px 8px" : "3px 10px",
      fontSize: small ? 10 : 12, fontWeight: 700, whiteSpace: "nowrap",
      display: "inline-block",
    }}>
      {colour}
    </span>
  );
}

// ── Street card ────────────────────────────────────────────────────────────────
function StreetCard({ entry, onDelete, onEdit, searchTerm, isAdmin }) {
  const [hovered, setHovered] = useState(false);

  const highlight = (text) => {
    if (!searchTerm || !text) return text;
    const idx = text.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (idx === -1) return text;
    return <>
      {text.slice(0, idx)}
      <mark style={{ background: "#fef08a", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + searchTerm.length)}
      </mark>
      {text.slice(idx + searchTerm.length)}
    </>;
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
        padding: "12px 14px", cursor: "default",
        transition: "all 0.15s",
        boxShadow: hovered ? "0 4px 16px rgba(245,158,11,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
        borderColor: hovered ? "#fde68a" : "#e2e8f0",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
      {/* Street name + admin actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", flex: 1 }}>
          {highlight(entry.street)}
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 4, opacity: hovered ? 1 : 0, transition: "opacity 0.15s", flexShrink: 0 }}>
            <button onClick={e => { e.stopPropagation(); onEdit(entry); }}
              style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "2px 8px", color: "#0369a1", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
              Edit
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(entry.id); }}
              style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}>
              ✕
            </button>
          </div>
        )}
      </div>
      {/* PH colour tags — always visible */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {entry.ph_profile.map(c => <PhTag key={c} colour={c} small />)}
      </div>
    </div>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose, existingEntries }) {
  const [street,   setStreet]   = useState(initial?.street     || "");
  const [selected, setSelected] = useState(initial?.ph_profile || []);
  const [error,    setError]    = useState("");
  const isEdit = !!initial;

  const toggle = (colour) => {
    setSelected(prev =>
      prev.includes(colour) ? prev.filter(c => c !== colour) : [...prev, colour]
    );
  };

  const handleSave = () => {
    const s = street.trim();
    if (!s) { setError("Street name is required."); return; }
    if (selected.length === 0) { setError("Select at least one PH profile colour."); return; }
    const dup = existingEntries.find(e =>
      e.street.toLowerCase() === s.toLowerCase() && e.id !== initial?.id
    );
    if (dup) { setError(`"${s}" already exists.`); return; }
    onSave({ id: initial?.id || Date.now(), street: s, ph_profile: selected });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "min(460px,95vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 21, color: "#0f172a" }}>
            {isEdit ? "Edit Street Profile" : "Add Street Profile"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>

        {/* Street name */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>
            Street Name
          </label>
          <input value={street} onChange={e => { setStreet(e.target.value); setError(""); }}
            placeholder="e.g. 24 Elm Street, Newtown NSW"
            autoFocus
            style={{ width: "100%", boxSizing: "border-box", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", color: "#1e293b", fontSize: 14, outline: "none", fontFamily: "inherit" }}
            onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>

        {/* PH Profile colour picker */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 }}>
            PH Profile — select one or more
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PH_COLOURS.map(colour => {
              const s   = COLOUR_STYLES[colour];
              const sel = selected.includes(colour);
              return (
                <button key={colour} onClick={() => toggle(colour)}
                  style={{
                    background:  sel ? s.bg   : "#f8fafc",
                    color:       sel ? s.text : "#64748b",
                    border:      sel ? `2px solid ${s.border}` : "2px solid #e2e8f0",
                    borderRadius: 20, padding: "6px 16px", cursor: "pointer",
                    fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                    transform: sel ? "scale(1.05)" : "scale(1)",
                    boxShadow: sel ? `0 2px 8px ${s.border}66` : "none",
                  }}>
                  {colour}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Selected:</span>
              {selected.map(c => <PhTag key={c} colour={c} />)}
            </div>
          )}
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
            style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "10px 24px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            {isEdit ? "Save Changes" : "Add Street"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StreetProfiles({ onBack, isAdmin }) {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState(null);
  const [search,    setSearch]    = useState("");
  const [filterColour, setFilterColour] = useState(null);
  const searchRef = useRef();

  useEffect(() => {
    loadStreetProfiles().then(d => { setEntries(d); setLoading(false); });
  }, []);

  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const persist = async (updated) => {
    setEntries(updated);
    setSaving(true);
    await saveStreetProfiles(updated);
    setSaving(false);
  };

  const handleSave = (entry) => {
    const updated = entries.find(e => e.id === entry.id)
      ? entries.map(e => e.id === entry.id ? entry : e)
      : [...entries, entry];
    persist(updated);
  };

  const q = search.trim().toLowerCase();
  const filtered = entries
    .filter(e => !q || e.street.toLowerCase().includes(q) || e.ph_profile.some(c => c.toLowerCase().includes(q)))
    .filter(e => !filterColour || e.ph_profile.includes(filterColour))
    .sort((a, b) => a.street.localeCompare(b.street));

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
      `}</style>
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Inter',sans-serif" }}>

        {/* Navbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <button onClick={onBack} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 14px", color: "#64748b", cursor: "pointer", fontSize: 13 }}>
            ← Dashboard
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#d97706)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏚</div>
            <span style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 18, color: "#0f172a" }}>Property Analysis</span>
          </div>
          <span style={{ color: "#94a3b8" }}>/</span>
          <span style={{ color: "#0f172a", fontSize: 14, fontWeight: 600 }}>Street PH Profiles</span>
          {saving && <span style={{ color: "#94a3b8", fontSize: 11, background: "#f1f5f9", borderRadius: 20, padding: "2px 10px" }}>Saving...</span>}
        </div>

        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: "clamp(20px,5vw,28px)", fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>Street PH Profiles</h1>
              <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>
                Shared across all users · {entries.length} street{entries.length !== 1 ? "s" : ""} recorded
              </p>
            </div>
            {isAdmin && (
              <button onClick={() => { setEditing(null); setShowModal(true); }}
                style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, boxShadow: "0 2px 8px rgba(245,158,11,0.3)", whiteSpace: "nowrap" }}>
                + Add Street
              </button>
            )}
          </div>

          {/* Search + colour filter */}
          <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>🔍</span>
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search streets...  (⌘F)"
                style={{ width: "100%", padding: "10px 36px 10px 36px", fontSize: 14, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, color: "#1e293b", outline: "none", boxSizing: "border-box" }} />
              {search && (
                <button onClick={() => setSearch("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14 }}>✕</button>
              )}
            </div>
            {/* Colour filter pills */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {PH_COLOURS.map(colour => {
                const s   = COLOUR_STYLES[colour];
                const sel = filterColour === colour;
                const count = entries.filter(e => e.ph_profile.includes(colour)).length;
                if (count === 0) return null;
                return (
                  <button key={colour} onClick={() => setFilterColour(sel ? null : colour)}
                    style={{
                      background: sel ? s.bg : "#f8fafc", color: sel ? s.text : "#64748b",
                      border: sel ? `2px solid ${s.border}` : "2px solid #e2e8f0",
                      borderRadius: 20, padding: "5px 12px", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, transition: "all 0.15s",
                    }}>
                    {colour} <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results info */}
          {!loading && (q || filterColour) && filtered.length > 0 && (
            <div style={{ marginBottom: 14, color: "#64748b", fontSize: 13 }}>
              Showing <strong style={{ color: "#0f172a" }}>{filtered.length}</strong> of {entries.length} streets
              {filterColour && <> · filtered by <PhTag colour={filterColour} small /></>}
            </div>
          )}

          {loading && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading...</div>}

          {!loading && entries.length === 0 && (
            <div style={{ textAlign: "center", padding: "72px 24px", background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏚</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#0f172a", marginBottom: 8 }}>No street profiles yet</div>
              <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>Add streets and tag them with PH profile colours.</div>
              {isAdmin && (
                <button onClick={() => { setEditing(null); setShowModal(true); }}
                  style={{ background: "#f59e0b", border: "none", borderRadius: 8, padding: "11px 28px", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                  + Add First Street
                </button>
              )}
            </div>
          )}

          {!loading && entries.length > 0 && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 24px", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 15, marginBottom: 4 }}>No results found</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Try a different search or remove the colour filter.</div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {filtered.map(entry => (
                <StreetCard key={entry.id} entry={entry}
                  onDelete={id => persist(entries.filter(e => e.id !== id))}
                  onEdit={e => { setEditing(e); setShowModal(true); }}
                  searchTerm={q} isAdmin={isAdmin} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && isAdmin && (
        <EntryModal initial={editing} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
          existingEntries={entries} />
      )}
    </>
  );
}

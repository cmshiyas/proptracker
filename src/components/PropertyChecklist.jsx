import { useState, useEffect } from "react";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const db = getFirestore();

const SECTIONS = [
  {
    id: "safety",
    label: "Safety",
    icon: "🛡",
    color: "#dc2626",
    bg: "#fef2f2",
    border: "#fecaca",
    items: [
      { id: "s1",  text: "Is there asbestos in any of the buildings or elsewhere on the property e.g. sheds and fences?" },
      { id: "s2",  text: "Does the property have any significant defects e.g. cracking or salt damp?" },
      { id: "s3",  text: "Have the wet areas been waterproofed?" },
      { id: "s4",  text: "Is the property in a bushfire prone area?" },
      { id: "s5",  text: "Are the electrical wiring, gas installation, plumbing and appliances in good working order and in good condition?" },
      { id: "s6",  text: "Is a safety switch (RCD) installed? Is it working?" },
      { id: "s7",  text: "Are there any prohibited gas appliances in bedrooms or bathrooms?" },
      { id: "s8",  text: "Are smoke alarms installed in the house? If so, are they hardwired? Are they in good working order and in good condition? Are they compliant?" },
      { id: "s9",  text: "Is there a swimming pool and/or spa pool installed on the property? Are there any safety barriers or fences in place? Do they conform to current standards?" },
      { id: "s10", text: "Does the property have any termite or other pest infestations? Is there a current preventive termite treatment program in place? Was the property treated at some stage with persistent organochlorins (now banned) or other toxic termiticides?" },
      { id: "s11", text: "Has fill been used on the site? Is the soil contaminated by chemical residues or waste?" },
      { id: "s12", text: "Does the property use cooling towers or manufactured warm water systems? If so, what are the maintenance requirements?" },
    ],
  },
  {
    id: "enjoyment",
    label: "Enjoyment",
    icon: "🏡",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
    items: [
      { id: "e1",  text: "Does the property have any stormwater problems?" },
      { id: "e2",  text: "Is the property in a flood prone area? Is the property prone to coastal flooding?" },
      { id: "e3",  text: "Does the property have an on-site wastewater treatment facility such as a septic tank installed? If so, what are the maintenance requirements? Is it compliant?" },
      { id: "e4",  text: "Is a sewer mains connection available?" },
      { id: "e5",  text: "Are all gutters, downpipes and stormwater systems in good working order and in good condition?" },
      { id: "e6",  text: "Is the property near power lines? Are there any trees on the property near power lines? Are you considering planting any trees? Do all structures and trees maintain the required clearance from any power lines?" },
      { id: "e7",  text: "Are there any significant trees on the property?" },
      { id: "e8",  text: "Is this property a unit on strata or community title? What could this mean for you? Do you understand the restrictions of use and the financial obligations of ownership? Will you have to pay a previous owner's debt or the cost of planned improvements?" },
      { id: "e9",  text: "Is the property close to a hotel, restaurant or other venue with entertainment consent for live music? Is the property close to any industrial or commercial activity, a busy road or airport etc that may result in noise or emission of materials or odours?" },
      { id: "e10", text: "What appliances, equipment and fittings are included in the sale of the property?" },
      { id: "e11", text: "Is there sufficient car parking space available to the property?" },
    ],
  },
  {
    id: "value",
    label: "Value",
    icon: "💰",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    items: [
      { id: "v1",  text: "Are there any illegal or unapproved additions, extensions or alterations to the buildings on the property?" },
      { id: "v2",  text: "How energy efficient is the home, including appliances and lighting? What energy sources (e.g. electricity, gas) are available?" },
      { id: "v3",  text: "Is the property connected to SA Water operated and maintained mains water? Is a mains water connection available?" },
      { id: "v4",  text: "Does the property have a recycled water connection?" },
      { id: "v5",  text: "What sort of water meter is located on the property (a direct or indirect meter — an indirect meter can be located some distance from the property)?" },
      { id: "v6",  text: "Is the property connected to a water meter that is also serving another property?" },
      { id: "v7",  text: "Are there water taps outside the building? Is there a watering system installed? Are they in good working order and in good condition?" },
      { id: "v8",  text: "Does the property have alternative sources of water other than mains water supply (including bore or rainwater)? If so, are there any special maintenance requirements?" },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap(s => s.items.map(i => ({ ...i, sectionId: s.id })));
const TOTAL = ALL_ITEMS.length;

const STATUS_OPTIONS = [
  { value: "",       label: "Not checked",    dot: "#cbd5e1", bg: "transparent",  text: "#94a3b8" },
  { value: "yes",    label: "Yes / OK",        dot: "#22c55e", bg: "#f0fdf4",      text: "#15803d" },
  { value: "no",     label: "No / Issue",      dot: "#ef4444", bg: "#fef2f2",      text: "#dc2626" },
  { value: "na",     label: "N/A",             dot: "#94a3b8", bg: "#f8fafc",      text: "#64748b" },
  { value: "review", label: "Needs Review",    dot: "#f59e0b", bg: "#fffbeb",      text: "#b45309" },
];

function statusStyle(val) {
  return STATUS_OPTIONS.find(o => o.value === val) || STATUS_OPTIONS[0];
}

export default function PropertyChecklist({ onBack, user }) {
  const uid = user?.uid || "";
  const [checks,  setChecks]  = useState({});   // { itemId: { status, note } }
  const [notes,   setNotes]   = useState({});   // draft note text per item
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [expanded, setExpanded] = useState({ safety: true, enjoyment: true, value: true });
  const [noteOpen, setNoteOpen] = useState({});  // { itemId: bool }

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "users", uid, "data", "checklist"))
      .then(snap => {
        if (snap.exists()) setChecks(snap.data().checks || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [uid]);

  const save = async (updated) => {
    if (!uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", uid, "data", "checklist"), { checks: updated, updatedAt: Date.now() });
    } catch(e) { console.error("checklist save error:", e); }
    setSaving(false);
  };

  const setStatus = (itemId, status) => {
    const updated = { ...checks, [itemId]: { ...(checks[itemId] || {}), status } };
    setChecks(updated);
    save(updated);
  };

  const saveNote = (itemId) => {
    const note = (notes[itemId] ?? checks[itemId]?.note ?? "").trim();
    const updated = { ...checks, [itemId]: { ...(checks[itemId] || {}), note } };
    setChecks(updated);
    setNoteOpen(p => ({ ...p, [itemId]: false }));
    save(updated);
  };

  // Progress
  const checked  = Object.values(checks).filter(c => c.status && c.status !== "").length;
  const issues   = Object.values(checks).filter(c => c.status === "no").length;
  const reviews  = Object.values(checks).filter(c => c.status === "review").length;
  const pct      = TOTAL > 0 ? Math.round((checked / TOTAL) * 100) : 0;

  const sectionProgress = (sectionId) => {
    const items = SECTIONS.find(s => s.id === sectionId)?.items || [];
    const done  = items.filter(i => checks[i.id]?.status).length;
    return { done, total: items.length };
  };

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        .cl-item:hover { background: #f8fafc !important; }
        .status-btn { transition: all 0.15s; }
        .status-btn:hover { filter: brightness(0.95); transform: scale(1.02); }
        .section-toggle { transition: transform 0.2s; }
      `}</style>

      {/* Navbar */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"0 24px", height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={onBack} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", color:"#64748b", cursor:"pointer", fontSize:12, fontWeight:500 }}>
            ← Back
          </button>
          <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:17, color:"#0f172a" }}>Property Analysis</span>
          <span style={{ color:"#cbd5e1", fontSize:14 }}>›</span>
          <span style={{ fontSize:13, color:"#64748b", fontWeight:500 }}>✅ Property Checklist</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {saving && <span style={{ fontSize:11, color:"#94a3b8" }}>Saving…</span>}
          <span style={{ fontSize:12, fontWeight:600, color: pct === 100 ? "#15803d" : "#64748b" }}>{pct}% complete</span>
        </div>
      </div>

      <div style={{ maxWidth:860, margin:"0 auto", padding:"28px 20px 60px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"#0f172a", margin:"0 0 6px" }}>Property Checklist</h1>
          <p style={{ color:"#64748b", fontSize:14, margin:0 }}>Track your due diligence across Safety, Enjoyment and Value. Each item can be marked Yes/OK, No/Issue, Needs Review, or N/A.</p>
        </div>

        {/* Progress Bar */}
        <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:"18px 22px", marginBottom:24, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>Overall Progress</span>
            <span style={{ fontSize:13, color:"#64748b" }}>{checked} of {TOTAL} items checked</span>
          </div>
          <div style={{ height:8, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
            <div style={{ width:`${pct}%`, height:"100%", background: pct===100?"#22c55e":"#0ea5e9", borderRadius:4, transition:"width 0.5s ease" }}/>
          </div>
          <div style={{ display:"flex", gap:20, marginTop:12, flexWrap:"wrap" }}>
            {[
              { label:"Checked",      value:checked, color:"#0ea5e9" },
              { label:"Issues Found", value:issues,  color:"#dc2626" },
              { label:"Needs Review", value:reviews, color:"#f59e0b" },
              { label:"Remaining",    value:TOTAL-checked, color:"#94a3b8" },
            ].map(s => (
              <div key={s.label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:s.color }}/>
                <span style={{ fontSize:12, color:"#64748b" }}>{s.label}:</span>
                <span style={{ fontSize:12, fontWeight:700, color:s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#94a3b8" }}>Loading…</div>
        ) : SECTIONS.map(section => {
          const { done, total } = sectionProgress(section.id);
          const isOpen = expanded[section.id] !== false;
          return (
            <div key={section.id} style={{ marginBottom:20 }}>
              {/* Section Header */}
              <button
                onClick={() => setExpanded(p => ({ ...p, [section.id]: !isOpen }))}
                style={{ width:"100%", background:section.bg, border:`1px solid ${section.border}`, borderRadius: isOpen ? "12px 12px 0 0" : 12, padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", textAlign:"left" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:20 }}>{section.icon}</span>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:section.color }}>{section.label}</span>
                  <span style={{ background:"#fff", border:`1px solid ${section.border}`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, color:section.color }}>{done}/{total}</span>
                </div>
                <span className="section-toggle" style={{ color:section.color, fontSize:16, transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
              </button>

              {/* Items */}
              {isOpen && (
                <div style={{ border:`1px solid ${section.border}`, borderTop:"none", borderRadius:"0 0 12px 12px", overflow:"hidden", background:"#fff" }}>
                  {section.items.map((item, idx) => {
                    const check   = checks[item.id] || {};
                    const st      = statusStyle(check.status);
                    const hasNote = check.note && check.note.trim();
                    const isNoteOpen = noteOpen[item.id];

                    return (
                      <div key={item.id} className="cl-item"
                        style={{ borderBottom: idx < section.items.length-1 ? `1px solid #f1f5f9` : "none", padding:"14px 20px", background:"#fff" }}>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                          {/* Status dot */}
                          <div style={{ width:10, height:10, borderRadius:"50%", background:st.dot, flexShrink:0, marginTop:5 }}/>

                          {/* Text */}
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ margin:"0 0 10px", fontSize:13, color:"#374151", lineHeight:1.6 }}>{item.text}</p>

                            {/* Status buttons */}
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
                              {STATUS_OPTIONS.filter(o => o.value !== "").map(opt => (
                                <button key={opt.value} className="status-btn"
                                  onClick={() => setStatus(item.id, check.status === opt.value ? "" : opt.value)}
                                  style={{
                                    border:`1px solid ${check.status===opt.value ? opt.dot : "#e2e8f0"}`,
                                    background: check.status===opt.value ? opt.bg : "#f8fafc",
                                    color: check.status===opt.value ? opt.text : "#94a3b8",
                                    borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:600,
                                    cursor:"pointer", display:"flex", alignItems:"center", gap:5,
                                  }}>
                                  <div style={{ width:6, height:6, borderRadius:"50%", background: check.status===opt.value ? opt.dot : "#cbd5e1" }}/>
                                  {opt.label}
                                </button>
                              ))}

                              {/* Note toggle */}
                              <button onClick={() => {
                                setNoteOpen(p => ({ ...p, [item.id]: !isNoteOpen }));
                                if (!noteOpen[item.id]) setNotes(p => ({ ...p, [item.id]: check.note || "" }));
                              }} style={{ border:"1px solid #e2e8f0", background:"#f8fafc", color: hasNote?"#0369a1":"#94a3b8", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                                {hasNote ? "📝 View Note" : "＋ Note"}
                              </button>
                            </div>

                            {/* Note editor */}
                            {isNoteOpen && (
                              <div style={{ marginTop:10, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:12 }}>
                                <textarea
                                  value={notes[item.id] ?? check.note ?? ""}
                                  onChange={e => setNotes(p => ({ ...p, [item.id]: e.target.value }))}
                                  placeholder="Add a note about this item…"
                                  rows={3}
                                  style={{ width:"100%", border:"none", background:"transparent", outline:"none", fontSize:12, color:"#374151", resize:"vertical", fontFamily:"'Inter',sans-serif", lineHeight:1.5 }}
                                />
                                <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:8 }}>
                                  <button onClick={() => setNoteOpen(p => ({ ...p, [item.id]: false }))}
                                    style={{ border:"1px solid #e2e8f0", background:"transparent", borderRadius:6, padding:"4px 12px", fontSize:11, color:"#64748b", cursor:"pointer" }}>Cancel</button>
                                  <button onClick={() => saveNote(item.id)}
                                    style={{ border:"none", background:"#0ea5e9", borderRadius:6, padding:"4px 12px", fontSize:11, color:"#fff", fontWeight:600, cursor:"pointer" }}>Save Note</button>
                                </div>
                              </div>
                            )}

                            {/* Saved note display */}
                            {!isNoteOpen && hasNote && (
                              <div style={{ marginTop:8, background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"6px 10px", fontSize:12, color:"#1d4ed8", lineHeight:1.5 }}>
                                📝 {check.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

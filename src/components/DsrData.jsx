import { useState, useEffect, useRef, useMemo } from "react";
import { loadDsrData, saveDsrData } from "../firebase.js";

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseNum = (v = "") => parseFloat(String(v).replace(/[^0-9.\-]/g, "")) || 0;
const fmtPct   = (v = "") => v.includes("%") ? v : v + "%";

const DSR_COLS = [
  { key:"State",                    label:"State",         w:70,  type:"text"    },
  { key:"Post Code",                label:"Postcode",      w:90,  type:"text"    },
  { key:"Suburb",                   label:"Suburb",        w:160, type:"text"    },
  { key:"Demand to Supply Ratio",   label:"DSR",           w:70,  type:"num",  hi:"high" },
  { key:"Demand to Supply Ratio+",  label:"DSR+",          w:70,  type:"num",  hi:"high" },
  { key:"Typical value",            label:"Typical Value", w:120, type:"currency"},
  { key:"Median 12 months",         label:"Median 12m",    w:120, type:"currency"},
  { key:"Long term growth",         label:"LT Growth",     w:100, type:"pct",  hi:"high" },
  { key:"Gross rental yield",       label:"Yield",         w:90,  type:"pct",  hi:"high" },
  { key:"Days on market",           label:"Days on Mkt",   w:100, type:"text"   },
  { key:"Market cycle timing",      label:"Mkt Cycle",     w:90,  type:"num"    },
  { key:"Avg vendor discount",      label:"Vendor Disc",   w:105, type:"pct",  hi:"low"  },
  { key:"Auction clearance rate",   label:"Auction %",     w:95,  type:"pct"    },
  { key:"Percent stock on market",  label:"Stock %",       w:90,  type:"pct",  hi:"low"  },
  { key:"Vacancy rate",             label:"Vacancy",       w:90,  type:"pct",  hi:"low"  },
  { key:"Percent renters in market",label:"Renters %",     w:95,  type:"pct"    },
  { key:"Percentage rent growth",   label:"Rent Growth",   w:105, type:"pct",  hi:"high" },
  { key:"Percentage sales growth",  label:"Sales Growth",  w:110, type:"pct",  hi:"high" },
  { key:"Online search interest",   label:"Search Int.",   w:95,  type:"num",  hi:"high" },
  { key:"Ripple effect potential",  label:"Ripple",        w:100, type:"pct",  hi:"high" },
  { key:"Neighbour price balancing",label:"Nbr Balance",   w:110, type:"text"   },
];

const STATES = ["ACT","NSW","NT","QLD","SA","TAS","VIC","WA"];

function parseCSV(text) {
  const lines  = text.trim().split("\n");
  const header = lines[0].split(",").map(h => h.replace(/"/g,"").trim());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    return Object.fromEntries(header.map((h, i) => [h, vals[i] || ""]));
  });
}

function cellColour(col, value) {
  if (!col.hi) return null;
  const n = parseNum(value);
  if (col.hi === "high") {
    if (n >= 7 || (col.type === "num" && n >= 60)) return { bg:"#f0fdf4", text:"#15803d" };
    if (n >= 4 || (col.type === "num" && n >= 50)) return { bg:"#fefce8", text:"#a16207" };
    return { bg:"#fef2f2", text:"#b91c1c" };
  }
  if (col.hi === "low") {
    if (n <= 1) return { bg:"#f0fdf4", text:"#15803d" };
    if (n <= 3) return { bg:"#fefce8", text:"#a16207" };
    return { bg:"#fef2f2", text:"#b91c1c" };
  }
  return null;
}

function Badge({ value, col }) {
  const c = cellColour(col, value);
  if (!c) return <span style={{ fontSize:12, color:"#374151" }}>{value}</span>;
  return (
    <span style={{ background:c.bg, color:c.text, borderRadius:6, padding:"2px 7px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {value}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DsrData({ onBack, isAdmin }) {
  const [rows,       setRows]     = useState([]);
  const [loading,    setLoading]  = useState(true);
  const [saving,     setSaving]   = useState(false);
  const [uploadMsg,  setUploadMsg]= useState("");

  // Filters
  const [search,    setSearch]   = useState("");
  const [stateF,    setStateF]   = useState([]);
  const [dsrMin,    setDsrMin]   = useState("");
  const [dsrMax,    setDsrMax]   = useState("");
  const [yieldMin,  setYieldMin] = useState("");
  const [growthMin, setGrowthMin]= useState("");

  // Sort
  const [sortKey,  setSortKey]  = useState("Demand to Supply Ratio");
  const [sortDir,  setSortDir]  = useState("desc");

  const fileRef = useRef();

  useEffect(() => {
    loadDsrData().then(d => { setRows(d); setLoading(false); });
  }, []);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── CSV Upload ──────────────────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (!parsed[0]?.["Demand to Supply Ratio"]) {
          setUploadMsg("❌ Invalid CSV — expected DSR columns."); return;
        }
        setSaving(true);
        setUploadMsg("Saving…");
        await saveDsrData(parsed);
        setRows(parsed);
        setSaving(false);
        setUploadMsg(`✅ ${parsed.length} rows loaded`);
        setTimeout(() => setUploadMsg(""), 4000);
      } catch {
        setUploadMsg("❌ Failed to parse CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDelete = async () => {
    setSaving(true);
    await saveDsrData([]);
    setRows([]);
    setSaving(false);
    setConfirmDelete(false);
    setUploadMsg("🗑 Data cleared");
    setTimeout(() => setUploadMsg(""), 3000);
  };

  // ── Filter + Sort ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = rows;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r =>
        r.Suburb?.toLowerCase().includes(q) ||
        r["Post Code"]?.includes(q) ||
        r.State?.toLowerCase().includes(q)
      );
    }
    if (stateF.length) out = out.filter(r => stateF.includes(r.State));
    if (dsrMin)    out = out.filter(r => parseNum(r["Demand to Supply Ratio"]) >= Number(dsrMin));
    if (dsrMax)    out = out.filter(r => parseNum(r["Demand to Supply Ratio"]) <= Number(dsrMax));
    if (yieldMin)  out = out.filter(r => parseNum(r["Gross rental yield"])     >= Number(yieldMin));
    if (growthMin) out = out.filter(r => parseNum(r["Long term growth"])       >= Number(growthMin));
    // sort
    out = [...out].sort((a, b) => {
      const av = parseNum(a[sortKey]), bv = parseNum(b[sortKey]);
      if (av === bv) return (a.Suburb||"").localeCompare(b.Suburb||"");
      return sortDir === "desc" ? bv - av : av - bv;
    });
    return out;
  }, [rows, search, stateF, dsrMin, dsrMax, yieldMin, growthMin, sortKey, sortDir]);

  const toggleState = s => setStateF(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s]);
  const toggleSort  = key => {
    if (sortKey === key) setSortDir(d => d==="desc"?"asc":"desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const clearFilters = () => {
    setSearch(""); setStateF([]); setDsrMin(""); setDsrMax(""); setYieldMin(""); setGrowthMin("");
  };

  const hasFilters = search || stateF.length || dsrMin || dsrMax || yieldMin || growthMin;
  const totalWidth = DSR_COLS.reduce((s,c) => s+c.w, 0) + 20;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#f8fafc}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        .dsr-row:hover > div { background:#f0f9ff !important; }
        .sort-th:hover { background:#e0f2fe !important; cursor:pointer; }
        @media(max-width:640px){
          .dsr-filters{flex-direction:column!important;}
          .dsr-filter-row{flex-wrap:wrap!important;}
        }
      `}</style>
      <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter',sans-serif" }}>

        {/* Navbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"10px 16px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
          <button onClick={onBack} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 14px", color:"#64748b", cursor:"pointer", fontSize:13, flexShrink:0 }}>
            ← Dashboard
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>📊</div>
            <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:17, color:"#0f172a" }}>Property Analysis</span>
            <span style={{ color:"#94a3b8" }}>/</span>
            <span style={{ color:"#0f172a", fontSize:14, fontWeight:600 }}>DSR Data</span>
            {saving && <span style={{ color:"#94a3b8", fontSize:11, background:"#f1f5f9", borderRadius:20, padding:"2px 10px" }}>Saving…</span>}
            {uploadMsg && <span style={{ fontSize:12, color: uploadMsg.startsWith("✅") ? "#15803d" : "#b91c1c", fontWeight:600 }}>{uploadMsg}</span>}
          </div>
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={handleFile} />
              <button onClick={() => fileRef.current?.click()}
                style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"8px 16px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap", boxShadow:"0 2px 6px rgba(14,165,233,0.3)" }}>
                ⬆ Upload CSV
              </button>
              {rows.length > 0 && (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"8px 14px", color:"#dc2626", cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" }}>
                  🗑 Delete Data
                </button>
              )}
            </>
          )}
        </div>

        {/* Confirm delete modal */}
        {confirmDelete && (
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
            <div style={{ background:"#fff", borderRadius:16, padding:32, width:"min(400px,92vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.15)", textAlign:"center" }}>
              <div style={{ fontSize:44, marginBottom:12 }}>🗑</div>
              <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:"#0f172a", margin:"0 0 10px" }}>Delete all DSR data?</h3>
              <p style={{ color:"#64748b", fontSize:13, margin:"0 0 24px", lineHeight:1.6 }}>
                This will permanently remove all <strong>{rows.length} rows</strong> from the database. You can re-upload a CSV at any time.
              </p>
              <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 22px", color:"#64748b", cursor:"pointer", fontSize:14 }}>
                  Cancel
                </button>
                <button onClick={handleDelete}
                  style={{ background:"#dc2626", border:"none", borderRadius:8, padding:"10px 22px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>
                  Yes, Delete All
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding:"20px 16px" }}>

          {/* Page title + count */}
          <div style={{ marginBottom:20 }}>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"clamp(20px,5vw,28px)", fontWeight:700, color:"#0f172a", margin:"0 0 4px" }}>
              DSR Market Data
            </h1>
            <p style={{ color:"#64748b", fontSize:13, margin:0 }}>
              {loading ? "Loading…" : `${filtered.length} of ${rows.length} suburbs`}
              {hasFilters && <button onClick={clearFilters} style={{ marginLeft:10, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:6, padding:"2px 10px", color:"#dc2626", cursor:"pointer", fontSize:11, fontWeight:600 }}>✕ Clear filters</button>}
            </p>
          </div>

          {/* ── Filters ── */}
          <div className="dsr-filters" style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 18px", marginBottom:20, display:"flex", flexDirection:"column", gap:14, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>

            {/* Row 1: search + state pills */}
            <div className="dsr-filter-row" style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
              <div style={{ position:"relative", flex:"1 1 200px", minWidth:180 }}>
                <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#94a3b8", fontSize:14 }}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Search suburb, postcode, state…"
                  style={{ width:"100%", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 12px 9px 32px", fontSize:13, outline:"none", color:"#1e293b", fontFamily:"inherit" }} />
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {STATES.map(s => (
                  <button key={s} onClick={() => toggleState(s)}
                    style={{ background: stateF.includes(s) ? "#0ea5e9" : "#f1f5f9", border: `1px solid ${stateF.includes(s)?"#0ea5e9":"#e2e8f0"}`, borderRadius:20, padding:"5px 12px", color: stateF.includes(s)?"#fff":"#475569", cursor:"pointer", fontSize:12, fontWeight:600, transition:"all 0.1s" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: numeric range filters */}
            <div className="dsr-filter-row" style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
              <FilterRange label="DSR" min={dsrMin} max={dsrMax} onMin={setDsrMin} onMax={setDsrMax} placeholder={["50","70"]} />
              <FilterRange label="Yield %" min={yieldMin} onMin={setYieldMin} placeholder={["e.g. 5"]} single />
              <FilterRange label="LT Growth %" min={growthMin} onMin={setGrowthMin} placeholder={["e.g. 5"]} single />
            </div>
          </div>

          {/* ── Legend ── */}
          <div style={{ display:"flex", gap:16, marginBottom:14, flexWrap:"wrap" }}>
            {[["#f0fdf4","#15803d","High / Favourable"],["#fefce8","#a16207","Moderate"],["#fef2f2","#b91c1c","Low / Caution"]].map(([bg,text,label])=>(
              <div key={label} style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ background:bg, color:text, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:700 }}>123</span>
                <span style={{ fontSize:11, color:"#64748b" }}>{label}</span>
              </div>
            ))}
            <span style={{ fontSize:11, color:"#94a3b8", marginLeft:4 }}>Click column headers to sort</span>
          </div>

          {loading && (
            <div style={{ textAlign:"center", padding:80, color:"#94a3b8" }}>
              <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
              Loading DSR data…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div style={{ textAlign:"center", padding:"60px 24px", background:"#fff", borderRadius:16, border:"1px solid #e2e8f0" }}>
              <div style={{ fontSize:44, marginBottom:14 }}>📊</div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#0f172a", marginBottom:8 }}>No DSR data yet</div>
              <div style={{ color:"#94a3b8", fontSize:13, marginBottom:24 }}>
                {isAdmin ? "Upload a CSV exported from the DSR website to get started." : "No DSR data has been uploaded yet."}
              </div>
              {isAdmin && (
                <button onClick={() => fileRef.current?.click()}
                  style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"11px 24px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                  ⬆ Upload CSV
                </button>
              )}
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ overflowX:"auto" }}>
                <div style={{ minWidth:totalWidth }}>

                  {/* Header row */}
                  <div style={{ display:"flex", background:"#f8fafc", borderBottom:"2px solid #e2e8f0", position:"sticky", top:0, zIndex:10 }}>
                    {DSR_COLS.map(col => {
                      const active = sortKey === col.key;
                      return (
                        <div key={col.key} className="sort-th" onClick={() => toggleSort(col.key)}
                          style={{
                            width:col.w, minWidth:col.w, padding:"10px 10px", flexShrink:0,
                            display:"flex", alignItems:"center", gap:4,
                            fontSize:11, fontWeight:700, color: active?"#0369a1":"#64748b",
                            textTransform:"uppercase", letterSpacing:0.7,
                            background: active?"#e0f2fe":"transparent",
                            borderRight:"1px solid #e2e8f0", userSelect:"none",
                            transition:"background 0.1s",
                          }}>
                          <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{col.label}</span>
                          <span style={{ fontSize:9, color: active?"#0369a1":"#cbd5e1" }}>
                            {active ? (sortDir==="desc"?"▼":"▲") : "⇅"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Data rows */}
                  {filtered.length === 0 ? (
                    <div style={{ padding:"40px 20px", textAlign:"center", color:"#94a3b8" }}>
                      No suburbs match the current filters.
                      <button onClick={clearFilters} style={{ marginLeft:8, color:"#0ea5e9", background:"none", border:"none", cursor:"pointer", fontSize:13 }}>Clear filters</button>
                    </div>
                  ) : (
                    filtered.map((row, idx) => (
                      <div key={idx} className="dsr-row" style={{ display:"flex", borderBottom:"1px solid #f1f5f9", background: idx%2===0?"#fff":"#fafbfc" }}>
                        {DSR_COLS.map(col => (
                          <div key={col.key}
                            style={{ width:col.w, minWidth:col.w, padding:"9px 10px", flexShrink:0, borderRight:"1px solid #f1f5f9", display:"flex", alignItems:"center", overflow:"hidden" }}>
                            <Badge value={row[col.key]||"—"} col={col} />
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"10px 16px", borderTop:"1px solid #f1f5f9", background:"#f8fafc", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <span style={{ fontSize:12, color:"#94a3b8" }}>
                  {filtered.length} suburb{filtered.length!==1?"s":""} shown · sorted by <strong style={{ color:"#475569" }}>{DSR_COLS.find(c=>c.key===sortKey)?.label}</strong> ({sortDir==="desc"?"highest first":"lowest first"})
                </span>
                {isAdmin && rows.length > 0 && (
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{rows.length} total rows in database</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Filter Range Input ────────────────────────────────────────────────────────
function FilterRange({ label, min, max, onMin, onMax, placeholder = [], single }) {
  const inp = { width:70, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:7, padding:"7px 9px", fontSize:12, outline:"none", color:"#1e293b", fontFamily:"inherit" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px" }}>
      <span style={{ fontSize:11, fontWeight:700, color:"#64748b", whiteSpace:"nowrap" }}>{label}</span>
      <input value={min} onChange={e=>onMin(e.target.value)} placeholder={placeholder[0]||"Min"} style={inp} />
      {!single && (
        <>
          <span style={{ fontSize:11, color:"#cbd5e1" }}>–</span>
          <input value={max} onChange={e=>onMax(e.target.value)} placeholder={placeholder[1]||"Max"} style={inp} />
        </>
      )}
    </div>
  );
}

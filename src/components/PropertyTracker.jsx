import { useState, useEffect, useCallback, useRef } from "react";
import { loadTrackerData, saveTrackerRows, saveTrackerCols, loadPurchaseCosts } from "../firebase.js";
import { calcStampDuty, formatCurrency } from "../stampDuty.js";
import AdminPanel from "./AdminPanel.jsx";

const MANDATORY_COLUMNS = [
  { id:"property",    label:"Property",    type:"link",     width:220, locked:true },
  { id:"price",       label:"Price",       type:"currency", width:150, locked:true },
  { id:"config",      label:"Config",      type:"text",     width:120, locked:true },
  { id:"land",        label:"Land",        type:"text",     width:110, locked:true },
  { id:"building",    label:"Building",    type:"text",     width:110, locked:true },
  { id:"ph_rating",   label:"PH Rating",   type:"rating",   width:120, locked:true },
  { id:"suburb",      label:"Suburb",      type:"text",     width:140, locked:true },
  { id:"state",       label:"State",       type:"select",   width:100, locked:true, options:["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"] },
  { id:"offer_price",     label:"Offer Price",      type:"currency", width:140, locked:true },
  { id:"rental_appraisal",label:"Rental/Wk",        type:"currency", width:130, locked:true },
  { id:"cost_of_purchase",label:"Cost of Purchase",  type:"readonly", width:160, locked:true },
  { id:"yield",           label:"Yield %",           type:"readonly", width:110, locked:true },
  { id:"comments",        label:"Comments",          type:"textarea", width:200, locked:true },
  { id:"agent_notes",     label:"Agent Notes",       type:"textarea", width:200, locked:true },
];

const INITIAL_ROWS = [
  { id:1, property:"", price:"", config:"", land:"", ph_rating:"", suburb:"", state:"", building:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"" },
  { id:2, property:"", price:"", config:"", land:"", ph_rating:"", suburb:"", state:"", building:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"" },
];

// ── AI Property Extractor (via Firebase Cloud Function proxy) ─────────────────
const EXTRACT_FUNCTION_URL  = "https://us-central1-proptracker-5408f.cloudfunctions.net/extractProperty";
const ANALYSE_FUNCTION_URL  = "https://us-central1-proptracker-5408f.cloudfunctions.net/analyseSuburb";

async function extractPropertyWithAI(input, originalUrl) {
  const isUrl = !originalUrl && input.trim().startsWith("http");
  const mode  = isUrl ? "url" : "paste";

  const response = await fetch(EXTRACT_FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: input.trim(), mode }),
  });

  if (!response.ok) {
    const err = await response.json().catch(()=>({}));
    throw new Error(err.error || "Server error " + response.status);
  }

  const data = await response.json();
  // Attach the original URL so it gets saved as the property link
  if (originalUrl) data._originalUrl = originalUrl;
  return data;
}

// ── Quick Add Modal ────────────────────────────────────────────────────────────
function QuickAddModal({ onAdd, onClose }) {
  const [text,    setText]    = useState("");
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error,   setError]   = useState("");

  const extract = async () => {
    if (!text.trim()) return;
    setLoading(true); setError(""); setPreview(null);
    try {
      const response = await fetch(EXTRACT_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text.trim(), mode: "paste" }),
      });
      if (!response.ok) {
        const err = await response.json().catch(()=>({}));
        throw new Error(err.error || "Server error " + response.status);
      }
      const result = await response.json();
      setPreview(result);
    } catch (e) {
      setError("Could not extract details. Please check the pasted text and try again.");
      console.error(e);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!preview) return;
    onAdd({
      property:  url.trim() || "",
      price:     preview.price     || "",
      config:    preview.config    || "",
      land:      preview.land      || "",
      building:  preview.building  || "",
      suburb:    preview.suburb    || "",
      state:     preview.state     || "",
    });
    onClose();
  };

  const inp = { width:"100%", boxSizing:"border-box", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 12px", color:"#1e293b", fontSize:14, outline:"none", fontFamily:"inherit" };
  const lbl = { color:"#64748b", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:5 };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }}>
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:32, width:"min(560px,95vw)", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
          <h3 style={{ margin:0, fontFamily:"'Playfair Display', serif", fontSize:24, color:"#0f172a" }}>Add Property</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, color:"#94a3b8", cursor:"pointer" }}>&#10005;</button>
        </div>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 24px", lineHeight:1.6 }}>
          Copy the listing details from realestate.com.au and paste below. AI will extract all the key information automatically.
        </p>

        {/* Property URL - just for saving the link */}
        <label style={lbl}>Property URL (for the link column)</label>
        <input value={url} onChange={e=>setUrl(e.target.value)}
          placeholder="https://www.realestate.com.au/property-house-..."
          style={{ ...inp, marginBottom:16 }}
        />

        {/* Paste area */}
        <label style={lbl}>Paste listing text from the page</label>
        <textarea value={text} onChange={e=>{ setText(e.target.value); setPreview(null); setError(""); }}
          placeholder={"Paste the property details here — address, beds/baths, price, land size etc.\n\nTip: On realestate.com.au, copy the key facts section at the top of the listing."}
          style={{ ...inp, height:150, resize:"vertical", lineHeight:1.7, marginBottom:4 }}
        />
        <div style={{ color:"#94a3b8", fontSize:12, marginBottom:16 }}>
          Tip: Copy the summary section showing address, beds, baths, price and land size for best results.
        </div>

        <button onClick={extract} disabled={loading || !text.trim()}
          style={{ background:text.trim()&&!loading?"#0ea5e9":"#e2e8f0", border:"none", borderRadius:8, padding:"10px 24px", color:text.trim()&&!loading?"#fff":"#94a3b8", cursor:text.trim()&&!loading?"pointer":"not-allowed", fontSize:14, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
          {loading ? (
            <>
              <span style={{ width:14, height:14, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", animation:"spin 0.7s linear infinite", display:"inline-block" }}/>
              Extracting...
            </>
          ) : "Extract Details"}
        </button>

        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", marginTop:14, color:"#dc2626", fontSize:13 }}>
            {error}
          </div>
        )}

        {preview && (
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:12, padding:20, marginTop:18 }}>
            <div style={{ color:"#16a34a", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2, marginBottom:16, display:"flex", alignItems:"center", gap:6 }}>
              <span>&#10003;</span> Extracted — review and edit if needed
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px 20px" }}>
              {[
                ["Address",  "address"],
                ["Suburb",   "suburb"],
                ["State",    "state"],
                ["Config",   "config"],
                ["Land",     "land"],
                ["Building", "building"],
                ["Price",    "price"],
                ["Type",     "type"],
              ].map(([label, key])=>(
                <div key={key} style={{ gridColumn:key==="address"?"1 / -1":"auto" }}>
                  <label style={lbl}>{label}</label>
                  {key==="state" ? (
                    <select value={preview[key]||""} onChange={e=>setPreview(p=>({...p,[key]:e.target.value}))}
                      style={{ ...inp, cursor:"pointer" }}>
                      <option value="">Select state</option>
                      {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s=>(
                        <option key={s} value={s} style={{ background:"#fff" }}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={preview[key]||""} onChange={e=>setPreview(p=>({...p,[key]:e.target.value}))}
                      style={inp} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop:14 }}>
              <label style={lbl}>Thumbnail URL (optional)</label>
              <input value={preview.thumbnail||""} onChange={e=>setPreview(p=>({...p,thumbnail:e.target.value}))}
                placeholder="Paste image URL from the listing"
                style={inp}/>
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"10px 20px", color:"#64748b", cursor:"pointer", fontSize:14 }}>
            Cancel
          </button>
          <button onClick={handleAdd} disabled={!preview}
            style={{ background:preview?"#0ea5e9":"#e2e8f0", border:"none", borderRadius:8, padding:"10px 26px", color:preview?"#fff":"#94a3b8", cursor:preview?"pointer":"not-allowed", fontSize:14, fontWeight:600 }}>
            Add to Tracker
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Star Rating ────────────────────────────────────────────────────────────────
function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const v = parseFloat(value) || 0;
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(i=>(
        <span key={i}
          style={{ cursor:onChange?"pointer":"default", fontSize:18, color:i<=(hover||v)?"#f59e0b":"#d1d5db", transition:"color 0.1s", lineHeight:1 }}
          onMouseEnter={()=>onChange&&setHover(i)}
          onMouseLeave={()=>onChange&&setHover(0)}
          onClick={()=>onChange&&onChange(i===v?0:i)}>
          &#9733;
        </span>
      ))}
    </div>
  );
}

// ── Cell ───────────────────────────────────────────────────────────────────────
function Cell({ col, value, onChange, editing, onStartEdit, onEndEdit, onAnalyse, analysing }) {
  const [local, setLocal] = useState(value||"");
  const ref = useRef();
  useEffect(()=>{ setLocal(value||""); },[value]);
  useEffect(()=>{ if(editing&&ref.current) ref.current.focus(); },[editing]);

  const commit = ()=>{ onChange(local); onEndEdit(); };
  const kd = e=>{ if(e.key==="Enter"&&col.type!=="textarea") commit(); if(e.key==="Escape"){setLocal(value||"");onEndEdit();} };

  const cs = {
    width:col.width, minWidth:col.width, maxWidth:col.width,
    height: col.type==="image"||col.type==="textarea" ? 72 : 48,
    padding:"0 12px", boxSizing:"border-box", display:"flex", alignItems:"center",
    borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0",
    overflow:"hidden", flexShrink:0,
    background: editing?"#f0f9ff":"transparent",
    cursor:"text", transition:"background 0.1s",
  };

  const inputStyle = { width:"100%", background:"transparent", border:"none", outline:"none", color:"#1e293b", fontSize:13, fontFamily:"inherit" };

  if (col.type==="image") return (
    <div style={cs} onClick={onStartEdit}>
      {editing
        ? <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit} onKeyDown={kd} placeholder="Image URL" style={{ ...inputStyle, fontSize:11 }}/>
        : value
          ? <img src={value} alt="" style={{ width:"100%", height:64, objectFit:"cover", borderRadius:6 }}/>
          : <span style={{ color:"#cbd5e1", fontSize:11 }}>No image</span>}
    </div>
  );
  if (col.type==="rating") return <div style={{ ...cs, cursor:"default" }}><StarRating value={value} onChange={onChange}/></div>;
  if (col.type==="select") return (
    <div style={cs}>
      <select value={value||""} onChange={e=>onChange(e.target.value)}
        style={{ ...inputStyle, cursor:"pointer", background:"transparent" }}>
        <option value="">—</option>
        {col.options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (col.type==="link") return (
    <div style={{ ...cs, gap:6 }} onClick={onStartEdit}>
      {editing
        ? <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={()=>{onChange(local);onEndEdit();}} onKeyDown={kd} placeholder="Paste property URL" style={{ ...inputStyle, color:"#0ea5e9" }}/>
        : value
          ? <a href={value} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
              style={{ color:"#0ea5e9", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:"none" }}>
              {value.replace(/^https?:\/\//,"").substring(0,30)}...
            </a>
          : <span style={{ color:"#cbd5e1", fontSize:13 }}>Paste URL</span>}
    </div>
  );
  if (col.type==="textarea") return (
    <div style={{ ...cs, alignItems:"flex-start", paddingTop:8, position:"relative", flexDirection:"column", gap:4 }} onClick={onStartEdit}>
      {editing
        ? <textarea ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit}
            onKeyDown={e=>{ if(e.key==="Escape"){setLocal(value||"");onEndEdit();} }}
            style={{ ...inputStyle, height:50, resize:"none", lineHeight:1.5 }}/>
        : <span style={{ fontSize:12, color:value?"#475569":"#cbd5e1", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", flex:1, width:"100%" }}>
            {value||(onAnalyse?"Click ✨ to generate":"Add note")}
          </span>}
      {onAnalyse && !editing && (
        <button
          onClick={e=>{ e.stopPropagation(); onAnalyse(); }}
          disabled={analysing}
          title="Generate AI analysis"
          style={{ position:"absolute", top:6, right:6, background:analysing?"#e2e8f0":"#f0f9ff", border:"1px solid #bae6fd", borderRadius:6, padding:"2px 7px", fontSize:11, color:analysing?"#94a3b8":"#0ea5e9", cursor:analysing?"not-allowed":"pointer", fontWeight:600, whiteSpace:"nowrap", zIndex:1 }}>
          {analysing ? "..." : "✨ AI"}
        </button>
      )}
    </div>
  );
  if (col.type==="readonly") return (
    <div style={{ ...cs, cursor:"default", background:"#f8fafc" }}>
      <span style={{ fontSize:13, fontWeight:700, color:value?"#0369a1":"#cbd5e1" }}>
        {value || "—"}
      </span>
    </div>
  );
  if (col.type==="currency") return (
    <div style={cs} onClick={onStartEdit}>
      {editing
        ? <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit} onKeyDown={kd} placeholder="$0" style={{ ...inputStyle, color:"#16a34a", fontWeight:600 }}/>
        : <span style={{ color:value?"#16a34a":"#cbd5e1", fontSize:13, fontWeight:600 }}>
            {value ? (isNaN(value.replace(/[,$]/g,"")) ? value : `$${Number(value.replace(/[,$]/g,"")).toLocaleString()}`) : "—"}
          </span>}
    </div>
  );
  return (
    <div style={cs} onClick={onStartEdit}>
      {editing
        ? <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit} onKeyDown={kd} style={inputStyle}/>
        : <span style={{ fontSize:13, color:value?"#374151":"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {value||"—"}
          </span>}
    </div>
  );
}

// ── Add Column Modal ───────────────────────────────────────────────────────────
function AddColumnModal({ onAdd, onClose }) {
  const [label, setLabel] = useState("");
  const [type,  setType]  = useState("text");

  const inp = { width:"100%", boxSizing:"border-box", background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 12px", color:"#1e293b", fontSize:14, outline:"none" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, padding:28, width:360, boxShadow:"0 20px 60px rgba(0,0,0,0.12)" }}>
        <h3 style={{ color:"#0f172a", margin:"0 0 20px", fontFamily:"'Playfair Display', serif", fontSize:20 }}>Add Column</h3>
        <label style={{ color:"#64748b", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:5 }}>Column Name</label>
        <input value={label} onChange={e=>setLabel(e.target.value)} autoFocus placeholder="e.g. Yield %"
          style={{ ...inp, marginBottom:16 }}/>
        <label style={{ color:"#64748b", fontSize:12, fontWeight:600, textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:5 }}>Type</label>
        <select value={type} onChange={e=>setType(e.target.value)} style={{ ...inp, marginBottom:24, cursor:"pointer" }}>
          <option value="text">Text</option>
          <option value="currency">Currency</option>
          <option value="rating">Star Rating</option>
          <option value="textarea">Notes</option>
          <option value="select">Dropdown</option>
          <option value="link">Link</option>
        </select>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 18px", color:"#64748b", cursor:"pointer", fontSize:14 }}>Cancel</button>
          <button onClick={()=>{ if(label.trim()){onAdd({id:`custom_${Date.now()}`,label:label.trim(),type,width:150,locked:false});onClose();}}}
            style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"9px 22px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:600 }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Tracker ───────────────────────────────────────────────────────────────
// ── Calc cost & yield (module-level so always available) ─────────────────────
function calcCostAndYield(row, pc) {
  const offer = parseFloat(String(row.offer_price || "").replace(/[,$]/g, "")) || 0;
  const rent  = parseFloat(String(row.rental_appraisal || "").replace(/[,$]/g, "")) || 0;
  if (!pc || !offer) return { cost_of_purchase: "", yield: "" };
  const general = ["conveyancing","building_inspection","pest_inspection","loan_application",
                   "lenders_mortgage_insurance","title_search","settlement_agent","other"]
                  .reduce((s, k) => s + (parseFloat(pc[k]) || 0), 0);
  const stampDuty = calcStampDuty(row.state, offer);
  const cop = offer + general + stampDuty;
  const yld = (rent > 0 && cop > 0) ? ((rent * 52 / cop) * 100).toFixed(2) : "";
  return {
    cost_of_purchase: formatCurrency(cop),
    yield: yld ? yld + "%" : "",
  };
}

export default function PropertyTracker({ user, onSignOut, isAdmin, onNavigate }) {
  const [columns,      setColumns]      = useState(MANDATORY_COLUMNS);
  const [rows,         setRows]         = useState(INITIAL_ROWS);
  const [editing,      setEditing]      = useState(null);
  const [showAddCol,   setShowAddCol]   = useState(false);
  const [showAdmin,    setShowAdmin]    = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [nextId,       setNextId]       = useState(3);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [saving,       setSaving]       = useState(false);
  const [analysingRows,  setAnalysingRows]  = useState(new Set());
  const [purchaseCosts,  setPurchaseCosts]  = useState(null);
  const purchaseCostsRef = useRef(null);

  // Keep ref in sync with state so updateCell always has fresh value
  useEffect(() => { purchaseCostsRef.current = purchaseCosts; }, [purchaseCosts]);

  useEffect(()=>{
    loadTrackerData().then(({ rows:r, cols:c })=>{
      if(r){ setRows(r); setNextId(Math.max(...r.map(x=>x.id),0)+1); }
      if(c) setColumns(c);
    });
    loadPurchaseCosts().then(d => { if(d) { setPurchaseCosts(d); purchaseCostsRef.current = d; } });
  },[]);

  const saveRows     = useCallback(async (nr)=>{ setRows(nr); setSaving(true); await saveTrackerRows(nr); setSaving(false); },[]);
  const saveCols     = useCallback(async (nc)=>{ setColumns(nc); await saveTrackerCols(nc); },[]);
  const updateCell = (rowId, colId, v) => {
    setRows(prev => {
      const updated = prev.map(r => {
        if (r.id !== rowId) return r;
        const newRow = { ...r, [colId]: v };
        if (colId === "offer_price" || colId === "rental_appraisal" || colId === "state") {
          const calc = calcCostAndYield(newRow, purchaseCostsRef.current);
          return { ...newRow, ...calc };
        }
        return newRow;
      });
      // Save to Firestore in background
      setSaving(true);
      saveTrackerRows(updated).then(() => setSaving(false));
      return updated;
    });
  };
  const addRow       = () => { const row={id:nextId,...Object.fromEntries(columns.map(c=>[c.id,""]))}; setNextId(n=>n+1); saveRows([...rows,row]); };
  const deleteRows   = () => { saveRows(rows.filter(r=>!selectedRows.has(r.id))); setSelectedRows(new Set()); };
  const addColumn    = col => { saveCols([...columns,col]); saveRows(rows.map(r=>({...r,[col.id]:""})));};
  const removeColumn = id  => saveCols(columns.filter(c=>c.id!==id));

  const analyseSuburb = async (rowId) => {
    const row = rows.find(r => r.id === rowId);
    if (!row || !row.suburb) return;
    setAnalysingRows(prev => new Set([...prev, rowId]));
    try {
      const response = await fetch(ANALYSE_FUNCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suburb: row.suburb, state: row.state }),
      });
      if (response.ok) {
        const data = await response.json();
        const updated = rows.map(r => r.id === rowId
          ? { ...r, suburb_analysis: data.suburb_analysis || "", economy: data.economy || "" }
          : r
        );
        saveRows(updated);
      }
    } catch (err) {
      console.error("Analyse error:", err);
    }
    setAnalysingRows(prev => { const s = new Set(prev); s.delete(rowId); return s; });
  };

  const quickAddProperty = (parsed) => {
    const row = {
      id: nextId,
      ...Object.fromEntries(columns.map(c=>[c.id,""])),
      property:  parsed.property  || "",
      price:     parsed.price     || "",
      config:    parsed.config    || "",
      land:      parsed.land      || "",
      building:  parsed.building  || "",
      suburb:    parsed.suburb    || "",
      state:     parsed.state     || "",
      ph_rating: "",
      comments:  "",
      agent_notes: "",
    };
    setNextId(n=>n+1);
    saveRows([...rows, row]);
  };

  const totalWidth = columns.reduce((s,c)=>s+c.width,0)+52;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc;font-family:'Inter',sans-serif;}
        ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:#f1f5f9} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        .rh:hover td,.rh:hover>div{background:#f8fafc!important}
        .ch:hover .rc{opacity:1!important;pointer-events:all!important}
        select option{background:#fff;color:#1e293b}
      `}</style>

      <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter', sans-serif", color:"#1e293b" }}>

        {/* Navbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>&#127968;</div>
            <span style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:18, color:"#0f172a" }}>PropTracker</span>
            {saving && <span style={{ color:"#94a3b8", fontSize:11, marginLeft:4, background:"#f1f5f9", borderRadius:20, padding:"2px 10px" }}>Saving...</span>}
            <button onClick={()=>onNavigate && onNavigate("purchase-costs")}
              style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"6px 14px", color:"#16a34a", cursor:"pointer", fontSize:13, fontWeight:500, marginLeft:8 }}>
              &#128200; Purchase Costs
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {isAdmin && (
              <button onClick={()=>setShowAdmin(true)}
                style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:8, padding:"7px 14px", color:"#7c3aed", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                &#9881; Admin
              </button>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:24, padding:"5px 14px 5px 6px" }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width:26, height:26, borderRadius:"50%", objectFit:"cover" }}/>}
              <span style={{ color:"#374151", fontSize:13, fontWeight:500 }}>{user.displayName||user.email}</span>
              {isAdmin && <span style={{ background:"#7c3aed", borderRadius:10, padding:"2px 8px", fontSize:10, color:"#fff", fontWeight:700 }}>ADMIN</span>}
            </div>
            <button onClick={onSignOut} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 14px", color:"#94a3b8", cursor:"pointer", fontSize:13 }}>
              Sign Out
            </button>
          </div>
        </div>

        {/* Page Header */}
        <div style={{ padding:"32px 32px 24px", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <div>
              <p style={{ margin:"0 0 4px", color:"#94a3b8", fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>Portfolio Analysis</p>
              <h1 style={{ margin:0, fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:700, color:"#0f172a", letterSpacing:-0.5 }}>
                Property Dashboard
              </h1>
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              {selectedRows.size>0 && (
                <button onClick={deleteRows}
                  style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"9px 16px", color:"#dc2626", cursor:"pointer", fontSize:13, fontWeight:500 }}>
                  Delete {selectedRows.size} selected
                </button>
              )}
              <button onClick={()=>setShowAddCol(true)}
                style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 16px", color:"#64748b", cursor:"pointer", fontSize:13, fontWeight:500 }}>
                + Column
              </button>
              <button onClick={addRow}
                style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 16px", color:"#64748b", cursor:"pointer", fontSize:13, fontWeight:500 }}>
                + Empty Row
              </button>
              <button onClick={()=>setShowQuickAdd(true)}
                style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, boxShadow:"0 2px 8px rgba(14,165,233,0.35)", display:"flex", alignItems:"center", gap:6 }}>
                &#10024; Add Property
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"flex", gap:16, marginTop:20, flexWrap:"wrap" }}>
            {[
              { label:"Total Properties", value:rows.length, color:"#0ea5e9" },
              { label:"Analysed",   value:rows.filter(r=>r.ph_rating).length, color:"#f59e0b" },
              { label:"Avg PH Rating", value:(()=>{ const r=rows.filter(r=>r.ph_rating); return r.length?(r.reduce((s,x)=>s+parseFloat(x.ph_rating||0),0)/r.length).toFixed(1)+"★":"—"; })(), color:"#10b981" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 20px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:4, height:36, borderRadius:2, background:s.color }}/>
                <div>
                  <div style={{ color:"#94a3b8", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{s.label}</div>
                  <div style={{ color:"#0f172a", fontSize:22, fontWeight:700, fontFamily:"'Playfair Display', serif", lineHeight:1.2 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div style={{ overflowX:"auto", padding:"24px 32px 40px" }}>
          <div style={{ minWidth:totalWidth, background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>

            {/* Column Headers */}
            <div style={{ display:"flex", background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
              <div style={{ width:52, minWidth:52, display:"flex", alignItems:"center", justifyContent:"center", borderRight:"1px solid #e2e8f0", padding:"12px 0" }}>
                <input type="checkbox" style={{ accentColor:"#0ea5e9", cursor:"pointer", width:15, height:15 }}
                  checked={selectedRows.size===rows.length&&rows.length>0}
                  onChange={e=>setSelectedRows(e.target.checked?new Set(rows.map(r=>r.id)):new Set())}/>
              </div>
              {columns.map(col=>(
                <div key={col.id} className="ch"
                  style={{ width:col.width, minWidth:col.width, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 12px", borderRight:"1px solid #e2e8f0" }}>
                  <span style={{ color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2 }}>{col.label}</span>
                  {!col.locked && (
                    <button className="rc" onClick={()=>removeColumn(col.id)}
                      style={{ opacity:0, pointerEvents:"none", background:"#fef2f2", border:"none", borderRadius:4, width:18, height:18, color:"#dc2626", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", transition:"opacity 0.15s" }}>
                      &#10005;
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Data Rows */}
            {rows.map((row,idx)=>(
              <div key={row.id} className="rh"
                style={{ display:"flex", background:idx%2===0?"#fff":"#fafbfc", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ width:52, minWidth:52, display:"flex", alignItems:"center", justifyContent:"center", borderRight:"1px solid #e2e8f0", background:"inherit" }}>
                  <input type="checkbox" style={{ accentColor:"#0ea5e9", cursor:"pointer", width:15, height:15 }}
                    checked={selectedRows.has(row.id)}
                    onChange={e=>{ const s=new Set(selectedRows); e.target.checked?s.add(row.id):s.delete(row.id); setSelectedRows(s); }}/>
                </div>
                {columns.map(col=>(
                  <Cell key={col.id} col={col} value={row[col.id]}
                    onChange={v=>updateCell(row.id,col.id,v)}
                    editing={editing?.rowId===row.id&&editing?.colId===col.id}
                    onStartEdit={()=>setEditing({rowId:row.id,colId:col.id})}
                    onEndEdit={()=>setEditing(null)}
                    onAnalyse={null}
                    analysing={false}/>
                ))}
              </div>
            ))}

            {/* Add Row footer */}
            <div onClick={addRow}
              style={{ display:"flex", height:44, cursor:"pointer", borderTop:"1px solid #f1f5f9", background:"#fafbfc" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
              onMouseLeave={e=>e.currentTarget.style.background="#fafbfc"}>
              <div style={{ width:52, minWidth:52, borderRight:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:20 }}>+</div>
              <div style={{ flex:1, display:"flex", alignItems:"center", padding:"0 12px", color:"#94a3b8", fontSize:13 }}>
                Click to add a new row...
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding:"0 32px 32px", color:"#cbd5e1", fontSize:12 }}>
          Click any cell to edit &nbsp;&#183;&nbsp; Enter to confirm &nbsp;&#183;&nbsp; Esc to cancel &nbsp;&#183;&nbsp; Use "&#10024; Add Property" to auto-fill from a listing URL or text
        </div>
      </div>

      {showAddCol   && <AddColumnModal onAdd={addColumn} onClose={()=>setShowAddCol(false)}/>}
      {showAdmin    && <AdminPanel onClose={()=>setShowAdmin(false)}/>}
      {showQuickAdd && <QuickAddModal onAdd={quickAddProperty} onClose={()=>setShowQuickAdd(false)}/>}
    </>
  );
}

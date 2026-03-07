import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { loadTrackerData, saveTrackerRows, saveTrackerCols, loadUserTrackerData, saveUserTrackerRows, saveUserTrackerCols, clearUserDashboard, loadPurchaseCosts, onPendingCountChange, loadStreetProfiles, loadAmenities, DEFAULT_AMENITIES, loadUserAmenitiesSelections, saveUserAmenitiesSelections, loadUserAmenitiesConfig, loadGuestNavAccess, saveGuestNavAccess, DEFAULT_GUEST_NAV } from "../firebase.js";
import { calcStampDuty, formatCurrency } from "../stampDuty.js";
import AdminPanel from "./AdminPanel.jsx";
import HelpPanel  from "./HelpPanel.jsx";

const MANDATORY_COLUMNS = [
  { id:"status",      label:"Status",      type:"status_tag", width:170, locked:true },
  { id:"property",    label:"Property",    type:"link",     width:220, locked:true },
  { id:"address",     label:"Address",     type:"text",     width:200, locked:true },
  { id:"price",       label:"Price",       type:"currency", width:150, locked:true },
  { id:"config",      label:"Config",      type:"text",     width:120, locked:true },
  { id:"land",        label:"Land",        type:"text",     width:110, locked:true },
  { id:"ph_rating",   label:"PH Rating",   type:"ph_tag",   width:130, locked:true },
  { id:"calc_ph",     label:"Calculated PH", type:"calc_ph",  width:160, locked:true },
  { id:"suburb",      label:"Suburb",      type:"text",     width:140, locked:true },
  { id:"state",       label:"State",       type:"select",   width:100, locked:true, options:["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"] },
  { id:"offer_price",     label:"Offer Price",      type:"currency", width:140, locked:true },
  { id:"rental_appraisal",label:"Rental/Wk",        type:"currency", width:130, locked:true },
  { id:"cost_of_purchase",label:"Cost of Purchase",  type:"readonly", width:160, locked:true },
  { id:"yield",           label:"Yield %",           type:"readonly", width:110, locked:true },
  { id:"comments",        label:"Comments",          type:"textarea", width:200, locked:true },
  { id:"agent_notes",     label:"Agent Notes",       type:"textarea", width:200, locked:true },
  { id:"amenities",        label:"Amenities",          type:"amenities", width:220, locked:true },
  { id:"score_card",       label:"Score Card",         type:"score_card", width:140, locked:true },
  { id:"ph_heatmap",        label:"PH Heatmap",         type:"ph_heatmap",   width:140, locked:true },
  { id:"sale_history",      label:"Sale History",       type:"sale_history", width:130, locked:true },
];

// Columns that support sort (numeric/currency/percent)
const SORTABLE_COLS = new Set(["price","offer_price","rental_appraisal","cost_of_purchase","yield","land","score_card"]);

const INITIAL_ROWS = [
  { id:1, status:"Under Consideration", address:"", property:"", price:"", config:"", land:"", ph_rating:"", calc_ph:"", suburb:"", state:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"", amenities:[], score_card:"", ph_heatmap:"", sale_history:[] },
  { id:2, status:"Under Consideration", address:"", property:"", price:"", config:"", land:"", ph_rating:"", calc_ph:"", suburb:"", state:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"", amenities:[], score_card:"", ph_heatmap:"", sale_history:[] },
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
      address:   preview.address  || "",
      price:     preview.price    || "",
      config:    preview.config   || "",
      land:      preview.land     || "",
      suburb:    preview.suburb   || "",
      state:     preview.state    || "",
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

// ── Note Popup — renders in body portal to escape overflow:hidden ─────────────
function NotePopup({ entries, anchorRef }) {
  const [pos, setPos] = useState({ top:0, left:0 });
  useEffect(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    const popW = 380;
    let left = r.left + window.scrollX;
    if (left + popW > window.innerWidth - 16) left = window.innerWidth - popW - 16;
    setPos({ top: r.bottom + window.scrollY + 6, left });
  }, [anchorRef]);

  if (!entries || entries.length === 0) return null;
  return createPortal(
    <div style={{
      position:"absolute", top:pos.top, left:pos.left, zIndex:99999,
      background:"#fff", border:"1px solid #e2e8f0", borderRadius:12,
      boxShadow:"0 8px 32px rgba(0,0,0,0.18)", padding:16, width:380,
      maxHeight:480, overflowY:"auto", pointerEvents:"none",
    }}>
      {entries.map((e, i) => (
        <div key={i} style={{ marginBottom: i < entries.length-1 ? 14 : 0 }}>
          {e.ts && (
            <div style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>
              {e.ts}
            </div>
          )}
          <div style={{ fontSize:13, color:"#1e293b", whiteSpace:"pre-line", lineHeight:1.6 }}>
            {e.text}
          </div>
          {i < entries.length-1 && <div style={{ borderBottom:"1px solid #f1f5f9", marginTop:14 }}/>}
        </div>
      ))}
    </div>,
    document.body
  );
}


// ── PH Colour Tag constants ────────────────────────────────────────────────────
const PH_OPTIONS = ["Black", "Pink", "Amber", "Green"];
const PH_COLOUR_STYLES = {
  Black: { bg:"#1e293b", text:"#fff",    border:"#0f172a", cell:"#1e293b" },
  Pink:  { bg:"#fce7f3", text:"#9d174d", border:"#f9a8d4", cell:"#fdf2f8" },
  Amber: { bg:"#fef3c7", text:"#92400e", border:"#fbbf24", cell:"#fffbeb" },
  Green: { bg:"#dcfce7", text:"#14532d", border:"#4ade80", cell:"#f0fdf4" },
};
function PhTag({ colour }) {
  const s = PH_COLOUR_STYLES[colour] || { bg:"#f1f5f9", text:"#64748b", border:"#e2e8f0" };
  return (
    <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`,
      borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>
      {colour}
    </span>
  );
}

// ── Cell ───────────────────────────────────────────────────────────────────────
function Cell({ col, value: rawValue, onChange, editing, onStartEdit, onEndEdit, onAnalyse, analysing, readonly }) {
  // Coerce value — arrays/numbers/null must never reach string renderers
  // Exception: sale_history and amenities are arrays and have dedicated renderers
  const isArrayCol = col.type === "sale_history" || col.type === "amenities";
  const value = (rawValue === null || rawValue === undefined || (Array.isArray(rawValue) && !isArrayCol)) ? "" : rawValue;
  const [local,    setLocal]    = useState(String(value));
  const [hovering, setHovering] = useState(false);
  const ref       = useRef();
  const anchorRef = useRef();
  useEffect(()=>{
    if (col.id==="comments" || col.id==="agent_notes") {
      // When editing starts: show full history so user can see & append
      // When editing ends: clear so next open is fresh
      if (editing) setLocal(String(value));
      else setLocal("");
    } else {
      setLocal(String(value));
    }
  },[value, editing]);
  useEffect(()=>{ if(editing&&ref.current) ref.current.focus(); },[editing]);

  const commit = ()=>{ onChange(local); onEndEdit(); };
  const kd = e=>{ if(e.key==="Enter"&&col.type!=="textarea") commit(); if(e.key==="Escape"){setLocal(String(value));onEndEdit();} };

  const cs = {
    width:col.width, minWidth:col.width, maxWidth:col.width,
    height: col.type==="image"||col.type==="textarea"||col.type==="ph_heatmap" ? 72 : 48,
    padding:"0 12px", boxSizing:"border-box", display:"flex", alignItems:"center",
    borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0",
    overflow:"hidden", flexShrink:0,
    background: editing?"#f0f9ff":"transparent",
    cursor: readonly ? "default" : "text", transition:"background 0.1s",
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
  if (col.type==="status_tag") {
    const STATUS_STYLES = {
      "Under Consideration": { bg:"#eff6ff", border:"#bfdbfe", text:"#1d4ed8", dot:"#3b82f6" },
      "Analysed & Passed":   { bg:"#f0fdf4", border:"#bbf7d0", text:"#15803d", dot:"#22c55e" },
      "Offered & Missed":    { bg:"#fff7ed", border:"#fed7aa", text:"#c2410c", dot:"#f97316" },
    };
    const current = value && STATUS_STYLES[value] ? value : "Under Consideration";
    const st = STATUS_STYLES[current];
    return (
      <div style={{ ...cs, padding:"0 8px" }}>
        <div style={{ position:"relative", width:"100%" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:st.bg, border:`1px solid ${st.border}`, borderRadius:20, padding:"3px 8px 3px 10px", width:"100%", boxSizing:"border-box" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:st.dot, flexShrink:0 }}/>
            <span style={{ fontSize:11, fontWeight:700, color:st.text, flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{current}</span>
            <select
              value={current}
              onChange={e => onChange(e.target.value)}
              style={{ position:"absolute", inset:0, opacity:0, cursor:"pointer", width:"100%", height:"100%" }}>
              {Object.keys(STATUS_STYLES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ fontSize:8, color:st.dot, flexShrink:0 }}>▼</span>
          </div>
        </div>
      </div>
    );
  }
  if (col.type==="ph_tag") {
    const s = value ? PH_COLOUR_STYLES[value] : null;
    const cellBg = s ? s.cell : "transparent";
    return (
      <div style={{ ...cs, background: cellBg, padding:"0 8px", transition:"background 0.2s" }}>
        <select
          value={value || ""}
          onChange={e => !readonly && onChange(e.target.value)}
          disabled={readonly}
          style={{
            width:"100%", border:"none", outline:"none", fontFamily:"inherit",
            fontSize:12, fontWeight:700, cursor: readonly ? "default" : "pointer",
            background:"transparent",
            color: s ? s.text : "#94a3b8",
            opacity: 1,
          }}>
          <option value="">— Select —</option>
          {PH_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    );
  }
  if (col.type==="calc_ph") {
    // Live lookup: match row address against street profiles
    const addr = (col._rowAddress || "").toLowerCase();
    const profiles = col._streetProfiles || [];
    const match = addr
      ? profiles.find(sp => {
          const street = (sp.street || "").toLowerCase();
          // Match on street name portion (before comma) within address
          const streetName = street.split(",")[0].trim();
          return streetName && addr.includes(streetName);
        })
      : null;
    const colours = match ? match.ph_profile : [];
    const colourList = Array.isArray(colours) ? colours : (colours ? [colours] : []);
    return (
      <div style={{ ...cs, cursor:"default", background:"#f8fafc", gap:4, flexWrap:"wrap" }}>
        {colourList.length > 0
          ? colourList.map(c => <PhTag key={c} colour={c} />)
          : <span style={{ fontSize:11, color:"#cbd5e1", fontStyle:"italic" }}>
              {addr ? "No match" : "—"}
            </span>}
      </div>
    );
  }
  if (col.type==="amenities") {
    // Per-user selections stored separately — read from col._userSel
    const selected = Array.isArray(col._userSel) ? col._userSel : [];
    const allItems = col._amenitiesCfg || [];
    const uid      = col._uid || "";
    const rowId    = String(col._rowId || "");
    const [open, setOpenAm] = useState(false);
    const [dropPos, setDropPos] = useState({ top:0, left:0, width:0 });
    const triggerRef = useRef();

    useEffect(() => {
      if (!open) return;
      const handler = (e) => {
        if (triggerRef.current && !triggerRef.current.contains(e.target) &&
            !document.getElementById("amenities-portal")?.contains(e.target)) {
          setOpenAm(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleOpen = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const dropH = Math.min(300, allItems.length * 45 + 48);
        const spaceBelow = window.innerHeight - rect.bottom;
        const top = spaceBelow < dropH + 8 ? rect.top + window.scrollY - dropH - 4 : rect.bottom + window.scrollY + 4;
        setDropPos({ top, left: rect.left + window.scrollX, width: Math.max(240, rect.width) });
      }
      setOpenAm(o => !o);
    };

    const toggle = async (name) => {
      if (!uid) return; // guard: no uid means user not ready yet
      const next = selected.includes(name)
        ? selected.filter(s => s !== name)
        : [...selected, name];
      // optimistic update via onChange (updates parent userAmenSel state)
      onChange(next);
      // persist to user's own Firestore path
      try {
        await saveUserAmenitiesSelections(uid, { ...(col._allSel || {}), [rowId]: next });
      } catch(e) {
        console.error("saveUserAmenitiesSelections error:", e);
      }
    };

    return (
      <div ref={triggerRef} style={{ ...cs, cursor:"pointer" }} onClick={handleOpen}>
        <div style={{ display:"flex", gap:4, flexWrap:"nowrap", overflow:"hidden", flex:1, alignItems:"center" }}>
          {selected.length === 0
            ? <span style={{ color:"#cbd5e1", fontSize:12 }}>Select…</span>
            : selected.slice(0,3).map(n => (
                <span key={n} style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:20, padding:"1px 7px", fontSize:10, fontWeight:600, color:"#7c3aed", whiteSpace:"nowrap" }}>{n}</span>
              ))
          }
          {selected.length > 3 && <span style={{ fontSize:10, color:"#94a3b8" }}>+{selected.length-3}</span>}
        </div>
        {open && createPortal(
          <div id="amenities-portal" style={{
            position:"absolute", top: dropPos.top, left: dropPos.left,
            width: dropPos.width, zIndex:99999,
            background:"#fff", border:"1px solid #e2e8f0", borderRadius:12,
            boxShadow:"0 8px 32px rgba(0,0,0,0.15)", maxHeight:300, overflowY:"auto", padding:8,
          }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 8px 8px" }}>
              <span style={{ fontSize:10, color:"#94a3b8", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>Your Amenities</span>
              <span style={{ fontSize:10, color:"#7c3aed", fontWeight:600 }}>{selected.length} selected</span>
            </div>
            {allItems.length === 0
              ? <div style={{ padding:"8px 12px", color:"#94a3b8", fontSize:12 }}>No amenities configured yet</div>
              : allItems.map(item => {
                  const checked = selected.includes(item.name);
                  return (
                    <div key={item.id} onClick={()=>toggle(item.name)}
                      style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderRadius:8, cursor:"pointer", background: checked?"#f5f3ff":"transparent", transition:"background 0.1s" }}>
                      <div style={{ width:16, height:16, borderRadius:4, border:`2px solid ${checked?"#8b5cf6":"#d1d5db"}`, background:checked?"#8b5cf6":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {checked && <span style={{ color:"#fff", fontSize:10, fontWeight:700 }}>✓</span>}
                      </div>
                      <span style={{ flex:1, fontSize:13, color: checked?"#7c3aed":"#374151", fontWeight: checked?600:400 }}>{item.name}</span>
                      <span style={{ fontSize:11, color:"#94a3b8", background:"#f1f5f9", borderRadius:10, padding:"1px 6px" }}>{item.score}pts</span>
                    </div>
                  );
                })
            }
          </div>,
          document.body
        )}
      </div>
    );
  }
  if (col.type==="ph_heatmap") {
    const [lightbox,  setLightbox]  = useState(false);
    const [inputMode, setInputMode] = useState(false); // url input or file
    const [urlDraft,  setUrlDraft]  = useState("");
    const fileRef = useRef();
    const trigRef2 = useRef();

    const openLightbox = (e) => { e.stopPropagation(); setLightbox(true); setInputMode(false); setUrlDraft(""); };
    const closeLightbox = () => { setLightbox(false); setInputMode(false); };

    const handleFile = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { onChange(ev.target.result); closeLightbox(); };
      reader.readAsDataURL(file);
    };

    const handleUrlSave = () => {
      if (urlDraft.trim()) { onChange(urlDraft.trim()); }
      closeLightbox();
    };

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (ev) => { onChange(ev.target.result); closeLightbox(); };
          reader.readAsDataURL(file);
          return;
        }
      }
    };

    return (
      <div ref={trigRef2}
        style={{ ...cs, height:72, cursor:"pointer", padding:"4px 6px", justifyContent:"center", flexDirection:"column", gap:4 }}
        onClick={value ? openLightbox : ()=>setLightbox(true)}>
        {value
          ? <img src={value} alt="PH Heatmap" style={{ width:"100%", height:64, objectFit:"cover", borderRadius:6, display:"block" }}/>
          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:64, gap:4, border:"1.5px dashed #e2e8f0", borderRadius:6, background:"#f8fafc" }}>
              <span style={{ fontSize:16 }}>🗺</span>
              <span style={{ color:"#cbd5e1", fontSize:9, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>Add Heatmap</span>
            </div>
        }

        {lightbox && createPortal(
          <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.75)", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(6px)" }}
            onClick={closeLightbox} onPaste={handlePaste}>
            <div style={{ background:"#fff", borderRadius:18, boxShadow:"0 30px 80px rgba(0,0,0,0.3)", width:"min(680px,95vw)", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column" }}
              onClick={e=>e.stopPropagation()}>

              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:"1px solid #f1f5f9" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:18 }}>🗺</span>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:16, color:"#0f172a" }}>PH Heatmap</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {value && (
                    <button onClick={()=>{onChange("");closeLightbox();}}
                      style={{ border:"1px solid #fecaca", background:"#fef2f2", borderRadius:8, padding:"6px 12px", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                      🗑 Remove
                    </button>
                  )}
                  <button onClick={closeLightbox}
                    style={{ border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#64748b", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                </div>
              </div>

              {/* Image preview */}
              {value && (
                <div style={{ padding:"16px 20px 0", flex:1, overflow:"auto", maxHeight:400 }}>
                  <img src={value} alt="PH Heatmap" style={{ width:"100%", borderRadius:10, display:"block", objectFit:"contain", maxHeight:360 }}/>
                </div>
              )}

              {/* Upload options */}
              <div style={{ padding:"16px 20px 20px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>
                  {value ? "Replace Image" : "Add Heatmap Image"}
                </div>
                <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                  {/* File upload */}
                  <button onClick={()=>fileRef.current?.click()}
                    style={{ flex:1, border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:10, padding:"12px", cursor:"pointer", textAlign:"center", color:"#64748b", fontSize:12, fontWeight:500 }}>
                    📁 Upload Image
                  </button>
                  <button onClick={()=>setInputMode(m=>!m)}
                    style={{ flex:1, border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:10, padding:"12px", cursor:"pointer", textAlign:"center", color:"#64748b", fontSize:12, fontWeight:500 }}>
                    🔗 Paste URL
                  </button>
                </div>
                {inputMode && (
                  <div style={{ display:"flex", gap:8 }}>
                    <input autoFocus value={urlDraft} onChange={e=>setUrlDraft(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&handleUrlSave()}
                      placeholder="https://... paste image URL here"
                      style={{ flex:1, border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:12, outline:"none", fontFamily:"inherit" }}/>
                    <button onClick={handleUrlSave}
                      style={{ border:"none", background:"#0ea5e9", borderRadius:8, padding:"8px 16px", color:"#fff", fontWeight:600, fontSize:12, cursor:"pointer" }}>Save</button>
                  </div>
                )}
                <div style={{ marginTop:10, color:"#94a3b8", fontSize:11, textAlign:"center" }}>
                  💡 You can also Ctrl+V / ⌘+V to paste a screenshot directly
                </div>
                <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile}/>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
  if (col.type==="sale_history") {
    const sales = Array.isArray(value) ? [...value].sort((a,b) => Number(a.year)-Number(b.year)) : [];
    const [modalOpen, setModalOpen] = useState(false);
    const [editSales, setEditSales] = useState([]);
    const [newYear,   setNewYear]   = useState("");
    const [newPrice,  setNewPrice]  = useState("");
    const [newNote,   setNewNote]   = useState("");
    const [modalPos,  setModalPos]  = useState({ top:0, left:0 });
    const trigRef = useRef();

    const openModal = (e) => {
      e.stopPropagation();
      const rect = trigRef.current?.getBoundingClientRect();
      if (rect) {
        const left = Math.min(rect.left + window.scrollX, window.innerWidth - 520 - 10);
        const top  = rect.bottom + window.scrollY + 6;
        setModalPos({ top: Math.max(10, top), left: Math.max(10, left) });
      }
      setEditSales([...sales]);
      setNewYear(""); setNewPrice(""); setNewNote("");
      setModalOpen(true);
    };

    const addEntry = () => {
      const yr = parseInt(newYear, 10);
      const pr = parseFloat(String(newPrice).replace(/[,$]/g,""));
      if (!yr || isNaN(pr)) return;
      const updated = [...editSales.filter(s=>String(s.year)!==String(yr)), { year:yr, price:pr, note:newNote.trim() }]
        .sort((a,b)=>a.year-b.year);
      setEditSales(updated);
      setNewYear(""); setNewPrice(""); setNewNote("");
    };

    const removeEntry = (yr) => setEditSales(editSales.filter(s=>String(s.year)!==String(yr)));

    const saveModal = () => { onChange(editSales); setModalOpen(false); };

    // Sparkline SVG
    const W=100, H=32, PAD=4;
    const SparkLine = ({ data }) => {
      if (!data || data.length < 2) return (
        <div style={{ width:W, height:H, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#cbd5e1", fontSize:10 }}>{data.length===1?"1 sale":"No data"}</span>
        </div>
      );
      const prices = data.map(d=>d.price);
      const minP = Math.min(...prices), maxP = Math.max(...prices);
      const range = maxP - minP || 1;
      const pts = data.map((d,i)=>({
        x: PAD + (i/(data.length-1))*(W-PAD*2),
        y: PAD + (1-(d.price-minP)/range)*(H-PAD*2),
      }));
      const pathD = pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const areaD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`;
      const isUp  = prices[prices.length-1] >= prices[0];
      const stroke = isUp ? "#22c55e" : "#ef4444";
      const fill   = isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
      return (
        <svg width={W} height={H} style={{ overflow:"visible", flexShrink:0 }}>
          <path d={areaD} fill={fill} stroke="none"/>
          <path d={pathD} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
          {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={2.5} fill={stroke} stroke="#fff" strokeWidth={1}/>)}
        </svg>
      );
    };

    // Full chart SVG (modal)
    const ChartSVG = ({ data }) => {
      if (!data || data.length === 0) return <div style={{ textAlign:"center", color:"#94a3b8", padding:"40px 0", fontSize:13 }}>No sales recorded yet</div>;
      const CW=460, CH=200, PL=72, PR=20, PT=20, PB=40;
      const IW = CW-PL-PR, IH = CH-PT-PB;
      const fmt = v => v>=1000000 ? `$${(v/1000000).toFixed(2)}M` : v>=1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`;

      // Historical data
      const sorted = [...data].sort((a,b)=>a.year-b.year);
      const prices = sorted.map(d=>d.price);
      const lastYear  = sorted[sorted.length-1].year;
      const lastPrice = sorted[sorted.length-1].price;
      const firstYear = sorted[0].year;
      const firstPrice = sorted[0].price;

      // CAGR from actual data
      const histYears = lastYear - firstYear;
      const cagrRate  = histYears > 0 ? Math.pow(lastPrice/firstPrice, 1/histYears) - 1 : 0.05;

      // Project 10 years forward using CAGR
      const PROJ_YEARS = 10;
      const projData = Array.from({length:PROJ_YEARS+1}, (_,i) => ({
        year:  lastYear + i,
        price: lastPrice * Math.pow(1 + cagrRate, i),
      }));
      // Confidence band ±15% of projected value (median ± uncertainty)
      const bandUpper = projData.map(p => ({ year:p.year, price: p.price * 1.15 }));
      const bandLower = projData.map(p => ({ year:p.year, price: p.price * 0.85 }));

      // Full X domain: first historical year → last projection year
      const allYears  = sorted.map(d=>d.year).concat(projData.map(d=>d.year));
      const minYear   = Math.min(...allYears);
      const maxYear   = Math.max(...allYears);
      const yearSpan  = maxYear - minYear || 1;

      // Full Y domain: all historical + all band prices
      const allPrices = prices
        .concat(projData.map(d=>d.price))
        .concat(bandUpper.map(d=>d.price))
        .concat(bandLower.map(d=>d.price));
      const minP = Math.min(...allPrices) * 0.92;
      const maxP = Math.max(...allPrices) * 1.06;
      const range = maxP - minP || 1;

      const toX = year  => PL + ((year - minYear) / yearSpan) * IW;
      const toY = price => PT + (1 - (price - minP) / range) * IH;

      // Historical path
      const histPts  = sorted.map(d => ({ x:toX(d.year), y:toY(d.price), ...d }));
      const histPath = histPts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const histArea = histPath + ` L${histPts[histPts.length-1].x.toFixed(1)},${PT+IH} L${PL},${PT+IH} Z`;

      // Projection median path (dashed)
      const projPts  = projData.map(d => ({ x:toX(d.year), y:toY(d.price), ...d }));
      const projPath = projPts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

      // Confidence band polygon
      const upperPts = bandUpper.map(d => `${toX(d.year).toFixed(1)},${toY(d.price).toFixed(1)}`);
      const lowerPts = [...bandLower].reverse().map(d => `${toX(d.year).toFixed(1)},${toY(d.price).toFixed(1)}`);
      const bandPath = `M ${upperPts.join(" L ")} L ${lowerPts.join(" L ")} Z`;

      const isUp   = lastPrice >= firstPrice;
      const stroke = isUp ? "#22c55e" : "#ef4444";
      const fill   = isUp ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)";

      // Y ticks
      const yTicks = [0,0.25,0.5,0.75,1].map(t=>({ val:minP+t*range, y:PT+IH-t*IH }));

      // X ticks: show first hist year, last hist year, proj midpoint, proj end
      const xTickYears = [...new Set([
        firstYear, lastYear,
        Math.round(lastYear + PROJ_YEARS/2),
        lastYear + PROJ_YEARS
      ])];

      // Projected end value for label
      const projEnd = projData[projData.length-1];

      return (
        <svg width={CW} height={CH} style={{ width:"100%", height:"auto", display:"block" }}>
          <defs>
            <pattern id="proj-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#e0f2fe" strokeWidth="3"/>
            </pattern>
          </defs>

          {/* Grid lines */}
          {yTicks.map((t,i)=>(
            <g key={i}>
              <line x1={PL} y1={t.y.toFixed(0)} x2={CW-PR} y2={t.y.toFixed(0)} stroke="#f1f5f9" strokeWidth="1"/>
              <text x={PL-6} y={t.y+4} textAnchor="end" fill="#94a3b8" fontSize="9">{fmt(t.val)}</text>
            </g>
          ))}

          {/* Projection zone background */}
          <rect x={toX(lastYear).toFixed(1)} y={PT} width={(IW-(toX(lastYear)-PL)).toFixed(1)} height={IH} fill="#f0f9ff" opacity="0.5"/>

          {/* Confidence band */}
          <path d={bandPath} fill="rgba(14,165,233,0.10)" stroke="none"/>
          <path d={`M ${upperPts.join(" L ")}`} fill="none" stroke="#bae6fd" strokeWidth="1" strokeDasharray="3,3"/>
          <path d={`M ${[...bandLower].reverse().map(d=>`${toX(d.year).toFixed(1)},${toY(d.price).toFixed(1)}`).join(" L ")}`} fill="none" stroke="#bae6fd" strokeWidth="1" strokeDasharray="3,3"/>

          {/* "Projection" label */}
          <text x={(toX(lastYear)+4).toFixed(1)} y={PT+10} fill="#7dd3fc" fontSize="8" fontWeight="700" textAnchor="start">PROJECTION ({(cagrRate*100).toFixed(1)}% CAGR)</text>

          {/* Historical area + line */}
          <path d={histArea} fill={fill}/>
          <path d={histPath} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>

          {/* Projection median dashed line */}
          <path d={projPath} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round"/>

          {/* Historical data points + labels */}
          {histPts.map((p,i)=>(
            <g key={i}>
              <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="4" fill={stroke} stroke="#fff" strokeWidth="1.5"/>
              <text x={p.x.toFixed(1)} y={p.y-9} textAnchor="middle" fill={stroke} fontSize="9" fontWeight="600">{fmt(p.price)}</text>
            </g>
          ))}

          {/* Projected end point + label */}
          <circle cx={projPts[projPts.length-1].x.toFixed(1)} cy={projPts[projPts.length-1].y.toFixed(1)} r="4" fill="#0ea5e9" stroke="#fff" strokeWidth="1.5"/>
          <text x={projPts[projPts.length-1].x.toFixed(1)} y={(projPts[projPts.length-1].y-9).toFixed(1)} textAnchor="middle" fill="#0369a1" fontSize="9" fontWeight="700">{fmt(projEnd.price)}</text>

          {/* Divider line between history and projection */}
          <line x1={toX(lastYear).toFixed(1)} y1={PT} x2={toX(lastYear).toFixed(1)} y2={PT+IH} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,3"/>

          {/* X axis labels */}
          {xTickYears.map(yr=>(
            <text key={yr} x={toX(yr).toFixed(1)} y={PT+IH+14} textAnchor="middle" fill={yr>lastYear?"#7dd3fc":"#64748b"} fontSize="9" fontWeight={yr===lastYear?"700":"400"}>{yr}</text>
          ))}

          {/* Axes */}
          <line x1={PL} y1={PT} x2={PL} y2={PT+IH} stroke="#e2e8f0" strokeWidth="1"/>
          <line x1={PL} y1={PT+IH} x2={CW-PR} y2={PT+IH} stroke="#e2e8f0" strokeWidth="1"/>
        </svg>
      );
    };

    // Growth calc
    const growth = sales.length >= 2
      ? ((sales[sales.length-1].price - sales[0].price) / sales[0].price * 100).toFixed(1)
      : null;
    const years = sales.length >= 2 ? sales[sales.length-1].year - sales[0].year : null;
    const cagr = (sales.length>=2 && years>0)
      ? ((Math.pow(sales[sales.length-1].price/sales[0].price, 1/years)-1)*100).toFixed(1)
      : null;

    return (
      <div ref={trigRef} style={{ ...cs, cursor:"pointer", padding:"0 8px", justifyContent:"center" }} onClick={openModal}>
        {sales.length === 0
          ? <span style={{ color:"#cbd5e1", fontSize:11 }}>+ Add</span>
          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, width:"100%" }}>
              <SparkLine data={sales} />
              {growth !== null && (
                <span style={{ fontSize:9, fontWeight:700, color: Number(growth)>=0?"#15803d":"#dc2626" }}>
                  {Number(growth)>=0?"+":""}{growth}% ({sales[0].year}–{sales[sales.length-1].year})
                </span>
              )}
            </div>
        }
        {modalOpen && createPortal(
          <div style={{ position:"fixed", inset:0, zIndex:3000 }} onClick={()=>setModalOpen(false)}>
            <div style={{ position:"absolute", top:modalPos.top, left:modalPos.left, width:500, background:"#fff", borderRadius:16, boxShadow:"0 20px 60px rgba(0,0,0,0.18)", border:"1px solid #e2e8f0", fontFamily:"'Inter',sans-serif" }}
              onClick={e=>e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding:"16px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, fontWeight:700, color:"#0f172a" }}>Sale History</div>
                  {growth!==null && <div style={{ fontSize:11, color:"#64748b", marginTop:2 }}>
                    Total growth: <strong style={{ color:Number(growth)>=0?"#15803d":"#dc2626" }}>{Number(growth)>=0?"+":""}{growth}%</strong>
                    {cagr && <> &nbsp;·&nbsp; CAGR: <strong style={{ color:Number(cagr)>=0?"#15803d":"#dc2626" }}>{Number(cagr)>=0?"+":""}{cagr}%/yr</strong></>}
                    {cagr && <> &nbsp;·&nbsp; <span style={{ color:"#0369a1" }}>10yr projection: <strong>${Math.round(editSales.length>0?editSales.sort((a,b)=>b.year-a.year)[0].price*Math.pow(1+Number(cagr)/100,10):0).toLocaleString()}</strong></span></>}
                  </div>}
                </div>
                <button onClick={()=>setModalOpen(false)} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, width:28, height:28, cursor:"pointer", color:"#64748b", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
              {/* Chart */}
              <div style={{ padding:"16px 20px 8px" }}>
                <ChartSVG data={editSales.sort((a,b)=>a.year-b.year)} />
              </div>
              {/* Entries table */}
              {editSales.length > 0 && (
                <div style={{ margin:"0 20px 12px", border:"1px solid #f1f5f9", borderRadius:8, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"70px 100px 1fr 28px", background:"#f8fafc", padding:"6px 10px", fontSize:10, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1 }}>
                    <span>Year</span><span>Price</span><span>Note</span><span></span>
                  </div>
                  {[...editSales].sort((a,b)=>b.year-a.year).map(s=>(
                    <div key={s.year} style={{ display:"grid", gridTemplateColumns:"70px 100px 1fr 28px", padding:"7px 10px", borderTop:"1px solid #f1f5f9", fontSize:12, alignItems:"center" }}>
                      <span style={{ fontWeight:600, color:"#374151" }}>{s.year}</span>
                      <span style={{ color:"#15803d", fontWeight:600 }}>${Number(s.price).toLocaleString()}</span>
                      <span style={{ color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.note||"—"}</span>
                      <button onClick={()=>removeEntry(s.year)} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:14, padding:0, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Add entry */}
              <div style={{ padding:"0 20px 16px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Add Sale</div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <input value={newYear} onChange={e=>setNewYear(e.target.value)} placeholder="Year e.g. 2018"
                    style={{ width:110, border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" }}/>
                  <input value={newPrice} onChange={e=>setNewPrice(e.target.value)} placeholder="Price e.g. 620000"
                    style={{ width:130, border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" }}/>
                  <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Note (optional)"
                    style={{ flex:1, minWidth:100, border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 10px", fontSize:12, outline:"none", fontFamily:"inherit" }}/>
                  <button onClick={addEntry} style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"7px 14px", color:"#fff", fontWeight:600, fontSize:12, cursor:"pointer" }}>+ Add</button>
                </div>
              </div>
              {/* Footer */}
              <div style={{ padding:"12px 20px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"flex-end", gap:8 }}>
                <button onClick={()=>setModalOpen(false)} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"8px 18px", color:"#64748b", cursor:"pointer", fontSize:13 }}>Cancel</button>
                <button onClick={saveModal} style={{ background:"#0f172a", border:"none", borderRadius:8, padding:"8px 18px", color:"#fff", fontWeight:600, fontSize:13, cursor:"pointer" }}>Save</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
  if (col.type==="score_card") {
    const selected  = Array.isArray(col._rowAmenities) ? col._rowAmenities : [];
    const allItems  = col._amenitiesCfg || [];
    const total     = selected.reduce((s, name) => {
      const item = allItems.find(i => i.name === name);
      return s + (item ? item.score : 0);
    }, 0);
    const maxScore  = allItems.reduce((s, i) => s + i.score, 0);
    const pct       = maxScore > 0 ? total / maxScore : 0;
    const colour    = pct >= 0.7 ? "#10b981" : pct >= 0.4 ? "#f59e0b" : total > 0 ? "#f87171" : "#cbd5e1";
    return (
      <div style={{ ...cs, cursor:"default", flexDirection:"column", gap:3, justifyContent:"center", padding:"0 12px" }}>
        {total > 0 ? (
          <>
            <div style={{ display:"flex", alignItems:"center", gap:6, width:"100%" }}>
              <div style={{ flex:1, height:5, background:"#e2e8f0", borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${pct*100}%`, height:"100%", background:colour, borderRadius:3, transition:"width 0.4s" }} />
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:colour, minWidth:32, textAlign:"right" }}>{total}pts</span>
            </div>
            {maxScore > 0 && <span style={{ fontSize:9, color:"#94a3b8" }}>of {maxScore} max</span>}
          </>
        ) : (
          <span style={{ color:"#cbd5e1", fontSize:12 }}>—</span>
        )}
      </div>
    );
  }
  if (col.type==="select") return (
    <div style={cs}>
      <select value={value||""} onChange={e=>!readonly&&onChange(e.target.value)}
        disabled={readonly}
        style={{ ...inputStyle, cursor:readonly?"default":"pointer", background:"transparent", opacity:1 }}>
        <option value="">—</option>
        {col.options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  if (col.type==="link") return (
    <div style={{ ...cs, gap:6 }} onClick={readonly?undefined:onStartEdit}>
      {editing
        ? <input ref={ref} value={local} onChange={e=>setLocal(e.target.value)} onBlur={()=>{onChange(local);onEndEdit();}} onKeyDown={kd} placeholder="Paste property URL" style={{ ...inputStyle, color:"#0ea5e9" }}/>
        : value
          ? <a href={value} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
              style={{ color:"#0ea5e9", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textDecoration:"none" }}>
              {String(value).replace(/^https?:\/\//,"").substring(0,30)}...
            </a>
          : <span style={{ color:"#cbd5e1", fontSize:13 }}>Paste URL</span>}
    </div>
  );
  const isTimestamped = col.id === "comments" || col.id === "agent_notes";

  // Parse timestamped entries: "DD/MM/YY HH:MM: text\n---\nDD/MM/YY HH:MM: text"
  const parseEntries = (v) => {
    if (!v) return [];
    return v.split("\n---\n").map(e => {
      const m = e.match(/^(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}): (.*)$/s);
      return m ? { ts: m[1], text: m[2] } : { ts: "", text: e };
    }).filter(e => e.text.trim());
  };

  const commitTimestamped = () => {
    const text = local.replace(/\s+$/, "");
    if (text !== (value || "").replace(/\s+$/, "")) {
      // Content changed — check if user added new text at the top vs editing existing
      const existingEntries = parseEntriesV2(value || "");
      const existingRaw = existingEntries.map(e => e.ts + ":\n" + e.text).join("\n---\n");
      // If the text starts with a known timestamp pattern it's being edited directly, save as-is
      // Otherwise wrap the new portion with a timestamp
      const startsWithTs = /^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}:/.test(text);
      if (startsWithTs) {
        onChange(text);
      } else {
        // New free-form note — prepend timestamp
        const now = new Date();
        const ts = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${String(now.getFullYear()).slice(-2)} ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
        const newEntry = ts + ":\n" + text;
        const prev = value ? String(value).replace(/\s+$/, "") : "";
        onChange(prev ? newEntry + "\n---\n" + prev : newEntry);
      }
    }
    onEndEdit();
  };

  // Parse entries — supports both new (ts:\ntext) and legacy (ts: text) formats
  const parseEntriesV2 = (v) => {
    if (!v) return [];
    return v.split("\n---\n").map(e => {
      const m = e.match(/^(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}):\n([\s\S]*)$/);
      if (m) return { ts: m[1], text: m[2] };
      const m2 = e.match(/^(\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}): ([\s\S]*)$/);
      if (m2) return { ts: m2[1], text: m2[2] };
      return { ts: "", text: e };
    }).filter(e => e.text.trim());
  };

  if (col.type==="textarea") return (
    <div style={{ ...cs, alignItems:"flex-start", paddingTop:8, position:"relative", flexDirection:"column", gap:4,
      height: (isTimestamped && editing) ? "auto" : cs.height, minHeight: cs.height }}
      onClick={readonly?undefined:onStartEdit}>
      {editing ? (
        <textarea ref={ref} value={local} onChange={e=>setLocal(e.target.value)}
          onBlur={isTimestamped ? commitTimestamped : commit}
          onKeyDown={e=>{ if(e.key==="Escape"){setLocal(String(value));onEndEdit();} }}
          placeholder={isTimestamped ? "Edit or append above existing notes..." : ""}
          style={{ ...inputStyle, height: isTimestamped ? 120 : 54, resize:"vertical", lineHeight:1.5, fontSize:12 }}/>
      ) : isTimestamped ? (
        <div ref={anchorRef} style={{ width:"100%", overflow:"hidden", position:"relative" }}
          onMouseEnter={()=>setHovering(true)} onMouseLeave={()=>setHovering(false)}>
          {parseEntriesV2(value).length > 0 ? parseEntriesV2(value).slice(0,1).map((e,i) => (
            <div key={i}>
              <div style={{ fontSize:9, color:"#94a3b8", fontWeight:600, marginBottom:1 }}>{e.ts}</div>
              <div style={{ fontSize:12, color:"#475569", overflow:"hidden", whiteSpace:"pre-line",
                display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{e.text}</div>
              {parseEntriesV2(value).length > 1 && (
                <div style={{ fontSize:10, color:"#0ea5e9", marginTop:2, fontWeight:500 }}>
                  +{parseEntriesV2(value).length-1} more — hover to read
                </div>
              )}
            </div>
          )) : <span style={{ fontSize:12, color:"#cbd5e1" }}>Add note</span>}
          {hovering && value && <NotePopup entries={parseEntriesV2(value)} anchorRef={anchorRef} />}
        </div>
      ) : (
        <span style={{ fontSize:12, color:value?"#475569":"#cbd5e1", overflow:"hidden", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", flex:1, width:"100%" }}>
          {value||(onAnalyse?"Click ✨ to generate":"Add note")}
        </span>
      )}
      {onAnalyse && !editing && (
        <button onClick={e=>{ e.stopPropagation(); onAnalyse(); }} disabled={analysing}
          style={{ position:"absolute", top:6, right:6, background:analysing?"#e2e8f0":"#f0f9ff", border:"1px solid #bae6fd", borderRadius:6, padding:"2px 7px", fontSize:11, color:analysing?"#94a3b8":"#0ea5e9", cursor:analysing?"not-allowed":"pointer", fontWeight:600, whiteSpace:"nowrap", zIndex:1 }}>
          {analysing ? "..." : "✨ AI"}
        </button>
      )}
    </div>
  );
  if (col.type==="readonly") return (
    <div style={{ ...cs, cursor:"default", background:"#f8fafc", height:"auto", minHeight:48, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontSize:13, fontWeight:700, color:value?"#0369a1":"#94a3b8", fontStyle:value?"normal":"italic", whiteSpace:"normal", wordBreak:"break-word" }}>
        {value || (col.id==="cost_of_purchase" ? "Enter offer price" : col.id==="yield" ? "Enter offer + rent" : "—")}
      </span>
    </div>
  );
  if (col.type==="currency") return (
    <div style={cs} onClick={onStartEdit}>
      {editing
        ? <input ref={ref} value={local}
            onChange={e => { setLocal(e.target.value); onChange(e.target.value); }}
            onBlur={commit} onKeyDown={kd} placeholder="$0"
            style={{ ...inputStyle, color:"#16a34a", fontWeight:600 }}/>
        : <span style={{ color:value?"#16a34a":"#cbd5e1", fontSize:13, fontWeight:600 }}>
            {value ? (()=>{ const s=String(value); return isNaN(s.replace(/[,$]/g,"")) ? s : `$${Number(s.replace(/[,$]/g,"")).toLocaleString()}`; })() : "—"}
          </span>}
    </div>
  );
  return (
    <div style={cs} onClick={readonly?undefined:onStartEdit}>
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
  if (!offer) return { cost_of_purchase: "", yield: "" };
  // Use purchase costs if available, otherwise just stamp duty + offer
  const general = pc
    ? ["conveyancing","building_inspection","pest_inspection","loan_application",
       "lenders_mortgage_insurance","title_search","settlement_agent","other"]
      .reduce((s, k) => s + (parseFloat(pc[k]) || 0), 0)
    : 0;
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
  const [showHelp,     setShowHelp]     = useState(false);
  const [nextId,       setNextId]       = useState(3);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [saving,       setSaving]       = useState(false);
  const [analysingRows,  setAnalysingRows]  = useState(new Set());
  const [pendingCount,   setPendingCount]   = useState(0);
  const [saveError,      setSaveError]      = useState("");
  const [dupAlert,       setDupAlert]       = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [guestNav,        setGuestNav]        = useState(DEFAULT_GUEST_NAV);
  const [showNavConfig,   setShowNavConfig]   = useState(false);
  const [dragColId,      setDragColId]      = useState(null); // column being dragged
  const [dragOverColId,  setDragOverColId]  = useState(null); // column being hovered over
  const [sortCol,        setSortCol]        = useState(null);  // column id to sort by
  const [sortDir,        setSortDir]        = useState("desc"); // "asc" | "desc"
  const [streetProfiles, setStreetProfiles] = useState([]);
  const [navOpen,        setNavOpen]        = useState(false);
  const [amenitiesCfg,   setAmenitiesCfg]   = useState([]);
  const [userAmenSel,    setUserAmenSel]    = useState({}); // { rowId: [names] }
  const [purchaseCosts,  setPurchaseCosts]  = useState(null);
  const purchaseCostsRef = useRef(null);

  // Keep ref in sync with state so updateCell always has fresh value
  useEffect(() => { purchaseCostsRef.current = purchaseCosts; }, [purchaseCosts]);

  useEffect(()=>{
    const initTracker = async () => {
      // Try user's own data first; if none, seed from shared (first-time setup)
      let { rows: r, cols: c } = await loadUserTrackerData(user.uid);
      if (!r) {
        const shared = await loadTrackerData();
        r = shared.rows;
        c = shared.cols;
        // Save shared data as this user's starting point
        if (r) await saveUserTrackerRows(user.uid, r);
        if (c) await saveUserTrackerCols(user.uid, c);
      }
      if (r) {
        const migrated = r.map(row => ({
          address: "",
          ...row,
          ph_rating: Array.isArray(row.ph_rating) ? (row.ph_rating[0] || "") : (row.ph_rating || ""),
          status: row.status || "Under Consideration",
          amenities: Array.isArray(row.amenities) ? row.amenities : [],
          ph_heatmap: row.ph_heatmap || "",
          sale_history: Array.isArray(row.sale_history) ? row.sale_history : [],
          calc_ph: row.calc_ph || "",
          score_card: row.score_card || "",
        }));
        setRows(migrated);
        setNextId(Math.max(...migrated.map(x=>x.id),0)+1);
      }
      // Always use latest MANDATORY_COLUMNS for locked cols + preserve custom cols
      const customCols = c ? c.filter(sc => !sc.locked) : [];
      setColumns([...MANDATORY_COLUMNS, ...customCols]);
    };
    initTracker();
    loadPurchaseCosts().then(d => { if(d) { setPurchaseCosts(d); purchaseCostsRef.current = d; } });
    loadGuestNavAccess().then(d => setGuestNav(d));
    loadStreetProfiles().then(d => setStreetProfiles(d));
    // Load user's own amenities config; fall back to shared admin list, then hardcoded defaults
    Promise.all([loadAmenities(), loadUserAmenitiesConfig(user.uid)]).then(([shared, userCfg]) => {
      const master = shared.length > 0 ? shared : DEFAULT_AMENITIES;
      setAmenitiesCfg(userCfg && userCfg.length > 0 ? userCfg : master);
    });
    loadUserAmenitiesSelections(user.uid).then(sel => setUserAmenSel(sel || {}));
    // Real-time listener for pending access requests
    const unsubPending = onPendingCountChange(count => setPendingCount(count));
    return () => unsubPending();
  },[]);

  const saveRows     = useCallback(async (nr)=>{ 
    setRows(nr); setSaving(true); 
    try { await saveUserTrackerRows(user.uid, nr); setSaveError(""); } 
    catch(e) { console.error("saveRows error:",e); setSaveError("Save failed: " + (e.code || e.message)); }
    setSaving(false); 
  },[user.uid]);
  const saveCols     = useCallback(async (nc)=>{ 
    setColumns(nc); 
    try { await saveUserTrackerCols(user.uid, nc); setSaveError(""); } 
    catch(e) { console.error("saveCols error:",e); setSaveError("Save failed: " + (e.code || e.message)); }
  },[user.uid]);
  const updateCell = (rowId, colId, v) => {
    // Duplicate address guard
    if (colId === "address" && v && v.trim()) {
      if (isDupAddress(v.trim(), rowId)) {
        showDupAlert(v.trim());
        return; // reject the update
      }
    }
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
      saveUserTrackerRows(user.uid, updated).then(() => { setSaving(false); setSaveError(""); }).catch(e => { setSaving(false); setSaveError("Save failed: " + (e.code || e.message)); console.error("updateCell save error:",e); });
      return updated;
    });
  };
  const addRow       = () => { const row={id:nextId, status:"Under Consideration", amenities:[], score_card:"", ph_heatmap:"", sale_history:[], ...Object.fromEntries(columns.map(c=>[c.id,""]))}; setNextId(n=>n+1); saveRows([...rows,row]); };
  const deleteRows   = () => { saveRows(rows.filter(r=>!selectedRows.has(r.id))); setSelectedRows(new Set()); };
  const addColumn    = col => { saveCols([...columns,col]); saveRows(rows.map(r=>({...r,[col.id]:""})));};

  const handleResetDashboard = async () => {
    setSaving(true);
    await clearUserDashboard(user.uid);
    setRows(INITIAL_ROWS);
    setColumns(MANDATORY_COLUMNS);
    setNextId(INITIAL_ROWS.length + 1);
    setSelectedRows(new Set());
    setSaving(false);
    setShowResetConfirm(false);
  };

  const isDupAddress = (address, excludeRowId = null) => {
    if (!address || !address.trim()) return false;
    const norm = address.trim().toLowerCase();
    return rows.some(r => r.id !== excludeRowId && (r.address||"").trim().toLowerCase() === norm);
  };
  const showDupAlert = (address) => {
    setDupAlert(`Duplicate entry — "${address}" already exists in your list.`);
    setTimeout(() => setDupAlert(""), 5000);
  };
  const removeColumn = id  => saveCols(columns.filter(c=>c.id!==id));

  const handleColDragStart = (e, colId) => {
    setDragColId(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", colId);
  };
  const handleColDragOver = (e, colId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (colId !== dragColId) setDragOverColId(colId);
  };
  const handleColDrop = (e, targetColId) => {
    e.preventDefault();
    if (!dragColId || dragColId === targetColId) { setDragColId(null); setDragOverColId(null); return; }
    const from = columns.findIndex(c => c.id === dragColId);
    const to   = columns.findIndex(c => c.id === targetColId);
    if (from === -1 || to === -1) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    saveCols(reordered);
    setDragColId(null);
    setDragOverColId(null);
  };
  const handleColDragEnd = () => { setDragColId(null); setDragOverColId(null); };

  const handleColSort = (colId) => {
    if (!SORTABLE_COLS.has(colId)) return;
    if (sortCol === colId) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(colId);
      setSortDir("desc");
    }
  };

  // Parse numeric value from any cell (handles $, %, "days", commas)
  const parseNum = (v) => {
    if (v === null || v === undefined || v === "") return -Infinity;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? -Infinity : n;
  };

  const sortRows = (rowSet) => {
    if (!sortCol) return rowSet;
    return [...rowSet].sort((a, b) => {
      const av = parseNum(a[sortCol]), bv = parseNum(b[sortCol]);
      return sortDir === "desc" ? bv - av : av - bv;
    });
  };

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
    // Duplicate address guard
    if (parsed.address && parsed.address.trim()) {
      if (isDupAddress(parsed.address.trim())) {
        showDupAlert(parsed.address.trim());
        return;
      }
    }
    // Auto-match PH rating from street profiles by checking if address contains a known street
    const addr = (parsed.address || "").toLowerCase();
    const matchedStreet = streetProfiles.find(sp =>
      addr && sp.street && addr.includes(sp.street.toLowerCase().split(",")[0].trim())
    );
    const row = {
      id: nextId,
      status:      "Under Consideration",
      amenities:   [],
      score_card:  "",
      ph_heatmap:   "",
      sale_history: [],
      ...Object.fromEntries(columns.map(c=>[c.id,""])),
      property:    parsed.property  || "",
      address:     parsed.address   || "",
      price:       parsed.price     || "",
      config:      parsed.config    || "",
      land:        parsed.land      || "",
      suburb:      parsed.suburb    || "",
      state:       parsed.state     || "",
      ph_rating:   matchedStreet ? (Array.isArray(matchedStreet.ph_profile) ? matchedStreet.ph_profile[0] || "" : matchedStreet.ph_profile) : "",
      comments:    "",
      agent_notes: "",
    };
    setNextId(n=>n+1);
    saveRows([...rows, row]);
  };

  const recalcPH = () => {
    const updated = rows.map(row => {
      const addr = (row.address || "").toLowerCase();
      if (!addr) return row;
      const match = streetProfiles.find(sp => {
        const streetName = (sp.street || "").toLowerCase().split(",")[0].trim();
        return streetName && addr.includes(streetName);
      });
      const colours = match ? match.ph_profile : [];
      const colourList = Array.isArray(colours) ? colours : (colours ? [colours] : []);
      return { ...row, calc_ph: colourList.join(", ") };
    });
    saveRows(updated);
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
        /* ── Mobile ── */
        .nav-links { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .nav-menu-btn { display:none; }
        .nav-dropdown { display:none; }
        .nav-dropdown.open { display:flex; flex-direction:column; gap:8px; }
        .page-header { padding:20px 16px 16px; }
        .page-title { font-size:24px !important; }
        .actions-bar { gap:8px; }
        .stat-cards { gap:10px; margin-top:14px; }
        .stat-card { padding:10px 14px !important; }
        .grid-wrap { padding:12px 8px 32px !important; }
        @media(max-width:640px){
          .nav-links { display:none; }
          .nav-links.open { display:flex; flex-direction:column; align-items:flex-start; position:absolute; top:56px; left:0; right:0; background:#fff; border-bottom:1px solid #e2e8f0; padding:12px 16px; z-index:200; box-shadow:0 4px 12px rgba(0,0,0,0.08); gap:8px; }
          .nav-menu-btn { display:flex !important; }
          .user-chip span.name { display:none; }
          .page-header { padding:16px 16px 12px !important; }
          .page-title { font-size:22px !important; }
          .actions-bar { width:100%; }
          .actions-bar button { flex:1; min-width:0; font-size:12px !important; padding:8px 10px !important; }
          .stat-cards { flex-direction:row; flex-wrap:wrap; }
          .stat-card { flex:1; min-width:120px; }
          .grid-wrap { padding:8px 0 24px !important; }
          .grid-hint { display:none; }
        }
      `}</style>

      <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter', sans-serif", color:"#1e293b" }}>

        {/* Navbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Hamburger — mobile only */}
            <button className="nav-menu-btn" onClick={()=>setNavOpen(o=>!o)}
              style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, color:"#64748b", padding:"2px 4px", display:"none" }}>
              ☰
            </button>
            <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>&#127968;</div>
            <span style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:17, color:"#0f172a" }}>Property Analysis</span>
            {saving && <span style={{ color:"#94a3b8", fontSize:10, background:"#f1f5f9", borderRadius:20, padding:"2px 8px" }}>Saving…</span>}
            {saveError && <span style={{ color:"#dc2626", fontSize:10, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:20, padding:"2px 8px" }}>⚠ {saveError}</span>}
            {dupAlert  && <span style={{ color:"#b45309", fontSize:10, background:"#fffbeb", border:"1px solid #fde68a", borderRadius:20, padding:"2px 10px", fontWeight:600 }}>⚠ {dupAlert}</span>}
          </div>
          {/* Nav links — hidden on mobile, shown via hamburger */}
          {(()=>{
            const NAV_TABS = [
              { id:"purchase-costs",  label:"💰 Purchase Costs",   bg:"#f0fdf4", border:"#bbf7d0", color:"#16a34a" },
              { id:"suburb-profiles", label:"🏘 Suburb Profiles",  bg:"#f0f9ff", border:"#bae6fd", color:"#0369a1" },
              { id:"street-profiles", label:"🏚 Street PH Profiles",bg:"#fffbeb", border:"#fde68a", color:"#b45309" },
              { id:"amenities",       label:"⭐ Amenities",         bg:"#f5f3ff", border:"#ddd6fe", color:"#7c3aed" },
              { id:"dsr",             label:"📊 DSR Data",          bg:"#f0f9ff", border:"#bae6fd", color:"#0369a1" },
              { id:"checklist",       label:"✅ Checklist",         bg:"#f0fdf4", border:"#bbf7d0", color:"#15803d" },
            ];
            const visibleTabs = NAV_TABS.filter(t => isAdmin || guestNav[t.id]);
            return (
              <div className={"nav-links" + (navOpen ? " open" : "")} style={{ display:"flex", alignItems:"center", gap:8 }}>
                {visibleTabs.map(t => (
                  <button key={t.id} onClick={()=>{ onNavigate&&onNavigate(t.id); setNavOpen(false); }}
                    style={{ background:t.bg, border:`1px solid ${t.border}`, borderRadius:8, padding:"6px 12px", color:t.color, cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
                    {t.label}
                  </button>
                ))}
              </div>
            );
          })()}
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {isAdmin && (
              <button onClick={()=>setShowNavConfig(true)}
                style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"6px 12px", color:"#0369a1", cursor:"pointer", fontSize:12, fontWeight:600 }}>
                🔒 Guest Access
              </button>
            )}
            {isAdmin && (
              <button onClick={()=>setShowAdmin(true)}
                style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:8, padding:"6px 12px", color:"#7c3aed", cursor:"pointer", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6, position:"relative" }}>
                ⚙ Admin
                {pendingCount > 0 && (
                  <span style={{ background:"#ef4444", color:"#fff", borderRadius:"50%", width:17, height:17, fontSize:10, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            )}
            <button onClick={()=>setShowHelp(true)}
              style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#64748b", fontSize:15, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}
              title="Help & Guide">
              ?
            </button>
            <div className="user-chip" style={{ display:"flex", alignItems:"center", gap:6, background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:24, padding:"4px 10px 4px 5px" }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width:24, height:24, borderRadius:"50%", objectFit:"cover" }}/>}
              <span className="name" style={{ color:"#374151", fontSize:12, fontWeight:500, maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{user.displayName||user.email}</span>
              {isAdmin && <span style={{ background:"#7c3aed", borderRadius:10, padding:"1px 7px", fontSize:10, color:"#fff", fontWeight:700 }}>ADMIN</span>}
            </div>
            <button onClick={onSignOut} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 10px", color:"#94a3b8", cursor:"pointer", fontSize:12 }}>
              Out
            </button>
          </div>
        </div>

        {/* Page Header */}
        <div className="page-header" style={{ padding:"24px 20px 16px", borderBottom:"1px solid #e2e8f0", background:"#fff" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:16 }}>
            <div>
              <p style={{ margin:"0 0 4px", color:"#94a3b8", fontSize:12, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>Property Analysis</p>
              <h1 className="page-title" style={{ margin:0, fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:700, color:"#0f172a", letterSpacing:-0.5 }}>
                Property Dashboard
              </h1>
            </div>
            <div className="actions-bar" style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
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
              <button onClick={recalcPH}
                style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"9px 16px", color:"#b45309", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                &#8635; PH Recalculate
              </button>
              <button onClick={()=>setShowResetConfirm(true)}
                style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"9px 16px", color:"#dc2626", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                🗑 Reset Data
              </button>
              <button onClick={()=>setShowQuickAdd(true)}
                style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, boxShadow:"0 2px 8px rgba(14,165,233,0.35)", display:"flex", alignItems:"center", gap:6 }}>
                &#10024; Add Property
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="stat-cards" style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
            {[
              { label:"Total Properties",     value:rows.length,                                                               color:"#0ea5e9" },
              { label:"Under Consideration",  value:rows.filter(r=>!r.status||r.status==="Under Consideration").length,        color:"#3b82f6" },
              { label:"Analysed & Passed",    value:rows.filter(r=>r.status==="Analysed & Passed").length,                    color:"#22c55e" },
              { label:"Offered & Missed",     value:rows.filter(r=>r.status==="Offered & Missed").length,                    color:"#f97316" },
            ].map(s=>(
              <div key={s.label} className="stat-card" style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
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
        {(()=>{
          // Helper: render a set of rows
          const renderRows = (rowSet) => rowSet.map((row,idx)=>(
            <div key={row.id} className="rh"
              style={{ display:"flex", background:idx%2===0?"#fff":"#fafbfc", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ width:52, minWidth:52, display:"flex", alignItems:"center", justifyContent:"center", borderRight:"1px solid #e2e8f0", background:"inherit" }}>
                <input type="checkbox" style={{ accentColor:"#0ea5e9", cursor:"pointer", width:15, height:15 }}
                  checked={selectedRows.has(row.id)}
                  onChange={e=>{ const s=new Set(selectedRows); e.target.checked?s.add(row.id):s.delete(row.id); setSelectedRows(s); }}/>
              </div>
              {columns.map(col=>{
                const userSelForRow = userAmenSel[String(row.id)] || [];
                const enrichedCol = col.type==="calc_ph"
                  ? { ...col, _rowAddress: row.address||"", _streetProfiles: streetProfiles }
                  : col.type==="amenities"
                  ? { ...col, _amenitiesCfg: amenitiesCfg, _rowId: row.id, _userSel: userSelForRow, _uid: user.uid, _allSel: userAmenSel }
                  : col.type==="score_card"
                  ? { ...col, _amenitiesCfg: amenitiesCfg, _rowAmenities: userSelForRow }
                  : col;
                const handleCellChange = col.type==="amenities"
                  ? (next) => setUserAmenSel(prev => ({ ...prev, [String(row.id)]: next }))
                  : col.type==="score_card"
                  ? () => {}
                  : (v) => updateCell(row.id, col.id, v);
                return (
                  <Cell key={col.id} col={enrichedCol} value={row[col.id]}
                    onChange={handleCellChange}
                    editing={editing?.rowId===row.id&&editing?.colId===col.id}
                    onStartEdit={()=>setEditing({rowId:row.id,colId:col.id})}
                    onEndEdit={()=>setEditing(null)}
                    onAnalyse={null} analysing={false} readonly={false}/>
                );
              })}
            </div>
          ));

          // Helper: render column headers (called as fn so no duplicate React key issue)
          const ColHeaders = ({sectionKey}) => (
            <div style={{ display:"flex", background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
              <div style={{ width:52, minWidth:52, display:"flex", alignItems:"center", justifyContent:"center", borderRight:"1px solid #e2e8f0", padding:"12px 0" }}>
                <input type="checkbox" style={{ accentColor:"#0ea5e9", cursor:"pointer", width:15, height:15 }}
                  checked={selectedRows.size===rows.length&&rows.length>0}
                  onChange={e=>setSelectedRows(e.target.checked?new Set(rows.map(r=>r.id)):new Set())}/>
              </div>
              {columns.map(col=>{
                const isDragging = dragColId === col.id;
                const isOver     = dragOverColId === col.id && dragColId !== col.id;
                return (
                  <div key={col.id} className="ch"
                    draggable
                    onDragStart={e => handleColDragStart(e, col.id)}
                    onDragOver={e  => handleColDragOver(e, col.id)}
                    onDrop={e      => handleColDrop(e, col.id)}
                    onDragEnd={handleColDragEnd}
                    style={{
                      width:col.width, minWidth:col.width,
                      display:"flex", alignItems:"center", justifyContent:"space-between",
                      padding:"12px 12px", borderRight:"1px solid #e2e8f0",
                      cursor:"grab",
                      opacity: isDragging ? 0.4 : 1,
                      background: isOver ? "#e0f2fe" : "transparent",
                      borderLeft: isOver ? "2px solid #0ea5e9" : "2px solid transparent",
                      transition:"background 0.1s, border-color 0.1s",
                      userSelect:"none",
                    }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, flex:1, minWidth:0 }}
                      onClick={e=>{ e.stopPropagation(); handleColSort(col.id); }}>
                      <span style={{ color:"#c7d2dd", fontSize:12, flexShrink:0, lineHeight:1 }}>⠿</span>
                      <span style={{ color: sortCol===col.id ? "#0ea5e9" : "#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{col.label}</span>
                      {SORTABLE_COLS.has(col.id) && (
                        <span style={{ fontSize:9, color: sortCol===col.id ? "#0ea5e9" : "#cbd5e1", flexShrink:0 }}>
                          {sortCol===col.id ? (sortDir==="desc" ? "▼" : "▲") : "⇅"}
                        </span>
                      )}
                    </div>
                    {!col.locked && (
                      <button className="rc" onClick={e=>{ e.stopPropagation(); removeColumn(col.id); }}
                        style={{ opacity:0, pointerEvents:"none", background:"#fef2f2", border:"none", borderRadius:4, width:18, height:18, color:"#dc2626", cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", transition:"opacity 0.15s", flexShrink:0 }}>
                        &#10005;
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );

          const addRowFooter = (
            <div onClick={addRow}
              style={{ display:"flex", height:44, cursor:"pointer", borderTop:"1px solid #f1f5f9", background:"#fafbfc" }}
              onMouseEnter={e=>e.currentTarget.style.background="#f1f5f9"}
              onMouseLeave={e=>e.currentTarget.style.background="#fafbfc"}>
              <div style={{ width:52, minWidth:52, borderRight:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:20 }}>+</div>
              <div style={{ flex:1, display:"flex", alignItems:"center", padding:"0 12px", color:"#94a3b8", fontSize:13 }}>Click to add a new row...</div>
            </div>
          );

          const considering = sortRows(rows.filter(r => !r.status || r.status === "Under Consideration"));
          const passed      = sortRows(rows.filter(r => r.status === "Analysed & Passed"));
          const offeredMissed = sortRows(rows.filter(r => r.status === "Offered & Missed"));

          return (
            <div className="grid-wrap" style={{ overflowX:"auto", padding:"16px 12px 40px" }}>
              <div style={{ minWidth:totalWidth }}>

                {/* ── Under Consideration ── */}
                <div style={{ marginBottom:24 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 4px 10px" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"#3b82f6", flexShrink:0 }}/>
                    <span style={{ fontSize:13, fontWeight:700, color:"#1d4ed8", textTransform:"uppercase", letterSpacing:1 }}>Under Consideration</span>
                    <span style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:20, padding:"1px 10px", fontSize:11, fontWeight:700, color:"#1d4ed8" }}>{considering.length}</span>
                  </div>
                  <div style={{ background:"#fff", border:"1px solid #bfdbfe", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(59,130,246,0.08)" }}>
                    <ColHeaders sectionKey="considering" />
                    {considering.length === 0
                      ? <div style={{ padding:"28px 20px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>No properties under consideration — add one above.</div>
                      : renderRows(considering)
                    }
                    {addRowFooter}
                  </div>
                </div>

                {/* ── Analysed & Passed ── */}
                <div style={{ marginBottom:24 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 4px 10px" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"#22c55e", flexShrink:0 }}/>
                    <span style={{ fontSize:13, fontWeight:700, color:"#15803d", textTransform:"uppercase", letterSpacing:1 }}>Analysed & Passed</span>
                    <span style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"1px 10px", fontSize:11, fontWeight:700, color:"#15803d" }}>{passed.length}</span>
                  </div>
                  <div style={{ background:"#fff", border:"1px solid #bbf7d0", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(34,197,94,0.08)", opacity: passed.length===0 ? 0.6 : 1 }}>
                    <ColHeaders sectionKey="passed" />
                    {passed.length === 0
                      ? <div style={{ padding:"28px 20px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>No properties marked as passed yet.</div>
                      : renderRows(passed)
                    }
                  </div>
                </div>

                {/* ── Offered & Missed ── */}
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 4px 10px" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%", background:"#f97316", flexShrink:0 }}/>
                    <span style={{ fontSize:13, fontWeight:700, color:"#c2410c", textTransform:"uppercase", letterSpacing:1 }}>Offered & Missed</span>
                    <span style={{ background:"#fff7ed", border:"1px solid #fed7aa", borderRadius:20, padding:"1px 10px", fontSize:11, fontWeight:700, color:"#c2410c" }}>{offeredMissed.length}</span>
                  </div>
                  <div style={{ background:"#fff", border:"1px solid #fed7aa", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(249,115,22,0.08)", opacity: offeredMissed.length===0 ? 0.6 : 1 }}>
                    <ColHeaders sectionKey="offeredMissed" />
                    {offeredMissed.length === 0
                      ? <div style={{ padding:"28px 20px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>No offered & missed properties yet.</div>
                      : renderRows(offeredMissed)
                    }
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        <div className="grid-hint" style={{ padding:"0 20px 24px", color:"#cbd5e1", fontSize:12 }}>
          Click any cell to edit &nbsp;&#183;&nbsp; Enter to confirm &nbsp;&#183;&nbsp; Esc to cancel &nbsp;&#183;&nbsp; Drag column headers to reorder &nbsp;&#183;&nbsp; Click numeric headers to sort &nbsp;&#183;&nbsp; Use "&#10024; Add Property" to auto-fill
        </div>
      </div>

      {showAddCol   && <AddColumnModal onAdd={addColumn} onClose={()=>setShowAddCol(false)}/>}
      {showAdmin    && <AdminPanel onClose={()=>setShowAdmin(false)}/>}
      {showHelp     && <HelpPanel onClose={()=>setShowHelp(false)} isAdmin={isAdmin}/>}
      {showQuickAdd && <QuickAddModal onAdd={quickAddProperty} onClose={()=>setShowQuickAdd(false)}/>}


      {/* Guest Nav Access Modal */}
      {showNavConfig && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }}
          onClick={()=>setShowNavConfig(false)}>
          <div style={{ background:"#fff", borderRadius:18, width:"min(440px,95vw)", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", fontFamily:"'Inter',sans-serif", overflow:"hidden" }}
            onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #f1f5f9" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#0f172a" }}>🔒 Guest Tab Access</div>
                  <div style={{ fontSize:12, color:"#94a3b8", marginTop:3 }}>Choose which navigation tabs guests can see</div>
                </div>
                <button onClick={()=>setShowNavConfig(false)}
                  style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#64748b", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              </div>
            </div>
            {/* Tab toggles */}
            <div style={{ padding:"8px 0" }}>
              {[
                { id:"purchase-costs",  label:"Purchase Costs",    icon:"💰", desc:"Stamp duty and cost calculators" },
                { id:"suburb-profiles", label:"Suburb Profiles",   icon:"🏘", desc:"Suburb analysis data" },
                { id:"street-profiles", label:"Street PH Profiles",icon:"🏚", desc:"Street public housing ratings" },
                { id:"amenities",       label:"Amenities",          icon:"⭐", desc:"Property amenity scoring" },
                { id:"dsr",             label:"DSR Data",           icon:"📊", desc:"Demand to supply ratio data" },
                { id:"checklist",       label:"Checklist",          icon:"✅", desc:"Property due diligence checklist" },
              ].map(tab => {
                const enabled = guestNav[tab.id] !== false;
                const toggle = () => {
                  const updated = { ...guestNav, [tab.id]: !enabled };
                  setGuestNav(updated);
                  saveGuestNavAccess(updated);
                };
                return (
                  <div key={tab.id} onClick={toggle}
                    style={{ display:"flex", alignItems:"center", gap:14, padding:"13px 24px", cursor:"pointer", borderBottom:"1px solid #f8fafc", transition:"background 0.1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{tab.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{tab.label}</div>
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{tab.desc}</div>
                    </div>
                    {/* Toggle switch */}
                    <div style={{ width:42, height:24, borderRadius:12, background:enabled?"#0ea5e9":"#e2e8f0", transition:"background 0.2s", flexShrink:0, position:"relative" }}>
                      <div style={{ position:"absolute", top:3, left: enabled?18:3, width:18, height:18, borderRadius:"50%", background:"#fff", boxShadow:"0 1px 3px rgba(0,0,0,0.15)", transition:"left 0.2s" }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:enabled?"#0ea5e9":"#94a3b8", minWidth:24, textAlign:"right" }}>{enabled?"ON":"OFF"}</span>
                  </div>
                );
              })}
            </div>
            {/* Footer note */}
            <div style={{ padding:"14px 24px 18px", background:"#f8fafc", borderTop:"1px solid #f1f5f9" }}>
              <p style={{ margin:0, fontSize:11, color:"#94a3b8", lineHeight:1.6 }}>
                ℹ Admins always see all tabs regardless of these settings. Changes take effect immediately for all guest users.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Reset Dashboard Confirm Modal */}
      {showResetConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#fff", borderRadius:16, padding:32, width:"min(420px,93vw)", boxShadow:"0 20px 60px rgba(0,0,0,0.18)", textAlign:"center", fontFamily:"'Inter',sans-serif" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗑</div>
            <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:"#0f172a", margin:"0 0 10px" }}>Reset Your Dashboard?</h3>
            <p style={{ color:"#64748b", fontSize:13, margin:"0 0 6px", lineHeight:1.6 }}>
              This will permanently delete all <strong>{rows.length} propert{rows.length===1?"y":"ies"}</strong> from your dashboard and reset columns to default.
            </p>
            <p style={{ color:"#94a3b8", fontSize:12, margin:"0 0 28px" }}>Other users' data is not affected.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={()=>setShowResetConfirm(false)}
                style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"11px 24px", color:"#64748b", cursor:"pointer", fontSize:14 }}>
                Cancel
              </button>
              <button onClick={handleResetDashboard}
                style={{ background:"#dc2626", border:"none", borderRadius:8, padding:"11px 24px", color:"#fff", cursor:"pointer", fontSize:14, fontWeight:700 }}>
                Yes, Reset My Data
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { loadTrackerData, saveTrackerRows, saveTrackerCols, loadUserTrackerData, saveUserTrackerRows, saveUserTrackerCols, loadPurchaseCosts, onPendingCountChange, loadStreetProfiles, loadAmenities, DEFAULT_AMENITIES, loadUserAmenitiesSelections, saveUserAmenitiesSelections, loadUserAmenitiesConfig } from "../firebase.js";
import { calcStampDuty, formatCurrency } from "../stampDuty.js";
import AdminPanel from "./AdminPanel.jsx";

const MANDATORY_COLUMNS = [
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
];

const INITIAL_ROWS = [
  { id:1, address:"", property:"", price:"", config:"", land:"", ph_rating:"", calc_ph:"", suburb:"", state:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"", amenities:[], score_card:"" },
  { id:2, address:"", property:"", price:"", config:"", land:"", ph_rating:"", calc_ph:"", suburb:"", state:"", type:"", offer_price:"", rental_appraisal:"", cost_of_purchase:"", yield:"", comments:"", agent_notes:"", amenities:[], score_card:"" },
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
function Cell({ col, value, onChange, editing, onStartEdit, onEndEdit, onAnalyse, analysing, readonly }) {
  const [local,    setLocal]    = useState(value||"");
  const [hovering, setHovering] = useState(false);
  const ref       = useRef();
  const anchorRef = useRef();
  useEffect(()=>{
    if (col.id==="comments" || col.id==="agent_notes") {
      // When editing starts: show full history so user can see & append
      // When editing ends: clear so next open is fresh
      if (editing) setLocal(value||"");
      else setLocal("");
    } else {
      setLocal(value||"");
    }
  },[value, editing]);
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
      const next = selected.includes(name)
        ? selected.filter(s => s !== name)
        : [...selected, name];
      // optimistic update via onChange (updates parent userAmenSel state)
      onChange(next);
      // persist to user's own Firestore path
      await saveUserAmenitiesSelections(uid, { ...col._allSel, [rowId]: next });
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
              {value.replace(/^https?:\/\//,"").substring(0,30)}...
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
        const prev = value ? value.replace(/\s+$/, "") : "";
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
          onKeyDown={e=>{ if(e.key==="Escape"){setLocal(value||"");onEndEdit();} }}
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
            {value ? (isNaN(value.replace(/[,$]/g,"")) ? value : `$${Number(value.replace(/[,$]/g,"")).toLocaleString()}`) : "—"}
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
  const [nextId,       setNextId]       = useState(3);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [saving,       setSaving]       = useState(false);
  const [analysingRows,  setAnalysingRows]  = useState(new Set());
  const [pendingCount,   setPendingCount]   = useState(0);
  const [saveError,      setSaveError]      = useState("");
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
    // Auto-match PH rating from street profiles by checking if address contains a known street
    const addr = (parsed.address || "").toLowerCase();
    const matchedStreet = streetProfiles.find(sp =>
      addr && sp.street && addr.includes(sp.street.toLowerCase().split(",")[0].trim())
    );
    const row = {
      id: nextId,
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
          </div>
          {/* Nav links — hidden on mobile, shown via hamburger */}
          <div className={"nav-links" + (navOpen ? " open" : "")} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={()=>{ onNavigate&&onNavigate("purchase-costs"); setNavOpen(false); }}
              style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"6px 12px", color:"#16a34a", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
              💰 Purchase Costs
            </button>
            <button onClick={()=>{ onNavigate&&onNavigate("suburb-profiles"); setNavOpen(false); }}
              style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"6px 12px", color:"#0369a1", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
              🏘 Suburb Profiles
            </button>
            <button onClick={()=>{ onNavigate&&onNavigate("street-profiles"); setNavOpen(false); }}
              style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"6px 12px", color:"#b45309", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
              🏚 Street PH Profiles
            </button>
            <button onClick={()=>{ onNavigate&&onNavigate("amenities"); setNavOpen(false); }}
              style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:8, padding:"6px 12px", color:"#7c3aed", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
              ⭐ Amenities
            </button>
            <button onClick={()=>{ onNavigate&&onNavigate("dsr"); setNavOpen(false); }}
              style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"6px 12px", color:"#0369a1", cursor:"pointer", fontSize:12, fontWeight:500, whiteSpace:"nowrap" }}>
              📊 DSR Data
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
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
              <button onClick={()=>setShowQuickAdd(true)}
                style={{ background:"#0ea5e9", border:"none", borderRadius:8, padding:"10px 20px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600, boxShadow:"0 2px 8px rgba(14,165,233,0.35)", display:"flex", alignItems:"center", gap:6 }}>
                &#10024; Add Property
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="stat-cards" style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
            {[
              { label:"Total Properties", value:rows.length, color:"#0ea5e9" },
              { label:"Analysed",   value:rows.filter(r=>r.ph_rating).length, color:"#f59e0b" },
              { label:"PH Rated", value:rows.filter(r=>r.ph_rating).length, color:"#10b981" },
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
        <div className="grid-wrap" style={{ overflowX:"auto", padding:"16px 12px 40px" }}>
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
                {columns.map(col=>{
                  // For calc_ph, inject address + street profiles for live lookup
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
                    ? () => {}  // score_card is computed, no direct edit
                    : (v) => updateCell(row.id, col.id, v);
                  return (
                    <Cell key={col.id} col={enrichedCol} value={row[col.id]}
                      onChange={handleCellChange}
                      editing={editing?.rowId===row.id&&editing?.colId===col.id}
                      onStartEdit={()=>setEditing({rowId:row.id,colId:col.id})}
                      onEndEdit={()=>setEditing(null)}
                      onAnalyse={null}
                      analysing={false}
                      readonly={false}/>
                  );
                })}
              </div>
            ))}

            {/* Add Row footer — admin only */}
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

        <div className="grid-hint" style={{ padding:"0 20px 24px", color:"#cbd5e1", fontSize:12 }}>
          Click any cell to edit &nbsp;&#183;&nbsp; Enter to confirm &nbsp;&#183;&nbsp; Esc to cancel &nbsp;&#183;&nbsp; Use "&#10024; Add Property" to auto-fill from a listing URL or text
        </div>
      </div>

      {showAddCol   && <AddColumnModal onAdd={addColumn} onClose={()=>setShowAddCol(false)}/>}
      {showAdmin    && <AdminPanel onClose={()=>setShowAdmin(false)}/>}
      {showQuickAdd && <QuickAddModal onAdd={quickAddProperty} onClose={()=>setShowQuickAdd(false)}/>}
    </>
  );
}

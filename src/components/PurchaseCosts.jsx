import { useState, useEffect } from "react";
import { loadPurchaseCosts, savePurchaseCosts } from "../firebase.js";
import { calcStampDuty, formatCurrency } from "../stampDuty.js";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const DEFAULT_COSTS = {
  conveyancing:                1500,
  building_inspection:          600,
  pest_inspection:              300,
  loan_application:             500,
  lenders_mortgage_insurance:     0,
  title_search:                 150,
  settlement_agent:             800,
  other:                          0,
};

const EXPENSE_LABELS = [
  { key: "conveyancing",                label: "Conveyancing",               desc: "Legal fees for property transfer" },
  { key: "building_inspection",         label: "Building Inspection",        desc: "Structural & pest report" },
  { key: "pest_inspection",             label: "Pest Inspection",            desc: "Separate pest inspection if required" },
  { key: "loan_application",            label: "Loan Application Fee",       desc: "Bank/lender application fee" },
  { key: "lenders_mortgage_insurance",  label: "Lenders Mortgage Insurance", desc: "LMI if borrowing >80% LVR" },
  { key: "title_search",                label: "Title Search",               desc: "Certificate of title search" },
  { key: "settlement_agent",            label: "Settlement Agent",           desc: "Settlement/transfer agent fee" },
  { key: "other",                       label: "Other Costs",                desc: "Miscellaneous purchase costs" },
];

// Stamp duty bracket rules for display
const STAMP_DUTY_RULES = {
  NSW: [
    ["$0 – $16k",          "1.25%"],
    ["$16k – $35k",        "$200 + 1.5%"],
    ["$35k – $93k",        "$485 + 1.75%"],
    ["$93k – $351k",       "$1,500 + 3.5%"],
    ["$351k – $1.168m",    "$10,530 + 4.5%"],
    ["Above $1.168m",      "5.5%"],
  ],
  VIC: [
    ["Up to $25k",    "1.4%"],
    ["$25k – $130k",  "2.4%"],
    ["$130k – $960k", "6%"],
    ["Above $960k",   "5.5%"],
  ],
  QLD: [
    ["$0 – $5k",       "Nil"],
    ["$5k – $75k",     "1.5%"],
    ["$75k – $540k",   "3.5%"],
    ["$540k – $1m",    "4.5%"],
    ["Above $1m",      "5.75%"],
  ],
  WA: [
    ["$0 – $120k",   "1.9%"],
    ["$120k – $150k","2.85%"],
    ["$150k – $360k","3.8%"],
    ["Above $360k",  "5.15%"],
  ],
  SA: [
    ["$0 – $12k",     "1%"],
    ["$12k – $30k",   "2%"],
    ["$30k – $50k",   "3%"],
    ["$50k – $100k",  "3.5%"],
    ["$100k – $200k", "4%"],
    ["Above $200k",   "4.5%"],
  ],
  TAS: [
    ["$0 – $3k",      "1%"],
    ["$3k – $25k",    "2%"],
    ["$25k – $75k",   "3%"],
    ["$75k – $200k",  "3.5%"],
    ["$200k – $375k", "4%"],
    ["Above $375k",   "4.5%"],
  ],
  ACT: [
    ["$0 – $200k",     "1.2%"],
    ["$200k – $300k",  "2.3%"],
    ["$300k – $500k",  "2.9%"],
    ["$500k – $750k",  "3.15%"],
    ["$750k – $1m",    "3.5%"],
    ["$1m – $1.455m",  "3.9%"],
    ["Above $1.455m",  "4.9%"],
  ],
  NT: [
    ["Formula", "((0.06571441 × V + 15,000) × V) / 1,000,000"],
  ],
};

function parse(v) { return parseFloat(String(v).replace(/[,$\s]/g, "")) || 0; }

export default function PurchaseCosts({ onBack }) {
  const [costs,        setCosts]        = useState(DEFAULT_COSTS);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [previewPrice, setPreviewPrice] = useState("600000");
  const [expandedState, setExpandedState] = useState(null);

  useEffect(() => {
    loadPurchaseCosts().then(data => {
      if (data) {
        const { stamp_duty, ...rest } = data;
        setCosts({ ...DEFAULT_COSTS, ...rest });
      }
      setLoading(false);
    });
  }, []);

  const setField = (key, val) => setCosts(c => ({ ...c, [key]: val }));

  const totalGeneral = EXPENSE_LABELS.reduce((sum, e) => sum + parse(costs[e.key]), 0);
  const previewNum   = parse(previewPrice);

  const handleSave = async () => {
    setSaving(true);
    const toSave = {};
    EXPENSE_LABELS.forEach(e => { toSave[e.key] = parse(costs[e.key]); });
    await savePurchaseCosts(toSave);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const inp = {
    background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
    padding: "9px 12px", color: "#1e293b", fontSize: 14, outline: "none",
    fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  };
  const lbl = { color: "#64748b", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f8fafc", fontFamily:"'Inter',sans-serif" }}>
      <div style={{ color:"#94a3b8" }}>Loading...</div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box} body{margin:0;background:#f8fafc}
        .state-card:hover{border-color:#bae6fd!important;background:#f0f9ff!important}
      `}</style>
      <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'Inter', sans-serif" }}>

        {/* Navbar */}
        <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"12px 32px", display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
          <button onClick={onBack} style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:"7px 14px", color:"#64748b", cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
            &#8592; Dashboard
          </button>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:"linear-gradient(135deg,#0ea5e9,#0369a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>&#127968;</div>
            <span style={{ fontFamily:"'Playfair Display', serif", fontWeight:700, fontSize:18, color:"#0f172a" }}>Property Analysis</span>
          </div>
          <span style={{ color:"#94a3b8" }}>/</span>
          <span style={{ color:"#0f172a", fontSize:14, fontWeight:600 }}>Cost of Purchase</span>
        </div>

        <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px" }}>
          <div style={{ marginBottom:28 }}>
            <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:700, color:"#0f172a", margin:"0 0 8px" }}>Cost of Purchase</h1>
            <p style={{ color:"#64748b", fontSize:14, margin:0, lineHeight:1.6 }}>
              Set your standard purchase costs. Stamp duty is <strong>auto-calculated</strong> from your offer price and property state using current rates.
            </p>
          </div>

          {/* General Expenses */}
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:28, marginBottom:24, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <h2 style={{ fontSize:17, fontWeight:700, color:"#0f172a", margin:"0 0 20px", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:8, padding:"4px 10px", fontSize:13, color:"#0ea5e9" }}>General</span>
              Standard Purchase Expenses
            </h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px 24px" }}>
              {EXPENSE_LABELS.map(({ key, label, desc }) => (
                <div key={key}>
                  <label style={lbl}>{label}</label>
                  <div style={{ color:"#94a3b8", fontSize:11, marginBottom:5 }}>{desc}</div>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#64748b", fontSize:14 }}>$</span>
                    <input value={costs[key] === 0 ? "" : costs[key]} onChange={e => setField(key, e.target.value)}
                      placeholder="0" style={{ ...inp, paddingLeft:24 }}/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:20, padding:"14px 16px", background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ color:"#64748b", fontSize:13, fontWeight:600 }}>Total General Costs (excl. Stamp Duty)</span>
              <span style={{ color:"#0f172a", fontSize:18, fontWeight:700, fontFamily:"'Playfair Display', serif" }}>{formatCurrency(totalGeneral)}</span>
            </div>
          </div>

          {/* Stamp Duty Calculator */}
          <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:14, padding:28, marginBottom:24, boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
            <h2 style={{ fontSize:17, fontWeight:700, color:"#0f172a", margin:"0 0 6px", display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ background:"#fefce8", border:"1px solid #fde68a", borderRadius:8, padding:"4px 10px", fontSize:13, color:"#d97706" }}>Auto</span>
              Stamp Duty by State
            </h2>
            <p style={{ color:"#94a3b8", fontSize:13, margin:"0 0 20px", lineHeight:1.6 }}>
              Stamp duty is automatically calculated using current general (investment) rates for each state based on your offer price. No manual input needed.
            </p>

            {/* Preview price input */}
            <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"16px 20px", marginBottom:20, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <span style={{ color:"#0369a1", fontSize:13, fontWeight:600, whiteSpace:"nowrap" }}>Preview at price:</span>
              <div style={{ position:"relative", flex:1, minWidth:180 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#64748b" }}>$</span>
                <input value={previewPrice} onChange={e=>setPreviewPrice(e.target.value)}
                  style={{ ...inp, paddingLeft:24, background:"#fff" }} placeholder="600000"/>
              </div>
              <span style={{ color:"#64748b", fontSize:12 }}>Enter any price to see stamp duty across all states</span>
            </div>

            {/* State cards grid */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              {STATES.map(state => {
                const duty    = calcStampDuty(state, previewNum);
                const total   = totalGeneral + duty;
                const isOpen  = expandedState === state;
                return (
                  <div key={state} className="state-card"
                    onClick={()=>setExpandedState(isOpen ? null : state)}
                    style={{ background:"#fafbfc", border:"1px solid #e2e8f0", borderRadius:10, padding:14, cursor:"pointer", transition:"all 0.15s" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:14, color:"#0369a1" }}>{state}</span>
                      <span style={{ fontSize:10, color:"#94a3b8" }}>{isOpen?"▲":"▼"}</span>
                    </div>
                    <div style={{ color:"#64748b", fontSize:11, marginBottom:4 }}>Stamp Duty</div>
                    <div style={{ color:"#0f172a", fontWeight:700, fontSize:16, fontFamily:"'Playfair Display',serif" }}>
                      {previewNum > 0 ? formatCurrency(duty) : "—"}
                    </div>
                    {previewNum > 0 && (
                      <div style={{ marginTop:6, paddingTop:6, borderTop:"1px solid #e2e8f0" }}>
                        <div style={{ color:"#94a3b8", fontSize:10 }}>Total purchase cost</div>
                        <div style={{ color:"#16a34a", fontWeight:600, fontSize:13 }}>{formatCurrency(total)}</div>
                      </div>
                    )}
                    {/* Expanded bracket rules */}
                    {isOpen && (
                      <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #e2e8f0" }}>
                        <div style={{ color:"#64748b", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Rate Schedule</div>
                        {(STAMP_DUTY_RULES[state]||[]).map(([range, rate],i)=>(
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:10, padding:"2px 0", color:"#475569" }}>
                            <span>{range}</span>
                            <span style={{ fontWeight:600 }}>{rate}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop:16, padding:"12px 16px", background:"#fefce8", borderRadius:8, border:"1px solid #fde68a" }}>
              <div style={{ color:"#92400e", fontSize:12, lineHeight:1.7 }}>
                <strong>Note:</strong> These are general investment property rates. First home buyer concessions and other exemptions may apply.
                Rates are indicative — always verify with your conveyancer or state revenue office.
              </div>
            </div>
          </div>

          {/* How it all works */}
          <div style={{ background:"linear-gradient(135deg,#f0f9ff,#e0f2fe)", border:"1px solid #bae6fd", borderRadius:14, padding:24, marginBottom:28 }}>
            <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700, color:"#0369a1" }}>How Cost of Purchase is Calculated in the Dashboard</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 24px" }}>
              {[
                ["Offer Price",        "Your planned offer (you enter this per property)"],
                ["+ General Costs",    formatCurrency(totalGeneral) + " (configured above)"],
                ["+ Stamp Duty",       "Auto-calculated from offer price × state rates"],
                ["= Cost of Purchase", "Auto-shown in dashboard — read only"],
                ["Yield %",            "(Weekly Rent × 52 / Cost of Purchase) × 100"],
              ].map(([k,v]) => (
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #bae6fd", gap:12 }}>
                  <span style={{ color:"#0369a1", fontSize:13, fontWeight:600, whiteSpace:"nowrap" }}>{k}</span>
                  <span style={{ color:"#0f172a", fontSize:12, textAlign:"right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Save */}
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button onClick={onBack} style={{ background:"transparent", border:"1px solid #e2e8f0", borderRadius:8, padding:"11px 22px", color:"#64748b", cursor:"pointer", fontSize:14 }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ background:saved?"#10b981":"#0ea5e9", border:"none", borderRadius:8, padding:"11px 28px", color:"#fff", cursor:saving?"not-allowed":"pointer", fontSize:14, fontWeight:600, minWidth:120, transition:"background 0.3s" }}>
              {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Costs"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

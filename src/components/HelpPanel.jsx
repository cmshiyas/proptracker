import { useState, useEffect, useRef } from "react";

const SECTIONS = [
  {
    id: "getting-started",
    icon: "🚀",
    label: "Getting Started",
    color: "#0ea5e9",
    bg: "#f0f9ff",
    border: "#bae6fd",
    topics: [
      {
        title: "Welcome to Property Analysis",
        content: `Property Analysis is your personal property research hub. It helps you track properties you're considering buying, analyse their value, and make better-informed decisions.

The app is organised into a **Dashboard** (your main property grid) plus several reference pages accessible from the top navigation bar.`,
        tip: "Start by clicking ✨ Add Property in the toolbar to add your first property using the AI-powered quick-add feature.",
      },
      {
        title: "Adding Your First Property",
        content: `There are two ways to add a property:

**1. ✨ Add Property (AI Quick-Add)**
Paste the property listing URL or description text. The AI will automatically extract the address, price, bedrooms/bathrooms/car spaces, land size, suburb and state — saving you time.

**2. + Empty Row**
Adds a blank row you can fill in manually. Click any cell to start editing. Press Enter to confirm or Escape to cancel.`,
        tip: "The AI extraction works best with full listing text copied from realestate.com.au or domain.com.au.",
      },
      {
        title: "Navigating the App",
        content: `Use the **top navigation bar** to move between pages:

- **💰 Purchase Costs** — configure stamp duty and buying costs by state
- **🏘 Suburb Profiles** — store suburb research notes and data
- **🏚 Street PH Profiles** — record public housing presence on specific streets
- **⭐ Amenities** — configure your personal amenity scoring criteria
- **📊 DSR Data** — upload and browse demand-to-supply ratio data
- **✅ Checklist** — run through a 31-item property due diligence checklist

Admins can restrict which tabs guests can see via the 🔒 Guest Access button.`,
        tip: "On mobile, tap the ☰ hamburger menu to access navigation links.",
      },
    ],
  },
  {
    id: "dashboard",
    icon: "📋",
    label: "Dashboard",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    topics: [
      {
        title: "Property Status & Sections",
        content: `Every property has a **Status** (the first column). Click the status badge to open a dropdown and choose from:

- 🔵 **Under Consideration** — properties you're actively researching
- 🟢 **Analysed & Passed** — properties you've reviewed but decided against
- 🟠 **Offered & Missed** — properties you made an offer on but didn't get
- *(Admin can add custom statuses)*

The dashboard automatically splits into **four sections**, one per status. New rows always start in "Under Consideration".`,
        tip: "Use the Analysed & Passed section as a learning log — notes from missed properties help calibrate future decisions.",
      },
      {
        title: "Editing Cells",
        content: `Click any cell to edit it. The cell highlights blue while editing.

- **Text / currency cells** — type and press Enter to confirm, Escape to cancel
- **Status** — dropdown selector
- **State** — dropdown (NSW, VIC, QLD, etc.)
- **Comments / Agent Notes** — multi-line text area. Each edit is **timestamped** automatically and added to a history log
- **Amenities** — multi-select dropdown of your configured amenity features
- **PH Heatmap** — click to upload or paste an image
- **Sale History** — click to open the chart modal`,
        tip: "Comments and Agent Notes preserve full edit history with timestamps — useful for tracking what you learned about a property over time.",
      },
      {
        title: "Sorting & Column Order",
        content: `**Sort by a column:** Click the column header label. Numeric columns (Price, Offer Price, Rental/Wk, Cost of Purchase, Yield %, Land, Score Card) show a ⇅ icon. Click once to sort descending (▼), click again to reverse (▲). The active sort column turns blue.

**Reorder columns:** Drag any column header using the ⠿ grip icon on the left. Drop it onto another column to swap positions. Your custom order is saved per-user.

**Add custom columns:** Use the + Add Column button in the toolbar to add your own text columns.`,
        tip: "Column order is saved per-user — each person can arrange columns to suit their own workflow.",
      },
      {
        title: "Bulk Actions",
        content: `Use the **checkboxes** on the left of each row to select multiple properties.

- **Select all** — use the checkbox in the column header
- **Delete selected** — click 🗑 Delete Selected in the toolbar to remove all checked rows at once

The selection is cleared after deletion.`,
        tip: "Hold Shift and click to select a range (standard browser behaviour applies).",
      },
      {
        title: "Calculated Columns",
        content: `Two columns are **automatically calculated** and cannot be edited directly:

**Cost of Purchase** — stamp duty + other buying costs, calculated from your Offer Price and State using the rates configured in Purchase Costs.

**Yield %** — annual rental yield calculated as:
*(Weekly Rent × 52) ÷ Offer Price × 100*

Both update instantly as you type in Offer Price, Rental/Wk or State.`,
        tip: "Make sure you've set up your Purchase Costs configuration to get accurate stamp duty calculations.",
      },
    ],
  },
  {
    id: "financial",
    icon: "💰",
    label: "Financial Tools",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    topics: [
      {
        title: "Purchase Costs Configuration",
        content: `Go to **💰 Purchase Costs** in the nav bar to configure buying costs for each state.

You can set:
- Stamp duty brackets per state (auto-populated with standard rates)
- Additional buying costs (conveyancing, inspection fees, etc.)

These rates feed directly into the **Cost of Purchase** column on the dashboard.`,
        tip: "Update stamp duty rates if you're buying as a first home buyer — concessions apply in most states.",
      },
      {
        title: "Sale History & Price Growth Chart",
        content: `Click the **Sale History** cell for any property to open the history chart.

**Adding a sale record:** Enter the year, sale price, and an optional note (e.g. "sold at auction"). Click + Add.

**The chart shows:**
- Solid line — actual historical sale prices
- Blue dashed line — median projection using the property's CAGR
- Shaded band — ±15% confidence range
- Projected end value 10 years out

The header displays Total Growth %, CAGR (compound annual growth rate), and the 10-year projected value.`,
        tip: "Add all historical sales you can find from property reports (e.g. CoreLogic, realestate.com.au sold history) to get a more accurate CAGR projection.",
      },
    ],
  },
  {
    id: "research",
    icon: "🔍",
    label: "Research Tools",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
    topics: [
      {
        title: "Suburb Profiles",
        content: `The **🏘 Suburb Profiles** page lets you store research notes and data for suburbs you're interested in.

Each suburb profile can hold free-form notes, key metrics, and observations. Profiles are grouped by state for easy browsing.

Suburb data is **shared** — all users see the same suburb profiles (admin-managed).`,
        tip: "Use suburb profiles to capture DSR scores, median price trends, vacancy rates, and proximity to amenities.",
      },
      {
        title: "Street PH Profiles",
        content: `The **🏚 Street PH Profiles** page tracks public housing presence on specific streets using a colour-coded system:

- ⚫ **Black** — high concentration
- 🔴 **Red** — significant presence
- 🟡 **Amber** — moderate presence
- 🟢 **Green** — minimal/none
- 🩷 **Pink** — special category

Once you add a street profile, the **Calculated PH** column on the dashboard automatically looks up and displays the rating for each property based on its address.

Click **⟳ PH Recalculate** in the toolbar to refresh all PH ratings after adding new street profiles.`,
        tip: "The address match is flexible — it searches for the street name anywhere within the property address.",
      },
      {
        title: "DSR Data",
        content: `The **📊 DSR Data** page lets you upload a CSV file of demand-to-supply ratio data.

After uploading, you can:
- Filter by state, DSR range, yield range, and growth
- Search by suburb name
- Sort any column
- View colour-coded metrics (green = strong, red = weak)

The CSV should have 22 columns matching the standard DSR report format.`,
        tip: "DSR scores above 60 generally indicate strong buyer demand relative to supply — a positive signal for capital growth.",
      },
      {
        title: "PH Heatmap Images",
        content: `The **PH Heatmap** column lets you attach a public housing heatmap screenshot to each property.

**Three ways to add an image:**
1. Click the cell → 📁 Upload Image — pick a file from your device
2. Click the cell → 🔗 Paste URL — enter a direct image link
3. Click the cell → then Ctrl+V (Windows) or ⌘+V (Mac) to paste a screenshot from clipboard

Images are stored as base64 data — no external hosting needed. Click an existing thumbnail to view full size, replace, or remove it.`,
        tip: "Take a screenshot of the public housing map from your local council or housing authority website and paste it directly.",
      },
    ],
  },
  {
    id: "amenities",
    icon: "⭐",
    label: "Amenities & Scoring",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    topics: [
      {
        title: "Configuring Amenities",
        content: `Go to **⭐ Amenities** in the nav bar to set up your personal scoring criteria.

Each amenity has:
- A **name** (e.g. "Solar Panels", "Granny Flat")
- A **point value** — how much it contributes to the total score

Default amenities include: Solar Panels, Shed, Backyard Access, Double Garage, Granny Flat, Swimming Pool, Ducted AC, Renovated Kitchen.

You can add, edit, remove, or reorder amenities. Your configuration is **private** — other users have their own independent lists.`,
        tip: "Weight amenities based on what matters most to you as a buyer — a granny flat for rental income might be worth more than a pool.",
      },
      {
        title: "Selecting Amenities Per Property",
        content: `On the dashboard, click the **Amenities** cell for any property to open a dropdown checklist.

Tick each feature the property has. The **Score Card** column automatically updates with:
- A progress bar showing score vs. maximum possible
- The total points earned
- The maximum possible score

Amenity selections are **private per user** — your scores don't affect other users' data.`,
        tip: "Run all shortlisted properties through the same amenities checklist to get an objective comparison score.",
      },
    ],
  },
  {
    id: "checklist",
    icon: "✅",
    label: "Due Diligence Checklist",
    color: "#15803d",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    topics: [
      {
        title: "Using the Checklist",
        content: `The **✅ Checklist** page contains 31 standard due diligence questions across three categories:

- 🛡 **Safety** (12 items) — asbestos, defects, electrical, smoke alarms, pests, etc.
- 🏡 **Enjoyment** (11 items) — flooding, stormwater, power lines, strata, noise, etc.
- 💰 **Value** (8 items) — unapproved works, energy efficiency, water connections, etc.

For each item, you can set a status: **Yes/OK**, **No/Issue**, **Needs Review**, or **N/A**. You can also add a private note to any item.`,
        tip: "Run through the checklist before making an offer — items marked 'No/Issue' or 'Needs Review' are negotiating points or deal-breakers.",
      },
      {
        title: "Checklist Progress & Notes",
        content: `The top of the checklist shows an **overall progress bar** with counts for:
- Total items checked
- Issues found (red)
- Items needing review (amber)
- Remaining unchecked

Each section can be **collapsed** by clicking the section header to reduce scrolling.

Notes are saved privately per user to Firestore — they persist across sessions.`,
        tip: "Share the checklist with your conveyancer or building inspector by printing the page or screenshotting your notes.",
      },
    ],
  },
  {
    id: "admin",
    icon: "⚙",
    label: "Admin Features",
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    topics: [
      {
        title: "User Access Management",
        content: `As admin, click **⚙ Admin** in the navbar to manage user access.

The Admin Panel has three tabs:
- **Pending** — users who have requested access. Approve or reject each request.
- **Approved** — all currently approved users. Revoke access if needed.
- **Settings** — app-level configuration.

When a user requests access, you receive a real-time badge notification on the Admin button and an email alert.`,
        tip: "Approved users get full dashboard access immediately. Revoked users are redirected to the access request screen on their next visit.",
      },
      {
        title: "Guest Tab Access Control",
        content: `Click **🔒 Guest Access** in the navbar to control which navigation tabs guests can see.

Toggle each tab on or off:
- **ON** — tab appears in guest navigation
- **OFF** — tab is hidden from guests (but admins always see all tabs)

Changes save instantly to Firestore and take effect for all guests immediately — no page refresh needed.`,
        tip: "Hide tabs for pages that aren't yet populated with data to keep the guest experience clean.",
      },
      {
        title: "Shared Reference Data",
        content: `Some data is **shared across all users** (admin-managed):

- Suburb Profiles — viewable by all, editable by admin
- Street PH Profiles — viewable by all, editable by admin
- Purchase Costs config — shared rates used for all calculations
- Guest Nav Access — controls tab visibility for guests

Other data is **private per user**:

- Dashboard properties (each user has their own list)
- Column order and custom columns
- Amenities configuration and selections
- Checklist status and notes`,
        tip: "Build out the shared reference data (suburb and street profiles) first — it makes the per-user dashboard more useful from day one.",
      },
      {
        title: "Resetting Dashboard Data",
        content: `Any user can reset their own dashboard by clicking **🗑 Reset Data** in the dashboard toolbar.

This deletes all their properties and resets columns to default. Other users' data is completely unaffected.

A confirmation modal shows the number of properties that will be deleted before proceeding.`,
        tip: "Use Reset Data during setup/testing — once you're in production, there's no undo, so use it carefully.",
      },
    ],
  },
];

export default function HelpPanel({ onClose, isAdmin }) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [activeTopic,   setActiveTopic]   = useState(0);
  const [search,        setSearch]        = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const searchRef = useRef();

  const visibleSections = isAdmin ? SECTIONS : SECTIONS.filter(s => s.id !== "admin");

  // Search across all topics
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const q = search.toLowerCase();
    const results = [];
    SECTIONS.forEach(sec => {
      sec.topics.forEach((topic, ti) => {
        if (topic.title.toLowerCase().includes(q) || topic.content.toLowerCase().includes(q) || (topic.tip||"").toLowerCase().includes(q)) {
          results.push({ sectionId: sec.id, sectionLabel: sec.label, sectionIcon: sec.icon, topicIndex: ti, topic });
        }
      });
    });
    setSearchResults(results);
  }, [search]);

  const goTo = (sectionId, topicIndex) => {
    setActiveSection(sectionId);
    setActiveTopic(topicIndex);
    setSearch("");
    setSearchResults([]);
  };

  const section = visibleSections.find(s => s.id === activeSection) || visibleSections[0];
  const topic   = section?.topics[activeTopic] || section?.topics[0];

  // Prev / Next navigation
  const allTopics = visibleSections.flatMap(s => s.topics.map((t, i) => ({ sectionId: s.id, topicIndex: i })));
  const currentIdx = allTopics.findIndex(t => t.sectionId === activeSection && t.topicIndex === activeTopic);
  const prev = currentIdx > 0 ? allTopics[currentIdx - 1] : null;
  const next = currentIdx < allTopics.length - 1 ? allTopics[currentIdx + 1] : null;

  // Render markdown-like bold and newlines
  const renderContent = (text) => {
    return text.split("\n").map((line, li) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={li} style={{ margin: line === "" ? "6px 0" : "0 0 8px", lineHeight: 1.7, fontSize: 13, color: "#374151" }}>
          {parts.map((part, pi) =>
            pi % 2 === 1
              ? <strong key={pi} style={{ color: "#0f172a", fontWeight: 700 }}>{part}</strong>
              : part
          )}
        </p>
      );
    });
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:5000, display:"flex" }} onClick={onClose}>
      {/* Backdrop */}
      <div style={{ position:"absolute", inset:0, background:"rgba(15,23,42,0.5)", backdropFilter:"blur(4px)" }}/>

      {/* Panel */}
      <div style={{ position:"relative", marginLeft:"auto", width:"min(820px,100vw)", height:"100%", background:"#fff", display:"flex", flexDirection:"column", boxShadow:"-20px 0 60px rgba(0,0,0,0.15)", fontFamily:"'Inter',sans-serif" }}
        onClick={e => e.stopPropagation()}>

        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600&display=swap');
          .help-sec-btn:hover { background: #f1f5f9 !important; }
          .help-topic-btn:hover { background: #f8fafc !important; }
          .help-nav-btn:hover { opacity: 0.8; }
          .help-search-result:hover { background: #f0f9ff !important; }
        `}</style>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #f1f5f9", background:"linear-gradient(135deg,#0f172a,#1e293b)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:34, height:34, borderRadius:10, background:"linear-gradient(135deg,#0ea5e9,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>❓</div>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:"#fff" }}>Help & Guide</div>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>Property Analysis — How to use this app</div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:8, width:32, height:32, cursor:"pointer", color:"#94a3b8", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
          </div>
          {/* Search */}
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#64748b" }}>🔍</span>
            <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search help topics…"
              style={{ width:"100%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"9px 12px 9px 36px", color:"#fff", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}/>
            {search && (
              <button onClick={()=>setSearch("")}
                style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16, padding:0 }}>✕</button>
            )}
          </div>
          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div style={{ position:"absolute", left:24, right:24, top:116, background:"#fff", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.18)", border:"1px solid #e2e8f0", zIndex:10, overflow:"hidden", maxHeight:280, overflowY:"auto" }}>
              {searchResults.map((r, i) => (
                <div key={i} className="help-search-result" onClick={()=>goTo(r.sectionId, r.topicIndex)}
                  style={{ padding:"10px 16px", cursor:"pointer", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2 }}>{r.sectionIcon} {r.sectionLabel}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{r.topic.title}</div>
                </div>
              ))}
              {searchResults.length === 0 && (
                <div style={{ padding:"16px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>No results found</div>
              )}
            </div>
          )}
          {search && searchResults.length === 0 && (
            <div style={{ position:"absolute", left:24, right:24, top:116, background:"#fff", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.18)", border:"1px solid #e2e8f0", zIndex:10, padding:"16px", textAlign:"center", color:"#94a3b8", fontSize:13 }}>
              No results for "{search}"
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>

          {/* Sidebar */}
          <div style={{ width:200, flexShrink:0, borderRight:"1px solid #f1f5f9", overflowY:"auto", padding:"12px 0", background:"#fafbfc" }}>
            {visibleSections.map(sec => (
              <div key={sec.id}>
                <button className="help-sec-btn" onClick={()=>{ setActiveSection(sec.id); setActiveTopic(0); }}
                  style={{ width:"100%", textAlign:"left", border:"none", background: activeSection===sec.id ? "#fff" : "transparent", padding:"10px 16px", cursor:"pointer", display:"flex", alignItems:"center", gap:9, borderLeft: activeSection===sec.id ? `3px solid ${sec.color}` : "3px solid transparent", transition:"all 0.15s" }}>
                  <span style={{ fontSize:15 }}>{sec.icon}</span>
                  <span style={{ fontSize:12, fontWeight: activeSection===sec.id ? 700 : 500, color: activeSection===sec.id ? sec.color : "#64748b", lineHeight:1.3 }}>{sec.label}</span>
                </button>
                {activeSection === sec.id && (
                  <div style={{ paddingLeft:0 }}>
                    {sec.topics.map((t, ti) => (
                      <button key={ti} className="help-topic-btn" onClick={()=>setActiveTopic(ti)}
                        style={{ width:"100%", textAlign:"left", border:"none", background: activeTopic===ti ? sec.bg : "transparent", padding:"7px 16px 7px 40px", cursor:"pointer", fontSize:11, color: activeTopic===ti ? sec.color : "#94a3b8", fontWeight: activeTopic===ti ? 600 : 400, lineHeight:1.4, transition:"all 0.1s" }}>
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
            {topic && (
              <div style={{ padding:"28px 32px", flex:1 }}>
                {/* Section breadcrumb */}
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:16 }}>
                  <span style={{ fontSize:11, color:"#94a3b8" }}>{section.icon} {section.label}</span>
                  <span style={{ color:"#e2e8f0", fontSize:11 }}>›</span>
                  <span style={{ fontSize:11, color:section.color, fontWeight:600 }}>{topic.title}</span>
                </div>

                {/* Topic title */}
                <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#0f172a", margin:"0 0 20px", lineHeight:1.3 }}>{topic.title}</h2>

                {/* Content */}
                <div style={{ marginBottom: topic.tip ? 24 : 0 }}>
                  {renderContent(topic.content)}
                </div>

                {/* Tip */}
                {topic.tip && (
                  <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:12, padding:"14px 18px", display:"flex", gap:12, alignItems:"flex-start" }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:"#b45309", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Pro Tip</div>
                      <p style={{ margin:0, fontSize:13, color:"#92400e", lineHeight:1.6 }}>{topic.tip}</p>
                    </div>
                  </div>
                )}

                {/* Topic counter */}
                <div style={{ marginTop:32, fontSize:11, color:"#cbd5e1", textAlign:"center" }}>
                  Topic {activeTopic + 1} of {section.topics.length} in {section.label}
                </div>
              </div>
            )}

            {/* Prev / Next */}
            <div style={{ padding:"16px 32px 24px", borderTop:"1px solid #f1f5f9", display:"flex", justifyContent:"space-between", gap:12, flexShrink:0 }}>
              <button className="help-nav-btn" onClick={()=>prev&&goTo(prev.sectionId,prev.topicIndex)}
                disabled={!prev}
                style={{ flex:1, border:"1px solid #e2e8f0", background: prev?"#fff":"#f8fafc", borderRadius:10, padding:"10px 16px", cursor:prev?"pointer":"default", display:"flex", alignItems:"center", gap:8, opacity:prev?1:0.4, transition:"opacity 0.15s" }}>
                <span style={{ fontSize:16, color:"#64748b" }}>←</span>
                {prev && (
                  <div style={{ textAlign:"left", minWidth:0 }}>
                    <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.8 }}>Previous</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {SECTIONS.find(s=>s.id===prev.sectionId)?.topics[prev.topicIndex]?.title}
                    </div>
                  </div>
                )}
              </button>
              <button className="help-nav-btn" onClick={()=>next&&goTo(next.sectionId,next.topicIndex)}
                disabled={!next}
                style={{ flex:1, border:"1px solid #e2e8f0", background:next?"#fff":"#f8fafc", borderRadius:10, padding:"10px 16px", cursor:next?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"flex-end", gap:8, opacity:next?1:0.4, transition:"opacity 0.15s" }}>
                {next && (
                  <div style={{ textAlign:"right", minWidth:0 }}>
                    <div style={{ fontSize:10, color:"#94a3b8", textTransform:"uppercase", letterSpacing:0.8 }}>Next</div>
                    <div style={{ fontSize:12, fontWeight:600, color:"#374151", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {SECTIONS.find(s=>s.id===next.sectionId)?.topics[next.topicIndex]?.title}
                    </div>
                  </div>
                )}
                <span style={{ fontSize:16, color:"#64748b" }}>→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"10px 24px", background:"#f8fafc", borderTop:"1px solid #f1f5f9", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <span style={{ fontSize:11, color:"#94a3b8" }}>
            {allTopics.length} topics across {visibleSections.length} sections
          </span>
          <span style={{ fontSize:11, color:"#cbd5e1" }}>Property Analysis Help</span>
        </div>
      </div>
    </div>
  );
}

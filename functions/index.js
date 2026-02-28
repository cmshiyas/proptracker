const functions  = require("firebase-functions");
const admin      = require("firebase-admin");
const OpenAI     = require("openai");
const nodemailer = require("nodemailer");

admin.initializeApp();

const ADMIN_EMAIL = "cmshiyas007@gmail.com";

// ── Helpers ────────────────────────────────────────────────────────────────────
function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ── Extract Property ───────────────────────────────────────────────────────────
exports.extractProperty = functions
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .https.onRequest(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

    const { input } = req.body;
    if (!input) { res.status(400).json({ error: "Missing input" }); return; }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 800, temperature: 0,
        messages: [{ role: "user", content: `Extract property details from this Australian real estate listing:
- Full street address (no suburb/state)
- Suburb
- State (abbreviation)
- Price or sale method
- Bedrooms, bathrooms, car spaces
- Land size, building size
- Property type

Listing:
---
${input}
---` }],
      });

      const naturalResponse = extraction.choices[0]?.message?.content?.trim() || "";

      const jsonConversion = await openai.chat.completions.create({
        model: "gpt-4o-mini", max_tokens: 400, temperature: 0,
        messages: [{ role: "user", content: `Convert to JSON with keys: address, suburb, state (NSW/VIC/QLD/WA/SA/TAS/ACT/NT), price, config ("3,2,2" beds,baths,cars), land (e.g. "643m²"), type (House/Unit/Townhouse etc), thumbnail (always "").

Details:
${naturalResponse}

Return ONLY valid JSON, no markdown.` }],
      });

      const clean = jsonConversion.choices[0]?.message?.content?.trim().replace(/```json|```/g, "").trim();
      res.status(200).json(JSON.parse(clean));
    } catch (err) {
      console.error("extractProperty error:", err);
      res.status(500).json({ error: err.message || "Extraction failed" });
    }
  });

// ── Analyse Suburb ─────────────────────────────────────────────────────────────
exports.analyseSuburb = functions
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .https.onRequest(async (req, res) => {
    cors(res);
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

    const { suburb, state } = req.body;
    if (!suburb) { res.status(400).json({ error: "Missing suburb" }); return; }
    const location = state ? `${suburb}, ${state}` : suburb;

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const [suburbRes, economyRes] = await Promise.all([
        openai.chat.completions.create({
          model: "gpt-4o-mini", max_tokens: 400, temperature: 0.3,
          messages: [{ role: "user", content: `Write a concise suburb profile for ${location}, Australia covering lifestyle, proximity to CBD/schools/transport, median house price, and recent growth trend. 4-5 sentences, factual.` }],
        }),
        openai.chat.completions.create({
          model: "gpt-4o-mini", max_tokens: 400, temperature: 0.3,
          messages: [{ role: "user", content: `Provide an economic snapshot of ${location}, Australia: median income, main industries, vacancy rate, rental yield, population growth, investment grade. 4-5 sentences.` }],
        }),
      ]);
      res.status(200).json({
        suburb_analysis: suburbRes.choices[0]?.message?.content?.trim() || "",
        economy:         economyRes.choices[0]?.message?.content?.trim() || "",
      });
    } catch (err) {
      console.error("analyseSuburb error:", err);
      res.status(500).json({ error: err.message || "Analysis failed" });
    }
  });

// ── Email admin when new access request is created ────────────────────────────
exports.notifyAccessRequest = functions
  .runWith({ secrets: ["GMAIL_APP_PASSWORD"] })
  .firestore.document("access_requests/{email}")
  .onWrite(async (change, context) => {
    const after  = change.after.exists  ? change.after.data()  : null;
    const before = change.before.exists ? change.before.data() : null;

    // Only fire when status becomes "pending" (new doc or re-request)
    const isNowPending  = after  && after.status  === "pending";
    const wasPending    = before && before.status === "pending";
    if (!isNowPending || wasPending) return null;

    const { email = "", name = "Unknown", requestedAt } = after;
    const time = requestedAt ? new Date(requestedAt).toLocaleString("en-AU") : "—";

    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: ADMIN_EMAIL, pass: process.env.GMAIL_APP_PASSWORD },
      });

      await transporter.sendMail({
        from:    `"PropTracker" <${ADMIN_EMAIL}>`,
        to:      ADMIN_EMAIL,
        subject: `🔔 New access request — ${name || email}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:500px;padding:24px">
            <h2 style="color:#0f172a;margin-bottom:8px">New Access Request</h2>
            <p style="color:#64748b">Someone is requesting access to <strong>PropTracker</strong>.</p>
            <table style="border-collapse:collapse;width:100%;margin:20px 0;background:#f8fafc;border-radius:8px;overflow:hidden">
              <tr><td style="padding:12px 16px;color:#64748b;font-weight:600;width:120px">Name</td><td style="padding:12px 16px;color:#0f172a">${name}</td></tr>
              <tr style="background:#f1f5f9"><td style="padding:12px 16px;color:#64748b;font-weight:600">Email</td><td style="padding:12px 16px;color:#0f172a">${email}</td></tr>
              <tr><td style="padding:12px 16px;color:#64748b;font-weight:600">Requested</td><td style="padding:12px 16px;color:#0f172a">${time}</td></tr>
            </table>
            <a href="https://proptracker-5408f.web.app"
              style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">
              Open PropTracker to Approve →
            </a>
          </div>
        `,
      });

      console.log(`✅ Admin notified of access request from ${email}`);
    } catch (err) {
      console.error("❌ Email notification failed:", err.message);
      // Don't throw — we don't want the function to retry on email failure
    }

    return null;
  });

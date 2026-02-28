const functions = require("firebase-functions");
const OpenAI = require("openai");

// ── Extract Property ───────────────────────────────────────────────────────────
exports.extractProperty = functions
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .https.onRequest(async (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

    const { input } = req.body;
    if (!input) { res.status(400).json({ error: "Missing input" }); return; }

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const extraction = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 800,
        temperature: 0,
        messages: [{
          role: "user",
          content: `Can you extract property details from the following Australian real estate listing text and give me:
- Full street address (no suburb/state)
- Suburb
- State (Australian state abbreviation)
- Price or sale method
- Number of bedrooms
- Number of bathrooms
- Number of car spaces
- Land size
- Building size (if available)
- Property type (House, Unit, Townhouse etc)

Listing text:
---
${input}
---`,
        }],
      });

      const naturalResponse = extraction.choices[0]?.message?.content?.trim() || "";

      const jsonConversion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 400,
        temperature: 0,
        messages: [{
          role: "user",
          content: `Convert the following property details into a JSON object with exactly these keys:
- address (street only, no suburb/state/postcode)
- suburb
- state (one of: NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
- price (e.g. "Offers Over $649,000" or "$850,000" or "Auction")
- config (formatted as "3,2,2" — just the numbers for beds,baths,cars separated by commas)
- land (e.g. "643m²")
- building (e.g. "180m²", empty string if not available)
- type (e.g. "House", "Unit", "Townhouse")
- thumbnail (always empty string "")

Property details:
${naturalResponse}

Return ONLY the JSON object, no markdown, no explanation.`,
        }],
      });

      const jsonText = jsonConversion.choices[0]?.message?.content?.trim() || "";
      const clean    = jsonText.replace(/```json|```/g, "").trim();
      const parsed   = JSON.parse(clean);
      res.status(200).json(parsed);

    } catch (err) {
      console.error("extractProperty error:", err);
      res.status(500).json({ error: err.message || "Extraction failed" });
    }
  });

// ── Analyse Suburb ─────────────────────────────────────────────────────────────
exports.analyseSuburb = functions
  .runWith({ secrets: ["OPENAI_API_KEY"] })
  .https.onRequest(async (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.status(204).send(""); return; }
    if (req.method !== "POST")   { res.status(405).json({ error: "Method not allowed" }); return; }

    const { suburb, state } = req.body;
    if (!suburb) { res.status(400).json({ error: "Missing suburb" }); return; }

    const location = state ? `${suburb}, ${state}` : suburb;

    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Run both analyses in parallel
      const [suburbRes, economyRes] = await Promise.all([

        // Suburb lifestyle & property analysis
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0.3,
          messages: [{
            role: "user",
            content: `Write a concise suburb profile for ${location}, Australia covering:
- Character & lifestyle (family-friendly, inner-city etc)
- Proximity to CBD, schools, amenities, transport
- Property market: median house price, recent growth trend
- Who typically buys here (families, investors, retirees)
- Any notable pros or cons for buyers

Keep it to 4-5 sentences, factual and useful for a property investor.`,
          }],
        }),

        // Economic analysis
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0.3,
          messages: [{
            role: "user",
            content: `Provide an economic snapshot of ${location}, Australia covering:
- Median household income vs state/national average
- Main industries and employment drivers in the area
- Vacancy rate and rental yield for houses
- Population growth trend (growing, stable, declining)
- Infrastructure investment or development activity
- Overall investment grade (strong/moderate/weak) with brief reason

Keep it to 4-5 sentences, data-focused and useful for a property investor.`,
          }],
        }),
      ]);

      const suburb_analysis = suburbRes.choices[0]?.message?.content?.trim() || "";
      const economy         = economyRes.choices[0]?.message?.content?.trim() || "";

      res.status(200).json({ suburb_analysis, economy });

    } catch (err) {
      console.error("analyseSuburb error:", err);
      res.status(500).json({ error: err.message || "Analysis failed" });
    }
  });

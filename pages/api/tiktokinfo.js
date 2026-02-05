const TTL_MS = 6 * 60 * 60 * 1000; // 6h cache simple en mémoire (Vercel: best-effort)
const cache = new Map();

function pickCountryFromText(text) {
  // Fallback léger: tente de trouver un pays dans le JSON (souvent absent)
  // Tu peux enrichir selon tes besoins.
  return null;
}

function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}

export default async function handler(req, res) {
  try {
    // CORS (si tu appelles depuis un autre domaine)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();

    const usernameRaw = (req.query.username || "").toString().trim();
    const username = usernameRaw.replace(/^@/, "");
    if (!username) return res.status(400).json({ error: "Missing username" });

    // Cache
    const key = username.toLowerCase();
    const hit = cache.get(key);
    if (hit && (Date.now() - hit.ts) < TTL_MS) {
      return res.status(200).json({ ...hit.data, cached: true });
    }

    const url = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8"
      }
    });

    if (!r.ok) {
      return res.status(r.status).json({
        username,
        error: `TikTok HTTP ${r.status}`,
        userId: null,
        country: null,
        source: "tiktok"
      });
    }

    const html = await r.text();

    // 1) Extraction SIGI_STATE
    const m = html.match(/<script id="SIGI_STATE" type="application\/json">([\s\S]*?)<\/script>/);
    let userId = null;
    let country = null;

    if (m && m[1]) {
      const data = safeJsonParse(m[1]);
      // TikTok bouge souvent: on cherche dans plusieurs chemins.
      // L’objectif principal ici: userId (id / idStr).
      const maybe =
        data?.UserModule?.users ||
        data?.UserPage?.users ||
        null;

      if (maybe) {
        // parfois la clé est username, parfois un userId string
        const direct = maybe[username] || maybe[`@${username}`];
        if (direct) {
          userId = direct.id || direct.idStr || null;
          country = direct.region || direct.country || null;
        } else {
          // fallback: première entrée qui ressemble
          const keys = Object.keys(maybe);
          for (const k of keys) {
            const u = maybe[k];
            if (u?.uniqueId?.toLowerCase?.() === username.toLowerCase()) {
              userId = u.id || u.idStr || null;
              country = u.region || u.country || null;
              break;
            }
          }
        }
      }

      if (!country) country = pickCountryFromText(m[1]);
    }

    const dataOut = {
      username,
      userId: userId ? String(userId) : null,
      country: country ? String(country) : null,
      source: "SIGI_STATE"
    };

    cache.set(key, { ts: Date.now(), data: dataOut });

    // Cache côté edge/CDN
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(dataOut);

  } catch (e) {
    return res.status(500).json({ error: "Server error", detail: String(e) });
  }
}

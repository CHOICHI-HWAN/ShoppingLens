const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const crypto = require("node:crypto");

admin.initializeApp();
const db = admin.firestore();
const NAVER_ID = defineSecret("NAVER_CLIENT_ID");
const NAVER_SECRET = defineSecret("NAVER_CLIENT_SECRET");
const TTL_MS = 30 * 60 * 1000;

// GET /api/naver-price?query=상품명  ->  { lowestPrice, mallName, title, cached }
// 네이버 일일 25,000회 쿼터를 보호하기 위해 항상 Firestore 캐시(30분)를 먼저 조회합니다.
exports.naverPrice = onRequest(
  { region: "asia-northeast3", secrets: [NAVER_ID, NAVER_SECRET], maxInstances: 5, cors: true },
  async (req, res) => {
    const query = String(req.query.query || "").trim().slice(0, 100);
    if (query.length < 2) return res.status(400).json({ error: "query required" });

    const ref = db.collection("online_cache").doc(crypto.createHash("sha1").update(query).digest("hex"));
    const hit = await ref.get();
    if (hit.exists && Date.now() - hit.data().updatedAt.toMillis() < TTL_MS) {
      return res.json({ ...hit.data().value, cached: true });
    }

    try {
      const url = new URL("https://openapi.naver.com/v1/search/shop.json");
      url.search = new URLSearchParams({ query, display: "10", sort: "asc", exclude: "used:rental:cbshop" });
      const r = await fetch(url, {
        headers: { "X-Naver-Client-Id": NAVER_ID.value(), "X-Naver-Client-Secret": NAVER_SECRET.value() },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error("naver " + r.status);
      const items = (await r.json()).items || [];
      const top = items.find((i) => Number(i.lprice) > 0);
      const value = top
        ? { lowestPrice: Number(top.lprice), mallName: top.mallName || "", title: top.title.replace(/<[^>]*>/g, ""), link: top.link }
        : { lowestPrice: null };
      await ref.set({ value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return res.json({ ...value, cached: false });
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "upstream failed" });
    }
  }
);

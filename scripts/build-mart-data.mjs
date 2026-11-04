// 참가격(한국소비자원) CSV -> public/data/mart_prices.json
// 사용: node scripts/build-mart-data.mjs [data/mart-prices.csv]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = process.argv[2] || 'data/mart-prices.csv';
const text = new TextDecoder('euc-kr').decode(readFileSync(src));

function parseCsv(s) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cur); if (row.length > 1) rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

// CSV의 '제조사' 열은 실제로는 업태(대형마트/슈퍼마켓/백화점/편의점)입니다.
const [header, ...rows] = parseCsv(text);
const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
for (const k of ['상품명', '조사일', '판매가격', '판매업소', '제조사']) if (!(k in col)) throw new Error('컬럼 없음: ' + k);

const brandOf = (store) =>
  /이마트/.test(store) ? '이마트' : /하나로|농협/.test(store) ? '농협하나로' : /롯데마트/.test(store) ? '롯데마트'
  : /홈플러스/.test(store) ? '홈플러스' : /롯데슈퍼/.test(store) ? '롯데슈퍼' : /GS|지에스/.test(store) ? 'GS더프레시' : '기타';
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const latest = rows.reduce((m, r) => (r[col['조사일']] > m ? r[col['조사일']] : m), '');
const groups = new Map(); // 상품 -> 브랜드 -> {prices, sale}
for (const r of rows) {
  if (r[col['조사일']] !== latest) continue; // 최신 조사일만 사용
  const price = Number(r[col['판매가격']]);
  if (!Number.isFinite(price) || price <= 0) continue;
  const name = r[col['상품명']].trim();
  const channel = r[col['제조사']].trim();
  const brand = brandOf(r[col['판매업소']]);
  const key = `${channel}|${brand}`;
  const p = groups.get(name) ?? groups.set(name, new Map()).get(name);
  const g = p.get(key) ?? p.set(key, { channel, brand, prices: [], sale: false }).get(key);
  g.prices.push(price);
  if (r[col['세일여부']] === 'Y' || r[col['원플러스원']] === 'Y') g.sale = true;
}

const products = [...groups].map(([name, m]) => ({
  name,
  offers: [...m.values()].map((g) => ({ channel: g.channel, brand: g.brand, price: median(g.prices), min: Math.min(...g.prices), stores: g.prices.length, sale: g.sale })),
})).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/mart_prices.json', JSON.stringify({
  source: '한국소비자원 참가격(price.go.kr) 생필품 가격 정보, 공공누리 제1유형(출처표시)',
  surveyDate: latest, products,
}));
console.log(`조사일 ${latest} · 상품 ${products.length}종 · offers ${products.reduce((n, p) => n + p.offers.length, 0)}건`);

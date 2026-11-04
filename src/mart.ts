export type Offer = { channel: string; brand: string; price: number; min: number; stores: number; sale: boolean };
export type MartProduct = { name: string; offers: Offer[] };
export type MartData = { source: string; surveyDate: string; products: MartProduct[] };
export type Verdict = 'store' | 'online' | 'mart' | 'unknown';

let cache: Promise<MartData> | undefined;
export function loadMart(): Promise<MartData> {
  cache ??= fetch('/data/mart_prices.json').then((r) => { if (!r.ok) throw Error('참가격 데이터를 불러오지 못했습니다.'); return r.json(); });
  return cache;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()·,]/g, '');
export function searchProducts(products: MartProduct[], q: string, limit = 8): MartProduct[] {
  const tokens = q.toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length) return [];
  return products
    .map((p) => ({ p, n: norm(p.name) }))
    .filter(({ n }) => tokens.every((t) => n.includes(norm(t))))
    .sort((a, b) => a.n.length - b.n.length)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** 대형마트 업태 중 가장 저렴한 브랜드 중앙가. 없으면 전체 업태 중 최저. */
export function bestMart(p: MartProduct): Offer | undefined {
  const big = p.offers.filter((o) => o.channel === '대형마트');
  const pool = big.length ? big : p.offers;
  return pool.reduce<Offer | undefined>((m, o) => (!m || o.price < m.price ? o : m), undefined);
}

/** 3% 이상 차이가 날 때만 한쪽을 추천합니다. 규격이 같다는 사용자 확인이 전제입니다. */
export function judge(store: number | null, online: number | null, mart: number | null): Verdict {
  if (store == null) return 'unknown';
  const others = [online, mart].filter((v): v is number => v != null);
  if (!others.length) return 'unknown';
  if (store <= Math.min(...others) * 0.97) return 'store';
  if (online != null && online < store * 0.97 && online <= (mart ?? Infinity)) return 'online';
  if (mart != null && mart < store * 0.97) return 'mart';
  return 'store';
}

const LINKS = 'shoppinglens-links';
export function getLinks(): Record<string, string> { try { return JSON.parse(localStorage.getItem(LINKS) || '{}'); } catch { return {}; } }
export function saveLink(barcode: string, name: string) { try { localStorage.setItem(LINKS, JSON.stringify({ ...getLinks(), [barcode]: name })); } catch { /* 저장소 사용 불가 */ } }

import type {PriceRecord} from './types';
export function cleanMoney(s:string):number|null {
 const n=Number(s.replace(/[^\d]/g,'')); return Number.isSafeInteger(n)&&n>0&&n<=100000000?n:null;
}
export function guessOCR(text:string){
 const lines=text.split(/\n/).map(x=>x.trim()).filter(Boolean);
 const prices:number[]=[];
 for(const line of lines){
  const matches=[...line.matchAll(/(?:^|\D)(\d{1,3}(?:[,\s]\d{3})+|\d{4,7})(?:\s*원|\b)/g)];
  for(const m of matches){const p=cleanMoney(m[1]);if(p!==null&&p>=1000&&p<=2000000)prices.push(p);}
 }
 const no=lines.map(l=>l.match(/(?:상품\s*번호|ITEM|NO\.?|#)\s*[:：#-]?\s*(\d{5,9})/i)).find(Boolean)?.[1]||'';
 const name=lines.filter(l=>/[가-힣A-Za-z]{2,}/.test(l)&&!/할인|금액|가격|합계|원$|코스트코|COSTCO/i.test(l)).sort((a,b)=>b.length-a.length)[0]||'';
 return {name,productNo:no,price:prices.length?Math.min(...prices):null,regularPrice:prices.length>1?Math.max(...prices):null,prices};
}
export function assess(r:Pick<PriceRecord,'productNo'|'name'|'price'|'regularPrice'|'store'|'imageHash'>,history:PriceRecord[]){
 const reasons:string[]=[];
 if(!/^\d{5,9}$/.test(r.productNo))reasons.push('상품번호가 5~9자리 숫자가 아닙니다.');
 if(r.name.trim().length<2)reasons.push('상품명을 확인해 주세요.');
 if(!Number.isSafeInteger(r.price)||r.price<100||r.price>10000000)reasons.push('가격 범위가 비정상적입니다.');
 if(r.regularPrice!==null&&r.regularPrice<r.price)reasons.push('정상가보다 최종 판매가가 높습니다.');
 if(!r.store)reasons.push('지점을 선택해 주세요.');
 if(r.imageHash&&history.some(h=>h.imageHash===r.imageHash))reasons.push('이미 등록된 동일 이미지입니다.');
 const peers=history.filter(h=>h.productNo===r.productNo&&h.status==='verified'&&h.source!=='demo');
 if(peers.length){const vals=peers.map(p=>p.price).sort((a,b)=>a-b);const median=vals[Math.floor(vals.length/2)];if(r.price<median*.5||r.price>median*2)reasons.push('검증된 기존 가격 대비 큰 차이가 있습니다.');}
 return reasons;
}
export async function hashImage(file:File){const bytes=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
export function won(n:number){return n.toLocaleString('ko-KR')+'원';}

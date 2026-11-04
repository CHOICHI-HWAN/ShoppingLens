import {lazy,Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {BarcodeDetector,setZXingModuleOverrides} from 'barcode-detector/ponyfill';
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';
import {bestMart,getLinks,judge,loadMart,saveLink,searchProducts,type MartData,type MartProduct,type Verdict} from './mart';
import {fetchOnlineLowest,firebaseEnabled,submitBarcodeLink} from './firebase';
import {won} from './logic';
const Report=lazy(()=>import('./Report'));
// wasm을 외부 CDN이 아닌 자체 호스팅 파일에서 불러옵니다(매장 내 약한 신호 대비).
setZXingModuleOverrides({locateFile:(path:string,prefix:string)=>path.endsWith('.wasm')?wasmUrl:prefix+path});
const FORMATS=['ean_13','ean_8','upc_a','upc_e'] as const;
const VERDICT:Record<Verdict,string>={store:'매장 구매 추천',online:'온라인 구매 추천',mart:'주변 마트 추천',unknown:'비교 정보 부족'};

export default function App(){
 const video=useRef<HTMLVideoElement>(null);const sheetOpen=useRef(false);
 const [barcode,setBarcode]=useState<string|null>(null);const [camError,setCamError]=useState('');const [camReady,setCamReady]=useState(false);
 const [mart,setMart]=useState<MartData|null>(null);const [search,setSearch]=useState(false);const [coffee,setCoffee]=useState(false);const [report,setReport]=useState(false);
 useEffect(()=>{loadMart().then(setMart).catch(()=>setMart(null));},[]);
 useEffect(()=>{sheetOpen.current=barcode!==null||search;},[barcode,search]);
 const onScan=useCallback((code:string)=>{navigator.vibrate?.(50);setBarcode(code);},[]);
 useEffect(()=>{
  let stop=false;let stream:MediaStream|undefined;let raf=0;
  (async()=>{
   try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});
    if(stop){stream.getTracks().forEach(t=>t.stop());return;}
    const v=video.current!;v.srcObject=stream;await v.play();
    // 권한은 통과했지만 영상이 오지 않는 경우(앱 내장 브라우저 등)를 감지합니다.
    const track=stream.getVideoTracks()[0];
    await new Promise(r=>setTimeout(r,1500));
    if(stop)return;
    if(!track||track.readyState!=='live'||track.muted||!v.videoWidth){setCamError('카메라 영상이 수신되지 않습니다. Safari/Chrome 등 기본 브라우저에서 이 주소를 열어 보세요.');return;}
    setCamReady(true);
    const det=new BarcodeDetector({formats:[...FORMATS]});let last=0;
    const loop=async()=>{
     if(stop)return;
     if(!sheetOpen.current&&performance.now()-last>150&&v.readyState>=2){last=performance.now();try{const r=await det.detect(v);if(r[0]&&!sheetOpen.current)onScan(r[0].rawValue);}catch{/* 프레임 건너뜀 */}}
     raf=requestAnimationFrame(loop);
    };loop();
   }catch(e){setCamError(e instanceof Error?e.message:'카메라를 열 수 없습니다.');}
  })();
  return()=>{stop=true;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());};
 },[onScan]);
 if(report)return <div className="report-wrap"><button className="back" onClick={()=>setReport(false)}>← 스캔으로</button><Suspense fallback={<p className="micro">불러오는 중…</p>}><Report/></Suspense></div>;
 return <div className="scanner">
  <video ref={video} playsInline muted autoPlay/>
  {!barcode&&!search&&camReady&&<div className="aim" aria-hidden="true"/>}
  {!camReady&&!camError&&<div className="cam-wait">카메라 준비 중… 권한 요청이 뜨면 허용해 주세요.</div>}
  <button className="coffee" aria-label="후원" onClick={()=>setCoffee(true)}>☕</button>
  {camError&&<div className="cam-error"><p>카메라 권한이 필요합니다.</p><small>{camError}</small><button onClick={()=>location.reload()}>다시 시도</button><ManualEntry onCode={onScan}/></div>}
  {!barcode&&!search&&<SearchHandle onOpen={()=>setSearch(true)}/>}
  {(barcode||search)&&<Sheet barcode={barcode} mart={mart} onClose={()=>{setBarcode(null);setSearch(false);}} onReport={()=>{setBarcode(null);setSearch(false);setReport(true);}}/>}
  {coffee&&<div className="modal" onClick={()=>setCoffee(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><h2>서버비 후원</h2><p>광고와 제휴 링크 없이 운영합니다. 자발적 후원만 받습니다.</p><p className="micro">후원 링크는 배포 시 설정하세요(토스 / Buy Me a Coffee).</p><button onClick={()=>setCoffee(false)}>닫기</button></div></div>}
 </div>;
}

function SearchHandle({onOpen}:{onOpen:()=>void}){
 const y=useRef(0);
 return <button className="handle" aria-label="상품 검색" onClick={onOpen} onTouchStart={e=>{y.current=e.touches[0].clientY;}} onTouchEnd={e=>{if(y.current-e.changedTouches[0].clientY>24)onOpen();}}><span/></button>;
}

function ManualEntry({onCode}:{onCode:(c:string)=>void}){
 const [v,setV]=useState('');
 return <form onSubmit={e=>{e.preventDefault();if(/^\d{8,14}$/.test(v))onCode(v);}}><input inputMode="numeric" value={v} onChange={e=>setV(e.target.value.replace(/\D/g,''))} placeholder="바코드 직접 입력"/><button>조회</button></form>;
}

function Sheet({barcode,mart,onClose,onReport}:{barcode:string|null;mart:MartData|null;onClose:()=>void;onReport:()=>void}){
 const [linked,setLinked]=useState<string|undefined>(()=>barcode?getLinks()[barcode]:undefined);
 const [q,setQ]=useState('');const [storePrice,setStorePrice]=useState('');
 const [online,setOnline]=useState<{price:number|null;mall?:string;title?:string}|'loading'|null>(null);
 const product:MartProduct|undefined=mart?.products.find(p=>p.name===linked);
 const results=mart&&!product?searchProducts(mart.products,q):[];
 useEffect(()=>{
  if(!product){setOnline(null);return;}
  let live=true;setOnline('loading');
  fetchOnlineLowest(product.name).then(r=>{if(live)setOnline(r?{price:r.lowestPrice,mall:r.mallName,title:r.title}:null);});
  return()=>{live=false;};
 },[product]);
 const m=product&&bestMart(product);
 const sp=storePrice?Number(storePrice):null;
 const onlinePrice=online&&online!=='loading'?online.price:null;
 const verdict=judge(sp,onlinePrice,m?.price??null);
 function pick(p:MartProduct){setLinked(p.name);if(!barcode)return;saveLink(barcode,p.name);if(firebaseEnabled)submitBarcodeLink(barcode,p.name).catch(()=>{});}
 return <div className="sheet" role="dialog" aria-label="가격 비교">
  <div className="grab"/><div className="sheet-head"><code>{barcode??'상품 검색'}</code><button aria-label="닫기" onClick={onClose}>×</button></div>
  {!mart&&<div className="shimmer"/>}
  {mart&&!product&&<div><p className="hint">{barcode?'이 바코드와 연결된 상품이 없습니다. 상품을 검색해 연결하세요.':'상품명으로 검색해 시세를 확인하세요.'}</p>
   <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="상품명 검색 (예: 신라면)"/>
   <ul className="results">{results.map(p=><li key={p.name}><button onClick={()=>pick(p)}>{p.name}</button></li>)}</ul>
   {q&&!results.length&&<p className="hint">참가격 조사 상품(약 {mart.products.length}종)에 없습니다.</p>}</div>}
  {product&&<div>
   <h2>{product.name}</h2>
   <label className="store-in">현장 가격(원)<input inputMode="numeric" value={storePrice} onChange={e=>setStorePrice(e.target.value.replace(/\D/g,''))} placeholder="가격표 금액 입력"/></label>
   {sp!==null&&<div className={'badge '+verdict}>{VERDICT[verdict]}</div>}
   <div className="cmp">
    <div><span>마트 시세</span><b>{m?won(m.price):'-'}</b><small>{m?`${m.brand} 등 ${m.stores}개 지점 중앙값 · ${mart!.surveyDate} 조사`:''}</small></div>
    <div><span>온라인 최저</span>{online==='loading'?<div className="shimmer s"/>:<b>{onlinePrice?won(onlinePrice):'-'}</b>}<small>{online&&online!=='loading'&&online.mall?online.mall:'네이버쇼핑'}</small></div>
   </div>
   <p className="micro">규격(용량·수량)이 같은 상품인지 직접 확인하세요. 출처: 한국소비자원 참가격(공공누리 제1유형), 네이버 쇼핑 검색. 조사 주기가 있어 실시간 가격이 아닙니다.</p>
   <div className="row"><button onClick={()=>{setLinked(undefined);}}>다른 상품으로 연결</button><button onClick={onReport}>현장 가격 제보</button></div>
  </div>}
 </div>;
}

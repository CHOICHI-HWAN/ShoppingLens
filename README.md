# ShoppingLens

바코드를 스캔해 **참가격(한국소비자원) 마트 시세**와 **네이버 온라인 최저가**를 현장 가격과 비교하는 모바일 웹앱.
비공식 프로젝트이며 Costco 등 어떤 유통사와도 무관합니다. 광고·제휴 링크 없음.

## 데이터
- 참가격: `data/mart-prices.csv`(공공데이터포털, 공공누리 제1유형 · 출처표시 필수) → `npm run data` → `public/data/mart_prices.json` (정적 파일, 상품 약 590종, 조사일 기준 시세)
- 바코드는 참가격에 없으므로 사용자가 상품을 한 번 연결하면 기기에 저장되고, Firebase 연결 시 `barcode_links`에 pending으로 제출됩니다.
- 온라인 최저가: `functions/index.js`(네이버 쇼핑 API, Firestore 30분 캐시)

## 실행
```bash
npm install && npm run data && npm run dev   # http://localhost:5173
```
카메라는 HTTPS 또는 localhost에서만 동작합니다.

## Firebase 배포
```bash
cp .env.example .env.local        # VITE_FIREBASE_* 입력
firebase functions:secrets:set NAVER_CLIENT_ID
firebase functions:secrets:set NAVER_CLIENT_SECRET
(cd functions && npm install)
npm run build && firebase deploy
```
Functions는 Blaze 요금제가 필요합니다. 공개 전 App Check와 예산 알림을 설정하세요.

## 한계
- 참가격 데이터는 격주 조사 값이며 실시간이 아닙니다. 코스트코 가격은 포함되지 않아 현장 가격은 직접 입력하거나 제보합니다.
- 네이버 검색은 키워드 기반이라 규격이 다른 상품이 나올 수 있습니다(화면에 확인 안내 표시).

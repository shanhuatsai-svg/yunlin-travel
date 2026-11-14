# 雲林縣旅遊網

以原本「雲林漫旅大冒險」的美食雷達版型為基礎，改為可自由選擇目的地的旅遊工具。Level 0 提供公車、國道客運、臺鐵與高鐵的轉乘參考。Level 1 優先搜尋所選地標直線距離 2 公里內的餐廳，全部店家不足十家時自動延伸至 5 公里，依距離排序，每批四家。啟用 Google Places 後，餐廳卡片可顯示 Google Maps 即時星等與評分數。Level 2 提供雙方案遊程規劃：已有想法者可自訂行程、調整時間與順序、使用景點靈感庫及多點導航；尚無想法者可套用預先整理的當地精選一日遊行程，再完成統整與複製分享文字。

## 行程規劃與定位

- 套用推薦行程會保留原訂時間與說明，並從本地目的地、景點及餐廳資料核對座標。已在 Level 1 選店時，推薦午餐帶入該店的座標與地址；未選店時顯示「待選餐廳」，加入實際餐廳後會替換占位並保留午餐時間。
- 自訂地點無法核對座標時標示「尚未定位」，不沿用原目的地座標，也不計算該地點附近的餐廳。可切換到已定位景點恢復推薦；關鍵字搜尋仍可用，但不顯示距離。
- Level 2 無關鍵字時，以選定景點及目前料理分類計算店家數，2 公里內不足十家就延伸至 5 公里，最多顯示十家。有關鍵字時搜尋全部餐廳資料，清楚標示不限距離。
- 上下移動站點時，時間與座標隨站點保留；使用者可自行調整抵達時間。變更行程後，重新按 FINISH 查看及複製最新統整。
- Level 2 依清單順序開啟開車導航，已定位地點使用座標，未定位地點交給 Google Maps 搜尋並請使用者核對；待選餐廳不加入導航。行程暫存在目前頁面，重新整理後重設。

## 預覽與發布

把整個 ZIP 解壓縮後，在檔案總管雙擊資料夾內的 `index.html`。請讓 `styles.css` 和各個 `.js` 檔與 `index.html` 放在同一層，這樣瀏覽器才能載入深色版型、目的地選單與餐廳卡片。

也可以在專案目錄執行 `python scripts/build-local-preview.py`。程式會在上一層產生 `雲林旅遊網-本機預覽.html`，把樣式與程式包進同一個檔案，可直接雙擊。修改網站後，重新執行一次便可預覽最新版本。

Google Maps、店家照片和網頁字型需要網路連線。即時星等需要下方設定並以 HTTP(S) 開啟。

1. 建立公開 GitHub repository。解壓縮後，將專案內容（包含 `.nojekyll`、`AGENTS.md` 和 `scripts/`）上傳至儲存庫根目錄，讓 `index.html` 位於最上層。
2. 到 **Settings → Pages**，選 **Deploy from a branch**，再選 **`main` → `/(root)`**，按 **Save**。
3. 部署完成後，開啟 Pages 設定頁顯示的網址，實測交通查詢、地標切換和 Google Maps 連結。把實際的 Repository 和 Pages 網址填入 [繳交稿](SUBMISSION.md)。詳見 [GitHub Pages 官方設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 啟用 Google 星等

1. 在 Google Cloud 專案設定計費並啟用 **Maps JavaScript API** 和 **Places API (New)**。
2. 建立專用的瀏覽器 API 金鑰。應用程式限制選「網站」，允許實際的 Pages 網站來源（例如 `https://你的帳號.github.io/*`）；API 限制選上述兩個 API。若要本機測試，再加上 `http://localhost:8000/*`。瀏覽器的跨站請求可能只帶來源網域，因此不要依賴 Pages 的專案子路徑限制。
3. 把已限制的瀏覽器金鑰填入 `index.html` 裡 `google-maps-browser-key` 的 `content`。靜態網站的訪客能看見這個值；請勿使用後端金鑰或未限制的金鑰。
4. 在專案目錄執行 `python -m http.server 8000 --bind 127.0.0.1`，開啟 `http://localhost:8000/`；發布後用 Pages 網址再確認一次。測試「斗六火車站」首批店家，點擊評分確認開啟正確分店。

星等查詢每批最多對四家店發出請求。Google 將 `rating` 和 `userRatingCount` 列入 Text Search Enterprise 計費，啟用前請設定配額並查閱 [Google 欄位計費說明](https://developers.google.com/maps/documentation/javascript/place-search#choose-data-fields)和 [金鑰限制指南](https://developers.google.com/maps/api-security-best-practices)。未設定金鑰、使用 `file://` 開啟、店家無法核對或 API 請求失敗時，顯示「到 Google Maps 看評分」連結。

## 資料與後續維護

- 餐廳來自[雲林縣政府餐飲開放資料](https://data.gov.tw/dataset/171666)，依政府資料開放授權條款第 1 版使用。網站整理店名、地址、座標、照片、營業資訊，並依店名和說明加上分類。資料為快照，店家營業情況請以店家公告為準。
- 交通卡片提供轉乘參考與官方查詢。輸入地址或車站後，可開啟 Google Maps 查詢完整的大眾運輸行程。當日班次由各業者及 Google Maps 提供。
- 更新餐飲資料時，下載[縣府 XML](https://tour.yunlin.gov.tw/XML2/Restaurant/Zh_tw)，在專案根目錄執行 `python scripts/import-restaurants.py <XML 路徑>`。
- 要新增目的地，可依 `AGENTS.md` 在 `destinations.js` 填上地標、座標、轉乘資訊與來源。表單、餐廳雷達與地圖會共用這筆資料。新增頁面時依同一份文件沿用樣式、相對路徑和驗收步驟。
- 景點靈感庫是 `townAttractions`，推薦行程是 `recommendedTours`，兩者均放在 `destinations.js` 並以目的地 `id` 分組。`AGENTS.md` 提供必要欄位、可參考的新增範例及驗收步驟。
- `itinerary.js` 集中處理時間、座標核對與行程導航，新增行程不必重寫畫面。首頁與單檔預覽都在餐廳資料之後、`app.js` 之前載入它。
- `site-info.html` 示範如何新增一個沿用版型、可從首頁頁尾進入的資訊頁。

## 開發驗證

在根目錄執行 `node --test tests/itinerary.test.cjs`。不需要安裝 npm 套件；測試涵蓋九組推薦行程的時間與座標、待選餐廳替換、未知地點、排序及 2／5 公里門檻。測試以 DOM 替身檢查資料與事件，瀏覽器的版型、剪貼簿與外部地圖仍依 `AGENTS.md` 的清單驗收。

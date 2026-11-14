'use strict';

const defaultRadiusMeters = 2000;
const extendedRadiusMeters = 5000;
const minRestaurantThreshold = 10;
const batchSize = 4;
const categoryNames = { all: '全部店家', brunch: '早午餐', cafe: '咖啡廳', japanese: '日式料理', korean: '韓式料理' };
const byId = (id) => document.getElementById(id);
const originInput = byId('origin');
const destinationSelect = byId('destination');
const routeResults = byId('route-results');
const categoryButtons = document.querySelectorAll('[data-category]');
const allRestaurants = byId('all-restaurants');
const nextBatch = byId('next-batch');
const mapFrame = byId('google-map');

let destination = destinations[0];
let category = 'all';
let batch = 0;
let nearby = [];
let selectedRestaurant = null;
let isCurrentDestinationExtended = false;

function mapsUrl(path, params) {
  return `https://www.google.com/maps/${path}/?${new URLSearchParams({ api: '1', ...params })}`;
}

function mapQuery(place) {
  return `${place.name} 雲林縣${place.town}`;
}

function coordinates(place) {
  return `${place.lat},${place.lon}`;
}

function distanceMeters(from, to) {
  const radians = Math.PI / 180;
  const latitudeDifference = (to.lat - from.lat) * radians;
  const longitudeDifference = (to.lon - from.lon) * radians;
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(longitudeDifference / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(haversine));
}

function distanceLabel(distance) {
  return `${distance < 1000 ? `${Math.round(distance)} 公尺` : `${(distance / 1000).toFixed(2)} 公里`}（直線）`;
}

function transportOptions(origin, place) {
  const northOrigin = /[臺台]北|新北|板橋|南港|三重|林口|桃園/.test(origin);
  const centralOrigin = /[臺台]中|朝馬/.test(origin);
  const directExample = northOrigin ? place.coach.north : centralOrigin ? place.coach.central : null;
  const otherExamples = Object.values(place.coach)
    .map((example) => `${example.from}出發可參考：${example.detail}`);
  const coach = directExample
    ? { title: `🚌 國道客運`, detail: `${directExample.from}上車參考。${directExample.detail}`, source: directExample.source }
    : {
      title: '🚌 國道客運',
      detail: otherExamples.length ? otherExamples.join(' ') : `在公路客運系統查詢從出發地可搭的班次，再確認是否能轉乘至${place.name}。`,
      source: transitSources.bus
    };
  const rail = place.rail;
  const hsr = place.hsr;
  return [
    { title: '🚏 市區公車／接駁', detail: place.local.detail, source: place.local.source, linkText: '查公車路線與班次' },
    { ...coach, linkText: '查客運路線與班次' },
    {
      title: '🚆 臺鐵火車',
      detail: rail ? `從可搭乘的臺鐵車站出發 → ${rail.station}。${rail.detail}` : `從可搭乘的臺鐵車站出發 → ${place.name}。請選擇有停靠的車次。`,
      source: transitSources.rail, linkText: '查臺鐵時刻', transfer: rail
    },
    {
      title: '🚄 台灣高鐵',
      detail: hsr ? `從可搭乘的高鐵車站出發 → ${hsr.station}。${hsr.detail}` : `從可搭乘的高鐵車站出發 → ${place.name}。請選擇有停靠雲林的車次。`,
      source: transitSources.hsr, linkText: '查高鐵時刻', transfer: hsr
    }
  ];
}

function showTrip(origin) {
  const summary = byId('route-summary');
  summary.textContent = `${origin} → ${destination.name}`;
  byId('transit-link').href = mapsUrl('dir', { origin, destination: mapQuery(destination), travelmode: 'transit' });
  const cards = transportOptions(origin, destination).map((option) => {
    const card = document.createElement('article');
    card.className = 'transport-card';
    const heading = document.createElement('h4');
    heading.textContent = option.title;
    const detail = document.createElement('p');
    detail.textContent = option.detail;
    card.append(heading, detail);
    const links = document.createElement('div');
    links.className = 'transport-links';
    links.append(externalLink(option.linkText, option.source));
    if (option.transfer) {
      links.append(externalLink('查接駁資訊', option.transfer.source));
    }
    card.append(links);
    return card;
  });
  byId('transport-options').replaceChildren(...cards);
  routeResults.hidden = false;
  byId('trip-status').textContent = `已更新交通與${destination.name}周邊餐廳。`;
  summary.focus();
}

function externalLink(label, href) {
  const link = document.createElement('a');
  link.textContent = `${label} ↗`;
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function setMap(place, label, searchQuery, zoom) {
  const mapUrl = new URL('https://maps.google.com/maps');
  mapUrl.search = new URLSearchParams({ q: coordinates(place), z: zoom, output: 'embed' });
  if (mapFrame.src !== mapUrl.href) {
    mapFrame.src = mapUrl.href;
  }
  mapFrame.title = `${place.name}周邊地圖`;
  byId('map-target').textContent = `📍 ${label}`;
  byId('external-map').href = mapsUrl('search', { query: searchQuery });
}

function resetRestaurantSelection() {
  byId('restaurant-selection').hidden = true;
  setMap(destination, destination.name, mapQuery(destination), isCurrentDestinationExtended ? '14' : '15');
}

function selectRestaurant({ item, distance }) {
  const selection = byId('restaurant-selection');
  const name = byId('selected-name');
  name.textContent = item.name;
  byId('selected-details').textContent = `從${destination.name}出發 · ${distanceLabel(distance)} · ${item.address}`;
  byId('walking-link').href = mapsUrl('dir', {
    origin: coordinates(destination),
    destination: coordinates(item),
    travelmode: 'walking'
  });
  setMap(item, item.name, `${item.name} ${item.address}`, '16');
  selection.hidden = false;
  name.focus({ preventScroll: true });
  selection.scrollIntoView({ block: 'nearest' });

  // 同步通知 Level 2 行程規劃
  selectedRestaurant = item;
  byId('banner-restaurant-name').textContent = `${item.name}（${item.address}）`;
  byId('selected-restaurant-banner').hidden = false;
  renderRecommendedTours();
}

function restaurantCard(result) {
  const { item, distance } = result;
  const card = byId('restaurant-template').content.firstElementChild.cloneNode(true);
  const image = card.querySelector('img');
  if (item.image) {
    image.addEventListener('error', () => { image.hidden = true; }, { once: true });
    image.src = item.image;
    image.hidden = false;
  }
  card.querySelector('.restaurant-type').textContent = categoryNames[item.categories[0]] ?? '在地餐飲';
  const hours = card.querySelector('.restaurant-hours');
  hours.textContent = item.hours ? `◷ ${item.hours}` : '◷ 營業時間請洽店家';
  hours.title = item.hours;
  const distLabel = distanceLabel(distance);
  const distText = (isCurrentDestinationExtended && distance > defaultRadiusMeters)
    ? `↗ 距目的地 ${distLabel}（5km 延伸）`
    : `↗ 距目的地 ${distLabel}`;
  card.querySelector('.restaurant-distance').textContent = distText;
  card.querySelector('.restaurant-address').textContent = `📍 ${item.address}`;
  card.querySelector('.restaurant-description').textContent = item.description;
  const choose = card.querySelector('button');
  choose.setAttribute('aria-label', `選擇這家店：${item.name}`);
  choose.addEventListener('click', () => selectRestaurant(result));
  const query = `${item.name} ${item.address}`;
  const mapLink = card.querySelector('.restaurant-map');
  const ratingLink = card.querySelector('.rating-link');
  mapLink.href = ratingLink.href = mapsUrl('search', { query });
  ratingLink.setAttribute('aria-label', `到 Google Maps 查看${item.name}的評分`);
  return card;
}

function renderRestaurants() {
  const results = category === 'all' ? nearby : nearby.filter(({ item }) => item.categories.includes(category));
  const pages = Math.ceil(results.length / batchSize);
  batch = pages > 0 ? batch % pages : 0;
  const start = batch * batchSize;
  byId('batch-tag').textContent = pages
    ? `${categoryNames[category]} · 第 ${batch + 1} / ${pages} 批 · ${results.length} 間`
    : `${categoryNames[category]} · 0 間`;
  nextBatch.disabled = pages < 2;
  const currentResults = results.slice(start, start + batchSize);
  const cards = byId('restaurant-cards');
  cards.replaceChildren(...currentResults.map(restaurantCard));
  if (typeof showGoogleRatings === 'function') {
    showGoogleRatings([...cards.children], currentResults);
  }
  const empty = byId('restaurant-empty');
  empty.hidden = results.length > 0;
  empty.textContent = category === 'all'
    ? `開放資料目前沒有${destination.name}周邊 ${isCurrentDestinationExtended ? '5' : '2'} 公里內的店家。可從地圖查詢附近餐廳。`
    : `開放資料目前沒有這個分類的店家。可切換「全部店家」查看附近餐飲。`;
}

function selectCategory(nextCategory) {
  category = nextCategory;
  batch = 0;
  for (const button of categoryButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.category === category));
  }
  allRestaurants.setAttribute('aria-pressed', String(category === 'all'));
  resetRestaurantSelection();
  renderRestaurants();
}

function changeDestination() {
  destination = destinations.find((place) => place.id === destinationSelect.value) ?? destinations[0];
  routeResults.hidden = true;
  byId('trip-status').textContent = `已切換到${destination.name}，請查詢新的交通路線。`;

  // 先計算所有店家與目的地的距離，並由近至遠排序
  const allWithDist = restaurants.map((item) => ({
    item,
    distance: distanceMeters(destination, item)
  })).sort((first, second) => first.distance - second.distance);

  // 優先以 2 公里內店家為主
  const within2km = allWithDist.filter(({ distance }) => distance <= defaultRadiusMeters);

  // 若 2 公里內店家數少於 10 家，則延伸至 5 公里（2 公里店家依然排列在最前列）
  isCurrentDestinationExtended = within2km.length < minRestaurantThreshold;

  nearby = isCurrentDestinationExtended
    ? allWithDist.filter(({ distance }) => distance <= extendedRadiusMeters)
    : within2km;

  // 更新 Level 1 說明標籤
  byId('radar-destination').textContent = isCurrentDestinationExtended
    ? `${destination.name} · 延伸 5 公里`
    : `${destination.name} · 方圓 2 公里`;
  byId('radar-center').textContent = destination.name;

  const radiusDesc = byId('radar-radius-desc');
  if (radiusDesc) {
    radiusDesc.textContent = isCurrentDestinationExtended
      ? '2 公里（因周邊店家少於 10 家，已自動延伸推薦至 5 公里，優先推薦近距離店家）'
      : '2 公里';
  }

  const mapCaption = byId('map-caption');
  if (mapCaption) {
    mapCaption.textContent = isCurrentDestinationExtended
      ? '餐廳篩選範圍 5 公里（已延伸）'
      : '餐廳篩選範圍 2 公里';
  }

  byId('map-center').textContent = `⌖ 中心：${destination.name}`;
  byId('results-center').textContent = isCurrentDestinationExtended
    ? `📍 ${destination.name} · 延伸 5 公里內`
    : `📍 ${destination.name} · 2 公里內`;

  selectCategory('all');
  selectedRestaurant = null;
  byId('selected-restaurant-banner').hidden = true;
  updateItineraryDestination();
}

// ---- Level 2 行程規劃師模組 ----
let itineraryStops = [];
let pickerFoodCategory = 'all';
let foodSearchQuery = '';
let selectedFoodAnchorId = null;

function getTimeLabel(index) {
  return itineraryModel.defaultTime(index);
}

function multiStopMapsUrl(stops) {
  return itineraryModel.mapsUrl(stops || []);
}

function detectStopType(name, defaultType = 'spot') {
  if (defaultType === 'origin' || defaultType === 'restaurant') return defaultType;
  if (/按摩|spa|養生|舒壓|足體|推拿|指壓|美容|舒活|腳底/i.test(name)) return 'relax';
  if (/(?:[路街道段巷弄號村里]|縣|市|鄉|鎮)/.test(name) && /\d+/.test(name)) return 'address';
  return defaultType;
}

function updateNextSuggestion() {
  const suggestText = byId('suggestion-text');
  const suggestActionBtn = byId('btn-suggestion-action');
  if (!suggestText || !suggestActionBtn) return;

  const lastStop = itineraryStops[itineraryStops.length - 1];
  if (!lastStop) return;

  if (lastStop.type === 'spot' || lastStop.type === 'origin' || lastStop.type === 'relax' || lastStop.type === 'address') {
    suggestText.textContent = `💡 造訪【${lastStop.name}】後肚子餓了嗎？推薦安排美味餐飲：`;
    suggestActionBtn.textContent = '👉 前往右側挑選「🍜 推薦美食」';
    suggestActionBtn.onclick = () => {
      selectedFoodAnchorId = lastStop.id;
      switchPickerTab('food');
      byId('picker-panel-food').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  } else {
    suggestText.textContent = `💡 在【${lastStop.name}】吃飽飽後！推薦前往特色景點或休閒店家走走：`;
    suggestActionBtn.textContent = '👉 前往右側挑選「🏛️ 景點與私房店家」';
    suggestActionBtn.onclick = () => {
      switchPickerTab('spot');
      byId('picker-panel-spot').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }
}

function invalidateItinerarySummary() {
  byId('itinerary-summary-card').hidden = true;
  byId('copy-toast-msg').hidden = true;
}

function stopLocationLabel(stop) {
  if (stop.isPlaceholder) return '待選餐廳（暫不加入導航）';
  return itineraryModel.hasCoordinates(stop) ? '' : '尚未定位';
}

function renderItinerary() {
  invalidateItinerarySummary();
  const listEl = byId('itinerary-list');
  const countEl = byId('itinerary-count');
  countEl.textContent = itineraryStops.length;

  listEl.replaceChildren(...itineraryStops.map((stop, index) => {
    const li = document.createElement('li');
    li.className = `timeline-item is-${stop.type}`;

    const dot = document.createElement('span');
    dot.className = 'timeline-node-dot';
    dot.textContent = stop.type === 'origin' ? '📍' : stop.type === 'restaurant' ? '🍜' : stop.type === 'relax' ? '💆' : stop.type === 'address' ? '📍' : '🏛️';

    const meta = document.createElement('div');
    meta.className = 'timeline-item-meta';

    // 支援使用者自由變更時間（需求 1）
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'timeline-time-input';
    timeInput.value = stop.time || getTimeLabel(index);
    timeInput.title = '點擊變更抵達時間';
    timeInput.setAttribute('aria-label', `變更 ${stop.name} 的抵達時間`);
    timeInput.addEventListener('change', (e) => {
      if (itineraryModel.isValidTime(e.target.value)) {
        stop.time = e.target.value;
        invalidateItinerarySummary();
      } else {
        e.target.value = stop.time;
      }
    });

    const badge = document.createElement('span');
    badge.className = 'timeline-badge';
    badge.textContent = stop.type === 'origin' ? '起點地標' : stop.type === 'restaurant' ? '美食餐飲' : stop.type === 'relax' ? '休閒店家' : stop.type === 'address' ? '自訂地址' : '特色景點';

    meta.append(timeInput, badge);

    const body = document.createElement('div');
    body.className = 'timeline-item-body';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'timeline-name';
    nameSpan.textContent = stop.name;

    const ctrlsDiv = document.createElement('div');
    ctrlsDiv.className = 'timeline-ctrls';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn-ctrl';
    upBtn.title = '上移此站';
    upBtn.setAttribute('aria-label', `上移 ${stop.name}`);
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveItineraryStop(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn-ctrl';
    downBtn.title = '下移此站';
    downBtn.setAttribute('aria-label', `下移 ${stop.name}`);
    downBtn.textContent = '▼';
    downBtn.disabled = index === itineraryStops.length - 1;
    downBtn.addEventListener('click', () => moveItineraryStop(index, 1));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn-ctrl btn-ctrl-del';
    delBtn.title = '移除此站';
    delBtn.setAttribute('aria-label', `移除 ${stop.name}`);
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => removeItineraryStop(index));

    ctrlsDiv.append(upBtn, downBtn, delBtn);
    body.append(nameSpan, ctrlsDiv);

    li.append(dot, meta, body);
    const locationLabel = stopLocationLabel(stop);
    if (locationLabel) {
      const status = document.createElement('p');
      status.className = 'location-status';
      status.textContent = locationLabel;
      li.append(status);
    }
    return li;
  }));

  updateNextSuggestion();
  updateFoodAnchorSelect();
  byId('btn-open-google-route').href = multiStopMapsUrl(itineraryStops);

  // 同步刷新右側按鈕的「已在時間線」狀態
  renderSpotsPicker();
  renderFoodPicker();
}

function moveItineraryStop(index, offset) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= itineraryStops.length) return;
  const temp = itineraryStops[index];
  itineraryStops[index] = itineraryStops[targetIndex];
  itineraryStops[targetIndex] = temp;
  renderItinerary();
}

function removeItineraryStop(index) {
  itineraryStops.splice(index, 1);
  if (itineraryStops.length === 0) {
    resetItineraryToOrigin();
    return;
  }
  renderItinerary();
}

function addItineraryStop(name, type = 'spot', coords = null, time = null) {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (itineraryStops.some((s) => s.name === trimmed)) {
    alert(`「${trimmed}」已經在您的時間線中囉！`);
    return;
  }

  const finalType = detectStopType(trimmed, type);
  const pendingIndex = finalType === 'restaurant'
    ? itineraryStops.findIndex((stop) => stop.isPlaceholder && stop.type === 'restaurant') : -1;
  const pendingStop = itineraryStops[pendingIndex];
  const newId = `stop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newStop = itineraryModel.createStop({
    ...coords,
    id: pendingStop ? pendingStop.id : newId,
    name: trimmed,
    type: finalType,
    time: time || (pendingStop && pendingStop.time),
    note: pendingStop ? pendingStop.note : ''
  }, pendingStop ? pendingIndex : itineraryStops.length);

  if (pendingStop) itineraryStops[pendingIndex] = newStop;
  else itineraryStops.push(newStop);

  // 當使用者加入景點、休閒店家或地址時，自動切換美食搜尋基準
  if (finalType === 'spot' || finalType === 'relax' || finalType === 'address') {
    selectedFoodAnchorId = newId;
  }

  renderItinerary();
}

function resetItineraryToOrigin() {
  itineraryStops = [itineraryModel.createStop({
    ...destination,
    id: 'origin',
    type: 'origin',
    time: '09:30'
  })];
  selectedFoodAnchorId = 'origin';
  const summaryCard = byId('itinerary-summary-card');
  if (summaryCard) summaryCard.hidden = true;
  renderItinerary();
}

function updateFoodAnchorSelect() {
  const select = byId('food-anchor-select');
  if (!select) return;

  // 取得時間線上可作為基準點的站點（起點、特色景點、休閒店家與自訂地址）
  const anchorStops = itineraryStops.filter((s) => s.type === 'origin' || s.type === 'spot' || s.type === 'relax' || s.type === 'address');
  select.disabled = anchorStops.length === 0;
  if (!anchorStops.length) {
    selectedFoodAnchorId = null;
    select.replaceChildren();
    return;
  }

  const validIds = anchorStops.map((s) => s.id);
  if (!selectedFoodAnchorId || !validIds.includes(selectedFoodAnchorId)) {
    // 預設選取最後一個非起點站點；若無則選起點
    const lastNonOrigin = [...anchorStops].reverse().find((s) => s.type !== 'origin');
    selectedFoodAnchorId = lastNonOrigin ? lastNonOrigin.id : anchorStops[0].id;
  }

  select.replaceChildren(...anchorStops.map((stop) => {
    const opt = document.createElement('option');
    opt.value = stop.id;
    const typeLabel = stop.type === 'origin' ? '起點' : stop.type === 'relax' ? '休閒' : stop.type === 'address' ? '地址' : '景點';
    opt.textContent = `${stop.name} (${typeLabel}${itineraryModel.hasCoordinates(stop) ? '' : ' · 尚未定位'})`;
    opt.selected = stop.id === selectedFoodAnchorId;
    return opt;
  }));
}

function getCurrentFoodAnchor() {
  // 必須保留使用者選到的未定位站點，不能悄悄改用另一個地點的座標。
  return itineraryStops.find((stop) => stop.id === selectedFoodAnchorId) || null;
}

function renderSpotsPicker() {
  const container = byId('inspiration-spots-list');
  if (!container) return;
  const spots = (typeof townAttractions !== 'undefined' && townAttractions[destination.id]) || [];
  if (!spots.length) {
    container.innerHTML = '<span class="muted" style="font-size: .82rem; padding: .5rem;">尚無特定景點推薦，可直接在上方輸入任何景點！</span>';
    return;
  }
  container.replaceChildren(...spots.map((spot) => {
    const card = document.createElement('div');
    card.className = 'spot-pick-card';

    const info = document.createElement('div');
    info.className = 'spot-pick-info';
    const name = document.createElement('div');
    name.className = 'spot-pick-name';
    name.textContent = `🏛️ ${spot.name}`;
    const desc = document.createElement('div');
    desc.className = 'spot-pick-desc';
    desc.textContent = spot.desc;
    info.append(name, desc);

    const inTimeLine = itineraryStops.some((s) => s.name === spot.name);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-pick-add';
    addBtn.textContent = inTimeLine ? '✓ 已在時間線' : '＋ 加入時間線';
    addBtn.disabled = inTimeLine;
    addBtn.addEventListener('click', () => {
      addItineraryStop(spot.name, 'spot', spot);
    });

    card.append(info, addBtn);
    return card;
  }));
}

function renderFoodPicker() {
  const container = byId('picker-restaurants-list');
  const centerEl = byId('food-picker-center');
  if (!container) return;

  const currentAnchor = getCurrentFoodAnchor();
  const located = itineraryModel.hasCoordinates(currentAnchor);
  if (centerEl) centerEl.textContent = currentAnchor ? currentAnchor.name : '尚未選擇景點';

  const locationStatus = byId('food-location-status');
  locationStatus.hidden = located;
  locationStatus.textContent = currentAnchor
    ? `「${currentAnchor.name}」尚未定位，已暫停附近餐廳計算。請切換到已定位景點；仍可用關鍵字搜尋店家，但不會顯示距離。`
    : '請先在時間線加入景點，再選擇美食搜尋中心。仍可用關鍵字搜尋店家。';

  let results = [];
  let isPickerExtended = false;
  const query = foodSearchQuery.trim().toLowerCase();

  const showEmpty = (text) => {
    const message = document.createElement('p');
    message.className = 'picker-empty';
    message.textContent = text;
    container.replaceChildren(message);
  };
  const radiusLabelEl = byId('food-picker-radius-label');
  if (!located && !query) {
    radiusLabelEl.textContent = currentAnchor ? '尚未定位' : '附近推薦已暫停';
    showEmpty('目前無法計算周邊距離；選擇已定位的景點後即可恢復推薦。');
    return;
  }

  // 若使用者輸入搜尋關鍵字（需求 3：搜尋功能）
  if (query) {
    results = restaurants
      .filter((item) => {
        const matchesQuery = item.name.toLowerCase().includes(query)
          || item.address.toLowerCase().includes(query)
          || (item.description && item.description.toLowerCase().includes(query));
        const matchesCategory = pickerFoodCategory === 'all' || item.categories.includes(pickerFoodCategory);
        return matchesQuery && matchesCategory;
      })
      .map((item) => ({
        item,
        distance: located ? distanceMeters(currentAnchor, item) : null
      }))
      .sort((a, b) => located ? a.distance - b.distance : a.item.name.localeCompare(b.item.name, 'zh-Hant'));
  } else {
    // 依據目前選中的景點座標，計算周邊美食
    const allDist = restaurants
      .map((item) => ({
        item,
        distance: distanceMeters(currentAnchor, item)
      }))
      .sort((a, b) => a.distance - b.distance);

    // 優先以 2 公里內店家為主
    const within2km = allDist.filter(({ item, distance }) => {
      const withinRadius = distance <= defaultRadiusMeters;
      const matchesCategory = pickerFoodCategory === 'all' || item.categories.includes(pickerFoodCategory);
      return withinRadius && matchesCategory;
    });

    // 若 2 公里內少於 10 家，則延伸至 5 公里
    isPickerExtended = within2km.length < minRestaurantThreshold;

    results = isPickerExtended
      ? allDist.filter(({ item, distance }) => {
          const withinRadius = distance <= extendedRadiusMeters;
          const matchesCategory = pickerFoodCategory === 'all' || item.categories.includes(pickerFoodCategory);
          return withinRadius && matchesCategory;
        })
      : within2km;
  }

  if (radiusLabelEl) {
    radiusLabelEl.textContent = query ? '全部資料搜尋（不限距離）'
      : isPickerExtended ? '5 公里內推薦美食（2 公里內不足十家，已延伸）' : '2 公里內推薦美食';
  }

  const displayList = results.slice(0, 10);
  if (!displayList.length) {
    showEmpty(query
      ? `查無「${query}」的餐廳，您可以點擊上方「＋ 加入時間線」新增自訂餐廳。`
      : `【${currentAnchor.name}】周邊 ${isPickerExtended ? '5' : '2'} 公里內暫無此分類店家，可切換「全部美食」或在上方搜尋／新增餐廳。`);
    return;
  }

  container.replaceChildren(...displayList.map(({ item, distance }) => {
    const card = document.createElement('div');
    card.className = 'food-pick-card';

    const main = document.createElement('div');
    main.className = 'food-pick-main';

    const name = document.createElement('div');
    name.className = 'food-pick-name';
    name.textContent = `🍜 ${item.name}`;

    const meta = document.createElement('div');
    meta.className = 'food-pick-meta';

    const dist = document.createElement('span');
    dist.className = 'food-pick-dist';
    const tag = (isPickerExtended && distance > defaultRadiusMeters) ? ' · 5km延伸' : '';
    dist.textContent = located
      ? `📍 距【${currentAnchor.name}】${distanceLabel(distance)}${tag}`
      : '搜尋中心尚未定位，無法計算距離';

    const cat = document.createElement('span');
    cat.className = 'food-pick-cat';
    cat.textContent = categoryNames[item.categories[0]] ?? '在地餐飲';

    const hours = document.createElement('span');
    hours.className = 'food-pick-hours';
    hours.textContent = item.hours ? `◷ ${item.hours}` : '';

    meta.append(dist, cat);
    if (item.hours) meta.append(hours);

    main.append(name, meta);

    const inTimeLine = itineraryStops.some((s) => s.name === item.name);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-pick-add';
    addBtn.textContent = inTimeLine ? '✓ 已在時間線' : '＋ 加入時間線';
    addBtn.disabled = inTimeLine;
    addBtn.addEventListener('click', () => {
      addItineraryStop(item.name, 'restaurant', item);
    });

    card.append(main, addBtn);
    return card;
  }));
}

function switchPickerTab(tabType) {
  const spotTab = byId('tab-pick-spot');
  const foodTab = byId('tab-pick-food');
  const spotPanel = byId('picker-panel-spot');
  const foodPanel = byId('picker-panel-food');
  if (!spotTab || !foodTab) return;

  if (tabType === 'spot') {
    spotTab.classList.add('active');
    spotTab.setAttribute('aria-selected', 'true');
    foodTab.classList.remove('active');
    foodTab.setAttribute('aria-selected', 'false');
    spotPanel.hidden = false;
    foodPanel.hidden = true;
  } else {
    foodTab.classList.add('active');
    foodTab.setAttribute('aria-selected', 'true');
    spotTab.classList.remove('active');
    spotTab.setAttribute('aria-selected', 'false');
    foodPanel.hidden = false;
    spotPanel.hidden = true;
    renderFoodPicker();
  }
}

function applyRecommendedTour(tour) {
  itineraryStops = itineraryModel.buildTourStops(tour, selectedRestaurant);
  const firstAnchor = itineraryStops.find((stop) => stop.type !== 'restaurant');
  selectedFoodAnchorId = firstAnchor ? firstAnchor.id : null;
  foodSearchQuery = '';
  byId('custom-food-input').value = '';
  renderItinerary();
  switchPlanTab('custom');
  byId('panel-plan-custom').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderRecommendedTours() {
  const container = byId('recommended-tours-container');
  byId('recommend-town-name').textContent = destination.town;
  const tours = recommendedTours[destination.id] || [];
  if (!tours.length) {
    const message = document.createElement('p');
    message.className = 'picker-empty';
    message.textContent = '這個目的地尚未建立推薦行程，可切換方案 A 自由安排。';
    container.replaceChildren(message);
    return;
  }

  container.replaceChildren(...tours.map((tour) => {
    const card = document.createElement('article');
    card.className = 'tour-card';

    const header = document.createElement('div');
    header.className = 'tour-card-header';
    const tag = document.createElement('span');
    tag.className = 'tour-tag';
    tag.textContent = tour.tag;
    const title = document.createElement('h4');
    title.className = 'tour-title';
    title.textContent = tour.title;
    const desc = document.createElement('p');
    desc.className = 'tour-desc';
    desc.textContent = tour.description;
    header.append(tag, title, desc);

    const timeline = document.createElement('ul');
    timeline.className = 'tour-timeline';
    const preparedStops = itineraryModel.buildTourStops(tour, selectedRestaurant);
    for (const step of preparedStops) {
      const li = document.createElement('li');
      li.className = 'tour-step';
      const time = document.createElement('span');
      time.className = 'tour-step-time';
      time.textContent = step.time;
      const name = document.createElement('span');
      name.className = 'tour-step-name';
      name.textContent = step.name;
      const note = document.createElement('span');
      note.className = 'tour-step-note';
      note.textContent = `(${[step.note, stopLocationLabel(step)].filter(Boolean).join(' · ')})`;
      li.append(time, name, note);
      timeline.append(li);
    }

    const actions = document.createElement('div');
    actions.className = 'tour-card-actions';

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'rpg-btn btn-apply-tour';
    applyBtn.textContent = '✓ 套用此推薦行程至自訂清單';
    applyBtn.addEventListener('click', () => applyRecommendedTour(tour));

    const mapBtn = document.createElement('a');
    mapBtn.className = 'rpg-btn btn-tour-map';
    mapBtn.target = '_blank';
    mapBtn.rel = 'noopener noreferrer';
    mapBtn.textContent = '🗺️ 在 Google Maps 開啟此路線 ↗';
    mapBtn.href = multiStopMapsUrl(preparedStops);

    actions.append(applyBtn, mapBtn);
    card.append(header, timeline, actions);
    return card;
  }));
}

function switchPlanTab(tabType) {
  const customTab = byId('tab-plan-custom');
  const recommendTab = byId('tab-plan-recommend');
  const customPanel = byId('panel-plan-custom');
  const recommendPanel = byId('panel-plan-recommend');

  if (tabType === 'custom') {
    customTab.classList.add('active');
    customTab.setAttribute('aria-selected', 'true');
    recommendTab.classList.remove('active');
    recommendTab.setAttribute('aria-selected', 'false');
    customPanel.hidden = false;
    recommendPanel.hidden = true;
  } else {
    recommendTab.classList.add('active');
    recommendTab.setAttribute('aria-selected', 'true');
    customTab.classList.remove('active');
    customTab.setAttribute('aria-selected', 'false');
    recommendPanel.hidden = false;
    customPanel.hidden = true;
  }
}

function updateItineraryDestination() {
  resetItineraryToOrigin();
  renderSpotsPicker();
  renderFoodPicker();
  renderRecommendedTours();
}

// 方案 A 表單與按鈕事件
const customStopInput = byId('custom-stop-input');
const locPreviewBox = byId('loc-preview-box');
const locPreviewName = byId('loc-preview-name');
const btnMapsSearchExt = byId('btn-maps-search-external');
const btnToggleMapPreview = byId('btn-toggle-map-preview');
const locInlineMapFrame = byId('loc-inline-map-frame');
const locPreviewIframe = byId('loc-preview-iframe');
const btnConfirmAddLocation = byId('btn-confirm-add-location');

function updateLocationPreview(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    if (locPreviewBox) locPreviewBox.hidden = true;
    if (locInlineMapFrame) locInlineMapFrame.hidden = true;
    return;
  }
  const searchQuery = trimmed.includes('雲林') ? trimmed : `${trimmed} 雲林`;
  if (locPreviewName) locPreviewName.textContent = trimmed;
  if (btnMapsSearchExt) btnMapsSearchExt.href = mapsUrl('search', { query: searchQuery });
  if (locPreviewBox) locPreviewBox.hidden = false;
  if (locInlineMapFrame && !locInlineMapFrame.hidden && locPreviewIframe) {
    const embedUrl = new URL('https://maps.google.com/maps');
    embedUrl.search = new URLSearchParams({ q: searchQuery, output: 'embed' });
    locPreviewIframe.src = embedUrl.href;
  }
}

if (customStopInput) {
  customStopInput.addEventListener('input', (e) => {
    updateLocationPreview(e.target.value);
  });
}

if (btnToggleMapPreview) {
  btnToggleMapPreview.addEventListener('click', () => {
    if (!locInlineMapFrame) return;
    const isHidden = locInlineMapFrame.hidden;
    locInlineMapFrame.hidden = !isHidden;
    btnToggleMapPreview.textContent = !isHidden ? '🗺️ 展開地圖預覽' : '關閉地圖預覽';
    if (!locInlineMapFrame.hidden && customStopInput && locPreviewIframe) {
      const q = customStopInput.value.trim();
      const searchQuery = q.includes('雲林') ? q : `${q} 雲林`;
      const embedUrl = new URL('https://maps.google.com/maps');
      embedUrl.search = new URLSearchParams({ q: searchQuery, output: 'embed' });
      locPreviewIframe.src = embedUrl.href;
    }
  });
}

function submitCustomStop() {
  if (!customStopInput) return;
  const val = customStopInput.value.trim();
  if (!val) return;
  const detectedType = detectStopType(val, 'spot');
  addItineraryStop(val, detectedType);
  customStopInput.value = '';
  if (locPreviewBox) locPreviewBox.hidden = true;
  if (locInlineMapFrame) locInlineMapFrame.hidden = true;
  if (btnToggleMapPreview) btnToggleMapPreview.textContent = '🗺️ 展開地圖預覽';
  customStopInput.focus();
}

byId('add-stop-form').addEventListener('submit', (event) => {
  event.preventDefault();
  submitCustomStop();
});

if (btnConfirmAddLocation) {
  btnConfirmAddLocation.addEventListener('click', () => {
    submitCustomStop();
  });
}

// 美食搜尋與手動新增表單（需求 3）
const customFoodInput = byId('custom-food-input');
if (customFoodInput) {
  customFoodInput.addEventListener('input', (e) => {
    foodSearchQuery = e.target.value;
    renderFoodPicker();
  });
}
const addFoodForm = byId('add-food-form');
if (addFoodForm) {
  addFoodForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = customFoodInput.value.trim();
    if (val) {
      addItineraryStop(val, 'restaurant');
      customFoodInput.value = '';
      foodSearchQuery = '';
      renderFoodPicker();
      customFoodInput.focus();
    }
  });
}

// 景點基準切換監聽（需求 2）
const foodAnchorSelect = byId('food-anchor-select');
if (foodAnchorSelect) {
  foodAnchorSelect.addEventListener('change', (e) => {
    selectedFoodAnchorId = e.target.value;
    renderFoodPicker();
  });
}

byId('btn-add-selected-restaurant').addEventListener('click', () => {
  if (selectedRestaurant) {
    addItineraryStop(selectedRestaurant.name, 'restaurant', selectedRestaurant);
  }
});

byId('btn-reset-itinerary').addEventListener('click', () => {
  if (confirm('確定要將今日行程重設為初始起點嗎？')) {
    resetItineraryToOrigin();
  }
});

byId('tab-plan-custom').addEventListener('click', () => switchPlanTab('custom'));
byId('tab-plan-recommend').addEventListener('click', () => switchPlanTab('recommend'));

byId('tab-pick-spot').addEventListener('click', () => switchPickerTab('spot'));
byId('tab-pick-food').addEventListener('click', () => switchPickerTab('food'));

// 美食分類按鈕過濾
document.querySelectorAll('[data-food-category]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-food-category]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    pickerFoodCategory = btn.dataset.foodCategory;
    renderFoodPicker();
  });
});

// ---- Level 2 行程結算與分享功能（Finish 按鈕 & 彩帶特效） ----
let confettiAnimationId = null;

function launchConfetti() {
  const canvas = byId('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (confettiAnimationId) {
    cancelAnimationFrame(confettiAnimationId);
    confettiAnimationId = null;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';

  const colors = [
    '#f59e0b', '#fbbf24', '#38bdf8', '#0284c7',
    '#10b981', '#34d399', '#ec4899', '#f43f5e',
    '#8b5cf6', '#a855f7', '#f97316', '#eab308'
  ];

  const count = 130;
  const confettis = Array.from({ length: count }, () => {
    const side = Math.random() < 0.5 ? 'left' : 'right';
    const startX = side === 'left' ? width * 0.2 + (Math.random() - 0.5) * 120 : width * 0.8 + (Math.random() - 0.5) * 120;
    const startY = height * 0.75 + (Math.random() - 0.5) * 60;
    const dir = side === 'left' ? 1 : -1;

    return {
      x: startX,
      y: startY,
      w: Math.random() * 8 + 6,
      h: Math.random() * 12 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() * 10 + 2) * dir + (Math.random() - 0.5) * 4,
      vy: -(Math.random() * 14 + 11),
      gravity: 0.38 + Math.random() * 0.1,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.08 + Math.random() * 0.08
    };
  });

  const startTime = performance.now();
  const duration = 3500;

  function loop(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    ctx.clearRect(0, 0, width, height);

    const fade = progress > 0.7 ? (1 - progress) / 0.3 : 1;

    for (const p of confettis) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.wobble += p.wobbleSpeed;

      const scaleX = Math.cos(p.wobble);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(scaleX, 1);
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (progress < 1) {
      confettiAnimationId = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, width, height);
      canvas.style.display = 'none';
      confettiAnimationId = null;
    }
  }

  confettiAnimationId = requestAnimationFrame(loop);
}

function generateItineraryShareText() {
  const lines = [];
  lines.push('✨【雲林一日遊冒險行程統整】✨');
  lines.push(`📍 出發起點：${itineraryStops[0] ? itineraryStops[0].name : destination.name}`);
  lines.push(`⏰ 停留站點：共 ${itineraryStops.length} 個站點`);
  lines.push('────────────────────');
  itineraryStops.forEach((stop, idx) => {
    const icon = stop.type === 'origin' ? '🚩' : stop.type === 'restaurant' ? '🍜' : stop.type === 'relax' ? '💆' : stop.type === 'address' ? '📍' : '🏛️';
    const typeLabel = stop.type === 'origin' ? '起點' : stop.type === 'restaurant' ? '美食' : stop.type === 'relax' ? '休閒' : stop.type === 'address' ? '地址' : '景點';
    const timeStr = stop.time || getTimeLabel(idx);
    const locationLabel = stopLocationLabel(stop);
    lines.push(`${idx + 1}. [${timeStr}] ${icon} ${stop.name} (${typeLabel})${locationLabel ? ` · ${locationLabel}` : ''}`);
    if (stop.address) {
      lines.push(`   地址：${stop.address}`);
    }
  });
  lines.push('────────────────────');
  lines.push('🗺️ Google Maps 多點導航路線：');
  lines.push(multiStopMapsUrl(itineraryStops));
  lines.push('依清單順序開車導航；待選餐廳已略過，尚未定位的地點請在 Google Maps 核對。');
  lines.push('\n🎒 由 雲林縣旅遊網 規劃產出');
  return lines.join('\n');
}

function showItinerarySummary() {
  const card = byId('itinerary-summary-card');
  const subInfo = byId('summary-sub-info');
  const stopsList = byId('summary-stops-list');
  const mapsBtn = byId('btn-summary-maps');
  if (!card || !stopsList) return;

  if (subInfo) {
    subInfo.textContent = `共 ${itineraryStops.length} 個停留站點 · 自「${itineraryStops[0] ? itineraryStops[0].name : destination.name}」出發`;
  }

  stopsList.replaceChildren(...itineraryStops.map((stop, idx) => {
    const li = document.createElement('li');
    li.className = 'summary-stop-item';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'summary-stop-time';
    timeSpan.textContent = stop.time || getTimeLabel(idx);

    const iconSpan = document.createElement('span');
    iconSpan.className = 'summary-stop-icon';
    iconSpan.textContent = stop.type === 'origin' ? '🚩' : stop.type === 'restaurant' ? '🍜' : stop.type === 'relax' ? '💆' : stop.type === 'address' ? '📍' : '🏛️';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'summary-stop-name';
    const locationLabel = stopLocationLabel(stop);
    nameSpan.textContent = `${stop.name}${locationLabel ? ` · ${locationLabel}` : ''}`;

    const typeSpan = document.createElement('span');
    typeSpan.className = 'summary-stop-type';
    const label = stop.type === 'origin' ? '起點' : stop.type === 'restaurant' ? '美食' : stop.type === 'relax' ? '休閒' : stop.type === 'address' ? '自訂' : '景點';
    typeSpan.textContent = label;

    li.append(timeSpan, iconSpan, nameSpan, typeSpan);
    return li;
  }));

  if (mapsBtn) {
    mapsBtn.href = multiStopMapsUrl(itineraryStops);
  }

  card.hidden = false;
  setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

const btnFinishItinerary = byId('btn-finish-itinerary');
if (btnFinishItinerary) {
  btnFinishItinerary.addEventListener('click', () => {
    launchConfetti();
    showItinerarySummary();
  });
}

const btnCopyItinerary = byId('btn-copy-itinerary');
if (btnCopyItinerary) {
  btnCopyItinerary.addEventListener('click', async () => {
    const text = generateItineraryShareText();
    const toast = byId('copy-toast-msg');
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) {
        copied = false;
      }
    }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        copied = document.execCommand('copy');
      } catch (e) {
        copied = false;
      } finally {
        ta.remove();
      }
    }

    if (toast) {
      if (copied) {
        toast.textContent = '✓ 行程文字已複製到剪貼簿！可直接貼在對話框傳給好友同伴囉！';
      } else {
        toast.textContent = '📋 行程已準備好，若未自動複製，請手動複製文字！';
      }
      toast.hidden = false;
      setTimeout(() => {
        toast.hidden = true;
      }, 4000);
    }
  });
}

const btnCloseSummary = byId('btn-close-summary');
if (btnCloseSummary) {
  btnCloseSummary.addEventListener('click', () => {
    const card = byId('itinerary-summary-card');
    if (card) card.hidden = true;
  });
}

for (const place of destinations) {
  destinationSelect.add(new Option(`${place.name}｜${place.town}`, place.id));
}
byId('restaurant-date').textContent = restaurantDataDate ? `（資料日期 ${restaurantDataDate}）` : '';

byId('trip-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const origin = originInput.value.trim();
  if (!origin) {
    originInput.setCustomValidity('請輸入出發地址、地標或車站。');
    originInput.reportValidity();
    return;
  }
  showTrip(origin);
});

originInput.addEventListener('input', () => {
  originInput.setCustomValidity('');
  routeResults.hidden = true;
});
destinationSelect.addEventListener('change', changeDestination);
for (const button of categoryButtons) {
  button.addEventListener('click', () => selectCategory(button.dataset.category));
}
allRestaurants.addEventListener('click', () => selectCategory('all'));
nextBatch.addEventListener('click', () => {
  batch += 1;
  resetRestaurantSelection();
  renderRestaurants();
});

changeDestination();

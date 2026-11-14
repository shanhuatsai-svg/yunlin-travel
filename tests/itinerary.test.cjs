'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

// 最小 DOM 替身只驗證資料、事件與文字，不代替瀏覽器排版及外部地圖驗收。
class Element {
  constructor() {
    this.children = [];
    this.events = {};
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.value = '';
    this.hidden = false;
    this.classList = { add() {}, remove() {} };
    this.selectors = new Map();
    this._text = '';
    this.innerHTML = '';
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(' '); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; this._text = ''; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, fn) { this.events[type] = fn; }
  add(option) { this.children.push(option); if (!this.value) this.value = option.value; }
  querySelector(selector) {
    if (!this.selectors.has(selector)) this.selectors.set(selector, new Element());
    return this.selectors.get(selector);
  }
  cloneNode() { return new Element(); }
  focus() {}
  scrollIntoView() {}
  setCustomValidity() {}
  reportValidity() {}
}

function setup() {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], new Element()]));
  elements.get('restaurant-template').content = { firstElementChild: new Element() };
  const buttons = (attribute) => [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, 'g'))].map((match) => {
    const el = new Element();
    el.dataset[attribute === 'data-category' ? 'category' : 'foodCategory'] = match[1];
    return el;
  });
  const categories = buttons('data-category');
  const foodCategories = buttons('data-food-category');
  const context = vm.createContext({
    URL, URLSearchParams, console, setTimeout: () => 0, clearTimeout() {}, alert() {}, confirm: () => true,
    document: {
      getElementById: (id) => elements.get(id) || null,
      createElement: () => new Element(),
      querySelectorAll: (selector) => selector === '[data-category]' ? categories : foodCategories
    },
    Option: function (label, value) { this.textContent = label; this.value = value; }
  });
  const run = (code) => vm.runInContext(code, context);
  for (const filename of ['destinations.js', 'restaurants.js', 'itinerary.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, filename), 'utf8'), context, { filename });
  }
  return { run, elements };
}

test('全部推薦行程保留原時間、備註，實際景點可定位，餐廳占位不假造座標', () => {
  const { run, elements } = setup();
  const results = run(`Object.entries(recommendedTours).flatMap(([destinationId, tours]) => tours.map((tour) => {
    destination = destinations.find((place) => place.id === destinationId);
    applyRecommendedTour(tour);
    return {
      title: tour.title,
      times: itineraryStops.every((stop, i) => stop.time === tour.stops[i].time),
      notes: itineraryStops.every((stop, i) => stop.note === tour.stops[i].note),
      locations: itineraryStops.every((stop) => stop.isPlaceholder
        ? stop.lat === null && stop.lon === null : itineraryModel.hasCoordinates(stop)),
      anchor: getCurrentFoodAnchor().id === itineraryStops[0].id
    };
  }))`);
  assert.equal(results.length, 9);
  for (const result of results) {
    assert.ok(result.times && result.notes && result.locations && result.anchor, result.title);
  }
  run('applyRecommendedTour(recommendedTours.douliu[0])');
  assert.equal(run('itineraryStops[1].time'), '10:00');
  assert.ok(elements.get('picker-restaurants-list').children.length > 1);
  assert.equal(elements.get('food-location-status').hidden, true);
});

test('Level 1 選餐廳後推薦連結更新，套用時保留餐廳座標、地址及午餐時間', () => {
  const { run, elements } = setup();
  const before = elements.get('recommended-tours-container').children[0].children[2].children[1].href;
  run('selectRestaurant(nearby[0])');
  const after = elements.get('recommended-tours-container').children[0].children[2].children[1].href;
  assert.notEqual(after, before);
  run('applyRecommendedTour(recommendedTours.douliu[0])');
  assert.equal(run('itineraryStops[2].time'), '12:00');
  assert.ok(run('itineraryStops[2].lat === selectedRestaurant.lat && itineraryStops[2].lon === selectedRestaurant.lon'));
  assert.ok(run('itineraryStops[2].address === selectedRestaurant.address && !itineraryStops[2].isPlaceholder'));
  const url = new URL(run('multiStopMapsUrl(itineraryStops)'));
  assert.equal(url.searchParams.get('origin'), run('coordinates(itineraryStops[0])'));
  assert.ok(url.searchParams.get('waypoints').includes(run('coordinates(selectedRestaurant)')));
  assert.equal(url.searchParams.get('travelmode'), 'driving');
});

test('新增餐廳替換待選午餐，保留原時間與站點數，導航略過未選午餐', () => {
  const { run } = setup();
  run('applyRecommendedTour(recommendedTours.douliu[0])');
  assert.ok(run('itineraryStops[2].isPlaceholder'));
  assert.ok(!decodeURIComponent(run('multiStopMapsUrl(itineraryStops)')).includes('美食雷達推薦午餐'));
  run('addItineraryStop(nearby[0].item.name, "restaurant", nearby[0].item)');
  assert.equal(run('itineraryStops.length'), 5);
  assert.equal(run('itineraryStops[2].time'), '12:00');
  assert.ok(run('!itineraryStops[2].isPlaceholder && itineraryModel.hasCoordinates(itineraryStops[2])'));
});

test('未知自訂地址明確未定位，附近計算停止，切回已定位景點後恢復', () => {
  const { run, elements } = setup();
  run('addItineraryStop("驗收用不存在的地址123號")');
  assert.ok(run('getCurrentFoodAnchor().lat === null && getCurrentFoodAnchor().lon === null'));
  assert.match(elements.get('itinerary-list').textContent, /尚未定位/);
  assert.match(elements.get('food-anchor-select').textContent, /尚未定位/);
  assert.equal(elements.get('food-location-status').hidden, false);
  assert.match(elements.get('picker-restaurants-list').textContent, /無法計算/);
  run('const originalDistance = distanceMeters; distanceMeters = () => { throw new Error("不應計算未知位置距離"); }; renderFoodPicker()');
  run('foodSearchQuery = restaurants[0].name; renderFoodPicker()');
  assert.match(elements.get('food-picker-radius-label').textContent, /不限距離/);
  assert.match(elements.get('picker-restaurants-list').textContent, /無法計算距離/);
  assert.doesNotMatch(elements.get('picker-restaurants-list').textContent, /NaN/);
  run('distanceMeters = originalDistance; foodSearchQuery = ""; selectedFoodAnchorId = "origin"; renderFoodPicker()');
  assert.equal(elements.get('food-location-status').hidden, true);
  assert.ok(elements.get('picker-restaurants-list').children.length > 1);
});

test('同名異址不猜座標；明確座標、地址與已知車站可核對', () => {
  const { run } = setup();
  run(`restaurants.push(
    { name: '同名測試店', address: '地址甲', lat: 23.7, lon: 120.5 },
    { name: '同名測試店', address: '地址乙', lat: 23.6, lon: 120.4 }
  )`);
  assert.equal(run('itineraryModel.createStop({ name: "同名測試店" }).lat'), null);
  assert.equal(run('itineraryModel.createStop({ name: "同名測試店", address: "地址甲" }).lat'), 23.7);
  assert.equal(run('itineraryModel.createStop({ name: "高鐵雲林站" }).lat'), 23.73639);
  assert.equal(run('itineraryModel.createStop({ name: "新地點", lat: 23.8, lon: 120.5 }).lat'), 23.8);
  assert.ok(run('[{ lat: null, lon: null }, { lat: "23.7", lon: "120.5" }, { lat: 100, lon: 120 }].every(p => !itineraryModel.hasCoordinates(p))'));
});

test('調整時間及排序保留站點資料，清除舊統整，分享起點使用實際第一站', () => {
  const { run, elements } = setup();
  run('applyRecommendedTour(recommendedTours.douliu[0]); showItinerarySummary()');
  assert.equal(elements.get('itinerary-summary-card').hidden, false);
  const input = elements.get('itinerary-list').children[1].children[1].children[0];
  input.events.change({ target: { value: '10:45' } });
  assert.equal(elements.get('itinerary-summary-card').hidden, true);
  run('moveItineraryStop(1, -1); showItinerarySummary()');
  assert.equal(run('itineraryStops[0].time'), '10:45');
  assert.equal(run('itineraryStops[0].name'), '雲中街生活聚落');
  assert.match(run('generateItineraryShareText()'), /出發起點：雲中街生活聚落/);
  assert.match(elements.get('summary-sub-info').textContent, /雲中街生活聚落/);
  const url = new URL(run('multiStopMapsUrl(itineraryStops)'));
  assert.equal(url.searchParams.get('origin'), run('coordinates(itineraryStops[0])'));
  run('removeItineraryStop(0)');
  assert.equal(elements.get('itinerary-summary-card').hidden, true);
});

test('移除所有景點後不沿用舊搜尋中心，清空時間線則還原目的地', () => {
  const { run, elements } = setup();
  run('addItineraryStop(nearby[0].item.name, "restaurant", nearby[0].item); removeItineraryStop(0)');
  assert.equal(run('getCurrentFoodAnchor()'), null);
  assert.equal(elements.get('food-anchor-select').disabled, true);
  assert.match(elements.get('picker-restaurants-list').textContent, /無法計算/);
  run('removeItineraryStop(0)');
  assert.equal(run('itineraryStops[0].name'), '斗六火車站');
  assert.equal(run('itineraryStops[0].time'), '09:30');
  assert.equal(elements.get('food-anchor-select').disabled, false);
});

test('2 公里九家會延伸，十家不延伸；Level 2 以分類後數量判斷', () => {
  const { run, elements } = setup();
  run(`const templateRestaurant = restaurants[0];
    restaurants.splice(0, restaurants.length,
      ...Array.from({length: 9}, (_, i) => ({...templateRestaurant, id: 'test-'+i, name: '測試餐廳'+i,
        lat: destination.lat, lon: destination.lon, categories: i === 0 ? ['cafe'] : []})),
      {...templateRestaurant, id: 'far', name: '遠方咖啡', lat: destination.lat, lon: destination.lon + 0.03, categories: ['cafe']}
    );
    changeDestination()`);
  assert.equal(run('isCurrentDestinationExtended'), true);
  assert.equal(run('nearby.length'), 10);
  run('restaurants.push({...restaurants[1], id: "tenth", name: "第十家"}); changeDestination()');
  assert.equal(run('isCurrentDestinationExtended'), false);
  assert.equal(run('nearby.length'), 10);
  run('pickerFoodCategory = "cafe"; renderFoodPicker()');
  assert.match(elements.get('food-picker-radius-label').textContent, /5 公里/);
  assert.equal(elements.get('picker-restaurants-list').children.length, 2);
  assert.match(elements.get('picker-restaurants-list').textContent, /5km延伸/);
});

test('未知地點與查無店家文字以純文字呈現，所有預設時間有效', () => {
  const { run, elements } = setup();
  run('foodSearchQuery = "<em>查無資料</em>"; renderFoodPicker()');
  assert.match(elements.get('picker-restaurants-list').textContent, /<em>查無資料<\/em>/);
  assert.equal(elements.get('picker-restaurants-list').innerHTML, '');
  assert.ok(run('Array.from({length: 30}, (_, i) => getTimeLabel(i)).every(itineraryModel.isValidTime)'));
});

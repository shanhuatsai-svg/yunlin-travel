'use strict';

// 行程資料處理不操作畫面、不呼叫定位服務，供網站與回歸測試共用。
const itineraryModel = (() => {
  function hasCoordinates(place) {
    return Boolean(place) && Number.isFinite(place.lat) && Number.isFinite(place.lon)
      && Math.abs(place.lat) <= 90 && Math.abs(place.lon) <= 180;
  }

  function isValidTime(time) {
    return typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
  }

  function defaultTime(index) {
    const times = ['09:30', '11:00', '12:30', '14:30', '16:00', '17:30', '19:00', '20:30'];
    if (index < times.length) return times[index];
    const minutes = Math.min(23 * 60 + 59, 20 * 60 + 30 + (index - 7) * 90);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function resolveLocation(place) {
    const unknown = { lat: null, lon: null, address: place.address || '' };
    if (place.isPlaceholder) return unknown;
    if (hasCoordinates(place)) return { lat: place.lat, lon: place.lon, address: place.address || '' };

    const candidates = [...destinations, ...Object.values(townAttractions).flat(), ...restaurants]
      .filter((item) => item.name === place.name && hasCoordinates(item)
        && (!place.address || item.address === place.address));
    if (!candidates.length) return unknown;

    const first = candidates[0];
    // 同一地標可同時存在於目的地與景點庫，容許小數位精度差異。
    // 同名但座標不同的分店不能用第一筆猜測位置。
    if (!candidates.every((item) => Math.abs(item.lat - first.lat) < 0.0001
      && Math.abs(item.lon - first.lon) < 0.0001)) return unknown;
    return { lat: first.lat, lon: first.lon, address: place.address || first.address || '' };
  }

  function createStop(stop, index = 0) {
    const name = stop.name.trim();
    return {
      id: stop.id,
      name,
      type: stop.type || 'spot',
      time: isValidTime(stop.time) ? stop.time : defaultTime(index),
      note: stop.note || '',
      isPlaceholder: Boolean(stop.isPlaceholder),
      ...resolveLocation({ ...stop, name })
    };
  }

  function buildTourStops(tour, selectedRestaurant = null) {
    return tour.stops.map((step, index) => {
      const restaurant = step.isPlaceholder && step.type === 'restaurant' ? selectedRestaurant : null;
      return createStop({
        ...step,
        ...(restaurant ? {
          name: restaurant.name, lat: restaurant.lat, lon: restaurant.lon,
          address: restaurant.address, isPlaceholder: false
        } : {}),
        id: `tour-stop-${index}`
      }, index);
    });
  }

  function mapsUrl(stops) {
    const locations = stops.filter((stop) => !stop.isPlaceholder).map((stop) => {
      if (hasCoordinates(stop)) return `${stop.lat},${stop.lon}`;
      const query = stop.address || stop.name;
      return query.includes('雲林') ? query : `${query} 雲林`;
    });
    if (!locations.length) return 'https://www.google.com/maps';
    if (locations.length === 1) {
      return `https://www.google.com/maps/search/?${new URLSearchParams({ api: '1', query: locations[0] })}`;
    }
    const params = {
      api: '1', origin: locations[0], destination: locations[locations.length - 1], travelmode: 'driving'
    };
    if (locations.length > 2) params.waypoints = locations.slice(1, -1).join('|');
    return `https://www.google.com/maps/dir/?${new URLSearchParams(params)}`;
  }

  return Object.freeze({ hasCoordinates, isValidTime, defaultTime, resolveLocation, createStop, buildTourStops, mapsUrl });
})();

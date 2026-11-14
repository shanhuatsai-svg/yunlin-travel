'use strict';

const showGoogleRatings = (() => {
  const browserKey = document.querySelector('meta[name="google-maps-browser-key"]')?.content.trim();
  const canLoad = browserKey && ['http:', 'https:'].includes(location.protocol);
  const countFormat = new Intl.NumberFormat('zh-TW');
  let placesLibrary;
  let batchTimer;
  let batchVersion = 0;

  function withTimeout(promise) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Google Maps request timed out')), 10000);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function loadPlaces() {
    if (!placesLibrary) {
      placesLibrary = withTimeout(new Promise((resolve, reject) => {
        window.yunlinPlacesReady = () => resolve(window.google.maps.importLibrary('places'));
        window.gm_authFailure = () => reject(new Error('Google Maps authentication failed'));
        const script = document.createElement('script');
        const params = new URLSearchParams({
          key: browserKey, loading: 'async', v: 'quarterly', language: 'zh-TW',
          region: 'TW', callback: 'yunlinPlacesReady'
        });
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.async = true;
        script.onerror = () => reject(new Error('Google Maps script failed to load'));
        document.head.append(script);
      }));
    }
    return placesLibrary;
  }

  function normalizeName(value) {
    return (value ?? '').normalize('NFKC').toLowerCase().replace(/臺/g, '台').replace(/[^\p{L}\p{N}]/gu, '');
  }

  function normalizeAddress(value) {
    return (value ?? '').normalize('NFKC').replace(/臺/g, '台')
      .replace(/[\s,、，]/g, '').replace(/^(?:台灣|\d{3,6})+|台灣$/g, '');
  }

  function matchPlace(item, places) {
    const name = normalizeName(item.name);
    const address = normalizeAddress(item.address);
    const matches = places.filter((place) => {
      if (!place.id || !place.location || !name) return false;
      const candidate = normalizeName(place.displayName);
      const candidateAddress = normalizeAddress(place.formattedAddress);
      const meters = distanceMeters(item, { lat: place.location.lat(), lon: place.location.lng() });
      const sameName = candidate === name;
      const relatedName = Math.min(name.length, candidate.length) >= 4
        && (candidate.includes(name) || name.includes(candidate));
      if (address && candidateAddress) {
        return meters <= 150 && address === candidateAddress && (sameName || relatedName);
      }
      return meters <= 45 && sameName;
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function showAttributions(card, attributions = []) {
    const container = card.querySelector('.rating-providers');
    for (const { provider, providerURI } of attributions ?? []) {
      if (!provider) continue;
      if (container.childNodes.length) container.append(' · ');
      if (typeof providerURI === 'string' && /^https?:\/\//i.test(providerURI)) {
        container.append(externalLink(provider, providerURI));
      } else {
        container.append(provider);
      }
    }
    container.hidden = !container.childNodes.length;
  }

  async function fillRating(card, item, version) {
    const status = card.querySelector('.rating-status');
    const isCurrent = () => version === batchVersion && card.isConnected;
    status.textContent = '查詢中…';
    status.hidden = false;
    try {
      const { Place } = await loadPlaces();
      if (!isCurrent()) return;
      const query = `${item.name} ${item.address}`;
      const { places } = await withTimeout(Place.searchByText({
        textQuery: query,
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount'],
        locationBias: { center: { lat: item.lat, lng: item.lon }, radius: 150 },
        language: 'zh-TW',
        region: 'tw',
        maxResultCount: 5
      }));
      if (!isCurrent()) return;
      const place = matchPlace(item, places);
      if (!place) return;
      const link = card.querySelector('.rating-link');
      link.href = card.querySelector('.restaurant-map').href = mapsUrl('search', {
        query, query_place_id: place.id
      });
      if (!Number.isFinite(place.rating) || place.rating < 1 || place.rating > 5) return;
      const score = place.rating.toFixed(1);
      const count = Number.isInteger(place.userRatingCount) && place.userRatingCount > 0
        ? `${countFormat.format(place.userRatingCount)} 則評分` : '';
      card.querySelector('.rating-score').textContent = `${score} / 5`;
      const countLabel = card.querySelector('.rating-count');
      countLabel.textContent = count;
      countLabel.hidden = !count;
      card.querySelector('.rating-fallback').hidden = true;
      card.querySelector('.rating-value').hidden = false;
      link.setAttribute('aria-label', `${item.name}：Google Maps ${score} 星，滿分 5 星${count ? `，${count}` : ''}。前往 Google Maps`);
      showAttributions(card, place.attributions);
    } catch {
      // Keep the Google Maps link when the optional service is unavailable.
    } finally {
      if (isCurrent()) status.hidden = true;
    }
  }

  return (cards, results) => {
    const version = ++batchVersion;
    clearTimeout(batchTimer);
    if (!canLoad || !cards.length) return;
    batchTimer = setTimeout(() => {
      cards.forEach((card, index) => { void fillRating(card, results[index].item, version); });
    }, 250);
  };
})();

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// State
let activeTab = 'day1';
let map = null;
let markers = [];
let activeInfoWindow = null;
let googleReady = false;

// Category colors
const TYPE_COLORS = {
  food: '#e06040',
  coffee: '#c8982e',
  culture: '#5a9cd4',
  drink: '#5aac6a',
  hotel: '#7a7870'
};

// Map style — hide POIs except parks, hide transit
const MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] }
];

// WMO weather code descriptions
const WEATHER_DESCRIPTIONS = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Depositing rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Freezing drizzle', 57: 'Dense freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains', 80: 'Slight showers', 81: 'Moderate showers',
  82: 'Violent showers', 85: 'Slight snow showers', 86: 'Heavy snow showers'
};

const WEATHER_ICONS = {
  0: '\u2600\uFE0F', 1: '\u26C5', 2: '\u26C5', 3: '\u2601\uFE0F',
  45: '\uD83C\uDF2B\uFE0F', 48: '\uD83C\uDF2B\uFE0F',
  51: '\uD83C\uDF27\uFE0F', 53: '\uD83C\uDF27\uFE0F', 55: '\uD83C\uDF27\uFE0F',
  56: '\uD83C\uDF27\uFE0F', 57: '\uD83C\uDF27\uFE0F',
  61: '\uD83C\uDF27\uFE0F', 63: '\uD83C\uDF27\uFE0F', 65: '\uD83C\uDF27\uFE0F',
  66: '\uD83C\uDF27\uFE0F', 67: '\uD83C\uDF27\uFE0F',
  71: '\uD83C\uDF28\uFE0F', 73: '\uD83C\uDF28\uFE0F', 75: '\uD83C\uDF28\uFE0F',
  77: '\uD83C\uDF28\uFE0F', 80: '\uD83C\uDF26\uFE0F', 81: '\uD83C\uDF26\uFE0F',
  82: '\uD83C\uDF26\uFE0F', 85: '\uD83C\uDF28\uFE0F', 86: '\uD83C\uDF28\uFE0F'
};

// Photo cache — keyed by stop name
const photoCache = {};

// Called by Google Maps script callback
function onGoogleMapsReady() {
  googleReady = true;
  initMap();
  updateMapForTab(activeTab);
  fetchWeather();
  preloadPhotos();
}
window.onGoogleMapsReady = onGoogleMapsReady;

function init() {
  renderNav();
  renderDays();
  renderMaybes();
  switchTab('day1');
}

function renderNav() {
  const nav = document.getElementById('nav');
  const allTabs = [
    ...TRIP_DATA.days.map(d => ({ id: d.id, label: d.label })),
    { id: 'maybes', label: 'Backup Spots' }
  ];
  nav.innerHTML = allTabs.map(t =>
    `<button class="nav-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`
  ).join('');
  nav.addEventListener('click', e => {
    const tab = e.target.closest('.nav-tab');
    if (tab) switchTab(tab.dataset.tab);
  });
}

function switchTab(id) {
  activeTab = id;
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === id));
  document.querySelectorAll('.page').forEach(v => v.classList.toggle('active', v.id === `view-${id}`));
  updateMapForTab(id);
}

// ---- WEATHER ----

function fetchWeather() {
  // Fetch detailed weather for Mar 11-13 (3 days only, drop Saturday)
  fetch('https://api.open-meteo.com/v1/forecast?latitude=59.913&longitude=10.752&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weathercode,windspeed_10m_max&timezone=Europe/Oslo&start_date=2026-03-11&end_date=2026-03-13')
    .then(r => r.json())
    .then(data => {
      if (!data.daily) return;
      const days = data.daily;
      const dayIds = ['day1', 'day2', 'day3'];

      dayIds.forEach((dayId, i) => {
        const el = document.getElementById(`weather-${dayId}`);
        if (!el) return;

        const code = days.weathercode[i];
        const icon = WEATHER_ICONS[code] || '\u2601\uFE0F';
        const desc = WEATHER_DESCRIPTIONS[code] || 'Cloudy';
        const hi = Math.round(days.temperature_2m_max[i]);
        const lo = Math.round(days.temperature_2m_min[i]);
        const rain = days.precipitation_probability_max[i];
        const precip = days.precipitation_sum[i];
        const wind = Math.round(days.windspeed_10m_max[i]);

        let detail = `Wind ${wind} km/h`;
        if (rain > 0) detail += ` \u00B7 ${rain}% chance of precipitation`;
        if (precip > 0) detail += ` (${precip}mm)`;

        el.innerHTML = `
          <span class="weather-card-icon">${icon}</span>
          <div class="weather-card-main">
            <div class="weather-card-desc">${desc}</div>
            <div class="weather-card-detail">${detail}</div>
          </div>
          <div class="weather-card-temp">
            ${hi}\u00B0<span>${lo}\u00B0 low</span>
          </div>
        `;
      });
    })
    .catch(() => {
      ['day1', 'day2', 'day3'].forEach(dayId => {
        const el = document.getElementById(`weather-${dayId}`);
        if (el) el.innerHTML = '<span style="font-size:0.7rem;color:var(--text-dim)">Weather unavailable</span>';
      });
    });
}

// ---- PHOTO PRELOAD ----

async function preloadPhotos() {
  try {
    const { Place } = await google.maps.importLibrary('places');
    const allStops = [
      ...TRIP_DATA.days.flatMap(d => d.stops),
      ...TRIP_DATA.maybes
    ];
    // Fetch in small batches to avoid rate limits
    for (const stop of allStops) {
      if (photoCache[stop.name]) continue;
      try {
        const { places } = await Place.searchByText({
          textQuery: stop.name + ' Oslo',
          fields: ['photos'],
          maxResultCount: 1
        });
        if (places?.[0]?.photos?.length > 0) {
          photoCache[stop.name] = places[0].photos[0].getURI({ maxWidth: 480, maxHeight: 260 });
        } else {
          photoCache[stop.name] = '';
        }
      } catch (_) {
        photoCache[stop.name] = '';
      }
    }
  } catch (_) {}
}

// ---- MAP ----

function initMap() {
  if (!googleReady) return;
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 59.913, lng: 10.752 },
    zoom: 14,
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'cooperative',
    styles: MAP_STYLES
  });
}

function updateMapForTab(id) {
  if (!map) return;

  // Clear old markers
  markers.forEach(m => m.setMap(null));
  markers = [];

  let stops;
  if (id === 'maybes') {
    stops = TRIP_DATA.maybes;
  } else {
    const day = TRIP_DATA.days.find(d => d.id === id);
    if (!day) return;
    stops = day.stops;
  }

  // Fit bounds
  const bounds = new google.maps.LatLngBounds();
  stops.forEach(s => bounds.extend({ lat: s.lat, lng: s.lng }));
  map.fitBounds(bounds, { top: 20, bottom: 40, left: 20, right: 20 });

  // Add markers
  stops.forEach((s, i) => {
    const color = TYPE_COLORS[s.type] || '#888';
    const marker = new google.maps.Marker({
      position: { lat: s.lat, lng: s.lng }, map,
      label: { text: String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '800' },
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: color, fillOpacity: 1, strokeColor: 'rgba(0,0,0,0.4)', strokeWeight: 2 },
      title: s.name
    });

    const typeLabel = s.type.charAt(0).toUpperCase() + s.type.slice(1);

    const buildContent = (photoUrl) => `
      <div style="font-family:-apple-system,system-ui,sans-serif;width:230px;-webkit-font-smoothing:antialiased;position:relative">
        <button onclick="event.stopPropagation();if(window.__activeIW)window.__activeIW.close()" style="position:absolute;top:6px;right:6px;z-index:10;width:24px;height:24px;border-radius:50%;border:none;background:rgba(0,0,0,0.45);color:#fff;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)">\u2715</button>
        ${photoUrl
          ? `<img src="${photoUrl}" style="width:100%;height:100px;object-fit:cover;display:block;border-radius:10px 10px 0 0;box-shadow:inset 0 0 0 1px rgba(0,0,0,0.08)" alt="${s.name}">`
          : ''
        }
        <div style="padding:10px 12px 12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="width:24px;height:24px;border-radius:50%;background:${color};color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 4px rgba(0,0,0,0.15),0 0 0 1.5px rgba(0,0,0,0.08)">${i + 1}</span>
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;font-weight:700;line-height:1.2;color:#1a1a18">${s.name}</div>
              <div style="font-size:10px;color:#555;margin-top:2px">${typeLabel} \u00B7 ${s.hours}${s.rating ? ` \u00B7 \u2605 ${s.rating}` : ''}</div>
            </div>
          </div>
          <a href="${s.mapsUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#1a73e8;text-decoration:none">Google Maps \u2197</a>
        </div>
      </div>`;

    const infoWindow = new google.maps.InfoWindow({ content: buildContent(null), disableAutoPan: true });

    marker.addListener('click', async () => {
      if (activeInfoWindow) activeInfoWindow.close();
      const photo = photoCache[s.name] || null;
      infoWindow.setContent(buildContent(photo));
      infoWindow.open(map, marker);
      activeInfoWindow = infoWindow;
      window.__activeIW = infoWindow;

      // Instant jump so marker + InfoWindow are both visible (no animated pan)
      moveCameraToMarkerWithOffset(marker, 100);

      setTimeout(() => {
        // Hide Google's default close button
        const chr = document.querySelector('.gm-style-iw-chr');
        if (chr) chr.style.display = 'none';
      }, 50);

      // If photo not preloaded yet, fetch on demand
      if (!photo && !photoCache.hasOwnProperty(s.name)) {
        try {
          const { Place } = await google.maps.importLibrary('places');
          const { places } = await Place.searchByText({
            textQuery: s.name + ' Oslo',
            fields: ['photos'],
            maxResultCount: 1
          });
          if (places?.[0]?.photos?.length > 0) {
            photoCache[s.name] = places[0].photos[0].getURI({ maxWidth: 480, maxHeight: 260 });
            infoWindow.setContent(buildContent(photoCache[s.name]));
          }
        } catch (_) {}
      }
    });
    markers.push(marker);
  });
}

// ---- TIME-OF-DAY GROUPING ----

function getTimeOfDay(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 'morning';
  let h = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'late-night';
}

const TIME_LABELS = {
  'morning': 'Morning',
  'afternoon': 'Afternoon',
  'evening': 'Evening',
  'late-night': 'Late Night'
};

function groupStopsByTime(stops) {
  const groups = [];
  let currentGroup = null;
  stops.forEach((s, i) => {
    const tod = getTimeOfDay(s.time);
    if (!currentGroup || currentGroup.tod !== tod) {
      currentGroup = { tod, label: TIME_LABELS[tod], stops: [] };
      groups.push(currentGroup);
    }
    currentGroup.stops.push({ ...s, _index: i });
  });
  return groups;
}

// ---- GOOGLE MAPS ROUTE URL ----

function buildGoogleMapsRouteUrl(stops) {
  if (stops.length < 2) return null;
  const origin = `${stops[0].lat},${stops[0].lng}`;
  const dest = `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;
  const waypoints = stops.slice(1, -1).map(s => `${s.lat},${s.lng}`).join('|');
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

// ---- RENDER DAYS ----

function renderDays() {
  const content = document.getElementById('content');
  TRIP_DATA.days.forEach((day, dayIdx) => {
    const routeUrl = buildGoogleMapsRouteUrl(day.stops);
    const dayNum = String(dayIdx + 1).padStart(2, '0');
    const groups = groupStopsByTime(day.stops);

    const el = document.createElement('div');
    el.className = 'page';
    el.id = `view-${day.id}`;
    el.innerHTML = `
      <div class="day-num">${dayNum}</div>
      <div class="day-title">${day.title}</div>
      <div class="day-meta">${day.date} \u00B7 ${day.stops.length} stops</div>
      <div id="weather-${day.id}" class="weather-card"></div>
      <div class="narrative-card">${day.narrative}</div>
      ${routeUrl ? `<a class="route-btn" href="${routeUrl}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.71 11.29l-9-9a1 1 0 00-1.42 0l-9 9a1 1 0 000 1.42l9 9a1 1 0 001.42 0l9-9a1 1 0 000-1.42zM14 14.5V12h-4v3H8v-4a1 1 0 011-1h5V7.5l3.5 3.5-3.5 3.5z"/></svg>
        Open walking route
      </a>` : ''}
      ${groups.map(g => `
        <div class="time-group">
          <span class="time-label">${g.label}</span>
          ${g.stops.map(s => renderStop(s)).join('')}
        </div>
      `).join('')}
    `;
    content.appendChild(el);
  });
}

function renderStop(stop) {
  const num = stop._index + 1;
  const color = TYPE_COLORS[stop.type] || '#888';
  return `
    <div class="stop-widget ${stop.type}" data-stop-index="${stop._index}" onclick="focusStop(${stop._index})">
      <div class="stop-head">
        <div class="stop-name-area">
          <div class="stop-name">
            <span class="stop-num" style="background:${color}">${num}</span>
            ${stop.name}
            ${stop.mustVisit ? '<span class="must-badge">MUST VISIT</span>' : ''}
          </div>
        </div>
        <span class="stop-time-badge">${stop.time}</span>
      </div>
      <div class="stop-note">${stop.notes}</div>
      <div class="stop-foot">
        <span class="stop-type-label ${stop.type}">${stop.type}</span>
        <span class="stop-hours">${stop.hours}</span>
        ${stop.rating ? `<span class="stop-rating">\u2605 ${stop.rating}</span>` : ''}
        <a class="stop-maps" href="${stop.mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Maps \u2197</a>
      </div>
    </div>
  `;
}

// ---- RENDER MAYBES ----

function renderMaybes() {
  const content = document.getElementById('content');
  const el = document.createElement('div');
  el.className = 'page';
  el.id = 'view-maybes';
  el.innerHTML = `
    <div class="day-num">*</div>
    <div class="day-title">Backup Spots</div>
    <div class="day-meta">Swap in if plans change \u00B7 ${TRIP_DATA.maybes.length} options</div>
    ${TRIP_DATA.maybes.map((m, i) => `
      <div class="maybe-card" data-maybe-index="${i}" onclick="focusMaybe(${i})">
        <div class="maybe-head">
          <div class="stop-name-area">
            <div class="maybe-name">
              <span class="stop-type-dot" style="background:var(--${m.type})"></span>
              ${m.name}
            </div>
          </div>
          <span class="maybe-rating">\u2605 ${m.rating}</span>
        </div>
        <div class="maybe-note">${m.notes}</div>
        <div class="stop-foot">
          <span class="stop-type-label ${m.type}">${m.type}</span>
          <span class="stop-hours">${m.hours}</span>
          <a class="stop-maps" href="${m.mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Maps \u2197</a>
        </div>
      </div>
    `).join('')}
  `;
  content.appendChild(el);
}

// ---- MAP CAMERA HELPER ----

function moveCameraToMarkerWithOffset(marker, pxUp, zoom) {
  const proj = map.getProjection();
  if (!proj) { map.setCenter(marker.getPosition()); return; }
  const z = zoom || map.getZoom();
  const scale = Math.pow(2, z);
  const pt = proj.fromLatLngToPoint(marker.getPosition());
  const offset = new google.maps.Point(pt.x, pt.y - pxUp / scale);
  map.moveCamera({ center: proj.fromPointToLatLng(offset), zoom: z });
}

// ---- FOCUS STOP ON MAP ----

function focusStop(index) {
  if (!map || !markers[index]) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    moveCameraToMarkerWithOffset(markers[index], 100, 15);
    google.maps.event.trigger(markers[index], 'click');
  }, 400);
}

function focusMaybe(index) {
  if (!map || !markers[index]) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    moveCameraToMarkerWithOffset(markers[index], 100, 16);
    google.maps.event.trigger(markers[index], 'click');
  }, 400);
}

// ---- TOUCH SWIPE (ignore map area) ----

let touchStartX = 0;
let touchStartedOnMap = false;
document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartedOnMap = !!e.target.closest('.map-hero');
}, { passive: true });
document.addEventListener('touchend', e => {
  if (touchStartedOnMap) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) < 80) return;
  const allIds = [...TRIP_DATA.days.map(d => d.id), 'maybes'];
  const idx = allIds.indexOf(activeTab);
  if (dx < 0 && idx < allIds.length - 1) switchTab(allIds[idx + 1]);
  if (dx > 0 && idx > 0) switchTab(allIds[idx - 1]);
}, { passive: true });

// ---- PRESS FEEDBACK (touch + mouse) ----

const PRESSABLE = '.stop-widget, .maybe-card, .nav-tab, .route-btn';
function pressStart(e) {
  const target = e.touches ? e.touches[0].target : e.target;
  const el = target.closest(PRESSABLE);
  if (el) el.classList.add('pressed');
}
function pressEnd() {
  setTimeout(() => {
    document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
  }, 150);
}
document.addEventListener('touchstart', pressStart, { passive: true });
document.addEventListener('touchend', pressEnd, { passive: true });
document.addEventListener('touchcancel', pressEnd, { passive: true });
document.addEventListener('mousedown', pressStart);
document.addEventListener('mouseup', pressEnd);
document.addEventListener('mouseleave', pressEnd);

document.addEventListener('DOMContentLoaded', init);

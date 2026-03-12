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
let focusFromCard = false;

// Working data — mutable copy of TRIP_DATA with user modifications applied
let workingData = null;

// User state — persisted to localStorage
let userState = { done: {}, timeOverrides: {}, durationOverrides: {}, notesOverrides: {}, moves: [], added: [], deleted: [] };

// Default durations by type (minutes)
const DEFAULT_DURATIONS = { coffee: 30, food: 45, hotel: 15, culture: 120, drink: 30 };

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

// ---- STATE MANAGEMENT ----

function loadUserState() {
  try {
    const raw = localStorage.getItem('oslo-trip-state');
    if (raw) {
      const parsed = JSON.parse(raw);
      userState = {
        done: parsed.done || {},
        timeOverrides: parsed.timeOverrides || {},
        durationOverrides: parsed.durationOverrides || {},
        notesOverrides: parsed.notesOverrides || {},
        moves: parsed.moves || [],
        added: parsed.added || [],
        deleted: parsed.deleted || []
      };
    }
  } catch (_) {}
}

function saveUserState() {
  try {
    localStorage.setItem('oslo-trip-state', JSON.stringify(userState));
  } catch (_) {}
}

function buildWorkingData() {
  // Deep clone TRIP_DATA
  workingData = JSON.parse(JSON.stringify(TRIP_DATA));

  // Remove deleted stops
  for (const name of userState.deleted) {
    for (const day of workingData.days) {
      day.stops = day.stops.filter(s => s.name !== name);
    }
    workingData.maybes = workingData.maybes.filter(s => s.name !== name);
  }
  // Also filter deleted from added
  userState.added = userState.added.filter(a => !userState.deleted.includes(a.name));

  // Apply moves — remove from source, add to target
  for (const move of userState.moves) {
    let movedStop = null;

    // Find and remove from source
    for (const day of workingData.days) {
      const idx = day.stops.findIndex(s => s.name === move.stopName);
      if (idx !== -1) {
        movedStop = day.stops.splice(idx, 1)[0];
        break;
      }
    }
    // Also check maybes
    if (!movedStop) {
      const idx = workingData.maybes.findIndex(s => s.name === move.stopName);
      if (idx !== -1) {
        movedStop = workingData.maybes.splice(idx, 1)[0];
      }
    }

    if (!movedStop) continue;

    // Set new time
    movedStop.time = move.newTime;

    // Add to target
    if (move.toDay === 'maybes') {
      workingData.maybes.push(movedStop);
    } else {
      const targetDay = workingData.days.find(d => d.id === move.toDay);
      if (targetDay) {
        targetDay.stops.push(movedStop);
        targetDay.stops.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
      }
    }
  }

  // Inject user-added places
  for (const added of userState.added) {
    const stop = {
      time: added.time || '12:00 PM',
      name: added.name,
      type: added.type || 'food',
      notes: added.notes || '',
      hours: added.hours || '',
      mustVisit: false,
      rating: added.rating || null,
      lat: added.lat || 0,
      lng: added.lng || 0,
      mapsUrl: added.mapsUrl || '',
      _userAdded: true
    };
    if (added.day === 'maybes') {
      workingData.maybes.push(stop);
    } else {
      const targetDay = workingData.days.find(d => d.id === added.day);
      if (targetDay) {
        targetDay.stops.push(stop);
        targetDay.stops.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
      }
    }
  }

  // Apply time overrides
  for (const [name, time] of Object.entries(userState.timeOverrides)) {
    for (const day of workingData.days) {
      const stop = day.stops.find(s => s.name === name);
      if (stop) {
        stop.time = time;
        // Re-sort this day
        day.stops.sort((a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time));
        break;
      }
    }
  }

  // Apply notes overrides
  for (const [name, notes] of Object.entries(userState.notesOverrides)) {
    for (const day of workingData.days) {
      const stop = day.stops.find(s => s.name === name);
      if (stop) { stop.notes = notes; break; }
    }
    const maybe = workingData.maybes.find(s => s.name === name);
    if (maybe) maybe.notes = notes;
  }
}

function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1]);
  const m = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function minutesToTimeStr(mins) {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function time24ToDisplay(time24) {
  // Convert "14:30" to "2:30 PM"
  const [h, m] = time24.split(':').map(Number);
  return minutesToTimeStr(h * 60 + m);
}

function displayToTime24(displayTime) {
  // Convert "2:30 PM" to "14:30"
  const mins = parseTimeToMinutes(displayTime);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDuration(stop) {
  if (userState.durationOverrides[stop.name] != null) {
    return userState.durationOverrides[stop.name];
  }
  return DEFAULT_DURATIONS[stop.type] || 30;
}

// ---- DONE TOGGLE ----

function toggleDone(stopName, e) {
  e.stopPropagation();
  userState.done[stopName] = !userState.done[stopName];
  if (!userState.done[stopName]) delete userState.done[stopName];
  saveUserState();

  // Update just the card visually
  const card = e.target.closest('.stop-widget, .maybe-card');
  if (card) {
    card.classList.toggle('done', !!userState.done[stopName]);
    const btn = card.querySelector('.done-btn');
    if (btn) btn.classList.toggle('checked', !!userState.done[stopName]);
  }
}

// ---- COMBINED EDIT SHEET (time + duration + move) ----

function showEditSheet(stopName, dayId, e) {
  e.stopPropagation();

  const isMaybe = dayId === 'maybes';
  let stop = null;

  if (isMaybe) {
    stop = workingData.maybes.find(s => s.name === stopName);
  } else {
    const day = workingData.days.find(d => d.id === dayId);
    if (day) stop = day.stops.find(s => s.name === stopName);
  }
  if (!stop) return;

  const currentTime24 = isMaybe ? '12:00' : displayToTime24(stop.time);
  const currentDuration = getDuration(stop);
  const currentNotes = stop.notes || '';
  let selectedMoveDay = null;

  const allDays = [
    ...workingData.days.map(d => ({ id: d.id, label: d.label, date: d.date })),
    { id: 'maybes', label: 'Backup Spots', date: '' }
  ];

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-sheet">
      <h3>${stop.name}</h3>
      ${!isMaybe ? `
        <label>Start Time</label>
        <input type="time" id="edit-time" value="${currentTime24}">
        <label>Duration (minutes)</label>
        <input type="number" id="edit-duration" value="${currentDuration}" min="5" max="480" step="5">
      ` : ''}
      <label>Notes</label>
      <textarea id="edit-notes">${currentNotes}</textarea>
      <div class="edit-section-label">Move to another day</div>
      <div class="move-day-options">
        ${allDays.map(d => `
          <button class="move-day-btn${d.id === dayId ? ' current' : ''}" data-day="${d.id}">
            <span class="move-day-label">${d.label}</span>
            ${d.date ? `<span class="move-day-date">${d.date}</span>` : ''}
          </button>
        `).join('')}
      </div>
      <div class="move-time-input" id="move-time-section">
        <label>New Start Time</label>
        <input type="time" id="move-time" value="12:00">
      </div>
      <div class="edit-sheet-actions">
        <button class="btn-cancel" id="edit-cancel">Cancel</button>
        <button class="btn-save" id="edit-save">Save</button>
      </div>
      <button class="btn-delete" id="edit-delete">Delete this place</button>
    </div>
  `;

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);

  // Delete handler
  document.getElementById('edit-delete').addEventListener('click', () => {
    // Remove from added (user-added) or mark as deleted (original)
    const addedIdx = userState.added.findIndex(a => a.name === stopName);
    if (addedIdx !== -1) {
      userState.added.splice(addedIdx, 1);
    } else {
      if (!userState.deleted.includes(stopName)) {
        userState.deleted.push(stopName);
      }
    }
    // Clean up related state
    delete userState.timeOverrides[stopName];
    delete userState.durationOverrides[stopName];
    delete userState.notesOverrides[stopName];
    delete userState.done[stopName];
    userState.moves = userState.moves.filter(m => m.stopName !== stopName);

    saveUserState();
    overlay.remove();
    reRender();
  });

  // Day selection for move
  overlay.querySelectorAll('.move-day-btn:not(.current)').forEach(btn => {
    btn.addEventListener('click', () => {
      // Deselect all
      overlay.querySelectorAll('.move-day-btn').forEach(b => b.style.borderColor = 'rgba(255,255,255,0.06)');
      // If clicking same button again, deselect
      if (selectedMoveDay === btn.dataset.day) {
        selectedMoveDay = null;
        document.getElementById('move-time-section').classList.remove('visible');
        return;
      }
      btn.style.borderColor = 'var(--accent)';
      selectedMoveDay = btn.dataset.day;
      const timeSection = document.getElementById('move-time-section');
      if (selectedMoveDay === 'maybes') {
        timeSection.classList.remove('visible');
      } else {
        timeSection.classList.add('visible');
      }
    });
  });

  document.getElementById('edit-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('edit-save').addEventListener('click', () => {
    // Save notes changes
    const newNotes = document.getElementById('edit-notes').value.trim();
    if (newNotes !== (stop.notes || '')) {
      userState.notesOverrides[stopName] = newNotes;
    }

    // Save time/duration changes (for day stops only)
    if (!isMaybe) {
      const newTime24 = document.getElementById('edit-time').value;
      const newDuration = parseInt(document.getElementById('edit-duration').value);

      if (newTime24) {
        const newTimeDisplay = time24ToDisplay(newTime24);
        if (newTimeDisplay !== stop.time) {
          userState.timeOverrides[stopName] = newTimeDisplay;
        }
      }
      if (newDuration && newDuration !== DEFAULT_DURATIONS[stop.type]) {
        userState.durationOverrides[stopName] = newDuration;
      } else if (newDuration === DEFAULT_DURATIONS[stop.type]) {
        delete userState.durationOverrides[stopName];
      }
    }

    // Process move if a day was selected
    const movedToDay = selectedMoveDay;
    if (movedToDay) {
      const newTime = movedToDay === 'maybes'
        ? '12:00 PM'
        : time24ToDisplay(document.getElementById('move-time').value || '12:00');

      userState.moves = userState.moves.filter(m => m.stopName !== stopName);
      delete userState.timeOverrides[stopName];
      userState.moves.push({ stopName, fromDay: dayId, toDay: movedToDay, newTime });
    }

    saveUserState();
    overlay.remove();
    reRender();

    // Offer auto-plan for the target day after a move
    if (movedToDay && movedToDay !== 'maybes') {
      setTimeout(() => showAutoPlanToast(movedToDay), 300);
    }
  });
}

// ---- API KEY + AUTO-PLAN ----

function getApiKey() {
  return localStorage.getItem('oslo-api-key') || '';
}

function showApiKeyPrompt() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'edit-overlay';
    overlay.innerHTML = `
      <div class="edit-sheet api-key-sheet">
        <h3>Claude API Key</h3>
        <label>Paste your Anthropic API key</label>
        <input type="password" id="api-key-input" value="${getApiKey()}" placeholder="sk-ant-...">
        <div class="hint">Stored locally only. Used to auto-plan your day.</div>
        <div class="edit-sheet-actions">
          <button class="btn-cancel" id="apikey-cancel">Cancel</button>
          <button class="btn-save" id="apikey-save">Save</button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) { overlay.remove(); resolve(null); }
    });
    document.body.appendChild(overlay);
    document.getElementById('apikey-cancel').addEventListener('click', () => { overlay.remove(); resolve(null); });
    document.getElementById('apikey-save').addEventListener('click', () => {
      const key = document.getElementById('api-key-input').value.trim();
      if (key) localStorage.setItem('oslo-api-key', key);
      overlay.remove();
      resolve(key || null);
    });
  });
}

async function autoPlanDay(dayId) {
  let apiKey = getApiKey();
  if (!apiKey) {
    apiKey = await showApiKeyPrompt();
    if (!apiKey) return;
  }

  const day = workingData.days.find(d => d.id === dayId);
  if (!day || day.stops.length < 2) return;

  // Show loading state on button
  const btn = document.querySelector(`.auto-plan-btn[data-day="${dayId}"]`);
  if (btn) btn.classList.add('loading');

  const stopsData = day.stops.map(s => ({
    name: s.name,
    type: s.type,
    hours: s.hours,
    mustVisit: s.mustVisit,
    notes: s.notes,
    lat: s.lat,
    lng: s.lng,
    duration: getDuration(s)
  }));

  const prompt = `You are a trip planner for a solo food trip in Oslo. Reshuffle this day's schedule to be optimal.

Current stops for ${day.date} (${day.title}):
${JSON.stringify(stopsData, null, 2)}

Hotel location (start/end point): lat ${TRIP_DATA.hotel.lat}, lng ${TRIP_DATA.hotel.lng}

Rules:
- Respect each place's opening hours strictly — a stop must start within its open hours
- Keep meals spaced out (at least 2 hours between food stops)
- Coffee stops should be in morning or mid-afternoon, not late evening
- Minimise walking backtracking — group nearby stops
- Must-visit items cannot be removed
- Drinks/bars should be in the evening
- Return ONLY a JSON array of objects with "name" and "time" fields
- Times must be in "H:MM AM/PM" format (e.g. "2:15 PM", "10:00 AM")
- Order the array chronologically
- Include ALL stops, don't remove any

Return ONLY valid JSON, no markdown fencing, no explanation.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 401) {
        localStorage.removeItem('oslo-api-key');
        showAutoPlanError(dayId, 'Invalid API key. Tap Auto-plan to try again.');
      } else {
        showAutoPlanError(dayId, `API error: ${response.status}`);
      }
      return;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON from response (handle potential markdown fencing)
    let parsed;
    try {
      const jsonStr = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      showAutoPlanError(dayId, 'Could not parse AI response. Try again.');
      return;
    }

    if (!Array.isArray(parsed)) {
      showAutoPlanError(dayId, 'Unexpected AI response format.');
      return;
    }

    // Apply time overrides
    for (const item of parsed) {
      if (item.name && item.time) {
        userState.timeOverrides[item.name] = item.time;
      }
    }

    saveUserState();
    reRender();
  } catch (err) {
    showAutoPlanError(dayId, 'Network error. Check your connection.');
  } finally {
    if (btn) btn.classList.remove('loading');
  }
}

function showAutoPlanError(dayId, msg) {
  const btn = document.querySelector(`.auto-plan-btn[data-day="${dayId}"]`);
  if (!btn) return;
  btn.classList.remove('loading');
  let errEl = btn.parentElement.querySelector('.auto-plan-error');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.className = 'auto-plan-error';
    btn.insertAdjacentElement('afterend', errEl);
  }
  errEl.textContent = msg;
  setTimeout(() => errEl.remove(), 5000);
}

function showAutoPlanToast(dayId) {
  // Remove any existing toast
  document.querySelectorAll('.auto-plan-toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'auto-plan-toast';
  toast.innerHTML = `
    <span>Day updated — Auto-plan?</span>
    <button class="toast-btn yes">Yes</button>
    <button class="toast-btn no">No</button>
  `;
  document.body.appendChild(toast);

  toast.querySelector('.yes').addEventListener('click', () => {
    toast.remove();
    autoPlanDay(dayId);
  });
  toast.querySelector('.no').addEventListener('click', () => toast.remove());

  // Auto-dismiss after 8 seconds
  setTimeout(() => toast.remove(), 8000);
}

// ---- ADD PLACE ----

async function showAddSheet(dayId, e) {
  if (e) e.stopPropagation();

  const isMaybe = dayId === 'maybes';

  const overlay = document.createElement('div');
  overlay.className = 'edit-overlay';
  overlay.innerHTML = `
    <div class="edit-sheet">
      <h3>Add a place</h3>
      <label>Search</label>
      <div class="place-search-wrap">
        <input type="text" id="add-name" placeholder="e.g. Tim Wendelboe" autocomplete="off">
        <div class="place-results" id="place-results"></div>
      </div>
      <label>Type</label>
      <select id="add-type">
        <option value="food">Food</option>
        <option value="coffee">Coffee</option>
        <option value="culture">Culture</option>
        <option value="drink">Drink</option>
      </select>
      ${!isMaybe ? `
        <label>Start Time</label>
        <input type="time" id="add-time" value="12:00">
        <label>Duration (minutes)</label>
        <input type="number" id="add-duration" value="45" min="5" max="480" step="5">
      ` : ''}
      <label>Notes (optional)</label>
      <textarea id="add-notes" placeholder="Any notes..."></textarea>
      <div class="edit-sheet-actions">
        <button class="btn-cancel" id="add-cancel">Cancel</button>
        <button class="btn-save" id="add-save">Add</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });

  document.body.appendChild(overlay);

  // Place search as-you-type
  let selectedPlace = null;
  let searchTimeout = null;
  const nameInput = document.getElementById('add-name');
  const resultsDiv = document.getElementById('place-results');

  nameInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    selectedPlace = null;
    const query = nameInput.value.trim();
    if (query.length < 2 || !googleReady) {
      resultsDiv.innerHTML = '';
      return;
    }
    searchTimeout = setTimeout(async () => {
      try {
        const { Place } = await google.maps.importLibrary('places');
        const { places } = await Place.searchByText({
          textQuery: query + ' Oslo',
          fields: ['displayName', 'location', 'rating', 'regularOpeningHours', 'googleMapsURI', 'photos', 'formattedAddress'],
          maxResultCount: 5
        });
        resultsDiv.innerHTML = (places || []).map((p, i) => {
          const addr = p.formattedAddress || '';
          const shortAddr = addr.split(',').slice(0, 2).join(',');
          return `<button class="place-result" data-idx="${i}">
            <span class="place-result-name">${p.displayName}</span>
            <span class="place-result-addr">${shortAddr}${p.rating ? ` · ★ ${p.rating}` : ''}</span>
          </button>`;
        }).join('');
        // Store places for selection
        resultsDiv._places = places || [];
      } catch (_) {
        resultsDiv.innerHTML = '';
      }
    }, 300);
  });

  resultsDiv.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.place-result');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const p = resultsDiv._places?.[idx];
    if (!p) return;
    selectedPlace = p;
    nameInput.value = p.displayName;
    resultsDiv.innerHTML = '';
  });

  document.getElementById('add-cancel').addEventListener('click', () => overlay.remove());
  document.getElementById('add-save').addEventListener('click', async () => {
    const name = document.getElementById('add-name').value.trim();
    if (!name) return;

    const type = document.getElementById('add-type').value;
    const notes = document.getElementById('add-notes').value.trim();
    const time = isMaybe ? '12:00 PM' : time24ToDisplay(document.getElementById('add-time').value || '12:00');
    const duration = isMaybe ? DEFAULT_DURATIONS[type] : parseInt(document.getElementById('add-duration').value) || DEFAULT_DURATIONS[type];

    // Use selected place data or fall back to search
    let lat = 0, lng = 0, mapsUrl = '', rating = null, hours = '';
    if (selectedPlace) {
      const p = selectedPlace;
      const loc = p.location;
      lat = loc.lat();
      lng = loc.lng();
      mapsUrl = p.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      rating = p.rating || null;
      if (p.regularOpeningHours?.weekdayDescriptions?.length) {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayLine = p.regularOpeningHours.weekdayDescriptions.find(d => d.startsWith(today));
        hours = todayLine ? todayLine.replace(today + ': ', '') : p.regularOpeningHours.weekdayDescriptions[0];
      }
      if (p.photos?.length > 0) {
        photoCache[name] = p.photos[0].getURI({ maxWidth: 480, maxHeight: 260 });
      }
    } else if (googleReady) {
      try {
        const { Place } = await google.maps.importLibrary('places');
        const { places } = await Place.searchByText({
          textQuery: name + ' Oslo',
          fields: ['location', 'photos', 'rating', 'regularOpeningHours', 'googleMapsURI'],
          maxResultCount: 1
        });
        if (places?.[0]) {
          const p = places[0];
          const loc = p.location;
          lat = loc.lat();
          lng = loc.lng();
          mapsUrl = p.googleMapsURI || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
          rating = p.rating || null;
          if (p.regularOpeningHours?.weekdayDescriptions?.length) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const todayLine = p.regularOpeningHours.weekdayDescriptions.find(d => d.startsWith(today));
            hours = todayLine ? todayLine.replace(today + ': ', '') : p.regularOpeningHours.weekdayDescriptions[0];
          }
          if (p.photos?.length > 0) {
            photoCache[name] = p.photos[0].getURI({ maxWidth: 480, maxHeight: 260 });
          }
        }
      } catch (_) {}
    }

    const newPlace = { name, type, day: dayId, time, duration, notes, lat, lng, mapsUrl, rating, hours };
    userState.added.push(newPlace);
    if (duration !== DEFAULT_DURATIONS[type]) {
      userState.durationOverrides[name] = duration;
    }

    saveUserState();
    overlay.remove();
    reRender();

    // Offer auto-plan for the target day after adding
    if (!isMaybe) {
      setTimeout(() => showAutoPlanToast(dayId), 300);
    }
  });
}

// ---- RE-RENDER ----

function reRender() {
  buildWorkingData();
  const content = document.getElementById('content');
  content.innerHTML = '';
  renderDays();
  renderMaybes();
  switchTab(activeTab);
}

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
  loadUserState();
  buildWorkingData();
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
    clickableIcons: false,
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
    stops = workingData.maybes;
  } else {
    const day = workingData.days.find(d => d.id === id);
    if (!day) return;
    stops = day.stops;
  }

  if (stops.length === 0) return;

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
      if (!focusFromCard) {
        map.panTo(getOffsetCenter(marker, map.getZoom()));
      }
      focusFromCard = false;
      setTimeout(() => {
        const chr = document.querySelector('.gm-style-iw-chr');
        if (chr) chr.style.display = 'none';
      }, 50);

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
  workingData.days.forEach((day, dayIdx) => {
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
      <button class="auto-plan-btn" data-day="${day.id}" onclick="autoPlanDay('${day.id}')">
        <span class="sparkle">&#10024;</span>
        <span class="spinner"></span>
        Auto-plan this day
      </button>
      ${groups.map(g => `
        <div class="time-group">
          <span class="time-label">${g.label}</span>
          ${g.stops.map(s => renderStop(s, day.id)).join('')}
        </div>
      `).join('')}
      <button class="add-place-btn" onclick="showAddSheet('${day.id}', event)">+ Add a place</button>
    `;
    content.appendChild(el);
  });
}

function renderStop(stop, dayId) {
  const num = stop._index + 1;
  const color = TYPE_COLORS[stop.type] || '#888';
  const isDone = !!userState.done[stop.name];
  const duration = getDuration(stop);

  return `
    <div class="stop-widget ${stop.type}${isDone ? ' done' : ''}" data-stop-index="${stop._index}" onclick="focusStop(${stop._index})">
      <div class="stop-head">
        <button class="done-btn${isDone ? ' checked' : ''}" onclick="toggleDone('${stop.name.replace(/'/g, "\\'")}', event)" aria-label="Mark done">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </button>
        <div class="stop-name-area">
          <div class="stop-name">
            <span class="stop-num" style="background:${color}">${num}</span>
            <span class="stop-name-text">${stop.name}</span>
            ${stop.mustVisit ? '<span class="must-badge">MUST VISIT</span>' : ''}
          </div>
        </div>
        <div class="stop-time-area">
          <span class="stop-time-badge">${stop.time}</span>
          <span class="stop-duration">~${duration} min</span>
        </div>
      </div>
      <div class="stop-note">${stop.notes}</div>
      <div class="stop-foot">
        <span class="stop-type-label ${stop.type}">${stop.type}</span>
        <span class="stop-hours">${stop.hours}</span>
        ${stop.rating ? `<span class="stop-rating">\u2605 ${stop.rating}</span>` : ''}
        ${stop.mapsUrl ? `<a class="stop-maps" href="${stop.mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Maps \u2197</a>` : ''}
        <button class="edit-btn" onclick="showEditSheet('${stop.name.replace(/'/g, "\\'")}', '${dayId}', event)">Edit</button>
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
    <div class="day-meta">Swap in if plans change \u00B7 ${workingData.maybes.length} options</div>
    ${workingData.maybes.map((m, i) => {
      const isDone = !!userState.done[m.name];
      return `
      <div class="maybe-card${isDone ? ' done' : ''}" data-maybe-index="${i}" onclick="focusMaybe(${i})">
        <div class="maybe-head">
          <button class="done-btn${isDone ? ' checked' : ''}" onclick="toggleDone('${m.name.replace(/'/g, "\\'")}', event)" aria-label="Mark done">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <div class="stop-name-area">
            <div class="maybe-name">
              <span class="stop-type-dot" style="background:var(--${m.type})"></span>
              <span class="stop-name-text">${m.name}</span>
            </div>
          </div>
          <span class="maybe-rating">\u2605 ${m.rating}</span>
        </div>
        <div class="maybe-note">${m.notes}</div>
        <div class="stop-foot">
          <span class="stop-type-label ${m.type}">${m.type}</span>
          <span class="stop-hours">${m.hours}</span>
          ${m.mapsUrl ? `<a class="stop-maps" href="${m.mapsUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Maps \u2197</a>` : ''}
          <button class="edit-btn" onclick="showEditSheet('${m.name.replace(/'/g, "\\'")}', 'maybes', event)">Edit</button>
        </div>
      </div>
    `}).join('')}
    <button class="add-place-btn" onclick="showAddSheet('maybes', event)">+ Add a place</button>
  `;
  content.appendChild(el);
}

// ---- FOCUS STOP ON MAP ----

function getOffsetCenter(marker, zoom) {
  const pos = marker.getPosition();
  const mapDiv = document.getElementById('map');
  const mapH = mapDiv ? mapDiv.offsetHeight : 400;
  const scale = Math.pow(2, zoom);
  const latOffset = (mapH * 0.2 * 180) / (256 * scale);
  return { lat: pos.lat() + latOffset, lng: pos.lng() };
}

function focusStop(index) {
  if (!map || !markers[index]) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    const target = getOffsetCenter(markers[index], 15);
    map.moveCamera({ center: target, zoom: 15 });
    setTimeout(() => {
      map.panTo(target);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        focusFromCard = true;
        google.maps.event.trigger(markers[index], 'click');
      });
    }, 50);
  }, 400);
}

function focusMaybe(index) {
  if (!map || !markers[index]) return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    const target = getOffsetCenter(markers[index], 16);
    map.moveCamera({ center: target, zoom: 16 });
    setTimeout(() => {
      map.panTo(target);
      google.maps.event.addListenerOnce(map, 'idle', () => {
        focusFromCard = true;
        google.maps.event.trigger(markers[index], 'click');
      });
    }, 50);
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
  // Don't trigger press on action buttons
  if (target.closest('.done-btn, .edit-btn, .stop-maps, .auto-plan-btn, .toast-btn')) return;
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

// Re-fetch weather + check for SW updates when app becomes visible
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchWeather();
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then(reg => { if (reg) reg.update(); });
    }
  }
});

document.addEventListener('DOMContentLoaded', init);

/* ─────────────────────────────────────────────────────────
   CLAUDE.GIS — GeoAI Copilot Frontend
   ───────────────────────────────────────────────────────── */

// ── State ────────────────────────────────────────────────
const state = {
  apiKey: localStorage.getItem('cgis_key') || '',
  connected: false,
  activeTool: 'pointer',
  drawHandler: null,
  pointClickHandler: null,
  geometries: [],
  chatHistory: []
};

// ── Map Init ─────────────────────────────────────────────
const map = L.map('map', {
  center: [39.1667, 35.6667],
  zoom: 6,
  zoomControl: false,
  attributionControl: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

L.control.attribution({ prefix: false, position: 'bottomleft' })
  .addAttribution('<span style="opacity:.3;font-size:.6rem">© CARTO © OSM</span>')
  .addTo(map);

// ── Layer Groups ──────────────────────────────────────────
const layers = {
  points:   L.layerGroup().addTo(map),
  polygons: L.layerGroup().addTo(map),
  lines:    L.layerGroup().addTo(map),
  measure:  L.layerGroup().addTo(map)
};

// ── Coordinate Display ────────────────────────────────────
map.on('mousemove', e => {
  document.getElementById('coord-display').textContent =
    `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});

map.on('mouseout', () => {
  document.getElementById('coord-display').textContent = '—';
});

// ── API Key ───────────────────────────────────────────────
if (state.apiKey) markConnected();

document.getElementById('api-key-save').addEventListener('click', () => {
  const input = document.getElementById('api-key-input');
  const val = input.value.trim();
  if (!val || val === '••••••••••••••') return;

  state.apiKey = val;
  localStorage.setItem('cgis_key', val);
  markConnected();
  input.value = '';
  appendMessage('assistant', 'API key saved. You can now ask GIS questions.');
});

function markConnected() {
  state.connected = true;
  const btn = document.getElementById('api-key-save');
  btn.textContent = '✓ Connected';
  btn.classList.add('connected');
  document.getElementById('api-key-input').placeholder = 'Connected — type to change';
}

// ── Tools ─────────────────────────────────────────────────
['pointer','point','polygon','line','measure'].forEach(t => {
  const el = document.getElementById(`tool-${t}`);
  if (el) el.addEventListener('click', () => activateTool(t));
});

document.getElementById('tool-clear').addEventListener('click', () => {
  if (!confirm('Clear all geometries?')) return;
  Object.values(layers).forEach(l => l.clearLayers());
  state.geometries = [];
  updateContextBar();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') activateTool('pointer');
});

function activateTool(tool) {
  // Disable existing draw
  if (state.drawHandler) {
    state.drawHandler.disable();
    state.drawHandler = null;
  }
  // Remove point click listener
  if (state.pointClickHandler) {
    map.off('click', state.pointClickHandler);
    state.pointClickHandler = null;
  }

  state.activeTool = tool;

  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`tool-${tool}`);
  if (btn) btn.classList.add('active');

  const container = map.getContainer();

  if (tool === 'point') {
    container.style.cursor = 'crosshair';
    state.pointClickHandler = e => {
      placePoint(e.latlng);
      activateTool('pointer');
    };
    map.on('click', state.pointClickHandler);

  } else if (tool === 'polygon') {
    container.style.cursor = 'crosshair';
    state.drawHandler = new L.Draw.Polygon(map, {
      shapeOptions: { color: '#9a4c30', fillColor: '#9a4c30', fillOpacity: 0.12, weight: 1.5 },
      showArea: false
    });
    state.drawHandler.enable();

  } else if (tool === 'line') {
    container.style.cursor = 'crosshair';
    state.drawHandler = new L.Draw.Polyline(map, {
      shapeOptions: { color: '#9a4c30', weight: 1.5, opacity: 0.9 }
    });
    state.drawHandler.enable();

  } else if (tool === 'measure') {
    container.style.cursor = 'crosshair';
    state.drawHandler = new L.Draw.Polyline(map, {
      shapeOptions: { color: '#F7F052', weight: 1.5, dashArray: '6 4', opacity: 0.85 }
    });
    state.drawHandler.enable();

  } else {
    container.style.cursor = '';
  }
}

// ── Draw Events ───────────────────────────────────────────
map.on(L.Draw.Event.CREATED, e => {
  const { layer, layerType } = e;

  if (layerType === 'marker') {
    placePoint(layer.getLatLng());

  } else if (layerType === 'polygon') {
    const lls = layer.getLatLngs()[0];
    const area = geodesicArea(lls);
    const geom = {
      type: 'polygon',
      area_m2: parseFloat(area.toFixed(2)),
      area_ha: parseFloat((area / 10000).toFixed(4)),
      vertices: lls.length,
      coordinates: lls.map(ll => [+ll.lat.toFixed(6), +ll.lng.toFixed(6)])
    };
    state.geometries.push(geom);

    layer.setStyle({ color: '#9a4c30', fillColor: '#9a4c30', fillOpacity: 0.12, weight: 1.5 });
    layer.bindPopup(
      `<b>Polygon</b><br>${formatArea(area)}<br>${lls.length} vertices`
    );
    layers.polygons.addLayer(layer);
    updateContextBar();

    if (state.apiKey) autoAnalyze(geom);

  } else if (layerType === 'polyline') {
    const lls = layer.getLatLngs();
    const dist = totalDistance(lls);

    if (state.activeTool === 'measure') {
      layer.bindPopup(`<b>Distance:</b> ${formatDist(dist)}`).openPopup();
      layers.measure.addLayer(layer);
    } else {
      const geom = {
        type: 'line',
        distance_m: parseFloat(dist.toFixed(2)),
        distance_km: parseFloat((dist / 1000).toFixed(4)),
        segments: lls.length - 1,
        coordinates: lls.map(ll => [+ll.lat.toFixed(6), +ll.lng.toFixed(6)])
      };
      state.geometries.push(geom);

      layer.setStyle({ color: '#9a4c30', weight: 1.5, opacity: 0.9 });
      layer.bindPopup(`<b>Line</b><br>${formatDist(dist)}<br>${lls.length - 1} segments`);
      layers.lines.addLayer(layer);
      updateContextBar();

      if (state.apiKey) autoAnalyze(geom);
    }
  }

  setTimeout(() => activateTool('pointer'), 50);
});

map.on('draw:drawstop', () => {
  state.drawHandler = null;
  if (state.activeTool !== 'pointer') {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tool-pointer').classList.add('active');
    state.activeTool = 'pointer';
    map.getContainer().style.cursor = '';
  }
});

// ── Place Point ───────────────────────────────────────────
function placePoint(latlng) {
  const geom = {
    type: 'point',
    lat: +latlng.lat.toFixed(6),
    lng: +latlng.lng.toFixed(6)
  };
  state.geometries.push(geom);

  const marker = L.circleMarker(latlng, {
    radius: 5,
    fillColor: '#9a4c30',
    color: '#1E2122',
    weight: 2,
    fillOpacity: 1
  });
  marker.bindPopup(`<b>Point</b><br>${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`);
  layers.points.addLayer(marker);
  updateContextBar();
}

// ── Layer Toggles ─────────────────────────────────────────
['points', 'polygons', 'lines'].forEach(name => {
  document.getElementById(`layer-${name}`).addEventListener('change', e => {
    e.target.checked ? map.addLayer(layers[name]) : map.removeLayer(layers[name]);
  });
});

// ── Geometry Utils ────────────────────────────────────────
function geodesicArea(latlngs) {
  const R = 6378137;
  let total = 0;
  const n = latlngs.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const lng1 = latlngs[i].lng * Math.PI / 180;
    const lng2 = latlngs[j].lng * Math.PI / 180;
    const lat1 = latlngs[i].lat * Math.PI / 180;
    const lat2 = latlngs[j].lat * Math.PI / 180;
    total += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs(total * R * R / 2);
}

function totalDistance(lls) {
  let d = 0;
  for (let i = 1; i < lls.length; i++) d += lls[i - 1].distanceTo(lls[i]);
  return d;
}

function formatArea(m2) {
  if (m2 >= 1e6) return `${(m2/1e6).toFixed(3)} km²`;
  if (m2 >= 10000) return `${(m2/10000).toFixed(3)} ha`;
  return `${m2.toFixed(1)} m²`;
}

function formatDist(m) {
  return m >= 1000 ? `${(m/1000).toFixed(3)} km` : `${m.toFixed(1)} m`;
}

// ── Context Bar ───────────────────────────────────────────
function updateContextBar() {
  const n = state.geometries.length;
  const el = document.getElementById('ctx-text');
  if (n === 0) {
    el.textContent = 'No geometry on map';
  } else {
    const pts = state.geometries.filter(g => g.type === 'point').length;
    const pols = state.geometries.filter(g => g.type === 'polygon').length;
    const lns = state.geometries.filter(g => g.type === 'line').length;
    const parts = [];
    if (pts)  parts.push(`${pts} point${pts > 1 ? 's' : ''}`);
    if (pols) parts.push(`${pols} polygon${pols > 1 ? 's' : ''}`);
    if (lns)  parts.push(`${lns} line${lns > 1 ? 's' : ''}`);
    el.textContent = parts.join(' · ') + ' — in AI context';
  }
}

// ── Auto Analyze ──────────────────────────────────────────
async function autoAnalyze(geom) {
  let prompt = '';
  if (geom.type === 'polygon') {
    prompt = `A new polygon was drawn on the map. Area: ${formatArea(geom.area_m2)} (${geom.area_ha} ha), ${geom.vertices} vertices. Briefly analyze it.`;
  } else if (geom.type === 'line') {
    prompt = `A new line was drawn on the map. Length: ${formatDist(geom.distance_m)}, ${geom.segments} segments. Briefly evaluate it.`;
  }
  if (prompt) await sendToAI(prompt, false);
}

// ── Chat ──────────────────────────────────────────────────
function getContext() {
  return {
    geometryCount: state.geometries.length,
    geometries: state.geometries.slice(-8)
  };
}

function appendMessage(role, content) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = role === 'user' ? 'You' : 'GeoAI';

  const body = document.createElement('div');
  body.className = 'msg-content';

  if (content) {
    try {
      body.innerHTML = marked.parse(content);
    } catch {
      body.textContent = content;
    }
  }

  wrap.appendChild(label);
  wrap.appendChild(body);
  document.getElementById('messages').appendChild(wrap);
  scrollChat();
  return body;
}

function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';
  wrap.id = '_typing';

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.textContent = 'GeoAI';

  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  dots.innerHTML = '<span></span><span></span><span></span>';

  wrap.appendChild(label);
  wrap.appendChild(dots);
  document.getElementById('messages').appendChild(wrap);
  scrollChat();
  return wrap;
}

function scrollChat() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

async function sendToAI(prompt, showUser = true) {
  if (!state.apiKey) {
    appendMessage('assistant', 'Please enter your Claude API key first.');
    return;
  }

  if (showUser) appendMessage('user', prompt);

  const typingEl = showTyping();
  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;

  // Add to history
  state.chatHistory.push({ role: 'user', content: prompt });

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: prompt,
        apiKey: state.apiKey,
        context: getContext(),
        history: state.chatHistory.slice(-10)
      })
    });

    typingEl.remove();

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' }));
      const msg = err.error || 'Unknown error';
      appendMessage('assistant', `**Error:** ${msg}`);
      state.chatHistory.pop();
      return;
    }

    const msgBody = appendMessage('assistant', '');
    let fullText = '';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') break;
        try {
          const parsed = JSON.parse(raw);
          if (parsed.text) {
            fullText += parsed.text;
            try {
              msgBody.innerHTML = marked.parse(fullText);
            } catch {
              msgBody.textContent = fullText;
            }
            scrollChat();
          }
          if (parsed.error) {
            msgBody.textContent = `Error: ${parsed.error}`;
          }
        } catch { /* ignore malformed chunks */ }
      }
    }

    if (fullText) {
      state.chatHistory.push({ role: 'assistant', content: fullText });
      // Keep history manageable
      if (state.chatHistory.length > 20) state.chatHistory = state.chatHistory.slice(-20);
    }

  } catch (err) {
    typingEl.remove();
    appendMessage('assistant', `**Connection error:** ${err.message}`);
    state.chatHistory.pop();
  } finally {
    sendBtn.disabled = false;
  }
}

// ── Input Handlers ────────────────────────────────────────
const chatInput = document.getElementById('chat-input');

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 110) + 'px';
});

chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

document.getElementById('send-btn').addEventListener('click', handleSend);

function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendToAI(text);
}

// ── Quick Actions ─────────────────────────────────────────
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => sendToAI(btn.dataset.prompt));
});

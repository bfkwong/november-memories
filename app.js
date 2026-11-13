// November Memories — camera + location, stored in IndexedDB (localStorage is ~5MB; photos would blow it fast).
const $ = (id) => document.getElementById(id);
const video = $('video');
let stream = null, facing = 'environment', lastPos = null, watchId = null;

/* ---------- storage (IndexedDB) ---------- */
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('november-memories', 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id', autoIncrement: true });
    if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function tx(stores, mode, fn) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const r = fn(...[].concat(stores).map((n) => t.objectStore(n)));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
}
// Photos are stored as raw bytes (more reliable than Blobs in Safari) and never rewritten after capture.
const savePhoto = (rec) => tx('photos', 'readwrite', (s) => s.add(rec));
const photoBlob = (p) => p.blob || new Blob([p.data], { type: p.type || 'image/jpeg' }); // old records hold a Blob
async function allPhotos() {
  const photos = await tx('photos', 'readonly', (s) => s.getAll());
  const notes = await tx('notes', 'readonly', (s) => s.getAll());
  const byId = new Map(notes.map((n) => [n.id, n.text]));
  return photos.map((p) => ({ ...p, note: byId.has(p.id) ? byId.get(p.id) : p.note || '' }));
}
const saveNote = (id, text) => tx('notes', 'readwrite', (s) => s.put({ id, text }));
const deletePhoto = (id) => tx(['photos', 'notes'], 'readwrite', (p, n) => { p.delete(id); n.delete(id); });
navigator.storage?.persist?.(); // ask the browser not to evict our data

/* ---------- location ---------- */
function startLocation() {
  if (!navigator.geolocation) return;
  if (watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(
    (p) => { lastPos = p; },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
}
function getPosition() {
  return new Promise((resolve) => {
    if (lastPos && Date.now() - lastPos.timestamp < 30000) return resolve(lastPos);
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(lastPos), { enableHighAccuracy: true, timeout: 8000 });
  });
}

/* ---------- camera ---------- */
function showMessage(text, showBtn = true) {
  $('message-text').textContent = text;
  $('start-btn').classList.toggle('hidden', !showBtn);
  $('message').classList.remove('hidden');
}
let starting = null;
function startCamera() { return (starting ||= openCamera().finally(() => { starting = null; })); }
async function openCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    $('message').classList.add('hidden');
    startLocation();
  } catch (e) {
    const denied = e.name === 'NotAllowedError';
    showMessage(denied ? 'Camera access was blocked. Allow it in your browser settings, then tap below.'
      : !window.isSecureContext ? 'Camera needs HTTPS (or localhost).'
      : 'Could not open the camera: ' + e.message);
  }
}
function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

async function capture() {
  if (!stream || !video.videoWidth) return;
  $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 60);
  navigator.vibrate?.(30);

  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(video.videoWidth * scale); c.height = Math.round(video.videoHeight * scale);
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.5));
  const data = await blob.arrayBuffer();

  const pos = await getPosition();
  await savePhoto({
    data, type: 'image/jpeg', takenAt: Date.now(),
    lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null,
    accuracy: pos?.coords.accuracy ?? null, note: '',
  });
  refreshThumb();
  openGallery(); // jump to the gallery after every shot
}

/* ---------- UI ---------- */
let thumbUrl = null;
async function refreshThumb() {
  const photos = await allPhotos();
  $('count').textContent = photos.length || '';
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  if (photos.length) { thumbUrl = URL.createObjectURL(photoBlob(photos[photos.length - 1])); $('last-thumb').src = thumbUrl; }
  else $('last-thumb').removeAttribute('src');
}

let galleryUrls = [];
async function openGallery() {
  stopCamera();
  ensureLeaflet().catch(() => {}); // warm up the map while browsing, off the camera's critical path
  $('camera-view').classList.add('hidden'); $('map-view').classList.add('hidden'); $('detail-view').classList.add('hidden'); $('gallery-view').classList.remove('hidden');
  galleryUrls.forEach(URL.revokeObjectURL); galleryUrls = [];
  const photos = (await allPhotos()).reverse();
  $('empty').classList.toggle('hidden', photos.length > 0);
  const grid = $('grid'); grid.innerHTML = '';
  for (const p of photos) {
    const url = URL.createObjectURL(photoBlob(p)); galleryUrls.push(url);
    const card = document.createElement('div'); card.className = 'card';
    const note = p.note?.trim();
    const noteEl = document.createElement('div');
    noteEl.className = 'note' + (note ? '' : ' empty'); noteEl.textContent = note || 'Add a note…';
    card.innerHTML = `<img src="${url}" alt=""><div class="meta">${new Date(p.takenAt).toLocaleString()}</div>`;
    card.querySelector('.meta').append(noteEl);
    card.onclick = () => openDetail(p, url);
    const del = document.createElement('button');
    del.className = 'card-del'; del.textContent = '🗑️'; del.setAttribute('aria-label', 'Delete photo');
    del.onclick = async (e) => {
      e.stopPropagation(); // don't open the photo
      await deletePhoto(p.id); card.remove(); refreshThumb();
      $('empty').classList.toggle('hidden', grid.children.length > 0);
    };
    card.append(del);
    grid.append(card);
  }
}
let current = null, saveTimer = null;
function setExpanded(on) { // full-screen photo-only modal; the page behind stays put
  $('lightbox').classList.toggle('hidden', !on);
  if (on) $('lightbox-img').src = $('detail-img').src;
}
$('expand-btn').onclick = () => setExpanded(true);
$('lightbox').onclick = () => setExpanded(false);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setExpanded(false); });
let detailFrom = 'gallery';
function openDetail(p, url, from = 'gallery') {
  current = p; detailFrom = from;
  $('map-view').classList.add('hidden');
  $('detail-img').src = url; setExpanded(false);
  const loc = p.lat == null ? 'No location'
    : `<a target="_blank" rel="noopener" href="https://maps.google.com/?q=${p.lat},${p.lng}">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</a>`;
  $('detail-meta').innerHTML = `${new Date(p.takenAt).toLocaleString()}<br>${loc}`;
  $('note').value = p.note || ''; $('saved').innerHTML = '&nbsp;';
  $('gallery-view').classList.add('hidden'); $('detail-view').classList.remove('hidden');
}
async function flushNote() {
  clearTimeout(saveTimer);
  if (!current) return;
  current.note = $('note').value;
  await saveNote(current.id, current.note);
  $('saved').textContent = 'Saved ✓';
}
$('note').addEventListener('input', () => { $('saved').innerHTML = '&nbsp;'; clearTimeout(saveTimer); saveTimer = setTimeout(flushNote, 500); });
$('detail-back').onclick = async () => { await flushNote(); current = null; detailFrom === 'map' ? openMap() : openGallery(); };

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
let leafletReady = null;
function ensureLeaflet() { // loaded on demand so the camera never waits on map code
  return (leafletReady ||= (async () => {
    for (const href of ['leaflet/1.9.4/leaflet.min.css', 'leaflet.markercluster/1.5.3/MarkerCluster.css']) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + href; document.head.append(l);
    }
    for (const src of ['leaflet/1.9.4/leaflet.min.js', 'leaflet.markercluster/1.5.3/leaflet.markercluster.js']) {
      await new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = CDN + src; s.onload = res; s.onerror = rej; document.head.append(s);
      });
    }
  })().catch((e) => { leafletReady = null; throw e; }));
}

let map = null, cluster = null, mapUrls = [];
async function openMap() {
  stopCamera();
  $('camera-view').classList.add('hidden'); $('gallery-view').classList.add('hidden'); $('detail-view').classList.add('hidden');
  $('map-view').classList.remove('hidden');
  try { await ensureLeaflet(); } catch { $('map-info').textContent = 'Map needs an internet connection'; return; }
  const photos = await allPhotos();
  const located = photos.filter((p) => p.lat != null);
  $('map-info').textContent = `${located.length} of ${photos.length} located`;
  if (!map) {
    map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
  }
  map.invalidateSize();
  cluster?.remove();
  cluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    showCoverageOnHover: false,
    iconCreateFunction: (c) => {
      const first = c.getAllChildMarkers()[0].options.photoUrl;
      return L.divIcon({ className: 'pin', iconSize: [52, 52],
        html: `<div class="cluster"><img src="${first}" alt=""><b>${c.getChildCount()}</b></div>` });
    },
  });
  mapUrls.forEach(URL.revokeObjectURL); mapUrls = [];
  for (const p of located) {
    const url = URL.createObjectURL(photoBlob(p)); mapUrls.push(url);
    const icon = L.divIcon({ className: 'pin', iconSize: [48, 48], html: `<img src="${url}" alt="">` });
    cluster.addLayer(L.marker([p.lat, p.lng], { icon, photoUrl: url }).on('click', () => openDetail(p, url, 'map')));
  }
  map.addLayer(cluster);
  if (located.length) map.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 17 });
}
$('map-btn').onclick = openMap;
$('map-back').onclick = openGallery;

function closeGallery() {
  $('gallery-view').classList.add('hidden'); $('camera-view').classList.remove('hidden'); startCamera();
}

$('shutter').onclick = capture;
$('gallery-btn').onclick = openGallery;
$('back-btn').onclick = closeGallery;
$('start-btn').onclick = startCamera;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // only restart if the stream actually died, so tab events never cause a re-open flicker
    const live = stream?.getTracks().some((t) => t.readyState === 'live');
    if (!live && !$('camera-view').classList.contains('hidden')) startCamera();
  } else stopCamera();
});

refreshThumb();
startCamera(); // auto-open on load

// Map view: located photos as clustered thumbnail pins (Leaflet, loaded on demand).
import { $ } from 'util';
import { allPhotos, photoBlob } from 'db';
import { ensureLeaflet } from 'leaflet-loader';
import * as nav from 'nav';

let map = null, cluster = null, urls = [];

async function enter() {
  try { await ensureLeaflet(); } catch { $('map-info').textContent = 'Map needs an internet connection'; return; }
  const photos = await allPhotos();
  const located = photos.filter((p) => p.lat != null);
  $('map-info').textContent = `${located.length} of ${photos.length} located`;
  if (!map) {
    map = L.map('map', { zoomControl: false }).setView([20, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
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
  urls.forEach(URL.revokeObjectURL); urls = [];
  for (const p of located) {
    const url = URL.createObjectURL(photoBlob(p)); urls.push(url);
    const icon = L.divIcon({ className: 'pin', iconSize: [48, 48], html: `<img src="${url}" alt="">` });
    cluster.addLayer(L.marker([p.lat, p.lng], { icon, photoUrl: url })
      .on('click', () => nav.go('detail', { photo: p, url, from: 'map' })));
  }
  map.addLayer(cluster);
  if (located.length) map.fitBounds(L.latLngBounds(located.map((p) => [p.lat, p.lng])), { padding: [50, 50], maxZoom: 17 });
}

export function init() {
  nav.register('map', { enter });
  $('map-back').onclick = () => nav.go('gallery');
}

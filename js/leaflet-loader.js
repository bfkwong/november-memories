// Leaflet is loaded on demand so the camera never waits on map code.
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
let ready = null;

export function ensureLeaflet() {
  return (ready ||= (async () => {
    for (const href of ['leaflet/1.9.4/leaflet.min.css', 'leaflet.markercluster/1.5.3/MarkerCluster.css']) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + href; document.head.append(l);
    }
    for (const src of ['leaflet/1.9.4/leaflet.min.js', 'leaflet.markercluster/1.5.3/leaflet.markercluster.js']) {
      await new Promise((res, rej) => {
        const s = document.createElement('script'); s.src = CDN + src; s.onload = res; s.onerror = rej; document.head.append(s);
      });
    }
  })().catch((e) => { ready = null; throw e; }));
}

// Gallery view: grid of photo cards, newest first.
import { $ } from 'util';
import { allPhotos, photoBlob } from 'db';
import { ensureLeaflet } from 'leaflet-loader';
import * as nav from 'nav';

let urls = [];

function buildCard(p, url) {
  const note = p.note?.trim();
  const noteEl = document.createElement('div');
  noteEl.className = 'note' + (note ? '' : ' empty');
  noteEl.textContent = note || 'Add a note…';

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<img src="${url}" alt=""><div class="meta">${new Date(p.takenAt).toLocaleString()}</div>`;
  card.querySelector('.meta').append(noteEl);
  card.onclick = () => nav.go('detail', { photo: p, url, from: 'gallery' });
  return card;
}

async function enter() {
  ensureLeaflet().catch(() => {}); // warm up the map while browsing, off the camera's critical path
  urls.forEach(URL.revokeObjectURL); urls = [];
  const photos = (await allPhotos()).reverse();
  $('empty').classList.toggle('hidden', photos.length > 0);
  const grid = $('grid');
  grid.innerHTML = '';
  for (const p of photos) {
    const url = URL.createObjectURL(photoBlob(p)); urls.push(url);
    grid.append(buildCard(p, url));
  }
}

export function init() {
  nav.register('gallery', { enter });
  $('back-btn').onclick = () => nav.go('camera');
  $('map-btn').onclick = () => nav.go('map');
}

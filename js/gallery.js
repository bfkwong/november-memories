// Gallery view ("Memories"): grid of photo cards, newest first.
import { $ } from 'util';
import { allPhotos, deletePhoto, photoBlob } from 'db';
import { ensureLeaflet } from 'leaflet-loader';
import * as nav from 'nav';

let urls = [];

function buildCard(p, url, onDelete) {
  const note = p.note?.trim();
  const noteEl = document.createElement('div');
  noteEl.className = 'note' + (note ? '' : ' empty');
  noteEl.textContent = note || 'Add a note…';

  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<img src="${url}" alt=""><div class="meta">${new Date(p.takenAt).toLocaleString()}</div>`;
  card.querySelector('.meta').append(noteEl);
  card.onclick = () => nav.go('detail', { photo: p, url, from: 'gallery' });

  const del = document.createElement('button');
  del.className = 'card-del'; del.textContent = '🗑️'; del.setAttribute('aria-label', 'Delete photo');
  del.onclick = (e) => { e.stopPropagation(); onDelete(card); }; // don't open the photo
  card.append(del);
  return card;
}

async function enter() {
  ensureLeaflet().catch(() => {}); // warm up the map while browsing, off the camera's critical path
  urls.forEach(URL.revokeObjectURL); urls = [];
  const photos = (await allPhotos()).reverse();
  const grid = $('grid');
  grid.innerHTML = '';
  const syncEmpty = () => $('empty').classList.toggle('hidden', grid.children.length > 0);
  for (const p of photos) {
    const url = URL.createObjectURL(photoBlob(p)); urls.push(url);
    grid.append(buildCard(p, url, async (card) => { await deletePhoto(p.id); card.remove(); syncEmpty(); }));
  }
  syncEmpty();
}

export function init() {
  nav.register('gallery', { enter });
  $('back-btn').onclick = () => nav.go('camera');
  $('map-btn').onclick = () => nav.go('map');
}

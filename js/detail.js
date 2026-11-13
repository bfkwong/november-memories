// Detail view: one photo with its time/location and an auto-saving note.
import { $, NBSP } from 'util';
import { saveNote, deletePhoto } from 'db';
import * as nav from 'nav';

let current = null, from = 'gallery', saveTimer = null;

function enter({ photo, url, from: origin = 'gallery' }) {
  current = photo; from = origin;
  $('detail-img').src = url;
  const loc = photo.lat == null ? 'No location'
    : `<a target="_blank" rel="noopener" href="https://maps.google.com/?q=${photo.lat},${photo.lng}">${photo.lat.toFixed(5)}, ${photo.lng.toFixed(5)}</a>`;
  $('detail-meta').innerHTML = `${new Date(photo.takenAt).toLocaleString()}<br>${loc}`;
  $('note').value = photo.note || '';
  $('saved').textContent = NBSP;
}

async function flushNote() {
  clearTimeout(saveTimer);
  if (!current) return;
  current.note = $('note').value;
  await saveNote(current.id, current.note);
  $('saved').textContent = 'Saved ✓';
}

export function init() {
  nav.register('detail', { enter });
  $('note').addEventListener('input', () => {
    $('saved').textContent = NBSP;
    clearTimeout(saveTimer); saveTimer = setTimeout(flushNote, 500);
  });
  $('detail-back').onclick = async () => { await flushNote(); current = null; nav.go(from); };
  $('detail-delete').onclick = async () => {
    if (!confirm('Delete this photo?')) return;
    clearTimeout(saveTimer);
    await deletePhoto(current.id); current = null;
    nav.go(from);
  };
}

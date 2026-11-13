// Camera view: live square viewfinder, shutter, last-photo thumbnail.
import { $ } from 'util';
import { savePhoto, allPhotos, photoBlob } from 'db';
import { startLocation, getPosition } from 'geo';
import * as nav from 'nav';

const FACING = 'environment';
const MAX_PX = 1280;
const JPEG_QUALITY = 0.5;

const video = $('video');
let stream = null, starting = null, thumbUrl = null;

function showMessage(text, showBtn = true) {
  $('message-text').textContent = text;
  $('start-btn').classList.toggle('hidden', !showBtn);
  $('message').classList.remove('hidden');
}

const streamIsLive = () => !!stream?.getTracks().some((t) => t.readyState === 'live');
function startCamera() { return (starting ||= openCamera().finally(() => { starting = null; })); }
function stopCamera() { stream?.getTracks().forEach((t) => t.stop()); stream = null; }

async function openCamera() {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: FACING }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
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

// Center-crop the current frame to a square (matches the square preview), downscale, encode as JPEG bytes.
async function snapshot() {
  const vw = video.videoWidth, vh = video.videoHeight;
  const side = Math.min(vw, vh);
  const scale = Math.min(1, MAX_PX / side);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(side * scale);
  c.getContext('2d').drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', JPEG_QUALITY));
  return blob && blob.arrayBuffer();
}

async function capture() {
  if (!stream || !video.videoWidth) return;
  $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 60);
  navigator.vibrate?.(30);

  const data = await snapshot();
  if (!data) { alert('Could not save that photo, please try again.'); return; }
  const pos = await getPosition();
  await savePhoto({
    data, type: 'image/jpeg', takenAt: Date.now(),
    lat: pos?.coords.latitude ?? null, lng: pos?.coords.longitude ?? null,
    accuracy: pos?.coords.accuracy ?? null, note: '',
  });
  nav.go('gallery'); // jump to the gallery after every shot
}

async function refreshThumb() {
  const photos = await allPhotos();
  $('count').textContent = photos.length || '';
  if (thumbUrl) URL.revokeObjectURL(thumbUrl);
  if (photos.length) { thumbUrl = URL.createObjectURL(photoBlob(photos[photos.length - 1])); $('last-thumb').src = thumbUrl; }
  else $('last-thumb').removeAttribute('src');
}

export function init() {
  nav.register('camera', {
    enter: () => { refreshThumb(); return startCamera(); }, // refresh also covers deletes made in other views
    leave: stopCamera,
  });
  $('shutter').onclick = capture;
  $('gallery-btn').onclick = () => nav.go('gallery');
  $('start-btn').onclick = startCamera;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return stopCamera();
    // only restart if the stream actually died, so tab events never cause a re-open flicker
    if (nav.currentView() === 'camera' && !streamIsLive()) startCamera();
  });
}

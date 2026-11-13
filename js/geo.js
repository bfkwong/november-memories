// Location: keep a warm position fix so taking a photo never waits on GPS.
let lastPos = null, watchId = null;

export function startLocation() {
  if (!navigator.geolocation || watchId !== null) return;
  watchId = navigator.geolocation.watchPosition(
    (p) => { lastPos = p; },
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
  );
}

export function getPosition() {
  return new Promise((resolve) => {
    if (lastPos && Date.now() - lastPos.timestamp < 30000) return resolve(lastPos);
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(lastPos), { enableHighAccuracy: true, timeout: 8000 });
  });
}

# November Memories
Vanilla JS camera app: opens the camera on load, snaps a square photo, logs GPS, saves both in IndexedDB. Browse photos in a grid or on a map, and add notes.

Camera + geolocation require HTTPS (or localhost). Run locally: `python3 -m http.server 8000`.
Deploy free on GitHub Pages / Netlify / Vercel (static, no build).

## Code layout
Plain ES modules, no build step. `index.html` holds an import map so modules import each other by short name (`import { $ } from 'util'`).

| File | Role |
| --- | --- |
| `js/main.js` | Entry point: initializes the views and opens the camera |
| `js/nav.js` | View router: `register(name, {enter, leave})`, `go(name, arg)` |
| `js/camera.js` | Camera view: viewfinder, square capture, shutter, last-photo thumbnail |
| `js/gallery.js` | Gallery view ("Memories") |
| `js/detail.js` | Photo detail view: time/location, auto-saving note |
| `js/map.js`, `js/leaflet-loader.js` | Map view; Leaflet loaded on demand |
| `js/db.js` | IndexedDB storage (photos, notes) |
| `js/geo.js` | Location watch + position lookup |
| `js/util.js` | Small DOM helpers |

To add a view: add a `<section id="NAME-view" class="hidden">`, write `js/NAME.js` that calls `nav.register('NAME', {...})` in an `init()`, add it to the import map and to `main.js`, and navigate with `nav.go('NAME')`.

## Deploying
Browsers cache assets, so bump the version on every `?v=` in `index.html` when you ship:
`sed -i 's/?v=[0-9]*/?v=NN/g' index.html`

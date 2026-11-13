// November Memories — camera + location, stored in IndexedDB. Entry point: wire up the views and start on the camera.
import { requestPersistence } from 'db';
import * as nav from 'nav';
import * as camera from 'camera';
import * as gallery from 'gallery';
import * as detail from 'detail';
import * as map from 'map';

requestPersistence();
for (const view of [camera, gallery, detail, map]) view.init();
nav.go('camera'); // auto-open the camera on load

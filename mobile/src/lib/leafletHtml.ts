export interface MapPin {
  lat: number;
  lng: number;
  make: string;
  model: string;
  color: string;
  username?: string | null;
  /** Present for a friend's pin — tapping it posts an "openProfile" message. */
  userId?: string | null;
}

/** Builds a self-contained Leaflet + free CartoDB dark-tile map (no API key)
 * for embedding in a WebView (native) or an iframe (web). Tapping a pin with
 * a userId posts {type:'openProfile', userId} via postMessage. */
export function buildLeafletHtml(pins: MapPin[]): string {
  const safeJson = JSON.stringify(pins).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<style>
  html, body, #map { height: 100%; margin: 0; background: #0F1115; }
  .leaflet-popup-content-wrapper { background: #1E222B; color: #F4F5F7; border-radius: 10px; }
  .leaflet-popup-content { font: 600 12px -apple-system, sans-serif; margin: 8px 10px; }
  .leaflet-popup-tip { background: #1E222B; }
  .leaflet-container { background: #0F1115; }
  .leaflet-control-attribution { background: rgba(15,17,21,.7) !important; color: #6A7180 !important; }
  .leaflet-control-attribution a { color: #9BA2B0 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<script>
  var pins = ${safeJson};
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20, 0], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  function postToHost(msg) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(msg);
    } else if (window.parent) {
      window.parent.postMessage(msg, '*');
    }
  }

  var bounds = [];
  pins.forEach(function (p) {
    var marker = L.circleMarker([p.lat, p.lng], {
      radius: 8, color: p.color, fillColor: p.color, fillOpacity: 0.9, weight: 2
    }).addTo(map);
    var label = (p.username ? '@' + p.username + ' &middot; ' : '') + p.make + ' ' + p.model;
    marker.bindPopup(label);
    if (p.userId) {
      marker.on('click', function () {
        postToHost(JSON.stringify({ type: 'openProfile', userId: p.userId }));
      });
    }
    bounds.push([p.lat, p.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
  }
</script>
</body>
</html>`;
}

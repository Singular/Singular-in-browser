const CACHE = 'singular-workbench-shell-v47';
const SHELL = [
  './',
  './index.html',
  './trust-config.js',
  './css/app.css',
  './js/app.js',
  './js/workspace-db.js',
  './tutorials/tutorials.js',
  './tutorials/images/4points.png',
  './tutorials/images/circlepar.png',
  './tutorials/images/deg5curve.png',
  './tutorials/images/deg5curvelinsys.png',
  './tutorials/images/embedded.png',
  './tutorials/images/highcorner.png',
  './tutorials/images/iq.png',
  './tutorials/images/node.png',
  './tutorials/images/steiner2.jpg',
  './tutorials/images/twoell2.png',
  './tutorials/images/twistedcubic2.jpg',
  './tutorials/images/twistedcubicP.jpg',
  './tutorials/images/whitney.jpg',
  './workers/singular-terminal-worker.js',
  './workers/singular-batch-worker.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/engine/') || url.pathname.includes('/vendor/')) return;
  event.respondWith(
    fetch(request).then(response => {
      const copy = response.clone();
      if (response.ok && SHELL.some(path => new URL(path, self.location.href).href === request.url)) {
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => undefined);
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

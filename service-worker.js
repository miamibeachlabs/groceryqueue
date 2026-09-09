const cacheName = 'grocery-queue-v1';
const staticFiles = [
  './',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

const localReferences = html =>
  [...html.matchAll(/(?:href|src)="([^"#]+)"/g)]
    .map(match => match[1])
    .filter(path => new URL(path, self.location).origin === self.location.origin);

const install = async () => {
  const page = await fetch('./');
  const html = await page.text();
  const cache = await caches.open(cacheName);

  await cache.put('./', new Response(html, {
    headers: page.headers,
    status: page.status,
    statusText: page.statusText,
  }));
  await cache.addAll([...staticFiles.slice(1), ...localReferences(html)]);
};

self.addEventListener('install', event => {
  event.waitUntil(install().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names
        .filter(name => name !== cacheName)
        .map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const sameOrigin = new URL(event.request.url).origin === self.location.origin;

  if (event.request.method !== 'GET' || !sameOrigin) return;

  event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (response.ok)
            await (await caches.open(cacheName)).put(event.request, response.clone());
        return response;
      })
      .catch(async () =>
        await caches.match(event.request)
        ?? (event.request.mode === 'navigate' ? caches.match('./') : undefined)
        ?? Response.error()),
  );
});

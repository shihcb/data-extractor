// Offline support for the installed app (built into dist/sw.js by
// vite.config.js, which fills in the cache name — build time and version —
// and the file list).
//
// Like instagram-follower-checker's sw.js, the live files win whenever
// there's a connection, so an update is never hidden behind a stale copy;
// unlike it, everything the app needs is saved up front at install, so it
// works offline even for tools not opened yet. And:
// - The app's own files (/assets/) have their contents in their names, so a
//   saved copy is always right: it's used first. A page opened before an
//   update keeps finding its files (the previous version's copies are kept
//   until the next update), instead of getting the host's "not found" page.
// - A failed answer (not found, or a web page where a script was asked for)
//   never stands in for — or overwrites — a good saved copy.
// - Files saved as they're first used (character maps, the picture-reading
//   files) live in their own cache, kept across updates: they still work
//   offline after the app updates.
const CACHE = '__CACHE_NAME__';
const RUNTIME = 'toolbox-runtime';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// toolbox-<build time>-<version>: this one, the one before it, and the
// runtime cache stay; older ones go
const builtAt = (key) => Number(key.split('-')[1]) || 0;
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        const older = keys.filter(k => k.startsWith('toolbox-') && k !== CACHE && k !== RUNTIME)
          .sort((a, b) => builtAt(b) - builtAt(a));
        return Promise.all(older.slice(1).map(k => caches.delete(k)));
      })
      .then(() => self.clients.claim())
  );
});

const isRuntime = (path) => path.startsWith('/pdfjs/cmaps/') || path.startsWith('/ocr/');
// A good answer: found, and not a web page standing in for a file
const good = (req, res) => res.ok && (req.mode === 'navigate' || !(res.headers.get('content-type') || '').includes('text/html') || req.destination === 'document');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const saved = () => caches.match(req, { ignoreSearch: true });

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(saved().then(hit => hit || fetch(req).then((res) => {
      if (good(req, res)) {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
      }
      return res;
    })));
    return;
  }

  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (!good(req, res)) return saved().then(hit => hit || res);
        const copy = res.clone();
        caches.open(isRuntime(url.pathname) ? RUNTIME : CACHE).then(cache => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        saved().then(hit =>
          hit || (req.mode === 'navigate' ? caches.match('/') : Response.error())
        )
      )
  );
});

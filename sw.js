// Minimal fallback service worker (keeps site installable). OneSignal uses its own worker files.
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ self.clients.claim(); });
self.addEventListener('fetch', function(event){}); 

// LinkChat Service Worker: 100% Airplane Mode Offline PWA Boot & Cross-Device Web Notifications
'use strict';

var CACHE_NAME = 'linkchat-v4-cache';
var STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './mesh.js',
  './games.js',
  './config.js',
  './manifest.json',
  './qr.min.js',
  './version.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (k) {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  // Ignore non-GET and WebRTC / WebSocket / Supabase REST requests
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.protocol.startsWith('ws') || url.hostname.includes('supabase.co')) {
    return;
  }

  e.respondWith(
    caches.match(req).then(function (cached) {
      var fetchPromise = fetch(req).then(function (networkRes) {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          var clone = networkRes.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone);
          });
        }
        return networkRes;
      }).catch(function () {
        return cached;
      });

      return cached || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});

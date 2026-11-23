// LinkChat v4: Cryptographic Time Capsules & Location-Locked Messages
// Sealed content lives in server tables protected by RLS; released only when condition is met.
// Supports full E2EE encryption, multiple photos, live countdowns, and offline/mesh fallback.
(function () {
  'use strict';

  var TAG = /^\[capsule:([0-9a-fA-F-]{36}|[a-zA-Z0-9_-]+)(?::([a-z]+))?(?::([^\]]*))?\]/i;
  var RADII = [30, 50, 100, 250, 500, 1000, 2000, 5000];
  var MAX_PHOTOS = 5;
  var D = null;            // injected dependencies from app.js
  var cards = new Map();   // cached card metadata
  var openedCache = new Map(); // cached unsealed contents for active session

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  function formatCountdown(targetMs) {
    var diff = targetMs - Date.now();
    if (diff <= 0) return '00:00:00';
    var secs = Math.floor(diff / 1000);
    var days = Math.floor(secs / 86400);
    secs %= 86400;
    var hours = Math.floor(secs / 3600);
    secs %= 3600;
    var mins = Math.floor(secs / 60);
    secs %= 60;

    var parts = [];
    if (days > 0) parts.push(days + (days === 1 ? ' day' : ' days'));
    parts.push((hours < 10 ? '0' : '') + hours + 'h');
    parts.push((mins < 10 ? '0' : '') + mins + 'm');
    parts.push((secs < 10 ? '0' : '') + secs + 's');
    return parts.join(' ');
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function localInputValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
  }

  // Reads a text item, decrypting it when the room is encrypted
  async function readText(body) {
    if (D && D.E2EE && D.E2EE.isEncrypted(body)) {
      var key = D.getCryptoKey ? D.getCryptoKey() : (window.state && window.state.cryptoKey);
      if (!key) return '🔒 Encrypted (join the private room to read)';
      try { return await D.E2EE.decryptText(key, body); } catch (e) { return '🔒 Could not decrypt'; }
    }
    return body;
  }

  function friendly(err) {
    var msg = (err && err.message) || 'Something went wrong.';
    if (/must be signed in/i.test(msg)) return 'Please sign in first.';
    return msg;
  }

  // Local storage fallback for offline / mesh mode
  var LOCAL_KEY = 'linkchat_local_capsules_v4';
  function getLocalStore() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}'); } catch (e) { return {}; }
  }
  function saveLocal(id, data) {
    try {
      var s = getLocalStore(); s[id] = data;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  // Distance in meters between two lat/lng points
  function distanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // ---------- Modal Overlay Shell ----------
  var overlay = null;
  function openOverlay(title, bodyNodes) {
    closeOverlay();
    overlay = el('div', 'cap-overlay');
    var box = el('div', 'cap-sheet');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', title);
    var head = el('div', 'cap-head');
    head.append(el('h2', 'cap-title', title));
    var x = el('button', 'cap-close', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeOverlay);
    head.append(x);
    box.append(head);
    bodyNodes.forEach(function (n) { box.append(n); });
    overlay.append(box);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeOverlay(); });
    document.body.append(overlay);
    return box;
  }
  function closeOverlay() {
    if (overlay) overlay.remove();
    overlay = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlay(); });

  function button(label, cls, onClick) {
    var b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------- Attachment Popover Menu ----------
  var attachMenu = null;
  function closeAttachMenu() { if (attachMenu) attachMenu.remove(); attachMenu = null; }

  function openAttachMenu(opts) {
    closeAttachMenu();
    attachMenu = el('div', 'cap-menu');
    attachMenu.setAttribute('role', 'menu');
    attachMenu.append(
      button('📷  Photo Library', 'cap-menu-item', function () { closeAttachMenu(); if (opts && opts.onPhoto) opts.onPhoto(); }),
      button('⏳  Time Capsule', 'cap-menu-item', function () { closeAttachMenu(); openCompose('time'); }),
      button('📍  Place Message', 'cap-menu-item', function () { closeAttachMenu(); openCompose('place'); })
    );

    var anchor = (D && D.anchor) ? D.anchor : document.getElementById('attach-btn');
    if (anchor) {
      var rect = anchor.getBoundingClientRect();
      attachMenu.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      attachMenu.style.left = Math.max(8, rect.left) + 'px';
    } else {
      attachMenu.style.bottom = '80px';
      attachMenu.style.left = '16px';
    }
    document.body.append(attachMenu);
    setTimeout(function () {
      document.addEventListener('click', function once(e) {
        if (attachMenu && !attachMenu.contains(e.target)) closeAttachMenu();
        document.removeEventListener('click', once);
      });
    }, 0);
  }

  // ---------- Compose Capsule Modal ----------
  function openCompose(kind) {
    var textArea = el('textarea', 'cap-input');
    textArea.rows = 4;
    textArea.maxLength = 1000;
    textArea.placeholder = kind === 'time' ? 'Write what to open later…' : 'Write the secret message for this place…';
    var nodes = [];
    var photos = [];
    var photoList = el('div', 'cap-photos');
    var status = el('p', 'cap-status');
    var sealBtn;

    var setStatus = function (msg, bad) { status.textContent = msg; status.classList.toggle('bad', !!bad); };

    if (kind === 'time') {
      var when = el('input', 'cap-input');
      when.type = 'datetime-local';
      var minTime = new Date(Date.now() + 2 * 60 * 1000);
      when.min = localInputValue(minTime);
      var def = new Date(Date.now() + 60 * 60 * 1000);
      when.value = localInputValue(def);

      var photoInput = el('input');
      photoInput.type = 'file';
      photoInput.accept = 'image/jpeg,image/png';
      photoInput.multiple = true;
      photoInput.hidden = true;

      var addPhotoBtn = button('+ Add photo (up to 5)', 'cap-secondary', function () {
        if (photos.length >= MAX_PHOTOS) return setStatus('Maximum ' + MAX_PHOTOS + ' photos reached.', true);
        photoInput.click();
      });

      photoInput.addEventListener('change', async function () {
        var files = Array.from(photoInput.files || []);
        photoInput.value = '';
        for (var i = 0; i < files.length && photos.length < MAX_PHOTOS; i++) {
          try {
            var f = files[i];
            var blob = (D && D.shrinkPhoto) ? await D.shrinkPhoto(f) : f;
            photos.push(blob);
            var thumb = el('img', 'cap-thumb');
            thumb.src = URL.createObjectURL(blob);
            photoList.append(thumb);
          } catch (e) {}
        }
      });

      sealBtn = button('🔒 Seal Time Capsule', 'cap-primary', async function () {
        var text = textArea.value.trim();
        if (!text && photos.length === 0) return setStatus('Write a message or attach a photo.', true);
        var dt = new Date(when.value);
        if (isNaN(dt.getTime()) || dt.getTime() < Date.now() + 90000) {
          return setStatus('Choose a time at least 2 minutes from now.', true);
        }
        await doSeal('time', text, photos, dt, null, null, null, null, sealBtn, setStatus);
      });

      nodes.push(
        el('label', 'cap-label', 'Secret message'), textArea,
        el('label', 'cap-label', 'Secret photos (revealed only after unlock)'), addPhotoBtn, photoInput, photoList,
        el('label', 'cap-label', 'Opens at'), when,
        status, sealBtn
      );
      openOverlay('⏳ Time Capsule', nodes);

    } else {
      // Place Message
      var placeName = el('input', 'cap-input');
      placeName.maxLength = 80;
      placeName.placeholder = 'e.g. Central Park Fountain, Coffee Shop';

      var lat = null, lng = null;
      var locLabel = el('p', 'cap-status', 'Location not set yet.');
      var locBtn = button('📍 Use My Current Location', 'cap-secondary', function () {
        if (!navigator.geolocation) return setStatus('Geolocation not supported by browser.', true);
        locBtn.disabled = true;
        locLabel.textContent = 'Acquiring GPS coordinates… 🛰️';
        navigator.geolocation.getCurrentPosition(function (p) {
          lat = p.coords.latitude;
          lng = p.coords.longitude;
          var acc = Math.round(p.coords.accuracy);
          locLabel.textContent = '📍 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ' (±' + acc + ' m)';
          locLabel.classList.remove('bad');
          locBtn.disabled = false;
        }, function (err) {
          locLabel.textContent = 'Could not get location (' + err.message + ')';
          locLabel.classList.add('bad');
          locBtn.disabled = false;
        }, { enableHighAccuracy: true, timeout: 12000 });
      });

      var radiusSelect = el('select', 'cap-input');
      RADII.forEach(function (r) {
        var opt = el('option', '', r >= 1000 ? (r / 1000) + ' km' : r + ' meters');
        opt.value = r;
        if (r === 100) opt.selected = true;
        radiusSelect.append(opt);
      });

      sealBtn = button('🔒 Lock Message to Place', 'cap-primary', async function () {
        var text = textArea.value.trim();
        if (!text) return setStatus('Write a message to seal.', true);
        if (lat == null || lng == null) return setStatus('Detect or enter your location first.', true);
        var rad = parseInt(radiusSelect.value, 10) || 100;
        var lbl = placeName.value.trim() || 'Nearby';
        await doSeal('place', text, [], null, lat, lng, rad, lbl, sealBtn, setStatus);
      });

      nodes.push(
        el('label', 'cap-label', 'Secret message'), textArea,
        el('label', 'cap-label', 'Place label / hint'), placeName,
        el('label', 'cap-label', 'Target location'), locBtn, locLabel,
        el('label', 'cap-label', 'Unlock radius'), radiusSelect,
        status, sealBtn
      );
      openOverlay('📍 Place-Locked Message', nodes);
    }
  }

  // ---------- Execution: Seal Capsule ----------
  async function doSeal(kind, text, photos, unlockDate, lat, lng, radius, label, btn, setStatus) {
    btn.disabled = true;
    setStatus('Sealing cryptographic vault…');

    try {
      var sbClient = (D && D.sb) ? D.sb() : window.supabase;
      var user = (D && D.getUser) ? D.getUser() : (window.state && window.state.user);
      var senderName = (D && D.getName) ? D.getName() : (window.state && window.state.name) || 'Someone';
      var roomId = (D && D.getRoom) ? D.getRoom() : (window.state && window.state.room) || 'global';
      var cid = (D && D.uuid) ? D.uuid() : (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'cap-' + Date.now());

      var items = [];

      // 1. Upload photos to storage if Supabase is active
      if (sbClient && user) {
        for (var i = 0; i < photos.length; i++) {
          var path = user.id + '/' + cid + '-' + i + '.jpg';
          var up = await sbClient.storage.from('capsule-photos').upload(path, photos[i], {
            contentType: 'image/jpeg', cacheControl: '0', upsert: false
          });
          if (!up.error) {
            items.push({ kind: 'photo', body: path });
          }
        }
      }

      // 2. Encrypt text if E2EE key is active
      var bodyText = text;
      var cryptoKey = (D && D.getCryptoKey) ? D.getCryptoKey() : (window.state && window.state.cryptoKey);
      if (D && D.E2EE && cryptoKey && text) {
        bodyText = await D.E2EE.encryptText(cryptoKey, text);
      }
      if (text) {
        items.push({ kind: 'text', body: bodyText });
      }

      var serverSaved = false;

      // 3. Try Supabase RPC
      if (sbClient && user) {
        try {
          var res = await sbClient.rpc('seal_capsule', {
            p_kind: kind,
            p_room_id: roomId,
            p_sender_name: senderName,
            p_unlock_at: kind === 'time' ? unlockDate.toISOString() : null,
            p_lat: lat,
            p_lng: lng,
            p_radius: radius,
            p_place_label: label,
            p_items: items
          });
          if (res.data && !res.error) {
            cid = res.data;
            serverSaved = true;
          }
        } catch (rpcErr) {
          console.warn('RPC seal_capsule fallback to local:', rpcErr);
        }
      }

      // 4. Save locally for offline/mesh simulation
      saveLocal(cid, {
        id: cid,
        kind: kind,
        sender_name: senderName,
        unlock_at: unlockDate ? unlockDate.toISOString() : null,
        unlock_ms: unlockDate ? unlockDate.getTime() : null,
        place_lat: lat,
        place_lng: lng,
        place_radius_m: radius,
        place_label: label,
        items: items,
        created_at: Date.now()
      });

      closeOverlay();

      var tag = '[capsule:' + cid + ']';
      if (D && D.sendMessage) {
        D.sendMessage(tag);
      } else if (window.Capsules && window.Capsules.sendCapsuleMessage) {
        window.Capsules.sendCapsuleMessage(tag);
      }

      var successMsg = kind === 'time' ? 'Time capsule sealed in chat ⏳' : 'Place message locked to coordinates 📍';
      if (D && D.toast) D.toast(successMsg);
      else if (window.toast) window.toast(successMsg);

    } catch (err) {
      setStatus(friendly(err), true);
      btn.disabled = false;
    }
  }

  // ---------- Chat Message Card Renderer ----------
  function renderCard(rawContent) {
    var m = TAG.exec(rawContent || '');
    if (!m) return null;
    var id = m[1];

    var box = el('div', 'cap-card');
    var header = el('div', 'cap-card-title', 'Sealed Vault… ⏳');
    var sub = el('div', 'cap-card-sub', 'Checking seal…');
    var actions = el('div', 'cap-card-actions');
    box.append(header, sub, actions);

    // If already unsealed in session, open direct
    if (openedCache.has(id)) {
      renderOpenedInline(box, openedCache.get(id));
      return box;
    }

    loadCard(id).then(function (card) {
      if (!card) {
        var local = getLocalStore()[id];
        if (local) {
          card = {
            id: local.id,
            kind: local.kind,
            sender_name: local.sender_name,
            unlock_at: local.unlock_at,
            place_label: local.place_label,
            radius_m: local.place_radius_m
          };
        }
      }

      if (!card) {
        sub.textContent = 'Capsule not found or expired.';
        return;
      }

      if (card.kind === 'time') {
        var unlockMs = new Date(card.unlock_at).getTime();
        header.textContent = '⏳ Time Capsule from ' + (card.sender_name || 'Someone');

        var countdownEl = el('div', 'capsule-countdown-display', 'Calculating…');
        var openBtn = button('Not yet', 'cap-card-btn', function () { openTime(id, box); });
        openBtn.disabled = true;

        actions.replaceChildren(openBtn);
        sub.replaceChildren(countdownEl);

        function updateTick() {
          var now = Date.now();
          if (now >= unlockMs) {
            countdownEl.textContent = 'Ready to Open 🔓';
            countdownEl.classList.add('ready');
            openBtn.textContent = '🔓 Open Capsule';
            openBtn.disabled = false;
            openBtn.classList.add('active-unlock');
          } else {
            countdownEl.textContent = 'Opens in ' + formatCountdown(unlockMs);
          }
        }

        var tId = setInterval(function () {
          if (!document.body.contains(box)) { clearInterval(tId); return; }
          updateTick();
        }, 1000);
        updateTick();

      } else {
        // Place Message
        header.textContent = '📍 Location Message from ' + (card.sender_name || 'Someone');
        var hint = (card.place_label ? card.place_label + ' · ' : '') + 'Opens within ' + card.radius_m + ' m';
        sub.textContent = hint;

        var openPlaceBtn = button('📍 Open Here', 'cap-card-btn active-unlock', function () {
          openPlace(id, card.radius_m, box);
        });
        actions.replaceChildren(openPlaceBtn);
      }
    });

    return box;
  }

  async function loadCard(id) {
    if (cards.has(id)) return cards.get(id);
    var sbClient = (D && D.sb) ? D.sb() : window.supabase;
    if (!sbClient) return null;
    try {
      var res = await sbClient.rpc('capsule_card', { p_id: id });
      if (res.data && !res.error) {
        cards.set(id, res.data);
        return res.data;
      }
    } catch (e) {}
    return null;
  }

  async function openTime(id, cardBox) {
    var items = null;
    var sbClient = (D && D.sb) ? D.sb() : window.supabase;

    if (sbClient) {
      try {
        var res = await sbClient.rpc('open_time_capsule', { p_id: id });
        if (res.error) {
          var when = /NOT_YET:(.+)$/.exec(res.error.message || '');
          var toastFn = (D && D.toast) || window.toast;
          if (toastFn) toastFn(when ? 'Opens ' + fmtDate(when[1]) : friendly(res.error));
          return;
        }
        if (res.data && res.data.items) items = res.data.items;
      } catch (e) {}
    }

    if (!items) {
      var local = getLocalStore()[id];
      if (local && Date.now() >= local.unlock_ms) items = local.items;
    }

    if (items) {
      openedCache.set(id, items);
      await showItems('Time Capsule ⏳', items);
      if (cardBox) renderOpenedInline(cardBox, items);
    }
  }

  function openPlace(id, radius, cardBox) {
    if (!navigator.geolocation) {
      var toastFn = (D && D.toast) || window.toast;
      if (toastFn) toastFn('Geolocation is not supported by your device.');
      return;
    }

    var toastFn = (D && D.toast) || window.toast;
    if (toastFn) toastFn('Checking your GPS location… 🛰️');

    navigator.geolocation.getCurrentPosition(async function (p) {
      var items = null;
      var myLat = p.coords.latitude;
      var myLng = p.coords.longitude;
      var sbClient = (D && D.sb) ? D.sb() : window.supabase;

      if (sbClient) {
        try {
          var res = await sbClient.rpc('open_place_message', {
            p_id: id, p_lat: myLat, p_lng: myLng
          });
          if (res.error) {
            var far = /TOO_FAR:(\d+)/.exec(res.error.message || '');
            if (far && toastFn) {
              toastFn('📍 You are ' + far[1] + ' m away. Get within ' + radius + ' m to open.');
              return;
            }
            if (toastFn) toastFn(friendly(res.error));
            return;
          }
          if (res.data && res.data.items) items = res.data.items;
        } catch (e) {}
      }

      if (!items) {
        var local = getLocalStore()[id];
        if (local) {
          var dist = distanceMeters(myLat, myLng, local.place_lat, local.place_lng);
          if (dist <= (local.place_radius_m || 100) + 40) {
            items = local.items;
          } else {
            if (toastFn) toastFn('📍 You are ' + dist + ' m away. Must be within ' + local.place_radius_m + ' m.');
            return;
          }
        }
      }

      if (items) {
        openedCache.set(id, items);
        await showItems('Location Message 📍', items);
        if (cardBox) renderOpenedInline(cardBox, items);
      }
    }, function (err) {
      if (toastFn) toastFn('Please allow location access to unseal (' + err.message + ')');
    }, { enableHighAccuracy: true, timeout: 15000 });
  }

  async function showItems(title, items) {
    var nodes = [];
    var sbClient = (D && D.sb) ? D.sb() : window.supabase;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'text') {
        nodes.push(el('p', 'cap-opened-text', await readText(it.body)));
      } else if (it.kind === 'photo') {
        var img = el('img', 'cap-opened-photo');
        img.alt = 'Vault photo';

        if (it.body.indexOf('data:') === 0 || it.body.indexOf('http') === 0) {
          img.src = it.body;
        } else if (sbClient) {
          var signed = await sbClient.storage.from('capsule-photos').createSignedUrl(it.body, 3600);
          if (signed.data && signed.data.signedUrl) img.src = signed.data.signedUrl;
        }
        nodes.push(img);
      }
    }
    if (nodes.length === 0) nodes.push(el('p', 'cap-status', 'Vault is empty.'));
    openOverlay(title, nodes);
  }

  async function renderOpenedInline(box, items) {
    box.innerHTML = '';
    var badge = el('span', 'capsule-seal-badge unlocked', 'UNSEALED');
    box.append(badge);

    var sbClient = (D && D.sb) ? D.sb() : window.supabase;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'text') {
        box.append(el('p', 'cap-opened-text', await readText(it.body)));
      } else if (it.kind === 'photo') {
        var img = el('img', 'cap-opened-photo');
        if (it.body.indexOf('data:') === 0 || it.body.indexOf('http') === 0) {
          img.src = it.body;
        } else if (sbClient) {
          var signed = await sbClient.storage.from('capsule-photos').createSignedUrl(it.body, 3600);
          if (signed.data && signed.data.signedUrl) img.src = signed.data.signedUrl;
        }
        box.append(img);
      }
    }
  }

  function previewText(rawContent) {
    var m = TAG.exec(rawContent || '');
    if (!m) return null;
    return 'Sent a capsule ⏳📍';
  }

  window.Capsules = {
    init: function (deps) { D = deps; },
    openAttachMenu: openAttachMenu,
    openModal: openCompose,
    renderCard: renderCard,
    decode: function (raw) {
      var m = TAG.exec(raw || '');
      if (!m) return null;
      return { id: m[1], kind: m[2] || 'time', title: m[3] || '' };
    },
    previewText: previewText,
    isCapsule: function (raw) { return TAG.test(raw || ''); }
  };
})();

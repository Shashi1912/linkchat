// LinkChat v4: Time Capsules & Location-Locked Messages
// Inspired by Apple design foundations: Physical metaphors, cryptographic security, restraint.
(function () {
  'use strict';

  var LOCAL_CAPSULES_KEY = 'linkchat_local_capsules_v4';
  var UNLOCKED_CACHE_KEY = 'linkchat_unlocked_capsules_v4';

  function getLocalStore() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_CAPSULES_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function saveLocalCapsule(id, data) {
    try {
      var store = getLocalStore();
      store[id] = data;
      localStorage.setItem(LOCAL_CAPSULES_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function getUnlockedCache() {
    try {
      return JSON.parse(sessionStorage.getItem(UNLOCKED_CACHE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function markUnlocked(id, items) {
    try {
      var cache = getUnlockedCache();
      cache[id] = items;
      sessionStorage.setItem(UNLOCKED_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  // Calculate distance in meters between two coordinates (Haversine formula)
  function distanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }

  // Format countdown string
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

  // Main Capsules Controller
  var Capsules = {
    // Current GPS cache
    currentLocation: null,

    init: function () {
      this.bindUI();
    },

    bindUI: function () {
      var self = this;
      var modal = document.getElementById('capsule-modal');
      var openBtn = document.getElementById('menu-capsule-btn');
      var attachCapsuleBtn = document.getElementById('attach-capsule-item');
      var closeBtn = document.getElementById('capsule-close-btn');
      var timeTab = document.getElementById('capsule-tab-time');
      var placeTab = document.getElementById('capsule-tab-place');
      var timeView = document.getElementById('capsule-view-time');
      var placeView = document.getElementById('capsule-view-place');
      var geoBtn = document.getElementById('capsule-geo-btn');
      var sealTimeBtn = document.getElementById('capsule-seal-time-btn');
      var sealPlaceBtn = document.getElementById('capsule-seal-place-btn');
      var timePresets = document.querySelectorAll('.capsule-preset-pill');

      if (openBtn) {
        openBtn.addEventListener('click', function () {
          var menu = document.getElementById('menu-popover');
          if (menu) menu.hidden = true;
          self.openModal('time');
        });
      }

      if (attachCapsuleBtn) {
        attachCapsuleBtn.addEventListener('click', function () {
          var menu = document.getElementById('attach-action-sheet');
          if (menu) menu.hidden = true;
          self.openModal('time');
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          if (modal) modal.hidden = true;
        });
      }

      if (timeTab && placeTab) {
        timeTab.addEventListener('click', function () {
          timeTab.classList.add('active');
          placeTab.classList.remove('active');
          if (timeView) timeView.hidden = false;
          if (placeView) placeView.hidden = true;
        });

        placeTab.addEventListener('click', function () {
          placeTab.classList.add('active');
          timeTab.classList.remove('active');
          if (placeView) placeView.hidden = false;
          if (timeView) timeView.hidden = true;
        });
      }

      // Time presets
      timePresets.forEach(function (pill) {
        pill.addEventListener('click', function () {
          timePresets.forEach(function (p) { p.classList.remove('active'); });
          pill.classList.add('active');
          var mins = parseInt(pill.getAttribute('data-mins'), 10);
          var dtInput = document.getElementById('capsule-unlock-datetime');
          if (dtInput && !isNaN(mins)) {
            var target = new Date(Date.now() + mins * 60 * 1000);
            // Format to local ISO string for datetime-local
            var tzOffset = target.getTimezoneOffset() * 60000;
            var localISOTime = (new Date(target.getTime() - tzOffset)).toISOString().slice(0, 16);
            dtInput.value = localISOTime;
          }
        });
      });

      // Geolocation detect button
      if (geoBtn) {
        geoBtn.addEventListener('click', function () {
          self.requestCurrentLocation();
        });
      }

      // Seal time capsule
      if (sealTimeBtn) {
        sealTimeBtn.addEventListener('click', function () {
          self.handleSealTime();
        });
      }

      // Seal place capsule
      if (sealPlaceBtn) {
        sealPlaceBtn.addEventListener('click', function () {
          self.handleSealPlace();
        });
      }
    },

    openModal: function (tab) {
      var modal = document.getElementById('capsule-modal');
      if (!modal) return;
      modal.hidden = false;

      // Default time input to 1 hour from now
      var dtInput = document.getElementById('capsule-unlock-datetime');
      if (dtInput) {
        var target = new Date(Date.now() + 60 * 60 * 1000);
        var tzOffset = target.getTimezoneOffset() * 60000;
        var localISOTime = (new Date(target.getTime() - tzOffset)).toISOString().slice(0, 16);
        dtInput.value = localISOTime;
        dtInput.min = (new Date(Date.now() + 2 * 60 * 1000 - tzOffset)).toISOString().slice(0, 16);
      }

      if (tab === 'place') {
        var placeTab = document.getElementById('capsule-tab-place');
        if (placeTab) placeTab.click();
      } else {
        var timeTab = document.getElementById('capsule-tab-time');
        if (timeTab) timeTab.click();
      }
    },

    requestCurrentLocation: function () {
      var self = this;
      var statusEl = document.getElementById('capsule-geo-status');
      var latInput = document.getElementById('capsule-place-lat');
      var lngInput = document.getElementById('capsule-place-lng');

      if (!navigator.geolocation) {
        if (statusEl) statusEl.textContent = 'Geolocation is not supported by your browser.';
        return;
      }

      if (statusEl) statusEl.textContent = 'Acquiring GPS coordinates… 🛰️';

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var acc = Math.round(pos.coords.accuracy);
          self.currentLocation = { lat: lat, lng: lng, accuracy: acc };

          if (latInput) latInput.value = lat.toFixed(6);
          if (lngInput) lngInput.value = lng.toFixed(6);
          if (statusEl) {
            statusEl.textContent = '📍 Acquired: ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ' (±' + acc + 'm)';
            statusEl.classList.add('success');
          }
        },
        function (err) {
          if (statusEl) {
            statusEl.textContent = 'Location access denied or unavailable (' + err.message + ')';
            statusEl.classList.remove('success');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    },

    handleSealTime: async function () {
      var textInput = document.getElementById('capsule-time-text');
      var dtInput = document.getElementById('capsule-unlock-datetime');
      var photoInput = document.getElementById('capsule-time-photo');
      var sealBtn = document.getElementById('capsule-seal-time-btn');

      var text = textInput ? textInput.value.trim() : '';
      var dtVal = dtInput ? dtInput.value : '';

      if (!text && (!photoInput || !photoInput.files || !photoInput.files[0])) {
        if (window.toast) window.toast('Please write a message or choose a photo to seal.');
        return;
      }

      if (!dtVal) {
        if (window.toast) window.toast('Please choose when the capsule unlocks.');
        return;
      }

      var unlockDate = new Date(dtVal);
      var unlockMs = unlockDate.getTime();
      if (isNaN(unlockMs) || unlockMs < Date.now() + 110000) {
        if (window.toast) window.toast('Please choose a time at least 2 minutes in the future.');
        return;
      }

      sealBtn.disabled = true;
      sealBtn.textContent = 'Sealing Vault… ⏳';

      try {
        var photoFile = photoInput && photoInput.files && photoInput.files[0];
        var photoDataUrl = null;
        var photoStoragePath = null;

        if (photoFile) {
          if (window.shrinkPhoto) {
            var blob = await window.shrinkPhoto(photoFile);
            photoDataUrl = await new Promise(function (res) {
              var r = new FileReader();
              r.onload = function () { res(r.result); };
              r.readAsDataURL(blob);
            });
          }
        }

        var capsuleId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('cap-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
        var senderName = (window.state && window.state.name) ? window.state.name : 'Someone';
        var roomId = (window.state && window.state.room) ? window.state.room : 'global';

        var items = [];
        if (text) items.push({ kind: 'text', body: text });
        if (photoDataUrl) items.push({ kind: 'photo', body: photoDataUrl });

        var serverSuccess = false;

        // Try Supabase RPC if signed in
        if (window.supabase && window.state && window.state.user) {
          try {
            var rpcItems = [];
            if (text) rpcItems.push({ kind: 'text', body: text });

            // If there's a photo and Supabase storage works
            if (photoFile) {
              var photoPath = window.state.user.id + '/' + capsuleId + '.jpg';
              var upRes = await window.supabase.storage.from('capsule-photos').upload(photoPath, photoFile, {
                contentType: 'image/jpeg',
                upsert: true
              });
              if (!upRes.error) {
                rpcItems.push({ kind: 'photo', body: photoPath });
              } else if (photoDataUrl) {
                rpcItems.push({ kind: 'photo', body: photoDataUrl });
              }
            }

            var res = await window.supabase.rpc('seal_capsule', {
              p_kind: 'time',
              p_room_id: roomId,
              p_sender_name: senderName,
              p_unlock_at: unlockDate.toISOString(),
              p_lat: null,
              p_lng: null,
              p_radius: null,
              p_place_label: null,
              p_items: rpcItems
            });

            if (res.data && !res.error) {
              capsuleId = res.data;
              serverSuccess = true;
            }
          } catch (rpcErr) {
            console.warn('Supabase capsule RPC fallback to local:', rpcErr);
          }
        }

        // Save locally for fallback/offline/peer simulation
        saveLocalCapsule(capsuleId, {
          id: capsuleId,
          kind: 'time',
          sender_name: senderName,
          unlock_at: unlockDate.toISOString(),
          unlock_ms: unlockMs,
          items: items,
          created_at: Date.now()
        });

        // Format unlock label
        var dateLabel = unlockDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        var tag = '[capsule:' + capsuleId + ':time:' + encodeURIComponent('Opens ' + dateLabel) + ']';

        // Send via composer / chat
        this.sendCapsuleMessage(tag, 'Time Capsule (Opens ' + dateLabel + ')');

        // Reset form & close modal
        if (textInput) textInput.value = '';
        if (photoInput) photoInput.value = '';
        var modal = document.getElementById('capsule-modal');
        if (modal) modal.hidden = true;
        if (window.toast) window.toast('Vault Sealed! ⏳ Time capsule placed in chat.');

      } catch (err) {
        if (window.toast) window.toast('Failed to seal capsule: ' + err.message);
      } finally {
        sealBtn.disabled = false;
        sealBtn.textContent = '🔒 Seal Time Capsule';
      }
    },

    handleSealPlace: async function () {
      var textInput = document.getElementById('capsule-place-text');
      var labelInput = document.getElementById('capsule-place-label');
      var latInput = document.getElementById('capsule-place-lat');
      var lngInput = document.getElementById('capsule-place-lng');
      var radiusSelect = document.getElementById('capsule-place-radius');
      var sealBtn = document.getElementById('capsule-seal-place-btn');

      var text = textInput ? textInput.value.trim() : '';
      var label = labelInput ? labelInput.value.trim() : 'Specific Location';
      var lat = latInput ? parseFloat(latInput.value) : NaN;
      var lng = lngInput ? parseFloat(lngInput.value) : NaN;
      var radius = radiusSelect ? parseInt(radiusSelect.value, 10) : 100;

      if (!text) {
        if (window.toast) window.toast('Please write a message to seal.');
        return;
      }

      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        if (window.toast) window.toast('Please detect or enter valid GPS coordinates.');
        return;
      }

      sealBtn.disabled = true;
      sealBtn.textContent = 'Locking to Place… 📍';

      try {
        var capsuleId = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('place-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
        var senderName = (window.state && window.state.name) ? window.state.name : 'Someone';
        var roomId = (window.state && window.state.room) ? window.state.room : 'global';

        var items = [{ kind: 'text', body: text }];

        // Try Supabase RPC if signed in
        if (window.supabase && window.state && window.state.user) {
          try {
            var res = await window.supabase.rpc('seal_capsule', {
              p_kind: 'place',
              p_room_id: roomId,
              p_sender_name: senderName,
              p_unlock_at: null,
              p_lat: lat,
              p_lng: lng,
              p_radius: radius,
              p_place_label: label,
              p_items: items
            });

            if (res.data && !res.error) {
              capsuleId = res.data;
            }
          } catch (rpcErr) {
            console.warn('Supabase place RPC fallback to local:', rpcErr);
          }
        }

        // Save locally for fallback/mesh
        saveLocalCapsule(capsuleId, {
          id: capsuleId,
          kind: 'place',
          sender_name: senderName,
          place_lat: lat,
          place_lng: lng,
          place_radius_m: radius,
          place_label: label,
          items: items,
          created_at: Date.now()
        });

        var tag = '[capsule:' + capsuleId + ':place:' + encodeURIComponent(label) + ']';
        this.sendCapsuleMessage(tag, 'Place Message (Near ' + label + ')');

        if (textInput) textInput.value = '';
        var modal = document.getElementById('capsule-modal');
        if (modal) modal.hidden = true;
        if (window.toast) window.toast('Locked to Place! 📍 Must be nearby to open.');

      } catch (err) {
        if (window.toast) window.toast('Failed to seal place message: ' + err.message);
      } finally {
        sealBtn.disabled = false;
        sealBtn.textContent = '🔒 Lock Message to Place';
      }
    },

    sendCapsuleMessage: function (tag, label) {
      if (!window.state || !window.state.user) return;
      var m = {
        id: (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('msg-' + Date.now()),
        user_id: window.state.user.id,
        display_name: window.state.name,
        content: tag,
        raw: null,
        ts: Date.now(),
        status: 'sending',
        seq: ++window.state.seq
      };
      window.state.msgs.set(m.id, m);
      if (window.render) window.render('bottom');
      if (window.playSendSound) window.playSendSound();
      if (window.insert) window.insert(m);
    },

    // Decode capsule match from message content
    decode: function (content) {
      var s = String(content || '');
      var m = s.match(/^\[capsule:([a-zA-Z0-9_-]+):([a-z]+):?([^\]]*)\]/);
      if (!m) return null;
      return {
        id: m[1],
        kind: m[2],
        title: decodeURIComponent(m[3] || ''),
        raw: m[0]
      };
    },

    // Build the interactive Apple Glass Capsule card inside a chat bubble
    renderCard: function (capsuleMeta, isMine) {
      var self = this;
      var card = document.createElement('div');
      card.className = 'capsule-card apple-glass-card ' + (capsuleMeta.kind === 'time' ? 'capsule-time' : 'capsule-place');
      card.id = 'capsule-card-' + capsuleMeta.id;

      var header = document.createElement('div');
      header.className = 'capsule-card-header';

      var badgeIcon = capsuleMeta.kind === 'time' ? '⏳' : '📍';
      var badgeTitle = capsuleMeta.kind === 'time' ? 'Time Capsule' : 'Place-Locked';

      header.innerHTML = '<span class="capsule-icon-wrap">' + badgeIcon + '</span>' +
                         '<div class="capsule-title-box">' +
                           '<strong class="capsule-title">' + badgeTitle + '</strong>' +
                           '<span class="capsule-subtitle">' + (capsuleMeta.title || 'Sealed Message') + '</span>' +
                         '</div>' +
                         '<span class="capsule-seal-badge">SEALED</span>';
      card.appendChild(header);

      var body = document.createElement('div');
      body.className = 'capsule-card-body';
      card.appendChild(body);

      // Check if this capsule was already unlocked in this session
      var cached = getUnlockedCache()[capsuleMeta.id];
      if (cached) {
        self.renderUnlockedContent(body, cached);
        var badge = card.querySelector('.capsule-seal-badge');
        if (badge) {
          badge.textContent = 'UNLOCKED';
          badge.classList.add('unlocked');
        }
        return card;
      }

      // If not yet unlocked, render lock status and action trigger
      if (capsuleMeta.kind === 'time') {
        self.setupTimeCapsuleBody(body, capsuleMeta, card);
      } else {
        self.setupPlaceCapsuleBody(body, capsuleMeta, card);
      }

      return card;
    },

    setupTimeCapsuleBody: function (body, meta, card) {
      var self = this;
      var timerBox = document.createElement('div');
      timerBox.className = 'capsule-timer-box';

      var countdownSpan = document.createElement('div');
      countdownSpan.className = 'capsule-countdown-display';
      countdownSpan.textContent = 'Calculating…';

      var hintSpan = document.createElement('div');
      hintSpan.className = 'capsule-hint';
      hintSpan.textContent = 'Locked cryptographically until unlock time.';

      var unsealBtn = document.createElement('button');
      unsealBtn.type = 'button';
      unsealBtn.className = 'btn-capsule-action';
      unsealBtn.textContent = '⏳ Waiting for Unlock Date';
      unsealBtn.disabled = true;

      timerBox.appendChild(countdownSpan);
      timerBox.appendChild(hintSpan);
      timerBox.appendChild(unsealBtn);
      body.appendChild(timerBox);

      // Fetch metadata from server or local store
      var localData = getLocalStore()[meta.id];
      var unlockMs = localData ? localData.unlock_ms : null;

      function updateUI(targetMs) {
        if (!targetMs) return;
        var now = Date.now();
        if (now >= targetMs) {
          countdownSpan.textContent = 'Ready to Open 🔓';
          countdownSpan.classList.add('ready');
          hintSpan.textContent = 'The countdown has finished! Vault is open.';
          unsealBtn.textContent = '🔓 Break Seal & Read';
          unsealBtn.disabled = false;
          unsealBtn.classList.add('active-unlock');
        } else {
          countdownSpan.textContent = formatCountdown(targetMs);
        }
      }

      // If we don't have local ms, query Supabase capsule_card
      if (!unlockMs && window.supabase && window.state && window.state.user) {
        window.supabase.rpc('capsule_card', { p_id: meta.id }).then(function (res) {
          if (res.data && res.data.unlock_at) {
            unlockMs = new Date(res.data.unlock_at).getTime();
            updateUI(unlockMs);
          }
        }).catch(function () {});
      }

      // Interval ticker
      var timerId = setInterval(function () {
        if (!document.body.contains(countdownSpan)) {
          clearInterval(timerId);
          return;
        }
        if (unlockMs) updateUI(unlockMs);
      }, 1000);
      if (unlockMs) updateUI(unlockMs);

      // Unseal click handler
      unsealBtn.addEventListener('click', async function () {
        unsealBtn.disabled = true;
        unsealBtn.textContent = 'Opening Vault…';

        try {
          var items = null;

          // 1. Try server RPC
          if (window.supabase && window.state && window.state.user) {
            try {
              var res = await window.supabase.rpc('open_time_capsule', { p_id: meta.id });
              if (res.data && res.data.items) {
                items = res.data.items;
              }
            } catch (err) {
              console.warn('RPC open_time_capsule returned:', err);
            }
          }

          // 2. Local fallback
          if (!items && localData && localData.items) {
            if (Date.now() >= localData.unlock_ms) {
              items = localData.items;
            }
          }

          if (items && items.length > 0) {
            clearInterval(timerId);
            markUnlocked(meta.id, items);
            var badge = card.querySelector('.capsule-seal-badge');
            if (badge) {
              badge.textContent = 'UNLOCKED';
              badge.classList.add('unlocked');
            }
            body.innerHTML = '';
            self.renderUnlockedContent(body, items);
            if (window.playReceiveSound) window.playReceiveSound();
          } else {
            if (window.toast) window.toast('Capsule is still sealed. Cannot be opened yet.');
            unsealBtn.disabled = false;
            unsealBtn.textContent = '⏳ Waiting for Unlock Date';
          }
        } catch (e) {
          if (window.toast) window.toast('Error opening capsule: ' + e.message);
          unsealBtn.disabled = false;
        }
      });
    },

    setupPlaceCapsuleBody: function (body, meta, card) {
      var self = this;
      var box = document.createElement('div');
      box.className = 'capsule-timer-box';

      var iconSpan = document.createElement('div');
      iconSpan.className = 'capsule-radar-icon';
      iconSpan.innerHTML = '🛰️';

      var hintSpan = document.createElement('div');
      hintSpan.className = 'capsule-hint';
      hintSpan.textContent = 'Unlockable only when physically at ' + (meta.title || 'the location') + '.';

      var verifyBtn = document.createElement('button');
      verifyBtn.type = 'button';
      verifyBtn.className = 'btn-capsule-action active-unlock';
      verifyBtn.textContent = '📍 Verify Location & Open';

      box.appendChild(iconSpan);
      box.appendChild(hintSpan);
      box.appendChild(verifyBtn);
      body.appendChild(box);

      var localData = getLocalStore()[meta.id];

      verifyBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          if (window.toast) window.toast('Geolocation is required to unlock this place message.');
          return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Checking GPS position… 🛰️';

        navigator.geolocation.getCurrentPosition(
          async function (pos) {
            var myLat = pos.coords.latitude;
            var myLng = pos.coords.longitude;
            var accuracy = Math.round(pos.coords.accuracy);

            try {
              var items = null;

              // 1. Try Supabase server RPC
              if (window.supabase && window.state && window.state.user) {
                try {
                  var res = await window.supabase.rpc('open_place_message', {
                    p_id: meta.id,
                    p_lat: myLat,
                    p_lng: myLng
                  });
                  if (res.data && res.data.items) {
                    items = res.data.items;
                  }
                } catch (rpcErr) {
                  var errMsg = rpcErr.message || '';
                  if (errMsg.indexOf('TOO_FAR') !== -1) {
                    var m = errMsg.match(/TOO_FAR:(\d+)/);
                    var dist = m ? m[1] : 'far';
                    if (window.toast) window.toast('📍 Too far! You are ' + dist + 'm away. Move closer to unlock.');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = '📍 Too far (' + dist + 'm) · Try Again';
                    return;
                  }
                }
              }

              // 2. Local fallback check
              if (!items && localData) {
                var distM = distanceMeters(myLat, myLng, localData.place_lat, localData.place_lng);
                var allowedRadius = (localData.place_radius_m || 100) + Math.min(accuracy, 50); // account for GPS jitter
                if (distM <= allowedRadius) {
                  items = localData.items;
                } else {
                  if (window.toast) window.toast('📍 Too far! You are ' + distM + 'm away (must be within ' + localData.place_radius_m + 'm).');
                  verifyBtn.disabled = false;
                  verifyBtn.textContent = '📍 Too far (' + distM + 'm) · Try Again';
                  return;
                }
              }

              if (items && items.length > 0) {
                markUnlocked(meta.id, items);
                var badge = card.querySelector('.capsule-seal-badge');
                if (badge) {
                  badge.textContent = 'UNLOCKED';
                  badge.classList.add('unlocked');
                }
                body.innerHTML = '';
                self.renderUnlockedContent(body, items);
                if (window.toast) window.toast('🔓 Location Verified! Welcome.');
                if (window.playReceiveSound) window.playReceiveSound();
              } else {
                if (window.toast) window.toast('Could not verify place message. Move closer to location.');
                verifyBtn.disabled = false;
                verifyBtn.textContent = '📍 Verify Location & Open';
              }
            } catch (err) {
              if (window.toast) window.toast('Verification failed: ' + err.message);
              verifyBtn.disabled = false;
              verifyBtn.textContent = '📍 Verify Location & Open';
            }
          },
          function (err) {
            if (window.toast) window.toast('Location error: ' + err.message);
            verifyBtn.disabled = false;
            verifyBtn.textContent = '📍 Verify Location & Open';
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
        );
      });
    },

    renderUnlockedContent: function (container, items) {
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'capsule-unsealed-content';

      items.forEach(function (it) {
        if (it.kind === 'text') {
          var p = document.createElement('div');
          p.className = 'capsule-revealed-text';
          p.textContent = it.body;
          wrap.appendChild(p);
        } else if (it.kind === 'photo') {
          var img = document.createElement('img');
          img.className = 'capsule-revealed-img';
          img.alt = 'Vault photo';
          img.loading = 'lazy';

          // If it's a Supabase storage path or data URL
          if (it.body.indexOf('data:') === 0 || it.body.indexOf('http') === 0) {
            img.src = it.body;
          } else if (window.supabase) {
            var pubUrl = window.supabase.storage.from('capsule-photos').getPublicUrl(it.body).data.publicUrl;
            img.src = pubUrl;
          }
          wrap.appendChild(img);
        }
      });

      container.appendChild(wrap);
    }
  };

  window.Capsules = Capsules;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { Capsules.init(); });
  } else {
    Capsules.init();
  }
})();

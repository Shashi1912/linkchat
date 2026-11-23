// LinkChat — Lovers & Couples Suite (100% Private, E2EE, Zero-AI)
// Features:
// 1. Heart-Sync & Hold Hands Mode (Live synchronized touch, heartbeat audio & haptic pulse)
// 2. Foggy Glass Scratch-Off Notes (Condensation mist wiped away by touch)
// 3. "Under the Same Sky" Compass Ring (Live distance, bearing, and facing alignment glow)
// 4. Instant "Thinking of You" Heart Flare (Ephemeral floating particles & haptic tap)
// 5. "Listen Together" Ambient Soundscapes (Rain, Fireplace, Ocean, Night procedural audio)
// 6. Couple Milestones & Reunion Countdown (Days together counter, next date countdown, bucket list)
// 7. Gentle Glance (Real-time mood & battery status)

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Couple = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var audioCtx = null;
  var ambientNodes = { source: null, gain: null, timer: null, track: 'none' };
  var holdHandsState = {
    isHolding: false,
    myTouch: false,
    partnerTouch: false,
    startTime: null,
    timerInterval: null,
    heartbeatInterval: null
  };
  var compassState = {
    myLat: null,
    myLon: null,
    partnerLat: null,
    partnerLon: null,
    heading: 0,
    bearing: null,
    distanceKm: null,
    watchingOrientation: false
  };
  var myStatus = {
    mood: '',
    battery: null,
    isCharging: false
  };
  var partnerStatus = {
    mood: '',
    battery: null,
    isCharging: false,
    updatedAt: 0
  };

  var getChannelCallback = null;
  var getUserCallback = null;
  var getNameCallback = null;
  var getRoomCallback = null;
  var onSendSecretMessage = null;

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  // Authentic Diastolic/Systolic Heartbeat ("lub-dub") Web Audio Synth
  function playHeartbeatSound() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;

      // Lub (First sound: lower, slightly longer)
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(65, now);
      osc1.frequency.exponentialRampToValueAtTime(35, now + 0.12);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // Dub (Second sound: slightly higher, sharper at +0.16s)
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(80, now + 0.16);
      osc2.frequency.exponentialRampToValueAtTime(45, now + 0.28);
      gain2.gain.setValueAtTime(0.001, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.32);
    } catch (e) {}
  }

  function triggerHeartbeatHaptic() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([35, 45, 30, 180]);
      } catch (e) {}
    }
  }

  // Play "Thinking of You" Apple Starlight Chime
  function playThinkingChime() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;
      var chord = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      chord.forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.001, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.08, now + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.5);
      });
    } catch (e) {}
  }

  // =========================================================================
  // 1. Live Heart-Sync & "Hold Hands" Canvas
  // =========================================================================

  function openHoldHands() {
    var modal = document.getElementById('couple-hands-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('couple-modal-active');
    holdHandsState.isHolding = false;
    holdHandsState.myTouch = false;
    holdHandsState.partnerTouch = false;
    holdHandsState.startTime = null;
    updateHoldHandsUI();
    broadcastTouchState(false);
  }

  function closeHoldHands() {
    var modal = document.getElementById('couple-hands-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('couple-modal-active');
    stopHeartbeatLoop();
    broadcastTouchState(false);
  }

  function startHeartbeatLoop() {
    if (holdHandsState.heartbeatInterval) return;
    playHeartbeatSound();
    triggerHeartbeatHaptic();
    holdHandsState.heartbeatInterval = setInterval(function () {
      playHeartbeatSound();
      triggerHeartbeatHaptic();
    }, 950);

    if (!holdHandsState.startTime) {
      holdHandsState.startTime = Date.now();
      holdHandsState.timerInterval = setInterval(function () {
        var elapsedSec = Math.floor((Date.now() - holdHandsState.startTime) / 1000);
        var m = Math.floor(elapsedSec / 60);
        var s = elapsedSec % 60;
        var timerEl = document.getElementById('couple-hands-timer');
        if (timerEl) {
          timerEl.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
        }
      }, 1000);
    }
  }

  function stopHeartbeatLoop() {
    if (holdHandsState.heartbeatInterval) {
      clearInterval(holdHandsState.heartbeatInterval);
      holdHandsState.heartbeatInterval = null;
    }
    if (holdHandsState.timerInterval) {
      clearInterval(holdHandsState.timerInterval);
      holdHandsState.timerInterval = null;
    }
    holdHandsState.startTime = null;
    var timerEl = document.getElementById('couple-hands-timer');
    if (timerEl) timerEl.textContent = '00:00';
  }

  function updateHoldHandsUI() {
    var myPad = document.getElementById('couple-pad-mine');
    var partnerPad = document.getElementById('couple-pad-partner');
    var statusTitle = document.getElementById('couple-hands-title');
    var statusDesc = document.getElementById('couple-hands-desc');
    var bridge = document.getElementById('couple-hands-bridge');

    if (myPad) myPad.classList.toggle('active', holdHandsState.myTouch);
    if (partnerPad) partnerPad.classList.toggle('active', holdHandsState.partnerTouch);

    var bothTouching = holdHandsState.myTouch && holdHandsState.partnerTouch;
    if (bridge) bridge.classList.toggle('connected', bothTouching);

    if (bothTouching) {
      if (statusTitle) statusTitle.textContent = '💓 Holding Hands';
      if (statusDesc) statusDesc.textContent = 'Connected in real-time. Feel their heartbeat.';
      startHeartbeatLoop();
    } else if (holdHandsState.myTouch) {
      if (statusTitle) statusTitle.textContent = 'Waiting for your partner…';
      if (statusDesc) statusDesc.textContent = 'Keep touching. When they touch, your hearts connect.';
      playHeartbeatSound();
      triggerHeartbeatHaptic();
      stopHeartbeatLoop();
    } else if (holdHandsState.partnerTouch) {
      if (statusTitle) statusTitle.textContent = 'Your partner is touching!';
      if (statusDesc) statusDesc.textContent = 'Touch your pad to hold their hand.';
      stopHeartbeatLoop();
    } else {
      if (statusTitle) statusTitle.textContent = 'Hold Hands & Heart-Sync';
      if (statusDesc) statusDesc.textContent = 'Touch and hold your thumbprint pad together';
      stopHeartbeatLoop();
    }
  }

  function broadcastTouchState(isTouching) {
    holdHandsState.myTouch = isTouching;
    var ch = getChannelCallback ? getChannelCallback() : null;
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: 'couple_touch',
          payload: {
            isTouching: isTouching,
            timestamp: Date.now()
          }
        });
      } catch (e) {}
    }
    updateHoldHandsUI();
  }

  function handleIncomingTouch(payload) {
    if (!payload) return;
    holdHandsState.partnerTouch = Boolean(payload.isTouching);
    updateHoldHandsUI();
  }

  // =========================================================================
  // 2. Instant "Thinking of You" Heart Flare
  // =========================================================================

  function sendThinkingOfYou() {
    playThinkingChime();
    triggerHeartbeatHaptic();
    spawnHeartFloatParticles();

    var ch = getChannelCallback ? getChannelCallback() : null;
    var myName = getNameCallback ? getNameCallback() : 'Your lover';
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: 'couple_thinking',
          payload: {
            name: myName,
            timestamp: Date.now()
          }
        });
      } catch (e) {}
    }

    if (window.toast) {
      window.toast('Sent a sweet heart flutter 💖');
    }
  }

  function handleIncomingThinking(payload) {
    playThinkingChime();
    triggerHeartbeatHaptic();
    spawnHeartFloatParticles();

    var name = (payload && payload.name) || 'Your love';
    if (window.toast) {
      window.toast(name + ' is thinking of you right now 💖');
    }
  }

  function spawnHeartFloatParticles() {
    var container = document.getElementById('couple-particles-layer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'couple-particles-layer';
      container.className = 'couple-particles-layer';
      document.body.appendChild(container);
    }

    var emojis = ['💖', '💕', '✨', '🌸', '❤️', '💫', '🌹'];
    for (var i = 0; i < 22; i++) {
      (function (idx) {
        setTimeout(function () {
          var p = document.createElement('span');
          p.className = 'floating-heart-particle';
          p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          p.style.left = (Math.random() * 85 + 7) + 'vw';
          p.style.bottom = '-10px';
          p.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
          p.style.fontSize = (1.4 + Math.random() * 1.5) + 'rem';
          container.appendChild(p);

          setTimeout(function () {
            if (p.parentNode) p.parentNode.removeChild(p);
          }, 3800);
        }, idx * 70);
      })(i);
    }
  }

  // =========================================================================
  // 3. Foggy Glass Scratch-Off Notes ("Mist & Condensation")
  // =========================================================================

  function isFoggy(content) {
    return Boolean(content && content.startsWith('[foggy_note:') && content.endsWith(']'));
  }

  function encodeFoggy(text) {
    return '[foggy_note:' + encodeURIComponent(text) + ']';
  }

  function decodeFoggy(content) {
    var match = content.match(/^\[foggy_note:(.*)\]$/);
    if (!match) return content;
    try {
      return decodeURIComponent(match[1]);
    } catch (e) {
      return content;
    }
  }

  function renderFoggyCard(rawContent, isMine) {
    var secretText = decodeFoggy(rawContent);
    var card = document.createElement('div');
    card.className = 'foggy-secret-card' + (isMine ? ' mine' : '');

    var header = document.createElement('div');
    header.className = 'foggy-card-header';
    header.innerHTML = '<span class="foggy-icon">🌫️</span> <strong>Secret Love Note</strong> <small>Rub to reveal</small>';

    var stage = document.createElement('div');
    stage.className = 'foggy-canvas-stage';

    var textEl = document.createElement('div');
    textEl.className = 'foggy-revealed-text';
    textEl.textContent = secretText;

    var canvas = document.createElement('canvas');
    canvas.className = 'foggy-scratch-canvas';

    stage.appendChild(textEl);
    stage.appendChild(canvas);

    var footer = document.createElement('div');
    footer.className = 'foggy-card-footer';
    var refogBtn = document.createElement('button');
    refogBtn.type = 'button';
    refogBtn.className = 'btn-refog';
    refogBtn.textContent = 'Re-fog Mist 🌫️';
    footer.appendChild(refogBtn);

    card.appendChild(header);
    card.appendChild(stage);
    card.appendChild(footer);

    // Initialize Canvas Scratch Mechanics
    setTimeout(function () {
      initFoggyCanvas(canvas, refogBtn);
    }, 50);

    return card;
  }

  function initFoggyCanvas(canvas, refogBtn) {
    var ctx = canvas.getContext('2d');
    var rect = canvas.getBoundingClientRect();
    var width = rect.width || 280;
    var height = rect.height || 140;
    canvas.width = width;
    canvas.height = height;

    function drawMist() {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(235, 240, 248, 0.94)';
      ctx.fillRect(0, 0, width, height);

      // Droplets & condensation texture
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (var i = 0; i < 40; i++) {
        var rx = Math.random() * width;
        var ry = Math.random() * height;
        var r = Math.random() * 4 + 1;
        ctx.beginPath();
        ctx.arc(rx, ry, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = '500 13px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(100, 116, 139, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText('✨ Wipe finger to clear fog ✨', width / 2, height / 2 + 5);
    }

    drawMist();

    var isScratching = false;

    function eraseAt(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      triggerHeartbeatHaptic();
    }

    function getCoords(e) {
      var r = canvas.getBoundingClientRect();
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: clientX - r.left, y: clientY - r.top };
    }

    canvas.addEventListener('pointerdown', function (e) {
      isScratching = true;
      var c = getCoords(e);
      eraseAt(c.x, c.y);
    });

    window.addEventListener('pointermove', function (e) {
      if (!isScratching) return;
      var c = getCoords(e);
      eraseAt(c.x, c.y);
    });

    window.addEventListener('pointerup', function () { isScratching = false; });
    window.addEventListener('pointercancel', function () { isScratching = false; });

    if (refogBtn) {
      refogBtn.addEventListener('click', function () {
        drawMist();
        if (window.toast) window.toast('Mist restored 🌫️');
      });
    }
  }

  function promptSendFoggyNote() {
    var text = prompt('Enter your secret love note (partner must wipe foggy glass to reveal):');
    if (!text || !text.trim()) return;
    var encoded = encodeFoggy(text.trim());
    if (typeof onSendSecretMessage === 'function') {
      onSendSecretMessage(encoded);
    }
  }

  // =========================================================================
  // 4. "Under the Same Sky" Compass & Proximity Ring
  // =========================================================================

  function openCompass() {
    var modal = document.getElementById('couple-compass-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('couple-modal-active');

    requestMyCoords();
    startOrientationWatcher();
    updateCompassUI();
  }

  function closeCompass() {
    var modal = document.getElementById('couple-compass-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('couple-modal-active');
    stopOrientationWatcher();
  }

  function requestMyCoords() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      compassState.myLat = pos.coords.latitude;
      compassState.myLon = pos.coords.longitude;

      var ch = getChannelCallback ? getChannelCallback() : null;
      if (ch) {
        try {
          ch.send({
            type: 'broadcast',
            event: 'couple_coords',
            payload: {
              lat: compassState.myLat,
              lon: compassState.myLon,
              timestamp: Date.now()
            }
          });
        } catch (e) {}
      }

      calculateDistanceAndBearing();
      updateCompassUI();
    }, function (err) {
      console.warn('Compass geolocation notice:', err);
    }, { enableHighAccuracy: true });
  }

  function handleIncomingCoords(payload) {
    if (!payload || !payload.lat || !payload.lon) return;
    compassState.partnerLat = payload.lat;
    compassState.partnerLon = payload.lon;
    calculateDistanceAndBearing();
    updateCompassUI();
  }

  function calculateDistanceAndBearing() {
    if (compassState.myLat == null || compassState.partnerLat == null) return;
    var lat1 = compassState.myLat * Math.PI / 180;
    var lon1 = compassState.myLon * Math.PI / 180;
    var lat2 = compassState.partnerLat * Math.PI / 180;
    var lon2 = compassState.partnerLon * Math.PI / 180;

    // Haversine formula
    var R = 6371; // Earth radius in km
    var dLat = lat2 - lat1;
    var dLon = lon2 - lon1;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    compassState.distanceKm = Math.round((R * c) * 10) / 10;

    // Target bearing
    var y = Math.sin(dLon) * Math.cos(lat2);
    var x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    compassState.bearing = (brng + 360) % 360;
  }

  function startOrientationWatcher() {
    if (compassState.watchingOrientation) return;
    compassState.watchingOrientation = true;

    function handleOrientation(e) {
      var heading = 0;
      if (typeof e.webkitCompassHeading !== 'undefined') {
        heading = e.webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360;
      }
      compassState.heading = Math.round(heading);
      updateCompassUI();
    }

    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(function (res) {
        if (res === 'granted') {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      }).catch(function () {});
    } else {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
  }

  function stopOrientationWatcher() {
    compassState.watchingOrientation = false;
  }

  function updateCompassUI() {
    var distEl = document.getElementById('compass-distance-val');
    var subEl = document.getElementById('compass-distance-sub');
    var dial = document.getElementById('compass-dial-needle');
    var alignBanner = document.getElementById('compass-align-banner');

    if (distEl) {
      if (compassState.distanceKm != null) {
        if (compassState.distanceKm < 0.05) {
          distEl.textContent = 'In the same room 💕';
          if (subEl) subEl.textContent = 'Close enough to touch!';
        } else {
          distEl.textContent = compassState.distanceKm + ' km apart';
          if (subEl) subEl.textContent = 'Under the same sky';
        }
      } else {
        distEl.textContent = 'Locating each other…';
        if (subEl) subEl.textContent = 'Tap Share Coordinates to sync';
      }
    }

    if (compassState.bearing != null && dial) {
      var diff = (compassState.bearing - compassState.heading + 360) % 360;
      dial.style.transform = 'rotate(' + diff + 'deg)';

      // Check alignment (facing each other within ±15 degrees)
      var isAligned = (diff < 15 || diff > 345);
      if (alignBanner) alignBanner.classList.toggle('active', isAligned);
      if (isAligned && !dial.classList.contains('aligned')) {
        dial.classList.add('aligned');
        triggerHeartbeatHaptic();
      } else if (!isAligned) {
        dial.classList.remove('aligned');
      }
    }
  }

  // =========================================================================
  // 5. "Listen Together" Synchronized Ambient Soundscapes (Web Audio Synth)
  // =========================================================================

  function openAmbientPlayer() {
    var modal = document.getElementById('couple-ambient-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('couple-modal-active');
  }

  function closeAmbientPlayer() {
    var modal = document.getElementById('couple-ambient-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('couple-modal-active');
  }

  function playAmbientTrack(trackName, broadcast) {
    stopAmbientTrack(false);
    var ctx = getAudioContext();
    if (!ctx) return;

    ambientNodes.track = trackName;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 1.2);
    gain.connect(ctx.destination);
    ambientNodes.gain = gain;

    if (trackName === 'rain') {
      createProceduralRain(ctx, gain);
    } else if (trackName === 'fire') {
      createProceduralFire(ctx, gain);
    } else if (trackName === 'ocean') {
      createProceduralOcean(ctx, gain);
    } else if (trackName === 'night') {
      createProceduralNight(ctx, gain);
    }

    updateAmbientButtonsUI(trackName);

    if (broadcast !== false) {
      var ch = getChannelCallback ? getChannelCallback() : null;
      if (ch) {
        try {
          ch.send({
            type: 'broadcast',
            event: 'couple_ambient',
            payload: { track: trackName, active: true }
          });
        } catch (e) {}
      }
    }
  }

  function stopAmbientTrack(broadcast) {
    if (ambientNodes.gain && audioCtx) {
      try {
        ambientNodes.gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      } catch (e) {}
    }
    if (ambientNodes.timer) {
      clearInterval(ambientNodes.timer);
      ambientNodes.timer = null;
    }
    setTimeout(function () {
      if (ambientNodes.source) {
        try { ambientNodes.source.stop(); } catch (e) {}
        ambientNodes.source = null;
      }
    }, 650);

    ambientNodes.track = 'none';
    updateAmbientButtonsUI('none');

    if (broadcast !== false) {
      var ch = getChannelCallback ? getChannelCallback() : null;
      if (ch) {
        try {
          ch.send({
            type: 'broadcast',
            event: 'couple_ambient',
            payload: { track: 'none', active: false }
          });
        } catch (e) {}
      }
    }
  }

  function handleIncomingAmbient(payload) {
    if (!payload) return;
    if (payload.active && payload.track && payload.track !== 'none') {
      playAmbientTrack(payload.track, false);
      if (window.toast) {
        window.toast('Your partner started playing: ' + payload.track + ' 🎧');
      }
    } else {
      stopAmbientTrack(false);
    }
  }

  // Procedural Web Audio Ambient Generators (Zero MP3 download, 100% offline!)
  function createProceduralRain(ctx, dest) {
    var bufferSize = ctx.sampleRate * 3;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.45;
    }
    var whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;
    whiteNoise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(850, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(dest);
    whiteNoise.start();
    ambientNodes.source = whiteNoise;
  }

  function createProceduralFire(ctx, dest) {
    var bufferSize = ctx.sampleRate * 2;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);
    filter.Q.setValueAtTime(1.5, ctx.currentTime);

    noise.connect(filter);
    filter.connect(dest);
    noise.start();
    ambientNodes.source = noise;

    // Occasional wood crackles
    ambientNodes.timer = setInterval(function () {
      if (Math.random() > 0.4) {
        try {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(120 + Math.random() * 600, ctx.currentTime);
          g.gain.setValueAtTime(0.001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.connect(g);
          g.connect(dest);
          osc.start();
          osc.stop(ctx.currentTime + 0.09);
        } catch (e) {}
      }
    }, 280);
  }

  function createProceduralOcean(ctx, dest) {
    var bufferSize = ctx.sampleRate * 4;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    var lastOut = 0.0;
    for (var i = 0; i < bufferSize; i++) {
      var white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
    var pinkNoise = ctx.createBufferSource();
    pinkNoise.buffer = buffer;
    pinkNoise.loop = true;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    // LFO to create rhythmic waves
    var lfo = ctx.createOscillator();
    var lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(0.09, ctx.currentTime); // ~11 second wave cycle
    lfoGain.gain.setValueAtTime(0.28, ctx.currentTime);

    var mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.2, ctx.currentTime);

    lfo.connect(mainGain.gain);
    pinkNoise.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(dest);

    pinkNoise.start();
    lfo.start();
    ambientNodes.source = pinkNoise;
  }

  function createProceduralNight(ctx, dest) {
    createProceduralRain(ctx, dest);
    // Crickets
    ambientNodes.timer = setInterval(function () {
      if (Math.random() > 0.3) {
        try {
          var osc = ctx.createOscillator();
          var g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(4200, ctx.currentTime);
          g.gain.setValueAtTime(0.001, ctx.currentTime);
          g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.02);
          g.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.09);
          osc.connect(g);
          g.connect(dest);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
      }
    }, 450);
  }

  function updateAmbientButtonsUI(activeTrack) {
    ['rain', 'fire', 'ocean', 'night'].forEach(function (name) {
      var btn = document.getElementById('ambient-btn-' + name);
      if (btn) btn.classList.toggle('active', name === activeTrack);
    });
    var status = document.getElementById('ambient-status-text');
    if (status) {
      status.textContent = activeTrack === 'none' ? 'No ambient sound playing' : 'Playing ' + activeTrack + ' in sync 🎧';
    }
  }

  // =========================================================================
  // 6. Couple Milestones & Next Reunion Countdown
  // =========================================================================

  function getMilestoneStorageKey() {
    var room = getRoomCallback ? getRoomCallback() : 'general';
    return 'linkchat.milestones.' + room;
  }

  function loadMilestones() {
    try {
      var raw = localStorage.getItem(getMilestoneStorageKey());
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      anniversary: '',
      reunion: '',
      bucketList: [
        { text: 'Watch sunset together on the beach 🌅', done: false },
        { text: 'Cook a 3-course dinner together 🍝', done: false },
        { text: 'Midnight drive under the stars ✨', done: false }
      ]
    };
  }

  function saveMilestones(data) {
    try {
      localStorage.setItem(getMilestoneStorageKey(), JSON.stringify(data));
    } catch (e) {}
  }

  function openMilestones() {
    var modal = document.getElementById('couple-milestones-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('couple-modal-active');
    renderMilestones();
  }

  function closeMilestones() {
    var modal = document.getElementById('couple-milestones-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('couple-modal-active');
  }

  function renderMilestones() {
    var data = loadMilestones();

    // 1. Anniversary / Days Together
    var daysEl = document.getElementById('milestone-days-val');
    var subEl = document.getElementById('milestone-days-sub');
    var anniInput = document.getElementById('milestone-anniversary-input');

    if (anniInput) anniInput.value = data.anniversary || '';

    if (data.anniversary && daysEl) {
      var diffMs = Date.now() - new Date(data.anniversary).getTime();
      if (diffMs > 0) {
        var days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        daysEl.textContent = days + ' Days';
        if (subEl) subEl.textContent = 'of laughter, love and memories together ❤️';
      } else {
        daysEl.textContent = 'Day 1';
      }
    } else if (daysEl) {
      daysEl.textContent = 'Set Date';
      if (subEl) subEl.textContent = 'Choose your anniversary below';
    }

    // 2. Reunion Countdown
    var reunionEl = document.getElementById('milestone-reunion-val');
    var reunionInput = document.getElementById('milestone-reunion-input');

    if (reunionInput) reunionInput.value = data.reunion || '';

    if (data.reunion && reunionEl) {
      var remMs = new Date(data.reunion).getTime() - Date.now();
      if (remMs > 0) {
        var remDays = Math.floor(remMs / (1000 * 60 * 60 * 24));
        var remHours = Math.floor((remMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        reunionEl.textContent = remDays + 'd ' + remHours + 'h until we meet ✈️';
      } else {
        reunionEl.textContent = 'Together today! 💕';
      }
    } else if (reunionEl) {
      reunionEl.textContent = 'Plan next date';
    }

    // 3. Bucket List
    renderBucketList(data.bucketList);
  }

  function renderBucketList(items) {
    var listEl = document.getElementById('couple-bucket-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    items.forEach(function (item, idx) {
      var row = document.createElement('div');
      row.className = 'couple-bucket-row' + (item.done ? ' done' : '');

      var check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = Boolean(item.done);
      check.addEventListener('change', function () {
        var data = loadMilestones();
        if (data.bucketList[idx]) {
          data.bucketList[idx].done = check.checked;
          saveMilestones(data);
          renderMilestones();
          if (check.checked) {
            spawnHeartFloatParticles();
            triggerHeartbeatHaptic();
            if (window.toast) window.toast('Goal achieved together! 💖');
          }
        }
      });

      var label = document.createElement('span');
      label.textContent = item.text;

      row.appendChild(check);
      row.appendChild(label);
      listEl.appendChild(row);
    });
  }

  // =========================================================================
  // 7. Gentle Glance: Battery & Mood Indicator
  // =========================================================================

  function initBatteryWatcher() {
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then(function (battery) {
        function updateBat() {
          myStatus.battery = Math.round(battery.level * 100);
          myStatus.isCharging = battery.charging;
          broadcastStatus();
        }
        updateBat();
        battery.addEventListener('levelchange', updateBat);
        battery.addEventListener('chargingchange', updateBat);
      }).catch(function () {});
    }
  }

  function setMood(moodText) {
    myStatus.mood = moodText;
    broadcastStatus();
    if (window.toast) window.toast('Status set to: ' + moodText);
  }

  function broadcastStatus() {
    var ch = getChannelCallback ? getChannelCallback() : null;
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: 'couple_status',
          payload: {
            mood: myStatus.mood,
            battery: myStatus.battery,
            isCharging: myStatus.isCharging,
            timestamp: Date.now()
          }
        });
      } catch (e) {}
    }
    updateGlanceUI();
  }

  function handleIncomingStatus(payload) {
    if (!payload) return;
    partnerStatus.mood = payload.mood || '';
    partnerStatus.battery = payload.battery != null ? payload.battery : null;
    partnerStatus.isCharging = Boolean(payload.isCharging);
    partnerStatus.updatedAt = Date.now();
    updateGlanceUI();
  }

  function updateGlanceUI() {
    var chip = document.getElementById('couple-glance-chip');
    if (!chip) return;

    if (!partnerStatus.mood && partnerStatus.battery == null) {
      chip.hidden = true;
      return;
    }

    chip.hidden = false;
    var parts = [];
    if (partnerStatus.mood) parts.push(partnerStatus.mood);
    if (partnerStatus.battery != null) {
      parts.push((partnerStatus.isCharging ? '⚡' : '🪫') + ' ' + partnerStatus.battery + '%');
    }
    chip.textContent = parts.join(' • ');
  }

  // =========================================================================
  // Master Setup & Initialization
  // =========================================================================

  function init(options) {
    options = options || {};
    getChannelCallback = options.getChannel;
    getUserCallback = options.getUser;
    getNameCallback = options.getName;
    getRoomCallback = options.getRoom;
    onSendSecretMessage = options.sendMessage;

    initBatteryWatcher();
    setupDomListeners();
  }

  function setupDomListeners() {
    // Quick Love Action Buttons
    var quickBtn = document.getElementById('quick-love-btn');
    var hubBtn = document.getElementById('couple-hub-btn');

    if (quickBtn) quickBtn.addEventListener('click', sendThinkingOfYou);
    if (hubBtn) hubBtn.addEventListener('click', openCoupleMenuSheet);

    // Menu Item Triggers
    var menuHands = document.getElementById('menu-couple-hands-btn');
    var menuCompass = document.getElementById('menu-couple-compass-btn');
    var menuAmbient = document.getElementById('menu-couple-ambient-btn');
    var menuMilestones = document.getElementById('menu-couple-milestones-btn');
    var menuFoggy = document.getElementById('menu-couple-foggy-btn');

    if (menuHands) menuHands.addEventListener('click', openHoldHands);
    if (menuCompass) menuCompass.addEventListener('click', openCompass);
    if (menuAmbient) menuAmbient.addEventListener('click', openAmbientPlayer);
    if (menuMilestones) menuMilestones.addEventListener('click', openMilestones);
    if (menuFoggy) menuFoggy.addEventListener('click', promptSendFoggyNote);

    // Hold Hands Touch Pad Listeners
    var myPad = document.getElementById('couple-pad-mine');
    if (myPad) {
      myPad.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        broadcastTouchState(true);
      });
      window.addEventListener('pointerup', function () {
        if (holdHandsState.myTouch) broadcastTouchState(false);
      });
      window.addEventListener('pointercancel', function () {
        if (holdHandsState.myTouch) broadcastTouchState(false);
      });
    }

    // Modal Close Buttons
    var closeHands = document.getElementById('couple-hands-close');
    var closeCompassBtn = document.getElementById('couple-compass-close');
    var closeAmbientBtn = document.getElementById('couple-ambient-close');
    var closeMilestonesBtn = document.getElementById('couple-milestones-close');

    if (closeHands) closeHands.addEventListener('click', closeHoldHands);
    if (closeCompassBtn) closeCompassBtn.addEventListener('click', closeCompass);
    if (closeAmbientBtn) closeAmbientBtn.addEventListener('click', closeAmbientPlayer);
    if (closeMilestonesBtn) closeMilestonesBtn.addEventListener('click', closeMilestones);

    // Ambient Player Track Buttons
    ['rain', 'fire', 'ocean', 'night'].forEach(function (name) {
      var btn = document.getElementById('ambient-btn-' + name);
      if (btn) {
        btn.addEventListener('click', function () {
          if (ambientNodes.track === name) {
            stopAmbientTrack(true);
          } else {
            playAmbientTrack(name, true);
          }
        });
      }
    });

    var ambientStopBtn = document.getElementById('ambient-btn-stop');
    if (ambientStopBtn) ambientStopBtn.addEventListener('click', function () { stopAmbientTrack(true); });

    // Milestones Inputs
    var anniInput = document.getElementById('milestone-anniversary-input');
    if (anniInput) {
      anniInput.addEventListener('change', function () {
        var data = loadMilestones();
        data.anniversary = anniInput.value;
        saveMilestones(data);
        renderMilestones();
      });
    }

    var reunionInput = document.getElementById('milestone-reunion-input');
    if (reunionInput) {
      reunionInput.addEventListener('change', function () {
        var data = loadMilestones();
        data.reunion = reunionInput.value;
        saveMilestones(data);
        renderMilestones();
      });
    }

    var addBucketBtn = document.getElementById('milestone-add-bucket-btn');
    var bucketInput = document.getElementById('milestone-bucket-input');
    if (addBucketBtn && bucketInput) {
      addBucketBtn.addEventListener('click', function () {
        var val = (bucketInput.value || '').trim();
        if (!val) return;
        var data = loadMilestones();
        data.bucketList.push({ text: val, done: false });
        saveMilestones(data);
        bucketInput.value = '';
        renderMilestones();
      });
    }
  }

  function openCoupleMenuSheet() {
    var menu = document.getElementById('header-more-menu');
    if (menu) menu.hidden = false;
  }

  // Handle incoming Supabase realtime broadcast events
  function handleBroadcast(event, payload) {
    if (event === 'couple_touch') handleIncomingTouch(payload);
    else if (event === 'couple_thinking') handleIncomingThinking(payload);
    else if (event === 'couple_coords') handleIncomingCoords(payload);
    else if (event === 'couple_ambient') handleIncomingAmbient(payload);
    else if (event === 'couple_status') handleIncomingStatus(payload);
  }

  return {
    init: init,
    sendThinkingOfYou: sendThinkingOfYou,
    openHoldHands: openHoldHands,
    openCompass: openCompass,
    openAmbient: openAmbientPlayer,
    openMilestones: openMilestones,
    promptSendFoggyNote: promptSendFoggyNote,
    isFoggy: isFoggy,
    encodeFoggy: encodeFoggy,
    decodeFoggy: decodeFoggy,
    renderFoggyCard: renderFoggyCard,
    setMood: setMood,
    handleBroadcast: handleBroadcast
  };
}));

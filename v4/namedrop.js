// LinkChat — Apple NameDrop / Proximity Tap-to-Join Engine
// Enables instant room sharing by touching phones or bringing them close together (Web NFC + Ultrasonic Acoustic Beam + AirDrop)
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NameDrop = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var nfcReader = null;
  var nfcAbortCtrl = null;
  var audioCtx = null;
  var micStream = null;
  var micAnalyser = null;
  var chirpInterval = null;
  var listenInterval = null;
  var activeMode = 'share'; // 'share' | 'receive'
  var isOverlayOpen = false;
  var onJoinCallback = null;
  var getRoomCallback = null;
  var getChannelCallback = null;
  var getSbCallback = null;
  var discoveryChannel = null;
  var acousticHeardRecently = false;
  var acousticHeardTimer = null;

  // Near-Ultrasound Acoustic Frequencies (inaudible to adults, within standard 44.1/48kHz audio sample rates)
  var FREQ_BEACON_1 = 18600;
  var FREQ_BEACON_2 = 19200;
  var FREQ_BEACON_3 = 19800;

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

  // Apple NameDrop Synthesized Audio Chime (Magical whoosh + harmonic chord)
  function playNameDropChime() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;

      // Apple-style harmonic chime sequence
      [523.25, 659.25, 783.99, 1046.50].forEach(function (freq, i) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.05 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.6);
      });
    } catch (e) {}
  }

  // Tactile Haptic Feedback (Authentic Apple double-tap buzz)
  function triggerHaptic() {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([35, 45, 35, 60, 90]);
      } catch (e) {}
    }
  }

  // Emit Inaudible High-Frequency Acoustic Chirp (Proximity proof < 1-2m)
  function startAcousticBeacon() {
    stopAcousticBeacon();
    function emitPulse() {
      try {
        var ctx = getAudioContext();
        if (!ctx) return;
        var now = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(FREQ_BEACON_1, now);
        osc.frequency.setValueAtTime(FREQ_BEACON_2, now + 0.15);
        osc.frequency.setValueAtTime(FREQ_BEACON_3, now + 0.3);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        gain.gain.setValueAtTime(0.08, now + 0.42);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      } catch (e) {}
    }
    emitPulse();
    chirpInterval = setInterval(emitPulse, 1600);
  }

  function stopAcousticBeacon() {
    if (chirpInterval) {
      clearInterval(chirpInterval);
      chirpInterval = null;
    }
  }

  // Listen for High-Frequency Acoustic Proximity Spike
  async function startAcousticListener(onProximityDetected) {
    stopAcousticListener();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false
      });
      var ctx = getAudioContext();
      if (!ctx) return;
      var source = ctx.createMediaStreamSource(micStream);
      micAnalyser = ctx.createAnalyser();
      micAnalyser.fftSize = 1024;
      source.connect(micAnalyser);

      var bufferLength = micAnalyser.frequencyBinCount;
      var dataArray = new Uint8Array(bufferLength);
      var nyquist = ctx.sampleRate / 2;
      var targetBin1 = Math.round((FREQ_BEACON_1 / nyquist) * bufferLength);
      var targetBin2 = Math.round((FREQ_BEACON_2 / nyquist) * bufferLength);

      listenInterval = setInterval(function () {
        if (!micAnalyser) return;
        micAnalyser.getByteFrequencyData(dataArray);
        var energy1 = dataArray[targetBin1] || 0;
        var energy2 = dataArray[targetBin2] || 0;

        // If high energy detected in near-ultrasound band, phones are physically close!
        if (energy1 > 80 || energy2 > 80) {
          acousticHeardRecently = true;
          if (acousticHeardTimer) clearTimeout(acousticHeardTimer);
          acousticHeardTimer = setTimeout(function () {
            acousticHeardRecently = false;
          }, 4000);

          if (typeof onProximityDetected === 'function') {
            onProximityDetected();
          }
        }
      }, 250);
    } catch (e) {
      console.warn('NameDrop acoustic listener notice (device may not grant mic):', e);
    }
  }

  function stopAcousticListener() {
    if (listenInterval) {
      clearInterval(listenInterval);
      listenInterval = null;
    }
    if (micStream) {
      micStream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
      micStream = null;
    }
    micAnalyser = null;
    if (acousticHeardTimer) {
      clearTimeout(acousticHeardTimer);
      acousticHeardTimer = null;
    }
    acousticHeardRecently = false;
  }

  // ---------- Web NFC Tap-to-Share Protocol ----------
  async function startNfcWriter(payload) {
    stopNfc();
    if (!('NDEFReader' in window)) return false;

    try {
      nfcAbortCtrl = new AbortController();
      var ndef = new window.NDEFReader();
      var payloadStr = JSON.stringify(payload);
      await ndef.write({
        records: [
          { recordType: 'text', data: payloadStr },
          { recordType: 'url', data: payload.url || window.location.href }
        ]
      }, { signal: nfcAbortCtrl.signal });
      return true;
    } catch (e) {
      console.warn('Web NFC writer notice:', e);
      return false;
    }
  }

  async function startNfcReader(onReadCallback) {
    stopNfc();
    if (!('NDEFReader' in window)) return false;

    try {
      nfcAbortCtrl = new AbortController();
      nfcReader = new window.NDEFReader();
      await nfcReader.scan({ signal: nfcAbortCtrl.signal });

      nfcReader.onreading = function (event) {
        if (!event || !event.message || !event.message.records) return;
        event.message.records.forEach(function (rec) {
          try {
            var textDecoder = new TextDecoder(rec.encoding || 'utf-8');
            var raw = textDecoder.decode(rec.data);
            var parsed = JSON.parse(raw);
            if (parsed && parsed.linkchat) {
              onReadCallback(parsed);
            }
          } catch (e) {}
        });
      };
      return true;
    } catch (e) {
      console.warn('Web NFC reader notice:', e);
      return false;
    }
  }

  function stopNfc() {
    if (nfcAbortCtrl) {
      try { nfcAbortCtrl.abort(); } catch (e) {}
      nfcAbortCtrl = null;
    }
    nfcReader = null;
  }

  // ---------- Supabase Discovery Realtime Channel ----------
  function getSb() {
    if (typeof getSbCallback === 'function') return getSbCallback();
    return window.sb || null;
  }

  function ensureDiscoveryChannel() {
    var sb = getSb();
    if (!sb || discoveryChannel) return discoveryChannel;
    try {
      discoveryChannel = sb.channel('namedrop:discovery', {
        config: { broadcast: { self: false } }
      });

      discoveryChannel
        .on('broadcast', { event: 'namedrop_request' }, function () {
          // If in share mode and modal open, send current room credentials
          if (activeMode === 'share' && isOverlayOpen) {
            var room = getRoomCallback ? getRoomCallback() : { id: 'general', name: 'General Chat', key: '' };
            broadcastRoomCredentials(room);
          }
        })
        .on('broadcast', { event: 'namedrop_offer' }, function (payload) {
          // If in receive mode and modal open, receive credentials and join room!
          if (activeMode === 'receive' && isOverlayOpen && payload && payload.payload) {
            handleReceivedRoom(payload.payload);
          }
        });

      discoveryChannel.subscribe();
    } catch (e) {
      console.warn('NameDrop discovery channel setup notice:', e);
    }
    return discoveryChannel;
  }

  function teardownDiscoveryChannel() {
    if (discoveryChannel) {
      try {
        var sb = getSb();
        if (sb && sb.removeChannel) sb.removeChannel(discoveryChannel);
      } catch (e) {}
      discoveryChannel = null;
    }
  }

  function broadcastRoomCredentials(room) {
    var ch = discoveryChannel || (getChannelCallback ? getChannelCallback() : null);
    if (!ch) return;
    try {
      ch.send({
        type: 'broadcast',
        event: 'namedrop_offer',
        payload: {
          roomId: room.id,
          roomKey: room.key || '',
          roomName: room.name || room.id,
          timestamp: Date.now()
        }
      });
    } catch (e) {}
  }

  // ---------- UI & Orchestration ----------
  function init(options) {
    options = options || {};
    onJoinCallback = options.onJoinRoom;
    getRoomCallback = options.getRoom;
    getChannelCallback = options.getChannel;
    getSbCallback = options.sb || options.getSb;

    setupDomListeners();
  }

  function setupDomListeners() {
    var pickerBtn = document.getElementById('namedrop-picker-btn');
    var headerBtn = document.getElementById('namedrop-header-btn');
    var menuBtn = document.getElementById('menu-namedrop-btn');
    var closeBtn = document.getElementById('namedrop-close-btn');
    var tabShare = document.getElementById('namedrop-tab-share');
    var tabReceive = document.getElementById('namedrop-tab-receive');
    var airdropBtn = document.getElementById('namedrop-airdrop-btn');
    var statusBox = document.querySelector('.namedrop-status-box');
    var modal = document.getElementById('namedrop-modal');

    if (pickerBtn) pickerBtn.addEventListener('click', function () { openModal('receive'); });
    if (headerBtn) headerBtn.addEventListener('click', function () { openModal('share'); });
    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        var menu = document.getElementById('header-more-menu');
        if (menu) menu.hidden = true;
        openModal('share');
      });
    }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    if (tabShare) {
      tabShare.addEventListener('click', function () {
        setMode('share');
      });
    }
    if (tabReceive) {
      tabReceive.addEventListener('click', function () {
        setMode('receive');
      });
    }

    if (airdropBtn) {
      airdropBtn.addEventListener('click', triggerNativeAirDrop);
    }

    // Touch/Click radar pulse or status box for manual proximity trigger fallback
    if (statusBox) {
      statusBox.addEventListener('click', function () {
        if (activeMode === 'receive') {
          triggerProximityHandshake();
        } else {
          var room = getRoomCallback ? getRoomCallback() : { id: 'general', name: 'General Chat', key: '' };
          broadcastRoomCredentials(room);
          playNameDropChime();
          triggerHaptic();
        }
      });
    }
  }

  function openModal(initialMode) {
    var modal = document.getElementById('namedrop-modal');
    if (!modal) return;
    isOverlayOpen = true;
    modal.hidden = false;
    modal.classList.remove('connected');
    document.body.classList.add('namedrop-active');

    ensureDiscoveryChannel();
    updateRoomPreview();
    setMode(initialMode || 'share');
  }

  function closeModal() {
    var modal = document.getElementById('namedrop-modal');
    if (modal) {
      modal.hidden = true;
      modal.classList.remove('connected');
    }
    document.body.classList.remove('namedrop-active');
    isOverlayOpen = false;

    stopAcousticBeacon();
    stopAcousticListener();
    stopNfc();
    teardownDiscoveryChannel();
  }

  function updateRoomPreview() {
    var room = getRoomCallback ? getRoomCallback() : { id: 'general', name: 'General Chat', key: '' };
    var nameEl = document.getElementById('namedrop-room-name');
    var subEl = document.getElementById('namedrop-room-sub');
    if (nameEl) nameEl.textContent = room.name || room.id || 'General Chat';
    if (subEl) subEl.textContent = room.id === 'general' ? 'Public Room' : '🔒 End-to-End Encrypted Room';
  }

  function setMode(mode) {
    activeMode = mode;
    var tabShare = document.getElementById('namedrop-tab-share');
    var tabReceive = document.getElementById('namedrop-tab-receive');
    var statusTitle = document.getElementById('namedrop-status-title');
    var statusSub = document.getElementById('namedrop-status-sub');
    var roomBadge = document.getElementById('namedrop-room-badge');
    var phonesAnim = document.getElementById('namedrop-phones-anim');

    if (tabShare) {
      tabShare.classList.toggle('active', mode === 'share');
      tabShare.setAttribute('aria-selected', String(mode === 'share'));
    }
    if (tabReceive) {
      tabReceive.classList.toggle('active', mode === 'receive');
      tabReceive.setAttribute('aria-selected', String(mode === 'receive'));
    }

    stopAcousticBeacon();
    stopAcousticListener();
    stopNfc();

    var room = getRoomCallback ? getRoomCallback() : { id: 'general', name: 'General Chat', key: '' };

    if (mode === 'share') {
      if (statusTitle) statusTitle.textContent = 'Ready to Beam / Tap Phones…';
      if (statusSub) statusSub.textContent = 'Bring phones together or touch back-to-back';
      if (roomBadge) roomBadge.hidden = false;
      if (phonesAnim) phonesAnim.className = 'namedrop-phones-anim mode-share';

      // Start Web NFC Writer
      var nfcPayload = {
        linkchat: true,
        roomId: room.id,
        roomKey: room.key || '',
        roomName: room.name,
        url: buildInviteUrl(room)
      };
      startNfcWriter(nfcPayload);

      // Start Ultrasonic Proximity Chirp
      startAcousticBeacon();

      // Broadcast room beacon
      broadcastRoomCredentials(room);
    } else {
      // Receive Mode
      if (statusTitle) statusTitle.textContent = 'Listening for Nearby Tap…';
      if (statusSub) statusSub.textContent = 'Hold top of phone against another device';
      if (roomBadge) roomBadge.hidden = true;
      if (phonesAnim) phonesAnim.className = 'namedrop-phones-anim mode-receive';

      // Start Web NFC Reader
      startNfcReader(function (payload) {
        handleReceivedRoom(payload);
      });

      // Start Ultrasonic Listener
      startAcousticListener(function () {
        triggerProximityHandshake();
      });

      // Request proximity handshake over discovery channel
      triggerProximityHandshake();
    }
  }

  function buildInviteUrl(room) {
    var base = window.location.href.split('?')[0].split('#')[0];
    var url = base + '?room=' + encodeURIComponent(room.id);
    if (room.key) {
      url += '&key=' + encodeURIComponent(room.key);
    }
    return url;
  }

  function triggerNativeAirDrop() {
    var room = getRoomCallback ? getRoomCallback() : { id: 'general', name: 'General Chat', key: '' };
    var url = buildInviteUrl(room);

    if (navigator.share) {
      navigator.share({
        title: 'Join ' + (room.name || 'Chat') + ' on LinkChat',
        text: 'Tap this link to join ' + (room.name || 'our conversation') + ' instantly:',
        url: url
      }).catch(function (e) {
        console.warn('AirDrop / Share cancelled:', e);
      });
    } else {
      // Fallback: copy link
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          alert('Room link copied! Bring device close or send via WhatsApp/AirDrop.');
        });
      }
    }
  }

  function triggerProximityHandshake() {
    var ch = discoveryChannel || (getChannelCallback ? getChannelCallback() : null);
    if (ch) {
      try {
        ch.send({
          type: 'broadcast',
          event: 'namedrop_request',
          payload: { timestamp: Date.now() }
        });
      } catch (e) {}
    }
  }

  function handleReceivedRoom(payload) {
    if (!payload || !payload.roomId) return;
    triggerHaptic();
    playNameDropChime();

    // Trigger full-screen Apple Aurora Bloom flare
    var modal = document.getElementById('namedrop-modal');
    if (modal) modal.classList.add('connected');

    var statusTitle = document.getElementById('namedrop-status-title');
    var statusSub = document.getElementById('namedrop-status-sub');
    if (statusTitle) statusTitle.textContent = '✨ Room Unlocked!';
    if (statusSub) statusSub.textContent = 'Opening ' + (payload.roomName || payload.roomId) + '…';

    setTimeout(function () {
      closeModal();
      if (typeof onJoinCallback === 'function') {
        onJoinCallback(payload.roomId, payload.roomKey || '', payload.roomName || payload.roomId);
      }
    }, 650);
  }

  return {
    init: init,
    open: openModal,
    close: closeModal,
    setMode: setMode,
    triggerAirDrop: triggerNativeAirDrop,
    handleReceivedRoom: handleReceivedRoom
  };
}));

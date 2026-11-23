// LinkChat — Apple Design System & Instant Messaging.
// Supabase handles: anonymous sign-in, message storage, realtime, presence.
(function () {
  'use strict';

  var cfg = window.LINKCHAT_CONFIG || {};
  var DEFAULT_ROOM = cfg.DEFAULT_ROOM_ID || cfg.ROOM_ID || 'general';
  var DEFAULT_ROOM_NAME = cfg.DEFAULT_ROOM_NAME || cfg.ROOM_NAME || 'General Chat';
  var PRIVATE_ROOMS = cfg.ENABLE_PRIVATE_ROOMS !== false;
  var PAGE_SIZE = 50;
  var MAX_LEN = 1000;
  var NAME_KEY = 'linkchat.name';
  var ROOM_KEY = 'linkchat.room';
  var ROOM_NAME_KEY = 'linkchat.roomName';
  var ROOM_KEY_PASS = 'linkchat.roomKey';
  var THEME_KEY = 'linkchat.theme';
  var NOTIF_KEY = 'linkchat.notifications';
  var BUCKET = 'chat-images';
  var PHOTO_MAX_PX = 1600;
  var COLUMNS = 'id, room_id, user_id, display_name, content, image_path, created_at';

  // Top-level duration formatter used by voice note players and message rendering
  function formatDuration(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var ui = {
    join: $('join'), joinForm: $('join-form'), nameInput: $('name-input'),
    joinBtn: $('join-btn'), joinError: $('join-error'),
    // Side-by-Side Room Picker
    roomPicker: $('room-picker'), generalBtn: $('general-btn'),
    joinRoomForm: $('join-room-form'), roomIdInput: $('room-id-input'),
    roomKeyInput: $('room-key-input'), roomJoinError: $('room-join-error'),
    roomJoinBtn: $('room-join-btn'),
    createRoomForm: $('create-room-form'), newRoomId: $('new-room-id'),
    newRoomName: $('new-room-name'), newRoomKey: $('new-room-key'),
    createRoomError: $('create-room-error'), createRoomBtn: $('create-room-btn'),
    roomBackBtn: $('room-back-btn'),
    toggleJoinFormBtn: $('toggle-join-form-btn'),
    toggleCreateFormBtn: $('toggle-create-form-btn'),
    closeJoinFormBtn: $('close-join-form-btn'),
    closeCreateFormBtn: $('close-create-form-btn'),
    colJoin: $('col-join'), colCreate: $('col-create'),
    // Dynamic Island In-App Banner
    banner: $('in-app-banner'), bannerPill: $('banner-pill-btn'),
    bannerAvatar: $('banner-avatar'), bannerSender: $('banner-sender'), bannerText: $('banner-text'),
    // Chat Header & Controls
    chat: $('chat'), setup: $('setup'), roomName: $('room-name'), e2eeBadge: $('e2ee-badge'),
    online: $('online'), onlineCount: $('online-count'), onlineList: $('online-list'),
    conn: $('conn'), copyBtn: $('copy-btn'), roomsBtn: $('rooms-btn'),
    callBtn: $('call-btn'),
    callIncomingBanner: $('call-incoming-banner'),
    callIncomingAvatar: $('call-incoming-avatar'),
    callIncomingCaller: $('call-incoming-caller'),
    callAcceptBtn: $('call-accept-btn'),
    callDeclineBtn: $('call-decline-btn'),
    callActiveBar: $('call-active-bar'),
    callActiveName: $('call-active-name'),
    callActiveTimer: $('call-active-timer'),
    callMuteBtn: $('call-mute-btn'),
    callMicIcon: $('call-mic-icon'),
    callHangupBtn: $('call-hangup-btn'),
    remoteAudio: $('remote-audio'),
    deleteCurrentRoomBtn: $('delete-current-room-btn'),
    clearBtn: $('clear-btn'), clearModal: $('clear-modal'),
    clearConfirmBtn: $('clear-confirm-btn'), clearCancelBtn: $('clear-cancel-btn'),
    themeBtn: $('theme-btn'), themeIcon: $('theme-icon'),
    notifBtn: $('notif-btn'), notifDot: $('notif-status-dot'),
    leaveBtn: $('leave-btn'),
    panicBtn: $('panic-btn'),
    // Mobile More Menu
    headerMoreBtn: $('header-more-btn'),
    headerMoreMenu: $('header-more-menu'),
    menuCopyBtn: $('menu-copy-btn'),
    menuQrBtn: $('menu-qr-btn'),
    menuNotifBtn: $('menu-notif-btn'),
    menuNotifIcon: $('menu-notif-icon'),
    menuNotifLabel: $('menu-notif-label'),
    menuThemeBtn: $('menu-theme-btn'),
    menuThemeIcon: $('menu-theme-icon'),
    menuThemeLabel: $('menu-theme-label'),
    menuClearBtn: $('menu-clear-btn'),
    menuPanicBtn: $('menu-panic-btn'),
    menuDeleteRoomBtn: $('menu-delete-room-btn'),
    menuLeaveBtn: $('menu-leave-btn'),
    privacyShield: $('privacy-shield'),
    privacyShieldTitle: $('privacy-shield-title'),
    privacyShieldDesc: $('privacy-shield-desc'),
    privacyUnlockForm: $('privacy-unlock-form'),
    privacyKeyGroup: $('privacy-key-group'),
    privacyKeyInput: $('privacy-key-input'),
    privacyKeyError: $('privacy-key-error'),
    privacyUnlockBtn: $('privacy-unlock-btn'),
    privacyExitBtn: $('privacy-exit-btn'),
    // QR Code Modal
    qrBtn: $('qr-btn'), qrModal: $('qr-modal'), qrContainer: $('qr-container'),
    qrRoomName: $('qr-room-name'), qrRoomId: $('qr-room-id'), qrCopyBtn: $('qr-copy-btn'), qrCloseBtn: $('qr-close-btn'),
    // Mesh Network & Arena
    meshBtn: $('mesh-btn'),
    menuMeshBtn: $('menu-mesh-btn'), menuArenaBtn: $('menu-arena-btn'),
    meshPill: $('mesh-pill'), meshStatusText: $('mesh-status-text'),
    meshModal: $('mesh-modal'), meshTabQr: $('mesh-tab-qr'), meshTabScan: $('mesh-tab-scan'), meshTabManual: $('mesh-tab-manual'),
    meshViewQr: $('mesh-view-qr'), meshViewScan: $('mesh-view-scan'), meshViewManual: $('mesh-view-manual'),
    meshQrTarget: $('mesh-qr-target'), meshCopyOfferBtn: $('mesh-copy-offer-btn'),
    meshCameraFeed: $('mesh-camera-feed'), meshCameraCanvas: $('mesh-camera-canvas'),
    meshScanStatusText: $('mesh-scan-status-text'), meshToggleCameraBtn: $('mesh-toggle-camera-btn'),
    meshManualInput: $('mesh-manual-input'), meshConnectManualBtn: $('mesh-connect-manual-btn'),
    meshPeersCount: $('mesh-peers-count'), meshCloseBtn: $('mesh-close-btn'),
    arenaModal: $('arena-modal'), arenaTabHockey: $('arena-tab-hockey'), arenaTabChess: $('arena-tab-chess'), arenaTabSnake: $('arena-tab-snake'),
    arenaCanvas: $('arena-canvas'), chessBoardWrap: $('chess-board-wrap'), arenaRestartBtn: $('arena-restart-btn'), arenaInviteBtn: $('arena-invite-btn'), arenaCloseBtn: $('arena-close-btn'),
    // Video Call PIP & Advanced Voice Call Controls
    callWaveVisualizer: $('call-wave-visualizer'),
    callBookmarkBtn: $('call-bookmark-btn'), callDrawBtn: $('call-draw-btn'),
    callHudBtn: $('call-hud-btn'), callHudDrawer: $('call-hud-drawer'), callHudClose: $('call-hud-close'),
    callSafetyEmojis: $('call-safety-emojis'), hudRtt: $('hud-rtt'), hudLoss: $('hud-loss'),
    hudJitter: $('hud-jitter'), hudBitrate: $('hud-bitrate'), callLowdataBtn: $('call-lowdata-btn'),
    callTelestrator: $('call-telestrator'), telestratorCanvas: $('telestrator-canvas'),
    telestratorPenBtn: $('telestrator-pen-btn'), telestratorLaserBtn: $('telestrator-laser-btn'),
    telestratorClearBtn: $('telestrator-clear-btn'), telestratorCloseBtn: $('telestrator-close-btn'),
    callVideoBtn: $('call-video-btn'), callVideoIcon: $('call-video-icon'), callScreenBtn: $('call-screen-btn'),
    callVideoContainer: $('call-video-container'), remoteVideo: $('remote-video'), localVideo: $('local-video'), videoPipCloseBtn: $('video-pip-close-btn'),
    // Voice Notes & Replies
    voiceRecordBtn: $('voice-record-btn'), voiceRecordingBar: $('voice-recording-bar'), voiceTimer: $('voice-timer'),
    voiceCancelBtn: $('voice-cancel-btn'), voiceSendBtn: $('voice-send-btn'), msgInputWrap: $('msg-input-wrap'),
    replyPreviewBar: $('reply-preview-bar'), replyToName: $('reply-to-name'), replyToSnippet: $('reply-to-snippet'), replyCancelBtn: $('reply-cancel-btn'),
    // Room Views & Apple Dropdown
    viewDropdownBtn: $('view-dropdown-btn'),
    viewTilesBtn: $('view-tiles-btn'),
    roomsDropdownView: $('rooms-dropdown-view'),
    roomsTilesView: $('rooms-tiles-view'),
    dropdownTriggerBtn: $('dropdown-trigger-btn'),
    dropdownTriggerAvatar: $('dropdown-trigger-avatar'),
    dropdownTriggerName: $('dropdown-trigger-name'),
    dropdownTriggerSub: $('dropdown-trigger-sub'),
    dropdownPopover: $('dropdown-popover'),
    dropdownItemsList: $('dropdown-items-list'),
    dropdownEnterBtn: $('dropdown-enter-btn'),
    dropdownDeleteBtn: $('dropdown-delete-btn'),
    // Delete Room Modal
    deleteRoomModal: $('delete-room-modal'),
    deleteRoomTitle: $('delete-room-title'),
    deleteRoomDesc: $('delete-room-desc'),
    deleteRoomForm: $('delete-room-form'),
    deleteKeyGroup: $('delete-key-group'),
    deleteRoomKeyInput: $('delete-room-key-input'),
    deleteRoomError: $('delete-room-error'),
    deleteRoomConfirmBtn: $('delete-room-confirm-btn'),
    deleteRoomCancelBtn: $('delete-room-cancel-btn'),
    // Messages
    messages: $('messages'), olderBtn: $('older-btn'), status: $('status'), feed: $('feed'),
    composer: $('composer'), input: $('msg-input'), sendBtn: $('send-btn'), counter: $('counter'),
    attachBtn: $('attach-btn'), fileInput: $('file-input'),
    attachSheet: $('attach-action-sheet'), attachPhotoItem: $('attach-photo-item'), attachCapsuleItem: $('attach-capsule-item'),
    feelBar: $('feel-bar'), feelChip: $('feel-chip'), feelMenu: $('feel-menu'),
    typingIndicator: $('typing-indicator'), typingName: $('typing-name'),
    toast: $('toast'),
  };

  var sb = null;

  // ---------- State ----------
  var state = {
    clientId: uuid(),
    user: null,
    name: '',
    room: DEFAULT_ROOM,
    roomDisplayName: DEFAULT_ROOM_NAME,
    roomKey: '',
    replyingTo: null,    // { id: string, author: string, text: string }
    clearedAt: 0,        // timestamp before which messages are hidden locally
    cryptoKey: null,     // AES-256-GCM derived key for private room E2EE
    lastReadAckTs: 0,    // highest timestamp acknowledged by active peers
    peerCount: 0,        // number of participants currently active in room
    msgs: new Map(),
    oldestRaw: null,
    hasMore: false,
    loadingOlder: false,
    ready: false,
    buffer: [],
    channel: null,
    everSubscribed: false,
    seq: 0,
  };

  // ---------- Storage Helpers ----------
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) {}
  }
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }

  // =========================================================================
  // Web Crypto API — Zero-Knowledge End-to-End Encryption (AES-256-GCM)
  // =========================================================================
  var decryptedCache = new Map();

  var E2EE = (function () {
    var PREFIX = 'enc:v1:';
    var cachedKeys = new Map(); // "roomId::key" -> CryptoKey

    function isSupported() {
      return Boolean(window.crypto && window.crypto.subtle);
    }

    function toB64(buf) {
      var bin = '';
      var bytes = new Uint8Array(buf);
      for (var i = 0; i < bytes.byteLength; i++) {
        bin += String.fromCharCode(bytes[i]);
      }
      return btoa(bin);
    }

    function fromB64(str) {
      var bin = atob(str);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
      }
      return bytes;
    }

    async function deriveRoomKey(roomId, accessKey) {
      if (!isSupported() || !accessKey || !roomId) return null;
      var cacheKey = roomId + '::' + accessKey;
      if (cachedKeys.has(cacheKey)) return cachedKeys.get(cacheKey);

      try {
        var enc = new TextEncoder();
        var keyMaterial = await window.crypto.subtle.importKey(
          'raw',
          enc.encode(accessKey),
          'PBKDF2',
          false,
          ['deriveKey']
        );

        var salt = enc.encode('linkchat-e2ee-salt-' + roomId);
        var derivedKey = await window.crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );

        cachedKeys.set(cacheKey, derivedKey);
        return derivedKey;
      } catch (e) {
        console.warn('E2EE key derivation error:', e);
        return null;
      }
    }

    async function encryptText(cryptoKey, text) {
      if (!cryptoKey || !text) return text;
      try {
        var enc = new TextEncoder();
        var iv = window.crypto.getRandomValues(new Uint8Array(12));
        var cipherBuf = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv },
          cryptoKey,
          enc.encode(text)
        );
        return PREFIX + toB64(iv) + ':' + toB64(cipherBuf);
      } catch (e) {
        console.warn('E2EE encrypt error:', e);
        return text;
      }
    }

    async function decryptText(cryptoKey, raw) {
      if (!raw || typeof raw !== 'string') return raw;
      if (!raw.startsWith(PREFIX)) return raw;
      if (!cryptoKey) return '🔒 [Encrypted Message]';

      try {
        var parts = raw.slice(PREFIX.length).split(':');
        if (parts.length !== 2) return '🔒 [Corrupted Encrypted Message]';
        var iv = fromB64(parts[0]);
        var cipherData = fromB64(parts[1]);

        var decBuf = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv },
          cryptoKey,
          cipherData
        );
        return new TextDecoder().decode(decBuf);
      } catch (e) {
        return '🔒 [Unable to decrypt message]';
      }
    }

    return {
      isSupported: isSupported,
      deriveRoomKey: deriveRoomKey,
      encryptText: encryptText,
      decryptText: decryptText,
      isEncrypted: function (str) {
        return typeof str === 'string' && str.startsWith(PREFIX);
      }
    };
  })();

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('show'); }, 2600);
  }

  function nameColor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 60% var(--name-l))';
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayLabel(ts) {
    var d = new Date(ts), today = new Date(), yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function friendlyError(err) {
    var msg = (err && err.message) || String(err || 'Unknown error');
    if (/anonymous sign-ins are disabled/i.test(msg)) return 'Anonymous sign-in is disabled in Supabase.';
    if (/failed to fetch|network/i.test(msg)) return 'Network connection issue. Please check your signal.';
    if (/bucket not found/i.test(msg)) return 'Photo storage bucket is missing in Supabase.';
    if (/row-level security|permission denied/i.test(msg)) return 'Access restricted by database policy.';
    return msg;
  }

  // ---------- Apple Audio & Haptics Synthesizer (§13) ----------
  var audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      try {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playReceiveSound() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;

      var osc1 = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      var gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.12);
      osc2.frequency.setValueAtTime(1320, now);
      osc2.frequency.exponentialRampToValueAtTime(2640, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.36);
      osc2.stop(now + 0.36);

      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([12]);
      }
    } catch (e) {}
  }

  function playSendSound() {
    try {
      var ctx = getAudioContext();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.08);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // ---------- Apple Theme Management ----------
  function currentTheme() {
    var t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateThemeIcon(t) {
    if (ui.themeIcon) {
      if (t === 'dark') {
        ui.themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
      } else {
        ui.themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
      }
    }
    if (ui.menuThemeIcon && ui.menuThemeLabel) {
      if (t === 'dark') {
        ui.menuThemeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        ui.menuThemeLabel.textContent = 'Light Appearance';
      } else {
        ui.menuThemeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        ui.menuThemeLabel.textContent = 'Dark Appearance';
      }
    }
  }

  ui.themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store(THEME_KEY, next);
    updateThemeIcon(next);
  });
  updateThemeIcon(currentTheme());

  function unlockAudio() {
    try {
      var ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }
    } catch (e) {}
  }
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });

  // ---------- Message Notifications System ----------
  var unreadCount = 0;

  // Register Service Worker for Mobile (Android Chrome) & Desktop notification support
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(function (e) {
      console.warn('SW register error:', e);
    });
  }

  function updateNotifButtonUI() {
    if (!ui.notifDot) return;
    if (!('Notification' in window)) {
      ui.notifBtn.hidden = false;
      ui.notifDot.className = 'status-dot muted';
      ui.notifBtn.title = 'Web notifications not supported in this browser';
      if (ui.menuNotifLabel) ui.menuNotifLabel.textContent = 'Notifications (Unsupported)';
      return;
    }
    if (Notification.permission === 'granted') {
      ui.notifDot.className = 'status-dot active';
      ui.notifBtn.title = 'Notifications enabled (Click to test)';
      if (ui.menuNotifLabel) ui.menuNotifLabel.textContent = 'Notifications (Active)';
    } else if (Notification.permission === 'denied') {
      ui.notifDot.className = 'status-dot muted';
      ui.notifBtn.title = 'Notifications blocked (Enable in browser site permissions)';
      if (ui.menuNotifLabel) ui.menuNotifLabel.textContent = 'Notifications (Blocked)';
    } else {
      ui.notifDot.className = 'status-dot';
      ui.notifBtn.title = 'Click to enable notifications';
      if (ui.menuNotifLabel) ui.menuNotifLabel.textContent = 'Enable Notifications';
    }
  }

  async function sendSystemNotification(title, options) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      // 1. Android Chrome requires ServiceWorkerRegistration.showNotification()
      if ('serviceWorker' in navigator) {
        try {
          var reg = await navigator.serviceWorker.getRegistration();
          if (reg && reg.showNotification) {
            await reg.showNotification(title, options);
            return;
          }
        } catch (e) {}
      }
      // 2. Standard desktop Notification
      var n = new Notification(title, options);
      n.onclick = function () {
        window.focus();
        n.close();
      };
    } catch (err) {
      console.warn('System notification error:', err);
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      toast('Notifications are not supported in this browser.');
      return;
    }

    if (Notification.permission === 'granted') {
      playReceiveSound();
      toast('Notifications active! Sent a test ping 🔔');
      sendSystemNotification('LinkChat', {
        body: 'Notifications are active and working!',
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%23007aff"/%3E%3Cpath d="M7 8.5h10M7 12.5h6" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
        tag: 'linkchat-test'
      });
      showInAppBanner('LinkChat', 'Notifications are active and working! 🔔');
      return;
    }

    if (Notification.permission === 'denied') {
      toast('Notifications blocked. Click the lock icon in address bar to allow.');
      return;
    }

    try {
      var perm = await new Promise(function (resolve) {
        try {
          var p = Notification.requestPermission(function (result) {
            resolve(result || Notification.permission);
          });
          if (p && typeof p.then === 'function') {
            p.then(function (result) {
              resolve(result || Notification.permission);
            });
          }
        } catch (e) {
          resolve(Notification.permission);
        }
      });

      updateNotifButtonUI();

      if (perm === 'granted' || Notification.permission === 'granted') {
        toast('Notifications enabled! 🎉');
        playReceiveSound();
        sendSystemNotification('LinkChat', {
          body: 'Notifications are now active for ' + (state.roomDisplayName || 'chat') + '!',
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%23007aff"/%3E%3Cpath d="M7 8.5h10M7 12.5h6" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
          tag: 'linkchat-welcome'
        });
        showInAppBanner('LinkChat', 'Notifications enabled! 🎉');
      } else {
        toast('Notification permission was not granted.');
      }
    } catch (e) {
      console.warn('requestNotificationPermission error:', e);
    }
  }

  if (ui.notifBtn) {
    ui.notifBtn.addEventListener('click', requestNotificationPermission);
    updateNotifButtonUI();
  }

  // In-App Dynamic Island Notification Banner
  var bannerTimer = null;
  function showInAppBanner(displayName, text) {
    if (!ui.banner) return;
    ui.bannerSender.textContent = displayName || 'User';
    ui.bannerText.textContent = text || 'Sent a photo';
    ui.bannerAvatar.textContent = (displayName && displayName[0] ? displayName[0].toUpperCase() : '💬');

    ui.banner.classList.remove('banner-pop');
    void ui.banner.offsetWidth; // trigger CSS animation reflow
    ui.banner.classList.add('banner-pop');
    ui.banner.hidden = false;

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      ui.banner.hidden = true;
    }, 4500);
  }

  if (ui.bannerPill) {
    ui.bannerPill.addEventListener('click', function () {
      ui.banner.hidden = true;
      if (ui.chat && ui.chat.hidden) {
        show('chat');
      }
      scrollToBottom();
    });
  }

  async function notifyIncomingMessage(displayName, rawContent) {
    playReceiveSound();

    var plainText = rawContent || '';
    if (E2EE.isEncrypted(rawContent)) {
      if (decryptedCache.has(rawContent)) {
        plainText = decryptedCache.get(rawContent);
      } else if (state.cryptoKey) {
        try {
          plainText = await E2EE.decryptText(state.cryptoKey, rawContent);
          decryptedCache.set(rawContent, plainText);
        } catch (e) {
          plainText = '🔒 [Encrypted Message]';
        }
      } else {
        plainText = '🔒 [Encrypted Message]';
      }
    }

    // Don't show the internal feeling tag in the notification text
    if (window.Feelings) plainText = window.Feelings.decode(plainText).rest;
    if (window.Capsules) {
      var capMeta = window.Capsules.decode(plainText);
      if (capMeta) {
        plainText = capMeta.kind === 'time' ? '⏳ Sent a Time Capsule' : '📍 Sent a Place Message';
      }
    }

    var bodyText = plainText || 'Sent a photo';

    // Check if the chat tab is unfocused or hidden (e.g. user in another window, app, or tab)
    var isUnfocused = document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus());

    if (isUnfocused) {
      unreadCount++;
      document.title = '(' + unreadCount + ') LinkChat';

      sendSystemNotification(displayName + ' (' + (state.roomDisplayName || state.room) + ')', {
        body: bodyText,
        icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%23007aff"/%3E%3Cpath d="M7 8.5h10M7 12.5h6" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
        badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%23007aff"/%3E%3Cpath d="M7 8.5h10M7 12.5h6" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
        tag: 'linkchat-' + state.room,
        renotify: true,
      });
    }

    // Always show the in-app Dynamic Island banner if user is unfocused or not scrolled to bottom
    if (isUnfocused || !nearBottom()) {
      showInAppBanner(displayName, bodyText);
    }
  }

  window.addEventListener('focus', function () {
    unreadCount = 0;
    document.title = 'LinkChat';
  });

  // =========================================================================
  // Apple WebRTC Voice Calling Engine
  // =========================================================================
  var CallManager = (function () {
    var stateCall = 'IDLE'; // 'IDLE' | 'OUTGOING' | 'INCOMING' | 'CONNECTED'
    var activeCallId = null;
    var peerId = null;
    var peerName = '';
    var pc = null;
    var localStream = null;
    var localVideoTrack = null;
    var isVideoActive = false;
    var isMuted = false;
    var timerInterval = null;
    var callStartTs = 0;
    var autoCancelTimer = null;
    var candidateQueue = [];
    var ringInterval = null;

    var rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    function startOutgoingRing() {
      stopRingtone();
      function playDoubleBeep() {
        try {
          var ctx = getAudioContext();
          if (!ctx) return;
          var now = ctx.currentTime;
          var osc1 = ctx.createOscillator();
          var osc2 = ctx.createOscillator();
          var gain = ctx.createGain();

          osc1.type = 'sine'; osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.08, now + 0.05);
          gain.gain.setValueAtTime(0.08, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now); osc2.start(now);
          osc1.stop(now + 1.35); osc2.stop(now + 1.35);
        } catch (e) {}
      }
      playDoubleBeep();
      ringInterval = setInterval(playDoubleBeep, 3500);
    }

    function startIncomingRing() {
      stopRingtone();
      function playChime() {
        try {
          var ctx = getAudioContext();
          if (!ctx) return;
          var now = ctx.currentTime;
          var notes = [587.33, 739.99, 880, 1174.66]; // D5, F#5, A5, D6
          notes.forEach(function (freq, i) {
            var osc = ctx.createOscillator();
            var gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.001, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.09, now + i * 0.12 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.38);
          });
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 1000]);
        } catch (e) {}
      }
      playChime();
      ringInterval = setInterval(playChime, 2600);
    }

    function playEndChime() {
      stopRingtone();
      try {
        var ctx = getAudioContext();
        if (!ctx) return;
        var now = ctx.currentTime;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(260, now + 0.22);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
        if (navigator.vibrate) navigator.vibrate([80]);
      } catch (e) {}
    }

    function stopRingtone() {
      if (ringInterval) {
        clearInterval(ringInterval);
        ringInterval = null;
      }
    }

    function formatDuration(sec) {
      var m = Math.floor(sec / 60);
      var s = sec % 60;
      return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }

    function startCallTimer() {
      stopCallTimer();
      callStartTs = Date.now();
      if (ui.callActiveTimer) ui.callActiveTimer.textContent = '00:00';
      timerInterval = setInterval(function () {
        var elapsed = Math.floor((Date.now() - callStartTs) / 1000);
        if (ui.callActiveTimer) ui.callActiveTimer.textContent = formatDuration(elapsed);
      }, 1000);
    }

    function stopCallTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }

    var callBookmarks = [];
    var dtlsSafetyEmojis = '🛡️ 🔒 ⚡ 💎';
    var isLowDataMode = false;
    var statsInterval = null;
    var waveAudioCtx = null;
    var waveAnalyser = null;
    var waveAnimFrame = null;
    var telestratorMode = 'pen';

    function hashCode(str) {
      var hash = 0;
      for (var i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    function generateDtlsSafetyCode() {
      try {
        var sdp = (pc && pc.localDescription ? pc.localDescription.sdp : '') + (pc && pc.remoteDescription ? pc.remoteDescription.sdp : '');
        var match = sdp.match(/a=fingerprint:sha-256\s+([0-9A-Fa-f:]+)/g);
        var raw = match ? match.join('') : (activeCallId || 'linkchat-voice');
        var emojiList = ['🛡️', '💎', '⚡', '🔑', '🚀', '🌟', '🔮', '🍀', '🌈', '🔥', '🌊', '👑'];
        var h1 = Math.abs(hashCode(raw)) % emojiList.length;
        var h2 = Math.abs(hashCode(raw + '2')) % emojiList.length;
        var h3 = Math.abs(hashCode(raw + '3')) % emojiList.length;
        var h4 = Math.abs(hashCode(raw + '4')) % emojiList.length;
        dtlsSafetyEmojis = emojiList[h1] + ' ' + emojiList[h2] + ' ' + emojiList[h3] + ' ' + emojiList[h4];
        if (ui.callSafetyEmojis) ui.callSafetyEmojis.textContent = dtlsSafetyEmojis;
      } catch (e) {}
    }

    function startAudioVisualizer(stream) {
      stopAudioVisualizer();
      try {
        waveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        waveAnalyser = waveAudioCtx.createAnalyser();
        waveAnalyser.fftSize = 32;
        var source = waveAudioCtx.createMediaStreamSource(stream);
        source.connect(waveAnalyser);

        var dataArray = new Uint8Array(waveAnalyser.frequencyBinCount);
        var waveBars = document.querySelectorAll('#call-wave-visualizer .wave-bar');

        function renderWave() {
          if (!waveAnalyser) return;
          waveAnalyser.getByteFrequencyData(dataArray);
          var avg = 0;
          for (var i = 0; i < dataArray.length; i++) avg += dataArray[i];
          avg = avg / dataArray.length;

          waveBars.forEach(function (bar, idx) {
            var val = dataArray[idx * 2] || avg;
            var height = Math.max(3, Math.min(16, (val / 255) * 22));
            bar.style.height = height + 'px';
          });
          waveAnimFrame = requestAnimationFrame(renderWave);
        }
        waveAnimFrame = requestAnimationFrame(renderWave);
      } catch (e) {}
    }

    function stopAudioVisualizer() {
      if (waveAnimFrame) {
        cancelAnimationFrame(waveAnimFrame);
        waveAnimFrame = null;
      }
      if (waveAudioCtx) {
        try { waveAudioCtx.close(); } catch (e) {}
        waveAudioCtx = null;
        waveAnalyser = null;
      }
    }

    function startStatsPolling() {
      stopStatsPolling();
      statsInterval = setInterval(async function () {
        if (!pc || stateCall !== 'CONNECTED') return;
        try {
          var stats = await pc.getStats();
          stats.forEach(function (report) {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                var rttMs = Math.round(report.currentRoundTripTime * 1000);
                if (ui.hudRtt) ui.hudRtt.textContent = rttMs + ' ms';
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'audio') {
              if (report.jitter !== undefined) {
                var jitterMs = Math.round(report.jitter * 1000);
                if (ui.hudJitter) ui.hudJitter.textContent = jitterMs + ' ms';
              }
              if (report.packetsLost !== undefined && report.packetsReceived) {
                var total = report.packetsLost + report.packetsReceived;
                var lossPct = ((report.packetsLost / total) * 100).toFixed(1);
                if (ui.hudLoss) ui.hudLoss.textContent = lossPct + '%';
              }
              if (report.bytesReceived !== undefined) {
                var elapsedSec = Math.max(1, (Date.now() - (callStartTs || Date.now())) / 1000);
                var kbps = Math.round((report.bytesReceived * 8) / 1024 / elapsedSec);
                if (ui.hudBitrate) ui.hudBitrate.textContent = (kbps > 0 ? kbps : 36) + ' kbps';
              }
            }
          });
        } catch (e) {}
      }, 1500);
    }

    function stopStatsPolling() {
      if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
    }

    function toggleCallHud() {
      if (!ui.callHudDrawer) return;
      ui.callHudDrawer.hidden = !ui.callHudDrawer.hidden;
      if (!ui.callHudDrawer.hidden) generateDtlsSafetyCode();
    }

    function closeCallHud() {
      if (ui.callHudDrawer) ui.callHudDrawer.hidden = true;
    }

    function toggleLowDataMode() {
      isLowDataMode = !isLowDataMode;
      if (ui.callLowdataBtn) {
        ui.callLowdataBtn.classList.toggle('active', isLowDataMode);
        ui.callLowdataBtn.textContent = isLowDataMode ? '⚡ Low-Data Mode: ON (8kbps)' : '⚡ Low-Data Mode: OFF';
      }
      if (pc) {
        var senders = pc.getSenders();
        var audioSender = senders.find(function (s) { return s.track && s.track.kind === 'audio'; });
        if (audioSender && audioSender.getParameters) {
          try {
            var params = audioSender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = isLowDataMode ? 8000 : 64000;
            audioSender.setParameters(params);
            toast(isLowDataMode ? 'Switched to Low-Bandwidth Mode (8kbps FEC)' : 'Switched to HD Opus Audio (64kbps)');
          } catch (e) {}
        }
      }
    }

    function addCallBookmark() {
      if (stateCall !== 'CONNECTED' && !callStartTs) {
        toast('Start or answer a call to bookmark moments.');
        return;
      }
      var elapsed = Math.floor((Date.now() - (callStartTs || Date.now())) / 1000);
      var timeStr = formatDuration(elapsed);
      var note = prompt('Bookmark discussion moment at ' + timeStr + ':', 'Important Note');
      if (note !== null) {
        callBookmarks.push({ time: timeStr, note: note.trim() || 'Pinned Moment' });
        playSendSound();
        toast('📌 Moment pinned at ' + timeStr);
      }
    }

    // ---------- In-Call Collaborative Telestrator ----------
    function initTelestratorCanvas() {
      if (!ui.telestratorCanvas) return;
      var canvas = ui.telestratorCanvas;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      var ctx = canvas.getContext('2d');
      var drawing = false;
      var lastX = 0, lastY = 0;

      function drawLine(x0, y0, x1, y1, color, broadcast) {
        ctx.strokeStyle = color || '#007aff';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.shadowColor = color || '#007aff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (broadcast && state.channel && activeCallId) {
          try {
            state.channel.send({
              type: 'broadcast',
              event: 'call_draw',
              payload: { x0: x0 / canvas.width, y0: y0 / canvas.height, x1: x1 / canvas.width, y1: y1 / canvas.height, color: color }
            });
          } catch (e) {}
        }
      }

      canvas.onpointerdown = function (e) {
        drawing = true;
        lastX = e.clientX;
        lastY = e.clientY;
      };
      canvas.onpointermove = function (e) {
        if (!drawing) return;
        var color = telestratorMode === 'laser' ? '#ff3b30' : '#007aff';
        drawLine(lastX, lastY, e.clientX, e.clientY, color, true);
        lastX = e.clientX;
        lastY = e.clientY;
      };
      canvas.onpointerup = function () { drawing = false; };
      canvas.onpointercancel = function () { drawing = false; };
    }

    function handleIncomingDraw(payload) {
      if (!ui.telestratorCanvas || !payload) return;
      var canvas = ui.telestratorCanvas;
      var ctx = canvas.getContext('2d');
      var x0 = payload.x0 * canvas.width, y0 = payload.y0 * canvas.height;
      var x1 = payload.x1 * canvas.width, y1 = payload.y1 * canvas.height;
      ctx.strokeStyle = payload.color || '#34c759';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = payload.color || '#34c759';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    function openTelestrator() {
      if (!ui.callTelestrator) return;
      ui.callTelestrator.hidden = false;
      initTelestratorCanvas();
      toast('🖊️ Telestrator active: Draw or point on screen');
    }

    function closeTelestrator() {
      if (ui.callTelestrator) ui.callTelestrator.hidden = true;
    }

    function clearTelestrator() {
      if (!ui.telestratorCanvas) return;
      var ctx = ui.telestratorCanvas.getContext('2d');
      ctx.clearRect(0, 0, ui.telestratorCanvas.width, ui.telestratorCanvas.height);
    }

    function cleanupMedia() {
      stopStatsPolling();
      stopAudioVisualizer();
      closeTelestrator();
      if (ui.callHudDrawer) ui.callHudDrawer.hidden = true;
      if (localStream) {
        localStream.getTracks().forEach(function (t) {
          try { t.stop(); } catch (e) {}
        });
        localStream = null;
      }
      if (localVideoTrack) {
        try { localVideoTrack.stop(); } catch (e) {}
        localVideoTrack = null;
      }
      if (pc) {
        try { pc.close(); } catch (e) {}
        pc = null;
      }
      if (ui.remoteAudio) {
        ui.remoteAudio.srcObject = null;
      }
      if (ui.remoteVideo) {
        ui.remoteVideo.srcObject = null;
      }
      if (ui.localVideo) {
        ui.localVideo.srcObject = null;
      }
      if (ui.callVideoContainer) {
        ui.callVideoContainer.hidden = true;
      }
      if (ui.callVideoBtn) {
        ui.callVideoBtn.classList.remove('active');
      }
      isVideoActive = false;
      candidateQueue = [];
      isMuted = false;
      updateMuteUI();
    }

    function updateMuteUI() {
      if (!ui.callMuteBtn) return;
      ui.callMuteBtn.classList.toggle('muted', isMuted);
      ui.callMuteBtn.title = isMuted ? 'Unmute microphone' : 'Mute microphone';
      if (ui.callMicIcon) {
        if (isMuted) {
          ui.callMicIcon.innerHTML =
            '<line x1="1" y1="1" x2="23" y2="23"></line>' +
            '<path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>' +
            '<path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>' +
            '<line x1="12" y1="19" x2="12" y2="23"></line>' +
            '<line x1="8" y1="23" x2="16" y2="23"></line>';
        } else {
          ui.callMicIcon.innerHTML =
            '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>' +
            '<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>' +
            '<line x1="12" y1="19" x2="12" y2="23"></line>' +
            '<line x1="8" y1="23" x2="16" y2="23"></line>';
        }
      }
    }

    function toggleMute() {
      if (!localStream) return;
      var audioTracks = localStream.getAudioTracks();
      if (!audioTracks.length) return;
      isMuted = !isMuted;
      audioTracks[0].enabled = !isMuted;
      updateMuteUI();
      toast(isMuted ? 'Microphone muted 🔇' : 'Microphone unmuted 🎙️');
    }

    // ---------- Start Outgoing Call ----------
    async function startCall() {
      if (stateCall !== 'IDLE') {
        toast('Already in a call or connecting.');
        return;
      }
      if (!state.room || !state.user) {
        toast('Join a room to start a call.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Voice calls require microphone support (HTTPS or localhost).');
        return;
      }

      try {
        unlockAudio();
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } catch (err) {
        toast('Microphone access was denied. Allow mic in browser settings.');
        return;
      }

      stateCall = 'OUTGOING';
      activeCallId = uuid();
      peerId = null;
      peerName = '';

      if (ui.callActiveBar) ui.callActiveBar.hidden = false;
      if (ui.callActiveName) ui.callActiveName.textContent = 'Calling ' + (state.roomDisplayName || state.room) + '…';
      if (ui.callActiveTimer) ui.callActiveTimer.textContent = 'Ringing…';

      startOutgoingRing();

      try {
        if (state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_invite',
            payload: {
              callId: activeCallId,
              callerId: state.user.id,
              callerName: state.name,
              roomId: state.room
            }
          });
        }
      } catch (e) {
        console.warn('Call invite broadcast error:', e);
      }

      clearTimeout(autoCancelTimer);
      autoCancelTimer = setTimeout(function () {
        if (stateCall === 'OUTGOING') {
          toast('No answer.');
          endCall(true);
        }
      }, 45000);
    }

    // ---------- Incoming Call Handler ----------
    function handleIncomingInvite(payload) {
      if (!payload || !payload.callId || !payload.callerId) return;
      if (payload.callerId === (state.user && state.user.id)) return;
      if (payload.roomId !== state.room) return;

      if (stateCall !== 'IDLE') {
        return;
      }

      stateCall = 'INCOMING';
      activeCallId = payload.callId;
      peerId = payload.callerId;
      peerName = payload.callerName || 'Someone';

      if (ui.callIncomingCaller) ui.callIncomingCaller.textContent = peerName;
      if (ui.callIncomingAvatar) ui.callIncomingAvatar.textContent = peerName.charAt(0).toUpperCase() || '📞';
      if (ui.callIncomingBanner) ui.callIncomingBanner.hidden = false;

      startIncomingRing();

      if (document.hidden || (typeof document.hasFocus === 'function' && !document.hasFocus())) {
        sendSystemNotification('Incoming Voice Call 📞', {
          body: peerName + ' is calling in ' + (state.roomDisplayName || 'chat'),
          tag: 'call-' + activeCallId,
          requireInteraction: true
        });
      }

      clearTimeout(autoCancelTimer);
      autoCancelTimer = setTimeout(function () {
        if (stateCall === 'INCOMING') {
          hideIncomingUI();
          stopRingtone();
          stateCall = 'IDLE';
        }
      }, 45000);
    }

    function hideIncomingUI() {
      if (ui.callIncomingBanner) ui.callIncomingBanner.hidden = true;
    }

    // ---------- Accept Call (Callee) ----------
    async function acceptCall() {
      if (stateCall !== 'INCOMING') return;
      stopRingtone();
      hideIncomingUI();
      clearTimeout(autoCancelTimer);

      try {
        unlockAudio();
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
      } catch (err) {
        toast('Microphone access denied. Could not answer call.');
        declineCall();
        return;
      }

      stateCall = 'CONNECTED';
      if (ui.callActiveBar) ui.callActiveBar.hidden = false;
      if (ui.callActiveName) ui.callActiveName.textContent = peerName;
      if (ui.callActiveTimer) ui.callActiveTimer.textContent = 'Connecting…';

      setupPeerConnection();

      try {
        if (state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_accept',
            payload: {
              callId: activeCallId,
              calleeId: state.user.id,
              calleeName: state.name,
              callerId: peerId
            }
          });
        }
      } catch (e) {}
    }

    // ---------- Decline Call (Callee) ----------
    function declineCall() {
      if (stateCall !== 'INCOMING') return;
      stopRingtone();
      hideIncomingUI();
      clearTimeout(autoCancelTimer);

      var rejectedCallId = activeCallId;
      var callerId = peerId;

      stateCall = 'IDLE';
      activeCallId = null;
      peerId = null;
      peerName = '';

      try {
        if (state.channel && rejectedCallId) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_decline',
            payload: { callId: rejectedCallId, calleeId: state.user.id, callerId: callerId }
          });
        }
      } catch (e) {}
    }

    // ---------- Peer Accepted (Caller receives this) ----------
    async function handlePeerAccept(payload) {
      if (stateCall !== 'OUTGOING' || payload.callId !== activeCallId) return;
      if (payload.callerId && payload.callerId !== state.user.id) return;

      stopRingtone();
      clearTimeout(autoCancelTimer);

      stateCall = 'CONNECTED';
      peerId = payload.calleeId;
      peerName = payload.calleeName || 'Someone';

      if (ui.callActiveName) ui.callActiveName.textContent = peerName;
      if (ui.callActiveTimer) ui.callActiveTimer.textContent = 'Connecting…';

      setupPeerConnection();

      try {
        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_offer',
            payload: {
              callId: activeCallId,
              sdp: offer,
              fromId: state.user.id,
              toId: peerId
            }
          });
        }
      } catch (err) {
        console.warn('Create offer error:', err);
        endCall(true);
      }
    }

    // ---------- Peer Declined (Caller receives this) ----------
    function handlePeerDecline(payload) {
      if (stateCall === 'OUTGOING' && payload.callId === activeCallId) {
        toast('Call was declined.');
        playEndChime();
        endCall(false);
      }
    }

    // ---------- Setup RTCPeerConnection ----------
    function setupPeerConnection() {
      if (pc) {
        try { pc.close(); } catch (e) {}
      }
      pc = new (window.RTCPeerConnection || window.webkitRTCPeerConnection)(rtcConfig);

      if (localStream) {
        localStream.getTracks().forEach(function (track) {
          pc.addTrack(track, localStream);
        });
      }

      pc.ontrack = function (e) {
        if (e.streams && e.streams[0]) {
          if (ui.remoteAudio) {
            ui.remoteAudio.srcObject = e.streams[0];
            ui.remoteAudio.play().catch(function () {});
          }
          if (e.track && e.track.kind === 'video') {
            if (ui.remoteVideo) ui.remoteVideo.srcObject = e.streams[0];
            if (ui.callVideoContainer) ui.callVideoContainer.hidden = false;
          }
        }
        startCallTimer();
      };

      pc.onicecandidate = function (e) {
        if (e.candidate && state.channel && activeCallId && peerId) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_ice',
            payload: {
              callId: activeCallId,
              candidate: e.candidate,
              fromId: state.user.id,
              toId: peerId
            }
          });
        }
      };

      pc.onconnectionstatechange = function () {
        if (pc.connectionState === 'connected') {
          startCallTimer();
          generateDtlsSafetyCode();
          startStatsPolling();
          if (localStream) startAudioVisualizer(localStream);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          toast('Voice connection dropped.');
          endCall(false);
        }
      };
    }

    // ---------- WebRTC Offer Handler (Callee receives offer) ----------
    async function handleOffer(payload) {
      if (!payload || payload.callId !== activeCallId) return;
      if (payload.toId && payload.toId !== state.user.id) return;
      if (!pc) setupPeerConnection();

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        while (candidateQueue.length > 0) {
          var cand = candidateQueue.shift();
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
        }

        var answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_answer',
            payload: {
              callId: activeCallId,
              sdp: answer,
              fromId: state.user.id,
              toId: peerId
            }
          });
        }
      } catch (err) {
        console.warn('Handle offer error:', err);
      }
    }

    // ---------- WebRTC Answer Handler (Caller receives answer) ----------
    async function handleAnswer(payload) {
      if (!payload || payload.callId !== activeCallId || !pc) return;
      if (payload.toId && payload.toId !== state.user.id) return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        while (candidateQueue.length > 0) {
          var cand = candidateQueue.shift();
          try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (e) {}
        }
        startCallTimer();
      } catch (err) {
        console.warn('Handle answer error:', err);
      }
    }

    // ---------- ICE Candidate Handler ----------
    async function handleIceCandidate(payload) {
      if (!payload || payload.callId !== activeCallId || !payload.candidate) return;
      if (payload.toId && payload.toId !== state.user.id) return;

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {
          console.warn('addIceCandidate error:', e);
        }
      } else {
        candidateQueue.push(payload.candidate);
      }
    }

    // ---------- Remote Call End Handler ----------
    function handleCallEnd(payload) {
      if (payload && payload.callId === activeCallId) {
        playEndChime();
        toast('Call ended by ' + (peerName || 'participant') + '.');
        endCall(false);
      }
    }

    // ---------- End Call (Hang up) ----------
    function endCall(sendBroadcast) {
      stopRingtone();
      hideIncomingUI();
      clearTimeout(autoCancelTimer);
      var durationStr = ui.callActiveTimer ? ui.callActiveTimer.textContent : '';

      if (sendBroadcast !== false && state.channel && activeCallId) {
        try {
          state.channel.send({
            type: 'broadcast',
            event: 'call_end',
            payload: {
              callId: activeCallId,
              fromId: state.user ? state.user.id : null,
              toId: peerId
            }
          });
        } catch (e) {}
      }

      if (stateCall === 'CONNECTED' && durationStr && durationStr !== 'Connecting…') {
        playEndChime();
        toast('Call ended (' + durationStr + ')');

        if (callBookmarks.length > 0 || (callStartTs && Date.now() - callStartTs > 6000)) {
          var debriefPayload = {
            duration: durationStr,
            safetyEmojis: dtlsSafetyEmojis || '🛡️ 🔒 ⚡ 💎',
            bookmarks: callBookmarks.slice()
          };
          var encodedDebrief = '[call:debrief:' + encodeURIComponent(JSON.stringify(debriefPayload)) + ']';
          var debriefMsg = {
            id: uuid(),
            user_id: state.user ? state.user.id : 'system',
            display_name: '📞 Voice Call',
            content: encodedDebrief,
            raw: null,
            ts: Date.now(),
            status: 'sent',
            seq: ++state.seq
          };
          state.msgs.set(debriefMsg.id, debriefMsg);
          render('bottom');
        }
      }
      callBookmarks = [];

      stopCallTimer();
      cleanupMedia();

      if (ui.callActiveBar) ui.callActiveBar.hidden = true;

      stateCall = 'IDLE';
      activeCallId = null;
      peerId = null;
      peerName = '';
    }

    async function toggleVideo() {
      if (!pc || stateCall !== 'CONNECTED') {
        toast('Start or answer a call before turning on video.');
        return;
      }
      if (isVideoActive) {
        if (localVideoTrack) {
          localVideoTrack.stop();
          var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
          if (sender) pc.removeTrack(sender);
          localVideoTrack = null;
        }
        if (ui.localVideo) ui.localVideo.srcObject = null;
        isVideoActive = false;
        if (ui.callVideoBtn) ui.callVideoBtn.classList.remove('active');
        if (!ui.remoteVideo || !ui.remoteVideo.srcObject) {
          if (ui.callVideoContainer) ui.callVideoContainer.hidden = true;
        }
        toast('Camera turned off 📷');
      } else {
        try {
          var vStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
          });
          localVideoTrack = vStream.getVideoTracks()[0];
          pc.addTrack(localVideoTrack, localStream || vStream);
          if (ui.localVideo) ui.localVideo.srcObject = new MediaStream([localVideoTrack]);
          if (ui.callVideoContainer) ui.callVideoContainer.hidden = false;
          isVideoActive = true;
          if (ui.callVideoBtn) ui.callVideoBtn.classList.add('active');
          toast('Camera turned on 📹');

          var offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (state.channel) {
            state.channel.send({
              type: 'broadcast',
              event: 'call_offer',
              payload: { callId: activeCallId, sdp: offer, fromId: state.user.id, toId: peerId }
            });
          }
        } catch (err) {
          toast('Could not access camera: ' + (err.message || err));
        }
      }
    }

    async function toggleScreenShare() {
      if (!pc || stateCall !== 'CONNECTED') {
        toast('Start or answer a call before sharing screen.');
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        toast('Screen sharing is not supported on this browser.');
        return;
      }
      try {
        var screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        var screenTrack = screenStream.getVideoTracks()[0];
        screenTrack.onended = function () {
          toggleVideo();
        };
        var sender = pc.getSenders().find(function (s) { return s.track && s.track.kind === 'video'; });
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, localStream || screenStream);
        }
        if (ui.localVideo) ui.localVideo.srcObject = new MediaStream([screenTrack]);
        if (ui.callVideoContainer) ui.callVideoContainer.hidden = false;
        isVideoActive = true;
        toast('Screen sharing started 🖥️');

        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (state.channel) {
          state.channel.send({
            type: 'broadcast',
            event: 'call_offer',
            payload: { callId: activeCallId, sdp: offer, fromId: state.user.id, toId: peerId }
          });
        }
      } catch (e) {
        console.warn('Screen share cancelled:', e);
      }
    }

    function init() {
      if (ui.callBtn) {
        ui.callBtn.addEventListener('click', startCall);
      }
      if (ui.callAcceptBtn) {
        ui.callAcceptBtn.addEventListener('click', acceptCall);
      }
      if (ui.callDeclineBtn) {
        ui.callDeclineBtn.addEventListener('click', declineCall);
      }
      if (ui.callHangupBtn) {
        ui.callHangupBtn.addEventListener('click', function () { endCall(true); });
      }
      if (ui.callMuteBtn) {
        ui.callMuteBtn.addEventListener('click', toggleMute);
      }
      if (ui.callVideoBtn) {
        ui.callVideoBtn.addEventListener('click', toggleVideo);
      }
      if (ui.callScreenBtn) {
        ui.callScreenBtn.addEventListener('click', toggleScreenShare);
      }
      if (ui.videoPipCloseBtn) {
        ui.videoPipCloseBtn.addEventListener('click', function () {
          if (ui.callVideoContainer) ui.callVideoContainer.hidden = true;
        });
      }
      // Advanced In-Call Voice Controls
      if (ui.callBookmarkBtn) {
        ui.callBookmarkBtn.addEventListener('click', addCallBookmark);
      }
      if (ui.callHudBtn) {
        ui.callHudBtn.addEventListener('click', toggleCallHud);
      }
      if (ui.callHudClose) {
        ui.callHudClose.addEventListener('click', closeCallHud);
      }
      if (ui.callLowdataBtn) {
        ui.callLowdataBtn.addEventListener('click', toggleLowDataMode);
      }
      if (ui.callDrawBtn) {
        ui.callDrawBtn.addEventListener('click', openTelestrator);
      }
      if (ui.telestratorCloseBtn) {
        ui.telestratorCloseBtn.addEventListener('click', closeTelestrator);
      }
      if (ui.telestratorClearBtn) {
        ui.telestratorClearBtn.addEventListener('click', clearTelestrator);
      }
      if (ui.telestratorPenBtn) {
        ui.telestratorPenBtn.addEventListener('click', function () {
          telestratorMode = 'pen';
          ui.telestratorPenBtn.classList.add('active');
          if (ui.telestratorLaserBtn) ui.telestratorLaserBtn.classList.remove('active');
        });
      }
      if (ui.telestratorLaserBtn) {
        ui.telestratorLaserBtn.addEventListener('click', function () {
          telestratorMode = 'laser';
          ui.telestratorLaserBtn.classList.add('active');
          if (ui.telestratorPenBtn) ui.telestratorPenBtn.classList.remove('active');
        });
      }
    }

    return {
      init: init,
      startCall: startCall,
      endCall: endCall,
      handleIncomingInvite: handleIncomingInvite,
      handlePeerAccept: handlePeerAccept,
      handlePeerDecline: handlePeerDecline,
      handleOffer: handleOffer,
      handleAnswer: handleAnswer,
      handleIceCandidate: handleIceCandidate,
      handleCallEnd: handleCallEnd,
      handleIncomingDraw: handleIncomingDraw
    };
  })();

  // =========================================================================
  // Apple Voice Notes Engine (Audio Walkie-Talkie with Waveforms & Speed)
  // =========================================================================
  async function sendVoiceMessage(blob, durationSec) {
    if (!state.user) {
      toast('Please sign in to send voice messages.');
      return;
    }

    var id = uuid();
    var localUrl = URL.createObjectURL(blob);
    var localContent = '[audio:' + durationSec + ':' + localUrl + ']';
    if (state.replyingTo) {
      localContent = '[reply:' + encodeURIComponent(state.replyingTo.author) + ':' + encodeURIComponent(state.replyingTo.text) + ']' + localContent;
      clearReplyingTo();
    }

    var m = {
      id: id,
      user_id: state.user.id,
      display_name: state.name,
      content: localContent,
      localUrl: localUrl,
      raw: null,
      ts: Date.now(),
      status: 'sending',
      seq: ++state.seq
    };

    state.msgs.set(id, m);
    render('bottom');
    playSendSound();

    try {
      // 1. Upload audio blob to Supabase Storage in chat-images bucket
      // Using .jpg extension & image/jpeg content type to satisfy existing bucket policies and triggers
      var filePath = state.user.id + '/' + id + '.jpg';
      var up = await sb.storage.from(BUCKET).upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false
      });
      if (up.error && !/exists|duplicate/i.test(up.error.message || '')) throw up.error;

      // 2. Build remote audio URL
      var publicUrl = photoUrl(filePath);
      var remoteContent = '[audio:' + durationSec + ':' + publicUrl + ']';
      if (m.content.startsWith('[reply:')) {
        var replyPrefix = m.content.substring(0, m.content.indexOf(']') + 1);
        remoteContent = replyPrefix + remoteContent;
      }

      var payloadContent = remoteContent;
      if (state.cryptoKey && payloadContent) {
        payloadContent = await E2EE.encryptText(state.cryptoKey, payloadContent);
        decryptedCache.set(payloadContent, remoteContent);
      }

      // 3. Insert record into messages table (image_path is null so no photo tag is generated)
      var res = await sb.from('messages')
        .insert({
          id: m.id,
          room_id: state.room,
          display_name: m.display_name,
          content: payloadContent,
          image_path: null
        })
        .select(COLUMNS)
        .single();

      if (res.error && res.error.code === '23505') {
        res = await baseQuery().eq('id', m.id).single();
      }
      if (res.error) throw res.error;

      // 4. Update local message and broadcast over WebSocket realtime channel
      m.status = 'sent';
      m.content = remoteContent;
      upsert(res.data);

      if (roomChannel) {
        roomChannel.send({
          type: 'broadcast',
          event: 'message',
          payload: res.data
        }).catch(function () {});
      }
      render('auto');
    } catch (err) {
      console.error('Failed to send voice note:', err);
      m.status = 'failed';
      m.error = err.message || 'Could not send voice note.';
      render('auto');
      toast('Failed to send voice note: ' + (err.message || 'Storage error'));
    }
  }

  var VoiceManager = (function () {
    var mediaRecorder = null;
    var audioChunks = [];
    var recTimerInterval = null;
    var recStartTs = 0;
    var isRecording = false;

    async function startRecording() {
      if (isRecording) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast('Voice notes require microphone support in your browser.');
        return;
      }
      try {
        unlockAudio();
        var stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        audioChunks = [];
        var mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
          else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
          else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
          else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
          else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        }

        mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType: mimeType }) : new MediaRecorder(stream);
        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.start(250);
        isRecording = true;
        recStartTs = Date.now();

        if (ui.voiceRecordingBar) ui.voiceRecordingBar.hidden = false;
        if (ui.msgInputWrap) ui.msgInputWrap.hidden = true;
        if (ui.voiceRecordBtn) ui.voiceRecordBtn.hidden = true;
        if (ui.sendBtn) ui.sendBtn.hidden = true;
        if (ui.voiceTimer) ui.voiceTimer.textContent = '00:00';

        clearInterval(recTimerInterval);
        recTimerInterval = setInterval(function () {
          var elapsed = Math.floor((Date.now() - recStartTs) / 1000);
          var m = Math.floor(elapsed / 60);
          var s = elapsed % 60;
          if (ui.voiceTimer) ui.voiceTimer.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
          if (elapsed >= 120) {
            stopAndSend();
          }
        }, 1000);
      } catch (err) {
        toast('Microphone access denied: ' + (err.message || err));
      }
    }

    function cleanupUI() {
      isRecording = false;
      clearInterval(recTimerInterval);
      if (ui.voiceRecordingBar) ui.voiceRecordingBar.hidden = true;
      if (ui.msgInputWrap) ui.msgInputWrap.hidden = false;
      if (ui.voiceRecordBtn) ui.voiceRecordBtn.hidden = false;
      if (ui.sendBtn) ui.sendBtn.hidden = false;
    }

    function cancelRecording() {
      if (!isRecording) return;
      cleanupUI();
      if (mediaRecorder) {
        try {
          if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(function (t) { t.stop(); });
          }
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        } catch (e) {}
      }
      mediaRecorder = null;
      audioChunks = [];
      toast('Voice recording cancelled');
    }

    function stopAndSend() {
      if (!isRecording || !mediaRecorder) return;
      var durationSec = Math.max(1, Math.floor((Date.now() - recStartTs) / 1000));
      cleanupUI();

      var recMime = (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm';
      var recStream = mediaRecorder.stream;

      mediaRecorder.onstop = function () {
        if (recStream) {
          try { recStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        }
        var blob = new Blob(audioChunks, { type: recMime });
        mediaRecorder = null;
        audioChunks = [];

        if (!blob || blob.size < 150) {
          toast('Voice recording was too short.');
          return;
        }

        sendVoiceMessage(blob, durationSec);
      };

      try {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      } catch (e) {
        console.warn('Error stopping mediaRecorder:', e);
      }
    }

    function init() {
      if (ui.voiceRecordBtn) {
        ui.voiceRecordBtn.addEventListener('click', startRecording);
      }
      if (ui.voiceCancelBtn) {
        ui.voiceCancelBtn.addEventListener('click', cancelRecording);
      }
      if (ui.voiceSendBtn) {
        ui.voiceSendBtn.addEventListener('click', stopAndSend);
      }
    }

    return {
      init: init,
      startRecording: startRecording,
      cancelRecording: cancelRecording,
      stopAndSend: stopAndSend
    };
  })();

  // ---------- QR Code Modal & 1-Scan Pairing ----------
  function openQRModal() {
    if (!ui.qrModal) return;
    var base = location.href.split('?')[0].split('#')[0];
    var url = base + '?room=' + encodeURIComponent(state.room || 'general');
    if (state.roomKey) {
      url += '&key=' + encodeURIComponent(state.roomKey);
    }
    if (ui.qrRoomName) ui.qrRoomName.textContent = state.roomDisplayName || state.room || 'General Chat';
    if (ui.qrRoomId) ui.qrRoomId.textContent = '#' + (state.room || 'general');

    if (ui.qrContainer && typeof qrcode === 'function') {
      try {
        var qr = qrcode(0, 'M');
        qr.addData(url);
        qr.make();
        ui.qrContainer.innerHTML = qr.createSvgTag(6, 4);
      } catch (e) {
        ui.qrContainer.innerHTML = '<div style="padding: 20px; font-size: 13px;">Error generating QR code</div>';
      }
    }
    ui.qrModal.hidden = false;
  }

  function closeQRModal() {
    if (ui.qrModal) ui.qrModal.hidden = true;
  }

  if (ui.qrBtn) {
    ui.qrBtn.addEventListener('click', openQRModal);
  }
  if (ui.qrCloseBtn) {
    ui.qrCloseBtn.addEventListener('click', closeQRModal);
  }
  if (ui.qrCopyBtn) {
    ui.qrCopyBtn.addEventListener('click', async function () {
      if (ui.copyBtn) ui.copyBtn.click();
    });
  }

  // ---------- Quoted Replies & Reactions State ----------
  state.replyingTo = null;
  var activeReactions = {}; // msgId -> { emoji: [userIds...] }

  function setReplyingTo(msgId, authorName, text) {
    state.replyingTo = { id: msgId, author: authorName, text: text };
    if (ui.replyPreviewBar) {
      if (ui.replyToName) ui.replyToName.textContent = 'Replying to ' + authorName;
      if (ui.replyToSnippet) ui.replyToSnippet.textContent = text;
      ui.replyPreviewBar.hidden = false;
    }
    if (ui.input) ui.input.focus();
  }

  function clearReplyingTo() {
    state.replyingTo = null;
    if (ui.replyPreviewBar) ui.replyPreviewBar.hidden = true;
  }

  if (ui.replyCancelBtn) {
    ui.replyCancelBtn.addEventListener('click', clearReplyingTo);
  }

  function toggleReaction(msgId, emoji) {
    if (!state.user) return;
    if (!activeReactions[msgId]) activeReactions[msgId] = {};
    if (!activeReactions[msgId][emoji]) activeReactions[msgId][emoji] = [];
    var users = activeReactions[msgId][emoji];
    var myKey = state.name || (state.user ? state.user.id : 'me');
    var idx = users.indexOf(myKey);
    if (idx > -1) {
      users.splice(idx, 1);
    } else {
      users.push(myKey);
    }
    render('keep');

    if (state.channel) {
      try {
        state.channel.send({
          type: 'broadcast',
          event: 'msg_react',
          payload: { msgId: msgId, emoji: emoji, userId: myKey, userName: state.name, clientId: state.clientId }
        });
      } catch (e) {}
    }
  }

  function buildReactionBar(msgId, authorName, textSnippet) {
    var bar = el('div', 'reaction-bar');
    ['❤️', '👍', '😂', '🔥', '👏'].forEach(function (emoji) {
      var btn = el('button', 'btn-react-emoji', emoji);
      btn.type = 'button';
      btn.setAttribute('aria-label', 'React ' + emoji);
      btn.onclick = function (e) {
        e.stopPropagation();
        toggleReaction(msgId, emoji);
      };
      bar.append(btn);
    });

    var replyBtn = el('button', 'btn-react-reply', '↩️');
    replyBtn.type = 'button';
    replyBtn.title = 'Reply to this message';
    replyBtn.setAttribute('aria-label', 'Reply');
    replyBtn.onclick = function (e) {
      e.stopPropagation();
      setReplyingTo(msgId, authorName, textSnippet);
    };
    bar.append(replyBtn);

    return bar;
  }

  function buildReactionBadges(msgId) {
    var reacts = activeReactions[msgId];
    if (!reacts) return null;
    var keys = Object.keys(reacts).filter(function (k) { return reacts[k] && reacts[k].length > 0; });
    if (!keys.length) return null;

    var container = el('div', 'reaction-badges');
    var myKey = state.name || (state.user && state.user.id);
    keys.forEach(function (emoji) {
      var count = reacts[emoji].length;
      var hasMine = myKey && reacts[emoji].indexOf(myKey) > -1;
      var badge = el('button', 'reaction-badge' + (hasMine ? ' my-react' : ''));
      badge.type = 'button';
      badge.innerHTML = emoji + (count > 1 ? '<span class="reaction-count"> ' + count + '</span>' : '');
      badge.onclick = function (e) {
        e.stopPropagation();
        toggleReaction(msgId, emoji);
      };
      container.append(badge);
    });
    return container;
  }

  function buildVoicePlayer(src, durationSec, isMine) {
    var container = el('div', 'voice-player-bubble');
    var audio = new Audio();
    var playBtn = el('button', 'voice-play-btn');
    playBtn.type = 'button';
    playBtn.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><polygon points=\"5 3 19 12 5 21 5 3\"/></svg>';

    var waveWrap = el('div', 'voice-waveform-wrap');
    var waveBars = el('div', 'voice-waveform-bars');
    var heights = [35, 60, 45, 90, 70, 40, 85, 100, 65, 80, 50, 75, 95, 60, 40, 70];
    var barElements = [];
    heights.forEach(function (h) {
      var bar = el('span', 'voice-bar-segment');
      bar.style.height = h + '%';
      waveBars.append(bar);
      barElements.push(bar);
    });

    var sub = el('div', 'voice-player-sub');
    var timeDisplay = el('span', null, formatDuration(durationSec));
    var speedPill = el('button', 'voice-speed-pill', '1×');
    speedPill.type = 'button';
    var speeds = [1, 1.5, 2];
    var speedIdx = 0;
    speedPill.onclick = function (e) {
      e.stopPropagation();
      speedIdx = (speedIdx + 1) % speeds.length;
      audio.playbackRate = speeds[speedIdx];
      speedPill.textContent = speeds[speedIdx] + '×';
    };

    sub.append(timeDisplay, speedPill);
    waveWrap.append(waveBars, sub);
    container.append(playBtn, waveWrap);

    var isPlaying = false;
    var audioReadyPromise = null;

    function ensureAudioSource() {
      if (audioReadyPromise) return audioReadyPromise;
      if (src.startsWith('blob:') || src.startsWith('data:')) {
        audio.src = src;
        audioReadyPromise = Promise.resolve();
        return audioReadyPromise;
      }
      // For remote URLs from Supabase Storage:
      // Fetch as blob to guarantee audio playback across browsers even if server sent image/jpeg header
      audioReadyPromise = fetch(src)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.blob();
        })
        .then(function (b) {
          var audioBlob = new Blob([b], { type: 'audio/webm' });
          audio.src = URL.createObjectURL(audioBlob);
        })
        .catch(function (err) {
          console.warn('Fetch audio blob error, falling back to direct URL:', err);
          audio.src = src;
        });
      return audioReadyPromise;
    }

    playBtn.onclick = async function (e) {
      e.stopPropagation();
      unlockAudio();
      if (isPlaying) {
        audio.pause();
      } else {
        try {
          await ensureAudioSource();
          await audio.play();
        } catch (err) {
          console.warn('Audio play error:', err);
          audio.src = src;
          audio.play().catch(function (e2) {
            toast('Cannot play audio: ' + (e2.message || 'format not supported'));
          });
        }
      }
    };

    waveBars.onclick = function (e) {
      e.stopPropagation();
      if (!audio.duration) return;
      var rect = waveBars.getBoundingClientRect();
      var clickX = e.clientX - rect.left;
      var ratio = Math.max(0, Math.min(1, clickX / rect.width));
      audio.currentTime = ratio * audio.duration;
    };

    audio.onplay = function () {
      isPlaying = true;
      playBtn.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><rect x=\"6\" y=\"4\" width=\"4\" height=\"16\"/><rect x=\"14\" y=\"4\" width=\"4\" height=\"16\"/></svg>';
    };
    audio.onpause = audio.onended = function () {
      isPlaying = false;
      playBtn.innerHTML = '<svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"currentColor\"><polygon points=\"5 3 19 12 5 21 5 3\"/></svg>';
      if (audio.ended) {
        barElements.forEach(function (b) { b.classList.remove('played'); });
        timeDisplay.textContent = formatDuration(durationSec);
      }
    };
    audio.ontimeupdate = function () {
      if (audio.duration) {
        var progress = audio.currentTime / audio.duration;
        var activeBarCount = Math.floor(progress * barElements.length);
        barElements.forEach(function (b, idx) {
          b.classList.toggle('played', idx <= activeBarCount);
        });
        timeDisplay.textContent = formatDuration(Math.floor(audio.currentTime));
      }
    };

    return container;
  }

  // ---------- Supabase Client ----------
  function isConfigured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY &&
      !/YOUR_/.test(cfg.SUPABASE_URL) && !/YOUR_/.test(cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  function toMsg(row) {
    var rawContent = row.content || '';
    var displayContent = rawContent;

    if (E2EE.isEncrypted(rawContent)) {
      if (decryptedCache.has(rawContent)) {
        displayContent = decryptedCache.get(rawContent);
      } else {
        displayContent = '🔒 [Decrypting…]';
        if (state.cryptoKey) {
          E2EE.decryptText(state.cryptoKey, rawContent).then(function (plain) {
            decryptedCache.set(rawContent, plain);
            var m = state.msgs.get(row.id);
            if (m) {
              m.content = plain;
              render('auto');
            }
          });
        }
      }
    }

    return {
      id: row.id,
      user_id: row.user_id,
      display_name: row.display_name,
      content: displayContent,
      rawContent: rawContent,
      image_path: row.image_path || null,
      raw: row.created_at,
      ts: Date.parse(row.created_at),
      status: 'sent',
      readByPeers: Boolean(row.read_by_peers),
      seq: 0,
    };
  }

  function upsert(row) {
    if (!row || (row.room_id && row.room_id !== state.room)) return;
    // If chat was cleared locally and this message is older than clear timestamp, skip
    if (state.clearedAt && Date.parse(row.created_at) < state.clearedAt) return;
    var old = state.msgs.get(row.id);
    if (old && old.localUrl) URL.revokeObjectURL(old.localUrl);
    state.msgs.set(row.id, toMsg(row));
  }

  function sorted() {
    return Array.from(state.msgs.values()).sort(function (a, b) {
      var ap = a.status !== 'sent', bp = b.status !== 'sent';
      if (ap && bp) return a.seq - b.seq;
      if (ap) return 1;
      if (bp) return -1;
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.id < b.id ? -1 : 1;
    });
  }

  function newestRaw() {
    var best = null;
    state.msgs.forEach(function (m) {
      if (m.status === 'sent' && (!best || m.ts > best.ts)) best = m;
    });
    return best ? best.raw : null;
  }

  // ---------- Rendering ----------
  function nearBottom() {
    var m = ui.messages;
    return m.scrollHeight - m.scrollTop - m.clientHeight < 120;
  }
  function scrollToBottom() { ui.messages.scrollTop = ui.messages.scrollHeight; }

  var stuckToBottom = true;
  ui.messages.addEventListener('scroll', function () { stuckToBottom = nearBottom(); });
  function onPhotoLoaded() { if (stuckToBottom) scrollToBottom(); }

  function render(mode) {
    var wasNear = nearBottom();
    var prevHeight = ui.messages.scrollHeight, prevTop = ui.messages.scrollTop;

    var list = sorted();
    var frag = document.createDocumentFragment();
    var lastDay = null, prev = null;

    list.forEach(function (m) {
      var day = m.status === 'sent' ? dayLabel(m.ts) : 'Today';
      if (day !== lastDay) {
        var sep = el('div', 'day');
        sep.append(el('span', null, day));
        frag.append(sep);
        lastDay = day;
        prev = null;
      }
      var cont = prev && prev.user_id === m.user_id &&
        (m.status !== 'sent' || prev.status !== 'sent' || m.ts - prev.ts < 4 * 60 * 1000);
      frag.append(bubble(m, cont));
      prev = m;
    });

    ui.feed.replaceChildren(frag);
    ui.olderBtn.hidden = !state.hasMore;
    ui.olderBtn.disabled = state.loadingOlder;
    ui.olderBtn.textContent = state.loadingOlder ? 'Loading…' : 'Load Earlier Messages';

    if (state.ready && list.length === 0) {
      if (state.clearedAt) {
        ui.status.innerHTML = 'Conversation cleared. Messages from now on will appear below.<br><button id="restore-history-btn" class="restore-btn" type="button">Restore Earlier Messages</button>';
        var restBtn = $('restore-history-btn');
        if (restBtn) {
          restBtn.onclick = function () {
            store('linkchat.clearedAt_' + state.room, null);
            state.clearedAt = 0;
            state.oldestRaw = null;
            loadLatest().then(function () {
              render('bottom');
              toast('Chat history restored!');
            });
          };
        }
      } else {
        ui.status.textContent = 'No messages yet. Send a message to start.';
      }
    } else if (state.ready) {
      ui.status.textContent = '';
    }

    if (mode === 'bottom' || (mode !== 'prepend' && wasNear)) { scrollToBottom(); stuckToBottom = true; }
    else if (mode === 'prepend') ui.messages.scrollTop = prevTop + (ui.messages.scrollHeight - prevHeight);
  }

  function photoUrl(path) {
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function bubble(m, cont) {
    var isMine = Boolean(state.user && m.user_id === state.user.id);
    if (isMine && m.display_name && state.name && m.display_name.trim().toLowerCase() !== state.name.trim().toLowerCase()) {
      isMine = false;
    }
    if (!isMine && m.display_name && state.name && m.display_name.trim().toLowerCase() === state.name.trim().toLowerCase()) {
      isMine = true;
    }
    var mine = isMine;

    var row = el('div', 'row msg ' + (mine ? 'mine own' : 'theirs other') + (cont ? ' cont' : '') +
      (m.status === 'failed' ? ' is-failed' : '') + (m.status === 'sending' ? ' is-sending' : ''));
    var b = el('div', 'bubble');

    b.onclick = function (e) {
      if (e.target.closest('button, a, input, .reaction-bar, .reaction-badges')) return;
      b.classList.toggle('active-react');
      row.classList.toggle('active-react');
    };

    if (!mine && !cont) {
      var s = el('div', 'sender', m.display_name);
      s.style.color = nameColor(m.user_id || '');
      b.append(s);
    }
    var src = m.localUrl || (m.image_path ? photoUrl(m.image_path) : null);
    if (src) {
      var img = el('img', 'photo');
      img.alt = 'Photo from ' + m.display_name;
      img.loading = 'lazy';
      img.src = src;
      img.addEventListener('load', onPhotoLoaded);
      if (m.status === 'sent') {
        var a = el('a', 'photo-link');
        a.href = src;
        a.target = '_blank';
        a.rel = 'noopener';
        a.title = 'Open full size';
        a.append(img);
        b.append(a);
      } else {
        b.append(img);
      }
    }
    var rawContent = m.content || '';
    var textSnippet = rawContent;

    // 1. Quoted Reply Box & Feelings
    function extractFeeling() {
      if (!window.Feelings) return;
      var feelInfo = window.Feelings.decode(rawContent);
      if (feelInfo.feeling) {
        var feelTag = el('div', 'feel-tag', feelInfo.feeling.emoji + ' ' + feelInfo.feeling.label);
        b.append(feelTag);
        rawContent = feelInfo.rest;
        textSnippet = rawContent;
      }
    }

    extractFeeling();

    var replyMatch = rawContent.match(/^\[reply:([^:]+):([^\]]+)\]/);
    if (replyMatch) {
      try {
        var repAuthor = decodeURIComponent(replyMatch[1]);
        var repText = decodeURIComponent(replyMatch[2]);
        var repBox = el('div', 'quoted-message-box');
        repBox.innerHTML = '<strong>' + escapeHtml(repAuthor) + '</strong><span>' + escapeHtml(repText) + '</span>';
        b.append(repBox);
        rawContent = rawContent.substring(replyMatch[0].length);
        textSnippet = rawContent;
      } catch (e) {}
    }

    extractFeeling();

    // 2. Audio Voice Player vs Call Debrief vs Cryptographic Capsule vs Plain Text
    var audioMatch = rawContent.match(/^\[audio:(\d+):([^\]]+)\]/);
    var debriefMatch = rawContent.match(/^\[call:debrief:(.*)\]$/);
    var capsuleMatch = window.Capsules && window.Capsules.decode(rawContent);
    if (audioMatch) {
      var durSec = parseInt(audioMatch[1], 10) || 0;
      var audioSrc = audioMatch[2];
      var audioPlayer = buildVoicePlayer(audioSrc, durSec, mine);
      b.append(audioPlayer);
      textSnippet = 'Voice note (' + durSec + 's)';
    } else if (debriefMatch) {
      try {
        var debriefObj = JSON.parse(decodeURIComponent(debriefMatch[1]));
        var debriefCard = buildCallDebriefElement(debriefObj);
        b.append(debriefCard);
        textSnippet = '📞 Call Ended (' + (debriefObj.duration || '') + ')';
      } catch (e) {
        b.append(el('div', 'text', rawContent));
      }
    } else if (window.Capsules && window.Capsules.isCapsule(rawContent)) {
      var capsuleCard = window.Capsules.renderCard(rawContent);
      b.append(capsuleCard);
      textSnippet = 'Capsule ⏳📍';
    } else if (rawContent) {
      b.append(el('div', 'text', rawContent));
    }

    var meta = el('div', 'meta');
    if (m.status === 'sending') {
      meta.append(el('span', 'receipt-status sending', 'Sending…'));
    } else if (m.status === 'failed') {
      var f = el('span', 'failed', 'Not sent');
      if (m.error) f.title = m.error;
      var retry = el('button', 'retry', 'Retry');
      retry.type = 'button';
      retry.addEventListener('click', function () { insert(m); });
      meta.append(f, retry);
    } else {
      var t = el('time', null, timeLabel(m.ts));
      t.dateTime = m.raw;
      t.title = new Date(m.ts).toLocaleString();
      meta.append(t);
      if (mine) {
        var isRead = m.readByPeers || (state.peerCount > 1 && m.ts <= (state.lastReadAckTs || 0));
        if (isRead) {
          meta.append(el('span', 'receipt-status read', '✓✓ Read'));
        } else {
          meta.append(el('span', 'receipt-status delivered', '✓✓ Delivered'));
        }
      }
    }
    b.append(meta);

    // 3. iMessage Quick Reaction Bar & Badges
    if (m.status === 'sent') {
      var reactBar = buildReactionBar(m.id, m.display_name, textSnippet);
      b.append(reactBar);
      var badges = buildReactionBadges(m.id);
      if (badges) b.append(badges);
    }

    row.append(b);
    return row;
  }

  function buildCallDebriefElement(d) {
    var card = el('div', 'call-debrief-card');
    var head = el('div', 'debrief-header');
    head.innerHTML = '<span class="debrief-title">📞 Voice Call Completed</span><span class="debrief-time-badge">⏱️ ' + escapeHtml(d.duration) + '</span>';
    card.append(head);

    var meta = el('div');
    meta.style.fontSize = '12px';
    meta.style.opacity = '0.75';
    meta.style.marginBottom = '6px';
    meta.innerHTML = '🛡️ End-to-End DTLS Security: <strong>' + escapeHtml(d.safetyEmojis || 'Verified') + '</strong>';
    card.append(meta);

    if (d.bookmarks && d.bookmarks.length > 0) {
      var bmTitle = el('strong');
      bmTitle.style.fontSize = '12px';
      bmTitle.textContent = '📌 Pinned Discussion Moments:';
      card.append(bmTitle);
      var ul = el('ul', 'debrief-bookmarks-list');
      d.bookmarks.forEach(function (b) {
        var li = el('li');
        li.innerHTML = '<code>' + escapeHtml(b.time) + '</code> — ' + escapeHtml(b.note);
        ul.append(li);
      });
      card.append(ul);
    }
    return card;
  }

  // ---------- Message Queries ----------
  function baseQuery() {
    return sb.from('messages').select(COLUMNS).eq('room_id', state.room);
  }

  async function loadLatest() {
    var query = baseQuery();
    if (state.clearedAt) {
      query = query.gt('created_at', new Date(state.clearedAt).toISOString());
    }
    var res = await query.order('created_at', { ascending: false }).limit(PAGE_SIZE);
    if (res.error) throw res.error;
    res.data.forEach(upsert);
    state.hasMore = res.data.length === PAGE_SIZE;
    if (res.data.length) state.oldestRaw = res.data[res.data.length - 1].created_at;
  }

  async function loadOlder() {
    if (state.loadingOlder || !state.hasMore || !state.oldestRaw) return;
    state.loadingOlder = true;
    render('prepend');
    try {
      var res = await baseQuery().lt('created_at', state.oldestRaw)
        .order('created_at', { ascending: false }).limit(PAGE_SIZE);
      if (res.error) throw res.error;
      res.data.forEach(upsert);
      state.hasMore = res.data.length === PAGE_SIZE;
      if (res.data.length) state.oldestRaw = res.data[res.data.length - 1].created_at;
    } catch (e) {
      toast('Could not load earlier messages');
    } finally {
      state.loadingOlder = false;
      render('prepend');
    }
  }
  ui.olderBtn.addEventListener('click', loadOlder);

  async function catchUp() {
    if (!state.ready || !state.room) return;
    var since = newestRaw();
    try {
      var q = baseQuery();
      if (since) {
        q = q.gt('created_at', since);
      } else if (state.clearedAt) {
        q = q.gt('created_at', new Date(state.clearedAt).toISOString());
      }
      var res = await q.order('created_at', { ascending: true }).limit(200);
      if (!res.error) {
        state.restHealthy = true;
        setConnected(true);
      } else {
        state.restHealthy = false;
      }
      if (!res.error && res.data && res.data.length) {
        var hadNew = false;
        res.data.forEach(function (row) {
          if (!state.msgs.has(row.id)) {
            hadNew = true;
            onRealtimeRow(row);
          }
        });
        if (hadNew) render('auto');
      }
    } catch (e) {}
  }

  // ---------- Realtime + presence ----------
  function onRealtimeRow(row) {
    if (!state.ready) { state.buffer.push(row); return; }
    var isNew = !state.msgs.has(row.id);
    upsert(row);
    render('auto');

    if (row && row.user_id) {
      handlePeerStopTyping(row.user_id);
    }
    if (isNew && state.user && row.user_id !== state.user.id) {
      sendReadAck();
      notifyIncomingMessage(row.display_name, row.content);
    }
    if (state.room && row && row.room_id === state.room) {
      markRoomAsRead(state.room);
    }
  }

  function updatePresence() {
    if (!state.channel) return;
    var ps = state.channel.presenceState();
    var keys = Object.keys(ps);
    state.peerCount = keys.length;
    var names = keys.map(function (k) {
      var metas = ps[k] || [];
      return metas.length && metas[0].name ? metas[0].name : 'Someone';
    }).sort(function (a, b) { return a.localeCompare(b); });
    ui.onlineCount.textContent = keys.length + ' online';
    ui.onlineList.textContent = 'Active now: ' + names.join(', ');
    ui.online.hidden = keys.length === 0;

    if (keys.length > 1 && state.ready) {
      sendReadAck();
    }
    render('auto');
  }

  // ---------- Ephemeral Typing Signals & Read Receipts (§Feature 4) ----------
  var activeTypers = new Map(); // user_id -> { name, timer }

  function handlePeerTyping(userId, userName) {
    if (!userId) return;
    if (state.name && userName && userName.trim().toLowerCase() === state.name.trim().toLowerCase()) return;
    if (activeTypers.has(userId)) {
      clearTimeout(activeTypers.get(userId).timer);
    }
    var timer = setTimeout(function () {
      handlePeerStopTyping(userId);
    }, 3800);
    activeTypers.set(userId, { name: userName || 'Someone', timer: timer });
    updateTypingUI();
  }

  function handlePeerStopTyping(userId) {
    if (!userId) return;
    if (activeTypers.has(userId)) {
      clearTimeout(activeTypers.get(userId).timer);
      activeTypers.delete(userId);
      updateTypingUI();
    }
  }

  function updateTypingUI() {
    if (!ui.typingIndicator || !ui.typingName) return;
    if (activeTypers.size === 0) {
      ui.typingIndicator.hidden = true;
    } else if (activeTypers.size === 1) {
      var firstName = Array.from(activeTypers.values())[0].name;
      ui.typingName.textContent = firstName + ' is typing…';
      ui.typingIndicator.hidden = false;
      if (stuckToBottom) scrollToBottom();
    } else {
      ui.typingName.textContent = activeTypers.size + ' people are typing…';
      ui.typingIndicator.hidden = false;
      if (stuckToBottom) scrollToBottom();
    }
  }

  var typingSignalTimer = null;
  var isTypingBroadcasted = false;

  function sendTypingSignal() {
    if (!state.channel || !state.room) return;
    if (!isTypingBroadcasted) {
      isTypingBroadcasted = true;
      try {
        state.channel.send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: state.user ? state.user.id : null, name: state.name, clientId: state.clientId }
        });
      } catch (e) {}
    }
    clearTimeout(typingSignalTimer);
    typingSignalTimer = setTimeout(function () {
      stopTypingSignal();
    }, 2800);
  }

  function stopTypingSignal() {
    clearTimeout(typingSignalTimer);
    if (isTypingBroadcasted && state.channel && state.room) {
      isTypingBroadcasted = false;
      try {
        state.channel.send({
          type: 'broadcast',
          event: 'stop_typing',
          payload: { user_id: state.user ? state.user.id : null, name: state.name, clientId: state.clientId }
        });
      } catch (e) {}
    }
  }

  var readAckTimer = null;
  function sendReadAck() {
    if (!state.channel || !state.room || !state.user) return;
    clearTimeout(readAckTimer);
    readAckTimer = setTimeout(function () {
      if (state.channel && state.ready) {
        try {
          state.channel.send({
            type: 'broadcast',
            event: 'read_ack',
            payload: { reader_id: state.user.id, up_to: Date.now() }
          });
        } catch (e) {}
      }
    }, 300);
  }

  function handleReadAck(upTo) {
    if (!upTo) return;
    state.lastReadAckTs = Math.max(state.lastReadAckTs || 0, upTo);
    var hadChange = false;
    state.msgs.forEach(function (m) {
      if (state.user && m.user_id === state.user.id && m.ts <= upTo && !m.readByPeers) {
        m.readByPeers = true;
        hadChange = true;
      }
    });
    if (hadChange) {
      render('auto');
    }
  }

  function setConnected(ok) {
    if (ok) {
      ui.conn.hidden = true;
    } else {
      if (state.restHealthy) {
        ui.conn.hidden = true;
      } else {
        ui.conn.hidden = false;
        ui.online.hidden = true;
        ui.onlineList.hidden = true;
        ui.online.setAttribute('aria-expanded', 'false');
      }
    }
  }

  ui.online.addEventListener('click', function () {
    var show = ui.onlineList.hidden;
    ui.onlineList.hidden = !show;
    ui.online.setAttribute('aria-expanded', String(show));
  });

  function isWsConnected() {
    try {
      return Boolean(sb && sb.realtime && typeof sb.realtime.isConnected === 'function' && sb.realtime.isConnected());
    } catch (e) { return false; }
  }

  function syncRealtimeAuth(session) {
    if (session && session.access_token && sb && sb.realtime && typeof sb.realtime.setAuth === 'function') {
      try {
        sb.realtime.setAuth(session.access_token);
      } catch (e) {
        console.warn('Realtime setAuth:', e);
      }
    }
  }

  function scheduleReconnect() {
    if (!state.ready || !state.room) return;
    if (state.reconnectTimer) return;

    state.reconnectAttempts = (state.reconnectAttempts || 0) + 1;
    var delay = Math.min(6000, 1500 * Math.pow(1.3, state.reconnectAttempts - 1));
    console.log('Realtime reconnect scheduled in', Math.round(delay), 'ms (attempt', state.reconnectAttempts, ')');

    state.reconnectTimer = setTimeout(function () {
      state.reconnectTimer = null;
      if (state.ready && state.room) {
        if (!isWsConnected()) {
          try { sb.realtime.connect(); } catch (e) {}
        }
        subscribe();
      }
    }, delay);
  }

  function subscribe() {
    if (!state.room || !state.user) return;

    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer);
      state.reconnectTimer = null;
    }

    if (state.channel) {
      try { state.channel.untrack(); } catch (e) {}
      try { sb.removeChannel(state.channel); } catch (e) {}
      state.channel = null;
    }

    if (!isWsConnected()) {
      try { sb.realtime.connect(); } catch (e) {}
    }

    var ch = sb.channel('room:' + state.room, {
      config: {
        private: true,
        broadcast: { self: false },
        presence: { key: state.user.id },
      },
    });
    state.channel = ch;

    // 1. Instant WebSocket broadcast: sub-10ms peer-to-peer delivery across all devices
    ch.on('broadcast', { event: 'new_message' }, function (payload) {
      if (payload && payload.payload) {
        onRealtimeRow(payload.payload);
      }
    })
    .on('broadcast', { event: 'chat_cleared' }, function (payload) {
      if (payload && payload.payload && payload.payload.room_id === state.room) {
        state.clearedAt = Date.now();
        store('linkchat.clearedAt_' + state.room, String(state.clearedAt));
        state.msgs = new Map();
        render('auto');
        toast('Conversation cleared by participant.');
      }
    })
    .on('broadcast', { event: 'refresh_feed' }, function () {
      catchUp();
    })
    .on('broadcast', { event: 'typing' }, function (payload) {
      if (payload && payload.payload) {
        var p = payload.payload;
        var isSelf = (p.clientId && p.clientId === state.clientId) ||
                     (!p.clientId && p.name && state.name && p.name.trim().toLowerCase() === state.name.trim().toLowerCase());
        if (!isSelf) {
          handlePeerTyping(p.clientId || p.user_id || p.name, p.name);
        }
      }
    })
    .on('broadcast', { event: 'stop_typing' }, function (payload) {
      if (payload && payload.payload) {
        var p = payload.payload;
        handlePeerStopTyping(p.clientId || p.user_id || p.name);
      }
    })
    .on('broadcast', { event: 'read_ack' }, function (payload) {
      if (payload && payload.payload && payload.payload.reader_id !== (state.user && state.user.id)) {
        handleReadAck(payload.payload.up_to);
      }
    })
    // WebRTC Voice Calling Signaling
    .on('broadcast', { event: 'call_invite' }, function (payload) {
      if (payload && payload.payload) CallManager.handleIncomingInvite(payload.payload);
    })
    .on('broadcast', { event: 'call_accept' }, function (payload) {
      if (payload && payload.payload) CallManager.handlePeerAccept(payload.payload);
    })
    .on('broadcast', { event: 'call_decline' }, function (payload) {
      if (payload && payload.payload) CallManager.handlePeerDecline(payload.payload);
    })
    .on('broadcast', { event: 'call_offer' }, function (payload) {
      if (payload && payload.payload) CallManager.handleOffer(payload.payload);
    })
    .on('broadcast', { event: 'call_answer' }, function (payload) {
      if (payload && payload.payload) CallManager.handleAnswer(payload.payload);
    })
    .on('broadcast', { event: 'call_ice' }, function (payload) {
      if (payload && payload.payload) CallManager.handleIceCandidate(payload.payload);
    })
    .on('broadcast', { event: 'call_end' }, function (payload) {
      if (payload && payload.payload) CallManager.handleCallEnd(payload.payload);
    })
    .on('broadcast', { event: 'call_draw' }, function (payload) {
      if (payload && payload.payload) CallManager.handleIncomingDraw(payload.payload);
    })
    // Realtime Emoji Reactions
    .on('broadcast', { event: 'msg_react' }, function (payload) {
      if (payload && payload.payload) {
        var p = payload.payload;
        if (!p.msgId || !p.emoji) return;
        if (!activeReactions[p.msgId]) activeReactions[p.msgId] = {};
        if (!activeReactions[p.msgId][p.emoji]) activeReactions[p.msgId][p.emoji] = [];
        var users = activeReactions[p.msgId][p.emoji];
        var actorKey = p.userName || p.userId || 'peer';
        var idx = users.indexOf(actorKey);
        if (idx === -1) {
          users.push(actorKey);
        } else {
          users.splice(idx, 1);
        }
        render('keep');
      }
    })
    // 2. Database postgres_changes fallback (filtered in JavaScript to avoid walrus filter bugs)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      function (payload) {
        if (payload && payload.new && payload.new.room_id === state.room) {
          onRealtimeRow(payload.new);
        }
      })
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages' },
      function (payload) {
        if (payload && payload.old && payload.old.id) {
          state.msgs.delete(payload.old.id);
          render('auto');
        } else {
          catchUp();
        }
      })
    .on('presence', { event: 'sync' }, updatePresence)
    .subscribe(function (status, err) {
      if (ch !== state.channel) return;
      if (status === 'SUBSCRIBED') {
        state.reconnectAttempts = 0;
        setConnected(true);
        try {
          ch.track({ name: state.name, online_at: new Date().toISOString() });
        } catch (e) {}
        if (state.everSubscribed) catchUp();
        state.everSubscribed = true;
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.warn('Realtime channel:', status, err);
        if (!state.restHealthy) {
          setConnected(false);
        }
        scheduleReconnect();
      } else if (status === 'CLOSED') {
        if (state.channel === ch) {
          if (!state.restHealthy) {
            setConnected(false);
          }
          scheduleReconnect();
        }
      }
    });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.ready && state.room) {
      if (!isWsConnected() || !state.channel || state.channel.state !== 'joined') {
        if (!isWsConnected()) {
          try { sb.realtime.connect(); } catch (e) {}
        }
        subscribe();
      }
      catchUp();
    }
  });

  window.addEventListener('online', function () {
    if (state.ready && state.room) {
      if (!isWsConnected()) {
        try { sb.realtime.connect(); } catch (e) {}
      }
      subscribe();
      catchUp();
    }
  });

  // Health check: auto-recover if socket or channel drops silently
  setInterval(function () {
    if (state.ready && state.room) {
      var wsOk = isWsConnected();
      var chState = state.channel ? state.channel.state : 'closed';
      // If channel is joining, allow it time to complete without tearing down
      if (chState === 'joining') return;

      var ok = wsOk && chState === 'joined';
      if (!ok && !state.reconnectTimer) {
        console.log('Realtime health check notice: wsOk=' + wsOk + ', chState=' + chState + ', gently reconnecting…');
        scheduleReconnect();
      }
    }
  }, 10000);

  // Silent background catch-up: pulls new messages every 3s without reloading the page
  setInterval(function () {
    if (state.ready && state.room) {
      catchUp();
    }
  }, 3000);

  // ---------- Composer & Sending ----------
  function updateComposer() {
    var text = ui.input.value.trim();
    var len = ui.input.value.length;
    var hasText = text.length > 0;
    ui.sendBtn.disabled = !hasText || len > MAX_LEN;
    if (ui.voiceRecordBtn) {
      ui.voiceRecordBtn.hidden = hasText;
    }
    ui.sendBtn.hidden = !hasText;
    ui.counter.hidden = len < MAX_LEN - 100;
    ui.counter.textContent = len + ' / ' + MAX_LEN;
    ui.counter.classList.toggle('over', len > MAX_LEN);
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight + 2, 130) + 'px';
  }
  // ---------- Feeling (sender confirms; never attached automatically) ----------
  // chosen: the feeling to send. fromSuggestion: true when the sender tapped
  // the suggestion (it follows the text); false when picked from the list (kept).
  var feel = { chosen: null, fromSuggestion: false };

  function renderFeelBar() {
    if (!window.Feelings) return;
    var text = ui.input.value.trim();
    if (text.length < 3) {
      feel.chosen = null;
      ui.feelBar.hidden = true;
      ui.feelMenu.hidden = true;
      return;
    }
    ui.feelBar.hidden = false;
    var sug = window.Feelings.suggest(text);
    if (feel.chosen) {
      ui.feelChip.textContent = 'Feeling: ' + feel.chosen.emoji + ' ' + feel.chosen.label + ' · change';
    } else if (sug) {
      ui.feelChip.textContent = 'Sounds ' + sug.label.toLowerCase() + ' ' + sug.emoji + ' · tap to add';
    } else {
      ui.feelChip.textContent = '+ Add a feeling';
    }
  }

  function openFeelMenu() {
    ui.feelMenu.replaceChildren();
    var none = el('button', 'feel-option', 'No feeling');
    none.type = 'button';
    none.addEventListener('click', function () {
      feel.chosen = null;
      ui.feelMenu.hidden = true;
      renderFeelBar();
    });
    ui.feelMenu.append(none);
    window.Feelings.LIST.forEach(function (f) {
      var opt = el('button', 'feel-option', f.emoji + ' ' + f.label);
      opt.type = 'button';
      if (feel.chosen && feel.chosen.key === f.key) opt.classList.add('selected');
      opt.addEventListener('click', function () {
        feel.chosen = f;
        feel.fromSuggestion = false;
        ui.feelMenu.hidden = true;
        renderFeelBar();
      });
      ui.feelMenu.append(opt);
    });
    ui.feelMenu.hidden = false;
  }

  ui.feelChip.addEventListener('click', function () {
    var sug = window.Feelings && window.Feelings.suggest(ui.input.value);
    if (!feel.chosen && sug) {
      feel.chosen = sug;   // the sender tapped the suggestion: confirmed
      feel.fromSuggestion = true;
      renderFeelBar();
      return;
    }
    if (ui.feelMenu.hidden) openFeelMenu(); else ui.feelMenu.hidden = true;
  });

  // Tapping anywhere else closes the feeling list
  document.addEventListener('click', function (e) {
    if (!ui.feelMenu.hidden && !ui.feelBar.contains(e.target)) ui.feelMenu.hidden = true;
  });

  ui.input.addEventListener('input', function () {
    updateComposer();
    // Typing changes the text, so a suggestion the sender confirmed no longer applies
    if (feel.fromSuggestion) { feel.chosen = null; feel.fromSuggestion = false; }
    renderFeelBar();
    if (ui.input.value.trim().length > 0) {
      sendTypingSignal();
    } else {
      stopTypingSignal();
    }
  });

  ui.input.addEventListener('blur', function () {
    stopTypingSignal();
  });

  ui.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ui.composer.requestSubmit();
    }
  });

  // Anti-Spam / Rate Limiting (Max 4 messages per 3 seconds)
  var sendTimestamps = [];

  ui.composer.addEventListener('submit', function (e) {
    e.preventDefault();
    stopTypingSignal();
    var text = ui.input.value.trim();
    if (!text || text.length > MAX_LEN || !state.user) return;

    var now = Date.now();
    sendTimestamps = sendTimestamps.filter(function (t) { return now - t < 3000; });
    if (sendTimestamps.length >= 4) {
      toast('Slow down: Please wait a moment before sending another message ⏳');
      return;
    }
    sendTimestamps.push(now);

    if (state.replyingTo) {
      text = '[reply:' + encodeURIComponent(state.replyingTo.author) + ':' + encodeURIComponent(state.replyingTo.text) + ']' + text;
      clearReplyingTo();
    }

    if (feel.chosen && window.Feelings) {
      text = window.Feelings.encode(feel.chosen.key) + text;  // goes after any [reply:] tag
    }
    feel.chosen = null;

    var m = {
      id: uuid(), user_id: state.user.id, display_name: state.name, content: text,
      raw: null, ts: Date.now(), status: 'sending', seq: ++state.seq,
    };
    state.msgs.set(m.id, m);
    ui.input.value = '';
    updateComposer();
    renderFeelBar();
    render('bottom');
    playSendSound();
    insert(m);
  });

  // ---------- Photos ----------
  function shrinkPhoto(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error('Could not process this image.'));
        }, 'image/jpeg', 0.82);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('That file is not a supported image.'));
      };
      img.src = url;
    });
  }

  var isChoosingFile = false;
  ui.attachBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var pickPhoto = function () { isChoosingFile = true; ui.fileInput.click(); };
    if (window.Capsules) {
      window.Capsules.openAttachMenu({ onPhoto: pickPhoto });
    } else {
      pickPhoto();
    }
  });

  ui.fileInput.addEventListener('change', async function () {
    isChoosingFile = false;
    var file = ui.fileInput.files && ui.fileInput.files[0];
    ui.fileInput.value = '';
    if (!file || !state.user) return;
    if (!/^image\//.test(file.type)) { toast('Please choose an image file.'); return; }

    var blob;
    try { blob = await shrinkPhoto(file); } catch (e) { toast(e.message); return; }

    var id = uuid();
    var m = {
      id: id, user_id: state.user.id, display_name: state.name, content: '',
      image_path: state.user.id + '/' + id + '.jpg', blob: blob,
      localUrl: URL.createObjectURL(blob), uploaded: false,
      raw: null, ts: Date.now(), status: 'sending', seq: ++state.seq,
    };
    state.msgs.set(id, m);
    render('bottom');
    playSendSound();
    insert(m);
  });

  async function uploadPhoto(m) {
    var up = await sb.storage.from(BUCKET).upload(m.image_path, m.blob, {
      contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
    });
    if (up.error && !/exists|duplicate/i.test(up.error.message || '')) throw up.error;
    m.uploaded = true;
  }

  async function insert(m) {
    m.status = 'sending';
    m.error = null;
    render('auto');

    // Broadcast across Serverless Offline Mesh Network (Zero-Internet)
    if (window.MeshManager) {
      window.MeshManager.broadcast({
        type: 'chat_message',
        id: m.id,
        room_id: state.room,
        user_id: m.user_id,
        display_name: m.display_name,
        content: m.content,
        ts: m.ts || Date.now()
      });
    }

    // In 100% Airplane Mode / Offline without Internet
    if (!navigator.onLine) {
      m.status = 'sent';
      render('auto');
      toast('Sent via Offline Mesh Network ⚡');
      return;
    }

    try {
      if (m.blob && !m.uploaded) await uploadPhoto(m);

      var payloadContent = m.content || '';
      if (state.cryptoKey && payloadContent) {
        payloadContent = await E2EE.encryptText(state.cryptoKey, payloadContent);
        decryptedCache.set(payloadContent, m.content);
      }

      var res = await sb.from('messages')
        .insert({ id: m.id, room_id: state.room, display_name: m.display_name,
                  content: payloadContent, image_path: m.image_path || null })
        .select(COLUMNS)
        .single();

      if (res.error && res.error.code === '23505') {
        res = await baseQuery().eq('id', m.id).single();
      }
      if (res.error) throw res.error;
      upsert(res.data);

      // Instant broadcast to all other systems/devices in this room over WebSocket
      if (res.data && state.channel) {
        try {
          var broadcastRow = Object.assign({}, res.data, {
            content: payloadContent
          });
          state.channel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: broadcastRow
          });
          state.channel.send({
            type: 'broadcast',
            event: 'refresh_feed',
            payload: {}
          });
        } catch (e) {
          console.warn('Broadcast send:', e);
        }
      }

      // Immediately silent refresh messages from server on every send
      catchUp();
    } catch (err) {
      var cur = state.msgs.get(m.id);
      if (cur && cur.status !== 'sent') {
        cur.status = 'failed';
        cur.error = friendlyError(err);
        toast(cur.error);
      }
    }
    render('auto');
  }

  // ---------- Smart Link Sharing (with key) ----------
  ui.copyBtn.addEventListener('click', async function () {
    var base = location.href.split('?')[0].split('#')[0];
    var url = base + '?room=' + encodeURIComponent(state.room || 'general');
    if (state.roomKey) {
      url += '&key=' + encodeURIComponent(state.roomKey);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (e) {
      var ta = el('textarea');
      ta.value = url;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(state.room === 'general' ? 'Chat link copied! 📋' : 'Private room link copied (with key)! 📋');
  });

  // ---------- Clear Chat Feature (§16 Agency & Forgiveness) ----------
  if (ui.clearBtn && ui.clearModal) {
    ui.clearBtn.addEventListener('click', function () {
      ui.clearModal.hidden = false;
    });

    ui.clearCancelBtn.addEventListener('click', function () {
      ui.clearModal.hidden = true;
    });

    ui.clearModal.addEventListener('click', function (e) {
      if (e.target === ui.clearModal) {
        ui.clearModal.hidden = true;
      }
    });

    ui.clearConfirmBtn.addEventListener('click', async function () {
      var btn = ui.clearConfirmBtn;
      btn.disabled = true;
      btn.textContent = 'Clearing…';

      var roomId = state.room;
      var roomKey = state.roomKey;

      try {
        // 1. Delete messages from database via RPC
        var rpcRes = await sb.rpc('clear_room_messages', {
          p_room_id: roomId,
          p_access_key: roomKey || ''
        });

        if (rpcRes.error) {
          console.warn('RPC clear_room_messages notice:', rpcRes.error.message || rpcRes.error);
          // Fallback direct delete
          var directRes = await sb.from('messages').delete().eq('room_id', roomId);
          if (directRes.error) {
            console.warn('Direct delete messages notice:', directRes.error.message || directRes.error);
          }
        }

        // 2. Broadcast to all other devices in this room
        if (state.channel) {
          try {
            state.channel.send({
              type: 'broadcast',
              event: 'chat_cleared',
              payload: { room_id: roomId }
            });
          } catch (e) {}
        }
      } catch (err) {
        console.warn('Clear conversation error:', err);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Clear Chat';
        ui.clearModal.hidden = true;
      }

      // 3. Clear local state
      state.clearedAt = Date.now();
      store('linkchat.clearedAt_' + roomId, String(state.clearedAt));
      state.msgs = new Map();
      render('auto');
      toast('Conversation cleared from database & view.');
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([15]);
      }
    });
  }

  // ---------- Room picker & joining ----------
  if (ui.roomsBtn) {
    ui.roomsBtn.addEventListener('click', function () {
      leaveChat();
      showRoomPicker();
    });
  }

  if (ui.generalBtn) {
    ui.generalBtn.addEventListener('click', function () {
      joinGeneral();
    });
  }

  function setBtnState(btn, loading, defaultText, loadingText) {
    if (!btn) return;
    btn.disabled = Boolean(loading);
    var span = btn.querySelector('span');
    if (span) {
      span.textContent = loading ? (loadingText || 'Loading…') : defaultText;
    } else {
      btn.textContent = loading ? (loadingText || 'Loading…') : defaultText;
    }
  }

  // Expandable Forms Handler (No text fields shown until clicked!)
  function toggleSubform(type) {
    var joinCol = ui.colJoin;
    var createCol = ui.colCreate;
    var joinBtn = ui.toggleJoinFormBtn;
    var createBtn = ui.toggleCreateFormBtn;

    if (type === 'join') {
      var willOpen = joinCol ? joinCol.hidden : false;
      if (joinCol) joinCol.hidden = !willOpen;
      if (createCol) createCol.hidden = true;
      if (joinBtn) {
        joinBtn.classList.toggle('active', willOpen);
        joinBtn.setAttribute('aria-expanded', String(willOpen));
      }
      if (createBtn) {
        createBtn.classList.remove('active');
        createBtn.setAttribute('aria-expanded', 'false');
      }
      if (willOpen) {
        setTimeout(function () {
          if (joinCol) {
            joinCol.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          if (ui.roomIdInput) {
            ui.roomIdInput.focus({ preventScroll: true });
          }
        }, 120);
      }
    } else if (type === 'create') {
      var willOpen = createCol ? createCol.hidden : false;
      if (createCol) createCol.hidden = !willOpen;
      if (joinCol) joinCol.hidden = true;
      if (createBtn) {
        createBtn.classList.toggle('active', willOpen);
        createBtn.setAttribute('aria-expanded', String(willOpen));
      }
      if (joinBtn) {
        joinBtn.classList.remove('active');
        joinBtn.setAttribute('aria-expanded', 'false');
      }
      if (willOpen) {
        setTimeout(function () {
          if (createCol) {
            createCol.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          if (ui.newRoomId) {
            ui.newRoomId.focus({ preventScroll: true });
          }
        }, 120);
      }
    } else {
      // Hide all forms
      if (joinCol) joinCol.hidden = true;
      if (createCol) createCol.hidden = true;
      if (joinBtn) {
        joinBtn.classList.remove('active');
        joinBtn.setAttribute('aria-expanded', 'false');
      }
      if (createBtn) {
        createBtn.classList.remove('active');
        createBtn.setAttribute('aria-expanded', 'false');
      }
    }
  }

  if (ui.toggleJoinFormBtn) {
    ui.toggleJoinFormBtn.addEventListener('click', function () { toggleSubform('join'); });
  }
  if (ui.toggleCreateFormBtn) {
    ui.toggleCreateFormBtn.addEventListener('click', function () { toggleSubform('create'); });
  }
  if (ui.closeJoinFormBtn) {
    ui.closeJoinFormBtn.addEventListener('click', function () { toggleSubform('none'); });
  }
  if (ui.closeCreateFormBtn) {
    ui.closeCreateFormBtn.addEventListener('click', function () { toggleSubform('none'); });
  }

  var generalTile = $('general-tile');
  if (generalTile) {
    generalTile.addEventListener('click', function (e) {
      if (e.target.id !== 'general-btn' && !e.target.closest('#general-btn')) {
        joinGeneral();
      }
    });
  }

  // General Chat is a normal room now: it needs its key like every other room.
  function joinGeneral() {
    showRoomPicker();
    openKeyModal('general', DEFAULT_ROOM_NAME);
  }

  // Security: Brute-Force & Rate-Limiting Protection for Private Rooms
  var RoomSecurity = (function () {
    var failedAttempts = {}; // roomId -> { count: number, lockedUntil: number }

    function getLockRemaining(roomId) {
      if (!roomId) return 0;
      var entry = failedAttempts[roomId];
      if (!entry || !entry.lockedUntil) return 0;
      var remaining = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        entry.lockedUntil = 0;
        return 0;
      }
      return remaining;
    }

    function recordFailure(roomId) {
      if (!roomId) return 0;
      if (!failedAttempts[roomId]) {
        failedAttempts[roomId] = { count: 0, lockedUntil: 0 };
      }
      failedAttempts[roomId].count++;
      var count = failedAttempts[roomId].count;
      if (count >= 5) {
        failedAttempts[roomId].lockedUntil = Date.now() + 60000; // 60s lockout
      } else if (count >= 4) {
        failedAttempts[roomId].lockedUntil = Date.now() + 30000; // 30s lockout
      } else if (count >= 3) {
        failedAttempts[roomId].lockedUntil = Date.now() + 15000; // 15s lockout
      }
      return getLockRemaining(roomId);
    }

    function recordSuccess(roomId) {
      if (roomId) delete failedAttempts[roomId];
    }

    return {
      getLockRemaining: getLockRemaining,
      recordFailure: recordFailure,
      recordSuccess: recordSuccess
    };
  })();

  function clearStoredRoomKeys() {
    try {
      store(ROOM_KEY_PASS, null);
      var toRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && (k.indexOf('linkchat.roomKey_') === 0 || k === ROOM_KEY_PASS)) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }

  async function joinPrivateRoom(roomId, key) {
    var lockSec = RoomSecurity.getLockRemaining(roomId);
    if (lockSec > 0) {
      throw new Error('Security lockout: Too many failed attempts. Please wait ' + lockSec + 's.');
    }

    var res = await sb.rpc('join_room', { p_room_id: roomId, p_access_key: key });
    if (res.error) {
      RoomSecurity.recordFailure(roomId);
      throw res.error;
    }
    var data = res.data;
    if (!data.ok) {
      RoomSecurity.recordFailure(roomId);
      throw new Error(data.error || 'Could not join room.');
    }
    RoomSecurity.recordSuccess(roomId);
    state.room = roomId;
    state.roomDisplayName = data.room_name || roomId;
    state.roomKey = key; // In-memory only — never written to disk or localStorage!
    markRoomAsRead(roomId);

    // Security: Immediately scrub secret key from URL so it is never exposed in address bar or history
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.has('key')) {
        u.searchParams.delete('key');
        window.history.replaceState({}, '', u.toString());
      }
    } catch (e) {}

    enterChat();
  }

  if (ui.joinRoomForm) {
    ui.joinRoomForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var roomId = (ui.roomIdInput.value || '').trim().toLowerCase();
      var key = (ui.roomKeyInput.value || '').trim();
      ui.roomJoinError.textContent = '';

      if (!roomId) { ui.roomJoinError.textContent = 'Enter a room ID.'; return; }

      var lockSec = RoomSecurity.getLockRemaining(roomId);
      if (lockSec > 0) {
        ui.roomJoinError.textContent = '🔒 Security lockout: Too many failed attempts. Try again in ' + lockSec + 's.';
        return;
      }

      if (!key) { ui.roomJoinError.textContent = 'Enter the access key.'; return; }

      setBtnState(ui.roomJoinBtn, true, 'Join Private Room', 'Joining…');
      try {
        await joinPrivateRoom(roomId, key);
        if (ui.roomKeyInput) ui.roomKeyInput.value = '';
      } catch (err) {
        if (ui.roomKeyInput) {
          ui.roomKeyInput.value = '';
          ui.roomKeyInput.focus();
        }
        var rem = RoomSecurity.getLockRemaining(roomId);
        if (rem > 0) {
          ui.roomJoinError.textContent = '🔒 Incorrect key. Locked for ' + rem + 's due to repeated failures.';
        } else {
          ui.roomJoinError.textContent = friendlyError(err);
        }
        setBtnState(ui.roomJoinBtn, false, 'Join Private Room');
      }
    });
  }

  if (ui.createRoomForm) {
    ui.createRoomForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var roomId = (ui.newRoomId.value || '').trim().toLowerCase();
      var roomName = (ui.newRoomName.value || '').trim();
      var key = (ui.newRoomKey.value || '').trim();
      ui.createRoomError.textContent = '';

      if (!roomId) { ui.createRoomError.textContent = 'Enter a room ID.'; return; }
      if (!roomName) { ui.createRoomError.textContent = 'Enter a room name.'; return; }
      if (key.length < 4) { ui.createRoomError.textContent = 'Access key must be at least 4 characters.'; return; }

      setBtnState(ui.createRoomBtn, true, 'Create & Join Room', 'Creating…');
      try {
        var res = await sb.rpc('create_room', { p_room_id: roomId, p_room_name: roomName, p_access_key: key });
        if (res.error) throw res.error;
        var data = res.data;
        if (!data.ok) {
          ui.createRoomError.textContent = data.error || 'Could not create room.';
          setBtnState(ui.createRoomBtn, false, 'Create & Join Room');
          return;
        }
        toast('Room created! Share link with your team.');
        state.room = roomId;
        state.roomDisplayName = roomName;
        state.roomKey = key; // In-memory only!
        if (ui.newRoomKey) ui.newRoomKey.value = '';
        enterChat();
      } catch (err) {
        ui.createRoomError.textContent = friendlyError(err);
        setBtnState(ui.createRoomBtn, false, 'Create & Join Room');
      }
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Room Views & Apple Dropdown ----------
  var currentSelectedRoom = { id: null, name: 'No room selected', isPrivate: true };
  var unreadCountsByRoom = {};

  function markRoomAsRead(roomId) {
    if (!roomId) return;
    store('linkchat.lastRead_' + roomId, String(Date.now()));
    unreadCountsByRoom[roomId] = 0;
  }

  function getRoomLastRead(roomId) {
    if (!roomId) return 0;
    var saved = load('linkchat.lastRead_' + roomId);
    if (saved) return parseInt(saved, 10);
    var firstJoin = load('linkchat.firstJoinTs');
    return firstJoin ? parseInt(firstJoin, 10) : 0;
  }

  function formatMsgCount(count) {
    if (!count || count <= 0) return '';
    if (count === 1) return '1 unread';
    return count + ' unread';
  }

  function setRoomViewMode(mode) {
    var isTiles = mode === 'tiles';
    store('linkchat.roomViewMode', isTiles ? 'tiles' : 'dropdown');
    if (ui.roomsTilesView) ui.roomsTilesView.hidden = !isTiles;
    if (ui.roomsDropdownView) ui.roomsDropdownView.hidden = isTiles;
    if (ui.viewTilesBtn) {
      ui.viewTilesBtn.classList.toggle('active', isTiles);
      ui.viewTilesBtn.setAttribute('aria-selected', String(isTiles));
    }
    if (ui.viewDropdownBtn) {
      ui.viewDropdownBtn.classList.toggle('active', !isTiles);
      ui.viewDropdownBtn.setAttribute('aria-selected', String(!isTiles));
    }
  }

  function selectDropdownRoom(roomId, roomName, isPrivate) {
    currentSelectedRoom = { id: roomId, name: roomName, isPrivate: Boolean(isPrivate) };
    if (ui.dropdownTriggerName) {
      ui.dropdownTriggerName.textContent = roomName || roomId;
    }
    var count = unreadCountsByRoom[roomId] || 0;
    var countStr = count > 0 ? (' • <strong class="unread-text">' + count + ' unread</strong>') : '';
    if (ui.dropdownTriggerSub) {
      ui.dropdownTriggerSub.innerHTML = (roomId ? ('#' + roomId) : 'Join with a room ID and key, or create one') + countStr;
    }
    if (ui.dropdownTriggerAvatar) {
      ui.dropdownTriggerAvatar.textContent = isPrivate ? (roomName || roomId).charAt(0).toUpperCase() : '💬';
      ui.dropdownTriggerAvatar.style.background = isPrivate ? 'linear-gradient(135deg, #af52de, #5856d6)' : 'var(--apple-blue-gradient)';
    }
    if (ui.dropdownDeleteBtn) {
      ui.dropdownDeleteBtn.hidden = !isPrivate || !roomId || roomId === 'general';
    }
    if (ui.dropdownItemsList) {
      var items = ui.dropdownItemsList.querySelectorAll('.dropdown-item');
      items.forEach(function (btn) {
        if (btn.dataset.roomId === roomId) {
          btn.classList.add('selected');
        } else {
          btn.classList.remove('selected');
        }
      });
    }
  }

  function toggleDropdown(force) {
    if (!ui.dropdownPopover) return;
    var open = typeof force === 'boolean' ? force : ui.dropdownPopover.hidden;
    ui.dropdownPopover.hidden = !open;
    if (ui.dropdownTriggerBtn) {
      ui.dropdownTriggerBtn.classList.toggle('open', open);
      ui.dropdownTriggerBtn.setAttribute('aria-expanded', String(open));
    }
  }

  document.addEventListener('click', function (e) {
    if (!ui.dropdownPopover || ui.dropdownPopover.hidden) return;
    var inDropdown = ui.dropdownTriggerBtn && ui.dropdownTriggerBtn.contains(e.target);
    var inPopover = ui.dropdownPopover && ui.dropdownPopover.contains(e.target);
    if (!inDropdown && !inPopover) {
      toggleDropdown(false);
    }
  });

  // ---------- Delete Room Dialog & RPC Execution ----------
  var pendingDeleteRoom = null;

  function openDeleteRoomModal(roomId, roomName) {
    if (roomId === 'general' || roomId === DEFAULT_ROOM) {
      toast('General Chat cannot be deleted.');
      return;
    }
    pendingDeleteRoom = { id: roomId, name: roomName || roomId };
    if (ui.deleteRoomTitle) {
      ui.deleteRoomTitle.textContent = 'Delete Room';
    }
    if (ui.deleteRoomDesc) {
      ui.deleteRoomDesc.textContent = 'Permanently delete "' + (roomName || roomId) + '" (#' + roomId + ') and all of its messages? This action cannot be undone.';
    }
    if (ui.deleteRoomKeyInput) {
      ui.deleteRoomKeyInput.value = '';
    }
    if (ui.deleteKeyGroup) {
      ui.deleteKeyGroup.hidden = false;
    }
    if (ui.deleteRoomError) {
      ui.deleteRoomError.textContent = '';
    }
    if (ui.deleteRoomModal) {
      ui.deleteRoomModal.hidden = false;
    }
    if (ui.deleteRoomKeyInput) {
      setTimeout(function () { ui.deleteRoomKeyInput.focus(); }, 100);
    }
  }

  function closeDeleteRoomModal() {
    if (ui.deleteRoomModal) ui.deleteRoomModal.hidden = true;
    pendingDeleteRoom = null;
  }

  async function executeDeleteRoom(roomId, accessKey) {
    if (roomId === 'general' || roomId === DEFAULT_ROOM) {
      throw new Error('General Chat cannot be deleted.');
    }

    // Try RPC first (defined in supabase/005_delete_room.sql)
    var rpcRes = await sb.rpc('delete_room', {
      p_room_id: roomId,
      p_access_key: accessKey || ''
    });

    if (rpcRes.error) {
      // Fallback: direct delete if user is creator
      var directRes = await sb.from('rooms').delete().eq('id', roomId);
      if (directRes.error) {
        if (rpcRes.error.message && rpcRes.error.message.indexOf('function public.delete_room') !== -1) {
          throw new Error('Please run supabase/005_delete_room.sql in your Supabase SQL Editor to enable room deletion.');
        }
        throw new Error(rpcRes.error.message || directRes.error.message);
      }
    } else if (rpcRes.data && rpcRes.data.ok === false) {
      throw new Error(rpcRes.data.error || 'Failed to delete room');
    }

    // Clean up local storage
    store('linkchat.roomKey_' + roomId, null);

    // If currently inside the deleted room, leave to Room Picker
    if (state.room === roomId) {
      state.room = DEFAULT_ROOM;
      state.roomDisplayName = DEFAULT_ROOM_NAME;
      state.roomKey = '';
      store(ROOM_KEY, null);
      store(ROOM_NAME_KEY, null);
      store(ROOM_KEY_PASS, null);
      try {
        var u = new URL(window.location.href);
        u.searchParams.delete('room');
        u.searchParams.delete('key');
        window.history.replaceState({}, '', u.toString());
      } catch (e) {}
      showRoomPicker();
    }

    toast('Room deleted successfully.');
    closeDeleteRoomModal();
    selectDropdownRoom(null, 'No room selected', true);
    loadRoomsList();
  }

  async function loadRoomsList() {
    var tilesContainer = $('rooms-list-container');
    var dropList = $('dropdown-items-list');
    if (tilesContainer) tilesContainer.innerHTML = '<div class="rooms-loading">Loading active rooms…</div>';
    if (dropList) dropList.innerHTML = '<div class="rooms-loading">Loading rooms…</div>';

    var rooms = [];
    unreadCountsByRoom = {};

    try {
      var res = await sb.rpc('my_rooms');
      if (!res.error && res.data) {
        rooms = res.data;
      } else {
        var fallback = await sb.from('rooms').select('id, name, created_at').order('created_at', { ascending: false });
        if (!fallback.error && fallback.data) rooms = fallback.data;
      }
    } catch (e) {
      console.warn('Could not load rooms:', e);
    }

    try {
      // Fetch recent messages to calculate unread message counts per room
      var countRes = await sb.from('messages')
        .select('room_id, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(600);

      if (!countRes.error && countRes.data) {
        var myUserId = state.user && state.user.id;
        countRes.data.forEach(function (m) {
          if (!m || !m.room_id) return;
          if (myUserId && m.user_id === myUserId) return; // Own messages never count as unread

          var lastRead = getRoomLastRead(m.room_id);
          var msgTs = Date.parse(m.created_at);

          // Only messages sent after the user last read the room count as unread
          if (lastRead > 0) {
            if (msgTs > lastRead) {
              unreadCountsByRoom[m.room_id] = (unreadCountsByRoom[m.room_id] || 0) + 1;
            }
          }
        });
      }
    } catch (e) {
      console.warn('Could not load unread message counts:', e);
    }

    // Active room has 0 unread
    if (state.room) {
      unreadCountsByRoom[state.room] = 0;
    }

    renderRoomsDirectory(rooms, unreadCountsByRoom);
  }

  function renderRoomsDirectory(rooms, msgCounts) {
    msgCounts = msgCounts || unreadCountsByRoom || {};

    // 1. Populate Tiles view
    var tilesContainer = $('rooms-list-container');
    if (tilesContainer) {
      tilesContainer.innerHTML = '';

      if (!rooms || !rooms.length) {
        tilesContainer.innerHTML = '<div class="rooms-loading">No rooms yet. Join one with its ID and key, or create a room.</div>';
      }

      if (rooms && rooms.length) {
        rooms.forEach(function (r) {
          var card = document.createElement('div');
          card.className = 'room-tile-card';
          var initial = (r.name || r.id || 'R').charAt(0).toUpperCase();
          var rCount = msgCounts[r.id] || 0;
          var rSub = '#' + escapeHtml(r.id) + (rCount > 0 ? (' • <strong class="unread-text">' + rCount + ' unread</strong>') : '');
          var rBadgeHtml = rCount > 0
            ? '<span class="room-tile-count-badge unread" title="' + rCount + ' unread messages">● ' + rCount + ' new</span>'
            : '';

          card.innerHTML =
            '<div class="room-tile-avatar private">' + escapeHtml(initial) + '</div>' +
            '<div class="room-tile-meta">' +
              '<strong>' + escapeHtml(r.name || r.id) + '</strong>' +
              '<small>' + rSub + '</small>' +
            '</div>' +
            rBadgeHtml +
            '<span class="room-tile-badge locked">🔒 KEY</span>' +
            (r.id !== 'general' ? (
              '<button type="button" class="btn-tile-delete" title="Delete room" aria-label="Delete room ' + escapeHtml(r.name || r.id) + '">' +
                '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                  '<polyline points="3 6 5 6 21 6"></polyline>' +
                  '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
                '</svg>' +
              '</button>'
            ) : '');

          card.onclick = function (e) {
            var delBtn = e.target.closest('.btn-tile-delete');
            if (delBtn) {
              e.stopPropagation();
              openDeleteRoomModal(r.id, r.name || r.id);
              return;
            }
            handleRoomTileClick(r.id, r.name || r.id);
          };
          tilesContainer.appendChild(card);
        });
      }
    }

    // 2. Populate Dropdown view
    var dropList = $('dropdown-items-list');
    if (dropList) {
      dropList.innerHTML = '';

      if (!rooms || !rooms.length) {
        dropList.innerHTML = '<div class="rooms-loading">No rooms yet. Join one with its ID and key, or create a room.</div>';
      }

      if (rooms && rooms.length) {
        rooms.forEach(function (r) {
          var initial = (r.name || r.id || 'R').charAt(0).toUpperCase();
          var rCount = msgCounts[r.id] || 0;
          var rSub = '#' + escapeHtml(r.id) + (rCount > 0 ? (' • <strong class="unread-text">' + rCount + ' unread</strong>') : ' • 🔒 Key Required');
          var row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.width = '100%';

          var itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.className = 'dropdown-item' + (currentSelectedRoom.id === r.id ? ' selected' : '');
          itemBtn.dataset.roomId = r.id;
          itemBtn.style.flex = '1';
          itemBtn.innerHTML =
            '<div class="dropdown-item-avatar" style="background: linear-gradient(135deg, #af52de, #5856d6);">' + escapeHtml(initial) + '</div>' +
            '<div class="dropdown-item-meta">' +
              '<strong>' + escapeHtml(r.name || r.id) + '</strong>' +
              '<small>' + rSub + '</small>' +
            '</div>' +
            (rCount > 0 ? ('<span class="room-tile-count-badge unread" style="margin-right: 6px;">● ' + rCount + '</span>') : '');
          itemBtn.onclick = function () {
            selectDropdownRoom(r.id, r.name || r.id, true);
            toggleDropdown(false);
          };

          var delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'btn-item-delete';
          delBtn.title = 'Delete room';
          delBtn.setAttribute('aria-label', 'Delete room ' + (r.name || r.id));
          delBtn.innerHTML =
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
              '<polyline points="3 6 5 6 21 6"></polyline>' +
              '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
            '</svg>';
          delBtn.onclick = function (e) {
            e.stopPropagation();
            toggleDropdown(false);
            openDeleteRoomModal(r.id, r.name || r.id);
          };

          row.appendChild(itemBtn);
          if (r.id !== 'general') row.appendChild(delBtn);
          dropList.appendChild(row);
        });
      }
    }

    // Refresh trigger sub with latest count
    var stillThere = (rooms || []).some(function (r) { return r.id === currentSelectedRoom.id; });
    if (!stillThere) {
      currentSelectedRoom = rooms && rooms.length
        ? { id: rooms[0].id, name: rooms[0].name || rooms[0].id, isPrivate: true }
        : { id: null, name: 'No rooms yet', isPrivate: true };
    }
    selectDropdownRoom(currentSelectedRoom.id, currentSelectedRoom.name, currentSelectedRoom.isPrivate);
  }

  function handleRoomTileClick(roomId, roomName) {
    openKeyModal(roomId, roomName);
  }

  var pendingKeyRoomId = null;
  function openKeyModal(roomId, roomName) {
    pendingKeyRoomId = roomId;
    var modal = $('key-modal');
    var title = $('key-modal-title');
    var desc = $('key-modal-desc');
    var input = $('key-modal-input');
    var err = $('key-modal-error');
    var confirmBtn = $('key-modal-confirm-btn');

    if (title) title.textContent = 'Join ' + (roomName || roomId);
    if (desc) desc.textContent = 'Enter the access key for #' + roomId + ' to enter.';
    if (input) input.value = '';
    if (err) err.textContent = '';

    var lockSec = RoomSecurity.getLockRemaining(roomId);
    if (lockSec > 0) {
      if (err) err.textContent = '🔒 Security lockout: Too many failed attempts. Try again in ' + lockSec + 's.';
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Locked (' + lockSec + 's)';
      }
    } else {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Join Room';
      }
    }

    if (modal) modal.hidden = false;
    if (input) setTimeout(function () { input.focus(); }, 100);
  }

  function closeKeyModal() {
    var modal = $('key-modal');
    if (modal) modal.hidden = true;
    var input = $('key-modal-input');
    if (input) input.value = '';
    var err = $('key-modal-error');
    if (err) err.textContent = '';
    pendingKeyRoomId = null;
  }

  var keyModalForm = $('key-modal-form');
  if (keyModalForm) {
    keyModalForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var keyInput = $('key-modal-input');
      var err = $('key-modal-error');
      var confirmBtn = $('key-modal-confirm-btn');
      var key = (keyInput && keyInput.value || '').trim();

      if (!pendingKeyRoomId) return;

      var lockSec = RoomSecurity.getLockRemaining(pendingKeyRoomId);
      if (lockSec > 0) {
        if (err) err.textContent = '🔒 Security lockout: Too many failed attempts. Try again in ' + lockSec + 's.';
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Locked (' + lockSec + 's)';
        }
        return;
      }

      if (!key) {
        if (err) err.textContent = 'Enter the access key.';
        return;
      }

      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Verifying…'; }
      if (err) err.textContent = '';

      try {
        await joinPrivateRoom(pendingKeyRoomId, key);
        closeKeyModal();
      } catch (submitErr) {
        var lockRemaining = RoomSecurity.recordFailure(pendingKeyRoomId);
        if (keyInput) {
          keyInput.value = '';
          keyInput.focus();
        }
        if (lockRemaining > 0) {
          if (err) err.textContent = '🔒 Incorrect key. Locked for ' + lockRemaining + 's due to repeated failures.';
          if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Locked (' + lockRemaining + 's)';
          }
        } else {
          if (err) err.textContent = '🔒 Incorrect access key. Please verify and try again.';
          if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Join Room';
          }
        }
      }
    });
  }

  var keyModalCancel = $('key-modal-cancel-btn');
  if (keyModalCancel) {
    keyModalCancel.addEventListener('click', closeKeyModal);
  }

  var refreshRoomsBtn = $('refresh-rooms-btn');
  if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener('click', function () {
      loadRoomsList();
    });
  }

  // View mode switcher: Dropdown vs Tiles
  if (ui.viewDropdownBtn) {
    ui.viewDropdownBtn.addEventListener('click', function () {
      setRoomViewMode('dropdown');
    });
  }
  if (ui.viewTilesBtn) {
    ui.viewTilesBtn.addEventListener('click', function () {
      setRoomViewMode('tiles');
    });
  }

  // Apple Dropdown trigger & actions
  if (ui.dropdownTriggerBtn) {
    ui.dropdownTriggerBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleDropdown();
    });
  }

  if (ui.dropdownEnterBtn) {
    ui.dropdownEnterBtn.addEventListener('click', function () {
      if (!currentSelectedRoom.id) {
        toast('Join a room with its ID and key, or create one.');
        return;
      }
      handleRoomTileClick(currentSelectedRoom.id, currentSelectedRoom.name);
    });
  }

  if (ui.dropdownDeleteBtn) {
    ui.dropdownDeleteBtn.addEventListener('click', function () {
      if (currentSelectedRoom.isPrivate) {
        openDeleteRoomModal(currentSelectedRoom.id, currentSelectedRoom.name);
      }
    });
  }

  // Delete Room in Header
  if (ui.deleteCurrentRoomBtn) {
    ui.deleteCurrentRoomBtn.addEventListener('click', function () {
      if (state.room && state.room !== 'general' && state.room !== DEFAULT_ROOM) {
        openDeleteRoomModal(state.room, state.roomDisplayName);
      }
    });
  }

  // Mobile Header More Menu Actions
  function closeHeaderMenu() {
    if (ui.headerMoreMenu) ui.headerMoreMenu.hidden = true;
    if (ui.headerMoreBtn) ui.headerMoreBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleHeaderMenu(e) {
    if (e) e.stopPropagation();
    if (!ui.headerMoreMenu) return;
    var isOpen = !ui.headerMoreMenu.hidden;
    ui.headerMoreMenu.hidden = isOpen;
    if (ui.headerMoreBtn) ui.headerMoreBtn.setAttribute('aria-expanded', String(!isOpen));
  }

  if (ui.headerMoreBtn) {
    ui.headerMoreBtn.addEventListener('click', toggleHeaderMenu);
  }

  document.addEventListener('click', function (e) {
    if (ui.headerMoreMenu && !ui.headerMoreMenu.hidden) {
      if (!ui.headerMoreMenu.contains(e.target) && e.target !== ui.headerMoreBtn && !ui.headerMoreBtn.contains(e.target)) {
        closeHeaderMenu();
      }
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.headerMoreMenu && !ui.headerMoreMenu.hidden) {
      closeHeaderMenu();
    }
  });

  if (ui.menuCopyBtn) {
    ui.menuCopyBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.copyBtn) ui.copyBtn.click();
    });
  }
  if (ui.menuQrBtn) {
    ui.menuQrBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.qrBtn) ui.qrBtn.click();
    });
  }
  if (ui.menuNotifBtn) {
    ui.menuNotifBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.notifBtn) ui.notifBtn.click();
    });
  }
  if (ui.menuThemeBtn) {
    ui.menuThemeBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.themeBtn) ui.themeBtn.click();
    });
  }
  if (ui.menuClearBtn) {
    ui.menuClearBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.clearBtn) ui.clearBtn.click();
    });
  }
  if (ui.menuPanicBtn) {
    ui.menuPanicBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.panicBtn) ui.panicBtn.click();
    });
  }
  if (ui.menuDeleteRoomBtn) {
    ui.menuDeleteRoomBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.deleteCurrentRoomBtn) ui.deleteCurrentRoomBtn.click();
    });
  }
  if (ui.menuLeaveBtn) {
    ui.menuLeaveBtn.addEventListener('click', function () {
      closeHeaderMenu();
      if (ui.leaveBtn) ui.leaveBtn.click();
    });
  }

  // =========================================================================
  // LINKCHAT v4.0 — FEATURE 1: SERVERLESS OFFLINE MESH NETWORK
  // =========================================================================
  var meshOfferCode = null;

  async function openMeshModal() {
    if (!ui.meshModal) return;
    ui.meshModal.hidden = false;
    await switchMeshTab('qr');
    updateMeshPeersUI();
  }

  function closeMeshModal() {
    if (!ui.meshModal) return;
    ui.meshModal.hidden = true;
    if (window.MeshManager) {
      window.MeshManager.stopQRScanner();
    }
  }

  function updateMeshPeersUI() {
    var count = window.MeshManager ? window.MeshManager.getConnectedCount() : 0;
    if (ui.meshPeersCount) ui.meshPeersCount.textContent = count + ' Connected';
    if (ui.meshStatusText) {
      ui.meshStatusText.textContent = count > 0 ? ('Mesh: ' + count + ' P2P') : 'Mesh: Ready';
    }
  }

  async function switchMeshTab(tab) {
    if (ui.meshTabQr) ui.meshTabQr.classList.toggle('active', tab === 'qr');
    if (ui.meshTabScan) ui.meshTabScan.classList.toggle('active', tab === 'scan');
    if (ui.meshTabManual) ui.meshTabManual.classList.toggle('active', tab === 'manual');

    if (ui.meshViewQr) ui.meshViewQr.hidden = tab !== 'qr';
    if (ui.meshViewScan) ui.meshViewScan.hidden = tab !== 'scan';
    if (ui.meshViewManual) ui.meshViewManual.hidden = tab !== 'manual';

    if (tab === 'qr') {
      if (window.MeshManager) window.MeshManager.stopQRScanner();
      await generateMyMeshQR();
    } else if (tab === 'scan') {
      startMeshCameraScan();
    } else {
      if (window.MeshManager) window.MeshManager.stopQRScanner();
    }
  }

  async function generateMyMeshQR() {
    if (!window.MeshManager || !ui.meshQrTarget || typeof qrcode !== 'function') return;
    ui.meshQrTarget.innerHTML = '<div style="padding:24px; font-size:12.5px; opacity:0.75;">Generating P2P Optical Offer SDP…</div>';
    try {
      meshOfferCode = await window.MeshManager.createOfferPairing();
      var qr = qrcode(0, 'M');
      qr.addData('mesh:' + meshOfferCode);
      qr.make();
      ui.meshQrTarget.innerHTML = qr.createSvgTag(5, 4);
    } catch (e) {
      ui.meshQrTarget.innerHTML = '<div style="padding:16px; font-size:12px; color:var(--apple-red);">SDP Generation note: ' + escapeHtml(e.message) + '</div>';
    }
  }

  async function startMeshCameraScan() {
    if (!window.MeshManager || !ui.meshCameraFeed) return;
    try {
      if (ui.meshScanStatusText) ui.meshScanStatusText.textContent = 'Point camera at peer device’s LinkChat QR…';
      await window.MeshManager.startQRScanner(ui.meshCameraFeed, async function (scannedCode) {
        if (!scannedCode) return;
        playSendSound();
        toast('Peer QR detected! Establishing direct P2P DataChannel…');
        var payload = scannedCode.replace(/^mesh:/, '');
        try {
          await window.MeshManager.createAnswerPairing(payload);
          toast('P2P Mesh Handshake complete! ⚡');
          updateMeshPeersUI();
          closeMeshModal();
        } catch (err) {
          toast('Handshake note: ' + err.message);
        }
      });
    } catch (err) {
      if (ui.meshScanStatusText) {
        ui.meshScanStatusText.textContent = 'Camera note: ' + err.message + '. Use Manual Key tab below.';
      }
    }
  }

  if (ui.meshBtn) ui.meshBtn.addEventListener('click', openMeshModal);
  if (ui.meshPill) ui.meshPill.addEventListener('click', openMeshModal);
  if (ui.meshCloseBtn) ui.meshCloseBtn.addEventListener('click', closeMeshModal);

  if (ui.meshTabQr) ui.meshTabQr.addEventListener('click', function () { switchMeshTab('qr'); });
  if (ui.meshTabScan) ui.meshTabScan.addEventListener('click', function () { switchMeshTab('scan'); });
  if (ui.meshTabManual) ui.meshTabManual.addEventListener('click', function () { switchMeshTab('manual'); });

  if (ui.meshCopyOfferBtn) {
    ui.meshCopyOfferBtn.addEventListener('click', async function () {
      if (!meshOfferCode) await generateMyMeshQR();
      if (meshOfferCode && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText('mesh:' + meshOfferCode);
          toast('Handshake Offer Code copied to clipboard! 📋');
        } catch (e) {
          toast('Copy code manually from input.');
        }
      }
    });
  }

  if (ui.meshConnectManualBtn) {
    ui.meshConnectManualBtn.addEventListener('click', async function () {
      var val = (ui.meshManualInput && ui.meshManualInput.value || '').trim();
      if (!val) { toast('Please paste peer handshake code.'); return; }
      val = val.replace(/^mesh:/, '');
      try {
        ui.meshConnectManualBtn.disabled = true;
        ui.meshConnectManualBtn.textContent = 'Connecting…';
        await window.MeshManager.createAnswerPairing(val);
        toast('Connected to peer via direct WebRTC DataChannel! ⚡');
        updateMeshPeersUI();
        closeMeshModal();
      } catch (e) {
        toast('Connection note: ' + e.message);
      } finally {
        ui.meshConnectManualBtn.disabled = false;
        ui.meshConnectManualBtn.textContent = 'Connect to Peer';
      }
    });
  }

  if (ui.meshToggleCameraBtn) {
    ui.meshToggleCameraBtn.addEventListener('click', function () {
      startMeshCameraScan();
    });
  }

  // =========================================================================
  // LINKCHAT v4.0 — FEATURE 2: IN-CHAT GAMING ARENA (LAST PRIORITY)
  // =========================================================================
  function openArenaModal(gameName) {
    if (!ui.arenaModal) return;
    ui.arenaModal.hidden = false;
    if (window.GameArena) {
      window.GameArena.init();
      if (gameName) window.GameArena.switchGame(gameName);
    }
  }

  function closeArenaModal() {
    if (!ui.arenaModal) return;
    ui.arenaModal.hidden = true;
    if (window.GameArena) {
      window.GameArena.stop();
    }
  }

  if (ui.arenaCloseBtn) ui.arenaCloseBtn.addEventListener('click', closeArenaModal);
  if (ui.arenaTabHockey) ui.arenaTabHockey.addEventListener('click', function () {
    if (window.GameArena) window.GameArena.switchGame('hockey');
  });
  if (ui.arenaTabChess) ui.arenaTabChess.addEventListener('click', function () {
    if (window.GameArena) window.GameArena.switchGame('chess');
  });
  if (ui.arenaTabSnake) ui.arenaTabSnake.addEventListener('click', function () {
    if (window.GameArena) window.GameArena.switchGame('snake');
  });
  if (ui.arenaRestartBtn) ui.arenaRestartBtn.addEventListener('click', function () {
    if (window.GameArena) window.GameArena.restart();
  });
  if (ui.arenaInviteBtn) ui.arenaInviteBtn.addEventListener('click', function () {
    var inv = '🎮 Let’s play in the Gaming Arena! Tap More (...) -> Gaming Arena to duel.';
    ui.input.value = inv;
    closeArenaModal();
    ui.composer.requestSubmit();
  });

  // Mobile More Menu Actions for v4 Features
  if (ui.menuMeshBtn) {
    ui.menuMeshBtn.addEventListener('click', function () {
      closeHeaderMenu();
      openMeshModal();
    });
  }
  if (ui.menuArenaBtn) {
    ui.menuArenaBtn.addEventListener('click', function () {
      closeHeaderMenu();
      openArenaModal('hockey');
    });
  }

  // Delete Room Confirmation Modal Form
  if (ui.deleteRoomForm) {
    ui.deleteRoomForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!pendingDeleteRoom) return;
      var keyInput = ui.deleteRoomKeyInput;
      var err = ui.deleteRoomError;
      var confirmBtn = ui.deleteRoomConfirmBtn;
      var key = (keyInput && keyInput.value || '').trim();

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting…';
      }
      if (err) err.textContent = '';

      try {
        await executeDeleteRoom(pendingDeleteRoom.id, key);
      } catch (e) {
        if (err) err.textContent = friendlyError(e);
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Delete Room';
        }
      }
    });
  }

  if (ui.deleteRoomCancelBtn) {
    ui.deleteRoomCancelBtn.addEventListener('click', closeDeleteRoomModal);
  }

  var changeNameBtn = $('change-name-btn');
  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', function () {
      store(NAME_KEY, null);
      state.name = '';
      showJoin('');
    });
  }

  if (ui.roomBackBtn) {
    ui.roomBackBtn.addEventListener('click', function () {
      store(NAME_KEY, null);
      state.name = '';
      showJoin('');
    });
  }

  // ---------- Screen Transitions ----------
  function show(screen) {
    ui.join.hidden = screen !== 'join';
    if (ui.roomPicker) ui.roomPicker.hidden = screen !== 'rooms';
    ui.chat.hidden = screen !== 'chat';
    ui.setup.hidden = screen !== 'setup';
  }

  function showJoin(prefill) {
    ui.nameInput.value = prefill || '';
    ui.joinError.textContent = '';
    ui.joinBtn.disabled = false;
    ui.joinBtn.textContent = 'Continue';
    show('join');
    ui.nameInput.focus();
  }

  function showRoomPicker() {
    CallManager.endCall(false);
    if (state.room) {
      markRoomAsRead(state.room);
    }
    clearStoredRoomKeys();
    state.room = null;
    state.roomDisplayName = '';
    state.roomKey = '';
    state.cryptoKey = null;
    store(ROOM_KEY, null);
    store(ROOM_NAME_KEY, null);
    store(ROOM_KEY_PASS, null);

    try {
      var u = new URL(window.location.href);
      u.searchParams.delete('room');
      u.searchParams.delete('key');
      window.history.replaceState({}, '', u.toString());
    } catch (e) {}

    if (ui.roomIdInput) ui.roomIdInput.value = '';
    if (ui.roomKeyInput) ui.roomKeyInput.value = '';
    if (ui.roomJoinError) ui.roomJoinError.textContent = '';
    if (ui.roomJoinBtn) { setBtnState(ui.roomJoinBtn, false, 'Join Private Room'); }
    if (ui.newRoomId) ui.newRoomId.value = '';
    if (ui.newRoomName) ui.newRoomName.value = '';
    if (ui.newRoomKey) ui.newRoomKey.value = '';
    if (ui.createRoomError) ui.createRoomError.textContent = '';
    if (ui.createRoomBtn) { setBtnState(ui.createRoomBtn, false, 'Create & Join Room'); }

    var pName = $('picker-name');
    if (pName) pName.textContent = state.name || 'User';

    var savedMode = load('linkchat.roomViewMode') || 'dropdown';
    setRoomViewMode(savedMode);
    loadRoomsList();
    show('rooms');
  }

  function leaveChat() {
    closeHeaderMenu();
    CallManager.endCall(false);
    if (state.room) {
      markRoomAsRead(state.room);
    }
    clearStoredRoomKeys();
    state.room = null;
    state.roomDisplayName = '';
    state.roomKey = '';
    state.cryptoKey = null;
    store(ROOM_KEY, null);
    store(ROOM_NAME_KEY, null);
    store(ROOM_KEY_PASS, null);

    try {
      var u = new URL(window.location.href);
      u.searchParams.delete('room');
      u.searchParams.delete('key');
      window.history.replaceState({}, '', u.toString());
    } catch (e) {}

    stopTypingSignal();
    activeTypers = new Map();
    updateTypingUI();
    var ch = state.channel;
    state.channel = null;
    if (ch) {
      try { ch.untrack(); } catch (e) {}
      if (sb && typeof sb.removeChannel === 'function') {
        try { sb.removeChannel(ch); } catch (e) {}
      }
    }
    state.msgs = new Map();
    state.ready = false;
    if (ui.e2eeBadge) ui.e2eeBadge.hidden = true;
  }

  async function enterChat() {
    show('chat');
    updateComposer();
    markRoomAsRead(state.room);
    ui.roomName.textContent = state.roomDisplayName;
    if (ui.roomsBtn) ui.roomsBtn.hidden = !PRIVATE_ROOMS;
    if (ui.deleteCurrentRoomBtn) {
      var canDelete = !(!PRIVATE_ROOMS || state.room === 'general' || state.room === DEFAULT_ROOM);
      ui.deleteCurrentRoomBtn.hidden = !canDelete;
      if (ui.menuDeleteRoomBtn) ui.menuDeleteRoomBtn.hidden = !canDelete;
    }

    // Security: Immediately scrub secret key from URL address bar so it's not exposed
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.has('key')) {
        u.searchParams.delete('key');
        window.history.replaceState({}, '', u.toString());
      }
    } catch (e) {}

    activeTypers = new Map();
    updateTypingUI();

    // Derive End-to-End Encryption Key for private rooms (§Feature 1)
    if (state.room && state.room !== 'general' && state.roomKey) {
      state.cryptoKey = await E2EE.deriveRoomKey(state.room, state.roomKey);
      if (ui.e2eeBadge) ui.e2eeBadge.hidden = !state.cryptoKey;
    } else {
      state.cryptoKey = null;
      if (ui.e2eeBadge) ui.e2eeBadge.hidden = true;
    }

    var savedCleared = load('linkchat.clearedAt_' + state.room);
    state.clearedAt = savedCleared ? parseInt(savedCleared, 10) : 0;

    state.msgs = new Map();
    state.ready = false;
    state.buffer = [];
    state.hasMore = false;
    state.oldestRaw = null;
    state.everSubscribed = false;
    ui.feed.replaceChildren();
    ui.status.textContent = 'Loading messages…';
    setConnected(true);
    updateComposer();
    updateNotifButtonUI();

    subscribe();
    try {
      await loadLatest();
    } catch (e) {
      ui.status.textContent = 'Could not load messages: ' + friendlyError(e);
      state.ready = true;
      return;
    }
    state.ready = true;
    state.buffer.forEach(upsert);
    state.buffer = [];
    render('bottom');
    ui.input.focus();

    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(function () {
        if (state.room && Notification.permission === 'default') {
          toast('Tip: Tap 🔔 in header to enable message notifications');
        }
      }, 2500);
    }
  }

  async function tryAutoJoinFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var urlRoom = (params.get('room') || '').trim().toLowerCase();
    var urlKey = (params.get('key') || '').trim();

    if (!urlRoom) {
      showRoomPicker();
      return false;
    }

    if (urlKey) {
      try {
        await joinPrivateRoom(urlRoom, urlKey);
        return true;
      } catch (e) {
        showRoomPicker();
        if (ui.roomJoinError) ui.roomJoinError.textContent = friendlyError(e);
        return false;
      }
    }

    showRoomPicker();
    return false;
  }

  ui.joinForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = ui.nameInput.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 30) {
      ui.joinError.textContent = 'Name must be 2–30 characters.';
      return;
    }
    ui.joinError.textContent = '';
    ui.joinBtn.disabled = true;
    ui.joinBtn.textContent = 'Connecting…';
    try {
      getAudioContext();

      var got = await sb.auth.getSession();
      var session = got.data && got.data.session;
      if (!session) {
        var res = await sb.auth.signInAnonymously();
        if (res.error) throw res.error;
        session = res.data.session;
      }
      state.user = session.user;
      syncRealtimeAuth(session);
      state.name = name;
      store(NAME_KEY, name);

      var params = new URLSearchParams(window.location.search);
      var urlRoom = params.get('room');

      if (urlRoom) {
        var joined = await tryAutoJoinFromUrl();
        if (!joined) {
          ui.joinBtn.disabled = false;
          ui.joinBtn.textContent = 'Continue';
        }
      } else if (PRIVATE_ROOMS) {
        showRoomPicker();
      } else {
        joinGeneral();
      }
    } catch (err) {
      ui.joinError.textContent = friendlyError(err);
      ui.joinBtn.disabled = false;
      ui.joinBtn.textContent = 'Try again';
    }
  });

  ui.leaveBtn.addEventListener('click', async function () {
    leaveChat();
    store(NAME_KEY, null);
    store(ROOM_KEY, null);
    store(ROOM_NAME_KEY, null);
    store(ROOM_KEY_PASS, null);
    ui.onlineList.hidden = true;
    showJoin('');
  });

  // ---------- Panic Button / Emergency Quick Lock (<Esc> <Esc>) ----------
  function executeQuickLock() {
    CallManager.endCall(false);
    if (ui.feed) ui.feed.replaceChildren();
    leaveChat();
    clearStoredRoomKeys();
    store(NAME_KEY, null);
    store(ROOM_KEY, null);
    store(ROOM_NAME_KEY, null);
    store(ROOM_KEY_PASS, null);
    if (ui.onlineList) ui.onlineList.hidden = true;
    if (ui.privacyShield) ui.privacyShield.hidden = true;
    showJoin('');
    toast('Emergency lock activated 🛡️');
  }

  if (ui.panicBtn) {
    ui.panicBtn.addEventListener('click', executeQuickLock);
  }

  // Keyboard shortcut: Double-tap <Escape> within 600ms triggers emergency lock
  var lastEscTs = 0;
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      var now = Date.now();
      if (now - lastEscTs < 600) {
        lastEscTs = 0;
        executeQuickLock();
      } else {
        lastEscTs = now;
      }
    }
  });

  // ---------- Privacy Shield (Anti-Peeking on Inactive Tab / App Switcher) ----------
  function updatePrivacyShield(show) {
    if (!ui.privacyShield) return;
    if (show) {
      if (isChoosingFile) return;
      if (!state.room) return; // Not inside an active chat session

      if (state.room !== 'general') {
        // Private room: Require password / access key to unlock
        if (ui.privacyShieldTitle) ui.privacyShieldTitle.textContent = 'Chat Locked';
        if (ui.privacyShieldDesc) ui.privacyShieldDesc.textContent = 'Enter room password to resume your chat.';
        if (ui.privacyKeyGroup) ui.privacyKeyGroup.hidden = false;
        if (ui.privacyExitBtn) ui.privacyExitBtn.hidden = false;
        if (ui.privacyUnlockBtn) ui.privacyUnlockBtn.textContent = 'Unlock Chat';
        if (ui.privacyKeyInput) {
          ui.privacyKeyInput.value = '';
          ui.privacyKeyInput.disabled = false;
        }
        if (ui.privacyKeyError) {
          ui.privacyKeyError.textContent = '';
          ui.privacyKeyError.style.display = 'none';
        }
        ui.privacyShield.hidden = false;
        setTimeout(function () {
          if (ui.privacyKeyInput && !ui.privacyShield.hidden) {
            ui.privacyKeyInput.focus();
          }
        }, 120);
      } else {
        // Public 'general' room: screen protection tap to dismiss
        if (ui.privacyShieldTitle) ui.privacyShieldTitle.textContent = 'Chat Hidden';
        if (ui.privacyShieldDesc) ui.privacyShieldDesc.textContent = 'Screen protected while you were away.';
        if (ui.privacyKeyGroup) ui.privacyKeyGroup.hidden = true;
        if (ui.privacyExitBtn) ui.privacyExitBtn.hidden = true;
        if (ui.privacyUnlockBtn) ui.privacyUnlockBtn.textContent = 'Tap to View';
        if (ui.privacyKeyError) {
          ui.privacyKeyError.textContent = '';
          ui.privacyKeyError.style.display = 'none';
        }
        ui.privacyShield.hidden = false;
      }
    } else {
      ui.privacyShield.hidden = true;
      if (ui.privacyKeyInput) ui.privacyKeyInput.value = '';
      if (ui.privacyKeyError) {
        ui.privacyKeyError.textContent = '';
        ui.privacyKeyError.style.display = 'none';
      }
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      updatePrivacyShield(true);
    } else {
      // Returned to tab: focus the password input if locked
      if (ui.privacyShield && !ui.privacyShield.hidden && ui.privacyKeyInput && ui.privacyKeyGroup && !ui.privacyKeyGroup.hidden) {
        setTimeout(function () { ui.privacyKeyInput.focus(); }, 120);
      }
    }
  });

  window.addEventListener('blur', function () {
    updatePrivacyShield(true);
  });

  window.addEventListener('focus', function () {
    // If returning from an OS picker (e.g. file selection)
    setTimeout(function () { isChoosingFile = false; }, 300);
    if (ui.privacyShield && !ui.privacyShield.hidden && ui.privacyKeyInput && ui.privacyKeyGroup && !ui.privacyKeyGroup.hidden) {
      setTimeout(function () { ui.privacyKeyInput.focus(); }, 120);
    }
  });

  if (ui.privacyUnlockForm) {
    ui.privacyUnlockForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      // If general or no room, unlock immediately
      if (!state.room || state.room === 'general') {
        updatePrivacyShield(false);
        return;
      }

      var roomId = state.room;
      var lockSec = RoomSecurity.getLockRemaining(roomId);
      if (lockSec > 0) {
        if (ui.privacyKeyError) {
          ui.privacyKeyError.textContent = '🔒 Too many failed attempts. Wait ' + lockSec + 's.';
          ui.privacyKeyError.style.display = 'block';
        }
        return;
      }

      var enteredKey = (ui.privacyKeyInput ? ui.privacyKeyInput.value : '').trim();
      if (!enteredKey) {
        if (ui.privacyKeyError) {
          ui.privacyKeyError.textContent = 'Please enter room password.';
          ui.privacyKeyError.style.display = 'block';
        }
        if (ui.privacyKeyInput) ui.privacyKeyInput.focus();
        return;
      }

      // Check entered password against in-memory room key or server RPC
      var isKeyValid = false;
      if (state.roomKey && enteredKey === state.roomKey) {
        isKeyValid = true;
      } else {
        try {
          if (sb && typeof sb.rpc === 'function') {
            var res = await sb.rpc('join_room', { p_room_id: roomId, p_access_key: enteredKey });
            if (res && res.data && res.data.ok) {
              isKeyValid = true;
              state.roomKey = enteredKey;
            }
          }
        } catch (rpcErr) {
          isKeyValid = (state.roomKey && enteredKey === state.roomKey);
        }
      }

      if (isKeyValid) {
        RoomSecurity.recordSuccess(roomId);
        updatePrivacyShield(false);
        toast('Chat unlocked 🔓');
      } else {
        var rem = RoomSecurity.recordFailure(roomId);
        if (ui.privacyKeyInput) {
          ui.privacyKeyInput.value = '';
          ui.privacyKeyInput.focus();
        }
        if (ui.privacyKeyError) {
          if (rem > 0) {
            ui.privacyKeyError.textContent = '🔒 Incorrect password. Locked for ' + rem + 's.';
          } else {
            ui.privacyKeyError.textContent = '🔒 Incorrect password. Please try again.';
          }
          ui.privacyKeyError.style.display = 'block';
        }
      }
    });
  }

  if (ui.privacyExitBtn) {
    ui.privacyExitBtn.addEventListener('click', function () {
      leaveChat();
      clearStoredRoomKeys();
      updatePrivacyShield(false);
      showRoomPicker();
      toast('Exited private room');
    });
  }

  // ---------- Inactivity Auto-Lock (5 Minutes Idle Timer) ----------
  var lastActivityTs = Date.now();
  function resetActivityTimer() {
    lastActivityTs = Date.now();
  }

  ['mousemove', 'pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (evt) {
    window.addEventListener(evt, resetActivityTimer, { passive: true });
  });

  setInterval(function () {
    // Auto-lock if idle for more than 5 minutes (300,000 ms) while in a private room
    if (state.room && state.room !== 'general' && Date.now() - lastActivityTs > 300000) {
      toast('Session auto-locked due to inactivity 🔒');
      leaveChat();
      clearStoredRoomKeys();
      showRoomPicker();
    }
  }, 15000);

  // ---------- Boot ----------
  async function boot() {
    CallManager.init();
    VoiceManager.init();
    if (!isConfigured() || !window.supabase) { show('setup'); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });

    sb.auth.onAuthStateChange(function (event, session) {
      if (session) {
        state.user = session.user;
        syncRealtimeAuth(session);
      }
    });

    // Initialize Offline Mesh Network and AI Swarm
    if (window.MeshManager) {
      window.MeshManager.on('chat-message', function (pkt) {
        if (!pkt || !pkt.id || state.msgs.has(pkt.id)) return;
        var msg = {
          id: pkt.id,
          user_id: pkt.user_id,
          display_name: pkt.display_name,
          content: pkt.content,
          ts: pkt.ts || Date.now(),
          status: 'sent',
          seq: ++state.seq
        };
        state.msgs.set(msg.id, msg);
        render('bottom');
        playMessageSound();
      });
      window.MeshManager.on('status-change', function () {
        updateMeshPeersUI();
      });
    }

    var saved = load(NAME_KEY);
    var savedRoom = load(ROOM_KEY);
    var savedRoomName = load(ROOM_NAME_KEY);
    var savedRoomKey = load(ROOM_KEY_PASS);

    // Airplane Mode Offline Boot Fallback
    if (!navigator.onLine && saved) {
      state.user = { id: 'offline-local-user' };
      state.name = saved;
      state.room = savedRoom || DEFAULT_ROOM;
      state.roomDisplayName = savedRoomName || DEFAULT_ROOM_NAME;
      showChat();
      toast('Operating in 100% Offline Mesh Mode ⚡');
      return;
    }

    var got = await sb.auth.getSession();
    var session = got.data && got.data.session;
    if (session) {
      syncRealtimeAuth(session);
    }

    if (session && saved) {
      state.user = session.user;
      state.name = saved;

      var params = new URLSearchParams(window.location.search);
      var urlRoom = params.get('room');

      if (urlRoom) {
        await tryAutoJoinFromUrl();
      } else if (savedRoom) {
        if (savedRoomKey) {
          try {
            await joinPrivateRoom(savedRoom, savedRoomKey);
          } catch (e) {
            showRoomPicker();
          }
        } else {
          showRoomPicker();
        }
      } else {
        showRoomPicker();
      }
    } else {
      showJoin(saved);
    }
  }

  // Capsules (time capsules and place messages) get the app's own helpers
  function sendCapsuleMessage(content) {
    if (!state.user) return;
    var m = {
      id: uuid(), user_id: state.user.id, display_name: state.name, content: content,
      raw: null, ts: Date.now(), status: 'sending', seq: ++state.seq,
    };
    state.msgs.set(m.id, m);
    render('bottom');
    playSendSound();
    insert(m);
  }

  if (window.Capsules) {
    window.Capsules.init({
      sb: function () { return sb; },
      anchor: ui.attachBtn,
      getUser: function () { return state.user; },
      getName: function () { return state.name; },
      getRoom: function () { return state.room; },
      getCryptoKey: function () { return state.cryptoKey; },
      E2EE: E2EE,
      uuid: uuid,
      toast: toast,
      shrinkPhoto: shrinkPhoto,
      sendMessage: sendCapsuleMessage,
    });
  }

  boot();
})();

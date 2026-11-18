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
    chat: $('chat'), setup: $('setup'), roomName: $('room-name'),
    online: $('online'), onlineCount: $('online-count'), onlineList: $('online-list'),
    conn: $('conn'), copyBtn: $('copy-btn'), roomsBtn: $('rooms-btn'),
    deleteCurrentRoomBtn: $('delete-current-room-btn'),
    clearBtn: $('clear-btn'), clearModal: $('clear-modal'),
    clearConfirmBtn: $('clear-confirm-btn'), clearCancelBtn: $('clear-cancel-btn'),
    themeBtn: $('theme-btn'), themeIcon: $('theme-icon'),
    notifBtn: $('notif-btn'), notifDot: $('notif-status-dot'),
    leaveBtn: $('leave-btn'),
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
    toast: $('toast'),
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
    if (!ui.themeIcon) return;
    if (t === 'dark') {
      ui.themeIcon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    } else {
      ui.themeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  ui.themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store(THEME_KEY, next);
    updateThemeIcon(next);
  });
  updateThemeIcon(currentTheme());

  // ---------- Message Notifications System ----------
  var unreadCount = 0;

  function updateNotifButtonUI() {
    if (!ui.notifDot) return;
    if (!('Notification' in window)) {
      ui.notifBtn.hidden = true;
      return;
    }
    if (Notification.permission === 'granted') {
      ui.notifDot.className = 'status-dot active';
      ui.notifBtn.title = 'Notifications enabled';
    } else if (Notification.permission === 'denied') {
      ui.notifDot.className = 'status-dot muted';
      ui.notifBtn.title = 'Notifications blocked in browser settings';
    } else {
      ui.notifDot.className = 'status-dot';
      ui.notifBtn.title = 'Click to enable notifications';
    }
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      toast('Notifications are not supported in this browser.');
      return;
    }
    if (Notification.permission === 'granted') {
      toast('Notifications are already active.');
      return;
    }
    if (Notification.permission === 'denied') {
      toast('Notifications blocked. Enable in site permissions.');
      return;
    }
    try {
      var perm = await Notification.requestPermission();
      updateNotifButtonUI();
      if (perm === 'granted') {
        toast('Notifications enabled! 🎉');
        try {
          new Notification('LinkChat', { body: 'Notifications are now active!', silent: true });
        } catch (e) {}
      }
    } catch (e) {}
  }

  if (ui.notifBtn) {
    ui.notifBtn.addEventListener('click', requestNotificationPermission);
    updateNotifButtonUI();
  }

  // In-App Dynamic Island Notification Banner
  var bannerTimer = null;
  function showInAppBanner(displayName, text) {
    if (!ui.banner) return;
    ui.bannerSender.textContent = displayName;
    ui.bannerText.textContent = text || 'Sent a photo';
    ui.bannerAvatar.textContent = (displayName && displayName[0] ? displayName[0].toUpperCase() : '💬');
    ui.banner.hidden = false;

    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      ui.banner.hidden = true;
    }, 4500);
  }

  if (ui.bannerPill) {
    ui.bannerPill.addEventListener('click', function () {
      ui.banner.hidden = true;
      scrollToBottom();
    });
  }

  function notifyIncomingMessage(displayName, content) {
    playReceiveSound();

    if (document.hidden) {
      unreadCount++;
      document.title = '(' + unreadCount + ') LinkChat';

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          var n = new Notification(displayName + ' (' + state.roomDisplayName + ')', {
            body: content || 'Sent an image',
            icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3Crect width="24" height="24" rx="7" fill="%23007aff"/%3E%3Cpath d="M7 8.5h10M7 12.5h6" stroke="white" stroke-width="2" stroke-linecap="round"/%3E%3C/svg%3E',
            tag: 'linkchat-' + state.room,
          });
          n.onclick = function () {
            window.focus();
            n.close();
          };
        } catch (e) {}
      }
    } else {
      if (!nearBottom()) {
        showInAppBanner(displayName, content);
      }
    }
  }

  window.addEventListener('focus', function () {
    unreadCount = 0;
    document.title = 'LinkChat';
  });

  // ---------- Supabase Client ----------
  function isConfigured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY &&
      !/YOUR_/.test(cfg.SUPABASE_URL) && !/YOUR_/.test(cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  var sb = null;

  // ---------- State ----------
  var state = {
    user: null,
    name: '',
    room: DEFAULT_ROOM,
    roomDisplayName: DEFAULT_ROOM_NAME,
    roomKey: '',
    clearedAt: 0,        // timestamp before which messages are hidden locally
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

  function toMsg(row) {
    return {
      id: row.id,
      user_id: row.user_id,
      display_name: row.display_name,
      content: row.content || '',
      image_path: row.image_path || null,
      raw: row.created_at,
      ts: Date.parse(row.created_at),
      status: 'sent',
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
    var mine = state.user && m.user_id === state.user.id;
    var row = el('div', 'row ' + (mine ? 'mine' : 'theirs') + (cont ? ' cont' : '') +
      (m.status === 'failed' ? ' is-failed' : '') + (m.status === 'sending' ? ' is-sending' : ''));
    var b = el('div', 'bubble');

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
    if (m.content) b.append(el('div', 'text', m.content));

    var meta = el('div', 'meta');
    if (m.status === 'sending') {
      meta.append(el('span', null, 'Sending…'));
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
      if (mine) meta.append(el('span', null, '✓'));
    }
    b.append(meta);
    row.append(b);
    return row;
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

    if (isNew && state.user && row.user_id !== state.user.id) {
      notifyIncomingMessage(row.display_name, row.content);
    }
  }

  function updatePresence() {
    if (!state.channel) return;
    var ps = state.channel.presenceState();
    var keys = Object.keys(ps);
    var names = keys.map(function (k) {
      var metas = ps[k] || [];
      return metas.length && metas[0].name ? metas[0].name : 'Someone';
    }).sort(function (a, b) { return a.localeCompare(b); });
    ui.onlineCount.textContent = keys.length + ' online';
    ui.onlineList.textContent = 'Active now: ' + names.join(', ');
    ui.online.hidden = keys.length === 0;
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
    var len = ui.input.value.length;
    ui.sendBtn.disabled = ui.input.value.trim().length === 0 || len > MAX_LEN;
    ui.counter.hidden = len < MAX_LEN - 100;
    ui.counter.textContent = len + ' / ' + MAX_LEN;
    ui.counter.classList.toggle('over', len > MAX_LEN);
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight + 2, 130) + 'px';
  }
  ui.input.addEventListener('input', updateComposer);

  ui.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      ui.composer.requestSubmit();
    }
  });

  ui.composer.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = ui.input.value.trim();
    if (!text || text.length > MAX_LEN || !state.user) return;
    var m = {
      id: uuid(), user_id: state.user.id, display_name: state.name, content: text,
      raw: null, ts: Date.now(), status: 'sending', seq: ++state.seq,
    };
    state.msgs.set(m.id, m);
    ui.input.value = '';
    updateComposer();
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

  ui.attachBtn.addEventListener('click', function () { ui.fileInput.click(); });

  ui.fileInput.addEventListener('change', async function () {
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
    try {
      if (m.blob && !m.uploaded) await uploadPhoto(m);
      var res = await sb.from('messages')
        .insert({ id: m.id, room_id: state.room, display_name: m.display_name,
                  content: m.content, image_path: m.image_path || null })
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
          state.channel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: res.data
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
    var url = location.origin + location.pathname;
    if (state.room !== 'general') {
      url += '?room=' + encodeURIComponent(state.room);
      if (state.roomKey) {
        url += '&key=' + encodeURIComponent(state.roomKey);
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      var ta = el('textarea');
      ta.value = url;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(state.room === 'general' ? 'Chat link copied!' : 'Private room link copied (with key)!');
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
      if (willOpen && ui.roomIdInput) {
        setTimeout(function () { ui.roomIdInput.focus(); }, 120);
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
      if (willOpen && ui.newRoomId) {
        setTimeout(function () { ui.newRoomId.focus(); }, 120);
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

  function joinGeneral() {
    state.room = 'general';
    state.roomDisplayName = DEFAULT_ROOM_NAME;
    state.roomKey = '';
    store(ROOM_KEY, 'general');
    store(ROOM_NAME_KEY, DEFAULT_ROOM_NAME);
    store(ROOM_KEY_PASS, null);
    enterChat();
  }

  async function joinPrivateRoom(roomId, key) {
    var res = await sb.rpc('join_room', { p_room_id: roomId, p_access_key: key });
    if (res.error) throw res.error;
    var data = res.data;
    if (!data.ok) {
      throw new Error(data.error || 'Could not join room.');
    }
    state.room = roomId;
    state.roomDisplayName = data.room_name || roomId;
    state.roomKey = key;
    store(ROOM_KEY, roomId);
    store(ROOM_NAME_KEY, state.roomDisplayName);
    store(ROOM_KEY_PASS, key);
    store('linkchat.roomKey_' + roomId, key);
    enterChat();
  }

  if (ui.joinRoomForm) {
    ui.joinRoomForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var roomId = (ui.roomIdInput.value || '').trim().toLowerCase();
      var key = (ui.roomKeyInput.value || '').trim();
      ui.roomJoinError.textContent = '';

      if (!roomId) { ui.roomJoinError.textContent = 'Enter a room ID.'; return; }
      if (!key) { ui.roomJoinError.textContent = 'Enter the access key.'; return; }

      setBtnState(ui.roomJoinBtn, true, 'Join Private Room', 'Joining…');
      try {
        await joinPrivateRoom(roomId, key);
      } catch (err) {
        ui.roomJoinError.textContent = friendlyError(err);
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
        state.roomKey = key;
        store(ROOM_KEY, roomId);
        store(ROOM_NAME_KEY, roomName);
        store(ROOM_KEY_PASS, key);
        store('linkchat.roomKey_' + roomId, key);
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
  var currentSelectedRoom = { id: 'general', name: 'General Chat', isPrivate: false };
  var latestMsgCounts = {};

  function formatMsgCount(count) {
    if (!count || count <= 0) return '0 msgs';
    if (count === 1) return '1 msg';
    return count + ' msgs';
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
    var count = latestMsgCounts[roomId] || 0;
    var countStr = ' • ' + formatMsgCount(count);
    if (ui.dropdownTriggerSub) {
      ui.dropdownTriggerSub.textContent = (isPrivate ? ('#' + roomId) : 'Public Community Room') + countStr;
    }
    if (ui.dropdownTriggerAvatar) {
      ui.dropdownTriggerAvatar.textContent = isPrivate ? (roomName || roomId).charAt(0).toUpperCase() : '💬';
      ui.dropdownTriggerAvatar.style.background = isPrivate ? 'linear-gradient(135deg, #af52de, #5856d6)' : 'var(--apple-blue-gradient)';
    }
    if (ui.dropdownDeleteBtn) {
      ui.dropdownDeleteBtn.hidden = !isPrivate;
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
    var savedKey = load('linkchat.roomKey_' + roomId) || (state.room === roomId ? state.roomKey : '');
    if (ui.deleteRoomKeyInput) {
      ui.deleteRoomKeyInput.value = savedKey || '';
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
    selectDropdownRoom('general', 'General Chat', false);
    loadRoomsList();
  }

  async function loadRoomsList() {
    var tilesContainer = $('rooms-list-container');
    var dropList = $('dropdown-items-list');
    if (tilesContainer) tilesContainer.innerHTML = '<div class="rooms-loading">Loading active rooms…</div>';
    if (dropList) dropList.innerHTML = '<div class="rooms-loading">Loading rooms…</div>';

    var rooms = [];
    latestMsgCounts = {};

    try {
      var res = await sb.from('rooms').select('id, name, created_at').order('created_at', { ascending: false });
      if (!res.error && res.data) {
        rooms = res.data;
      }
    } catch (e) {
      console.warn('Could not load rooms:', e);
    }

    try {
      var countRes = await sb.from('messages').select('room_id');
      if (!countRes.error && countRes.data) {
        countRes.data.forEach(function (m) {
          if (m && m.room_id) {
            latestMsgCounts[m.room_id] = (latestMsgCounts[m.room_id] || 0) + 1;
          }
        });
      }
    } catch (e) {
      console.warn('Could not load message counts:', e);
    }

    renderRoomsDirectory(rooms, latestMsgCounts);
  }

  function renderRoomsDirectory(rooms, msgCounts) {
    msgCounts = msgCounts || latestMsgCounts || {};
    var genCount = msgCounts['general'] || 0;
    var genCountText = formatMsgCount(genCount);

    // 1. Populate Tiles view
    var tilesContainer = $('rooms-list-container');
    if (tilesContainer) {
      tilesContainer.innerHTML = '';

      // General Community Room
      var genTile = document.createElement('button');
      genTile.type = 'button';
      genTile.className = 'room-tile-card';
      genTile.innerHTML =
        '<div class="room-tile-avatar general">' +
          '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="room-tile-meta">' +
          '<strong>General Chat</strong>' +
          '<small>Public community room • ' + genCountText + '</small>' +
        '</div>' +
        '<span class="room-tile-count-badge ' + (genCount > 0 ? '' : 'zero') + '" title="' + genCount + ' messages">💬 ' + genCount + '</span>' +
        '<span class="room-tile-badge public">OPEN</span>';
      genTile.onclick = function () { joinGeneral(); };
      tilesContainer.appendChild(genTile);

      if (rooms && rooms.length) {
        rooms.forEach(function (r) {
          var card = document.createElement('div');
          card.className = 'room-tile-card';
          var initial = (r.name || r.id || 'R').charAt(0).toUpperCase();
          var hasKey = Boolean(load('linkchat.roomKey_' + r.id));
          var rCount = msgCounts[r.id] || 0;
          var rCountText = formatMsgCount(rCount);
          card.innerHTML =
            '<div class="room-tile-avatar private">' + escapeHtml(initial) + '</div>' +
            '<div class="room-tile-meta">' +
              '<strong>' + escapeHtml(r.name || r.id) + '</strong>' +
              '<small>#' + escapeHtml(r.id) + ' • ' + rCountText + '</small>' +
            '</div>' +
            '<span class="room-tile-count-badge ' + (rCount > 0 ? '' : 'zero') + '" title="' + rCount + ' messages">💬 ' + rCount + '</span>' +
            (hasKey
              ? '<span class="room-tile-badge public">ENTER</span>'
              : '<span class="room-tile-badge locked">🔒 KEY</span>') +
            '<button type="button" class="btn-tile-delete" title="Delete room" aria-label="Delete room ' + escapeHtml(r.name || r.id) + '">' +
              '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<polyline points="3 6 5 6 21 6"></polyline>' +
                '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>' +
              '</svg>' +
            '</button>';

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

      // General item
      var genItem = document.createElement('button');
      genItem.type = 'button';
      genItem.className = 'dropdown-item' + (currentSelectedRoom.id === 'general' ? ' selected' : '');
      genItem.dataset.roomId = 'general';
      genItem.innerHTML =
        '<div class="dropdown-item-avatar" style="background: var(--apple-blue-gradient);">💬</div>' +
        '<div class="dropdown-item-meta">' +
          '<strong>General Chat</strong>' +
          '<small>Public community room • ' + genCountText + '</small>' +
        '</div>' +
        '<span class="room-tile-count-badge ' + (genCount > 0 ? '' : 'zero') + '">💬 ' + genCount + '</span>';
      genItem.onclick = function () {
        selectDropdownRoom('general', 'General Chat', false);
        toggleDropdown(false);
      };
      dropList.appendChild(genItem);

      if (rooms && rooms.length) {
        rooms.forEach(function (r) {
          var initial = (r.name || r.id || 'R').charAt(0).toUpperCase();
          var hasKey = Boolean(load('linkchat.roomKey_' + r.id));
          var rCount = msgCounts[r.id] || 0;
          var rCountText = formatMsgCount(rCount);
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
              '<small>#' + escapeHtml(r.id) + ' • ' + rCountText + (hasKey ? ' • Key Saved' : ' • 🔒 Key Required') + '</small>' +
            '</div>' +
            '<span class="room-tile-count-badge ' + (rCount > 0 ? '' : 'zero') + '" style="margin-right: 6px;">💬 ' + rCount + '</span>';
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
          row.appendChild(delBtn);
          dropList.appendChild(row);
        });
      }
    }

    // Refresh trigger sub with latest count
    selectDropdownRoom(currentSelectedRoom.id, currentSelectedRoom.name, currentSelectedRoom.isPrivate);
  }

  function handleRoomTileClick(roomId, roomName) {
    var savedKey = load('linkchat.roomKey_' + roomId);
    if (savedKey) {
      toast('Entering ' + roomName + '…');
      joinPrivateRoom(roomId, savedKey).catch(function () {
        openKeyModal(roomId, roomName);
      });
    } else {
      openKeyModal(roomId, roomName);
    }
  }

  var pendingKeyRoomId = null;
  function openKeyModal(roomId, roomName) {
    pendingKeyRoomId = roomId;
    var modal = $('key-modal');
    var title = $('key-modal-title');
    var desc = $('key-modal-desc');
    var input = $('key-modal-input');
    var err = $('key-modal-error');
    if (title) title.textContent = 'Join ' + (roomName || roomId);
    if (desc) desc.textContent = 'Enter the access key for #' + roomId + ' to enter.';
    if (input) input.value = '';
    if (err) err.textContent = '';
    if (modal) modal.hidden = false;
    if (input) setTimeout(function () { input.focus(); }, 100);
  }

  function closeKeyModal() {
    var modal = $('key-modal');
    if (modal) modal.hidden = true;
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
      if (!key) {
        if (err) err.textContent = 'Enter the access key.';
        return;
      }
      if (!pendingKeyRoomId) return;

      if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Joining…'; }
      try {
        await joinPrivateRoom(pendingKeyRoomId, key);
        closeKeyModal();
      } catch (err) {
        if (err) err.textContent = friendlyError(err);
      } finally {
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Join Room'; }
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
      if (currentSelectedRoom.id === 'general') {
        joinGeneral();
      } else {
        handleRoomTileClick(currentSelectedRoom.id, currentSelectedRoom.name);
      }
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

    var params = new URLSearchParams(window.location.search);
    var urlRoom = params.get('room');
    var urlKey = params.get('key');
    if (urlRoom && ui.roomIdInput) ui.roomIdInput.value = urlRoom;
    if (urlKey && ui.roomKeyInput) ui.roomKeyInput.value = urlKey;

    if (urlRoom && urlRoom !== 'general') {
      toggleSubform('join');
    } else {
      toggleSubform('none');
    }

    var savedMode = load('linkchat.roomViewMode') || 'dropdown';
    setRoomViewMode(savedMode);
    loadRoomsList();
    show('rooms');
  }

  function leaveChat() {
    var ch = state.channel;
    state.channel = null;
    if (ch) {
      try { ch.untrack(); } catch (e) {}
      sb.removeChannel(ch);
    }
    state.msgs = new Map();
    state.ready = false;
  }

  async function enterChat() {
    show('chat');
    ui.roomName.textContent = state.roomDisplayName;
    if (ui.roomsBtn) ui.roomsBtn.hidden = !PRIVATE_ROOMS;
    if (ui.deleteCurrentRoomBtn) {
      ui.deleteCurrentRoomBtn.hidden = !PRIVATE_ROOMS || state.room === 'general' || state.room === DEFAULT_ROOM;
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
  }

  async function tryAutoJoinFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var urlRoom = (params.get('room') || '').trim().toLowerCase();
    var urlKey = (params.get('key') || '').trim();

    if (!urlRoom || urlRoom === 'general') {
      joinGeneral();
      return true;
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

  // ---------- Boot ----------
  async function boot() {
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

    var saved = load(NAME_KEY);
    var savedRoom = load(ROOM_KEY);
    var savedRoomName = load(ROOM_NAME_KEY);
    var savedRoomKey = load(ROOM_KEY_PASS);
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
      } else {
        showRoomPicker();
      }
    } else {
      showJoin(saved);
    }
  }

  boot();
})();

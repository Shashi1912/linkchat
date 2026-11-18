// LinkChat — plain JavaScript, no build step.
// Supabase handles: anonymous sign-in, message storage, realtime, presence.
(function () {
  'use strict';

  var cfg = window.LINKCHAT_CONFIG || {};
  var ROOM = cfg.DEFAULT_ROOM_ID || cfg.ROOM_ID || 'general';
  var ROOM_NAME = cfg.DEFAULT_ROOM_NAME || cfg.ROOM_NAME || 'General Chat';
  var PRIVATE_ROOMS = cfg.ENABLE_PRIVATE_ROOMS !== false;
  var PAGE_SIZE = 50;
  var MAX_LEN = 1000;
  var NAME_KEY = 'linkchat.name';
  var ROOM_KEY = 'linkchat.room';
  var ROOM_NAME_KEY = 'linkchat.roomName';
  var THEME_KEY = 'linkchat.theme';
  var BUCKET = 'chat-images';
  var PHOTO_MAX_PX = 1600;    // photos are shrunk to this size before upload
  var COLUMNS = 'id, room_id, user_id, display_name, content, image_path, created_at';
  var RECONNECT_DELAY = 3000;
  var MAX_RECONNECT_DELAY = 30000;

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var ui = {
    join: $('join'), joinForm: $('join-form'), nameInput: $('name-input'),
    joinBtn: $('join-btn'), joinError: $('join-error'),
    // Room picker
    roomPicker: $('room-picker'), generalBtn: $('general-btn'),
    joinRoomForm: $('join-room-form'), roomIdInput: $('room-id-input'),
    roomKeyInput: $('room-key-input'), roomJoinError: $('room-join-error'),
    roomJoinBtn: $('room-join-btn'),
    createRoomForm: $('create-room-form'), newRoomId: $('new-room-id'),
    newRoomName: $('new-room-name'), newRoomKey: $('new-room-key'),
    createRoomError: $('create-room-error'), createRoomBtn: $('create-room-btn'),
    roomBackBtn: $('room-back-btn'),
    // Chat
    chat: $('chat'), setup: $('setup'), roomName: $('room-name'),
    online: $('online'), onlineCount: $('online-count'), onlineList: $('online-list'),
    conn: $('conn'), copyBtn: $('copy-btn'), roomsBtn: $('rooms-btn'),
    themeBtn: $('theme-btn'), leaveBtn: $('leave-btn'),
    messages: $('messages'), olderBtn: $('older-btn'), status: $('status'), feed: $('feed'),
    composer: $('composer'), input: $('msg-input'), sendBtn: $('send-btn'), counter: $('counter'),
    attachBtn: $('attach-btn'), fileInput: $('file-input'),
    toast: $('toast'),
  };

  // ---------- Small helpers ----------
  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
    } catch (e) { /* private mode: ignore */ }
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
    if (text != null) n.textContent = text; // always textContent: never HTML
    return n;
  }

  var toastTimer;
  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('show'); }, 2000);
  }

  function nameColor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 55% var(--name-l))'; // lightness depends on theme
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayLabel(ts) {
    var d = new Date(ts), today = new Date(), yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function friendlyError(err) {
    var msg = (err && err.message) || String(err || 'Unknown error');
    if (/anonymous sign-ins are disabled/i.test(msg)) return 'Anonymous sign-in is turned off in Supabase (see README, Part B).';
    if (/failed to fetch|network/i.test(msg)) return 'Network problem. Check your connection and try again.';
    if (/bucket not found/i.test(msg)) return 'Photo storage is missing. Run the SQL setup again (README, Part B).';
    if (/row-level security|permission denied/i.test(msg)) return 'The database refused this. Did you run the SQL setup?';
    return msg;
  }

  // ---------- Theme ----------
  function currentTheme() {
    var t = document.documentElement.dataset.theme;
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  ui.themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store(THEME_KEY, next);
  });

  // ---------- Supabase ----------
  function isConfigured() {
    return cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY &&
      !/YOUR_/.test(cfg.SUPABASE_URL) && !/YOUR_/.test(cfg.SUPABASE_PUBLISHABLE_KEY);
  }

  var sb = null;

  // ---------- State ----------
  var state = {
    user: null,
    name: '',
    room: ROOM,
    roomDisplayName: ROOM_NAME,
    msgs: new Map(),     // id -> message
    oldestRaw: null,     // created_at string of the oldest loaded message
    hasMore: false,
    loadingOlder: false,
    ready: false,        // history loaded; realtime events can be applied directly
    buffer: [],          // realtime rows that arrived while history was loading
    channel: null,
    everSubscribed: false,
    seq: 0,
    reconnectDelay: RECONNECT_DELAY,
    reconnectTimer: null,
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

  // Insert or replace by id: this is what prevents duplicates between the
  // optimistic copy, the insert response and the realtime event.
  function upsert(row) {
    if (!row || row.room_id && row.room_id !== state.room) return;
    var old = state.msgs.get(row.id);
    if (old && old.localUrl) URL.revokeObjectURL(old.localUrl);
    state.msgs.set(row.id, toMsg(row));
  }

  function sorted() {
    return Array.from(state.msgs.values()).sort(function (a, b) {
      var ap = a.status !== 'sent', bp = b.status !== 'sent';
      if (ap && bp) return a.seq - b.seq;
      if (ap) return 1;            // unsent messages go last
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

  // Photos load after the page draws and make the list taller. If the reader
  // was at the bottom, keep them there.
  var stuckToBottom = true;
  ui.messages.addEventListener('scroll', function () { stuckToBottom = nearBottom(); });
  function onPhotoLoaded() { if (stuckToBottom) scrollToBottom(); }

  // mode: 'auto' (stick to bottom only if already there), 'bottom', 'prepend'
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
        (m.status !== 'sent' || prev.status !== 'sent' || m.ts - prev.ts < 5 * 60 * 1000);
      frag.append(bubble(m, cont));
      prev = m;
    });

    ui.feed.replaceChildren(frag);
    ui.olderBtn.hidden = !state.hasMore;
    ui.olderBtn.disabled = state.loadingOlder;
    ui.olderBtn.textContent = state.loadingOlder ? 'Loading…' : 'Load earlier messages';
    if (state.ready && list.length === 0) ui.status.textContent = 'No messages yet. Say hello!';
    else if (state.ready) ui.status.textContent = '';

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

  // ---------- Loading messages ----------
  function baseQuery() {
    return sb.from('messages').select(COLUMNS).eq('room_id', state.room);
  }

  async function loadLatest() {
    var res = await baseQuery().order('created_at', { ascending: false }).limit(PAGE_SIZE);
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

  // After a reconnect, fetch anything we missed while offline.
  async function catchUp() {
    var since = newestRaw();
    if (!since || !state.ready) return;
    var res = await baseQuery().gt('created_at', since)
      .order('created_at', { ascending: true }).limit(500);
    if (!res.error && res.data.length) {
      res.data.forEach(upsert);
      render('auto');
    }
  }

  // ---------- WebSocket health ----------
  function isWsAlive() {
    try {
      var conn = sb.realtime && sb.realtime.conn;
      return conn && conn.readyState === WebSocket.OPEN;
    } catch (e) { return false; }
  }

  function forceReconnect() {
    clearTimeout(state.reconnectTimer);
    var oldCh = state.channel;
    state.channel = null;
    if (oldCh) {
      try { oldCh.untrack(); } catch (e) { /* ignore */ }
      sb.removeChannel(oldCh);
    }
    subscribe();
    catchUp();
  }

  function scheduleReconnect() {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(function () {
      if (!isWsAlive() && state.ready) {
        forceReconnect();
      }
      // Exponential backoff, capped
      state.reconnectDelay = Math.min(state.reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
    }, state.reconnectDelay);
  }

  // ---------- Realtime + presence ----------
  function onRealtimeRow(row) {
    if (!state.ready) { state.buffer.push(row); return; }
    upsert(row);
    render('auto');
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
    ui.onlineList.textContent = 'Online now: ' + names.join(', ');
    ui.online.hidden = keys.length === 0;
  }

  function setConnected(ok) {
    ui.conn.hidden = ok;
    if (ok) {
      // Reset reconnect delay on successful connection
      state.reconnectDelay = RECONNECT_DELAY;
    }
    if (!ok) { ui.online.hidden = true; ui.onlineList.hidden = true; ui.online.setAttribute('aria-expanded', 'false'); }
  }

  ui.online.addEventListener('click', function () {
    var show = ui.onlineList.hidden;
    ui.onlineList.hidden = !show;
    ui.online.setAttribute('aria-expanded', String(show));
  });

  function subscribe() {
    var ch = sb.channel('room:' + state.room, {
      config: { presence: { key: state.user.id } }, // one entry per person, even with several tabs
    });
    state.channel = ch;

    ch.on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'room_id=eq.' + state.room },
      function (payload) { onRealtimeRow(payload.new); })
      .on('presence', { event: 'sync' }, updatePresence)
      .subscribe(function (status) {
        if (ch !== state.channel) return; // left the room meanwhile
        if (status === 'SUBSCRIBED') {
          setConnected(true);
          ch.track({ name: state.name, online_at: new Date().toISOString() });
          if (state.everSubscribed) catchUp();
          state.everSubscribed = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnected(false);
          // Auto-retry with exponential backoff
          scheduleReconnect();
        }
      });
  }

  // Reconnect when network comes back
  window.addEventListener('online', function () {
    if (state.ready) {
      if (!isWsAlive()) {
        forceReconnect();
      } else {
        catchUp();
      }
    }
  });

  // Reconnect when tab becomes visible (browser throttles background WS)
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && state.ready) {
      if (!isWsAlive()) {
        forceReconnect();
      } else {
        catchUp();
      }
    }
  });

  // Periodic heartbeat check: every 30s, verify WebSocket is alive
  setInterval(function () {
    if (state.ready && !isWsAlive()) {
      setConnected(false);
      scheduleReconnect();
    }
  }, 30000);

  // ---------- Sending ----------
  function updateComposer() {
    var len = ui.input.value.length;
    ui.sendBtn.disabled = ui.input.value.trim().length === 0 || len > MAX_LEN;
    ui.counter.hidden = len < MAX_LEN - 100;
    ui.counter.textContent = len + ' / ' + MAX_LEN;
    ui.counter.classList.toggle('over', len > MAX_LEN);
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight + 2, 140) + 'px';
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
    insert(m);
  });

  // ---------- Photos ----------
  // Shrink the photo in the browser (keeps uploads ~200-400 KB) and make a JPEG.
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
        ctx.fillStyle = '#fff'; // transparent PNGs get a white background
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
    if (!/^image\//.test(file.type)) { toast('Please choose an image.'); return; }

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
    insert(m);
  });

  async function uploadPhoto(m) {
    var up = await sb.storage.from(BUCKET).upload(m.image_path, m.blob, {
      contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
    });
    // "already exists" means an earlier attempt uploaded it: that's fine.
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
        // Already saved by an earlier attempt: fetch the stored copy.
        res = await baseQuery().eq('id', m.id).single();
      }
      if (res.error) throw res.error;
      upsert(res.data);
    } catch (err) {
      var cur = state.msgs.get(m.id);
      if (cur && cur.status !== 'sent') { // realtime may already have delivered it
        cur.status = 'failed';
        cur.error = friendlyError(err);
        toast(cur.error);
      }
    }
    render('auto');
  }

  // ---------- Copy link ----------
  ui.copyBtn.addEventListener('click', async function () {
    var url = location.origin + location.pathname;
    if (state.room !== 'general') {
      url += '?room=' + encodeURIComponent(state.room);
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
    toast('Link copied!');
  });

  // ---------- Room picker ----------
  if (ui.roomsBtn) {
    ui.roomsBtn.addEventListener('click', function () {
      leaveChat();
      showRoomPicker();
    });
  }

  if (ui.generalBtn) {
    ui.generalBtn.addEventListener('click', function () {
      state.room = 'general';
      state.roomDisplayName = ROOM_NAME;
      store(ROOM_KEY, 'general');
      store(ROOM_NAME_KEY, ROOM_NAME);
      enterChat();
    });
  }

  if (ui.joinRoomForm) {
    ui.joinRoomForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var roomId = (ui.roomIdInput.value || '').trim().toLowerCase();
      var key = (ui.roomKeyInput.value || '').trim();
      ui.roomJoinError.textContent = '';

      if (!roomId) { ui.roomJoinError.textContent = 'Enter a room ID.'; return; }
      if (!key) { ui.roomJoinError.textContent = 'Enter the access key.'; return; }

      ui.roomJoinBtn.disabled = true;
      ui.roomJoinBtn.textContent = 'Joining…';
      try {
        var res = await sb.rpc('join_room', { p_room_id: roomId, p_access_key: key });
        if (res.error) throw res.error;
        var data = res.data;
        if (!data.ok) {
          ui.roomJoinError.textContent = data.error || 'Could not join room.';
          ui.roomJoinBtn.disabled = false;
          ui.roomJoinBtn.textContent = 'Join Private Room';
          return;
        }
        state.room = roomId;
        state.roomDisplayName = data.room_name || roomId;
        store(ROOM_KEY, roomId);
        store(ROOM_NAME_KEY, state.roomDisplayName);
        enterChat();
      } catch (err) {
        ui.roomJoinError.textContent = friendlyError(err);
        ui.roomJoinBtn.disabled = false;
        ui.roomJoinBtn.textContent = 'Join Private Room';
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

      ui.createRoomBtn.disabled = true;
      ui.createRoomBtn.textContent = 'Creating…';
      try {
        var res = await sb.rpc('create_room', { p_room_id: roomId, p_room_name: roomName, p_access_key: key });
        if (res.error) throw res.error;
        var data = res.data;
        if (!data.ok) {
          ui.createRoomError.textContent = data.error || 'Could not create room.';
          ui.createRoomBtn.disabled = false;
          ui.createRoomBtn.textContent = 'Create Room';
          return;
        }
        toast('Room created! Share the ID and key with your friends.');
        state.room = roomId;
        state.roomDisplayName = roomName;
        store(ROOM_KEY, roomId);
        store(ROOM_NAME_KEY, roomName);
        enterChat();
      } catch (err) {
        ui.createRoomError.textContent = friendlyError(err);
        ui.createRoomBtn.disabled = false;
        ui.createRoomBtn.textContent = 'Create Room';
      }
    });
  }

  if (ui.roomBackBtn) {
    ui.roomBackBtn.addEventListener('click', function () {
      store(NAME_KEY, null);
      state.name = '';
      showJoin('');
    });
  }

  // ---------- Screens ----------
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
    ui.joinBtn.textContent = 'Join Chat';
    show('join');
    ui.nameInput.focus();
  }

  function showRoomPicker() {
    // Reset forms
    if (ui.roomIdInput) ui.roomIdInput.value = '';
    if (ui.roomKeyInput) ui.roomKeyInput.value = '';
    if (ui.roomJoinError) ui.roomJoinError.textContent = '';
    if (ui.roomJoinBtn) { ui.roomJoinBtn.disabled = false; ui.roomJoinBtn.textContent = 'Join Private Room'; }
    if (ui.newRoomId) ui.newRoomId.value = '';
    if (ui.newRoomName) ui.newRoomName.value = '';
    if (ui.newRoomKey) ui.newRoomKey.value = '';
    if (ui.createRoomError) ui.createRoomError.textContent = '';
    if (ui.createRoomBtn) { ui.createRoomBtn.disabled = false; ui.createRoomBtn.textContent = 'Create Room'; }

    // Check if URL has a room parameter
    var params = new URLSearchParams(window.location.search);
    var urlRoom = params.get('room');
    if (urlRoom && ui.roomIdInput) {
      ui.roomIdInput.value = urlRoom;
    }

    show('rooms');
  }

  function leaveChat() {
    var ch = state.channel;
    state.channel = null;
    clearTimeout(state.reconnectTimer);
    if (ch) {
      try { ch.untrack(); } catch (e) { /* ignore */ }
      sb.removeChannel(ch);
    }
    state.msgs = new Map();
    state.ready = false;
  }

  async function enterChat() {
    show('chat');
    ui.roomName.textContent = state.roomDisplayName;
    if (ui.roomsBtn) ui.roomsBtn.hidden = !PRIVATE_ROOMS;
    state.msgs = new Map();
    state.ready = false;
    state.buffer = [];
    state.hasMore = false;
    state.oldestRaw = null;
    state.everSubscribed = false;
    state.reconnectDelay = RECONNECT_DELAY;
    clearTimeout(state.reconnectTimer);
    ui.feed.replaceChildren();
    ui.status.textContent = 'Loading messages…';
    setConnected(true);
    updateComposer();

    // Subscribe first, then load history, then apply anything that arrived
    // in between — so no message is missed during the initial load.
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

  ui.joinForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = ui.nameInput.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 30) {
      ui.joinError.textContent = 'Name must be 2–30 characters.';
      return;
    }
    ui.joinError.textContent = '';
    ui.joinBtn.disabled = true;
    ui.joinBtn.textContent = 'Joining…';
    try {
      var got = await sb.auth.getSession();
      var session = got.data.session;
      if (!session) {
        var res = await sb.auth.signInAnonymously();
        if (res.error) throw res.error;
        session = res.data.session;
      }
      state.user = session.user;
      state.name = name;
      store(NAME_KEY, name);

      // Check URL for room param
      var params = new URLSearchParams(window.location.search);
      var urlRoom = params.get('room');

      if (PRIVATE_ROOMS && !urlRoom) {
        // Show room picker
        showRoomPicker();
      } else if (urlRoom) {
        // Pre-fill room picker with the URL room
        if (PRIVATE_ROOMS) {
          showRoomPicker();
        } else {
          state.room = urlRoom;
          state.roomDisplayName = urlRoom;
          enterChat();
        }
      } else {
        // Go straight to general chat
        state.room = ROOM;
        state.roomDisplayName = ROOM_NAME;
        enterChat();
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
    ui.onlineList.hidden = true;
    showJoin('');
  });

  // ---------- Start ----------
  async function boot() {
    if (!isConfigured() || !window.supabase) { show('setup'); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: {
        params: { eventsPerSecond: 10 },
      },
    });

    var saved = load(NAME_KEY);
    var savedRoom = load(ROOM_KEY);
    var savedRoomName = load(ROOM_NAME_KEY);
    var got = await sb.auth.getSession();
    var session = got.data && got.data.session;

    if (session && saved) {
      state.user = session.user;
      state.name = saved;

      // Check URL for room param first
      var params = new URLSearchParams(window.location.search);
      var urlRoom = params.get('room');

      if (urlRoom && PRIVATE_ROOMS) {
        // URL has a room, show room picker with it pre-filled
        showRoomPicker();
      } else if (savedRoom) {
        // Resume saved room
        state.room = savedRoom;
        state.roomDisplayName = savedRoomName || savedRoom;
        enterChat();
      } else if (PRIVATE_ROOMS) {
        showRoomPicker();
      } else {
        state.room = ROOM;
        state.roomDisplayName = ROOM_NAME;
        enterChat();
      }
    } else {
      showJoin(saved);
    }
  }

  boot();
})();

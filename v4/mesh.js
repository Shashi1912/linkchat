/**
 * LinkChat Serverless Offline Mesh Network Engine (Zero-Internet Communication)
 * Enables direct device-to-device encrypted messaging & real-time sync
 * over local Wi-Fi, phone personal hotspots, or optical QR handshakes.
 */
'use strict';

window.MeshManager = (function () {
  var peers = new Map(); // peerId -> { pc, dc, role, state, name }
  var listeners = {};
  var localPeerId = 'mesh_' + Math.random().toString(36).substr(2, 9);
  var currentOfferPC = null;
  var currentAnswerPC = null;
  var scannerStream = null;
  var scanAnimFrame = null;

  // ICE configuration: local host candidates priority for offline Wi-Fi / hotspot subnets
  var rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(function (cb) {
        try { cb(data); } catch (e) { console.error('Mesh emit error:', e); }
      });
    }
  }

  function on(event, callback) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
  }

  function getConnectedCount() {
    var count = 0;
    peers.forEach(function (p) {
      if (p.dc && p.dc.readyState === 'open') count++;
    });
    return count;
  }

  function updateStatusUI() {
    var count = getConnectedCount();
    var pill = document.getElementById('mesh-status-pill');
    var badge = document.getElementById('mesh-count-badge');
    if (pill) {
      if (count > 0) {
        pill.className = 'mesh-status-pill active';
        pill.innerHTML = '<span class="mesh-dot active"></span><span>' + count + ' Direct P2P</span>';
        pill.title = 'Connected to ' + count + ' peer(s) via direct offline mesh (Zero-Internet)';
      } else {
        pill.className = 'mesh-status-pill';
        pill.innerHTML = '<span class="mesh-dot"></span><span>Offline Mesh</span>';
        pill.title = 'No direct P2P peers connected. Tap to pair.';
      }
    }
    if (badge) {
      badge.textContent = count > 0 ? count : '';
      badge.hidden = count === 0;
    }
    emit('status-change', { count: count });
  }

  // ---------- WebRTC Setup & DataChannel Handling ----------
  function setupDataChannel(pc, dc, peerId, peerName) {
    dc.onopen = function () {
      console.log('Mesh DataChannel OPEN with', peerId);
      peers.set(peerId, { pc: pc, dc: dc, name: peerName || 'Direct Peer', id: peerId });
      updateStatusUI();
      // Send greeting handshake
      sendToPeer(peerId, {
        type: 'handshake',
        senderId: localPeerId,
        senderName: (window.state && window.state.name) || 'User',
        ts: Date.now()
      });
      emit('peer-connected', { peerId: peerId, name: peerName });
      if (window.toast) window.toast('🟢 Direct P2P Mesh Connected with ' + (peerName || 'Peer') + '!');
    };

    dc.onclose = function () {
      console.log('Mesh DataChannel CLOSED with', peerId);
      peers.delete(peerId);
      updateStatusUI();
      emit('peer-disconnected', { peerId: peerId });
    };

    dc.onerror = function (err) {
      console.warn('Mesh DataChannel error:', err);
    };

    dc.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        handleIncomingMeshPacket(data, peerId);
      } catch (err) {
        console.warn('Invalid mesh packet:', err);
      }
    };
  }

  function handleIncomingMeshPacket(pkt, sourcePeerId) {
    if (!pkt || !pkt.type) return;

    if (pkt.type === 'handshake') {
      var p = peers.get(sourcePeerId);
      if (p) p.name = pkt.senderName || p.name;
      updateStatusUI();
      return;
    }

    if (pkt.type === 'chat_message') {
      // De-duplicate multi-hop broadcast
      if (pkt.id && window.state && window.state.msgs && window.state.msgs.has(pkt.id)) {
        return;
      }
      emit('chat-message', pkt);
      // Forward to other connected peers (multi-hop mesh routing)
      broadcastExcept(sourcePeerId, pkt);
      return;
    }

    if (pkt.type === 'game_packet') {
      emit('game-packet', pkt);
      return;
    }

    if (pkt.type === 'ai_poll_vote') {
      emit('ai-poll-vote', pkt);
      broadcastExcept(sourcePeerId, pkt);
      return;
    }
  }

  // ---------- Optical QR Handshake Generator & Scanner ----------
  // Compress SDP to fit into a scannable QR code
  function compressSDP(sdp) {
    try {
      var json = JSON.stringify(sdp);
      return btoa(unescape(encodeURIComponent(json)));
    } catch (e) {
      return JSON.stringify(sdp);
    }
  }

  function decompressSDP(str) {
    try {
      var json = decodeURIComponent(escape(atob(str.trim())));
      return JSON.parse(json);
    } catch (e) {
      return JSON.parse(str.trim());
    }
  }

  // 1. Host creates Offer
  async function createOfferPairing() {
    if (currentOfferPC) {
      try { currentOfferPC.close(); } catch (e) {}
    }
    currentOfferPC = new RTCPeerConnection(rtcConfig);
    var dc = currentOfferPC.createDataChannel('linkchat_mesh', { ordered: true });
    var tempPeerId = 'peer_' + Math.random().toString(36).substr(2, 6);
    setupDataChannel(currentOfferPC, dc, tempPeerId);

    // Wait for local ICE candidates to gather
    var offerPromise = new Promise(function (resolve) {
      currentOfferPC.onicecandidate = function (e) {
        if (!e.candidate) {
          // Gathering complete
          resolve(currentOfferPC.localDescription);
        }
      };
      // Timeout fallback in case gathering is slow
      setTimeout(function () {
        if (currentOfferPC && currentOfferPC.localDescription) {
          resolve(currentOfferPC.localDescription);
        }
      }, 1400);
    });

    var offer = await currentOfferPC.createOffer();
    await currentOfferPC.setLocalDescription(offer);

    var finalOffer = await offerPromise;
    var compressed = compressSDP(finalOffer);
    return compressed;
  }

  // 2. Client processes Offer and creates Answer
  async function createAnswerPairing(compressedOffer) {
    if (currentAnswerPC) {
      try { currentAnswerPC.close(); } catch (e) {}
    }
    var offerObj = decompressSDP(compressedOffer);
    currentAnswerPC = new RTCPeerConnection(rtcConfig);

    currentAnswerPC.ondatachannel = function (e) {
      var dc = e.channel;
      var tempPeerId = 'peer_' + Math.random().toString(36).substr(2, 6);
      setupDataChannel(currentAnswerPC, dc, tempPeerId);
    };

    await currentAnswerPC.setRemoteDescription(new RTCSessionDescription(offerObj));

    var answerPromise = new Promise(function (resolve) {
      currentAnswerPC.onicecandidate = function (e) {
        if (!e.candidate) resolve(currentAnswerPC.localDescription);
      };
      setTimeout(function () {
        if (currentAnswerPC && currentAnswerPC.localDescription) {
          resolve(currentAnswerPC.localDescription);
        }
      }, 1400);
    });

    var answer = await currentAnswerPC.createAnswer();
    await currentAnswerPC.setLocalDescription(answer);

    var finalAnswer = await answerPromise;
    return compressSDP(finalAnswer);
  }

  // 3. Host receives Answer
  async function completeOfferPairing(compressedAnswer) {
    if (!currentOfferPC) throw new Error('No pending offer found.');
    var answerObj = decompressSDP(compressedAnswer);
    await currentOfferPC.setRemoteDescription(new RTCSessionDescription(answerObj));
    return true;
  }

  // ---------- Broadcast & Send ----------
  function broadcast(packet) {
    var raw = JSON.stringify(packet);
    peers.forEach(function (p) {
      if (p.dc && p.dc.readyState === 'open') {
        try { p.dc.send(raw); } catch (e) {}
      }
    });
  }

  function broadcastExcept(excludeId, packet) {
    var raw = JSON.stringify(packet);
    peers.forEach(function (p, id) {
      if (id !== excludeId && p.dc && p.dc.readyState === 'open') {
        try { p.dc.send(raw); } catch (e) {}
      }
    });
  }

  function sendToPeer(peerId, packet) {
    var p = peers.get(peerId);
    if (p && p.dc && p.dc.readyState === 'open') {
      try { p.dc.send(JSON.stringify(packet)); } catch (e) {}
    }
  }

  // ---------- Camera QR Scanner ----------
  async function startQRScanner(videoElement, onDetected) {
    stopQRScanner();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported in this browser.');
    }

    scannerStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    videoElement.srcObject = scannerStream;
    await videoElement.play();

    // Check native BarcodeDetector API (Android Chrome & Safari 17+)
    if ('BarcodeDetector' in window) {
      var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      var detectLoop = async function () {
        if (!scannerStream) return;
        try {
          var barcodes = await detector.detect(videoElement);
          if (barcodes && barcodes.length > 0) {
            var raw = barcodes[0].rawValue;
            stopQRScanner();
            onDetected(raw);
            return;
          }
        } catch (e) {}
        scanAnimFrame = requestAnimationFrame(detectLoop);
      };
      scanAnimFrame = requestAnimationFrame(detectLoop);
    }
  }

  function stopQRScanner() {
    if (scanAnimFrame) {
      cancelAnimationFrame(scanAnimFrame);
      scanAnimFrame = null;
    }
    if (scannerStream) {
      try { scannerStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      scannerStream = null;
    }
  }

  return {
    on: on,
    emit: emit,
    localPeerId: localPeerId,
    getConnectedCount: getConnectedCount,
    updateStatusUI: updateStatusUI,
    createOfferPairing: createOfferPairing,
    createAnswerPairing: createAnswerPairing,
    completeOfferPairing: completeOfferPairing,
    broadcast: broadcast,
    sendToPeer: sendToPeer,
    startQRScanner: startQRScanner,
    stopQRScanner: stopQRScanner
  };
})();

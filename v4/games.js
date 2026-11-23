/**
 * LinkChat In-Chat Real-Time Multiplayer Gaming Arena
 * Zero-download, 60FPS games playable solo vs AI or 2-player P2P over Offline Mesh.
 * Games:
 *  1. Cyberpunk Neon Air Hockey (60FPS Physics Duel)
 *  2. Apple Glass Chess (Tactical Board Game)
 *  3. Snake Royale (Arcade Score Attack)
 */
'use strict';

window.GameArena = (function () {
  var currentGame = null; // 'hockey' | 'chess' | 'snake'
  var animId = null;
  var audioCtx = null;

  function getAudioCtx() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playSound(type) {
    try {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'hit') {
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'wall') {
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'goal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'eat') {
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.06);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      }
    } catch (e) {}
  }

  // =========================================================================
  // 1. Cyberpunk Neon Air Hockey (60FPS Physics Duel)
  // =========================================================================
  var Hockey = (function () {
    var canvas, ctx;
    var W = 600, H = 380;
    var p1 = { x: 80, y: 190, r: 24, score: 0, color: '#00f0ff' };
    var p2 = { x: 520, y: 190, r: 24, score: 0, color: '#ff0077', isBot: true };
    var puck = { x: 300, y: 190, vx: 0, vy: 0, r: 14, color: '#ffffff', trail: [] };
    var goalH = 140;
    var running = false;
    var isP2P = false;

    function resetPuck(scorer) {
      puck.x = W / 2;
      puck.y = H / 2;
      var dir = scorer === 1 ? -1 : 1;
      puck.vx = dir * (4 + Math.random() * 2);
      puck.vy = (Math.random() - 0.5) * 5;
      puck.trail = [];
    }

    function init(cvs) {
      canvas = cvs;
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      p1.score = 0;
      p2.score = 0;
      p1.x = 70; p1.y = H / 2;
      p2.x = W - 70; p2.y = H / 2;
      resetPuck(1);
      running = true;

      // Mouse and Touch Controls for Player 1
      function handlePointer(e) {
        var rect = canvas.getBoundingClientRect();
        var clientX = e.touches ? e.touches[0].clientX : e.clientX;
        var clientY = e.touches ? e.touches[0].clientY : e.clientY;
        var scaleX = canvas.width / rect.width;
        var scaleY = canvas.height / rect.height;
        var targetX = (clientX - rect.left) * scaleX;
        var targetY = (clientY - rect.top) * scaleY;

        // Player 1 restricted to left half
        p1.x = Math.max(p1.r, Math.min(W / 2 - p1.r - 8, targetX));
        p1.y = Math.max(p1.r, Math.min(H - p1.r, targetY));

        if (isP2P && window.MeshManager) {
          window.MeshManager.broadcast({
            type: 'game_packet',
            game: 'hockey',
            player: 1,
            x: p1.x,
            y: p1.y
          });
        }
      }

      canvas.onmousemove = handlePointer;
      canvas.ontouchmove = function (e) {
        e.preventDefault();
        handlePointer(e);
      };

      loop();
    }

    function update() {
      // AI Bot logic for Player 2 (when not remote peer)
      if (p2.isBot) {
        var targetY = puck.y;
        var dy = targetY - p2.y;
        p2.y += dy * 0.08;
        // Move towards puck if puck is in right half
        if (puck.x > W / 2) {
          var dx = (puck.x - 20) - p2.x;
          p2.x += Math.max(-3, Math.min(3, dx * 0.06));
        } else {
          // Return to home position
          var homeX = W - 70;
          p2.x += (homeX - p2.x) * 0.05;
        }
        // Restrict Player 2 to right half
        p2.x = Math.max(W / 2 + p2.r + 8, Math.min(W - p2.r, p2.x));
        p2.y = Math.max(p2.r, Math.min(H - p2.r, p2.y));
      }

      // Puck Physics
      puck.x += puck.vx;
      puck.y += puck.vy;
      puck.vx *= 0.992; // Table friction
      puck.vy *= 0.992;

      // Puck Trail
      puck.trail.push({ x: puck.x, y: puck.y });
      if (puck.trail.length > 8) puck.trail.shift();

      // Top & Bottom wall collision
      if (puck.y - puck.r <= 0) {
        puck.y = puck.r;
        puck.vy = -puck.vy * 0.95;
        playSound('wall');
      } else if (puck.y + puck.r >= H) {
        puck.y = H - puck.r;
        puck.vy = -puck.vy * 0.95;
        playSound('wall');
      }

      // Left & Right goals
      var inGoalY = puck.y > (H - goalH) / 2 && puck.y < (H + goalH) / 2;
      if (puck.x - puck.r <= 0) {
        if (inGoalY) {
          p2.score++;
          playSound('goal');
          resetPuck(2);
        } else {
          puck.x = puck.r;
          puck.vx = -puck.vx * 0.95;
          playSound('wall');
        }
      } else if (puck.x + puck.r >= W) {
        if (inGoalY) {
          p1.score++;
          playSound('goal');
          resetPuck(1);
        } else {
          puck.x = W - puck.r;
          puck.vx = -puck.vx * 0.95;
          playSound('wall');
        }
      }

      // Paddle collisions
      checkPaddleCollision(p1);
      checkPaddleCollision(p2);
    }

    function checkPaddleCollision(paddle) {
      var dx = puck.x - paddle.x;
      var dy = puck.y - paddle.y;
      var dist = Math.hypot(dx, dy);
      var minDist = puck.r + paddle.r;

      if (dist < minDist) {
        var angle = Math.atan2(dy, dx);
        var speed = Math.hypot(puck.vx, puck.vy);
        var force = Math.max(speed + 1.2, 7.5);
        puck.vx = Math.cos(angle) * force;
        puck.vy = Math.sin(angle) * force;
        // Push puck outside paddle
        puck.x = paddle.x + Math.cos(angle) * minDist;
        puck.y = paddle.y + Math.sin(angle) * minDist;
        playSound('hit');
      }
    }

    function render() {
      // Table Background
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      // Center Divider line & Circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 55, 0, Math.PI * 2);
      ctx.stroke();

      // Goal areas
      ctx.fillStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.fillRect(0, (H - goalH) / 2, 6, goalH);
      ctx.fillStyle = 'rgba(255, 0, 119, 0.2)';
      ctx.fillRect(W - 6, (H - goalH) / 2, 6, goalH);

      // Scores
      ctx.font = '700 48px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.fillText(p1.score, W / 4 - 15, 65);
      ctx.fillStyle = 'rgba(255, 0, 119, 0.35)';
      ctx.fillText(p2.score, (W * 3) / 4 - 15, 65);

      // Puck Trail
      puck.trail.forEach(function (pt, idx) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (idx / 16) + ')';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, puck.r * (idx / 8), 0, Math.PI * 2);
        ctx.fill();
      });

      // Puck
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Paddle 1 (Cyan)
      ctx.shadowColor = p1.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = p1.color;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, p1.r, 0, Math.PI * 2);
      ctx.fill();

      // Paddle 2 (Magenta)
      ctx.shadowColor = p2.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = p2.color;
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, p2.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    function loop() {
      if (!running) return;
      update();
      render();
      animId = requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (animId) cancelAnimationFrame(animId);
      animId = null;
    }

    function handleRemotePacket(pkt) {
      if (pkt.game === 'hockey' && pkt.player === 2) {
        p2.isBot = false;
        p2.x = pkt.x;
        p2.y = pkt.y;
      }
    }

    return {
      init: init,
      stop: stop,
      handleRemotePacket: handleRemotePacket
    };
  })();

  // =========================================================================
  // 2. Apple Glass Chess (Tactical Board Game)
  // =========================================================================
  var Chess = (function () {
    var boardContainer = null;
    var board = [];
    var turn = 'w';
    var selectedSq = null;

    var INITIAL_BOARD = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    var SYMBOLS = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    function init(container) {
      boardContainer = container;
      turn = 'w';
      selectedSq = null;
      board = INITIAL_BOARD.map(function (row) { return row.slice(); });
      renderBoard();
    }

    function renderBoard() {
      if (!boardContainer) return;
      boardContainer.innerHTML = '';
      var grid = document.createElement('div');
      grid.className = 'glass-chess-grid';

      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 8; c++) {
          var sq = document.createElement('div');
          var isDark = (r + c) % 2 === 1;
          sq.className = 'chess-sq ' + (isDark ? 'dark' : 'light');
          sq.dataset.row = r;
          sq.dataset.col = c;

          if (selectedSq && selectedSq.r === r && selectedSq.c === c) {
            sq.classList.add('selected');
          }

          var piece = board[r][c];
          if (piece) {
            var pEl = document.createElement('span');
            pEl.className = 'chess-piece ' + (piece === piece.toUpperCase() ? 'white-p' : 'black-p');
            pEl.textContent = SYMBOLS[piece] || piece;
            sq.appendChild(pEl);
          }

          sq.onclick = (function (row, col) {
            return function () { onSquareClick(row, col); };
          })(r, c);

          grid.appendChild(sq);
        }
      }
      boardContainer.appendChild(grid);

      var status = document.createElement('div');
      status.className = 'chess-status-bar';
      status.innerHTML = '<span>Turn: <strong>' + (turn === 'w' ? 'White' : 'Black') + '</strong></span>' +
                         '<button id="chess-reset-btn" class="btn-apple-text-sm" type="button">New Game</button>';
      boardContainer.appendChild(status);

      var rst = document.getElementById('chess-reset-btn');
      if (rst) rst.onclick = function () { init(boardContainer); };
    }

    function onSquareClick(r, c) {
      var piece = board[r][c];
      if (!selectedSq) {
        // Select piece if it matches current turn
        if (piece && ((turn === 'w' && piece === piece.toUpperCase()) || (turn === 'b' && piece === piece.toLowerCase()))) {
          selectedSq = { r: r, c: c };
          renderBoard();
        }
      } else {
        // Make move
        if (selectedSq.r !== r || selectedSq.c !== c) {
          var movingPiece = board[selectedSq.r][selectedSq.c];
          board[r][c] = movingPiece;
          board[selectedSq.r][selectedSq.c] = '';
          turn = turn === 'w' ? 'b' : 'w';
          playSound('hit');

          // Sync move over Mesh / Chat
          if (window.MeshManager) {
            window.MeshManager.broadcast({
              type: 'game_packet',
              game: 'chess',
              from: selectedSq,
              to: { r: r, c: c },
              turn: turn
            });
          }
        }
        selectedSq = null;
        renderBoard();
      }
    }

    function handleRemoteMove(pkt) {
      if (pkt.game === 'chess' && pkt.from && pkt.to) {
        board[pkt.to.r][pkt.to.c] = board[pkt.from.r][pkt.from.c];
        board[pkt.from.r][pkt.from.c] = '';
        turn = pkt.turn || (turn === 'w' ? 'b' : 'w');
        playSound('hit');
        renderBoard();
      }
    }

    return {
      init: init,
      handleRemoteMove: handleRemoteMove
    };
  })();

  // =========================================================================
  // 3. Snake Royale (Arcade Score Attack)
  // =========================================================================
  var Snake = (function () {
    var canvas, ctx;
    var W = 400, H = 400;
    var grid = 20;
    var snake = [{ x: 160, y: 160 }, { x: 140, y: 160 }, { x: 120, y: 160 }];
    var dx = 20, dy = 0;
    var food = { x: 260, y: 160 };
    var score = 0;
    var highScore = 0;
    var gameLoopId = null;
    var isRunning = false;

    function reset() {
      snake = [{ x: 160, y: 160 }, { x: 140, y: 160 }, { x: 120, y: 160 }];
      dx = 20; dy = 0;
      score = 0;
      spawnFood();
    }

    function spawnFood() {
      food.x = Math.floor(Math.random() * (W / grid)) * grid;
      food.y = Math.floor(Math.random() * (H / grid)) * grid;
    }

    function init(cvs) {
      canvas = cvs;
      ctx = canvas.getContext('2d');
      W = canvas.width;
      H = canvas.height;
      reset();
      isRunning = true;

      window.onkeydown = function (e) {
        if (!isRunning) return;
        if (e.key === 'ArrowUp' && dy === 0) { dx = 0; dy = -grid; }
        else if (e.key === 'ArrowDown' && dy === 0) { dx = 0; dy = grid; }
        else if (e.key === 'ArrowLeft' && dx === 0) { dx = -grid; dy = 0; }
        else if (e.key === 'ArrowRight' && dx === 0) { dx = grid; dy = 0; }
      };

      clearInterval(gameLoopId);
      gameLoopId = setInterval(step, 100);
    }

    function step() {
      if (!isRunning) return;
      var head = { x: snake[0].x + dx, y: snake[0].y + dy };

      // Wall wrap
      if (head.x < 0) head.x = W - grid;
      else if (head.x >= W) head.x = 0;
      if (head.y < 0) head.y = H - grid;
      else if (head.y >= H) head.y = 0;

      // Self collision check
      for (var i = 0; i < snake.length; i++) {
        if (snake[i].x === head.x && snake[i].y === head.y) {
          playSound('wall');
          reset();
          return;
        }
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10;
        if (score > highScore) highScore = score;
        playSound('eat');
        spawnFood();
      } else {
        snake.pop();
      }

      render();
    }

    function render() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      // Food (Glowing Apple)
      ctx.shadowColor = '#34c759';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#34c759';
      ctx.beginPath();
      ctx.arc(food.x + grid / 2, food.y + grid / 2, grid / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Snake Body
      snake.forEach(function (seg, idx) {
        ctx.fillStyle = idx === 0 ? '#007aff' : 'rgba(0, 122, 255, 0.7)';
        ctx.beginPath();
        ctx.roundRect(seg.x + 1, seg.y + 1, grid - 2, grid - 2, [4]);
        ctx.fill();
      });

      // Score
      ctx.font = '600 14px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText('Score: ' + score + '  |  Best: ' + highScore, 12, 22);
    }

    function stop() {
      isRunning = false;
      clearInterval(gameLoopId);
    }

    return {
      init: init,
      stop: stop
    };
  })();

  // =========================================================================
  // Game Arena Modal & Switcher UI
  // =========================================================================
  function launchGame(gameName) {
    currentGame = gameName;
    Hockey.stop();
    Snake.stop();

    var cvs = document.getElementById('arena-canvas');
    var chessWrap = document.getElementById('arena-chess-wrap');
    if (!cvs || !chessWrap) return;

    if (gameName === 'hockey') {
      cvs.hidden = false;
      chessWrap.hidden = true;
      cvs.width = 600;
      cvs.height = 360;
      Hockey.init(cvs);
    } else if (gameName === 'chess') {
      cvs.hidden = true;
      chessWrap.hidden = false;
      Chess.init(chessWrap);
    } else if (gameName === 'snake') {
      cvs.hidden = false;
      chessWrap.hidden = true;
      cvs.width = 400;
      cvs.height = 400;
      Snake.init(cvs);
    }
  }

  function openArena() {
    var modal = document.getElementById('arena-modal');
    if (modal) {
      modal.hidden = false;
      launchGame('hockey');
    }
  }

  function closeArena() {
    var modal = document.getElementById('arena-modal');
    if (modal) {
      modal.hidden = true;
      Hockey.stop();
      Snake.stop();
    }
  }

  return {
    openArena: openArena,
    closeArena: closeArena,
    launchGame: launchGame,
    Hockey: Hockey,
    Chess: Chess,
    Snake: Snake
  };
})();

// Game UI + Realtime over WebSocket + chess.js/chessboard.js
// Works with any WS backend implementing messages documented below.

(() => {
  // ---- Config ----
  const WAIT_FOR_SERVER_ACK = false; // true: chỉ update khi có ack từ server
  const WS_PATH = '/ws'; // WebSocket endpoint on same origin (ws(s)://host/ws)

  // ---- Helpers ----
  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);

  // Expected query params (fallbacks if server sends state later):
  let roomCode = params.get('room') || '';
  let gameId = params.get('gameId') || null;
  let myColor = (params.get('color') || 'white').toLowerCase(); // "white"|"black"
  let mode = (params.get('mode') || 'blitz').toLowerCase();     // "blitz"|"normal"
  let initSec = Number(params.get('init') || 300);              // blitz total seconds
  let incSec = Number(params.get('inc') || 0);                  // blitz increment
  let perMoveMax = Number(params.get('permove') || 90);         // normal per-move cap
  let myName = localStorage.getItem('username') || 'You';

  const state = {
    chess: new Chess(),
    board: null,
    lastMove: null,
    clocks: { white: initSec, black: initSec }, // blitz default
    perMoveLeft: perMoveMax, // normal default
    turn: 'white',
    running: true,
    orientation: myColor,
    moveHistory: [],
    highlight: null
  };

  // UI elements
  const el = {
    board: $('#board'),
    whiteClock: $('#whiteClock'),
    blackClock: $('#blackClock'),
    whiteName: $('#whiteName'),
    blackName: $('#blackName'),
    moveList: $('#moveList'),
    status: $('#statusBox'),
    turnWhite: $('#turnWhite'),
    turnBlack: $('#turnBlack'),
    btnOfferDraw: $('#btnOfferDraw'),
    btnResign: $('#btnResign'),
    btnFlip: $('#btnFlip'),
    btnCopy: $('#btnCopy'),
    btnBack: $('#btnBack'),
    chatBox: $('#chatBox'),
    chatInput: $('#chatInput'),
    btnSendChat: $('#btnSendChat'),
    gameInfo: $('#gameInfo')
  };

  // Format time helpers
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function setStatus(msg) {
    el.status.textContent = msg || '';
  }

  function setTurnIndicators() {
    el.turnWhite.classList.toggle('on', state.turn === 'white');
    el.turnBlack.classList.toggle('on', state.turn === 'black');
  }

  function syncClocksUI() {
    if (mode === 'blitz') {
      el.whiteClock.textContent = fmt(state.clocks.white);
      el.blackClock.textContent = fmt(state.clocks.black);
    } else {
      // normal: show the side-to-move per-move timer, other shows "—"
      el.whiteClock.textContent = state.turn === 'white' ? fmt(state.perMoveLeft) : '—';
      el.blackClock.textContent = state.turn === 'black' ? fmt(state.perMoveLeft) : '—';
    }
  }

  function pushMoveToList(moveSAN) {
    // Moves as list items: pair them in one li optionally
    // For simplicity, add one per move
    const li = document.createElement('li');
    const moveNo = Math.ceil((state.moveHistory.length + 1) / 2);
    li.textContent = `${moveNo}. ${moveSAN}`;
    el.moveList.appendChild(li);
    el.moveList.scrollTop = el.moveList.scrollHeight;
  }

  function highlightSquares(from, to) {
    // Add "highlight" by updating board's CSS (uses spare classes)
    // chessboard.js v1 doesn't expose direct square classes, but we can add with jQuery
    const $board = $('#board .board-b72b1');
    $board.find('.square-55d63').removeClass('highlight-from highlight-to');
    if (from) $board.find(`.square-${from}`).addClass('highlight-from');
    if (to) $board.find(`.square-${to}`).addClass('highlight-to');
  }

  // Add highlight CSS rules at runtime (yellow/green)
  const style = document.createElement('style');
  style.textContent = `
    .highlight-from { box-shadow: inset 0 0 0 3px rgba(255,215,0,.8) !important; }
    .highlight-to   { box-shadow: inset 0 0 0 3px rgba(110,168,254,.9) !important; }
  `;
  document.head.appendChild(style);

  function updateGameInfo() {
    const modeLabel = mode === 'blitz' ? `Blitz ${Math.round(initSec/60)}+${incSec}` : `Normal / per-move ${perMoveMax}s`;
    el.gameInfo.textContent = [
      roomCode ? `Room ${roomCode}` : '',
      gameId ? `Game #${gameId}` : '',
      `${modeLabel}`,
      `You: ${myName} (${myColor})`
    ].filter(Boolean).join(' · ');
  }

  // ---- Board setup ----
  function onDragStart(source, piece, position, orientation) {
    if (!state.running) return false;
    // Only allow dragging your pieces and only on your turn
    if ((state.turn === 'white' && piece.search(/^b/) !== -1) ||
        (state.turn === 'black' && piece.search(/^w/) !== -1)) return false;
    if (state.turn !== myColor) return false;
    return true;
  }

  function onDrop(source, target) {
    // Try move in chess.js (sloppy for SAN)
    const move = state.chess.move({ from: source, to: target, promotion: 'q' });
    if (move == null) return 'snapback';

    // Valid locally
    const fen = state.chess.fen();
    const san = move.san;
    state.lastMove = { from: source, to: target, san };
    state.moveHistory.push(san);

    // Clocks update (client-side prediction)
    applyLocalClockAfterMove();

    // UI
    pushMoveToList(san);
    setTurnIndicators();
    syncClocksUI();
    highlightSquares(source, target);
    setStatus(`${myColor} played ${san}`);

    // Notify server
    sendWS({
      type: 'move',
      gameId,
      move: { from: source, to: target, san, fen }
    });

    if (WAIT_FOR_SERVER_ACK) {
      // revert board until ack, otherwise do nothing
    }
  }

  function onSnapEnd() {
    // Ensure board position matches chess.js
    state.board.position(state.chess.fen());
  }

  function createBoard() {
    state.board = Chessboard('board', {
      draggable: true,
      position: 'start',
      orientation: state.orientation,
      onDragStart,
      onDrop,
      onSnapEnd,
      pieceTheme: 'https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/img/chesspieces/wikipedia/{piece}.png'
    });
  }

  // ---- Timers ----
  let tickTimer = null;
  function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
      if (!state.running) return;
      if (mode === 'blitz') {
        state.clocks[state.turn] -= 1;
        if (state.clocks[state.turn] <= 0) {
          state.clocks[state.turn] = 0;
          onFlag(state.turn);
        }
      } else {
        state.perMoveLeft -= 1;
        if (state.perMoveLeft <= 0) {
          state.perMoveLeft = 0;
          onFlag(state.turn);
        }
      }
      syncClocksUI();
    }, 1000);
  }
  function stopTick() { if (tickTimer) clearInterval(tickTimer); tickTimer = null; }

  function applyLocalClockAfterMove() {
    if (mode === 'blitz') {
      // Apply increment to side that just moved
      const movedColor = state.turn; // careful: chess.js has already switched turn after move
      const prevTurn = movedColor === 'white' ? 'black' : 'white';
      // In chess.js, after move, turn() is side to move NOW.
      // So the player who just moved is opposite of state.turn:
      const justMoved = prevTurn;
      state.clocks[justMoved] += incSec;
    } else {
      // reset per-move
      state.perMoveLeft = perMoveMax;
    }
    state.turn = state.chess.turn() === 'w' ? 'white' : 'black';
  }

  function onFlag(colorLost) {
    state.running = false;
    stopTick();
    const winner = colorLost === 'white' ? 'black' : 'white';
    setStatus(`Time out. ${winner.toUpperCase()} wins on time.`);
    sendWS({ type: 'timeout', gameId, loser: colorLost });
  }

  // ---- WebSocket ----
  let ws = null;
  let wsConnected = false;
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}${WS_PATH}`;
  }

  function connectWS() {
    if (ws) ws.close();
    ws = new WebSocket(wsUrl());
    ws.onopen = () => {
      wsConnected = true;
      // Join or rejoin
      sendWS({
        type: 'joinGame',
        room: roomCode || null,
        gameId: gameId || null,
        preferredColor: myColor,
        token: localStorage.getItem('token') || null // nếu backend cần JWT
      });
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        handleWS(msg);
      } catch (e) {
        console.warn('WS message parse error', e);
      }
    };
    ws.onclose = () => { wsConnected = false; setStatus('Mất kết nối. Đang thử lại...'); setTimeout(connectWS, 1500); };
    ws.onerror = () => { /* ignore */ };
  }
  function sendWS(obj) {
    if (!wsConnected) return;
    ws.send(JSON.stringify(obj));
  }

  // Server message handling
  // Expected messages (đề xuất):
  // - {type:'gameState', gameId, youColor, fen, turn, mode, clocks:{w,b}, perMoveMax, inc, names:{white,black}}
  // - {type:'move', move:{from,to,san,fen}, by:'white'|'black'}
  // - {type:'gameOver', result:'white'|'black'|'draw', reason:'checkmate'|'timeout'|'resign'|'draw'}
  // - {type:'chat', from, text}
  function handleWS(m) {
    switch (m.type) {
      case 'gameState': {
        gameId = m.gameId ?? gameId;
        if (m.youColor) {
          myColor = m.youColor;
          state.orientation = myColor;
          state.board.orientation(myColor);
        }
        if (m.mode) mode = m.mode;
        if (m.inc != null) incSec = m.inc;
        if (m.perMoveMax != null) perMoveMax = m.perMoveMax;
        if (m.names) {
          el.whiteName.textContent = m.names.white || 'White';
          el.blackName.textContent = m.names.black || 'Black';
          myName = myColor === 'white' ? m.names.white : m.names.black || myName;
        }
        // Position
        if (m.fen) {
          state.chess = new Chess(m.fen);
          state.board.position(m.fen, false);
        }
        state.turn = m.turn || (state.chess.turn() === 'w' ? 'white' : 'black');
        setTurnIndicators();

        // clocks
        if (mode === 'blitz' && m.clocks) {
          state.clocks.white = m.clocks.white ?? initSec;
          state.clocks.black = m.clocks.black ?? initSec;
        } else {
          state.perMoveLeft = m.perMoveLeft ?? perMoveMax;
        }
        syncClocksUI();
        updateGameInfo();
        state.running = true;
        startTick();
        setStatus('Trận đấu bắt đầu');
        break;
      }
      case 'move': {
        // Authoritative update from server
        if (m.move?.fen) {
          state.chess = new Chess(m.move.fen);
          state.board.position(m.move.fen, false);
          state.turn = state.chess.turn() === 'w' ? 'white' : 'black';
          highlightSquares(m.move.from, m.move.to);
          state.moveHistory.push(m.move.san);
          pushMoveToList(m.move.san);
          setTurnIndicators();
          if (mode === 'blitz' && typeof m.clocks?.white === 'number') {
            state.clocks.white = m.clocks.white;
            state.clocks.black = m.clocks.black;
          }
          if (mode === 'normal' && typeof m.perMoveLeft === 'number') {
            state.perMoveLeft = m.perMoveLeft;
          }
          syncClocksUI();
        }
        break;
      }
      case 'gameOver': {
        state.running = false;
        stopTick();
        setStatus(`Game Over · Result: ${m.result} (${m.reason})`);
        break;
      }
      case 'chat': {
        const div = document.createElement('div');
        div.textContent = `${m.from}: ${m.text}`;
        el.chatBox.appendChild(div);
        el.chatBox.scrollTop = el.chatBox.scrollHeight;
        break;
      }
      case 'error': {
        setStatus(`⚠️ ${m.message || 'Error'}`);
        break;
      }
    }
  }

  // ---- UI events ----
  el.btnOfferDraw.onclick = () => {
    sendWS({ type: 'offerDraw', gameId });
    setStatus('Đã gửi lời mời hòa');
  };
  el.btnResign.onclick = () => {
    if (confirm('Bạn chắc chắn đầu hàng?')) {
      sendWS({ type: 'resign', gameId });
      state.running = false;
      stopTick();
      setStatus('Bạn đã đầu hàng');
    }
  };
  el.btnFlip.onclick = () => {
    state.board.flip();
    state.orientation = state.orientation === 'white' ? 'black' : 'white';
  };
  el.btnCopy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(roomCode || '');
      setStatus('Đã copy mã phòng');
    } catch { /* noop */ }
  };
  el.btnBack.onclick = () => {
    location.href = '/human.html';
  };
  el.btnSendChat.onclick = () => {
    const text = el.chatInput.value.trim();
    if (!text) return;
    sendWS({ type: 'chat', text, gameId });
    el.chatInput.value = '';
  };

  // ---- Boot ----
  createBoard();
  el.whiteName.textContent = myColor === 'white' ? myName : 'Opponent';
  el.blackName.textContent = myColor === 'black' ? myName : 'Opponent';
  setTurnIndicators();
  syncClocksUI();
  updateGameInfo();
  connectWS();

  // If server chưa gửi state ngay, vẫn cho local start view
  startTick();

  // Expose for debugging
  window.__game = { state };
})();
(() => {
  const $ = (s) => document.querySelector(s);
  const qp = new URLSearchParams(location.search);
  const roomId = Number(qp.get('room_id'));
  if (!roomId) {
    alert('Missing room_id'); location.href = '/custom.html'; return;
  }

  const el = {
    title:   $('#roomTitle'),
    meta:    $('#roomMeta'),
    code:    $('#roomCode'),
    type:    $('#roomType'),
    mode:    $('#roomMode'),
    timeWrap:$('#roomTimeWrap'),
    time:    $('#roomTime'),
    youName: $('#youName'),
    youColor:$('#youColor'),
    youReady:$('#readyMy'),
    btnReady:$('#btnReadyMy'),
    oppoName:$('#oppoName'),
    oppoColor:$('#oppoColor'),
    oppoReady:$('#readyOppo'),
    btnStart:$('#btnStart'),
    status:  $('#status'),
    btnCopy: $('#btnCopy'),
    btnBack: $('#btnBack'),
    // online
    onlineList: $('#onlineList'),
    onlineSearch: $('#onlineSearch'),
    btnRefreshOnline: $('#btnRefreshOnline'),
    // invite toast
    toast: $('#inviteToast'),
    inviteMsg: $('#inviteMsg'),
    btnAccept: $('#btnAccept'),
    btnDecline: $('#btnDecline')
  };

  let socket = null;
  let socketReady = false;
  let room = null;
  let players = [];
  let me = { username: localStorage.getItem('username') || '' };
  let meColor = null;
  let isOwner = false;

  // Presence data
  let online = []; // [{user_id, username}]
  let inviteCtx = null; // current incoming invite context

  function setReadyBadge(node, ready) {
    node.textContent = ready ? 'Ready' : 'Not ready';
    node.classList.toggle('on', ready);
  }

  function applyRoomUI() {
    if (!room) return;
    el.title.textContent = room.room_name || `Room ${room.room_code}`;
    el.meta.textContent = `Created: ${new Date(room.created_at).toLocaleString()}`;
    el.code.textContent = room.room_code;
    el.type.textContent = room.room_type;
    el.mode.textContent = (room.room_mode || 'normal');
    if (room.room_mode === 'blitz') {
      el.timeWrap.style.display = 'block';
      const total = room.time_initial_sec || 300;
      const inc = room.increment_sec || 0;
      el.time.textContent = `${Math.round(total/60)}+${inc}`;
    } else if (room.room_mode === 'normal') {
      el.timeWrap.style.display = 'block';
      const per = room.per_move_max_sec || 60;
      el.time.textContent = `Per-move ${per}s`;
    } else {
      el.timeWrap.style.display = 'none';
    }

    // map players
    const w = players.find(p => p.player_color === 'white');
    const b = players.find(p => p.player_color === 'black');
    const opp = (w && w.username === me.username) ? b : w;

    const meP = players.find(p => p.username === me.username);
    meColor = meP?.player_color || null;
    isOwner = (meColor === 'white');

    el.youName.textContent = me.username || 'You';
    el.youColor.textContent = meColor ? `(${meColor})` : '-';
    setReadyBadge(el.youReady, !!meP?.is_ready);

    el.oppoName.textContent = opp?.username || 'Waiting...';
    el.oppoColor.textContent = opp?.player_color ? `(${opp.player_color})` : '-';
    setReadyBadge(el.oppoReady, !!opp?.is_ready);

    el.btnReady.disabled = !meP;
    el.btnStart.disabled = !(isOwner && players.length === 2 && players.every(p => p.is_ready));
    el.status.textContent = (players.length < 2)
      ? 'Waiting for opponent to join...'
      : (players.every(p => p.is_ready)
          ? (isOwner ? 'Opponent is ready. You can start the game.' : 'Ready. Waiting for host to start.')
          : 'Waiting for both players to be ready...');

    renderOnline(); // update invite buttons availability
  }

  async function loadRoom() {
    const data = await API.getRoom(roomId);
    room = data.room;
    players = data.players;
    me.username = localStorage.getItem('username') || data.me?.username || me.username;
    applyRoomUI();
  }

  function renderOnline() {
    const filter = (el.onlineSearch.value || '').trim().toLowerCase();
    const inRoomUserIds = new Set(players.map(p => p.user_id));
    el.onlineList.innerHTML = '';
    online
      .filter(u => u.username.toLowerCase().includes(filter))
      .forEach(u => {
        const div = document.createElement('div');
        div.className = 'online-item';
        div.innerHTML = `
          <div class="u">
            <div class="username">${u.username}</div>
            <div class="meta">id: ${u.user_id}</div>
          </div>
          <button class="invite" data-user="${u.user_id}">Invite</button>
        `;
        const btn = div.querySelector('button');
        // disable if inviting yourself or user already in this room or room full
        const roomFull = players.length >= 2;
        const isSelf = (u.username === me.username);
        const alreadyInRoom = inRoomUserIds.has(u.user_id);
        btn.disabled = roomFull || isSelf || alreadyInRoom;
        btn.onclick = () => {
          if (!socketReady) return alert('Connecting to server, please wait...');
          socket.emit('invite:send', { to_user_id: u.user_id, room_id: roomId });
          btn.textContent = 'Invited';
          btn.disabled = true;
          setTimeout(() => { btn.textContent = 'Invite'; btn.disabled = roomFull || isSelf || alreadyInRoom; }, 8000);
        };
        el.onlineList.appendChild(div);
      });
  }

  function connectSocket() {
    socket = window.getAuthedSocket && window.getAuthedSocket();
    if (!socket) { console.error('Missing getAuthedSocket'); return; }

    // lock controls until connected
    el.btnReady.disabled = true;

    socket.on('connect', () => {
      socketReady = true;
      el.btnReady.disabled = false;

      // Join room updates channel
      socket.emit('room:joinChannel', { room_id: roomId });

      // Announce presence (server lấy từ JWT nhưng để rõ ràng)
      socket.emit('presence:hello');
    });

    socket.on('disconnect', () => {
      socketReady = false;
      el.btnReady.disabled = true;
    });

    // Room updates
    socket.on('room:update', (payload) => {
      if (payload.room_id !== roomId) return;
      if (payload.players) players = payload.players;
      if (payload.room) room = payload.room;
      applyRoomUI();
    });

    socket.on('room:started', ({ room_id, game_id, players: pls }) => {
      if (room_id !== roomId) return;
      const list = pls || players;
      const meP = list.find(p => p.username === me.username);
      const color = meP?.player_color || meColor || 'white';
      const mode = room?.room_mode || 'normal';
      const params = new URLSearchParams({
        gameId: game_id,
        room: room?.room_code || '',
        color,
        mode,
        init: String(room?.time_initial_sec || 300),
        inc: String(room?.increment_sec || 0),
        permove: String(room?.per_move_max_sec || 60)
      });
      location.href = `/game.html?${params.toString()}`;
    });

    // Presence list and events
    socket.on('presence:list', (list) => {
      online = list || [];
      renderOnline();
    });
    socket.on('presence:join', (user) => {
      if (!user) return;
      // avoid duplicates
      if (!online.find(u => u.user_id === user.user_id)) online.push(user);
      renderOnline();
    });
    socket.on('presence:leave', (user) => {
      if (!user) return;
      online = online.filter(u => u.user_id !== user.user_id);
      renderOnline();
    });

    // Invite events
    socket.on('invite:received', ({ from_user, room }) => {
      inviteCtx = { from_user, room };
      el.inviteMsg.textContent = `${from_user.username} invited you to join room ${room.room_code}.`;
      el.toast.classList.remove('hidden');
    });
    socket.on('invite:accepted', ({ to_user_id }) => {
      // optional: toast feedback to inviter
      console.log('Invite accepted by', to_user_id);
    });
    socket.on('invite:declined', ({ to_user_id }) => {
      console.log('Invite declined by', to_user_id);
    });
  }

  // UI events
  el.btnReady.onclick = () => {
    if (!socketReady) return alert('Connecting to server, please wait...');
    socket.emit('room:setReady', { room_id: roomId, is_ready: true });
  };
  el.btnStart.onclick = () => {
    if (!socketReady) return alert('Connecting to server, please wait...');
    socket.emit('room:start', { room_id: roomId });
  };
  el.btnCopy.onclick = async () => {
    try { await navigator.clipboard.writeText(room?.room_code || ''); el.status.textContent = 'Copied room code.'; } catch {}
  };
  el.btnBack.onclick = () => history.back();
  el.btnRefreshOnline.onclick = () => socketReady && socket.emit('presence:hello');
  el.onlineSearch.oninput = () => renderOnline();

  // Invite toast actions
  el.btnAccept.onclick = () => {
    if (!inviteCtx) return;
    socket.emit('invite:respond', { room_id: inviteCtx.room.id, accept: true });
    el.toast.classList.add('hidden');
    // Navigate to invited room detail
    location.href = `/room.html?room_id=${inviteCtx.room.id}`;
  };
  el.btnDecline.onclick = () => {
    if (!inviteCtx) return;
    socket.emit('invite:respond', { room_id: inviteCtx.room.id, accept: false });
    el.toast.classList.add('hidden');
    inviteCtx = null;
  };

  // boot
  (async () => {
    await loadRoom();
    connectSocket();
  })();
})();
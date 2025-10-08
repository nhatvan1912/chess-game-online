(() => {
  const $ = (s) => document.querySelector(s);
  const status = $('#status');
  const elapsedEl = $('#elapsed');
  const btnCancel = $('#btnCancel');

  // Choose a ranked time control (example 5+0 blitz)
  const params = {
    mode: 'blitz',
    time_initial_sec: 300,
    increment_sec: 0
  };

  let socket = null;
  let t0 = Date.now();
  let timer = setInterval(() => {
    elapsedEl.textContent = Math.floor((Date.now() - t0) / 1000);
  }, 1000);

  function setStatus(s) { status.textContent = s; }

  function connect() {
    const token = localStorage.getItem('token');
    if (!token) {
      setStatus('Bạn chưa đăng nhập'); return;
    }
    socket = window.getAuthedSocket();
    socket.on('connect', () => {
      setStatus('Đang nối hàng đợi...');
      socket.emit('rank:enqueue', params);
    });

    socket.on('rank:queued', (q) => {
      setStatus(`Đang chờ đối thủ... (${q.queueSize} người trong hàng đợi)`);
    });

    socket.on('rank:found', (payload) => {
      setStatus('Đã tìm thấy đối thủ. Đang chuyển vào ván...');
      // Redirect both to game.html with needed params
      const qp = new URLSearchParams({
        gameId: payload.game_id,
        color: payload.color,
        mode: payload.mode,
        init: String(payload.time_initial_sec || 300),
        inc: String(payload.increment_sec || 0)
      });
      window.location.href = `/game.html?${qp.toString()}`;
    });

    socket.on('rank:canceled', () => {
      setStatus('Đã hủy hàng đợi.');
    });

    socket.on('rank:error', (msg) => {
      setStatus(`Lỗi: ${msg}`);
    });

    socket.on('disconnect', () => {
      setStatus('Mất kết nối máy chủ.');
    });
  }

  btnCancel.onclick = () => {
    if (socket && socket.connected) socket.emit('rank:cancel');
  };

  connect();
})();
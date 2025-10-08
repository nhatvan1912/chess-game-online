const modeEl = document.getElementById('mode');
const blitzCfg = document.getElementById('blitzCfg');
const normalCfg = document.getElementById('normalCfg');
modeEl.onchange = () => {
  const v = modeEl.value;
  blitzCfg.style.display = v === 'blitz' ? 'block' : 'none';
  normalCfg.style.display = v === 'normal' ? 'block' : 'none';
};

async function refreshRooms() {
  const { rooms } = await API.listRooms();
  const box = document.getElementById('rooms');
  box.innerHTML = '';
  rooms.forEach(r => {
    const div = document.createElement('div');
    div.innerHTML = `
      <div>
        <b>${r.room_name || r.room_code}</b>
        <small> · ${r.room_type} · ${r.room_mode || 'normal'} · ${r.player_count}/2</small>
      </div>
      <button data-id="${r.id}" data-code="${r.room_code}">Join</button>
    `;
    div.querySelector('button').onclick = async () => {
      const pwd = r.room_type === 'private' ? prompt('Nhập password:') : null;
      try {
        const resp = await API.joinRoom({ room_code: r.room_code, password: pwd });
        // chuyển thẳng sang trang room detail
        window.location.href = `/room.html?room_id=${resp.room_id}`;
      } catch (e) { alert(e.message); }
    };
    box.appendChild(div);
  });
}

document.getElementById('btnCreate').onclick = async () => {
  try {
    // ...inside btnCreate.onclick
    const body = {
      name: document.getElementById('roomName').value,
      type: document.getElementById('roomType').value,
      password: document.getElementById('roomPass').value || null,
      mode: modeEl.value,
      time_initial_sec: Number(document.getElementById('initSec').value || 300),
      per_move_max_sec: Number(document.getElementById('perMoveSec').value || 60),
      increment_sec: Number(document.getElementById('incSec').value || 0)
    };
    const r = await API.createRoom(body);
    window.location.href = `/room.html?room_id=${r.room_id}`;
  } catch (e) {
    document.getElementById('createMsg').textContent = e.message;
  }
};

refreshRooms();
setInterval(refreshRooms, 5000);
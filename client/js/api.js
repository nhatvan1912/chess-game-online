const API = {
  async request(path, { method = 'GET', body } = {}) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (ct.includes('application/json')) {
        const t = await res.json().catch(() => ({}));
        throw new Error(t.message || `HTTP ${res.status}`);
      } else {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} (non-JSON): ${text.slice(0,120)}...`);
      }
    }
    if (!ct.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Unexpected non-JSON response: ${text.slice(0,120)}...`);
    }
    return res.json();
  },
  getRoom(id) { return this.request(`/rooms/${id}`); },
  listRooms() { return this.request('/rooms'); },
  createRoom(data) { return this.request('/rooms', { method: 'POST', body: data }); },
  joinRoom(data) { return this.request('/rooms/join', { method: 'POST', body: data }); },
  setReady(room_id, is_ready) { return this.request(`/rooms/${room_id}/ready`, { method: 'POST', body: { is_ready } }); },
  login(data) { return this.request('/auth/login', { method: 'POST', body: data }); },
  register(data) { return this.request('/auth/register', { method: 'POST', body: data }); },
  me() { return this.request('/ranking/me'); }
};
window.API = API;
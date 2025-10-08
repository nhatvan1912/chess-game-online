(async () => {
  try {
    const me = await API.me();
    const p = document.getElementById('profile');
    p.innerHTML = `Xin chào <b>${localStorage.getItem('username')}</b> · Elo: <b>${me.rating}</b> · W:${me.stats.wins} L:${me.stats.losses} D:${me.stats.draws} · Rank: #${me.rank.rank_position || '?'}`;
  } catch (e) {
    window.location.href = '/';
  }
})();

document.getElementById('btnHuman').onclick = () => window.location.href = '/human.html';
document.getElementById('btnBot').onclick = () => alert('Code bot');
document.getElementById('btnRankings').onclick = () => alert('Bảng xếp hạng sẽ bổ sung sau');
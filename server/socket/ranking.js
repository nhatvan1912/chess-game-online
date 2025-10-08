export function createRankingQueue() {
  const queues = new Map();
  function key(ti, inc, mode) { return `${mode}-${ti}-${inc}`; }

  function enqueue(user, opts, socketId) {
    const k = key(opts.time_initial_sec, opts.increment_sec, opts.mode);
    if (!queues.has(k)) queues.set(k, []);
    const q = queues.get(k);
    // Avoid duplicates
    if (!q.find(e => e.user_id === user.user_id)) {
      q.push({ user_id: user.user_id, username: user.username, socketId, opts, t: Date.now() });
    }
    return { size: q.length, key: k };
  }

  function cancel(user) {
    for (const [k, q] of queues) {
      const i = q.findIndex(e => e.user_id === user.user_id);
      if (i !== -1) { q.splice(i, 1); return true; }
    }
    return false;
  }

  function pickPair(k) {
    const q = queues.get(k) || [];
    if (q.length >= 2) {
      const a = q.shift();
      const b = q.shift();
      return [a, b];
    }
    return null;
  }

  return { enqueue, cancel, pickPair, queues, key };
}
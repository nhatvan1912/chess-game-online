import { getUserRankPosition, getUserRating } from '../dao/userDao.js';

const queue = []; // { user_id, socketId, enqueuedAt, rating, rank }

export async function enqueuePlayer({ user_id, socketId }) {
  // tính rating và rank hiện tại
  const rating = await getUserRating(user_id);
  const { rank_position } = await getUserRankPosition(user_id);
  const now = Date.now();
  const entry = { user_id, socketId, enqueuedAt: now, rating, rank: rank_position || 1 };
  queue.push(entry);
  return entry;
}

export function dequeueBySocket(socketId) {
  const idx = queue.findIndex(q => q.socketId === socketId);
  if (idx >= 0) queue.splice(idx, 1);
}

export function removeByUser(user_id) {
  const idx = queue.findIndex(q => q.user_id === user_id);
  if (idx >= 0) queue.splice(idx, 1);
}

/**
 * Tìm cặp có chênh lệch rank <= 100. Nếu không có, trả về null.
 */
export function findMatchPair() {
  if (queue.length < 2) return null;
  // sort by enqueuedAt tăng dần để ưu tiên người đợi lâu
  const sorted = [...queue].sort((a, b) => a.enqueuedAt - b.enqueuedAt);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      const diffRank = Math.abs((a.rank || 1) - (b.rank || 1));
      if (diffRank <= 100) {
        // remove from queue
        removeByUser(a.user_id);
        removeByUser(b.user_id);
        return { a, b };
      }
    }
  }
  return null;
}

export function getWaitingSeconds(socketId) {
  const item = queue.find(q => q.socketId === socketId);
  if (!item) return 0;
  return Math.floor((Date.now() - item.enqueuedAt) / 1000);
}
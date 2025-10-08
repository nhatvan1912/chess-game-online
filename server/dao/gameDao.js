import { pool } from '../config/db.js';

export async function createGame({
  white_user_id, black_user_id, game_mode, room_id,
  time_initial_sec, increment_sec, per_move_max_sec
}) {
  const [r] = await db.query(
    `INSERT INTO tblGame
     (white_player_id, black_player_id, game_mode, status, result, winner_id,
      start_time, end_time, room_id)
     VALUES (?, ?, ?, 'playing', NULL, NULL, NOW(), NULL, ?)`,
    [white_user_id, black_user_id, game_mode, room_id || null]
  );
  // you can store time controls in a side table or keep them on tblGame if you already have columns
  return r.insertId;
}

export async function finishGame({ game_id, result, winner_id }) {
  await db.query(
    `UPDATE tblGame
     SET status='finished', result=?, winner_id=?, end_time=NOW()
     WHERE game_id=?`,
    [result, winner_id || null, game_id]
  );
}

export async function linkRankingGame({ user_id, game_id }) {
  await pool.execute(
    `INSERT IGNORE INTO tblRankingGame (user_id, game_id) VALUES (?, ?)`,
    [user_id, game_id]
  );
}
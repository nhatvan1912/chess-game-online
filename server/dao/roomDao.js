import { pool } from '../config/db.js';

export async function createRoom({
  room_code, room_name, room_type, password,
  room_mode, time_initial_sec, per_move_max_sec, increment_sec, is_ranked
}) {
  const [res] = await pool.execute(
    `
    INSERT INTO tblRoom
      (room_code, room_name, room_type, status, password,
       room_mode, time_initial_sec, per_move_max_sec, increment_sec, is_ranked)
    VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?)
    `,
    [room_code, room_name, room_type, password || null,
     room_mode, time_initial_sec, per_move_max_sec, increment_sec, is_ranked ? 1 : 0]
  );
  return res.insertId;
}

export async function setRoomStatus(roomId, status) {
  await pool.execute('UPDATE tblRoom SET status = ? WHERE id = ?', [status, roomId]);
}

export async function getRoomById(roomId) {
  const [rows] = await pool.execute('SELECT * FROM tblRoom WHERE id = ?', [roomId]);
  return rows[0] || null;
}

export async function getRoomByCode(room_code) {
  const [rows] = await pool.execute('SELECT * FROM tblRoom WHERE room_code = ?', [room_code]);
  return rows[0] || null;
}

export async function listOpenRooms() {
  // các phòng đang chờ và chưa đủ 2 người
  const [rows] = await pool.query(
    `
    SELECT r.*,
           COUNT(rp.id) AS player_count
    FROM tblRoom r
    LEFT JOIN tblRoomPlayer rp ON rp.room_id = r.id
    WHERE r.status = 'waiting' AND (r.room_type = 'public' OR r.password IS NULL)
    GROUP BY r.id
    HAVING player_count < 2
    ORDER BY r.created_at DESC
    `
  );
  return rows;
}

export async function addPlayerToRoom({ room_id, user_id, player_color }) {
  const [res] = await pool.execute(
    `
    INSERT INTO tblRoomPlayer (player_color, is_ready, user_id, room_id)
    VALUES (?, 0, ?, ?)
    `,
    [player_color, user_id, room_id]
  );
  return res.insertId;
}

export async function setPlayerReady({ room_id, user_id, is_ready }) {
  await pool.execute(
    `UPDATE tblRoomPlayer SET is_ready = ? WHERE room_id = ? AND user_id = ?`,
    [is_ready ? 1 : 0, room_id, user_id]
  );
}

export async function getRoomPlayers(room_id) {
  const [rows] = await pool.execute(
    `
    SELECT rp.*, u.username
    FROM tblRoomPlayer rp
    JOIN tableUser u ON u.user_id = rp.user_id
    WHERE rp.room_id = ?
    ORDER BY rp.player_color
    `,
    [room_id]
  );
  return rows;
}

export async function removePlayerFromRoom({ room_id, user_id }) {
  await pool.execute(
    `DELETE FROM tblRoomPlayer WHERE room_id = ? AND user_id = ?`,
    [room_id, user_id]
  );
}
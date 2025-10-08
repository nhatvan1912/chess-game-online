import { createRoom, getRoomById, getRoomPlayers, setRoomStatus, addPlayerToRoom } from '../dao/roomDao.js';

export function genRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createCustomRoom({
  name, type, password, mode, time_initial_sec, per_move_max_sec, increment_sec
}) {
  const id = await roomDao.createRoom({
    room_name: name || null,
    room_type: type || 'public',
    room_mode: mode || 'normal',
    password: password || null,
    time_initial_sec: mode === 'blitz' ? Number(time_initial_sec || 300) : null,
    per_move_max_sec: mode === 'normal' ? Number(per_move_max_sec || 60) : null,
    increment_sec: mode === 'blitz' ? Number(increment_sec || 0) : null
  });
  const room_code = await roomDao.generateRoomCodeFor(id);
  return { id, room_code };
}
export async function readyToStart(room_id) {
  const players = await getRoomPlayers(room_id);
  if (players.length === 2 && players.every(p => p.is_ready)) {
    await setRoomStatus(room_id, 'playing');
    return true;
  }
  return false;
}

export async function joinRoomWithColor({ room_id, user_id }) {
  const players = await getRoomPlayers(room_id);
  const colorsTaken = new Set(players.map(p => p.player_color));
  let color = 'white';
  if (!colorsTaken.has('white')) color = 'white';
  else if (!colorsTaken.has('black')) color = 'black';
  else throw new Error('Room is full');
  await addPlayerToRoom({ room_id, user_id, player_color: color });
  return color;
}
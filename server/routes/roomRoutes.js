import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import {
  listOpenRooms, getRoomById, getRoomByCode,
  setPlayerReady, getRoomPlayers
} from '../dao/roomDao.js';
import { createCustomRoom, joinRoomWithColor, readyToStart } from '../services/roomService.js';
dotenv.config();

const router = express.Router();

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Unauthorized' });
  }
}

router.get('/rooms', async (req, res) => {
  const rooms = await listOpenRooms();
  res.json({ ok: true, rooms });
});

router.get('/rooms/:room_id', auth, async (req, res) => {
  const room_id = Number(req.params.room_id);
  const room = await getRoomById(room_id);
  if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });
  const players = await getRoomPlayers(room_id);
  res.json({
    ok: true,
    room,
    players,
    me: { user_id: req.user.user_id, username: req.user.username }
  });
});

router.post('/rooms', auth, async (req, res) => {
  try {
    const { name, type, password, mode, time_initial_sec, per_move_max_sec, increment_sec } = req.body;
    const { id, room_code } = await createCustomRoom({
      name, type, password, mode, time_initial_sec, per_move_max_sec, increment_sec
    });
    const color = await joinRoomWithColor({ room_id: id, user_id: req.user.user_id });
    res.json({ ok: true, room_id: id, room_code, color });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

router.post('/rooms/join', auth, async (req, res) => {
  const { room_code, password } = req.body;
  const room = await getRoomByCode(room_code);
  if (!room) return res.status(404).json({ ok: false, message: 'Room not found' });
  if (room.room_type === 'private' && room.password && room.password !== password) {
    return res.status(403).json({ ok: false, message: 'Wrong password' });
  }
  try {
    const color = await joinRoomWithColor({ room_id: room.id, user_id: req.user.user_id });
    res.json({ ok: true, room_id: room.id, color, room });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

router.post('/rooms/:room_id/ready', auth, async (req, res) => {
  const room_id = Number(req.params.room_id);
  await setPlayerReady({ room_id, user_id: req.user.user_id, is_ready: !!req.body.is_ready });
  const canStart = await readyToStart(room_id);
  const players = await getRoomPlayers(room_id);
  res.json({ ok: true, canStart, players });
});

export default router;
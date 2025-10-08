import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getRoomById, getRoomPlayers, setPlayerReady } from '../dao/roomDao.js';
import { startGameFromRoom, startRankedGame } from '../services/gameService.js';
import { joinRoomWithColor } from '../services/roomService.js';
import { createRankingQueue } from './ranking.js';
dotenv.config();

export function initSocket(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const online = new Map();

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { user_id: payload.user_id, username: payload.username };
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  function roomChan(id) { return `room:${id}`; }
  function userSockets(user_id) {
    const rec = online.get(user_id);
    return rec ? Array.from(rec.sockets) : [];
  }
  function broadcastPresenceList(toSocketId) {
    const list = Array.from(online.values()).map(o => ({ user_id: o.user_id, username: o.username }));
    io.to(toSocketId).emit('presence:list', list);
  }

  const mm = createRankingQueue();

  io.on('connection', (socket) => {
    const { user_id, username } = socket.user;
    if (!online.has(user_id)) {
      online.set(user_id, { user_id, username, sockets: new Set([socket.id]) });
      socket.broadcast.emit('presence:join', { user_id, username });
    } else {
      online.get(user_id).sockets.add(socket.id);
    }

    socket.on('presence:hello', () => {
      broadcastPresenceList(socket.id);
    });

    socket.on('rank:enqueue', async ({ mode = 'blitz', time_initial_sec = 300, increment_sec = 0 } = {}) => {
      const enq = mm.enqueue(socket.user, { mode, time_initial_sec, increment_sec }, socket.id);
      io.to(socket.id).emit('rank:queued', { queueSize: enq.size });
      const pair = mm.pickPair(enq.key);
      if (pair) {
        const [A, B] = pair;
        try {
          const game_id = await startRankedGame({
            white_user_id: A.user_id,
            black_user_id: B.user_id
          });
          io.to(A.socketId).emit('rank:found', { game_id, color: 'white', mode, time_initial_sec, increment_sec });
          io.to(B.socketId).emit('rank:found', { game_id, color: 'black', mode, time_initial_sec, increment_sec });
        } catch (e) {
          io.to(A.socketId).emit('rank:error', e.message || 'Cannot start game');
          io.to(B.socketId).emit('rank:error', e.message || 'Cannot start game');
        }
      }
    });

    socket.on('rank:cancel', () => {
      if (mm.cancel(socket.user)) io.to(socket.id).emit('rank:canceled');
    });

    socket.on('room:joinChannel', async ({ room_id }) => {
      socket.join(roomChan(room_id));
      const room = await getRoomById(room_id);
      const players = await getRoomPlayers(room_id);
      io.to(roomChan(room_id)).emit('room:update', { room_id, room, players });
    });

    socket.on('room:setReady', async ({ room_id, is_ready }) => {
      try {
        await setPlayerReady({ room_id, user_id: socket.user.user_id, is_ready: !!is_ready });
        const room = await getRoomById(room_id);
        const players = await getRoomPlayers(room_id);
        io.to(roomChan(room_id)).emit('room:update', { room_id, room, players });
      } catch (e) {
        socket.emit('room:error', e.message);
      }
    });

    socket.on('room:start', async ({ room_id }) => {
      try {
        const room = await getRoomById(room_id);
        const players = await getRoomPlayers(room_id);
        if (!room || players.length !== 2 || !players.every(p => p.is_ready)) {
          return socket.emit('room:error', 'Room not ready or missing players');
        }
        const host = players.find(p => p.player_color === 'white');
        if (host?.user_id !== socket.user.user_id) {
          return socket.emit('room:error', 'Only host can start');
        }
        const white = players.find(p => p.player_color === 'white');
        const black = players.find(p => p.player_color === 'black');
        const game_id = await startGameFromRoom({
          room,
          white_user_id: white.user_id,
          black_user_id: black.user_id
        });
        io.to(roomChan(room_id)).emit('room:started', { room_id, game_id, players });
      } catch (e) {
        socket.emit('room:error', e.message);
      }
    });

    socket.on('invite:send', async ({ to_user_id, room_id }) => {
      const players = await getRoomPlayers(room_id);
      if (players.length >= 2) return;
      const sockets = userSockets(to_user_id);
      const room = await getRoomById(room_id);
      if (!room) return;
      sockets.forEach(sid => {
        io.to(sid).emit('invite:received', {
          from_user: { user_id, username },
          room: { id: room.id, room_code: room.room_code }
        });
      });
    });

    socket.on('invite:respond', async ({ room_id, accept }) => {
      const room = await getRoomById(room_id);
      if (!room) return;
      if (!accept) {
        io.emit('invite:declined', { to_user_id: user_id, room_id });
        return;
      }
      try {
        await joinRoomWithColor({ room_id: room.id, user_id });
        const players = await getRoomPlayers(room.id);
        io.to(roomChan(room.id)).emit('room:update', { room_id: room.id, room, players });
        userSockets(user_id).forEach(sid => io.sockets.sockets.get(sid)?.join(roomChan(room.id)));
        io.emit('invite:accepted', { to_user_id: user_id, room_id });
      } catch (e) {
        socket.emit('room:error', e.message);
      }
    });

    socket.on('disconnect', () => {
      const rec = online.get(user_id);
      if (rec) {
        rec.sockets.delete(socket.id);
        if (rec.sockets.size === 0) {
          online.delete(user_id);
          socket.broadcast.emit('presence:leave', { user_id, username });
        }
      }
    });
  });

  return io;
}
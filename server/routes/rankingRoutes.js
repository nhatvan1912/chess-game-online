import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getUserRating, getUserStats, getUserRankPosition } from '../dao/userDao.js';
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

router.get('/me', auth, async (req, res) => {
  const rating = await getUserRating(req.user.user_id);
  const stats = await getUserStats(req.user.user_id);
  const rank = await getUserRankPosition(req.user.user_id);
  res.json({ ok: true, rating, stats, rank });
});

export default router;
import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { enqueuePlayer, dequeueBySocket } from '../services/matchmakingService.js';
dotenv.config();

const router = express.Router();

router.post('/enqueue', async (req, res) => {
  res.json({ ok: true });
});

export default router;
import express from 'express';
import { login, register } from '../services/authService.js';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const user_id = await register(req.body);
    res.json({ ok: true, user_id });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const data = await login({ ...req.body, jwtSecret: process.env.JWT_SECRET });
    res.json({ ok: true, ...data });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

export default router;
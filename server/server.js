import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import { ping } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import rankingRoutes from './routes/rankingRoutes.js';
import matchmakingRoutes from './routes/matchmakingRoutes.js';
import { initSocket } from './socket/index.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
initSocket(server);

app.use(cors());
app.use(express.json());

// 1) API ROUTES FIRST
app.use('/api/auth', authRoutes);
app.use('/api', roomRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/matchmaking', matchmakingRoutes);

// 2) STATIC FILES FOR CLIENT
const staticDir = path.join(__dirname, '../client');
console.log('Serving static from:', staticDir);
app.use(express.static(staticDir));

// 3) OPTIONAL: home route (KHÔNG dùng wildcard *)
app.get('/', (req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// 4) 404 cho route không có
app.use((req, res) => {
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;

(async () => {
  await ping();
  server.listen(PORT, () => {
    console.log(`Server listening at http://localhost:${PORT}`);
  });
})();
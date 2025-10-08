import { pool } from '../config/db.js';

export async function createUser({ username, passwordHash }) {
  const [res] = await pool.execute(
    'INSERT INTO tblUser (username, password) VALUES (?, ?)',
    [username, passwordHash]
  );
  return res.insertId;
}

export async function findUserByUsername(username) {
  const [rows] = await pool.execute(
    'SELECT * FROM tblUser WHERE username = ?',
    [username]
  );
  return rows[0] || null;
}

export async function getUserById(userId) {
  const [rows] = await pool.execute(
    'SELECT * FROM tblUser WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
}

export async function getUserRating(userId) {
  const [rows] = await pool.execute(
    `
    SELECT 1200 + IFNULL(SUM(rg.pointChange), 0) AS rating
    FROM tblUser u
    LEFT JOIN tblRankingGame rg ON rg.user_id = u.user_id
    WHERE u.user_id = ?
    GROUP BY u.user_id
    `,
    [userId]
  );
  return rows[0]?.rating ?? 1200;
}

export async function getUserRankPosition(userId) {
  const [rows] = await pool.query(
    `
    WITH ratings AS (
      SELECT
        u.user_id,
        1200 + IFNULL(SUM(rg.pointChange), 0) AS rating
      FROM tblUser u
      LEFT JOIN tblRankingGame rg ON rg.user_id = u.user_id
      GROUP BY u.user_id
    ),
    ranks AS (
      SELECT user_id, rating, DENSE_RANK() OVER (ORDER BY rating DESC) AS rnk
      FROM ratings
    )
    SELECT rnk AS rank_position, rating
    FROM ranks
    WHERE user_id = ?
    `,
    [userId]
  );
  return rows[0] || { rank_position: null, rating: 1200 };
}

export async function getUserStats(userId) {
  const [rows] = await pool.query(
    `
    SELECT
      SUM(CASE WHEN result = 'white' AND white_player_id = ? THEN 1
               WHEN result = 'black' AND black_player_id = ? THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN result = 'white' AND black_player_id = ? THEN 1
               WHEN result = 'black' AND white_player_id = ? THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END) AS draws
    FROM tblGame
    WHERE status = 'finished'
    `,
    [userId, userId, userId, userId]
  );
  return rows[0] || { wins: 0, losses: 0, draws: 0 };
}

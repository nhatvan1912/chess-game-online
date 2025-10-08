export async function addRankingRecord({ user_id, game_id, pointChange }) {
  await db.query(
    `INSERT INTO tblRankingGame (user_id, game_id, pointChange)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE pointChange=VALUES(pointChange)`,
    [user_id, game_id, pointChange]
  );
}
export async function getByGameId(game_id) {
  const [rows] = await db.query(
    `SELECT user_id, pointChange FROM tblRankingGame WHERE game_id=? ORDER BY user_id`,
    [game_id]
  );
  return rows;
}
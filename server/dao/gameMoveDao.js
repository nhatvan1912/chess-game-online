import { pool } from '../config/db.js';

export async function insertMove({
  game_id, move_number, player_color, move_notation, board_state_fen
}) {
  await pool.execute(
    `
    INSERT INTO tblGameMove
      (game_id, move_number, player_color, move_notation, board_state_fen)
    VALUES (?, ?, ?, ?, ?)
    `,
    [game_id, move_number, player_color, move_notation, board_state_fen]
  );
}
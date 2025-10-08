import { Chess } from 'chess.js';
import { insertMove } from '../dao/gameMoveDao.js';
import { createGame, finishGame, linkRankingGame } from '../dao/gameDao.js';
import { getUserRating } from '../dao/userDao.js';
import { computeEloChange } from './elo.js';

const games = new Map();

export async function startGameFromRoom({ room, white_user_id, black_user_id }) {
  const game_id = await createGame({
    white_player_id: white_user_id,
    black_player_id: black_user_id,
    game_mode: 'custom',
    room_id: room.id
  });

  const chess = new Chess();
  games.set(game_id, {
    chess,
    moves: [],
    white_user_id,
    black_user_id,
    is_ranked: false
  });

  return game_id;
}

export async function startRankedGame({ white_user_id, black_user_id }) {
  const game_id = await createGame({
    white_player_id: white_user_id,
    black_player_id: black_user_id,
    game_mode: 'ranked',
    room_id: null
  });

  const chess = new Chess();
  games.set(game_id, {
    chess,
    moves: [],
    white_user_id,
    black_user_id,
    is_ranked: true
  });

  return game_id;
}

export function getGame(game_id) {
  return games.get(game_id);
}

export async function recordMove({ game_id, player_color, move_notation }) {
  const g = games.get(game_id);
  if (!g) throw new Error('Game not in memory');

  const { chess } = g;

  const mv = chess.move(move_notation, { sloppy: true });
  if (!mv) throw new Error('Invalid move');

  const move_number = g.moves.length + 1;
  const board_state_fen = chess.fen();
  g.moves.push({ move_number, player_color, move_notation, board_state_fen });

  await insertMove({ game_id, move_number, player_color, move_notation, board_state_fen });

  const isOver = chess.isGameOver();
  return { isOver, fen: board_state_fen };
}

export async function concludeGame({ game_id }) {
  const g = games.get(game_id);
  if (!g) return null;

  const { chess, white_user_id, black_user_id, is_ranked } = g;

  let result = 'draw';
  let winner_id = null;

  if (chess.isCheckmate()) {
    const sideToMove = chess.turn(); // 'w' or 'b'
    if (sideToMove === 'w') {
      result = 'black';
      winner_id = black_user_id;
    } else {
      result = 'white';
      winner_id = white_user_id;
    }
  } else if (chess.isDraw()) {
    result = 'draw';
  }

  let whitePointChange = 0;
  let blackPointChange = 0;

  if (is_ranked) {
    const whiteRating = await getUserRating(white_user_id);
    const blackRating = await getUserRating(black_user_id);

    const scoreWhite = result === 'white' ? 1 : result === 'draw' ? 0.5 : 0;
    const { changeA, changeB } = computeEloChange(whiteRating, blackRating, scoreWhite, 32);

    whitePointChange = changeA;
    blackPointChange = changeB;

    await linkRankingGame({ user_id: white_user_id, game_id, pointChange: whitePointChange });
    await linkRankingGame({ user_id: black_user_id, game_id, pointChange: blackPointChange });
  }

  await finishGame({
    game_id,
    result,
    winner_id
  });

  games.delete(game_id);

  return {
    result,
    winner_id,
    pointChanges: [
      { user_id: white_user_id, delta: whitePointChange },
      { user_id: black_user_id, delta: blackPointChange }
    ]
  };
}
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');
await import('../js/ai/search.js');

const { AI, AISearch, Config } = globalThis.Gomoku;
const emptyBoard = () => Array.from({ length: Config.SIZE }, () => Array(Config.SIZE).fill(0));

test('AI 空棋盘选择中心点', () => {
  const move = AI.chooseMove(emptyBoard(), [], () => 0);
  assert.deepEqual(move, { r: 7, c: 7 });
});

test('AI 优先完成自己的五连', () => {
  const board = emptyBoard();
  const moves = [];
  for (let c = 3; c <= 6; c += 1) {
    board[7][c] = Config.WHITE;
    moves.push({ r: 7, c, player: Config.WHITE });
  }
  board[7][2] = Config.BLACK;
  moves.push({ r: 7, c: 2, player: Config.BLACK });
  const detail = AI.chooseMoveDetailed(board, moves, Config.AI_DIFFICULTIES.HARD, Config.WHITE, () => 0);
  assert.deepEqual(detail.move, { r: 7, c: 7 });
  assert.match(detail.explanation.reason, /五连/);
});

test('AI 会阻挡玩家直接五连并给出解释', () => {
  const board = emptyBoard();
  const moves = [];
  for (let c = 4; c <= 7; c += 1) {
    board[8][c] = Config.BLACK;
    moves.push({ r: 8, c, player: Config.BLACK });
  }
  board[8][3] = Config.WHITE;
  moves.push({ r: 8, c: 3, player: Config.WHITE });
  const detail = AI.chooseMoveDetailed(board, moves, Config.AI_DIFFICULTIES.NORMAL, Config.WHITE, () => 0);
  assert.deepEqual(detail.move, { r: 8, c: 8 });
  assert.match(detail.explanation.reason, /阻止/);
});

test('四种 AI 棋风人格具有不同权重', () => {
  const attack = AI.personaWeights(Config.AI_PERSONAS.ATTACK);
  const defense = AI.personaWeights(Config.AI_PERSONAS.DEFENSE);
  const risky = AI.personaWeights(Config.AI_PERSONAS.RISKY);
  assert.ok(attack.attack > defense.attack);
  assert.ok(defense.defense > attack.defense);
  assert.ok(risky.attack > attack.attack);
});

test('候选手比较与幽灵变化线可以生成', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  const candidates = AI.compareCandidates(board, moves, Config.WHITE, Config.AI_PERSONAS.BALANCED, 3);
  assert.equal(candidates.length, 3);
  const preview = AISearch.previewLine(board, moves, candidates[0].r, candidates[0].c, Config.WHITE);
  assert.ok(preview?.line?.length >= 1);
  assert.deepEqual(preview.line[0].r, candidates[0].r);
  assert.equal(board[candidates[0].r][candidates[0].c], 0);
});

test('简单与困难模式都只返回空位置', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  for (const difficulty of [Config.AI_DIFFICULTIES.EASY, Config.AI_DIFFICULTIES.HARD]) {
    const detail = AI.chooseMoveDetailed(board, moves, difficulty, Config.WHITE, () => 0);
    assert.equal(board[detail.move.r][detail.move.c], 0);
  }
});


test('自由摆局在没有 moves 历史时仍按实际棋盘生成候选点', () => {
  const board = emptyBoard();
  board[2][2] = Config.BLACK;
  board[10][10] = Config.WHITE;

  const candidates = AI.getCandidateMoves(board, []);
  assert.ok(candidates.length > 1);
  assert.ok(candidates.some(move => Math.abs(move.r - 2) <= 2 && Math.abs(move.c - 2) <= 2));
  assert.ok(candidates.some(move => Math.abs(move.r - 10) <= 2 && Math.abs(move.c - 10) <= 2));
  assert.equal(candidates.some(move => board[move.r][move.c] !== 0), false);
});

const scoreService = require('../services/scoreService');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Handle new score submission
 * POST /api/scores
 */
const postScore = asyncHandler(async (req, res) => {
  const result = await scoreService.saveScore(req.body);
  res.status(201).json({
    status: 'success',
    message: 'Score record saved successfully',
    data: result,
  });
});

/**
 * Handle global leaderboard retrieval
 * GET /api/leaderboard
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await scoreService.getLeaderboard();
  res.status(200).json({
    status: 'success',
    results: leaderboard.length,
    data: leaderboard,
  });
});

/**
 * Handle region-specific leaderboard retrieval
 * GET /api/leaderboard/:region
 */
const getLeaderboardByRegion = asyncHandler(async (req, res) => {
  const { region } = req.params;
  const leaderboard = await scoreService.getLeaderboard(region);
  res.status(200).json({
    status: 'success',
    region,
    results: leaderboard.length,
    data: leaderboard,
  });
});

/**
 * Handle retrieval of flagged/suspicious players (Risk score >= 2)
 * GET /api/flagged-players
 */
const getFlaggedPlayers = asyncHandler(async (req, res) => {
  const flagged = await scoreService.getFlaggedPlayers();
  res.status(200).json({
    status: 'success',
    results: flagged.length,
    data: flagged,
  });
});

/**
 * Handle matchmaking pools retrieval
 * GET /api/matchmaking
 */
const getMatchmaking = asyncHandler(async (req, res) => {
  const groups = await scoreService.getMatchmakingGroups();
  res.status(200).json({
    status: 'success',
    results: groups.length,
    data: groups,
  });
});

module.exports = {
  postScore,
  getLeaderboard,
  getLeaderboardByRegion,
  getFlaggedPlayers,
  getMatchmaking,
};

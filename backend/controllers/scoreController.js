const scoreService = require('../services/scoreService');
const asyncHandler = require('../utils/asyncHandler');
const simulationRunner = require('../utils/simulationRunner');

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

/**
 * Get current simulation status
 * GET /api/simulation/status
 */
const getSimulationStatus = asyncHandler(async (req, res) => {
  const status = simulationRunner.status();
  res.status(200).json({
    status: 'success',
    data: status,
  });
});

/**
 * Start simulation
 * POST /api/simulation/start
 */
const startSimulation = asyncHandler(async (req, res) => {
  const { intervalSeconds } = req.body;
  simulationRunner.start(Number(intervalSeconds) || 5);
  res.status(200).json({
    status: 'success',
    message: 'Simulation started successfully',
    data: simulationRunner.status(),
  });
});

/**
 * Stop simulation
 * POST /api/simulation/stop
 */
const stopSimulation = asyncHandler(async (req, res) => {
  simulationRunner.stop();
  res.status(200).json({
    status: 'success',
    message: 'Simulation stopped successfully',
    data: simulationRunner.status(),
  });
});

/**
 * Trigger simulated record injection immediately
 * POST /api/simulation/trigger
 */
const triggerSimulation = asyncHandler(async (req, res) => {
  const { type } = req.body;
  if (type && !['normal', 'review', 'suspicious'].includes(type)) {
    return res.status(400).json({
      status: 'fail',
      message: 'Invalid simulation type. Must be normal, review, or suspicious.',
    });
  }
  const record = await simulationRunner.trigger(type);
  res.status(201).json({
    status: 'success',
    message: 'Telemetry record simulated and injected successfully',
    data: record,
  });
});

/**
 * Reset simulated scores
 * POST /api/simulation/reset
 */
const resetSimulation = asyncHandler(async (req, res) => {
  simulationRunner.stop();
  await simulationRunner.reset();
  res.status(200).json({
    status: 'success',
    message: 'All simulated data deleted, simulation stopped',
    data: simulationRunner.status(),
  });
});

module.exports = {
  postScore,
  getLeaderboard,
  getLeaderboardByRegion,
  getFlaggedPlayers,
  getMatchmaking,
  getSimulationStatus,
  startSimulation,
  stopSimulation,
  triggerSimulation,
  resetSimulation,
};

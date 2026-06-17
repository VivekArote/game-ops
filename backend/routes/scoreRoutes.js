const express = require('express');
const router = express.Router();
const scoreController = require('../controllers/scoreController');
const { validateScore } = require('../middleware/validator');

// Post match results - validated by Joi schema
router.post('/scores', validateScore, scoreController.postScore);

// Get global leaderboard - excluding suspicious players, sorted by score, deaths, kills
router.get('/leaderboard', scoreController.getLeaderboard);

// Get region-specific leaderboard
router.get('/leaderboard/:region', scoreController.getLeaderboardByRegion);

// Get flagged players - returns players under review (risk 2) or suspicious (risk 3+)
router.get('/flagged-players', scoreController.getFlaggedPlayers);

// Get grouped matchmaking pools
router.get('/matchmaking', scoreController.getMatchmaking);

// Simulation controls
router.get('/simulation/status', scoreController.getSimulationStatus);
router.post('/simulation/start', scoreController.startSimulation);
router.post('/simulation/stop', scoreController.stopSimulation);
router.post('/simulation/trigger', scoreController.triggerSimulation);
router.post('/simulation/reset', scoreController.resetSimulation);

module.exports = router;

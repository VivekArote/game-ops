const path = require('path');
const fileLock = require('../utils/fileLock');
const { evaluatePlayerRisk } = require('../utils/anomalyDetector');
const { groupPlayersForMatchmaking } = require('../utils/matchmaker');
const logger = require('../middleware/logger');

// Retrieve path to our JSON storage from environment variables or default to local data directory
const getFilePath = () => {
  return path.resolve(process.env.DATA_FILE_PATH || './data/scores.json');
};

/**
 * Save player match score to JSON database.
 * @param {Object} scoreData - Validated player score record
 * @returns {Promise<Object>} The written score record with timestamp
 */
const saveScore = async (scoreData) => {
  const filePath = getFilePath();
  const scores = await fileLock.readJson(filePath);
  
  // Append new score record with submission timestamp
  const record = {
    ...scoreData,
    submitted_at: new Date().toISOString()
  };
  scores.push(record);
  
  await fileLock.writeJson(filePath, scores);
  logger.info(`Saved score record for player: ${scoreData.player_id}, match: ${scoreData.match_id}`);
  return record;
};

/**
 * Get leaderboard, excluding suspicious players (risk score >= 3), ranked.
 * If a player has multiple submissions, their highest/best performance is selected.
 * 
 * @param {string} [regionFilter] - Optional region filter
 * @returns {Promise<Array>} List of ranked player records
 */
const getLeaderboard = async (regionFilter = null) => {
  const filePath = getFilePath();
  const scores = await fileLock.readJson(filePath);

  // Group by player_id and keep only their best match performance
  const bestScoresMap = {};

  for (const record of scores) {
    const risk = evaluatePlayerRisk(record);
    // Exclude suspicious players from leaderboard
    if (risk.riskScore >= 3) {
      continue;
    }

    const playerId = record.player_id;
    const currentBest = bestScoresMap[playerId];

    if (!currentBest) {
      bestScoresMap[playerId] = record;
    } else {
      // Comparison logic for personal best:
      // 1. Higher score
      // 2. Fewer deaths
      // 3. Higher kills
      let isBetter = false;
      if (record.score > currentBest.score) {
        isBetter = true;
      } else if (record.score === currentBest.score) {
        if (record.deaths < currentBest.deaths) {
          isBetter = true;
        } else if (record.deaths === currentBest.deaths) {
          if (record.kills > currentBest.kills) {
            isBetter = true;
          }
        }
      }
      if (isBetter) {
        bestScoresMap[playerId] = record;
      }
    }
  }

  let players = Object.values(bestScoresMap);

  // Filter by region if specified
  if (regionFilter) {
    players = players.filter(
      (p) => p.region.toLowerCase() === regionFilter.toLowerCase()
    );
  }

  // Sort based on Leaderboard rules:
  // 1. Higher score
  // 2. Fewer deaths
  // 3. Higher kills
  players.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.deaths !== b.deaths) {
      return a.deaths - b.deaths;
    }
    return b.kills - a.kills;
  });

  // Attach rank numbers
  return players.map((player, index) => {
    const risk = evaluatePlayerRisk(player);
    return {
      rank: index + 1,
      player_id: player.player_id,
      match_id: player.match_id,
      region: player.region,
      device: player.device,
      ping: player.ping,
      score: player.score,
      kills: player.kills,
      deaths: player.deaths,
      match_duration_seconds: player.match_duration_seconds,
      submitted_at: player.submitted_at,
      risk_status: risk.status,
      riskScore: risk.riskScore,
    };
  });
};

/**
 * Get all players with elevated risk scores (risk score >= 2: Review or Suspicious status).
 * Shows the anomaly details for auditing purposes.
 * 
 * @returns {Promise<Array>} List of flagged player records with risk profiles
 */
const getFlaggedPlayers = async () => {
  const filePath = getFilePath();
  const scores = await fileLock.readJson(filePath);

  // Get unique list of players with their latest match submission to reflect their current risk state
  const playerLatestMatchMap = {};
  for (const record of scores) {
    const existing = playerLatestMatchMap[record.player_id];
    if (!existing || new Date(record.submitted_at) > new Date(existing.submitted_at)) {
      playerLatestMatchMap[record.player_id] = record;
    }
  }

  const flagged = [];
  for (const record of Object.values(playerLatestMatchMap)) {
    const risk = evaluatePlayerRisk(record);
    if (risk.riskScore >= 2) {
      flagged.push({
        player_id: record.player_id,
        match_id: record.match_id,
        region: record.region,
        device: record.device,
        ping: record.ping,
        score: record.score,
        kills: record.kills,
        deaths: record.deaths,
        match_duration_seconds: record.match_duration_seconds,
        submitted_at: record.submitted_at,
        anomaly_details: risk,
      });
    }
  }

  // Sort by risk score descending (most severe first)
  flagged.sort((a, b) => b.anomaly_details.riskScore - a.anomaly_details.riskScore);

  return flagged;
};

/**
 * Group players in the system into matchmaking queues.
 * @returns {Promise<Array>} Grouped matchmaking pools
 */
const getMatchmakingGroups = async () => {
  const filePath = getFilePath();
  const scores = await fileLock.readJson(filePath);

  // Get the latest match record for each player to represent their current active state and rank metrics
  const latestPlayersMap = {};
  for (const record of scores) {
    const existing = latestPlayersMap[record.player_id];
    if (!existing || new Date(record.submitted_at) > new Date(existing.submitted_at)) {
      latestPlayersMap[record.player_id] = record;
    }
  }

  const activePlayers = Object.values(latestPlayersMap);
  return groupPlayersForMatchmaking(activePlayers, evaluatePlayerRisk);
};

module.exports = {
  saveScore,
  getLeaderboard,
  getFlaggedPlayers,
  getMatchmakingGroups,
};

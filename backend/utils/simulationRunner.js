const path = require('path');
const fileLock = require('./fileLock');
const scoreService = require('../services/scoreService');
const logger = require('../middleware/logger');

// Retrieve path to our JSON storage
const getFilePath = () => {
  return path.resolve(process.env.DATA_FILE_PATH || './data/scores.json');
};

// Simulated Players Pool (to show consistent player statistics over time)
const SIM_PLAYERS = [
  { id: 'SIM_P101', region: 'India', device: 'Android', basePing: 45 },
  { id: 'SIM_P102', region: 'India', device: 'iOS', basePing: 35 },
  { id: 'SIM_P103', region: 'India', device: 'Android', basePing: 75 },
  { id: 'SIM_P104', region: 'USA', device: 'PC', basePing: 25 },
  { id: 'SIM_P105', region: 'USA', device: 'Console', basePing: 50 },
  { id: 'SIM_P106', region: 'USA', device: 'PC', basePing: 18 },
  { id: 'SIM_P107', region: 'Europe', device: 'PC', basePing: 28 },
  { id: 'SIM_P108', region: 'Europe', device: 'Android', basePing: 80 },
  { id: 'SIM_P109', region: 'Europe', device: 'Console', basePing: 42 },
  { id: 'SIM_P110', region: 'Asia', device: 'iOS', basePing: 55 },
  { id: 'SIM_P111', region: 'Asia', device: 'Android', basePing: 90 },
  { id: 'SIM_P112', region: 'Asia', device: 'PC', basePing: 30 },
  { id: 'SIM_P113', region: 'South America', device: 'Android', basePing: 95 },
  { id: 'SIM_P114', region: 'South America', device: 'Console', basePing: 65 },
  { id: 'SIM_P115', region: 'South America', device: 'iOS', basePing: 78 }
];

let running = false;
let intervalId = null;
let intervalSeconds = 5;
let totalSimulated = 0;
let matchCounter = 500;

/**
 * Generate a single simulated telemetry record
 * @param {string} [forcedType] - 'normal' | 'review' | 'suspicious'
 * @returns {Object}
 */
const generateTelemetry = (forcedType = null) => {
  const player = SIM_PLAYERS[Math.floor(Math.random() * SIM_PLAYERS.length)];
  const matchId = `SIM_M${++matchCounter}`;
  
  // Latency with small jitter
  const ping = Math.max(5, player.basePing + Math.floor(Math.random() * 15) - 7);
  
  // Decide type
  let type = forcedType;
  if (!type) {
    const roll = Math.random();
    if (roll < 0.75) {
      type = 'normal';
    } else if (roll < 0.90) {
      type = 'review';
    } else {
      type = 'suspicious';
    }
  }

  let score, kills, deaths, match_duration_seconds;

  switch (type) {
    case 'review':
      // Trigger exactly 2 anomaly rules (Risk 2 - Review status)
      // Rule 1: Score per minute > 5000
      // Rule 2: Kills per minute > 100
      match_duration_seconds = 300; // 5 minutes
      score = 26000; // SPM = 26000 / 5 = 5200 (> 5000) -> Rule 1
      kills = 510;  // KPM = 510 / 5 = 102 (> 100) -> Rule 2
      deaths = 4;   // (> 0, does not trigger Rule 3)
      break;

    case 'suspicious':
      // Trigger 3+ anomaly rules (Risk 3+ - Suspicious status)
      // Rule 1: Score per minute > 5000
      // Rule 2: Kills per minute > 100
      // Rule 3: Kills >= 100 and deaths = 0
      // Rule 4: Match duration < 120 sec and score > 50000
      const subRoll = Math.random();
      if (subRoll < 0.5) {
        // God-mode/Aimbot trigger
        match_duration_seconds = 400; // 6.6 minutes
        score = 40000; // SPM = 6000 (> 5000) -> Rule 1
        kills = 700;   // KPM = 105 (> 100) -> Rule 2
        deaths = 0;    // (deaths = 0 and kills >= 100) -> Rule 3
      } else {
        // Instant high-score and speed trigger
        match_duration_seconds = 90; // 1.5 minutes (< 120s)
        score = 65000; // Score > 50000 -> Rule 4 (SPM = 43333 > 5000 -> Rule 1)
        kills = 180;   // KPM = 120 (> 100) -> Rule 2
        deaths = 0;    // (deaths = 0 and kills >= 100) -> Rule 3
      }
      break;

    case 'normal':
    default:
      // Valid score (Normal status)
      match_duration_seconds = Math.floor(Math.random() * 300) + 300; // 5 to 10 minutes
      score = Math.floor(Math.random() * 4500) + 500; // 500 to 5000
      kills = Math.floor(Math.random() * 15);
      deaths = Math.floor(Math.random() * 12) + 1; // At least 1 death to stay normal
      break;
  }

  return {
    player_id: player.id,
    match_id: matchId,
    region: player.region,
    device: player.device,
    ping,
    score,
    kills,
    deaths,
    match_duration_seconds
  };
};

/**
 * Perform a single simulation step
 */
const simulateStep = async () => {
  try {
    const record = generateTelemetry();
    await scoreService.saveScore(record);
    totalSimulated++;
    logger.info(`[Simulator] Injected record for ${record.player_id} (${record.score} pts, match: ${record.match_id})`);
  } catch (error) {
    logger.error('[Simulator] Error in simulation loop step:', error);
  }
};

/**
 * Start the simulation loop
 * @param {number} seconds - Tick rate
 */
const start = (seconds = 5) => {
  if (running) {
    stop();
  }
  
  intervalSeconds = seconds;
  running = true;
  intervalId = setInterval(simulateStep, intervalSeconds * 1000);
  logger.info(`[Simulator] Live match simulation started (tick rate: ${intervalSeconds}s)`);
};

/**
 * Stop the simulation loop
 */
const stop = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
  logger.info('[Simulator] Live match simulation stopped');
};

/**
 * Trigger a single simulated match score submission immediately
 * @param {string} type - 'normal' | 'review' | 'suspicious'
 * @returns {Promise<Object>} The generated record
 */
const trigger = async (type) => {
  const record = generateTelemetry(type);
  await scoreService.saveScore(record);
  totalSimulated++;
  logger.info(`[Simulator] Manually injected ${type} record for ${record.player_id}`);
  return record;
};

/**
 * Clear all simulated records (player_id starts with 'SIM_') from local JSON file
 */
const reset = async () => {
  const filePath = getFilePath();
  const scores = await fileLock.readJson(filePath);
  
  // Filter out any records that belong to simulated players
  const cleanScores = scores.filter(s => !s.player_id.startsWith('SIM_'));
  
  await fileLock.writeJson(filePath, cleanScores);
  totalSimulated = 0;
  logger.info('[Simulator] All simulated match scores wiped from database');
};

/**
 * Return current runner status
 */
const status = () => {
  return {
    running,
    intervalSeconds,
    totalSimulated
  };
};

module.exports = {
  start,
  stop,
  trigger,
  reset,
  status
};

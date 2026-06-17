/**
 * Evaluates a player record against game anomaly detection rules.
 * 
 * Rules:
 * 1. Score per minute > 5000
 * 2. Kills per minute > 100
 * 3. Kills >= 100 and deaths = 0
 * 4. Match duration < 120 sec and score > 50000
 * 
 * Risk Scoring:
 * - 0 to 1 points: Normal
 * - 2 points: Review
 * - 3+ points: Suspicious
 */

/**
 * Calculates the risk score, risk status, and violated rules for a given player record.
 * @param {Object} player - The player match record.
 * @returns {Object} { riskScore, status, violatedRules }
 */
const evaluatePlayerRisk = (player) => {
  const { score, kills, deaths, match_duration_seconds } = player;
  
  let riskScore = 0;
  const violatedRules = [];

  // Edge case: Handle match duration of 0 or less to prevent division by zero
  const durationMinutes = match_duration_seconds > 0 ? match_duration_seconds / 60 : 0.001;

  // Rule 1: Score per minute > 5000
  const scorePerMinute = score / durationMinutes;
  if (scorePerMinute > 5000) {
    riskScore += 1;
    violatedRules.push({
      rule: 'SCORE_PER_MINUTE_EXCEEDED',
      description: `Score per minute (${scorePerMinute.toFixed(2)}) exceeded the threshold of 5000.`,
    });
  }

  // Rule 2: Kills per minute > 100
  const killsPerMinute = kills / durationMinutes;
  if (killsPerMinute > 100) {
    riskScore += 1;
    violatedRules.push({
      rule: 'KILLS_PER_MINUTE_EXCEEDED',
      description: `Kills per minute (${killsPerMinute.toFixed(2)}) exceeded the threshold of 100.`,
    });
  }

  // Rule 3: Kills >= 100 and deaths = 0
  if (kills >= 100 && deaths === 0) {
    riskScore += 1;
    violatedRules.push({
      rule: 'ZERO_DEATHS_HIGH_KILLS',
      description: `Player achieved ${kills} kills with 0 deaths (potential god mode/aimbot).`,
    });
  }

  // Rule 4: Match duration < 120 sec and score > 50000
  if (match_duration_seconds < 120 && score > 50000) {
    riskScore += 1;
    violatedRules.push({
      rule: 'INSTANT_HIGH_SCORE',
      description: `Player scored ${score} in a very short match (${match_duration_seconds} seconds).`,
    });
  }

  // Determine risk status
  let status = 'Normal';
  if (riskScore >= 3) {
    status = 'Suspicious';
  } else if (riskScore === 2) {
    status = 'Review';
  }

  return {
    riskScore,
    status,
    violatedRules,
  };
};

module.exports = {
  evaluatePlayerRisk,
};

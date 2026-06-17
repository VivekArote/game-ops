/**
 * Utility for matchmaking grouping.
 * 
 * Skill Tiers:
 * - Beginner: 0–5000
 * - Intermediate: 5001–10000
 * - Advanced: 10001+
 * 
 * Ping Buckets:
 * - Low: <60
 * - Medium: 60–120
 * - High: >120
 */

/**
 * Returns the Skill Tier label based on player score.
 * @param {number} score 
 * @returns {string} 'Beginner' | 'Intermediate' | 'Advanced'
 */
const getSkillTier = (score) => {
  if (score <= 5000) return 'Beginner';
  if (score <= 10000) return 'Intermediate';
  return 'Advanced';
};

/**
 * Returns the Ping Bucket label based on player ping.
 * @param {number} ping 
 * @returns {string} 'Low' | 'Medium' | 'High'
 */
const getPingBucket = (ping) => {
  if (ping < 60) return 'Low';
  if (ping <= 120) return 'Medium';
  return 'High';
};

/**
 * Groups players into matchmaking pools based on region, skill tier, and ping bucket.
 * Excludes suspicious players (risk score >= 3) to protect lobby integrity.
 * 
 * @param {Array} players - List of player match records
 * @param {Function} evaluateRisk - Function to evaluate player risk
 * @returns {Array} List of grouped matchmaking pools
 */
const groupPlayersForMatchmaking = (players, evaluateRisk) => {
  const pools = {};

  for (const player of players) {
    // Evaluate risk and exclude suspicious players from standard matchmaking
    const risk = evaluateRisk(player);
    if (risk.riskScore >= 3) {
      continue; // Skip suspicious players
    }

    const skillTier = getSkillTier(player.score);
    const pingBucket = getPingBucket(player.ping);
    const region = player.region;

    // Use region, skill tier, and ping bucket as grouping keys
    const poolKey = `${region}::${skillTier}::${pingBucket}`;

    if (!pools[poolKey]) {
      pools[poolKey] = {
        region,
        skill_tier: skillTier,
        ping_bucket: pingBucket,
        player_count: 0,
        players: [],
      };
    }

    pools[poolKey].players.push({
      player_id: player.player_id,
      match_id: player.match_id,
      score: player.score,
      ping: player.ping,
      device: player.device,
      risk_status: risk.status,
    });
    pools[poolKey].player_count += 1;
  }

  // Convert map to flat array list
  return Object.values(pools);
};

module.exports = {
  getSkillTier,
  getPingBucket,
  groupPlayersForMatchmaking,
};

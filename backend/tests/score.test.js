const request = require('supertest');
const fs = require('fs').promises;
const path = require('path');
const app = require('../app');

const TEST_FILE_PATH = path.resolve(__dirname, '../data/test_scores.json');

// Force the app to use the test database
process.env.DATA_FILE_PATH = './data/test_scores.json';

const initialTestData = [
  {
    "player_id": "P001",
    "match_id": "M001",
    "region": "India",
    "device": "Android",
    "ping": 45,
    "score": 3000,
    "kills": 10,
    "deaths": 4,
    "match_duration_seconds": 400,
    "submitted_at": "2026-06-16T10:00:00.000Z"
  },
  {
    "player_id": "P002",
    "match_id": "M002",
    "region": "India",
    "device": "iOS",
    "ping": 80,
    "score": 4500,
    "kills": 22,
    "deaths": 3,
    "match_duration_seconds": 420,
    "submitted_at": "2026-06-16T10:05:00.000Z"
  },
  {
    "player_id": "P003",
    "match_id": "M003",
    "region": "India",
    "device": "Android",
    "ping": 50,
    "score": 3000,
    "kills": 15,
    "deaths": 2,
    "match_duration_seconds": 400,
    "submitted_at": "2026-06-16T10:10:00.000Z"
  },
  {
    "player_id": "P004",
    "match_id": "M004",
    "region": "India",
    "device": "Android",
    "ping": 35,
    "score": 3000,
    "kills": 20,
    "deaths": 2,
    "match_duration_seconds": 400,
    "submitted_at": "2026-06-16T10:15:00.000Z"
  },
  // Suspicious player: Score/min = 60000 / 1.66 = 36000 (>5000), Kills=120/Deaths=0, match duration < 120 and score > 50000. Risk score = 3
  {
    "player_id": "P008",
    "match_id": "M008",
    "region": "USA",
    "device": "PC",
    "ping": 150,
    "score": 60000,
    "kills": 120,
    "deaths": 0,
    "match_duration_seconds": 100,
    "submitted_at": "2026-06-16T10:35:00.000Z"
  },
  // Under Review player: Score/min = 6000 (>5000), duration = 100 < 120 and score = 60000 > 50000. Risk score = 2
  {
    "player_id": "P007",
    "match_id": "M007",
    "region": "India",
    "device": "Android",
    "ping": 40,
    "score": 60000,
    "kills": 2,
    "deaths": 1,
    "match_duration_seconds": 100,
    "submitted_at": "2026-06-16T10:30:00.000Z"
  }
];

beforeEach(async () => {
  // Ensure data folder exists
  await fs.mkdir(path.dirname(TEST_FILE_PATH), { recursive: true });
  // Write fresh initial test data
  await fs.writeFile(TEST_FILE_PATH, JSON.stringify(initialTestData, null, 2), 'utf8');
});

afterAll(async () => {
  // Clean up test file if it exists
  try {
    await fs.unlink(TEST_FILE_PATH);
  } catch (error) {
    // Ignore error if file doesn't exist
  }
});

describe('Game Ops System APIs', () => {

  describe('POST /api/scores', () => {
    it('should successfully submit a valid score and return 201', async () => {
      const payload = {
        player_id: "P099",
        match_id: "M099",
        region: "USA",
        device: "PC",
        ping: 30,
        score: 5500,
        kills: 18,
        deaths: 2,
        match_duration_seconds: 400
      };

      const response = await request(app)
        .post('/api/scores')
        .send(payload)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.player_id).toBe('P099');
      expect(response.body.data.match_id).toBe('M099');
      
      // Verify in file that it was appended
      const fileData = await fs.readFile(TEST_FILE_PATH, 'utf8');
      const parsed = JSON.parse(fileData);
      expect(parsed.length).toBe(initialTestData.length + 1);
      expect(parsed[parsed.length - 1].player_id).toBe('P099');
    });

    it('should fail with 400 when missing required fields', async () => {
      const incompletePayload = {
        player_id: "P099",
        score: 5500
      };

      const response = await request(app)
        .post('/api/scores')
        .send(incompletePayload)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toBe('Validation error');
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should fail with 400 when fields have invalid values', async () => {
      const invalidPayload = {
        player_id: "P099",
        match_id: "M099",
        region: "USA",
        device: "PC",
        ping: -10, // Invalid: cannot be negative
        score: 5500,
        kills: 18,
        deaths: 2,
        match_duration_seconds: 0 // Invalid: must be positive
      };

      const response = await request(app)
        .post('/api/scores')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toContain('ping cannot be negative');
      expect(response.body.errors).toContain('match_duration_seconds must be greater than 0');
    });
  });

  describe('GET /api/leaderboard', () => {
    it('should exclude suspicious players and rank players correctly', async () => {
      const response = await request(app)
        .get('/api/leaderboard')
        .expect(200);

      expect(response.body.status).toBe('success');
      const leaderboard = response.body.data;

      // Suspicious player P008 (risk score = 3) should be EXCLUDED
      const suspiciousInLeaderboard = leaderboard.find(p => p.player_id === 'P008');
      expect(suspiciousInLeaderboard).toBeUndefined();

      // Review player P007 (risk score = 2) should be INCLUDED
      const reviewInLeaderboard = leaderboard.find(p => p.player_id === 'P007');
      expect(reviewInLeaderboard).toBeDefined();

      // Verify rank numbers are correct
      leaderboard.forEach((player, i) => {
        expect(player.rank).toBe(i + 1);
      });

      // Verify tie breaking rules for P001, P003, and P004 (all score 3000):
      // Rank rules: 1. Higher score, 2. Fewer deaths, 3. Higher kills
      // P007 score=60000 -> Rank 1
      // P002 score=4500 -> Rank 2
      // P004 score=3000, deaths=2, kills=20 -> Rank 3
      // P003 score=3000, deaths=2, kills=15 -> Rank 4
      // P001 score=3000, deaths=4, kills=10 -> Rank 5
      expect(leaderboard[0].player_id).toBe('P007');
      expect(leaderboard[1].player_id).toBe('P002');
      expect(leaderboard[2].player_id).toBe('P004'); // fewer deaths (2) & more kills (20) than P003 (15)
      expect(leaderboard[3].player_id).toBe('P003'); // fewer deaths (2) than P001 (4)
      expect(leaderboard[4].player_id).toBe('P001');
    });
  });

  describe('GET /api/leaderboard/:region', () => {
    it('should filter leaderboard by region case-insensitively', async () => {
      const response = await request(app)
        .get('/api/leaderboard/india')
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.region).toBe('india');
      
      const leaderboard = response.body.data;
      leaderboard.forEach(player => {
        expect(player.region.toLowerCase()).toBe('india');
      });
    });
  });

  describe('GET /api/flagged-players', () => {
    it('should return players with risk score >= 2 with anomaly details', async () => {
      const response = await request(app)
        .get('/api/flagged-players')
        .expect(200);

      expect(response.body.status).toBe('success');
      const flagged = response.body.data;

      // P008 (Suspicious, risk 3) and P007 (Review, risk 2) should be present
      expect(flagged.length).toBe(2);
      
      const p008 = flagged.find(p => p.player_id === 'P008');
      expect(p008).toBeDefined();
      expect(p008.anomaly_details.riskScore).toBe(3);
      expect(p008.anomaly_details.status).toBe('Suspicious');
      expect(p008.anomaly_details.violatedRules.length).toBe(3);

      const p007 = flagged.find(p => p.player_id === 'P007');
      expect(p007).toBeDefined();
      expect(p007.anomaly_details.riskScore).toBe(2);
      expect(p007.anomaly_details.status).toBe('Review');
    });
  });

  describe('GET /api/matchmaking', () => {
    it('should group players by region, skill tier, and ping bucket, excluding suspicious', async () => {
      const response = await request(app)
        .get('/api/matchmaking')
        .expect(200);

      expect(response.body.status).toBe('success');
      const pools = response.body.data;

      // Check that P008 (Suspicious) is excluded
      const allMatchedPlayers = pools.reduce((acc, pool) => {
        return acc.concat(pool.players.map(p => p.player_id));
      }, []);
      expect(allMatchedPlayers).not.toContain('P008');

      // Check that P002 is grouped under: region=India, skill_tier=Beginner (score 4500), ping_bucket=Medium (ping 80)
      const p002Pool = pools.find(pool => 
        pool.region === 'India' && 
        pool.skill_tier === 'Beginner' && 
        pool.ping_bucket === 'Medium'
      );
      expect(p002Pool).toBeDefined();
      expect(p002Pool.players.some(p => p.player_id === 'P002')).toBe(true);

      // Check that P007 (Review) is included in matchmaking (region=India, skill_tier=Advanced (score 60000), ping_bucket=Low (ping 40))
      const p007Pool = pools.find(pool =>
        pool.region === 'India' &&
        pool.skill_tier === 'Advanced' &&
        pool.ping_bucket === 'Low'
      );
      expect(p007Pool).toBeDefined();
      expect(p007Pool.players.some(p => p.player_id === 'P007')).toBe(true);
    });
  });
});

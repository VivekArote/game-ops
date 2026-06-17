/* ==========================================================================
   GameOps Frontend Logic - Client-Side App Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- App State Cache ---
  const state = {
    leaderboard: [],
    flagged: [],
    matchmaking: [],
    currentTab: 'dashboard',
    recentSubmissions: [],
    simulation: {
      running: false,
      intervalSeconds: 5,
      totalSimulated: 0
    }
  };

  // --- API Endpoint Routes ---
  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : '';

  const API_ROUTES = {
    scores: `${API_BASE}/api/scores`,
    leaderboard: `${API_BASE}/api/leaderboard`,
    flagged: `${API_BASE}/api/flagged-players`,
    matchmaking: `${API_BASE}/api/matchmaking`,
    simStatus: `${API_BASE}/api/simulation/status`,
    simStart: `${API_BASE}/api/simulation/start`,
    simStop: `${API_BASE}/api/simulation/stop`,
    simTrigger: `${API_BASE}/api/simulation/trigger`,
    simReset: `${API_BASE}/api/simulation/reset`
  };

  // --- Element Selection ---
  const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    tabViews: document.querySelectorAll('.tab-view'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    refreshBtn: document.getElementById('refresh-btn'),
    openIngestBtn: document.getElementById('open-ingest-btn'),
    
    // Toast
    toastContainer: document.getElementById('toast-container'),

    // Dashboard Stats
    statTotalPlayers: document.getElementById('stat-total-players'),
    statTotalMatches: document.getElementById('stat-total-matches'),
    statAvgPing: document.getElementById('stat-avg-ping'),
    statFlaggedCount: document.getElementById('stat-flagged-count'),
    pingStatusText: document.getElementById('ping-status-text'),
    flaggedRateText: document.getElementById('flagged-rate-text'),
    flaggedBadge: document.getElementById('flagged-badge'),
    quickLeaderboardBody: document.getElementById('quick-leaderboard-body'),
    recentIngestionsFeed: document.getElementById('recent-ingestions-feed'),

    // Full Leaderboard View
    leaderboardSearch: document.getElementById('leaderboard-search'),
    leaderboardRegionFilter: document.getElementById('leaderboard-region-filter'),
    fullLeaderboardBody: document.getElementById('full-leaderboard-body'),

    // Flagged View
    flaggedCardsContainer: document.getElementById('flagged-cards-container'),
    flaggedResultsCount: document.getElementById('flagged-results-count'),

    // Matchmaker View
    matchmakingPoolsContainer: document.getElementById('matchmaking-pools-container'),
    matchmakingPoolsCount: document.getElementById('matchmaking-pools-count'),

    // Modal Ingest Form
    ingestModal: document.getElementById('ingest-modal'),
    ingestForm: document.getElementById('ingest-form'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    cancelModalBtn: document.getElementById('cancel-modal-btn'),
    formErrorSummary: document.getElementById('form-error-summary'),

    // Simulation Engine Controls
    simActiveBadge: document.getElementById('simulation-active-badge'),
    simStatusDot: document.getElementById('sim-status-dot'),
    simStatusText: document.getElementById('sim-status-text'),
    simToggleCheckbox: document.getElementById('sim-toggle-checkbox'),
    simPowerTitle: document.getElementById('sim-power-title'),
    simSpeedSlider: document.getElementById('sim-speed-slider'),
    simSpeedVal: document.getElementById('sim-speed-val'),
    btnInjectNormal: document.getElementById('btn-inject-normal'),
    btnInjectReview: document.getElementById('btn-inject-review'),
    btnInjectSuspicious: document.getElementById('btn-inject-suspicious'),
    btnSimReset: document.getElementById('btn-sim-reset'),
    btnClearSimLogs: document.getElementById('btn-clear-sim-logs'),
    simTerminal: document.getElementById('sim-terminal')
  };

  // --- Titles map for views ---
  const VIEW_META = {
    dashboard: {
      title: 'Dashboard Overview',
      subtitle: 'Ingest, analyze, and audit multiplayer match records.'
    },
    leaderboard: {
      title: 'Leaderboard Rankings',
      subtitle: 'Browse globally clean players sorted by score, deaths, and kills.'
    },
    flagged: {
      title: 'Security Audit & Compliance',
      subtitle: 'Review match metrics flagged for anomalous telemetry behaviors.'
    },
    matchmaker: {
      title: 'Matchmaking Queues',
      subtitle: 'Inspect regional pools grouped by skill tier and latency buckets.'
    },
    rules: {
      title: 'Rule reference book',
      subtitle: 'Overview of anomaly heuristics and action mitigation tiers.'
    },
    simulation: {
      title: 'Live Telemetry & Matchmaking Simulator',
      subtitle: 'Simulate concurrent player matches, latency spikes, and security threat vectors.'
    }
  };

  // --- Dynamic Polling Scheduler ---
  let pollingIntervalId = null;
  let currentPollingMs = 30000;

  function startPollingScheduler(ms) {
    if (pollingIntervalId && currentPollingMs === ms) {
      return; // already polling at this rate
    }
    
    if (pollingIntervalId) {
      clearInterval(pollingIntervalId);
    }
    
    currentPollingMs = ms;
    pollingIntervalId = setInterval(fetchAllData, ms);
  }

  // --- Initialize Application ---
  function init() {
    setupTabNavigation();
    setupEventListeners();
    fetchAllData();
    
    // Start with default 30 seconds polling
    startPollingScheduler(30000);
  }

  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'information-circle-outline';
    if (type === 'success') iconName = 'checkmark-circle-outline';
    if (type === 'error') iconName = 'alert-circle-outline';
    
    toast.innerHTML = `
      <ion-icon name="${iconName}"></ion-icon>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Smooth transition removal
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  }

  // --- Tab Navigation Setup ---
  function setupTabNavigation() {
    // Handle URL hash changes
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.substring(1);
      if (VIEW_META[hash]) {
        switchTab(hash);
      }
    });

    // Handle clicks directly on tab links
    elements.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = item.getAttribute('data-tab');
        window.location.hash = tabName;
      });
    });

    // Check initial hash
    const initialHash = window.location.hash.substring(1);
    if (VIEW_META[initialHash]) {
      switchTab(initialHash);
    }
  }

  function switchTab(tabName) {
    state.currentTab = tabName;

    // Toggle nav active classes
    elements.navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Toggle tab views
    elements.tabViews.forEach(view => {
      if (view.id === `view-${tabName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Header Text
    const meta = VIEW_META[tabName];
    if (meta) {
      elements.viewTitle.innerText = meta.title;
      elements.viewSubtitle.innerText = meta.subtitle;
    }

    // Refresh view specific components if needed
    if (tabName === 'leaderboard') {
      renderLeaderboard();
    } else if (tabName === 'flagged') {
      renderFlagged();
    } else if (tabName === 'matchmaker') {
      renderMatchmaking();
    }
  }

  // Window-scoped function for inline anchor clicks
  window.switchTab = switchTab;

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Refresh Button
    elements.refreshBtn.addEventListener('click', () => {
      elements.refreshBtn.querySelector('ion-icon').style.animation = 'spin 1s linear infinite';
      fetchAllData(() => {
        elements.refreshBtn.querySelector('ion-icon').style.animation = '';
        showToast('System data successfully reloaded', 'success');
      });
    });

    // Modal Triggers
    elements.openIngestBtn.addEventListener('click', () => {
      elements.ingestModal.classList.add('open');
      elements.formErrorSummary.classList.add('hidden');
      elements.formErrorSummary.innerHTML = '';
    });

    const closeModal = () => {
      elements.ingestModal.classList.remove('open');
      elements.ingestForm.reset();
    };

    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.cancelModalBtn.addEventListener('click', closeModal);
    
    // Close modal on background click
    elements.ingestModal.addEventListener('click', (e) => {
      if (e.target === elements.ingestModal) {
        closeModal();
      }
    });

    // Score submission form handler
    elements.ingestForm.addEventListener('submit', handleFormSubmit);

    // Live filtering in Leaderboard
    elements.leaderboardSearch.addEventListener('input', renderLeaderboard);
    elements.leaderboardRegionFilter.addEventListener('change', renderLeaderboard);

    // --- Simulator Engine Event Listeners ---
    if (elements.simToggleCheckbox) {
      elements.simToggleCheckbox.addEventListener('change', (e) => {
        const checked = e.target.checked;
        const speed = elements.simSpeedSlider.value;
        const endpoint = checked ? API_ROUTES.simStart : API_ROUTES.simStop;
        
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervalSeconds: speed })
        })
        .then(res => res.json())
        .then(res => {
          if (res.status === 'success') {
            updateSimulationUI(res.data);
            showToast(checked ? 'Simulation engine started' : 'Simulation engine stopped', 'success');
            appendSystemConsoleLine(`[SYSTEM] Simulation status changed: ${checked ? 'RUNNING' : 'STOPPED'} (Interval: ${speed}s)`);
          }
        })
        .catch(err => {
          console.error(err);
          showToast('Failed to toggle simulation', 'error');
          e.target.checked = !checked; // revert switch state
        });
      });
    }

    if (elements.simSpeedSlider) {
      elements.simSpeedSlider.addEventListener('input', (e) => {
        elements.simSpeedVal.innerText = `${e.target.value}s`;
      });
      
      elements.simSpeedSlider.addEventListener('change', (e) => {
        if (state.simulation.running) {
          fetch(API_ROUTES.simStart, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ intervalSeconds: e.target.value })
          })
          .then(res => res.json())
          .then(res => {
            if (res.status === 'success') {
              updateSimulationUI(res.data);
              showToast(`Simulation interval adjusted to ${e.target.value}s`, 'success');
              appendSystemConsoleLine(`[SYSTEM] Simulation interval updated to ${e.target.value} seconds.`);
            }
          });
        }
      });
    }

    const triggerInject = (type, label) => {
      fetch(API_ROUTES.simTrigger, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      .then(res => res.json())
      .then(res => {
        if (res.status === 'success') {
          showToast(`${label} injected successfully`, 'success');
          fetchAllData();
        }
      })
      .catch(err => {
        console.error(err);
        showToast(`Failed to inject ${label}`, 'error');
      });
    };

    if (elements.btnInjectNormal) {
      elements.btnInjectNormal.addEventListener('click', () => triggerInject('normal', 'Clean telemetry'));
    }
    if (elements.btnInjectReview) {
      elements.btnInjectReview.addEventListener('click', () => triggerInject('review', 'Review-tier telemetry'));
    }
    if (elements.btnInjectSuspicious) {
      elements.btnInjectSuspicious.addEventListener('click', () => triggerInject('suspicious', 'Suspicious telemetry'));
    }

    if (elements.btnSimReset) {
      elements.btnSimReset.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all simulated data? This will also stop the simulation.')) {
          fetch(API_ROUTES.simReset, { method: 'POST' })
          .then(res => res.json())
          .then(res => {
            if (res.status === 'success') {
              printedSimMatches.clear();
              elements.simTerminal.innerHTML = '';
              appendSystemConsoleLine('[SYSTEM] Simulation database reset. All SIM_* records wiped.');
              showToast('Simulation database reset complete', 'success');
              fetchAllData();
            }
          })
          .catch(err => {
            console.error(err);
            showToast('Failed to reset simulation database', 'error');
          });
        }
      });
    }

    if (elements.btnClearSimLogs) {
      elements.btnClearSimLogs.addEventListener('click', () => {
        elements.simTerminal.innerHTML = '';
        appendSystemConsoleLine('[SYSTEM] Console logs cleared.');
      });
    }
  }

  // --- Data Fetching ---
  function fetchAllData(callback = null) {
    Promise.all([
      fetch(API_ROUTES.leaderboard).then(res => res.json()),
      fetch(API_ROUTES.flagged).then(res => res.json()),
      fetch(API_ROUTES.matchmaking).then(res => res.json()),
      fetch(API_ROUTES.simStatus).then(res => res.json())
    ])
    .then(([leaderboardRes, flaggedRes, matchmakingRes, simStatusRes]) => {
      // API checks
      if (leaderboardRes.status === 'success') {
        state.leaderboard = leaderboardRes.data || [];
      }
      if (flaggedRes.status === 'success') {
        state.flagged = flaggedRes.data || [];
      }
      if (matchmakingRes.status === 'success') {
        state.matchmaking = matchmakingRes.data || [];
      }
      if (simStatusRes.status === 'success') {
        updateSimulationUI(simStatusRes.data);
      }

      // Update UI components
      updateDashboardStats();
      renderQuickLeaderboard();
      renderRecentFeed();
      renderLeaderboard();
      renderFlagged();
      renderMatchmaking();
      updateSimulationConsole();

      if (callback) callback();
    })
    .catch(error => {
      console.error('API Error:', error);
      showToast('Error syncing system data. Please check connection.', 'error');
      if (callback) callback();
    });
  }

  // --- Render Dashboard Overview Stats ---
  function updateDashboardStats() {
    // Total Clean Players
    const totalClean = state.leaderboard.length;
    // Total Suspicious Players
    const totalFlagged = state.flagged.length;
    // Total Matches Ingested (All records is sum of both flagged and clean since blacklisted matches are in flagged)
    // To get a more accurate count, let's count unique match_ids
    const uniqueMatches = new Set();
    const uniquePlayers = new Set();
    let totalPing = 0;
    let pingCount = 0;

    state.leaderboard.forEach(p => {
      if (p.match_id) uniqueMatches.add(p.match_id);
      if (p.player_id) uniquePlayers.add(p.player_id);
      if (typeof p.ping === 'number') {
        totalPing += p.ping;
        pingCount++;
      }
    });

    state.flagged.forEach(p => {
      if (p.match_id) uniqueMatches.add(p.match_id);
      if (p.player_id) uniquePlayers.add(p.player_id);
      if (typeof p.ping === 'number') {
        totalPing += p.ping;
        pingCount++;
      }
    });

    const avgPing = pingCount > 0 ? Math.round(totalPing / pingCount) : 0;
    const flaggedRatio = (totalClean + totalFlagged) > 0 
      ? ((totalFlagged / (totalClean + totalFlagged)) * 100).toFixed(1)
      : '0.0';

    // Set UI values
    elements.statTotalPlayers.innerText = uniquePlayers.size;
    elements.statTotalMatches.innerText = uniqueMatches.size;
    elements.statAvgPing.innerText = `${avgPing} ms`;
    elements.statFlaggedCount.innerText = totalFlagged;
    
    // Latency message
    if (avgPing < 60) {
      elements.pingStatusText.innerText = 'Excellent Response';
      elements.pingStatusText.className = 'stat-trend positive';
    } else if (avgPing <= 120) {
      elements.pingStatusText.innerText = 'Acceptable Latency';
      elements.pingStatusText.className = 'stat-trend neutral';
    } else {
      elements.pingStatusText.innerText = 'High Latency warnings';
      elements.pingStatusText.className = 'stat-trend negative';
    }

    // Flagged badge & texts
    elements.flaggedBadge.innerText = totalFlagged;
    elements.flaggedRateText.innerText = `${flaggedRatio}% Incident Rate`;
    
    if (totalFlagged === 0) {
      elements.flaggedRateText.className = 'stat-trend positive';
      elements.flaggedBadge.style.display = 'none';
    } else if (totalFlagged < 3) {
      elements.flaggedRateText.className = 'stat-trend neutral';
      elements.flaggedBadge.style.display = 'block';
      elements.flaggedBadge.className = 'badge badge-warning';
    } else {
      elements.flaggedRateText.className = 'stat-trend negative';
      elements.flaggedBadge.style.display = 'block';
      elements.flaggedBadge.className = 'badge badge-danger';
    }
  }

  // --- Render Dashboard Mini Leaderboard ---
  function renderQuickLeaderboard() {
    const quickList = state.leaderboard.slice(0, 5);
    let html = '';

    if (quickList.length === 0) {
      html = `<tr><td colspan="6" class="text-center text-muted">No clean matching telemetry found.</td></tr>`;
    } else {
      quickList.forEach((player) => {
        html += `
          <tr>
            <td><span class="rank-badge">${player.rank}</span></td>
            <td class="font-bold">${escapeHtml(player.player_id)}</td>
            <td>${escapeHtml(player.region)}</td>
            <td class="font-bold text-muted">${player.score.toLocaleString()}</td>
            <td>${player.kills}</td>
            <td>${player.deaths}</td>
          </tr>
        `;
      });
    }

    elements.quickLeaderboardBody.innerHTML = html;
  }

  // --- Render Recent Telemetry Feeds ---
  function renderRecentFeed() {
    let html = '';
    
    // Sort all records (clean + flagged) by ingestion time
    const allRecords = [];
    state.leaderboard.forEach(p => allRecords.push({ ...p, isFlagged: false }));
    state.flagged.forEach(p => allRecords.push({ ...p, isFlagged: true }));
    
    // Sort descending by submitted_at
    allRecords.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
    
    const recent = allRecords.slice(0, 6);
    
    if (recent.length === 0) {
      html = '<div class="text-center py-4 text-muted">No records ingested yet.</div>';
    } else {
      recent.forEach(item => {
        let iconHtml = '';
        let titleHtml = '';
        
        if (item.isFlagged) {
          const isSuspicious = item.anomaly_details.riskScore >= 3;
          iconHtml = `<div class="activity-icon" style="background: rgba(239, 68, 68, 0.15); color: #f87171;"><ion-icon name="shield-outline"></ion-icon></div>`;
          titleHtml = `<span class="font-bold">${escapeHtml(item.player_id)}</span> (Flagged <span class="text-muted" style="color: ${isSuspicious ? 'var(--color-danger)' : 'var(--color-warning)'}">${item.anomaly_details.status}</span>)`;
        } else {
          iconHtml = `<div class="activity-icon" style="background: rgba(16, 185, 129, 0.15); color: #34d399;"><ion-icon name="trophy-outline"></ion-icon></div>`;
          titleHtml = `<span class="font-bold">${escapeHtml(item.player_id)}</span> submitted match`;
        }
        
        const durationText = item.match_duration_seconds 
          ? `${Math.floor(item.match_duration_seconds / 60)}m ${item.match_duration_seconds % 60}s`
          : 'Unknown';
          
        html += `
          <div class="activity-item">
            ${iconHtml}
            <div class="activity-info">
              <div class="activity-title">${titleHtml}</div>
              <div class="activity-meta">${escapeHtml(item.region)} &bull; ${escapeHtml(item.device)} &bull; ${durationText}</div>
            </div>
            <div class="activity-score">${item.score.toLocaleString()}</div>
          </div>
        `;
      });
    }
    
    elements.recentIngestionsFeed.innerHTML = html;
  }

  // --- Render Full Interactive Leaderboards ---
  function renderLeaderboard() {
    const searchTerm = elements.leaderboardSearch.value.trim().toLowerCase();
    const regionFilter = elements.leaderboardRegionFilter.value;

    let filtered = state.leaderboard;

    // Filter by Region
    if (regionFilter !== 'all') {
      filtered = filtered.filter(p => p.region.toLowerCase() === regionFilter.toLowerCase());
    }

    // Filter by Player ID Search
    if (searchTerm) {
      filtered = filtered.filter(p => p.player_id.toLowerCase().includes(searchTerm));
    }

    let html = '';

    if (filtered.length === 0) {
      html = `<tr><td colspan="9" class="text-center py-4 text-muted">No matching clean players found.</td></tr>`;
    } else {
      filtered.forEach((player) => {
        const mins = (player.match_duration_seconds / 60).toFixed(1);
        
        // Check if there is review status
        let reviewBadge = '';
        if (player.risk_status === 'Review' || player.riskScore === 2) {
          reviewBadge = `<span class="pill pill-warning" style="margin-left: 8px;">Review</span>`;
        }

        html += `
          <tr>
            <td><span class="rank-badge">${player.rank}</span></td>
            <td><span class="font-bold">${escapeHtml(player.player_id)}</span>${reviewBadge}</td>
            <td>${escapeHtml(player.region)}</td>
            <td>${escapeHtml(player.device)}</td>
            <td>
              <span class="pill ${player.ping < 60 ? 'pill-success' : player.ping <= 120 ? 'pill-warning' : 'pill-danger'}">
                ${player.ping} ms
              </span>
            </td>
            <td class="font-bold">${player.score.toLocaleString()}</td>
            <td>${player.kills}</td>
            <td>${player.deaths}</td>
            <td>${mins} min</td>
          </tr>
        `;
      });
    }

    elements.fullLeaderboardBody.innerHTML = html;
  }

  // --- Render Security Auditing List (Flagged) ---
  function renderFlagged() {
    elements.flaggedResultsCount.innerText = `${state.flagged.length} Players Flagged`;
    
    let html = '';

    if (state.flagged.length === 0) {
      html = `
        <div class="col-span-2 text-center py-4 text-muted" style="grid-column: span 3;">
          <ion-icon name="checkmark-circle-outline" style="font-size: 48px; color: var(--color-success); margin-bottom: 12px;"></ion-icon>
          <p>Compliance checks complete. No players currently flagged for review.</p>
        </div>
      `;
    } else {
      state.flagged.forEach(player => {
        const details = player.anomaly_details || {};
        const risk = details.riskScore || 0;
        const status = details.status || 'Review';
        const rules = details.violatedRules || [];

        const isSuspicious = status === 'Suspicious';
        const statusClass = isSuspicious ? 'pill-danger' : 'pill-warning';

        let rulesHtml = '';
        rules.forEach(ruleItem => {
          rulesHtml += `<li><strong>${escapeHtml(ruleItem.rule)}</strong>: ${escapeHtml(ruleItem.description)}</li>`;
        });

        html += `
          <div class="flagged-card">
            <div class="flagged-card-header">
              <div class="flagged-card-title">
                <h4>Player ${escapeHtml(player.player_id)}</h4>
                <span>Match: ${escapeHtml(player.match_id)} &bull; ${escapeHtml(player.region)}</span>
              </div>
              <span class="pill ${statusClass}">${status} (Risk ${risk})</span>
            </div>
            <div class="flagged-metrics">
              <div class="flagged-metric-item">
                <span class="flagged-metric-label">Score</span>
                <span class="flagged-metric-value">${player.score.toLocaleString()}</span>
              </div>
              <div class="flagged-metric-item">
                <span class="flagged-metric-label">Kills/Deaths</span>
                <span class="flagged-metric-value">${player.kills} / ${player.deaths}</span>
              </div>
              <div class="flagged-metric-item">
                <span class="flagged-metric-label">Duration</span>
                <span class="flagged-metric-value">${player.match_duration_seconds}s</span>
              </div>
            </div>
            <div class="flagged-violations status-${status}">
              <h5><ion-icon name="bug-outline"></ion-icon> Rules Triggered (${rules.length})</h5>
              <ul>
                ${rulesHtml}
              </ul>
            </div>
          </div>
        `;
      });
    }

    elements.flaggedCardsContainer.innerHTML = html;
  }

  // --- Render Matchmaking Queue Pools ---
  function renderMatchmaking() {
    elements.matchmakingPoolsCount.innerText = `${state.matchmaking.length} Active Pools`;
    
    let html = '';

    if (state.matchmaking.length === 0) {
      html = `
        <div class="text-center py-4 text-muted" style="grid-column: span 3;">
          <ion-icon name="people-outline" style="font-size: 48px; color: var(--text-muted); margin-bottom: 12px;"></ion-icon>
          <p>No players currently waiting in matchmaking queues.</p>
        </div>
      `;
    } else {
      state.matchmaking.forEach(pool => {
        let playersHtml = '';
        const players = pool.players || [];

        players.forEach(p => {
          // Status badge
          let reviewTag = '';
          if (p.risk_status === 'Review') {
            reviewTag = ` <span style="color: var(--color-warning); font-size: 10px;">[REV]</span>`;
          }

          playersHtml += `
            <div class="pool-player-item">
              <span class="pool-player-id">${escapeHtml(p.player_id)}${reviewTag}</span>
              <span class="pool-player-stats">Sc: ${p.score.toLocaleString()} &bull; ${p.ping}ms</span>
            </div>
          `;
        });

        html += `
          <div class="match-pool-card">
            <div class="pool-header">
              <div class="pool-title">
                <h4>${escapeHtml(pool.region)}</h4>
                <p>${escapeHtml(pool.skill_tier)} Tier &bull; ${escapeHtml(pool.ping_bucket)} Ping</p>
              </div>
              <span class="pool-count">${pool.player_count}</span>
            </div>
            <div class="pool-body">
              <div class="pool-players-list">
                ${playersHtml}
              </div>
            </div>
          </div>
        `;
      });
    }

    elements.matchmakingPoolsContainer.innerHTML = html;
  }

  // --- Handle Ingestion Form Submission ---
  function handleFormSubmit(e) {
    e.preventDefault();

    // Reset error summary
    elements.formErrorSummary.classList.add('hidden');
    elements.formErrorSummary.innerHTML = '';

    // Collect values
    const payload = {
      player_id: document.getElementById('player_id').value.trim(),
      match_id: document.getElementById('match_id').value.trim(),
      region: document.getElementById('region').value,
      device: document.getElementById('device').value,
      ping: parseInt(document.getElementById('ping').value, 10),
      score: parseInt(document.getElementById('score').value, 10),
      kills: parseInt(document.getElementById('kills').value, 10),
      deaths: parseInt(document.getElementById('deaths').value, 10),
      match_duration_seconds: parseInt(document.getElementById('match_duration_seconds').value, 10)
    };

    // Client-side validations
    const errors = [];
    if (!payload.player_id) errors.push('Player ID is required');
    if (!payload.match_id) errors.push('Match ID is required');
    if (!payload.region) errors.push('Region is required');
    if (!payload.device) errors.push('Device is required');
    if (isNaN(payload.ping) || payload.ping < 0) errors.push('Ping must be 0 or higher');
    if (isNaN(payload.score) || payload.score < 0) errors.push('Score must be 0 or higher');
    if (isNaN(payload.kills) || payload.kills < 0) errors.push('Kills must be 0 or higher');
    if (isNaN(payload.deaths) || payload.deaths < 0) errors.push('Deaths must be 0 or higher');
    if (isNaN(payload.match_duration_seconds) || payload.match_duration_seconds <= 0) errors.push('Match Duration must be greater than 0');

    if (errors.length > 0) {
      renderFormErrors(errors);
      return;
    }

    // Submit telemetry
    fetch(API_ROUTES.scores, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(({ status, body }) => {
      if (status === 201 && body.status === 'success') {
        showToast(`Score for Player ${payload.player_id} saved successfully!`, 'success');
        
        // Hide modal & Reset form
        elements.ingestModal.classList.remove('open');
        elements.ingestForm.reset();

        // Trigger updates
        fetchAllData();
      } else {
        // Display validation/server errors
        const errorList = body.errors || [body.message || 'Telemetry submission failed.'];
        renderFormErrors(errorList);
        showToast('Submission failed Joi validations', 'error');
      }
    })
    .catch(err => {
      console.error(err);
      renderFormErrors(['Failed to establish backend server handshake.']);
      showToast('Network error during ingestion', 'error');
    });
  }

  // Helper to render form errors
  function renderFormErrors(errors) {
    let html = '<ul>';
    errors.forEach(e => {
      html += `<li>${escapeHtml(e)}</li>`;
    });
    html += '</ul>';
    
    elements.formErrorSummary.innerHTML = html;
    elements.formErrorSummary.classList.remove('hidden');
  }

  // --- General Helper Functions ---
  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Simulation Helper Functions ---
  const printedSimMatches = new Set();

  function updateSimulationUI(simData) {
    state.simulation = simData;
    const isRunning = simData.running;

    if (elements.simToggleCheckbox) {
      elements.simToggleCheckbox.checked = isRunning;
    }

    if (elements.simStatusDot) {
      elements.simStatusDot.className = isRunning ? 'status-pulse-dot running' : 'status-pulse-dot';
    }

    if (elements.simStatusText) {
      elements.simStatusText.innerText = isRunning ? 'Running' : 'Stopped';
      elements.simStatusText.className = isRunning ? 'status-label-text running' : 'status-label-text';
    }

    if (elements.simPowerTitle) {
      elements.simPowerTitle.innerText = isRunning ? 'Stop Simulator' : 'Start Simulator';
    }

    if (elements.simActiveBadge) {
      if (isRunning) {
        elements.simActiveBadge.classList.remove('hidden');
      } else {
        elements.simActiveBadge.classList.add('hidden');
      }
    }

    if (elements.simSpeedSlider) {
      elements.simSpeedSlider.value = simData.intervalSeconds;
    }
    if (elements.simSpeedVal) {
      elements.simSpeedVal.innerText = `${simData.intervalSeconds}s`;
    }

    // Adjust polling intervals based on simulation status
    if (isRunning) {
      startPollingScheduler(3000); // Poll every 3 seconds for active simulation updates
    } else {
      startPollingScheduler(30000); // Poll every 30 seconds for passive dashboard sync
    }
  }

  function updateSimulationConsole() {
    if (!elements.simTerminal) return;

    const allRecords = [];
    state.leaderboard.forEach(p => {
      if (p.player_id.startsWith('SIM_')) {
        allRecords.push({ ...p, isFlagged: false });
      }
    });
    state.flagged.forEach(p => {
      if (p.player_id.startsWith('SIM_')) {
        allRecords.push({ ...p, isFlagged: true });
      }
    });

    // Sort ascending by submitted_at to log chronologically
    allRecords.sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));

    allRecords.forEach(item => {
      const uniqueKey = `${item.player_id}::${item.match_id}::${item.submitted_at}`;
      if (!printedSimMatches.has(uniqueKey)) {
        printedSimMatches.add(uniqueKey);
        appendTerminalLine(item);
      }
    });
  }

  function appendTerminalLine(item) {
    const time = item.submitted_at ? new Date(item.submitted_at).toLocaleTimeString() : new Date().toLocaleTimeString();
    let lineClass = 'clean-line';
    let text = '';

    if (item.isFlagged) {
      const details = item.anomaly_details || {};
      const status = details.status || 'Review';
      const rules = details.violatedRules ? details.violatedRules.map(r => r.rule).join(', ') : 'Unknown Rule';

      if (status === 'Suspicious') {
        lineClass = 'suspicious-line';
        text = `[${time}] [BLACKLIST] Player ${item.player_id} banned from matchmaking in ${item.region}. Violations: ${rules}. Score: ${item.score.toLocaleString()}, K/D: ${item.kills}/${item.deaths} (Duration: ${item.match_duration_seconds}s, Ping: ${item.ping}ms)`;
      } else {
        lineClass = 'review-line';
        text = `[${time}] [REVIEW] Player ${item.player_id} flagged for review in ${item.region}. Violations: ${rules}. Score: ${item.score.toLocaleString()}, K/D: ${item.kills}/${item.deaths} (Duration: ${item.match_duration_seconds}s, Ping: ${item.ping}ms)`;
      }
    } else {
      if (item.risk_status === 'Review' || item.riskScore === 2) {
        lineClass = 'review-line';
        text = `[${time}] [REVIEW] Player ${item.player_id} flagged for review in ${item.region}. Score: ${item.score.toLocaleString()}, K/D: ${item.kills}/${item.deaths} (Duration: ${(item.match_duration_seconds/60).toFixed(1)}m, Ping: ${item.ping}ms)`;
      } else {
        lineClass = 'clean-line';
        text = `[${time}] [CLEAN] Player ${item.player_id} completed match ${item.match_id} in ${item.region}. Score: ${item.score.toLocaleString()}, K/D: ${item.kills}/${item.deaths} (Ping: ${item.ping}ms)`;
      }
    }

    const line = document.createElement('div');
    line.className = `terminal-line ${lineClass}`;
    line.innerText = text;

    elements.simTerminal.appendChild(line);
    elements.simTerminal.scrollTop = elements.simTerminal.scrollHeight;
  }

  function appendSystemConsoleLine(text) {
    if (!elements.simTerminal) return;
    const time = new Date().toLocaleTimeString();
    const line = document.createElement('div');
    line.className = 'terminal-line system-line';
    line.innerText = `[${time}] ${text}`;
    elements.simTerminal.appendChild(line);
    elements.simTerminal.scrollTop = elements.simTerminal.scrollHeight;
  }

  // Start app
  init();
});

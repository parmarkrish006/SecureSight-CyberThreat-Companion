/**
 * Anomaly Detection Page
 * Sends data to n8n webhook → Python API: Behavior Anomaly
 * Falls back to local analysis if webhook is unreachable
 */
import { analyzeAnomalyViaWebhook } from '../api/n8n-service.js';
import { readFileAsText, delay } from '../utils/helpers.js';

const SAMPLE_LOGS = `2026-03-16 14:06:00 user=admin@company.com action=login ip=51.5.10.1 location=London user-agent=Chrome/120
2026-03-16 14:20:00 user=admin@company.com action=login ip=103.21.58.1 location=Mumbai user-agent=Firefox/119
2026-03-16 14:25:00 user=admin@company.com action=download ip=103.21.58.1 location=Mumbai
2026-03-16 14:30:00 user=admin@company.com action=download ip=103.21.58.1 location=Mumbai
2026-03-16 14:35:00 user=admin@company.com action=download ip=103.21.58.1 location=Mumbai
2026-03-16 14:40:00 user=admin@company.com action=delete ip=103.21.58.1 location=Mumbai
2026-03-16 09:00:00 user=john@company.com action=login ip=192.168.1.100 location=New York
2026-03-16 09:30:00 user=john@company.com action=login ip=192.168.1.100 location=New York
2026-03-16 02:00:00 user=john@company.com action=login ip=45.33.12.5 location=Tokyo
2026-03-16 02:05:00 user=john@company.com action=admin_access ip=45.33.12.5 location=Tokyo
2026-03-16 10:00:00 user=sarah@company.com action=failed_login ip=185.220.101.1
2026-03-16 10:01:00 user=sarah@company.com action=failed_login ip=185.220.101.1
2026-03-16 10:01:30 user=sarah@company.com action=failed_login ip=185.220.101.1
2026-03-16 10:02:00 user=sarah@company.com action=failed_login ip=185.220.101.1
2026-03-16 10:02:30 user=sarah@company.com action=failed_login ip=185.220.101.1`;

export function renderAnomaly(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <div>
          <h1 style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="color: var(--accent-green);">📊</span> Anomaly Detection
          </h1>
          <p style="margin-top: var(--space-1);">User-Based Behavioral Anomaly Detection from Log Data</p>
        </div>
        <div class="live-indicator">
          <span class="status-dot online"></span>
          Engine Ready
        </div>
      </div>

      <div class="split-layout">
        <!-- Input Panel -->
        <div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Log Input</div>
              <button class="btn btn-outline" id="btn-load-sample" style="font-size: var(--text-xs); padding: var(--space-1) var(--space-3);">
                Load Sample Logs
              </button>
            </div>
            <textarea class="textarea" id="anomaly-input" rows="16"
              placeholder="Paste your log data here...

Supported formats:
• Timestamp + user + IP + location
• CSV with headers
• JSON log entries
• Syslog format

Example:
2026-03-16 14:06:00 user=admin@company.com action=login location=London
2026-03-16 14:20:00 user=admin@company.com action=login location=Mumbai"></textarea>

            <div style="display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-3);">
              <label class="btn btn-outline" id="btn-upload-log" style="cursor:pointer; flex: 1; text-align: center;">
                📁 Upload Log File
                <input type="file" id="log-file-input" accept=".log,.txt,.csv,.json" style="display:none;" />
              </label>
            </div>

            <button class="btn btn-primary btn-large mt-4" id="btn-analyze-anomaly">
              🔍 Analyze Logs
            </button>
          </div>
        </div>

        <!-- Results Panel -->
        <div id="anomaly-results">
          <div class="card empty-state">
            <div class="empty-state-icon">📊</div>
            <h3 style="margin-bottom: var(--space-2);">No Analysis Results Yet</h3>
            <p class="text-sm">Paste log data or upload a log file, then click "Analyze Logs" to detect anomalies.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Wire up events
  const input = container.querySelector('#anomaly-input');
  const resultsContainer = container.querySelector('#anomaly-results');
  const analyzeBtn = container.querySelector('#btn-analyze-anomaly');
  const sampleBtn = container.querySelector('#btn-load-sample');
  const fileInput = container.querySelector('#log-file-input');

  sampleBtn.addEventListener('click', () => {
    input.value = SAMPLE_LOGS;
    input.style.borderColor = 'var(--accent-green)';
    setTimeout(() => { input.style.borderColor = ''; }, 1000);
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await readFileAsText(file);
      input.value = text;
    }
  });

  analyzeBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      input.style.borderColor = 'var(--accent-red)';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      return;
    }

    // Show loading
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
    resultsContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: var(--space-12);">
        <div class="spinner" style="width:40px;height:40px;border-width:3px;margin: 0 auto var(--space-4);"></div>
        <h3>Analyzing Log Data...</h3>
        <p class="text-sm text-muted mt-4">Sending to n8n workflow → Python Behavior Anomaly API</p>
        <div class="progress-bar mt-4"><div class="progress-fill" id="anomaly-progress" style="width:0%"></div></div>
      </div>`;

    const progress = resultsContainer.querySelector('#anomaly-progress');
    for (let i = 0; i <= 40; i += 10) {
      await delay(150);
      progress.style.width = i + '%';
    }

    // Try n8n webhook first
    let result = null;
    let source = 'n8n';
    const webhookResponse = await analyzeAnomalyViaWebhook(text);

    if (webhookResponse.success && webhookResponse.data) {
      progress.style.width = '90%';
      await delay(200);
      // Use n8n response — normalize it to our result format if needed
      const data = webhookResponse.data;
      result = normalizeN8nAnomalyResult(data, text);
    }

    // If webhook failed
    if (!result || !result.success) {
      progress.style.width = '100%';
      await delay(200);
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🔍 Analyze Logs';
      resultsContainer.innerHTML = `
        <div class="card">
          <div style="color: var(--accent-orange); display: flex; align-items: center; gap: var(--space-2);">
            <span>⚠️</span> Analysis requires the n8n cloud pipeline. The webhook did not respond or returned invalid data.
          </div>
        </div>`;
      return;
    }

    progress.style.width = '100%';
    await delay(200);

    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '🔍 Analyze Logs';

    if (!result.success) {
      resultsContainer.innerHTML = `
        <div class="card">
          <div style="color: var(--accent-red); display: flex; align-items: center; gap: var(--space-2);">
            <span>❌</span> ${result.error}
          </div>
        </div>`;
      return;
    }

    renderAnomalyResults(resultsContainer, result, source);
  });
}

function renderAnomalyResults(container, result, source = 'local') {
  const riskColors = {
    critical: 'var(--accent-red)',
    high: 'var(--accent-orange)',
    medium: 'var(--accent-orange)',
    low: 'var(--accent-green)'
  };
  const riskColor = riskColors[result.riskLevel] || 'var(--accent-green)';
  const sourceBadge = source === 'n8n'
    ? '<span class="badge badge-safe" style="margin-left: var(--space-2);">⚡ n8n CLOUD</span>'
    : '<span class="badge badge-info" style="margin-left: var(--space-2);">🖥️ LOCAL FALLBACK</span>';

  let findingsHTML = '';
  result.findings.forEach(f => {
    const sevClass = f.severity === 'critical' ? 'badge-critical' : 'badge-warning';
    const icon = f.type === 'impossible_travel' ? '🌍' :
      f.type === 'frequency_anomaly' ? '📈' :
        f.type === 'brute_force' ? '🔓' :
          f.type === 'off_hours' ? '🌙' :
            f.type === 'agent_switching' ? '🔄' :
              f.type === 'privilege_escalation' ? '⚡' :
                f.type === 'data_exfiltration' ? '💾' : '⚠️';

    findingsHTML += `
      <div class="threat-item">
        <div class="threat-item-header">
          <span class="threat-item-title">${icon} ${formatType(f.type)}</span>
          <span class="badge ${sevClass}">${f.severity}</span>
        </div>
        <div class="threat-item-detail">${f.details}</div>
      </div>`;
  });

  container.innerHTML = `
    <div class="result-panel">
      <div class="result-header">
        <div>
          <div class="text-mono-label mb-2">ANALYSIS COMPLETE ${sourceBadge}</div>
          <div class="result-verdict" style="color: ${riskColor};">${result.riskLevel.toUpperCase()} RISK</div>
        </div>
        <div style="text-align: right;">
          <div class="text-mono-label mb-2">ANOMALY SCORE</div>
          <div class="result-score" style="color: ${riskColor};">${result.anomalyScore.toFixed(2)}</div>
        </div>
      </div>

      <div class="card-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: var(--space-6);">
        <div style="text-align: center; padding: var(--space-3);">
          <div class="text-mono-label text-xs">Entries Parsed</div>
          <div class="mono" style="font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin-top: var(--space-1);">${result.totalEntries}</div>
        </div>
        <div style="text-align: center; padding: var(--space-3);">
          <div class="text-mono-label text-xs">Users Found</div>
          <div class="mono" style="font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin-top: var(--space-1);">${result.users.length}</div>
        </div>
        <div style="text-align: center; padding: var(--space-3);">
          <div class="text-mono-label text-xs">Anomalies</div>
          <div class="mono" style="font-size: var(--text-xl); font-weight: 700; color: ${riskColor}; margin-top: var(--space-1);">${result.summary.totalAnomalies}</div>
        </div>
        <div style="text-align: center; padding: var(--space-3);">
          <div class="text-mono-label text-xs">Method</div>
          <div class="mono" style="font-size: var(--text-sm); font-weight: 600; color: var(--accent-green); margin-top: var(--space-2);">${result.method}</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6);">
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Impossible Travel</div>
          <div class="mono text-red" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.impossibleTravel}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Frequency Anomalies</div>
          <div class="mono text-orange" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.frequencyAnomalies}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Session Anomalies</div>
          <div class="mono text-orange" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.sessionAnomalies}</div>
        </div>
      </div>

      ${result.findings.length > 0 ? `
        <h3 style="margin-bottom: var(--space-4);">🔍 Detailed Findings</h3>
        ${findingsHTML}
      ` : '<p class="text-muted" style="text-align: center;">No anomalies detected in the provided logs.</p>'}
    </div>
  `;
}

function formatType(type) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Normalize n8n webhook response into our standard result format.
 * If n8n returns data in a different shape, map it here.
 */
function normalizeN8nAnomalyResult(data, originalText) {
  // If n8n already returns our expected format, use it directly
  if (data.anomalyScore !== undefined && data.findings) {
    return { success: true, ...data };
  }

  // Try to extract from common n8n response shapes
  try {
    // Handle array response (n8n sometimes wraps in array)
    const d = Array.isArray(data) ? data[0] : data;

    return {
      success: true,
      totalEntries: d.totalEntries || d.total_entries || 0,
      users: d.users || [],
      anomalyScore: d.anomalyScore || d.anomaly_score || d.score || 0,
      riskLevel: d.riskLevel || d.risk_level || d.risk || 'low',
      findings: (d.findings || d.anomalies || []).map(f => ({
        type: f.type || 'unknown',
        severity: f.severity || 'warning',
        details: f.details || f.description || f.message || JSON.stringify(f),
        user: f.user || '',
      })),
      travelFindings: d.travelFindings || [],
      frequencyFindings: d.frequencyFindings || [],
      sessionFindings: d.sessionFindings || [],
      method: d.method || 'Isolation Forest (n8n)',
      summary: d.summary || {
        impossibleTravel: (d.travelFindings || []).length,
        frequencyAnomalies: (d.frequencyFindings || []).length,
        sessionAnomalies: (d.sessionFindings || []).length,
        totalAnomalies: (d.findings || d.anomalies || []).length,
      }
    };
  } catch (e) {
    console.error('[n8n] Failed to normalize anomaly result:', e);
    return { success: false };
  }
}


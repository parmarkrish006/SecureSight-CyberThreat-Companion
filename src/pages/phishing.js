/**
 * Phishing Email Scanner Page
 * Sends data to n8n webhook → VirusTotal HTTP Request
 * Falls back to local analysis if webhook is unreachable
 */
import { analyzePhishingViaWebhook } from '../api/n8n-service.js';
import { delay } from '../utils/helpers.js';

const SAMPLE_EMAIL = `From: payroll@comp4ny-hr.com
Subject: URGENT: Q3 Payroll Update Required

Dear Employee,

We've detected an issue with your Q3 payroll information. Immediate action required to prevent payment delays.

Please verify your details by clicking the link below within 24 hours:

https://payrol-update.xyz/verify?id=EMP-29571

If you do not update your information immediately, your next payment will be suspended.

Best regards,
HR Department
Company Human Resources

This email was sent from an automated system. Do not reply directly.`;

export function renderPhishing(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <div>
          <h1 style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="color: var(--accent-orange);">✉️</span> Phishing Email Scanner
          </h1>
          <p style="margin-top: var(--space-1);">AI-Powered Email Threat Analysis</p>
        </div>
        <div class="live-indicator">
          <span class="status-dot online"></span>
          Scanner Ready
        </div>
      </div>

      <div class="split-layout">
        <!-- Input Panel -->
        <div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Email Content</div>
              <button class="btn btn-outline" id="btn-load-phish-sample" style="font-size: var(--text-xs); padding: var(--space-1) var(--space-3);">
                Load Sample Email
              </button>
            </div>
            <textarea class="textarea" id="phishing-input" rows="18"
              placeholder="Paste the email content here...

Include headers if available:
From: sender@example.com
Subject: Email Subject

Then the email body text...

The scanner will analyze:
• Sender domain for spoofing
• Urgency/pressure language
• Deceptive links and URLs
• Overall phishing indicators"></textarea>

            <button class="btn btn-primary btn-large mt-4" id="btn-analyze-phishing">
              🔍 Scan Email
            </button>
          </div>
        </div>

        <!-- Results Panel -->
        <div id="phishing-results">
          <div class="card empty-state">
            <div class="empty-state-icon">✉️</div>
            <h3 style="margin-bottom: var(--space-2);">No Email Scanned Yet</h3>
            <p class="text-sm">Paste email content (including headers if available) and click "Scan Email" to analyze for phishing indicators.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = container.querySelector('#phishing-input');
  const resultsContainer = container.querySelector('#phishing-results');
  const analyzeBtn = container.querySelector('#btn-analyze-phishing');
  const sampleBtn = container.querySelector('#btn-load-phish-sample');

  sampleBtn.addEventListener('click', () => {
    input.value = SAMPLE_EMAIL;
    input.style.borderColor = 'var(--accent-green)';
    setTimeout(() => { input.style.borderColor = ''; }, 1000);
  });

  analyzeBtn.addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) {
      input.style.borderColor = 'var(--accent-red)';
      setTimeout(() => { input.style.borderColor = ''; }, 2000);
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Scanning...';
    resultsContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: var(--space-12);">
        <div class="spinner" style="width:40px;height:40px;border-width:3px;margin: 0 auto var(--space-4);"></div>
        <h3>Scanning Email...</h3>
        <p class="text-sm text-muted mt-4">Sending to n8n workflow → VirusTotal API</p>
        <div class="progress-bar mt-4"><div class="progress-fill" id="ph-progress" style="width:0%"></div></div>
      </div>`;

    const progress = resultsContainer.querySelector('#ph-progress');
    for (let i = 0; i <= 40; i += 10) {
      await delay(150);
      progress.style.width = i + '%';
    }

    // Try n8n webhook first
    let result = null;
    let source = 'n8n';
    const webhookResponse = await analyzePhishingViaWebhook(text);

    if (webhookResponse.success && webhookResponse.data) {
      progress.style.width = '80%';
      await delay(200);
      const n8nData = Array.isArray(webhookResponse.data) ? webhookResponse.data[0] : webhookResponse.data;
      
      const urls = n8nData.urls ? n8nData.urls.map(u => typeof u === 'string' ? {full: u} : u) : [];
      let score = n8nData.score !== undefined ? n8nData.score : (n8nData.phishing_score !== undefined ? n8nData.phishing_score : 0);
      
      result = {
        success: true,
        parsed: { from: n8nData.from || '', subject: n8nData.subject || '', body: text, urls: urls },
        domainFindings: n8nData.domainFindings || [],
        urgencyFindings: n8nData.urgencyFindings || [],
        linkFindings: n8nData.linkFindings || [],
        summary: n8nData.summary || { domainIssues: 0, urgencyFlags: 0, linkIssues: 0 },
        findings: n8nData.findings || [],
        verdict: n8nData.verdict || n8nData.result || 'UNKNOWN',
        score: score,
        confidence: n8nData.confidence || score,
        severity: n8nData.severity || 'safe',
      };
      
      if (n8nData.score !== undefined || n8nData.phishing_score !== undefined) {
        if (score >= 0.65) { result.verdict = 'PHISHING DETECTED'; result.severity = 'critical'; }
        else if (score >= 0.35) { result.verdict = 'SUSPICIOUS'; result.severity = 'warning'; }
        else { result.verdict = 'SAFE'; result.severity = 'safe'; }
      }
    }

    // If webhook failed
    if (!result || !result.success) {
      progress.style.width = '100%';
      await delay(200);
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🔍 Scan Email';
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
    analyzeBtn.innerHTML = '🔍 Scan Email';

    if (!result.success) {
      resultsContainer.innerHTML = `
        <div class="card">
          <div style="color: var(--accent-red); display: flex; align-items: center; gap: var(--space-2);">
            <span>❌</span> ${result.error}
          </div>
        </div>`;
      return;
    }

    renderPhishingResults(resultsContainer, result, source);
  });
}

function renderPhishingResults(container, result, source = 'local') {
  const sevColors = {
    critical: 'var(--accent-red)',
    warning: 'var(--accent-orange)',
    safe: 'var(--accent-green)'
  };
  const color = sevColors[result.severity];
  const sevClass = result.severity === 'critical' ? 'badge-critical' : result.severity === 'warning' ? 'badge-warning' : 'badge-safe';
  const sourceBadge = source === 'n8n'
    ? '<span class="badge badge-safe" style="margin-left: var(--space-2);">⚡ n8n CLOUD</span>'
    : '<span class="badge badge-info" style="margin-left: var(--space-2);">🖥️ LOCAL FALLBACK</span>';

  // Render parsed email preview
  let emailPreview = '';
  if (result.parsed.from || result.parsed.subject) {
    emailPreview = `
      <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-6); font-size: var(--text-sm);">
        ${result.parsed.from ? `
          <div style="margin-bottom: var(--space-2);">
            <span class="text-muted mono text-xs">FROM:</span>
            <span class="mono" style="margin-left: var(--space-2);">${escapeHtml(result.parsed.from)}</span>
            ${result.domainFindings.length > 0 ? '<span class="badge badge-spoofed" style="margin-left: var(--space-2);">SPOOFED</span>' : ''}
          </div>` : ''}
        ${result.parsed.subject ? `
          <div style="margin-bottom: var(--space-3);">
            <span class="text-muted mono text-xs">SUBJECT:</span>
            <span class="mono" style="margin-left: var(--space-2);">${escapeHtml(result.parsed.subject)}</span>
          </div>` : ''}
        <div style="color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.8; max-height: 150px; overflow-y: auto;">
          ${highlightThreats(result.parsed.body, result)}
        </div>
      </div>`;
  }

  // Render findings
  let findingsHTML = '';

  // Domain findings
  result.domainFindings.forEach(f => {
    findingsHTML += renderFinding('🌐', 'Domain Spoofing', f);
  });

  // Urgency findings
  result.urgencyFindings.forEach(f => {
    findingsHTML += renderFinding('⚡', f.label, f);
  });

  // Link findings
  result.linkFindings.forEach(f => {
    findingsHTML += renderFinding('🔗', 'Deceptive Link', f);
  });

  container.innerHTML = `
    <div class="result-panel">
      <div class="result-header">
        <div>
          <div class="text-mono-label mb-2">SCAN VERDICT ${sourceBadge}</div>
          <div class="result-verdict" style="color: ${color};">${result.verdict}</div>
          <span class="badge ${sevClass}" style="margin-top: var(--space-2);">${result.severity.toUpperCase()}</span>
        </div>
        <div style="text-align: right;">
          <div class="text-mono-label mb-2">PHISHING SCORE</div>
          <div class="result-score" style="color: ${color};">${(result.score * 100).toFixed(1)}%</div>
        </div>
      </div>

      ${emailPreview}

      <!-- Summary Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-6);">
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Domain Issues</div>
          <div class="mono text-red" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.domainIssues}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Urgency Flags</div>
          <div class="mono text-orange" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.urgencyFlags}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Link Issues</div>
          <div class="mono text-red" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${result.summary.linkIssues}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Confidence</div>
          <div class="mono text-green" style="font-size: var(--text-lg); font-weight: 700; margin-top: var(--space-1);">${(result.confidence * 100).toFixed(1)}%</div>
        </div>
      </div>

      ${result.findings.length > 0 ? `
        <h3 style="margin-bottom: var(--space-4);">🔍 Threat Findings</h3>
        ${findingsHTML}
      ` : '<p class="text-muted" style="text-align: center; padding: var(--space-6);">No phishing indicators detected. This email appears safe.</p>'}
    </div>
  `;
}

function renderFinding(icon, title, finding) {
  const sevClass = finding.severity === 'critical' ? 'badge-critical' : 'badge-warning';
  return `
    <div class="threat-item">
      <div class="threat-item-header">
        <span class="threat-item-title">${icon} ${title}</span>
        <span class="badge ${sevClass}">${finding.severity}</span>
      </div>
      <div class="threat-item-detail">${escapeHtml(finding.details)}</div>
    </div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightThreats(bodyText, result) {
  let html = escapeHtml(bodyText);

  // Highlight urgency matches
  result.urgencyFindings.forEach(f => {
    if (f.matches) {
      f.matches.forEach(match => {
        const escaped = escapeHtml(match);
        html = html.replace(escaped, `<span class="highlight-urgent">${escaped}</span>`);
      });
    }
  });

  // Highlight URLs
  result.parsed.urls.forEach(url => {
    const escaped = escapeHtml(url.full);
    const hasIssue = result.linkFindings.some(lf => lf.url === url.full);
    if (hasIssue) {
      html = html.replace(escaped, `<span class="highlight-link">${escaped}</span>`);
    }
  });

  return html.replace(/\n/g, '<br>');
}

/**
 * Dashboard Page
 */
import { navigate } from '../router.js';
import { formatDate } from '../utils/helpers.js';

export function renderDashboard(container) {
  const now = formatDate(new Date());

  container.innerHTML = `
    <div class="page">
      <!-- System Health + Upload Section -->
      <div class="split-layout" style="margin-bottom: var(--space-8);">
        <!-- System Health -->
        <div class="card">
          <div class="text-mono-label mb-2">SYSTEM HEALTH</div>
          <div style="display: flex; align-items: center; gap: var(--space-4); margin-top: var(--space-4);">
            <div class="health-ring" id="health-ring">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--border-primary)" stroke-width="4"/>
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent-green)" stroke-width="4"
                  stroke-dasharray="213.6" stroke-dashoffset="0.6" stroke-linecap="round"
                  transform="rotate(-90 40 40)" style="transition: stroke-dashoffset 1s ease;"/>
                <text x="40" y="38" text-anchor="middle" fill="var(--accent-green)" font-size="10" font-family="var(--font-mono)">✓</text>
                <text x="40" y="50" text-anchor="middle" fill="var(--text-muted)" font-size="7" font-family="var(--font-mono)">ONLINE</text>
              </svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                <span class="status-dot online"></span>
                <span style="font-weight: 600;">System Online</span>
              </div>
              <div class="text-xs text-muted mono">Last Scan: ${now}</div>
              <div class="text-xs text-muted mono" style="margin-top:2px;">Uptime: 99.97% | Graceful Degradation: Active</div>
            </div>
          </div>
        </div>
        <!-- Multi-Modal Threat Ingestion -->
        <div class="card">
          <div class="text-mono-label mb-2">MULTI-MODAL THREAT INGESTION</div>
          <div class="tabs" style="margin-top: var(--space-4);">
            <button class="tab active" id="tab-upload-media" data-tab="media">📎 Upload Media</button>
            <button class="tab" id="tab-paste-text" data-tab="text">📝 Paste Text/URL</button>
            <button class="tab" id="tab-connect-logs" data-tab="logs">🔗 Connect Logs</button>
          </div>
          <div id="ingestion-content">
            <div class="dropzone" id="dash-dropzone">
              <div class="dropzone-icon">☁️</div>
              <div class="dropzone-text">Drop MP4/WAV/JPG/PNG files here</div>
              <div class="dropzone-hint">or click to browse</div>
            </div>
          </div>
          <button class="btn btn-primary btn-large mt-4" id="btn-analyze-shield">
            🔍 Analyze with Shield-X
          </button>
        </div>
      </div>

      <!-- Header -->
      <div class="section-header">
        <div>
          <h1 style="font-size: var(--text-2xl); margin-bottom: var(--space-1);">SecureSight NLAI</h1>
          <p style="font-size: var(--text-sm);">Multi-Threat Defense Platform • Real-time AI-Powered Security Operations</p>
        </div>
      </div>

      <!-- Active Threat Monitoring -->
      <div class="section">
        <div class="section-header">
          <h2 class="section-title">Active Threat Monitoring</h2>
          <div class="live-indicator">
            <span class="status-dot online"></span>
            Live Detection Active
          </div>
        </div>
        <div class="card-grid">
          <!-- Media Scrutiny Card -->
          <div class="card threat-card" id="card-deepfake" style="cursor: pointer;">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon" style="background: var(--accent-red-dim); color: var(--accent-red);">🎬</div>
                <div>
                  <div class="card-title">Media Scrutiny</div>
                  <div class="card-subtitle">Deepfake Detection</div>
                </div>
              </div>
              <span class="badge badge-critical">⚠ CRITICAL</span>
            </div>
            <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4); min-height: 140px; display: flex; flex-direction: column; justify-content: center;">
              <div style="border: 2px solid var(--accent-red); border-radius: var(--radius-sm); width: 80px; height: 80px; margin: 0 auto var(--space-3); display: flex; align-items: center; justify-content: center; position: relative;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 12 0v1"/></svg>
                <div style="position:absolute;top:-4px;right:-4px;width:10px;height:10px;background:var(--accent-red);border-radius:50%;"></div>
              </div>
              <div style="text-align: center;">
                <div class="text-xs mono" style="margin-top: var(--space-2);">Audio-Visual Sync Analysis</div>
                <div class="text-sm text-red mono" style="font-weight:600; margin-top: var(--space-1);">DESYNC DETECTED</div>
              </div>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Confidence</span>
              <span class="result-metric-value text-red">94.7%</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Method</span>
              <span class="result-metric-value">ViT-DIMA806</span>
            </div>
          </div>

          <!-- Identity & Behavior Card -->
          <div class="card threat-card" id="card-anomaly" style="cursor: pointer;">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon" style="background: var(--accent-orange-dim); color: var(--accent-orange);">👤</div>
                <div>
                  <div class="card-title">Identity & Behavior</div>
                  <div class="card-subtitle">Anomaly Detection</div>
                </div>
              </div>
              <span class="badge badge-warning">⚠ WARNING</span>
            </div>
            <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4); min-height: 140px;">
              <div class="badge badge-critical" style="margin-bottom: var(--space-3);">IMPOSSIBLE TRAVEL</div>
              <div style="position: relative; height: 70px; margin: var(--space-3) 0;">
                <svg width="100%" height="70" viewBox="0 0 300 70">
                  <circle cx="60" cy="25" r="6" fill="var(--accent-red)"/>
                  <text x="60" y="50" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">London</text>
                  <text x="60" y="62" text-anchor="middle" fill="var(--accent-green)" font-size="8" font-family="var(--font-mono)">14:06 UTC</text>
                  <line x1="66" y1="25" x2="234" y2="35" stroke="var(--accent-orange)" stroke-width="1.5" stroke-dasharray="5,3"/>
                  <circle cx="240" cy="35" r="6" fill="var(--accent-green)"/>
                  <text x="240" y="55" text-anchor="middle" fill="var(--text-muted)" font-size="9" font-family="var(--font-mono)">Mumbai</text>
                  <text x="240" y="67" text-anchor="middle" fill="var(--accent-green)" font-size="8" font-family="var(--font-mono)">14:20 UTC</text>
                </svg>
              </div>
              <div class="text-xs mono text-muted" style="margin-top: var(--space-2);">User: admin@company.com</div>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Travel Time</span>
              <span class="result-metric-value text-red">10 minutes</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Distance</span>
              <span class="result-metric-value text-red">7,200 km</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Anomaly Score</span>
              <span class="result-metric-value text-red">0.89 (Outlier)</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Confidence</span>
              <span class="result-metric-value text-orange">87.5%</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Method</span>
              <span class="result-metric-value">Isolation Forest</span>
            </div>
          </div>

          <!-- Communications Card -->
          <div class="card threat-card" id="card-phishing" style="cursor: pointer;">
            <div class="card-header">
              <div class="card-title-group">
                <div class="card-icon" style="background: var(--accent-red-dim); color: var(--accent-red);">✉️</div>
                <div>
                  <div class="card-title">Communications</div>
                  <div class="card-subtitle">Phishing Detection</div>
                </div>
              </div>
              <span class="badge badge-critical">⚠ CRITICAL</span>
            </div>
            <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4); min-height: 140px; font-size: var(--text-sm);">
              <div style="margin-bottom: var(--space-2);">
                <span class="text-muted mono text-xs">FROM:</span>
                <span class="mono" style="margin-left: var(--space-2);">payroll@comp4ny-hr.com</span>
                <span class="badge badge-spoofed" style="margin-left: var(--space-2);">SPOOFED</span>
              </div>
              <div style="margin-bottom: var(--space-3);">
                <span class="text-muted mono text-xs">SUBJECT:</span>
                <span class="mono" style="margin-left: var(--space-2);">URGENT: Q3 Payroll Update Required</span>
              </div>
              <div style="color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.6;">
                Dear Employee,<br><br>
                We've detected an issue with your Q3 payroll information.
                <span class="highlight-urgent">Immediate action required</span> to prevent payment delays.<br><br>
                Please verify...<br><br>
                <span class="text-muted">Deceptive Inte...</span>
              </div>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Actual Redirect</span>
              <span class="result-metric-value text-red mono" style="font-size: var(--text-xs);">https://payrol-update.xyz</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Domain Age</span>
              <span class="result-metric-value text-red">2 days</span>
            </div>
            <div class="result-metric">
              <span class="result-metric-label">Confidence</span>
              <span class="result-metric-value text-red">98.1%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // --- Wire up dashboard interactions ---

  // Shared state for the ingestion panel
  let dashSelectedFile = null;
  let dashSelectedDataUrl = null;

  // Helper to create a working dropzone with file input
  function createMediaDropzone() {
    return `
      <div class="dropzone" id="dash-dropzone">
        <div class="dropzone-icon">☁️</div>
        <div class="dropzone-text">Drop MP4/WAV/JPG/PNG files here</div>
        <div class="dropzone-hint">or <span style="color:var(--accent-green);text-decoration:underline;cursor:pointer;">click to browse</span></div>
        <input type="file" id="dash-file-input" accept="image/jpeg,image/png,image/webp,video/mp4,audio/wav" style="display:none;" />
      </div>
      <div id="dash-file-preview" style="display:none;"></div>`;
  }

  function wireDropzone() {
    const dropzone = container.querySelector('#dash-dropzone');
    const fileInput = container.querySelector('#dash-file-input');
    const previewDiv = container.querySelector('#dash-file-preview');
    if (!dropzone || !fileInput) return;

    // Click to browse
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleDashFile(file, dropzone, previewDiv, fileInput);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleDashFile(file, dropzone, previewDiv, fileInput);
    });
  }

  function handleDashFile(file, dropzone, previewDiv, fileInput) {
    dashSelectedFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      dashSelectedDataUrl = reader.result;
      // Store in sessionStorage so the analysis page can pick it up
      try {
        sessionStorage.setItem('dashFile_name', file.name);
        sessionStorage.setItem('dashFile_type', file.type);
        sessionStorage.setItem('dashFile_dataUrl', reader.result);
      } catch (e) {
        // sessionStorage might be full for large files, that's ok
      }
    };
    reader.readAsDataURL(file);

    // Show preview
    dropzone.style.display = 'none';
    previewDiv.style.display = 'block';

    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    const icon = file.type.startsWith('image/') ? '🖼️' : file.type.startsWith('video/') ? '🎬' : '🎵';

    previewDiv.innerHTML = `
      <div class="file-preview" style="margin-top: var(--space-3);">
        <span>${icon}</span>
        <span class="file-preview-name">${file.name}</span>
        <span class="file-preview-size">${sizeMB} MB</span>
        <button class="file-preview-remove" id="dash-remove-file">✕</button>
      </div>`;

    previewDiv.querySelector('#dash-remove-file').addEventListener('click', () => {
      dashSelectedFile = null;
      dashSelectedDataUrl = null;
      sessionStorage.removeItem('dashFile_name');
      sessionStorage.removeItem('dashFile_type');
      sessionStorage.removeItem('dashFile_dataUrl');
      previewDiv.style.display = 'none';
      previewDiv.innerHTML = '';
      dropzone.style.display = '';
      fileInput.value = '';
    });
  }

  // Initial dropzone setup
  const ingestionContent = container.querySelector('#ingestion-content');
  ingestionContent.innerHTML = createMediaDropzone();
  wireDropzone();

  // Tab switching
  const tabs = container.querySelectorAll('.tab');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const type = tab.dataset.tab;
      if (type === 'media') {
        // Reset file state
        dashSelectedFile = null;
        dashSelectedDataUrl = null;
        ingestionContent.innerHTML = createMediaDropzone();
        wireDropzone();
      } else if (type === 'text') {
        ingestionContent.innerHTML = `
          <textarea class="textarea" id="dash-text-input" placeholder="Paste email content, suspicious URL, or text to analyze..." style="min-height: 100px;"></textarea>`;
      } else if (type === 'logs') {
        ingestionContent.innerHTML = `
          <textarea class="textarea" id="dash-log-input" placeholder="Paste log entries (CSV, JSON, or plain text)..." style="min-height: 100px; font-family: var(--font-mono);"></textarea>`;
      }
    });
  });

  // Analyze with Shield-X button
  container.querySelector('#btn-analyze-shield').addEventListener('click', () => {
    const activeTab = container.querySelector('.tab.active');
    const type = activeTab?.dataset.tab;

    if (type === 'text') {
      // Store text for phishing page
      const textInput = container.querySelector('#dash-text-input');
      if (textInput && textInput.value.trim()) {
        sessionStorage.setItem('dashText', textInput.value.trim());
      }
      navigate('phishing');
    } else if (type === 'logs') {
      // Store logs for anomaly page
      const logInput = container.querySelector('#dash-log-input');
      if (logInput && logInput.value.trim()) {
        sessionStorage.setItem('dashLogs', logInput.value.trim());
      }
      navigate('anomaly');
    } else {
      // Media → deepfake (file already stored in sessionStorage)
      navigate('deepfake');
    }
  });

  // Threat cards navigate to their pages
  container.querySelector('#card-deepfake').addEventListener('click', () => navigate('deepfake'));
  container.querySelector('#card-anomaly').addEventListener('click', () => navigate('anomaly'));
  container.querySelector('#card-phishing').addEventListener('click', () => navigate('phishing'));
}


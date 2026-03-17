/**
 * Deepfake Detection Page
 * Sends data to n8n webhook → Python API: Deepfake
 * Falls back to local analysis if webhook is unreachable
 */
import { analyzeDeepfakeViaWebhook } from '../api/n8n-service.js';
import { readFileAsDataURL, formatFileSize, delay } from '../utils/helpers.js';

export function renderDeepfake(container) {
  container.innerHTML = `
    <div class="page">
      <div class="section-header">
        <div>
          <h1 style="display: flex; align-items: center; gap: var(--space-3);">
            <span style="color: var(--accent-red);">🎬</span> Deepfake Detection
          </h1>
          <p style="margin-top: var(--space-1);">AI-Powered Media Authenticity Analysis</p>
        </div>
        <div class="live-indicator">
          <span class="status-dot online"></span>
          ViT-DIMA806 Engine Ready
        </div>
      </div>

      <div class="split-layout">
        <!-- Input Panel -->
        <div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Media Upload</div>
              <div class="text-xs text-muted">JPG, PNG, WEBP, MP4 supported</div>
            </div>
            <div class="dropzone" id="deepfake-dropzone">
              <div class="dropzone-icon">☁️</div>
              <div class="dropzone-text">Drop image or video files here<br>or <span>click to browse</span></div>
              <div class="dropzone-hint">Supported: JPG, PNG, WEBP, MP4 • Max 50MB</div>
              <input type="file" id="deepfake-file-input" accept="image/jpeg,image/png,image/webp,video/mp4" style="display:none;" />
            </div>
            <div id="deepfake-file-preview" style="display:none;"></div>
            <button class="btn btn-primary btn-large mt-4" id="btn-analyze-deepfake" disabled>
              🔍 Analyze Media
            </button>
          </div>
        </div>

        <!-- Results Panel -->
        <div id="deepfake-results">
          <div class="card empty-state">
            <div class="empty-state-icon">🖼️</div>
            <h3 style="margin-bottom: var(--space-2);">No Media Uploaded</h3>
            <p class="text-sm">Upload an image to analyze for deepfake manipulation indicators.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  let selectedFile = null;
  let selectedDataUrl = null;

  const dropzone = container.querySelector('#deepfake-dropzone');
  const fileInput = container.querySelector('#deepfake-file-input');
  const previewDiv = container.querySelector('#deepfake-file-preview');
  const analyzeBtn = container.querySelector('#btn-analyze-deepfake');
  const resultsContainer = container.querySelector('#deepfake-results');

  // Dropzone click
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
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) handleFile(file);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  async function handleFile(file) {
    selectedFile = file;
    selectedDataUrl = await readFileAsDataURL(file);
    const isVideo = file.type.startsWith('video/');

    dropzone.style.display = 'none';
    previewDiv.style.display = 'block';

    const mediaPreview = isVideo
      ? `<video src="${selectedDataUrl}" controls style="max-width: 100%; max-height: 300px; display: block;"></video>`
      : `<img src="${selectedDataUrl}" style="max-width: 100%; max-height: 300px; display: block;" />`;
    const icon = isVideo ? '🎬' : '🖼️';

    previewDiv.innerHTML = `
      <div style="margin-top: var(--space-3);">
        <div class="canvas-container" style="margin-bottom: var(--space-3);">
          ${mediaPreview}
        </div>
        <div class="file-preview">
          <span>${icon}</span>
          <span class="file-preview-name">${file.name}</span>
          <span class="file-preview-size">${formatFileSize(file.size)}</span>
          <button class="file-preview-remove" id="btn-remove-file">✕</button>
        </div>
      </div>`;

    previewDiv.querySelector('#btn-remove-file').addEventListener('click', () => {
      selectedFile = null;
      selectedDataUrl = null;
      previewDiv.style.display = 'none';
      dropzone.style.display = '';
      analyzeBtn.disabled = true;
      fileInput.value = '';
    });

    analyzeBtn.disabled = false;
  }

  // Analyze button
  analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile || !selectedDataUrl) return;
    const isVideo = selectedFile.type.startsWith('video/');

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
    resultsContainer.innerHTML = `
      <div class="card" style="text-align: center; padding: var(--space-12);">
        <div class="spinner" style="width:40px;height:40px;border-width:3px;margin: 0 auto var(--space-4);"></div>
        <h3>Analyzing Media...</h3>
        <p class="text-sm text-muted mt-4">Sending to n8n workflow → Python Deepfake API</p>
        <div class="progress-bar mt-4"><div class="progress-fill" id="df-progress" style="width:0%"></div></div>
      </div>`;

    const progress = resultsContainer.querySelector('#df-progress');
    for (let i = 0; i <= 30; i += 10) {
      await delay(150);
      progress.style.width = i + '%';
    }

    let result = null;
    let source = 'n8n';
    let errorMessage = 'Analysis requires the n8n cloud pipeline. The webhook did not respond or returned invalid data. Please ensure your n8n workflow is active.';
    
    try {
      const webhookResponse = await analyzeDeepfakeViaWebhook(selectedDataUrl, selectedFile.name, selectedFile.type);

      if (webhookResponse.success && webhookResponse.data) {
        progress.style.width = '80%';
        await delay(200);
        const rawData = Array.isArray(webhookResponse.data) ? webhookResponse.data[0] : webhookResponse.data;

        // Debug: log the raw response so we can see the structure
        console.log('[SecureSight] Raw n8n response:', JSON.stringify(rawData, null, 2));

        // Flatten: the NLAI fields might be at top level OR nested inside a sub-object
        const n8nData = flattenNlaiResponse(rawData);
        console.log('[SecureSight] Flattened NLAI data:', JSON.stringify(n8nData, null, 2));

        // Parse the NLAI response format
        const classification = n8nData.the_what || n8nData.verdict || n8nData.classification || '';
        const evidence = n8nData.the_evidence || n8nData.evidence || '';
        const confidenceText = n8nData.the_confidence || n8nData.confidence || '';
        const action = n8nData.the_action || n8nData.action || '';
        const visualAssets = n8nData.visual_assets || {};

        // Extract confidence score from text like "77.7% NLAI Confidence"
        const confMatch = confidenceText.match(/([\d.]+)%/);
        const confidenceScore = confMatch ? parseFloat(confMatch[1]) / 100 : 0.5;

        // Parse frame statistics from evidence text
        const frameStats = parseFrameStats(evidence);

        // Determine verdict and severity
        const isFake = classification.toLowerCase().includes('deepfake') ||
                        classification.toLowerCase().includes('fake') ||
                        evidence.toLowerCase().includes('verdict: fake');
        let verdict, severity;
        if (isFake && confidenceScore > 0.6) { verdict = 'DEEPFAKE DETECTED'; severity = 'critical'; }
        else if (isFake || confidenceScore > 0.35) { verdict = 'SUSPICIOUS'; severity = 'warning'; }
        else { verdict = 'AUTHENTIC'; severity = 'safe'; }

        result = {
          verdict: verdict,
          score: confidenceScore,
          confidence: confidenceScore,
          severity: severity,
          method: 'ViT-DIMA806',
          fileName: selectedFile.name,
          // NLAI-specific fields
          classification: classification,
          evidence: evidence,
          confidenceText: confidenceText,
          recommendedAction: action,
          frameStats: frameStats,
          visualAssets: visualAssets,
          n8nRaw: n8nData,
          // Standard fields (may be empty for video)
          factors: [],
          faceRegions: [],
          details: {},
        };

      } else if (!webhookResponse.success) {
        errorMessage = webhookResponse.error;
      }
    } catch (err) {
      console.error('[Deepfake] n8n webhook error:', err);
      errorMessage = err.message || errorMessage;
    }

    // If webhook failed
    if (!result) {
      progress.style.width = '100%';
      await delay(200);
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🔍 Analyze Media';
      resultsContainer.innerHTML = `
        <div class="card">
          <div style="color: var(--accent-orange); display: flex; align-items: center; gap: var(--space-2);">
            <span>⚠️</span> ${errorMessage}
          </div>
        </div>`;
      return;
    }

    progress.style.width = '100%';
    await delay(200);

    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '🔍 Analyze Media';

    renderN8nDeepfakeResults(resultsContainer, result, selectedDataUrl, selectedFile.type);
  });
}



/**
 * Render results from n8n NLAI pipeline.
 * Handles the structured response: the_what, the_evidence, the_confidence, the_action, visual_assets
 */
function renderN8nDeepfakeResults(container, result, mediaUrl, mediaType) {
  const sevColors = {
    critical: 'var(--accent-red)',
    warning: 'var(--accent-orange)',
    safe: 'var(--accent-green)'
  };
  const color = sevColors[result.severity] || 'var(--accent-green)';
  const sevClass = result.severity === 'critical' ? 'badge-critical' : result.severity === 'warning' ? 'badge-warning' : 'badge-safe';
  const isVideo = mediaType && mediaType.startsWith('video/');
  const fs = result.frameStats || {};

  // Build frame analysis bar chart
  let frameBarHTML = '';
  if (fs.totalFrames > 0) {
    const fakePercent = (fs.fakeFrames / fs.totalFrames * 100).toFixed(0);
    const realPercent = (fs.realFrames / fs.totalFrames * 100).toFixed(0);
    frameBarHTML = `
      <div class="card" style="margin-bottom: var(--space-6);">
        <div class="text-mono-label mb-2">📽️ FRAME-BY-FRAME ANALYSIS</div>
        <div style="display: flex; gap: var(--space-6); margin-top: var(--space-4);">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
              <span class="text-sm"><strong>${fs.totalFrames}</strong> frames sampled</span>
              <span class="text-xs text-muted">1 every ${fs.sampleRate} frames</span>
            </div>
            <div style="display: flex; height: 28px; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: var(--space-3);">
              <div style="width: ${fakePercent}%; background: var(--accent-red); display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; color: #fff; min-width: 30px;">${fs.fakeFrames}</div>
              <div style="width: ${realPercent}%; background: var(--accent-green); display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; color: #fff; min-width: 30px;">${fs.realFrames}</div>
            </div>
            <div style="display: flex; gap: var(--space-4); font-size: var(--text-xs);">
              <span style="color: var(--accent-red);">● ${fs.fakeFrames} Fake frames (${fakePercent}%)</span>
              <span style="color: var(--accent-green);">● ${fs.realFrames} Real frames (${realPercent}%)</span>
            </div>
          </div>
        </div>
        ${fs.mostSuspiciousFrame ? `
          <div style="margin-top: var(--space-4); padding: var(--space-3); background: rgba(239,68,68,0.1); border-radius: var(--radius-sm); border-left: 3px solid var(--accent-red);">
            <div class="text-sm" style="color: var(--accent-red); font-weight: 600;">⚠ Most Suspicious Frame</div>
            <div class="text-xs text-muted" style="margin-top: var(--space-1);">
              Frame index <strong>${fs.mostSuspiciousFrame}</strong> — Fake confidence <strong style="color: var(--accent-red);">${fs.mostSuspiciousConfidence}%</strong>
            </div>
          </div>
        ` : ''}
      </div>`;
  }

  // Build visual assets section (heatmap, face crop, evidence grid)
  const DEEPFAKE_API_BASE = 'https://slushier-waffly-mallie.ngrok-free.dev';
  let visualAssetsHTML = '';
  const assets = result.visualAssets || {};
  const resolveAssetUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;  // already absolute
    return DEEPFAKE_API_BASE + (path.startsWith('/') ? '' : '/') + path;
  };
  const assetEntries = [];
  if (assets.primary_heatmap) assetEntries.push({ label: 'Grad-CAM Heatmap', desc: 'Highlights facial regions exhibiting synthesis artifacts', url: resolveAssetUrl(assets.primary_heatmap) });
  if (assets.face_crop) assetEntries.push({ label: 'Face Crop Analysis', desc: 'Isolated face region with detection overlay', url: resolveAssetUrl(assets.face_crop) });
  if (assets.evidence_grid) assetEntries.push({ label: 'Evidence Grid', desc: 'Multi-frame comparison showing classification across sampled frames', url: resolveAssetUrl(assets.evidence_grid) });

  if (assetEntries.length > 0) {
    visualAssetsHTML = `
      <div class="text-mono-label mb-2" style="margin-top: var(--space-6);">🖼️ VISUAL ANALYSIS ASSETS</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: var(--space-4); margin-top: var(--space-3);">
        ${assetEntries.map((asset, i) => `
          <div class="card" style="padding: 0; overflow: hidden;">
            <img class="ngrok-asset" data-ngrok-src="${asset.url}" alt="${asset.label}" style="width: 100%; display: none; min-height: 120px; background: var(--bg-input); object-fit: cover;" />
            <div class="ngrok-asset-fallback" style="display: flex; height: 160px; align-items: center; justify-content: center; background: var(--bg-input); color: var(--text-muted); font-size: var(--text-xs); flex-direction: column; gap: var(--space-2);">
              <div class="spinner" style="width:24px;height:24px;border-width:2px;"></div>
              <span>Loading from Python API...</span>
            </div>
            <div style="padding: var(--space-3);">
              <div class="text-sm" style="font-weight: 600;">${asset.label}</div>
              <div class="text-xs text-muted" style="margin-top: 2px;">${asset.desc}</div>
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  // Build evidence text from the_evidence
  let evidenceHTML = '';
  if (result.evidence) {
    // Split evidence into sentences for readability
    const sentences = result.evidence.split(/(?<=\.)\s+/).filter(s => s.trim().length > 0);
    evidenceHTML = `
      <div class="card" style="margin-top: var(--space-6);">
        <div class="text-mono-label mb-2">📋 ANALYSIS EVIDENCE</div>
        <div style="margin-top: var(--space-3);">
          ${sentences.map(s => {
            let icon = '•';
            let textColor = 'var(--text-secondary)';
            if (s.toLowerCase().includes('fake')) { icon = '🔴'; textColor = 'var(--accent-red)'; }
            else if (s.toLowerCase().includes('real')) { icon = '🟢'; textColor = 'var(--accent-green)'; }
            else if (s.toLowerCase().includes('suspicious')) { icon = '⚠️'; textColor = 'var(--accent-orange)'; }
            else if (s.toLowerCase().includes('grad-cam') || s.toLowerCase().includes('heatmap')) { icon = '🔥'; }
            return `<div style="display: flex; gap: var(--space-2); margin-bottom: var(--space-2); align-items: baseline;">
              <span>${icon}</span>
              <span class="text-sm" style="color: ${textColor}; line-height: 1.5;">${s.trim()}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Media preview
  const mediaPreview = isVideo
    ? `<video src="${mediaUrl}" controls style="max-width: 100%; max-height: 300px; display: block; margin: 0 auto;"></video>`
    : `<img src="${mediaUrl}" style="max-width: 100%; max-height: 300px; display: block; margin: 0 auto;" />`;

  container.innerHTML = `
    <div class="result-panel">
      <!-- Header: Verdict + Score -->
      <div class="result-header">
        <div>
          <div class="text-mono-label mb-2">NLAI CLASSIFICATION <span class="badge badge-safe" style="margin-left: var(--space-2);">⚡ n8n CLOUD</span></div>
          <div class="result-verdict" style="color: ${color};">${result.verdict}</div>
          <span class="badge ${sevClass}" style="margin-top: var(--space-2);">${result.severity.toUpperCase()}</span>
          ${result.classification ? `<div class="text-xs text-muted" style="margin-top: var(--space-2);">${result.classification}</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div class="text-mono-label mb-2">CONFIDENCE</div>
          <div class="result-score" style="color: ${color};">${(result.score * 100).toFixed(1)}%</div>
          <div class="text-xs text-muted" style="margin-top: var(--space-1);">${result.confidenceText || ''}</div>
        </div>
      </div>

      <!-- Media Preview -->
      <div style="background: var(--bg-input); border-radius: var(--radius-md); padding: var(--space-4); margin-bottom: var(--space-4);">
        ${mediaPreview}
      </div>

      <!-- Metrics Row -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-4);">
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Method</div>
          <div class="mono text-green" style="font-size: var(--text-sm); font-weight: 600; margin-top: var(--space-2);">${result.method}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">Media Type</div>
          <div class="mono" style="font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); margin-top: var(--space-2);">${isVideo ? '🎬 Video' : '🖼️ Image'}</div>
        </div>
        <div class="card" style="text-align: center;">
          <div class="text-xs text-muted">File</div>
          <div class="mono text-xs" style="margin-top: var(--space-2); word-break: break-all;">${result.fileName}</div>
        </div>
      </div>

      <!-- Frame Analysis Bar Chart -->
      ${frameBarHTML}

      <!-- Visual Analysis Assets -->
      ${visualAssetsHTML}

      <!-- Evidence Details -->
      ${evidenceHTML}

      <!-- Recommended Action -->
      ${result.recommendedAction ? `
        <div style="margin-top: var(--space-6); padding: var(--space-4); background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: var(--radius-md);">
          <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
            <span>🛡️</span>
            <span class="text-mono-label" style="color: var(--accent-red);">RECOMMENDED ACTION</span>
          </div>
          <div class="text-sm" style="color: var(--text-primary); line-height: 1.6;">${result.recommendedAction}</div>
        </div>
      ` : ''}
    </div>
  `;

  // Post-render: load images via fetch with ngrok header to bypass interstitial
  container.querySelectorAll('.ngrok-asset').forEach(img => {
    const url = img.dataset.ngrokSrc;
    if (url) loadNgrokImage(url, img);
  });
}

/**
 * Parse frame statistics from the evidence text.
 * e.g. "Analyzed 22 sampled frames (1 every 15 frames). — 13 frames classified as Fake. — 9 frames classified as Real. Most suspicious frame at index 120 (Fake confidence 96.9%)."
 */
function parseFrameStats(evidence) {
  const stats = {};
  const totalMatch = evidence.match(/(\d+)\s+sampled\s+frames/i);
  if (totalMatch) stats.totalFrames = parseInt(totalMatch[1]);

  const rateMatch = evidence.match(/1\s+every\s+(\d+)\s+frames/i);
  if (rateMatch) stats.sampleRate = parseInt(rateMatch[1]);

  const fakeMatch = evidence.match(/(\d+)\s+frames?\s+classified\s+as\s+Fake/i);
  if (fakeMatch) stats.fakeFrames = parseInt(fakeMatch[1]);

  const realMatch = evidence.match(/(\d+)\s+frames?\s+classified\s+as\s+Real/i);
  if (realMatch) stats.realFrames = parseInt(realMatch[1]);

  const suspMatch = evidence.match(/suspicious\s+frame\s+(?:at\s+)?index\s+(\d+)/i);
  if (suspMatch) stats.mostSuspiciousFrame = parseInt(suspMatch[1]);

  const suspConfMatch = evidence.match(/Fake\s+confidence\s+([\d.]+)%/i);
  if (suspConfMatch) stats.mostSuspiciousConfidence = parseFloat(suspConfMatch[1]);

  return stats;
}



/**
 * Flatten the n8n response to find NLAI fields anywhere in the object tree.
 * The response might be: { the_what: ... } or { body: { the_what: ... } }
 * or { data: { the_what: ... } } etc. Also handles stringified JSON nested deep.
 */
function flattenNlaiResponse(obj) {
  if (!obj) return {};
  
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch (e) {
      return {};
    }
  }

  if (typeof obj !== 'object') return {};

  let found = null;
  
  function search(node) {
    if (found) return;
    if (!node || typeof node !== 'object') return;
    
    // Check if current node has any of the expected keys
    if (node.the_what || node.the_evidence || node.the_confidence || node.verdict || node.classification || node.visual_assets) {
      found = { ...node };
      return;
    }
    
    // Otherwise, iterate over keys
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
        try {
          const parsed = JSON.parse(val);
          search(parsed);
        } catch(e) {
          // Ignore parse error
        }
      } else if (val && typeof val === 'object') {
        search(val);
      }
    }
  }
  
  search(obj);
  return found || obj;
}

/**
 * Load an image through fetch with ngrok-skip-browser-warning header,
 * then convert to an object URL for display.
 * Ngrok's interstitial blocks normal <img> loads.
 */
async function loadNgrokImage(url, imgElement) {
  try {
    const response = await fetch(url, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Not an image');
    imgElement.src = URL.createObjectURL(blob);
    imgElement.style.display = 'block';
  } catch (err) {
    console.warn('[SecureSight] Failed to load image from:', url, err);
    imgElement.style.display = 'none';
    const fallback = imgElement.nextElementSibling;
    if (fallback) fallback.style.display = 'flex';
  }
}

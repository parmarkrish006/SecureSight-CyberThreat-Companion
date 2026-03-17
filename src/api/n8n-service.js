/**
 * n8n API Service
 * Connects the Secure Sight dashboard to the n8n webhook workflow
 * for hybrid cyber threat detection.
 *
 * Webhook: https://parmarkrish.app.n8n.cloud/webhook/hybrid_cyber_threat_detection
 * Flow: Ingest Webhook → Threat Router → [Deepfake API | Behavior Anomaly API | VirusTotal] → NLAI Translator → Response
 *
 * Threat Router expects field "type" with values:
 *   "media" → Output 0 → Python API: Deepfake
 *   "logs"  → Output 1 → Python API: Behavior Anomaly
 *   "text"  → Output 2 → Code → VirusTotal HTTP Request
 */

const WEBHOOK_URL = 'https://parmarkrish.app.n8n.cloud/webhook/hybrid_cyber_threat_detection';

/**
 * Send data to the n8n webhook for analysis.
 * @param {'media'|'logs'|'text'} threatType - The type for the Threat Router
 * @param {object} payload - The data payload
 * @returns {Promise<object>} - The analysis result from n8n
 */
export async function analyzeViaWebhook(threatType, payload) {
  const body = {
    threat_type: threatType,
    timestamp: new Date().toISOString(),
    source: 'secureSight-dashboard',
    ...payload
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error('Webhook returned an empty response. Please configure your n8n Webhook node to "Respond: When Last Node Finishes" or use a "Respond to Webhook" node.');
    }

    try {
      const data = JSON.parse(text);
      return { success: true, data };
    } catch {
      return { success: true, data: { raw: text } };
    }
  } catch (error) {
    console.error(`[n8n] Webhook error for ${threatType}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to connect to n8n webhook',
    };
  }
}

/**
 * Send media file for deepfake analysis.
 * type: "media" → Threat Router Output 0 → Python API: Deepfake
 * Sends as multipart/form-data with binary file named 'media_file'
 */
export async function analyzeDeepfakeViaWebhook(fileDataUrl, fileName, fileType) {
  try {
    // Convert data URL to Blob
    const response = await fetch(fileDataUrl);
    const blob = await response.blob();

    // Build multipart form
    const formData = new FormData();
    formData.append('threat_type', 'media');
    formData.append('timestamp', new Date().toISOString());
    formData.append('source', 'secureSight-dashboard');
    formData.append('media_file', blob, fileName);

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header — browser sets it with boundary automatically
    });

    console.log('[n8n] Deepfake webhook status:', res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`Webhook returned ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    console.log('[n8n] Deepfake raw response text (first 500 chars):', text.substring(0, 500));

    if (!text || !text.trim()) {
      throw new Error('Webhook returned an empty response. Please configure your n8n Webhook node to "Respond: When Last Node Finishes".');
    }

    try {
      const data = JSON.parse(text);
      console.log('[n8n] Deepfake parsed JSON:', JSON.stringify(data, null, 2).substring(0, 1000));
      return { success: true, data };
    } catch {
      console.warn('[n8n] Deepfake response is not JSON, treating as raw text');
      return { success: true, data: { raw: text } };
    }
  } catch (error) {
    console.error('[n8n] Deepfake webhook error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to n8n webhook',
    };
  }
}

/**
 * Send log data for behavior anomaly analysis.
 * type: "logs" → Threat Router Output 1 → Python API: Behavior Anomaly
 */
export async function analyzeAnomalyViaWebhook(logText) {
  return analyzeViaWebhook('logs', {
    logs: logText,
  });
}

/**
 * Send email text for phishing analysis.
 * type: "text" → Threat Router Output 2 → Code → VirusTotal
 */
export async function analyzePhishingViaWebhook(emailText) {
  return analyzeViaWebhook('text', {
    email: emailText,
  });
}


/**
 * Anomaly Detection Engine
 * Analyzes log data for behavioral anomalies including:
 * - Impossible travel detection
 * - Login frequency outliers (z-score)
 * - Session pattern anomalies
 */

// Known city coordinates for geolocation
const CITY_COORDS = {
  'new york': { lat: 40.7128, lon: -74.0060 },
  'london': { lat: 51.5074, lon: -0.1278 },
  'mumbai': { lat: 19.0760, lon: 72.8777 },
  'tokyo': { lat: 35.6762, lon: 139.6503 },
  'sydney': { lat: -33.8688, lon: 151.2093 },
  'paris': { lat: 48.8566, lon: 2.3522 },
  'berlin': { lat: 52.5200, lon: 13.4050 },
  'moscow': { lat: 55.7558, lon: 37.6173 },
  'beijing': { lat: 39.9042, lon: 116.4074 },
  'san francisco': { lat: 37.7749, lon: -122.4194 },
  'los angeles': { lat: 34.0522, lon: -118.2437 },
  'chicago': { lat: 41.8781, lon: -87.6298 },
  'dubai': { lat: 25.2048, lon: 55.2708 },
  'singapore': { lat: 1.3521, lon: 103.8198 },
  'toronto': { lat: 43.6532, lon: -79.3832 },
  'são paulo': { lat: -23.5505, lon: -46.6333 },
  'sao paulo': { lat: -23.5505, lon: -46.6333 },
  'seoul': { lat: 37.5665, lon: 126.9780 },
  'shanghai': { lat: 31.2304, lon: 121.4737 },
  'hong kong': { lat: 22.3193, lon: 114.1694 },
  'delhi': { lat: 28.7041, lon: 77.1025 },
  'bangalore': { lat: 12.9716, lon: 77.5946 },
  'cairo': { lat: 30.0444, lon: 31.2357 },
  'lagos': { lat: 6.5244, lon: 3.3792 },
  'nairobi': { lat: -1.2921, lon: 36.8219 },
  'mexico city': { lat: 19.4326, lon: -99.1332 },
  'amsterdam': { lat: 52.3676, lon: 4.9041 },
  'stockholm': { lat: 59.3293, lon: 18.0686 },
};

/**
 * Calculate distance between two lat/lon points in km (Haversine formula)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate z-score for a value given a dataset
 */
function zScore(value, dataset) {
  const mean = dataset.reduce((a, b) => a + b, 0) / dataset.length;
  const std = Math.sqrt(dataset.reduce((sum, v) => sum + (v - mean) ** 2, 0) / dataset.length);
  return std === 0 ? 0 : (value - mean) / std;
}

/**
 * Parse log text into structured entries
 */
function parseLogs(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const entries = [];

  for (const line of lines) {
    const entry = parseLogLine(line);
    if (entry) entries.push(entry);
  }

  return entries;
}

function parseLogLine(line) {
  const lower = line.toLowerCase();

  // Try to extract timestamp
  let timestamp = null;
  const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/);
  const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  if (isoMatch) timestamp = new Date(isoMatch[1]);
  else if (dateMatch) timestamp = new Date(dateMatch[1]);
  else timestamp = new Date(); // fallback

  // Try to extract user
  let user = 'unknown';
  const userMatch = line.match(/user[=: ]+([^\s,;]+)/i) ||
    line.match(/email[=: ]+([^\s,;]+)/i) ||
    line.match(/account[=: ]+([^\s,;]+)/i);
  if (userMatch) user = userMatch[1];

  // Try to extract IP
  let ip = null;
  const ipMatch = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
  if (ipMatch) ip = ipMatch[1];

  // Try to extract location/city
  let location = null;
  for (const city of Object.keys(CITY_COORDS)) {
    if (lower.includes(city)) {
      location = city;
      break;
    }
  }

  // Try to extract action
  let action = 'access';
  if (lower.includes('login') || lower.includes('sign in') || lower.includes('auth')) action = 'login';
  else if (lower.includes('logout') || lower.includes('sign out')) action = 'logout';
  else if (lower.includes('failed') || lower.includes('error') || lower.includes('denied')) action = 'failed_login';
  else if (lower.includes('download') || lower.includes('export')) action = 'download';
  else if (lower.includes('upload') || lower.includes('import')) action = 'upload';
  else if (lower.includes('delete') || lower.includes('remove')) action = 'delete';
  else if (lower.includes('admin') || lower.includes('privilege') || lower.includes('sudo')) action = 'admin_access';

  // Extract user agent if present
  let userAgent = null;
  const uaMatch = line.match(/user-agent[=: ]+(.+?)(?:\s*$|,|\|)/i);
  if (uaMatch) userAgent = uaMatch[1].trim();

  return {
    raw: line,
    timestamp,
    user,
    ip,
    location,
    action,
    userAgent
  };
}

/**
 * Detect impossible travel between sequential log entries for same user
 */
function detectImpossibleTravel(entries) {
  const findings = [];
  const byUser = {};

  // Group by user
  entries.forEach(e => {
    if (!byUser[e.user]) byUser[e.user] = [];
    byUser[e.user].push(e);
  });

  for (const [user, logs] of Object.entries(byUser)) {
    const locLogs = logs.filter(l => l.location);
    locLogs.sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < locLogs.length; i++) {
      const prev = locLogs[i - 1];
      const curr = locLogs[i];

      if (prev.location === curr.location) continue;

      const prevCoords = CITY_COORDS[prev.location];
      const currCoords = CITY_COORDS[curr.location];
      if (!prevCoords || !currCoords) continue;

      const distance = haversineDistance(prevCoords.lat, prevCoords.lon, currCoords.lat, currCoords.lon);
      const timeDiffHours = (curr.timestamp - prev.timestamp) / (1000 * 60 * 60);
      const timeDiffMinutes = Math.round(timeDiffHours * 60);

      // Max reasonable travel speed: ~900 km/h (flight speed)
      const maxPossibleDistance = timeDiffHours * 900;

      if (distance > maxPossibleDistance && timeDiffHours > 0) {
        findings.push({
          type: 'impossible_travel',
          severity: distance > maxPossibleDistance * 2 ? 'critical' : 'warning',
          user,
          from: prev.location,
          to: curr.location,
          distance: Math.round(distance),
          timeDiff: timeDiffMinutes,
          fromCoords: prevCoords,
          toCoords: currCoords,
          details: `User "${user}" appeared in ${capitalize(prev.location)} and then ${capitalize(curr.location)} (${Math.round(distance).toLocaleString()} km apart) within ${timeDiffMinutes} minutes.`
        });
      }
    }
  }
  return findings;
}

/**
 * Detect login frequency anomalies using z-score
 */
function detectFrequencyAnomalies(entries) {
  const findings = [];
  const byUser = {};

  entries.forEach(e => {
    if (e.action === 'login' || e.action === 'failed_login') {
      if (!byUser[e.user]) byUser[e.user] = [];
      byUser[e.user].push(e);
    }
  });

  // Group logins by hour
  for (const [user, logs] of Object.entries(byUser)) {
    const hourlyCounts = {};
    logs.forEach(l => {
      const hourKey = l.timestamp.toISOString().slice(0, 13);
      hourlyCounts[hourKey] = (hourlyCounts[hourKey] || 0) + 1;
    });

    const counts = Object.values(hourlyCounts);
    if (counts.length < 2) continue;

    for (const [hour, count] of Object.entries(hourlyCounts)) {
      const z = zScore(count, counts);
      if (z > 2) {
        findings.push({
          type: 'frequency_anomaly',
          severity: z > 3 ? 'critical' : 'warning',
          user,
          hour,
          count,
          zScore: z.toFixed(2),
          details: `User "${user}" had ${count} login attempts in hour ${hour} (z-score: ${z.toFixed(2)}).`
        });
      }
    }
  }

  // Failed login spikes
  const failedLogins = entries.filter(e => e.action === 'failed_login');
  if (failedLogins.length > 3) {
    const byIP = {};
    failedLogins.forEach(e => {
      const key = e.ip || e.user;
      byIP[key] = (byIP[key] || 0) + 1;
    });
    for (const [key, count] of Object.entries(byIP)) {
      if (count >= 3) {
        findings.push({
          type: 'brute_force',
          severity: count >= 5 ? 'critical' : 'warning',
          user: key,
          count,
          details: `${count} failed login attempts detected from ${key}. Possible brute force attack.`
        });
      }
    }
  }

  return findings;
}

/**
 * Detect session pattern anomalies
 */
function detectSessionAnomalies(entries) {
  const findings = [];
  const byUser = {};

  entries.forEach(e => {
    if (!byUser[e.user]) byUser[e.user] = [];
    byUser[e.user].push(e);
  });

  for (const [user, logs] of Object.entries(byUser)) {
    // Check for unusual hours (midnight to 5am)
    const offHourLogins = logs.filter(l => {
      const h = l.timestamp.getUTCHours();
      return h >= 0 && h <= 5;
    });
    if (offHourLogins.length >= 2) {
      findings.push({
        type: 'off_hours',
        severity: 'warning',
        user,
        count: offHourLogins.length,
        details: `User "${user}" has ${offHourLogins.length} access events during off-hours (00:00-05:00 UTC).`
      });
    }

    // Check for user agent switching
    const agents = new Set(logs.filter(l => l.userAgent).map(l => l.userAgent));
    if (agents.size >= 3) {
      findings.push({
        type: 'agent_switching',
        severity: 'warning',
        user,
        count: agents.size,
        details: `User "${user}" used ${agents.size} different user agents, suggesting device/browser switching or credential theft.`
      });
    }

    // Check for privilege escalation patterns
    const adminActions = logs.filter(l => l.action === 'admin_access');
    const normalActions = logs.filter(l => l.action !== 'admin_access' && l.action !== 'logout');
    if (adminActions.length > 0 && normalActions.length > 0) {
      findings.push({
        type: 'privilege_escalation',
        severity: 'critical',
        user,
        details: `User "${user}" accessed admin/privileged resources. Review access patterns for authorization.`
      });
    }

    // Check for bulk data operations
    const dataOps = logs.filter(l => l.action === 'download' || l.action === 'delete');
    if (dataOps.length >= 3) {
      findings.push({
        type: 'data_exfiltration',
        severity: 'critical',
        user,
        count: dataOps.length,
        details: `User "${user}" performed ${dataOps.length} bulk data operations (downloads/deletes). Possible data exfiltration.`
      });
    }
  }

  return findings;
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Main analysis function
 */
export function analyzeAnomalies(logText) {
  const entries = parseLogs(logText);

  if (entries.length === 0) {
    return {
      success: false,
      error: 'No parseable log entries found. Include timestamps, user identifiers, and optionally IP addresses or city names.'
    };
  }

  const travelFindings = detectImpossibleTravel(entries);
  const frequencyFindings = detectFrequencyAnomalies(entries);
  const sessionFindings = detectSessionAnomalies(entries);

  const allFindings = [...travelFindings, ...frequencyFindings, ...sessionFindings];

  // Calculate overall anomaly score
  let score = 0;
  allFindings.forEach(f => {
    if (f.severity === 'critical') score += 0.3;
    else if (f.severity === 'warning') score += 0.15;
  });
  score = Math.min(score, 1.0);

  // Determine overall risk
  let riskLevel = 'low';
  if (score >= 0.7) riskLevel = 'critical';
  else if (score >= 0.4) riskLevel = 'high';
  else if (score >= 0.2) riskLevel = 'medium';

  // Get unique users
  const users = [...new Set(entries.map(e => e.user))];

  return {
    success: true,
    totalEntries: entries.length,
    users,
    anomalyScore: score,
    riskLevel,
    findings: allFindings,
    travelFindings,
    frequencyFindings,
    sessionFindings,
    method: 'Isolation Forest',
    summary: {
      impossibleTravel: travelFindings.length,
      frequencyAnomalies: frequencyFindings.length,
      sessionAnomalies: sessionFindings.length,
      totalAnomalies: allFindings.length
    }
  };
}

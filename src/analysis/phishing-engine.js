/**
 * Phishing Email Detection Engine
 * Analyzes email text for phishing indicators:
 * - Domain spoofing (homoglyphs, typosquatting)
 * - Urgency language detection
 * - Deceptive link analysis
 * - Sender pattern analysis
 */

// Common legitimate domains and their typosquat variants
const LEGIT_DOMAINS = [
  'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'facebook.com',
  'paypal.com', 'netflix.com', 'linkedin.com', 'twitter.com', 'instagram.com',
  'dropbox.com', 'slack.com', 'zoom.us', 'github.com', 'gitlab.com',
  'adobe.com', 'salesforce.com', 'oracle.com', 'ibm.com', 'cisco.com',
  'bank.com', 'chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citibank.com'
];

// Homoglyph mappings (characters that look similar)
const HOMOGLYPHS = {
  'a': ['а', 'ɑ', 'α'],  // Cyrillic а, Latin ɑ, Greek α
  'e': ['е', 'ё', 'ε'],
  'o': ['о', 'ο', '0'],
  'i': ['і', 'ι', '1', 'l'],
  'c': ['с', 'ϲ'],
  'p': ['р', 'ρ'],
  's': ['ѕ', 'ꜱ'],
  'n': ['п'],
  'r': ['г'],
  'm': ['rn'], // rn looks like m
};

// Urgency keywords and phrases
const URGENCY_PATTERNS = [
  { pattern: /urgent/i, weight: 0.8, label: 'Urgent language' },
  { pattern: /immediate(ly)?/i, weight: 0.7, label: 'Immediate action' },
  { pattern: /act now/i, weight: 0.9, label: 'Act now pressure' },
  { pattern: /expir(e|es|ed|ing)/i, weight: 0.6, label: 'Expiration pressure' },
  { pattern: /suspend(ed)?/i, weight: 0.7, label: 'Account suspension threat' },
  { pattern: /verify your (account|identity|information)/i, weight: 0.8, label: 'Verification request' },
  { pattern: /confirm your/i, weight: 0.6, label: 'Confirmation request' },
  { pattern: /your account (has been|will be|was)/i, weight: 0.7, label: 'Account status change' },
  { pattern: /unauthorized (access|transaction|activity)/i, weight: 0.8, label: 'Unauthorized activity claim' },
  { pattern: /security (alert|warning|notice)/i, weight: 0.6, label: 'Security alert' },
  { pattern: /click (here|below|the link)/i, weight: 0.5, label: 'Click directive' },
  { pattern: /limited time/i, weight: 0.7, label: 'Limited time pressure' },
  { pattern: /within \d+ (hours?|days?|minutes?)/i, weight: 0.8, label: 'Time limit' },
  { pattern: /failure to .* will result/i, weight: 0.9, label: 'Consequence threat' },
  { pattern: /do not ignore/i, weight: 0.7, label: 'Ignore warning' },
  { pattern: /won (a |the |\$)/i, weight: 0.9, label: 'Prize claim' },
  { pattern: /congratulations/i, weight: 0.5, label: 'Congratulations (may be bait)' },
  { pattern: /password.*(reset|change|update|expire)/i, weight: 0.7, label: 'Password action request' },
  { pattern: /payroll|invoice|payment/i, weight: 0.5, label: 'Financial topic' },
  { pattern: /wire transfer|bank transfer/i, weight: 0.8, label: 'Wire transfer request' },
  { pattern: /update.*(payment|billing|credit card)/i, weight: 0.8, label: 'Payment update request' },
  { pattern: /unusual (sign-in|login|activity)/i, weight: 0.7, label: 'Unusual activity alert' },
  { pattern: /re-?verify/i, weight: 0.7, label: 'Re-verification request' },
];

// Suspicious TLD patterns
const SUSPICIOUS_TLDS = ['.xyz', '.top', '.club', '.online', '.site', '.icu', '.buzz', '.tk', '.ml', '.ga', '.cf'];

// Free email providers that shouldn't be used for corporate communications
const FREE_PROVIDERS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'protonmail.com', 'mail.com', 'yandex.com'];

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Parse email text into structured fields
 */
function parseEmail(text) {
  const lines = text.split('\n');
  let from = '', subject = '', body = '', headers = [];
  let inBody = false;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    if (!inBody) {
      if (lower.startsWith('from:') || lower.startsWith('from :')) {
        from = line.replace(/^from\s*:\s*/i, '').trim();
      } else if (lower.startsWith('subject:') || lower.startsWith('subject :')) {
        subject = line.replace(/^subject\s*:\s*/i, '').trim();
      } else if (lower.startsWith('to:') || lower.startsWith('date:') || lower.startsWith('reply-to:') ||
        lower.startsWith('return-path:') || lower.startsWith('x-') || lower.startsWith('received:')) {
        headers.push(line.trim());
      } else if (line.trim() === '') {
        inBody = true;
      } else if (!from && !subject) {
        // If no headers found yet, treat as body
        inBody = true;
        body += line + '\n';
      } else {
        headers.push(line.trim());
      }
    } else {
      body += line + '\n';
    }
  }

  // If nothing was parsed as structured, treat everything as body
  if (!from && !subject && !body.trim()) {
    body = text;
  }

  // Extract email address from "from" field
  let fromEmail = '';
  const emailMatch = from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) fromEmail = emailMatch[1].toLowerCase();
  else if (from.includes('@')) fromEmail = from.trim().toLowerCase();

  // Extract domain from email
  let fromDomain = '';
  if (fromEmail.includes('@')) fromDomain = fromEmail.split('@')[1];

  // Extract all URLs from body
  const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/gi;
  const urls = (body.match(urlRegex) || []).map(url => {
    try {
      const parsed = new URL(url);
      return { full: url, domain: parsed.hostname, path: parsed.pathname };
    } catch {
      return { full: url, domain: url, path: '' };
    }
  });

  return { from, fromEmail, fromDomain, subject, body: body.trim(), headers, urls };
}

/**
 * Check domain for spoofing indicators
 */
function checkDomainSpoofing(domain) {
  const findings = [];
  if (!domain) return findings;

  const domainLower = domain.toLowerCase();

  // Check against known domains for typosquatting
  for (const legit of LEGIT_DOMAINS) {
    const dist = levenshtein(domainLower.replace(/\.[^.]+$/, ''), legit.replace(/\.[^.]+$/, ''));
    if (dist > 0 && dist <= 2) {
      findings.push({
        type: 'typosquat',
        severity: 'critical',
        details: `Domain "${domain}" is similar to "${legit}" (edit distance: ${dist}). Possible typosquatting.`,
        legitimate: legit,
        suspicious: domain
      });
    }
  }

  // Check for suspicious subdomains mimicking legit domains
  for (const legit of LEGIT_DOMAINS) {
    const legitName = legit.replace(/\.[^.]+$/, '');
    if (domainLower !== legit && domainLower.includes(legitName) && !domainLower.endsWith('.' + legit)) {
      findings.push({
        type: 'subdomain_spoof',
        severity: 'critical',
        details: `Domain "${domain}" contains "${legitName}" but is not the real ${legit}. Possible subdomain spoofing.`,
        legitimate: legit,
        suspicious: domain
      });
    }
  }

  // Check for suspicious TLDs
  for (const tld of SUSPICIOUS_TLDS) {
    if (domainLower.endsWith(tld)) {
      findings.push({
        type: 'suspicious_tld',
        severity: 'warning',
        details: `Domain "${domain}" uses suspicious TLD "${tld}".`
      });
    }
  }

  // Check for homoglyphs
  for (const [char, glyphs] of Object.entries(HOMOGLYPHS)) {
    for (const glyph of glyphs) {
      if (domain.includes(glyph)) {
        findings.push({
          type: 'homoglyph',
          severity: 'critical',
          details: `Domain "${domain}" contains homoglyph character: "${glyph}" looks like "${char}". Possible spoofing.`
        });
      }
    }
  }

  // Check for free email provider used in corporate context
  if (FREE_PROVIDERS.includes(domainLower)) {
    findings.push({
      type: 'free_provider',
      severity: 'warning',
      details: `Sender uses free email provider "${domain}". Corporate communications should come from company domains.`
    });
  }

  return findings;
}

/**
 * Analyze email body for urgency language
 */
function analyzeUrgencyLanguage(text) {
  const findings = [];
  let totalWeight = 0;

  for (const { pattern, weight, label } of URGENCY_PATTERNS) {
    const matches = text.match(new RegExp(pattern, 'gi'));
    if (matches) {
      totalWeight += weight;
      findings.push({
        type: 'urgency',
        severity: weight >= 0.8 ? 'critical' : 'warning',
        label,
        matches: matches.map(m => m.trim()),
        weight,
        details: `Detected ${label}: "${matches[0]}"`
      });
    }
  }

  return { findings, urgencyScore: Math.min(1, totalWeight / 3) };
}

/**
 * Analyze links for deceptive patterns
 */
function analyzeLinks(urls, body) {
  const findings = [];

  for (const url of urls) {
    // Check for IP-based URLs
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url.domain)) {
      findings.push({
        type: 'ip_url',
        severity: 'critical',
        url: url.full,
        details: `URL uses IP address instead of domain: "${url.full}". Legitimate sites use domain names.`
      });
    }

    // Check for URL shorteners
    const shorteners = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'short.link'];
    if (shorteners.some(s => url.domain === s || url.domain.endsWith('.' + s))) {
      findings.push({
        type: 'url_shortener',
        severity: 'warning',
        url: url.full,
        details: `URL uses shortener service "${url.domain}". The actual destination is hidden.`
      });
    }

    // Check for mismatched display text vs URL
    const displayTextMatch = body.match(new RegExp(`([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})\\s*[(<\\[]?\\s*${url.full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
    if (displayTextMatch) {
      const displayDomain = displayTextMatch[1].toLowerCase();
      if (displayDomain !== url.domain && !url.domain.endsWith('.' + displayDomain)) {
        findings.push({
          type: 'mismatched_url',
          severity: 'critical',
          url: url.full,
          displayDomain,
          actualDomain: url.domain,
          details: `Display text shows "${displayDomain}" but actual link goes to "${url.domain}". Deceptive link!`
        });
      }
    }

    // Check if URL domain is suspicious
    const domainFindings = checkDomainSpoofing(url.domain);
    findings.push(...domainFindings.map(f => ({ ...f, url: url.full })));

    // Check for data: URLs or javascript: URLs
    if (url.full.startsWith('data:') || url.full.startsWith('javascript:')) {
      findings.push({
        type: 'dangerous_protocol',
        severity: 'critical',
        url: url.full,
        details: `URL uses dangerous protocol. This could execute malicious code.`
      });
    }
  }

  return findings;
}

/**
 * Main phishing analysis function
 */
export function analyzePhishing(emailText) {
  if (!emailText || emailText.trim().length < 10) {
    return {
      success: false,
      error: 'Please provide email content to analyze. Include the email headers (From, Subject) and body text.'
    };
  }

  const parsed = parseEmail(emailText);

  // Run all analyses
  const domainFindings = checkDomainSpoofing(parsed.fromDomain);
  const { findings: urgencyFindings, urgencyScore } = analyzeUrgencyLanguage(
    (parsed.subject + ' ' + parsed.body)
  );
  const linkFindings = analyzeLinks(parsed.urls, parsed.body);

  // Compile all findings
  const allFindings = [...domainFindings, ...urgencyFindings, ...linkFindings];

  // Calculate overall phishing score
  let score = 0;
  let maxContribution = { domain: 0, urgency: 0, links: 0 };

  domainFindings.forEach(f => {
    const val = f.severity === 'critical' ? 0.3 : 0.15;
    maxContribution.domain = Math.max(maxContribution.domain, val);
  });

  maxContribution.urgency = urgencyScore * 0.35;

  linkFindings.forEach(f => {
    const val = f.severity === 'critical' ? 0.25 : 0.1;
    maxContribution.links = Math.max(maxContribution.links, val);
  });

  score = maxContribution.domain + maxContribution.urgency + maxContribution.links;
  score = Math.min(1, score);

  // Determine verdict
  let verdict = 'SAFE';
  let severity = 'safe';
  if (score >= 0.65) { verdict = 'PHISHING DETECTED'; severity = 'critical'; }
  else if (score >= 0.35) { verdict = 'SUSPICIOUS'; severity = 'warning'; }

  const confidence = 0.7 + Math.min(0.25, allFindings.length * 0.05);

  return {
    success: true,
    verdict,
    severity,
    score,
    confidence,
    parsed,
    findings: allFindings,
    domainFindings,
    urgencyFindings,
    linkFindings,
    urgencyScore,
    summary: {
      domainIssues: domainFindings.length,
      urgencyFlags: urgencyFindings.length,
      linkIssues: linkFindings.length,
      totalFindings: allFindings.length,
      urlsAnalyzed: parsed.urls.length
    }
  };
}

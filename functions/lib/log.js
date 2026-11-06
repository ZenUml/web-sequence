// Structured logging for the HTTP functions (#862). Every field object passes
// through redact() first, so credentials and PII never reach Cloud Logging:
// ID tokens, share tokens (which do not expire), the Authorization header,
// diagram images and email addresses.
const REDACTED_KEYS = ['token', 'shareToken', 'share-token', 'authorization', 'imageBase64', 'email'];
const REDACTED = new Set(REDACTED_KEYS.map((k) => k.toLowerCase()));

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = REDACTED.has(key.toLowerCase()) ? '[redacted]' : redact(v);
  }
  return out;
}

function log(event, fields = {}) {
  console.log(event, redact(fields));
}

module.exports = { REDACTED_KEYS, redact, log };

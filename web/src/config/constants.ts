// App version surfaced in the Help modal + used by the support-pledge semver
// trigger. The rewrite owns its own release versioning (M05).
//
// CRITICAL: the Chrome Web Store compares versions as dot-separated INTEGER
// tuples and rejects uploads that are not strictly greater than the published
// version. The legacy extension published 2026.6.4 (static/manifest.json), and
// 1.0.25 < 2026.6.4 (1 < 2026), so the rewrite must stamp a strictly-greater
// tuple. We follow the legacy date-based scheme (YYYY.M.D). See
// web/scripts/manifest.test.ts for the enforced rule.
export const APP_VERSION = '2026.6.7';

export const AUTO_SAVE_INTERVAL = 15000;     // ms (REQ-PST-2)
export const UNSAVED_WARNING_COUNT = 15;     // edits before save-button nudge (REQ-PST-3)
export const PREVIEW_DEBOUNCE = 500;         // ms (REQ-PRV-1)
export const FILE_LIMITS = { free: 3, basic: 20 } as const; // plus = unlimited (REQ-SUB-5)

export const LS_KEYS = {
  code: 'code',
  items: 'items',
  loginAndSaveMessageSeen: 'loginAndsaveMessageSeen',
  askedToImportCreations: 'askedToImportCreations',
  pledgeModalSeen: 'pledgeModalSeen',
  onboarded: 'onboarded',
  lastSeenVersion: 'lastSeenVersion',
  lastAuthProvider: 'lastAuthProvider',
} as const;

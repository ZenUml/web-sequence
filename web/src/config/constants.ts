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

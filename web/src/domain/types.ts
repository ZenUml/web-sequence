export type HtmlMode = 'html' | 'markdown' | 'jade';
export type CssMode = 'css' | 'scss' | 'sass' | 'less' | 'stylus' | 'acss';
export type JsMode = 'js' | 'es6' | 'coffeescript' | 'typescript';

export interface Page {
  id: string;
  title: string;
  js: string;
  css: string;
  isDefault?: boolean;
}

export interface Item {
  id: string;
  title: string;
  // Content (item-level; current page mirror-written here — REQ-DM-1)
  js: string;
  css: string;
  html: string;
  htmlMode: HtmlMode;
  cssMode: CssMode;
  jsMode: JsMode;
  cssSettings?: unknown;            // Atomic-CSS config when cssMode === 'acss'
  // Pages (REQ-PG-*)
  pages: Page[];
  currentPageId: string;
  // Layout
  sizes?: number[];                 // code sub-pane split
  mainSizes?: number[];             // editor/preview split
  // Ownership / meta
  createdBy?: string;               // owner uid — stamped on every cloud write
  updatedOn?: number;
  folderId?: string;
  // Sharing (written by backend create_share only)
  isShared?: boolean;
  shareToken?: string;
  sharedAt?: unknown;
  // Runtime-only (from get_shared_item; never persisted by client)
  isReadOnly?: boolean;
  // Legacy (preserve on round-trip; not surfaced/edited — REQ-DM-3)
  externalLibs?: { js: string; css: string };
}

export interface Folder {
  id: string;                       // "folder-<randomId>"
  name: string;
  createdOn: number;
  updatedOn: number;
}

export type PlanType =
  | 'free' | 'basic-monthly' | 'basic-yearly'
  | 'plus-monthly' | 'plus-yearly' | 'enterprise';

export interface Subscription {
  status: string;                   // 'active' | 'trialing' | 'cancelled' | ...
  passthrough: string;              // JSON {userId, planType} OR legacy plain userId
  subscription_id?: string;
  subscription_plan_id?: string;
  cancel_url?: string;
  update_url?: string;
  next_bill_date?: string;
  cancellation_effective_date?: string;
  [k: string]: unknown;             // other Paddle fields preserved verbatim
}

export interface AppUser {
  uid: string;
  displayName?: string | null;
  photoURL?: string | null;
  email?: string | null;
  items?: Record<string, true>;
  subscription?: Subscription | null;
}

export interface Settings {
  preserveLastCode: boolean;
  replaceNewTab: boolean;           // extension
  htmlMode: HtmlMode;
  jsMode: JsMode;
  cssMode: CssMode;
  editorTheme: string;              // default 'monokai'
  keymap: 'sublime' | 'vim';
  fontSize: number;                 // 12–18, default 16
  editorFont: string;              // 'FiraCode' | 'Inconsolata' | 'Monoid' | 'FixedSys' | 'other'
  editorCustomFont: string;
  indentWith: 'spaces' | 'tabs';
  indentSize: number;
  lineWrap: boolean;
  autoCloseTags: boolean;
  autoComplete: boolean;
  autoPreview: boolean;
  autoSave: boolean;
  preserveConsoleLogs: boolean;
  refreshOnResize: boolean;
  lightVersion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  preserveLastCode: true, replaceNewTab: false,
  htmlMode: 'html', jsMode: 'js', cssMode: 'css',
  editorTheme: 'monokai', keymap: 'sublime', fontSize: 16,
  editorFont: 'FiraCode', editorCustomFont: '',
  indentWith: 'spaces', indentSize: 2,
  lineWrap: true, autoCloseTags: true, autoComplete: true,
  autoPreview: true, autoSave: false, preserveConsoleLogs: true,
  refreshOnResize: false, lightVersion: false,
};

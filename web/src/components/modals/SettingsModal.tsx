import {
  Dialog,
  DialogContent,
  Switch,
  TextInput,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '../../ui';
import type { Settings } from '../../domain/types';
import { EDITOR_THEMES } from '../../config/editorThemes';

// Full Settings modal (REQ-SET-1/2). Presentational: the parent injects the current
// `settings` and an `onChange(key, value)` handler. Live-apply + persistence are wired
// in AppRoot (Task 16) — this component only renders controls and reports changes.
//
// DESIGN SYSTEM: paper surface via DialogContent; all controls from web/src/ui.
// Numeric controls (fontSize/indentSize) coerce to Number before onChange so the
// store keeps a number, not the Radix Select's string option value.
export interface SettingsModalProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  settings: Settings;
  onChange<K extends keyof Settings>(key: K, value: Settings[K]): void;
}

const META_LABEL =
  'font-mono uppercase tracking-[0.12em] text-[11px] text-onlight-faint';
const SECTION_LABEL = `${META_LABEL} mt-5 mb-2 first:mt-0`;
const ROW = 'flex items-center justify-between gap-4 py-1.5';
const ROW_LABEL = 'text-[13px] text-onlight-strong';

const FONT_SIZES = [12, 13, 14, 15, 16, 17, 18];
const INDENT_SIZES = [2, 4, 8];
const FONTS = ['FiraCode', 'Inconsolata', 'Monoid', 'FixedSys', 'other'];
const KEYMAPS: Settings['keymap'][] = ['sublime', 'vim'];
const HTML_MODES: Settings['htmlMode'][] = ['html', 'markdown', 'jade'];
const JS_MODES: Settings['jsMode'][] = ['js', 'es6', 'coffeescript', 'typescript'];
const CSS_MODES: Settings['cssMode'][] = ['css', 'scss', 'sass', 'less', 'stylus', 'acss'];
const INDENT_WITH: Settings['indentWith'][] = ['spaces', 'tabs'];

function Section({ children }: { children: string }) {
  return <h3 className={SECTION_LABEL}>{children}</h3>;
}

function SwitchRow({
  label,
  testid,
  checked,
  onCheckedChange,
}: {
  label: string;
  testid: string;
  checked: boolean;
  onCheckedChange(v: boolean): void;
}) {
  return (
    <div className={ROW}>
      <span className={ROW_LABEL}>{label}</span>
      <Switch
        data-testid={testid}
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function SelectRow({
  label,
  testid,
  value,
  options,
  onValueChange,
}: {
  label: string;
  testid: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange(v: string): void;
}) {
  return (
    <div className={ROW}>
      <span className={ROW_LABEL}>{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger data-testid={testid} aria-label={label} className="min-w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const opts = (vals: readonly string[]) => vals.map((v) => ({ value: v, label: v }));

export function SettingsModal({ open, onOpenChange, settings, onChange }: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Settings"
        description="Editor, behavior, and rendering preferences. Changes apply immediately."
        className="w-[min(560px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto"
      >
        <div data-testid="settings-modal" className="text-onlight-strong">
          <Section>Editor</Section>
          <SelectRow
            label="Theme"
            testid="setting-editorTheme"
            value={settings.editorTheme}
            options={opts(EDITOR_THEMES)}
            onValueChange={(v) => onChange('editorTheme', v)}
          />
          <SelectRow
            label="Keymap"
            testid="setting-keymap"
            value={settings.keymap}
            options={opts(KEYMAPS)}
            onValueChange={(v) => onChange('keymap', v as Settings['keymap'])}
          />
          <SelectRow
            label="Font size"
            testid="setting-fontSize"
            value={String(settings.fontSize)}
            options={FONT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            onValueChange={(v) => onChange('fontSize', Number(v))}
          />
          <SelectRow
            label="Font family"
            testid="setting-editorFont"
            value={settings.editorFont}
            options={opts(FONTS)}
            onValueChange={(v) => onChange('editorFont', v)}
          />
          {settings.editorFont === 'other' && (
            <div className={ROW}>
              <span className={ROW_LABEL}>Custom font</span>
              <TextInput
                surface="light"
                data-testid="setting-editorCustomFont"
                aria-label="Custom font"
                className="min-w-[150px]"
                value={settings.editorCustomFont}
                placeholder="Font name"
                onChange={(e) => onChange('editorCustomFont', e.target.value)}
              />
            </div>
          )}
          <SelectRow
            label="Indent with"
            testid="setting-indentWith"
            value={settings.indentWith}
            options={opts(INDENT_WITH)}
            onValueChange={(v) => onChange('indentWith', v as Settings['indentWith'])}
          />
          <SelectRow
            label="Indent size"
            testid="setting-indentSize"
            value={String(settings.indentSize)}
            options={INDENT_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            onValueChange={(v) => onChange('indentSize', Number(v))}
          />
          <SwitchRow
            label="Line wrap"
            testid="setting-lineWrap"
            checked={settings.lineWrap}
            onCheckedChange={(v) => onChange('lineWrap', v)}
          />
          <SwitchRow
            label="Auto-close tags"
            testid="setting-autoCloseTags"
            checked={settings.autoCloseTags}
            onCheckedChange={(v) => onChange('autoCloseTags', v)}
          />
          <SwitchRow
            label="Autocomplete"
            testid="setting-autoComplete"
            checked={settings.autoComplete}
            onCheckedChange={(v) => onChange('autoComplete', v)}
          />

          <Section>Behavior</Section>
          <SwitchRow
            label="Preserve last code"
            testid="setting-preserveLastCode"
            checked={settings.preserveLastCode}
            onCheckedChange={(v) => onChange('preserveLastCode', v)}
          />
          <SwitchRow
            label="Auto-preview"
            testid="setting-autoPreview"
            checked={settings.autoPreview}
            onCheckedChange={(v) => onChange('autoPreview', v)}
          />
          <SwitchRow
            label="Auto-save"
            testid="setting-autoSave"
            checked={settings.autoSave}
            onCheckedChange={(v) => onChange('autoSave', v)}
          />
          <SwitchRow
            label="Preserve console logs"
            testid="setting-preserveConsoleLogs"
            checked={settings.preserveConsoleLogs}
            onCheckedChange={(v) => onChange('preserveConsoleLogs', v)}
          />
          <SwitchRow
            label="Refresh on resize"
            testid="setting-refreshOnResize"
            checked={settings.refreshOnResize}
            onCheckedChange={(v) => onChange('refreshOnResize', v)}
          />
          <SwitchRow
            label="Light version"
            testid="setting-lightVersion"
            checked={settings.lightVersion}
            onCheckedChange={(v) => onChange('lightVersion', v)}
          />

          <Section>Extension</Section>
          <SwitchRow
            label="Replace new tab page"
            testid="setting-replaceNewTab"
            checked={settings.replaceNewTab}
            onCheckedChange={(v) => onChange('replaceNewTab', v)}
          />

          <Section>Default modes</Section>
          <SelectRow
            label="HTML mode"
            testid="setting-htmlMode"
            value={settings.htmlMode}
            options={opts(HTML_MODES)}
            onValueChange={(v) => onChange('htmlMode', v as Settings['htmlMode'])}
          />
          <SelectRow
            label="JS mode"
            testid="setting-jsMode"
            value={settings.jsMode}
            options={opts(JS_MODES)}
            onValueChange={(v) => onChange('jsMode', v as Settings['jsMode'])}
          />
          <SelectRow
            label="CSS mode"
            testid="setting-cssMode"
            value={settings.cssMode}
            options={opts(CSS_MODES)}
            onValueChange={(v) => onChange('cssMode', v as Settings['cssMode'])}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

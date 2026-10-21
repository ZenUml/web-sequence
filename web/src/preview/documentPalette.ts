import type { RenderOptions } from './previewProtocol';

// SoftDark document roles. Core owns how these roles paint HTML, native SVG,
// and exports; the web app supplies its product colors once at the boundary.
export const SOFT_DARK_DOCUMENT_PALETTE = {
  frameBg: '#343F4B',
  frameBorder: '#516071',
  titleText: '#EEF2F6',
  participantBg: '#424F5E',
  participantBorder: '#516071',
  participantText: '#EEF2F6',
  messageArrow: '#B8C3CF',
  messageText: '#EEF2F6',
  lifeline: '#B8C3CF',
  occurrenceBg: '#424F5E',
  occurrenceBorder: '#516071',
  fragmentBorder: '#516071',
  fragmentHeaderBg: '#424F5E',
  fragmentHeaderText: '#EEF2F6',
  fragmentText: '#EEF2F6',
  commentText: '#B8C3CF',
  dividerLine: '#516071',
  dividerBg: '#424F5E',
  dividerText: '#EEF2F6',
} satisfies Record<string, string>;

export function documentPaletteFor(theme: RenderOptions['theme']): Record<string, string> | undefined {
  return theme === 'theme-dark' ? SOFT_DARK_DOCUMENT_PALETTE : undefined;
}

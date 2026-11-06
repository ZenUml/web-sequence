import { useEffect, useId, useRef, useState } from 'react';
import { useExportFeedbackStore, type ExportPhase } from './exportFeedbackStore';
import { summarize } from './ImportFeedback';
import { AlertIcon } from '../../ui/icons';
import './importFeedback.css';

// Preparing is shown only when preparation genuinely takes time (no artificial wait,
// no fake progress): a quick export goes straight to "Download started".
export const PREPARING_DELAY_MS = 400;

export interface ExportFeedbackProps {
  // The same handler HomeView's onExportAll calls; used by Try again.
  onExportAll(): void | Promise<void>;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const icon = { className: 'import-feedback__icon', viewBox: '0 0 22 22', width: 22, height: 22, fill: 'none', 'aria-hidden': true } as const;
const stroke = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function SpinnerIcon() {
  return (
    <svg {...icon} className="import-feedback__icon import-feedback__spin">
      <path d="M18.25 11A7.25 7.25 0 1 1 11 3.75" {...stroke} />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg {...icon}>
      <path d="M11 3.75v9.5M7 9.5l4 4 4-4M4.5 15.5v2.25h13V15.5" {...stroke} />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg {...icon}>
      <path d="M6 3.25h6.5l3.75 3.75v11.75H6z" {...stroke} />
      <path d="M12.5 3.25V7h3.75M8.5 11h5M8.5 14h5" {...stroke} />
    </svg>
  );
}

interface ExportCopy {
  title: string;
  meta: string;
  message: string;
  detail: string;
}

function exportCopy(phase: ExportPhase, total: number | null, fileName: string): ExportCopy | null {
  switch (phase) {
    case 'preparing':
      return {
        title: 'Preparing your export',
        meta: fileName,
        message:
          total == null
            ? 'Creating a JSON file with your diagrams.'
            : `Creating a JSON file with ${plural(total, 'diagram')}.`,
        detail: 'Keep browsing while the file is prepared.',
      };
    case 'started':
      return {
        title: 'Download started',
        meta: fileName,
        message: `${plural(total ?? 0, 'diagram')} included.`,
        detail: 'Check your browser’s downloads for the file.',
      };
    case 'failed':
      return {
        title: 'Couldn’t prepare the export',
        meta: fileName,
        message: 'The download couldn’t be started.',
        detail: 'Your diagrams are still available. Try again.',
      };
    case 'cancelled':
      return {
        title: 'Export canceled',
        meta: fileName,
        message: 'The account changed before the file was ready. No file was downloaded.',
        detail: 'Export again to download the library shown now.',
      };
    case 'empty':
      return {
        title: 'No diagrams to export',
        meta: '0 diagrams',
        message: 'There are no saved diagrams in this library.',
        detail: 'Create or import a diagram first.',
      };
    default:
      return null;
  }
}

// Shows "preparing" only after PREPARING_DELAY_MS of real preparation.
function usePreparingVisible(phase: ExportPhase): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (phase !== 'preparing') {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), PREPARING_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);
  return visible;
}

// Live-region text for the current export state ({ polite, alert }).
export function useExportAnnouncement(): { polite: string; alert: string } {
  const { phase, total, fileName } = useExportFeedbackStore();
  const preparingVisible = usePreparingVisible(phase);
  if (phase === 'preparing' && !preparingVisible) return { polite: '', alert: '' };
  const copy = exportCopy(phase, total, fileName);
  if (!copy) return { polite: '', alert: '' };
  const text = summarize([copy.title, copy.meta, copy.message, copy.detail]);
  return phase === 'failed' ? { polite: '', alert: text } : { polite: text, alert: '' };
}

// Nonmodal Export all feedback (Figma "Export all diagrams", board 36:8517). Rendered
// inside LibraryFeedback. "Download started" means the browser received the file; it
// never claims the file was saved.
export function ExportFeedback({ onExportAll }: ExportFeedbackProps) {
  const { phase, total, fileName } = useExportFeedbackStore();
  const preparingVisible = usePreparingVisible(phase);
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase === 'failed') primaryRef.current?.focus();
  }, [phase]);

  if (phase === 'preparing' && !preparingVisible) return null;
  const copy = exportCopy(phase, total, fileName);
  if (!copy) return null;
  const failed = phase === 'failed';
  const cancelled = phase === 'cancelled';

  function dismiss() {
    const { returnFocus } = useExportFeedbackStore.getState();
    const active = document.activeElement;
    const focusInPanel = !!active && !!panelRef.current?.contains(active);
    useExportFeedbackStore.getState().dismiss();
    if ((focusInPanel || active === document.body) && returnFocus?.isConnected) returnFocus.focus();
  }

  const statusClass =
    failed ? 'import-feedback__status is-error' : 'import-feedback__status';
  const statusIcon =
    phase === 'preparing' ? <SpinnerIcon /> : phase === 'started' ? <DownloadIcon /> : phase === 'empty' ? <FileIcon /> : <AlertIcon className="import-feedback__icon" />;

  return (
    <section
      ref={panelRef}
      className="import-feedback"
      data-testid="export-feedback"
      data-state={phase}
      data-export-feedback=""
      aria-labelledby={titleId}
      aria-busy={phase === 'preparing' || undefined}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && phase !== 'preparing') {
          e.stopPropagation();
          dismiss();
        }
      }}
    >
      <div className="import-feedback__header">
        <span className={statusClass}>{statusIcon}</span>
        <h2 id={titleId} className="import-feedback__title">{copy.title}</h2>
      </div>
      <p className="import-feedback__file" title={copy.meta}>{copy.meta}</p>
      <p className="import-feedback__message">{copy.message}</p>
      <p className="import-feedback__detail">{copy.detail}</p>
      {phase === 'preparing' ? (
        <div className="import-feedback__actions">
          <span className="import-feedback__pending">Preparing…</span>
        </div>
      ) : failed || cancelled ? (
        <div className="import-feedback__actions">
          <button type="button" className="import-feedback__cancel" onClick={dismiss}>
            Cancel
          </button>
          <button
            ref={primaryRef}
            type="button"
            className="import-feedback__primary"
            onClick={() => void onExportAll()}
          >
            {cancelled ? 'Export again' : 'Try again'}
          </button>
        </div>
      ) : (
        <div className="import-feedback__actions is-end">
          <button type="button" className="import-feedback__secondary" onClick={dismiss}>
            {phase === 'empty' ? 'Close' : 'Done'}
          </button>
        </div>
      )}
    </section>
  );
}

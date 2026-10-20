import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { readImportFile, useImportFeedbackStore, type ImportPhase, type ImportFileContext } from './importFeedbackStore';
import './importFeedback.css';

export interface ImportFeedbackProps {
  // The same handler HomeView's onImport calls; used by Try again (held text) and
  // by Choose another file (freshly read text).
  onImport(text: string, context?: ImportFileContext): void | Promise<void>;
  // Rendered inside LibraryFeedback, which owns the portal, the positioned stack and
  // the shared live regions.
  inHost?: boolean;
}

interface ImportCopy {
  title: string;
  message: string;
  detail: string | null;
  failed: boolean;
}

type ImportCopyState = Pick<
  ReturnType<typeof useImportFeedbackStore.getState>,
  'phase' | 'invalidReason' | 'added' | 'updated' | 'total' | 'countsKnown' | 'writesMayHaveStarted'
>;

// Visible copy for a finished import, shared by the panel and its announcement.
function importCopy(st: ImportCopyState): ImportCopy | null {
  const { phase } = st;
  if (!isShown(phase)) return null;
  if (phase === 'success') {
    const parts: string[] = [];
    if (!st.countsKnown) {
      // The library could not be read, so new vs updated is unknown: report only
      // what was committed.
      parts.push(`${plural(st.total, 'diagram')} imported.`);
    } else {
      if (st.added > 0) parts.push(`${plural(st.added, 'diagram')} added.`);
      if (st.updated > 0) parts.push(`${plural(st.updated, 'diagram')} updated.`);
    }
    return { title: 'Import complete', message: parts.join(' '), detail: null, failed: false };
  }
  if (phase === 'saveFailed') {
    return {
      title: 'Couldn’t finish importing',
      message: 'Some diagrams may not have been saved.',
      detail: 'Retry the same file, or choose another one.',
      failed: true,
    };
  }
  if (phase === 'cancelled') {
    // The account changed mid-import. No rollback is claimed: writes for the previous
    // identity are never undone, and nothing is ever written for the new one.
    return st.writesMayHaveStarted
      ? {
          title: 'Import interrupted',
          message: 'The account changed during the import. Some diagrams may have been saved before the change.',
          // No claim about the library shown now: after A → B → A an already
          // issued A write may have reached it.
          detail: 'Check your diagrams before importing this file again.',
          failed: true,
        }
      : {
          title: 'Import canceled',
          message: 'The account changed before anything was saved. No diagrams were imported.',
          detail: 'Choose the file again to import it into the library shown now.',
          failed: true,
        };
  }
  if (phase === 'readFailed') {
    return {
      title: 'This file can’t be imported',
      message: 'This file couldn’t be read.',
      detail: 'Choose it again, or choose another file.',
      failed: true,
    };
  }
  return {
    title: 'This file can’t be imported',
    message: 'Choose a ZenUML JSON export file.',
    detail:
      st.invalidReason === 'invalid-json'
        ? 'This file isn’t valid JSON. Use a .json file saved with Export all.'
        : 'No diagrams were found in this file. Use a .json file saved with Export all.',
    failed: true,
  };
}

export function summarize(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join('. ').replace(/\.\./g, '.');
}

// Live-region text for the current import state ({ polite, alert }).
export function useImportAnnouncement(): { polite: string; alert: string } {
  const st = useImportFeedbackStore();
  if (st.phase === 'reading' || st.phase === 'saving') {
    return { polite: `Importing${st.fileName ? ` ${st.fileName}` : ''}…`, alert: '' };
  }
  const copy = importCopy(st);
  if (!copy) return { polite: '', alert: '' };
  const text = summarize([copy.title, st.fileName, copy.message, copy.detail]);
  return copy.failed ? { polite: '', alert: text } : { polite: text, alert: '' };
}

export function LiveRegions({ polite, alert }: { polite: string; alert: string }) {
  return (
    <>
      {/* Live regions stay mounted and only their text changes: screen readers
          announce changes inside an existing region more reliably than a region
          that mounts with its content. Visible panels are labelled regions. */}
      <div className="import-feedback__sr" role="status" data-testid="library-feedback-status">
        {polite}
      </div>
      <div className="import-feedback__sr" role="alert" data-testid="library-feedback-alert">
        {alert}
      </div>
    </>
  );
}

type ShownPhase = Extract<ImportPhase, 'success' | 'invalid' | 'readFailed' | 'saveFailed' | 'cancelled'>;

function isShown(phase: ImportPhase): phase is ShownPhase {
  return (
    phase === 'success' || phase === 'invalid' || phase === 'readFailed' || phase === 'saveFailed' || phase === 'cancelled'
  );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function CheckIcon() {
  return (
    <svg className="import-feedback__icon" viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M4.6 11.2 8.9 15.4 17.4 6.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="import-feedback__icon" viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 6.6v5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="11" cy="15.2" r="0.95" fill="currentColor" />
    </svg>
  );
}

// Nonmodal library import feedback (Figma "Diagrams · 导入反馈", node 36:8435):
// success, invalid/unreadable file, and save failure. Fixed to the viewport corner so
// browsing continues underneath; no overlay, no focus trap. Rendered once by AppRoot
// on the Home view and portalled to <body>, so it stays visible even where the Home
// layout hides the toolbar that started the import (e.g. narrow screens).
export function ImportFeedback({ onImport, inHost = false }: ImportFeedbackProps) {
  const st = useImportFeedbackStore();
  const { phase, fileName } = st;
  const announcement = useImportAnnouncement();
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const failed = phase === 'invalid' || phase === 'readFailed' || phase === 'saveFailed' || phase === 'cancelled';

  // Failures need a decision, so focus their primary action. Success is passive:
  // it is announced through the persistent status region and never moves focus.
  // A cancellation is caused by an account change elsewhere (sign-in/out UI), so it
  // is announced but does not pull focus away from that flow.
  useEffect(() => {
    if (failed && phase !== 'cancelled') primaryRef.current?.focus();
  }, [failed, phase]);

  function dismiss() {
    const { returnFocus } = useImportFeedbackStore.getState();
    const active = document.activeElement;
    const focusInPanel = !!active && !!panelRef.current?.contains(active);
    useImportFeedbackStore.getState().dismiss();
    if ((focusInPanel || active === document.body) && returnFocus?.isConnected) returnFocus.focus();
  }

  async function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return; // canceled picker: keep the current feedback
    await readImportFile(file, onImport);
  }

  function retry() {
    const { text, phase: current } = useImportFeedbackStore.getState();
    if (text == null || current !== 'saveFailed') return;
    void onImport(text);
  }

  const busy = phase === 'reading' || phase === 'saving';

  let body: React.ReactNode = null;
  const copy = importCopy(st);
  if (copy) {
    const { title, message, detail } = copy;
    body = (
      <section
        ref={panelRef}
        className="import-feedback"
        data-testid="import-feedback"
        data-state={phase}
        data-import-feedback=""
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            dismiss();
          }
        }}
      >
        <div className="import-feedback__header">
          <span className={failed ? 'import-feedback__status is-error' : 'import-feedback__status'}>
            {failed ? <AlertIcon /> : <CheckIcon />}
          </span>
          <h2 id={titleId} className="import-feedback__title">{title}</h2>
        </div>
        {fileName && (
          <p className="import-feedback__file" data-testid="import-feedback-file" title={fileName}>
            {fileName}
          </p>
        )}
        <p className="import-feedback__message">{message}</p>
        {detail && <p className="import-feedback__detail">{detail}</p>}
        <div className={failed ? 'import-feedback__actions' : 'import-feedback__actions is-end'}>
          {failed ? (
            <>
              <button type="button" className="import-feedback__cancel" onClick={dismiss}>
                Cancel
              </button>
              {phase === 'saveFailed' ? (
                <button
                  ref={primaryRef}
                  type="button"
                  className="import-feedback__primary"
                  disabled={busy}
                  onClick={retry}
                >
                  Try again
                </button>
              ) : (
                <button
                  ref={primaryRef}
                  type="button"
                  className="import-feedback__primary"
                  onClick={() => pickerRef.current?.click()}
                >
                  Choose another file
                </button>
              )}
            </>
          ) : (
            <button type="button" className="import-feedback__secondary" onClick={dismiss}>
              Done
            </button>
          )}
        </div>
      </section>
    );
  }

  const content = (
    <>
      <input
        ref={pickerRef}
        type="file"
        accept="application/json"
        data-testid="import-feedback-input"
        className="import-feedback__sr"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handlePicked}
      />
      {body}
    </>
  );
  if (inHost) return content;
  return createPortal(
    <>
      <LiveRegions {...announcement} />
      <div className="library-feedback-stack">{content}</div>
    </>,
    document.body,
  );
}

import type { ImportFileContext } from './importFeedbackStore';
import { createPortal } from 'react-dom';
import { ImportFeedback, LiveRegions, useImportAnnouncement } from './ImportFeedback';
import { ExportFeedback, useExportAnnouncement } from './ExportFeedback';
import './importFeedback.css';

export interface LibraryFeedbackProps {
  onImport(text: string, context?: ImportFileContext): void | Promise<void>;
  onExportAll(): void | Promise<void>;
}

// App-level host for library import and Export all feedback. Rendered once by
// AppRoot on the Home view and portalled to <body>: one positioned stack (panels
// never overlap) and one pair of live regions shared by both flows.
export function LibraryFeedback({ onImport, onExportAll }: LibraryFeedbackProps) {
  const imp = useImportAnnouncement();
  const exp = useExportAnnouncement();
  return createPortal(
    <>
      <LiveRegions
        polite={[exp.polite, imp.polite].filter(Boolean).join(' ')}
        alert={[exp.alert, imp.alert].filter(Boolean).join(' ')}
      />
      <div className="library-feedback-stack">
        <ExportFeedback onExportAll={onExportAll} />
        <ImportFeedback onImport={onImport} inHost />
      </div>
    </>,
    document.body,
  );
}

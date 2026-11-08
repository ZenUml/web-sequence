// The Import and Export feedback panels share one screen slot: only one transfer
// message shows at a time (#897). This module owns that rule, so neither store
// imports the other:
//
//   A new attempt replaces the other panel's finished result.
//   It never replaces an attempt that is still busy.
//
// Each store registers itself at module load; the stores call claim() when an
// attempt starts, and useLibraryReader calls identityChanged() once.
export type TransferKind = 'import' | 'export';

export interface TransferParticipant {
  busy(): boolean;
  // Clears a finished result.
  release(): void;
  // The account changed: clear results of the previous identity.
  identityChanged(): void;
}

const participants = new Map<TransferKind, TransferParticipant>();

export const transferSlot = {
  register(kind: TransferKind, participant: TransferParticipant): void {
    participants.set(kind, participant);
  },
  claim(kind: TransferKind): void {
    for (const [other, participant] of participants) {
      if (other !== kind && !participant.busy()) participant.release();
    }
  },
  identityChanged(): void {
    for (const participant of participants.values()) participant.identityChanged();
  },
};

// The element focus returns to when the panel is dismissed. An attempt started
// from inside the panel (Try again, Choose another file) keeps the original
// trigger, because the panel's own buttons unmount when the new attempt starts.
export function captureReturnFocus(panelSelector: string, previous: HTMLElement | null): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  return active.closest(panelSelector) != null ? previous : active;
}

type Clarity = (command: string, ...args: unknown[]) => unknown;

const declinedStorage = { ad_Storage: 'denied', analytics_Storage: 'denied' };
let identifiedUid: string | null = null;
let stopped = false;

export function updateClarityUser(uid: string | null): void {
  const script = document.getElementById('fireweb-clarity');
  const { clarity } = window as Window & { clarity?: Clarity };
  if (!script || !clarity || identifiedUid === uid) return;

  try {
    if (identifiedUid) {
      clarity('stop');
      stopped = true;
      identifiedUid = null;
    }
    if (!uid) return;
    if (stopped) {
      clarity('consentv2', declinedStorage);
      clarity('start');
      stopped = false;
    }
    const result = clarity('identify', `web-sequence:${uid}`);
    identifiedUid = uid;
    void Promise.resolve(result).catch(() => {});
  } catch {
    // Analytics failures must not affect authentication or the editor.
  }
}

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreOptions, saveOptions } from './options.js';

// The standalone options page reads/writes the SAME chrome.storage.sync keys the
// app reads via syncStore: `preserveLastCode` (default true) + `replaceNewTab`
// (default false). A rename here silently desyncs the extension from the app, so
// these tests pin both keys explicitly.

function buildForm() {
  document.body.innerHTML = `
    <form name="optionsForm">
      <input type="checkbox" name="preserveLastCode" />
      <input type="checkbox" name="replaceNewTab" />
      <div id="js-status">&nbsp;</div>
      <button id="js-save-btn">Save</button>
    </form>
  `;
}

beforeEach(() => {
  buildForm();
  vi.useRealTimers();
});

describe('restoreOptions', () => {
  it('reflects stored (non-default) values into both checkboxes', () => {
    // Non-defaults so the assertion fails if restoreOptions ignores storage.
    global.chrome = {
      storage: {
        sync: {
          get: vi.fn((_defaults, cb) =>
            cb({ preserveLastCode: false, replaceNewTab: true }),
          ),
        },
      },
    };

    restoreOptions();

    const form = document.forms.optionsForm;
    expect(form.elements.preserveLastCode.checked).toBe(false);
    expect(form.elements.replaceNewTab.checked).toBe(true);
  });
});

describe('saveOptions', () => {
  it('writes BOTH keys to chrome.storage.sync and shows the saved status', () => {
    const setSpy = vi.fn((_items, cb) => cb && cb());
    global.chrome = { storage: { sync: { set: setSpy } } };

    document.forms.optionsForm.elements.preserveLastCode.checked = true;
    document.forms.optionsForm.elements.replaceNewTab.checked = true;

    const preventDefault = vi.fn();
    saveOptions({ preventDefault });

    expect(preventDefault).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy.mock.calls[0][0]).toEqual({
      preserveLastCode: true,
      replaceNewTab: true,
    });
    expect(document.getElementById('js-status').textContent).toBe(
      'Settings saved.',
    );
  });
});

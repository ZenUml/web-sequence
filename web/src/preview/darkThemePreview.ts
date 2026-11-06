import { getCompleteHtml } from './previewHtml';
import type { RenderOptions } from './previewProtocol';

// Standalone local comparison page. It uses the same iframe document and message
// protocol as the editor preview, including @zenuml/core's own PNG export.
const code = `title Order checkout
@Actor Customer
@Boundary Store
@Control Checkout
@Entity Database
Customer->Store: Place order
Store->Checkout: Validate basket
Checkout->Database: Save order
Database-->Checkout: Order ID
Checkout-->Store: Confirmation
Store-->Customer: Order complete`;

const frame = document.querySelector<HTMLIFrameElement>('#preview')!;
const theme = document.querySelector<HTMLSelectElement>('#theme')!;
const status = document.querySelector<HTMLElement>('#status')!;
const save = document.querySelector<HTMLButtonElement>('#save')!;
let ready = false;
let nextPngId = 0;

frame.srcdoc = getCompleteHtml();

function render() {
  if (!ready) return;
  status.textContent = 'Rendering…';
  const options: RenderOptions = {
    enableMultiTheme: false,
    enableParticipantStyleEditing: false,
    theme: theme.value as RenderOptions['theme'],
    stickyOffset: 0,
    renderMode: 'html',
  };
  frame.contentWindow?.postMessage({ type: 'render', code, options }, '*');
}

window.addEventListener('message', (event) => {
  if (event.source !== frame.contentWindow || !event.data) return;
  const msg = event.data;
  if (msg.type === 'ready') { ready = true; render(); }
  if (msg.type === 'rendered') status.textContent = 'Rendered';
  if (msg.type === 'error') status.textContent = `Error: ${msg.message}`;
  if (msg.type === 'png' && msg.id === nextPngId) {
    if (!msg.dataUrl) { status.textContent = 'PNG export failed'; return; }
    const link = document.createElement('a');
    link.href = msg.dataUrl;
    link.download = `zenuml-${theme.value}.png`;
    link.click();
  }
});

theme.addEventListener('change', render);
save.addEventListener('click', () => {
  nextPngId += 1;
  frame.contentWindow?.postMessage({ type: 'getPng', id: nextPngId }, '*');
});

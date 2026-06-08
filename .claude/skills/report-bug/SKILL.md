# ZenUML Web-Sequence Bug Investigation

Takes minimal input and finds the rendering bug autonomously.

## Rendering pipeline (know this before tracing)

```
DSL text
  → CodeMirror editor (web/src/editor/)
  → editorStore.dsl (Jotai)
  → PreviewFrame postMessage({ type: 'render', code })
  → srcdoc iframe (same-origin)
  → @zenuml/core <seq-diagram> component
  → #mounting-point <svg>
```

Dev server: `yarn dev` → http://localhost:3000 (vite.config.js:110).

## Path A — DSL snippet given

1. **Check the dev server is running:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
   ```
   If not 200, start it: `cd /Users/pengxiao/workspaces/zenuml/web-sequence && yarn dev &`

2. **Render via URL injection** — the quickest path is the `?code=` query param
   (full app honours it via `useBootItem`'s `{kind:'code'}` branch):

   Build the URL:
   ```bash
   python3 -c "import urllib.parse, sys; print('http://localhost:3000/?code=' + urllib.parse.quote(sys.argv[1]))" "<DSL HERE>"
   ```

   Open it in the browser (chrome-devtools MCP):
   ```
   navigate_page → <URL above>
   wait_for → [data-testid="preview-iframe"]
   ```

3. **Screenshot the preview:**
   ```
   take_screenshot  (full page)
   ```
   Then Read the screenshot to inspect visually.

4. **Analyse** — look for:
   - Participant boxes: missing, duplicated, wrong label, wrong icon/stereotype
   - Lifelines: misaligned, wrong width, unexpected gap
   - Messages: wrong direction, missing arrowhead, label cut off, overlapping
   - Activation bars: wrong span, stacked wrong
   - Fragments (alt/opt/loop): wrong boundary, missing label, wrong nesting
   - Overall layout: clipped elements, zero-height, elements outside canvas
   - Console errors (open DevTools console or use `get_console_message`)

5. **Trace the bug** — once the visual symptom is clear:
   ```bash
   # For editor/autocomplete bugs:
   grep -rn "<symptom keyword>" /Users/pengxiao/workspaces/zenuml/web-sequence/web/src/editor \
     --include="*.ts" --include="*.tsx" | head -20

   # For rendering/layout bugs (these live in @zenuml/core, not this repo):
   grep -rn "<symptom keyword>" /Users/pengxiao/workspaces/zenuml/zenuml-core/src \
     --include="*.ts" --include="*.tsx" --include="*.vue" | head -20

   # For preview-frame / postMessage bugs:
   grep -rn "<symptom keyword>" /Users/pengxiao/workspaces/zenuml/web-sequence/web/src/preview \
     --include="*.ts" --include="*.tsx" | head -20
   ```

## Path B — image given

1. Read the image (path or inline)
2. Apply the same visual checklist from step 4 above
3. If a DSL was also provided, cross-reference what it should produce vs. what the image shows
4. Grep the relevant subsystem (editor, preview, @zenuml/core) for code relevant to the broken element type

## Trickier cases

**Bug only appears after typing (not on `?code=` load):**
Open the app at `http://localhost:3000/`, suppress modals by injecting localStorage before navigation (see `e2e/tests/helpers/onetime.js`), then type the DSL into `[data-testid="dsl-editor"] .cm-content`.

**Bug in autocomplete / slash commands:**
The editor is CodeMirror 6. Relevant files:
- `web/src/editor/zenumlAutocomplete.ts` — completion logic
- `web/src/editor/slashCommands.ts` — slash-command completions
- `web/src/editor/zenumlAutocomplete.test.ts` — unit tests (run: `yarn test`)

**Bug only in the iframe (not the editor):**
Evaluate JS inside the iframe:
```
evaluate_script → document.querySelector('#mounting-point').innerHTML
```
Or inject a console probe:
```
evaluate_script → window.__zenuml_debug = true
```

## Report format

Three lines, no preamble:

```
Bug: <one sentence — what the diagram shows wrong>
Location: <file:line or subsystem>
Cause: <the logic error, or "unknown — needs deeper trace">
```

Attach the screenshot. If the cause is unknown after code inspection, say so — don't fabricate.

## File a GitHub issue

After reporting, always create a GitHub issue:

```bash
gh issue create \
  --repo ZenUml/web-sequence \
  --title "<Bug summary — one sentence, no 'Bug:' prefix>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## Steps to reproduce
<DSL or typed sequence that triggers the bug>

## Expected
<what should happen>

## Actual
<what happens instead>

## Location
<file:line or subsystem>

## Cause
<the logic error, or "unknown — needs deeper trace">
EOF
)"
```

Print the created issue URL so the user can navigate to it.

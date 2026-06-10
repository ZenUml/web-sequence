# Typing-Path Test Trees — ZenUML DSL Editor

**Purpose.** Keyboard-first typing-path test trees for the ZenUML DSL editor (CodeMirror 6). Every tree starts from an editor *state* a real user occupies (empty document, mid-line cursor, block body, active selection, just-accepted completion/snippet, just-auto-inserted text) and branches on *keystrokes*, with each leaf marked for coverage. This complements the linear GIVEN/WHEN/THEN catalog in `BROWSER_TEST_CATALOG.md` (areas A–Z): the catalog enumerates scenarios; these trees enumerate the typing paths between and around them.

**Coverage-mark key**

- `[covered: file :: test]` — behavior asserted by an existing test (file and test title given)
- `[covered-indirect: …]` — (used in the indentation tree) behavior is load-bearing in a passing test but never directly asserted
- `[GAP]` — untested path with a stated expected behavior
- `[GAP-UNSURE]` — untested path; expected behavior probable but unverified
- `[DEBATABLE: why]` — current behavior is questionable for real users; needs a product decision, NOT a ratifying test
- `[needs-spec]` / needs-spec — expected behavior genuinely undecided; must NOT be implemented as a test yet

**Provenance.** Trees were built by a 10-agent workflow (3 subsystem readers + a coverage miner → 3 tree builders → 3 adversarial critics) on 2026-06-10 at commit `76bddeb`. Coverage marks reflect the suite at that commit — note the autocomplete section's stale-test ledger: 12 e2e tests still assert pre-`76bddeb` post-dot behavior and fail at HEAD.

**Stable gap IDs.** Gap-ledger items are numbered `TT-H*` (highlighting), `TT-A*` (autocomplete), `TT-I*` (indentation & typing mechanics). Numbering is stable: when an item closes, mark it closed — do not renumber. Items tagged `(critic)` are index lines for the corresponding "Critic additions" entry, which carries the authoritative full text.

---

## Highlighting

# Typing-Path Test Trees — HIGHLIGHTING subsystem (CodeMirror 6 ZenUML DSL editor)

**File key**: LTEST=`web/src/editor/zenumlLanguage.test.ts` · TTEST=`web/src/editor/themes.test.ts` · GTEST=`web/src/editor/grammar/zenuml-parser.test.ts` · CJK=`web/src/editor/cjkAutocorrect.test.ts` · NFP=`web/src/editor/conformance/noFalsePositive.test.ts` · CORP=`web/src/editor/conformance/corpus.ts` · E2E=`web/e2e/editor-language.spec.ts` · CAT=`web/e2e/catalog.spec.ts` · EXT=`web/e2e/catalog-extended.spec.ts`. Ink theme: keyword/meta=cobalt #7AA2FF, string/LineContent=green #2FA56B, method=teal #5CC8C0, operator/punct=muted #8A99AE, className/number/identifier=neutral #E8EEF7 (same as base).

---

## Tree 1 — Root: EMPTY DOCUMENT

- Type letter `A`
  - Leaf: `A` parses as a bare one-Participant Head; `Name/Identifier` → t.className → `tok-className`, neutral #E8EEF7 in ink (visually = base; never assert color≠base in ink). [covered: LTEST :: 'participant name gets tok-className (Name/Identifier path)' — class path proven, though in `A.myMethod()` context; lone-`A` is the same `Name/Identifier` styleTags path]
  - Type `.` (Dot)
    - Leaf: dot → t.punctuation muted; popup deliberately NOT shown (method slot). [covered: LTEST :: 'dot gets tok-punctuation' + E2E :: 'typing "." after a name in a block does NOT pop the participant popup']
    - Type letters `myMethod`
      - Leaf: `MethodName/Identifier` → t.function(t.variableName) → teal in ink; distinct from participant `A`. [covered: LTEST :: 'participant name gets tok-className…' (class-level) + CAT :: 'G4 — method name is function-colored' + EXT :: 'R6 — method name colored differently from its participant name' (computed-color level)]
      - Type `(`
        - Leaf: editor auto-inserts `)` (closeBrackets `( { "`); both parens t.bracket → tok-punctuation muted; `A.myMethod()` now zero-error. Paren color [covered: LTEST :: 'opening paren gets tok-punctuation']; the autopair INJECTION itself [GAP — no test asserts `(` produces `()`]
        - Type digit `1`, `,`, `"two"`, `true` (arg literals)
          - Leaf: Number neutral-but-tagged tok-number, String green, Comma t.separator muted, true tok-bool cobalt; whole construct zero-error (#811). [covered: LTEST :: 'integer literal in condition…'/'true gets tok-bool class' + EXT :: 'R9 — number renders neutral while string is colored' + NFP :: method-arg literals case]
        - Type `{` then Enter
          - Leaf: `}` auto-inserted; Enter indents one unit; braces muted. [covered: E2E :: 'Enter inside a block indents one unit; typing `}` dedents to the opener column' + CAT :: H1/H2; brace color LTEST :: 'opening brace gets tok-punctuation']
      - Type `"` instead of identifier → quoted method `A."Get order"()`
        - Leaf: parses zero-error (#810) BUT `MethodName/String` falls through to t.string → GREEN, not method-teal — asymmetric vs `A.work()`. [covered for parse: NFP :: quoted-method case] [DEBATABLE: known asymmetry #8 — a method name colored as a string; also GTEST :: it.skip 'quoted-string method name' is STALE (grammar now accepts)] — highlight-color leaf itself [GAP]
  - Type `-` (building an arrow)
    - Leaf: transient `A-` state; `-` lexes MinusOp → t.operator muted under error recovery; no diagnostics (linter unwired); editor must not flash garbage classes. [GAP — no test asserts highlight at this transient state; corpus half-typed states check participants only]
    - Type `>` → `A->`
      - Leaf: ArrowOp → t.operator muted even while dangling; no crash, no markers. [covered for no-crash: CAT :: 'J4 — a dangling arrow does not crash' + CORP half-typed `A->`; arrow color in the DANGLING state: GAP-UNSURE — LTEST/G1 assert `->` only in a complete message]
      - Type `B` then `:`
        - Leaf: `B` = To `Name/Identifier` className; `:` tok-punctuation; `A->B:` with nothing after the colon = transient error-recovered state, existing spans keep their tags. Colon [covered: LTEST :: 'colon gets tok-punctuation']; the empty-Content transient state [GAP — zero-width free-text region, the exact boundary class that bit CJK fix 961a221]
        - Type ` Hello`
          - Leaf: `Hello` is Content{LineContent} → t.string → green, computed color ≠ base. [covered: E2E :: 'an async-message content span is colored differently from the base foreground' + CAT :: 'G1 — message content + arrow are colored']
          - Continue typing a keyword word, e.g. ` if while`
            - Leaf: stays one LineContent token → all green; `if` must NOT flip to keyword cobalt (free-text ≠ code slot). [covered at token level: GTEST :: 'captures the full free-form line as a single Content node' + CORP keyword-label case; covered for completion noise: EXT Y1/Y2] — but NO test asserts the COLOR of a keyword word inside a label is label-green not keyword-cobalt [GAP — positive-only-assertion class #803/#813]
          - Type ` // urgent` inside the label
            - Leaf: Comment token outranks LineContent; ` // urgent` turns comment-gray-italic and the label span is TRUNCATED mid-line. [GAP] [DEBATABLE: known gap #14 — ANTLR may treat the whole line as label; user sees their label half green, half gray; single `/` is fine (`GET /api/v1` stays one Content, covered GTEST :: 'handles content with punctuation and numbers')]
          - Type `。` (CJK full-width period) inside the label
            - Leaf: PRESERVED (free-text guard), stays green LineContent. [covered: CJK :: 'keeps 。 inside a message label' + EXT :: 'Z2 — full-width punctuation in a free-text label is PRESERVED']
          - Type `"` inside the label
            - Leaf: closeBrackets is languageData-global → editor AUTO-INSERTS a closing `"` into prose; parses fine but injects an unasked-for char into free text. [covered only for parse-survival: EXT :: 'W5 — double quotes inside a message label do not break parsing'] [DEBATABLE: free-text-slot-treated-as-code recurrence (class #1) — autopairing quotes/parens inside a label is editor-injected noise in prose; no test pins either behavior]
      - Press Enter after `A->B` (no colon)
        - Leaf: valid async message w/o label (grammar alt), zero errors; arrow muted, endpoints className. [covered: NFP :: `A->B` shape]
  - Type `@`
    - Leaf: bare `@` is not yet an Annotation token (needs `@`+alnum) — error-recovered, unstyled; annotation popup opens (autocomplete). Highlight of the bare-`@` instant: [GAP-UNSURE — nothing asserts it]
    - Type `Actor`
      - Leaf: `@Actor` → Annotation → t.meta cobalt. [covered: CAT :: 'G3 — @Actor (meta) is colored distinct from the name' + EXT :: 'R8 — @return annotation (meta) is colored distinct from base']
      - Type ` Alice` then ` #FFEBE6`
        - Leaf: name className-neutral; the `#FFEBE6` Color token has NO styleTags entry → base foreground while the sibling `@Actor` pops cobalt. Parse is clean [covered: CAT :: 'J1 — valid declare-then-message + #color shows zero error markers']; the hex-span color [GAP] [DEBATABLE: known asymmetry #5 — a color literal rendered colorless]
      - Type ` <<service>> Bob`
        - Leaf: `<<`/`>>` unmapped → unstyled; inner `service` Name → className. Parse/collection covered [participantManager stereotype tests + NFP], stereotype-bracket + inner-name HIGHLIGHT [GAP — known asymmetry #6; note `<` is NOT in closeBrackets, no auto-close]
      - Press Enter, type `Alice->Bob: Hello` (declare-then-message, ADR-0002)
        - Leaf: `Hello` color IDENTICAL to the lone-message case — Head reduced, nothing fabricated. [covered: E2E :: 'declare-then-message: the message highlights identically to a lone message' + CAT :: 'G2']
  - Type `/`
    - Leaf: lone `/` = DivideOp at an error-recovered position; slash-command popup (autocomplete). Highlight of the single-slash instant [GAP-UNSURE]
    - Type second `/` + text
      - Leaf: Comment token to EOL → gray italic, beats DivideOp. [covered: LTEST :: 'single-line comment gets tok-comment class' + EXT :: 'R1 — line comment is colored distinct from base text'; Mod-/ toggle covered EXT :: T8]
      - Type `。` inside the comment → Leaf: preserved, stays comment-gray. [covered: CJK :: 'keeps 。 inside a comment']
  - Type `title Hello world`
    - Leaf: `title` TitleKeyword → cobalt; `Hello world` TitleContent{LineContent} → green. Parse covered [GTEST title cases]; the COLORS of TitleKeyword/TitleContent are asserted nowhere [GAP]
    - Type `。` right after `title ` (empty title, first char) → Leaf: PRESERVED (zero-width free-text edge). [covered: CJK :: 'preserves 。 typed as the FIRST char of a title']
  - Type `==` then ` Phase 2 ==`
    - Leaf: divider; everything after `==` incl. trailing `==` is ONE LineContent → green; the LEADING `==` marker is an anonymous literal → unstyled. Tokenization [covered: GTEST :: 'tolerates arbitrary to-end-of-line text after ==' + 'produces a Divider node']; leading-marker styling + browser color of divider text [GAP — known asymmetry #7]
  - Type CJK name `用户` then `->系统: 登录`
    - Leaf: CJK Identifier ranges (#809) — endpoints className, label green, zero errors, letters NOT autocorrected. [covered: NFP :: `A.方法()` + CORP :: Chinese declare-then-message + EXT :: 'W2 — a Chinese @annotated participant carries no error marker' + CJK :: 'leaves non-punctuation CJK (letters) untouched in code'] — browser computed-color on a CJK span specifically: GAP-UNSURE (W2 checks markers, not colors)
  - Paste a multi-line realistic diagram (title/async/sync/if-else/par/try)
    - Leaf: full reparse, zero error nodes, every construct styled per map. [covered at tree level: GTEST :: 'realistic full diagram — parses with zero error nodes'; at marker level: CAT :: 'U4/J1'] — browser computed-color sampling on a PASTED (not typed) doc [GAP-UNSURE — all e2e color tests type or set short snippets]
  - Mod-Z (undo) after any of the above
    - Leaf: doc and highlight spans revert atomically (incremental Lezer reparse). [GAP — no undo/redo test exists in any layer]
  - Ctrl+Space / ArrowDown / ArrowUp (popup nav), Escape
    - Leaf: zero effect on highlight spans (popup is an overlay). [covered for mechanics: EXT :: T1–T3, CAT :: F3 — highlight-invariance itself trivially uncovered but genuinely equivalent; pruned]

## Tree 2 — Root: CURSOR MID-LINE INSIDE EXISTING CODE (doc `ifService.run()`, cursor inside `ifService`)

- Backspace ×7 (delete `Service`, token shrinks to `if`)
  - Leaf: the surviving token `if` now FULL-matches the @specialize → flips from neutral className to KEYWORD cobalt live; `if.run()` becomes error-recovered. [GAP — keyword/identifier seam under live editing (class #5/#807) never tested; the static converse (`ifService` lexes whole) is covered: EXT :: 'U6 — participant ifService … offered after a dot' + GTEST no-error cases]
  - Re-type `Service`
    - Leaf: flips back to one neutral Identifier; redo/undo of this flip [GAP]
- Type letters extending a name (`A` → `Alice` rename mid-token)
  - Leaf: incremental reparse keeps one Name token, className throughout; completion side covered [EXT :: 'X3 — rename updates completion'], highlight stability across mid-token edits [GAP-UNSURE]
- Delete (forward) the `(` of `run()`
  - Leaf: unbalanced paren → Lezer error-recovers; surrounding tokens KEEP lexical tags (graceful degradation, §9); no diagnostics (linter unwired). [GAP — degradation asserted nowhere; only no-crash analogs CAT :: J2/J4]
- Type `:` mid-line after a name (turning a sync line toward async shape)
  - Leaf: transient mixed parse; colon muted punctuation; previously-typed spans must not flicker to wrong classes. [GAP — transient-state highlighting unobserved in all layers]
- Type `。` after the receiver name (code position, before any colon)
  - Leaf: autocorrected to `.` (To-endpoint region is code). [covered: CJK :: 'still corrects 。 in the To-endpoint region (before the colon)' + EXT :: Z1/Z3]

## Tree 3 — Root: CURSOR INSIDE A BLOCK BODY (doc `A.method() {⏎  |⏎}`)

- Type `if`
  - Leaf: IfKeyword → controlKeyword → cobalt; differs from method-call teal. [covered: LTEST :: 'if gets tok-keyword class' + EXT :: 'R2 — control keyword if differs from method-call color']
  - Type `(` (auto-closes) then condition atoms:
    - `x` → Leaf: bare Atom Identifier → t.variableName neutral. [GAP-UNSURE — no test asserts the bare-Atom class; only MethodName-path variableName is asserted]
    - `true` → Leaf: tok-bool, cobalt in ink. [covered: LTEST :: 'true gets tok-bool class' + EXT :: R7]
    - `"hello"` → Leaf: String green; auto-closed quote. [covered: LTEST :: 'quoted string in condition gets tok-string class' + EXT :: R3]
    - `42` → Leaf: tok-number, neutral in ink. [covered: LTEST :: 'integer literal…' + EXT :: R9]
    - `x >= 3` → Leaf: `>=` is an ANONYMOUS grammar literal → no operator tag → base color, while `+ - * / %` are muted-operator. [GAP] [DEBATABLE: known asymmetry #7 — inconsistent operator coloring within one expression]
  - Type `{`, Enter
    - Leaf: nested body indents 4 (2/unit/depth); `}` dedents. [covered: E2E :: 'nested block body indents one unit per depth (2 then 4)' + CAT :: H3 + EXT :: S7/S8]
- Type `return` (then Enter — bare return #812)
  - Leaf: keyword cobalt; bare `return` zero-error. [covered: LTEST :: 'return gets tok-keyword class' + EXT :: R4 + NFP :: bare-return case]
- Type `B.` then `。` instead of `.` next time
  - Leaf: full-width dot in code position autocorrected to `.`; corrected char highlights as Dot punctuation; userEvent annotation preserved so the (suppressed-after-dot) pipeline still sees a real keystroke. [covered: CJK :: '。 → . after a participant' + EXT :: 'Z3 — corrected code actually parses (no error markers)' + 'Z4 — autocorrect composes with autocomplete']
- Type `== Checkpoint ==`
  - Leaf: Divider is a valid Statement inside a block; same divider styling as top level — pruned to Tree 1 divider leaf (same code path). [GAP via Tree 1 — divider color unasserted anywhere]
- Type `}` on its own line (matching the existing closer = now extra)
  - Leaf: indentOnInput `/^\s*[{}]$/` re-indents the line; brace muted; doc now has an unmatched `}` → error-recovered, highlighting degrades gracefully, no markers. Dedent [covered: CAT :: H2 + EXT :: S8]; the unmatched-brace highlight state [GAP-UNSURE]

## Tree 4 — Root: SELECTION ACTIVE (doc `A->B: Hello`, `Hello` selected)

- Type letter `X` (type-over)
  - Leaf: selection replaced; Content shrinks to `X`, still green; endpoints/arrow untouched. [GAP — no test in any layer types over a selection]
- Type `"`
  - Leaf: CM6 closeBrackets SURROUNDS a non-empty selection → `"Hello"` inside the label (prose mutated by editor). [GAP] [DEBATABLE: surround-in-free-text is the same class-1 doctrine violation as autopair-in-label]
- Type `。` (CJK) over the selection
  - Leaf: replacement leaves an empty-then-refilled free-text region — the exact degenerate-region boundary of fix 961a221, now with a selection; expected: preserved `。` (label region). [GAP — CJK unit tests use single-cursor insertions only]
- Backspace
  - Leaf: label deleted → `A->B: ` trailing-colon transient; colon keeps punctuation tag, no markers. [GAP-UNSURE — corpus half-typed set has `A->` but not `A->B: `]
- Paste multi-line text over the selection
  - Leaf: replacement spans label+structure; full reparse correct, autocorrect applies per-region to pasted full-width runs. Paste-run correction [covered: CJK :: 'corrects a whole pasted run of full-width punctuation in code' — but that case is code-only, single-line]; selection-replacing multi-line paste mixing code+label regions [GAP]
- Mod-Z after type-over
  - Leaf: selection and original text restored, highlight reverts. [GAP — undo untested everywhere]

## Tree 5 — Root: JUST-ACCEPTED COMPLETION/SNIPPET (popup closed, tab stops active — e.g. `/sync` → `Target.method() {`)

- (Immediately, before any key)
  - Leaf: snippet-inserted text must be FULLY highlighted in the same transaction: `Target` className-neutral, `method` teal, dot/braces muted. Insertion text [covered: CAT :: 'B6 — /sync + Tab field nav' + EXT :: M-area]; the HIGHLIGHT of just-inserted template text [GAP-UNSURE — all snippet tests assert text/fields, never colors; snippet-field decoration could mask a missing syntax span]
- Type letters into field 1 (`Svc` over placeholder)
  - Leaf: placeholder replaced (text covered EXT :: 'M2 — /async initial field is selected and typed over'); live highlight of the replacement [GAP-UNSURE]
- Type a KEYWORD into the method field (`if`)
  - Leaf: `Target.if()` — @specialize fires on the full token → method slot turns keyword-cobalt + parse error; user typing an innocent short method named `if` watches it flip color. [GAP] [DEBATABLE: grammar-correct but jarring; adversarial-identifier class #806/#807 never probed inside snippet fields]
- Tab / Shift-Tab (field nav), Escape
  - Leaf: pure selection moves / session end — template text intact, highlight unchanged. [covered: E2E :: '/sync: Shift-Tab returns to field 1' + EXT :: 'T7 — Escape during an active snippet leaves the template text intact' — highlight-invariance pruned as equivalent]
- Enter inside the snippet body
  - Leaf: newline + block auto-indent (not a field jump). [covered: EXT :: 'T5' + CAT :: H1]
- Accept `@Actor` (Tab from the @-popup) then keep typing the name
  - Leaf: accepted `@Actor ` is meta-cobalt at once; name neutral. Acceptance mechanics [covered: CAT :: A3/F1]; resulting color state = same doc as G3's static case → pruned [covered: CAT :: G3]

## Tree 6 — Root: AFTER AN EDITOR AUTO-INSERTION

- After auto-closed `}` (user typed `{`, editor injected `}`; cursor between)
  - Press Enter → Leaf: body indents one unit, closer stays opener-aligned. [covered: E2E :: 'Enter inside a block indents one unit…' + CAT :: H1/H2]
  - Type `}` yourself → Leaf: closeBrackets type-through — cursor skips OVER the injected `}`, no doubled brace, highlight unchanged. [GAP-UNSURE — no test asserts skip-over]
- After auto-closed `"` while typing a participant label `as "`
  - Leaf: label String green once content typed; alias parses (#808). [covered: EXT :: 'W3 — string label as "The User" parses' + CORP #808 cases; the injected-quote moment itself uncovered, pruned into gap 12]
  - Type `（` (full-width paren) INSIDE the quoted label → Leaf: preserved (string is free-text). [covered: CJK :: 'keeps （ inside a quoted string label']
- After an autocorrected CJK char (typed `订单服务。` → editor rewrote to `订单服务.`)
  - Keep typing the method name → Leaf: normal teal method path; popup fired despite rewrite. [covered: EXT :: 'Z4']
  - Mod-Z → Leaf: what does undo restore — nothing, `。`, or `订单服务。`? Transaction was REWRITTEN by a filter; undo semantics unspecified and untested. [GAP — feature-interaction class #8, same family as the 09f95e3 userEvent miss]
- After auto-indent injected leading spaces (Enter inside a block)
  - Type `//note` → Leaf: comment starts after the injected indent, gray to EOL — same Comment code path as Tree 1, pruned. [covered: LTEST comment + EXT :: R1]
  - Press Shift-Tab / Mod-[ → Leaf: dedent only, tags unchanged. [covered: EXT :: 'T9 — Mod-] indents and Mod-[ dedents']

---

### Critic additions (Highlighting)

1. IME COMPOSITION (entire modality absent). No tree path uses compositionstart/update/end — every CJK test inserts committed text directly, yet the feature exists for IME users and cjkAutocorrect.ts:17 admits "inputHandler can be bypassed by composition." Paths: compose pinyin → commit 用户 in a name slot (highlight applied at commit, autocorrect filter must NOT rewrite mid-composition or the IME breaks); commit a full-width 。 via composition in a code slot (does autocorrect fire on the commit transaction at all?); cancelled composition. Expected behavior for correct-during vs correct-on-commit is needs-spec. Layer: e2e via CDP Input.imeSetComposition (jsdom structurally cannot, class #7).

2. Autocorrect→autopair composition: type （ in a code slot — the filter rewrites to ( (mapping confirmed at cjkAutocorrect.ts:35); does closeBrackets still inject )? Same for ＂→" and ｛→{ + auto-close + indent. This is the exact 09f95e3 class (filter output consumed by a downstream extension) with closeBrackets instead of autocomplete as the consumer; Z4 covers only the popup consumer. Expected: needs-spec (pin either consistent auto-close or consistent non-close). Layer: e2e.

3. Backspace through an autopair: cursor between just-injected (), press Backspace — CM6 closeBrackets removes BOTH chars. Asserted nowhere (Delete appears in specs only as a setup workaround, catalog.spec.ts:420). Expected: pair removed, spans consistent. Layer: e2e. Sibling of declared gap 12, which covers injection and type-through but not pair-delete.

4. Deleting structure other lines depend on: (a) delete the { of a populated block — orphan body + stranded } reparse, surviving statements keep lexical tags; (b) delete the @Actor Alice declaration line while Alice->Bob: hi remains below — Alice must stay className via message-introduction (#804 semantics at the highlight layer); (c) select-delete a multi-line range crossing a block boundary. Tree 3 has only the typed-extra-} case; no deletion-of-opener path exists. Layer: unit two-doc tag compare + one e2e live variant.

5. Line-join and line-insert mid-document: Backspace at line start joining A->B: hi onto the title line above (merged line — does the title LineContent swallow the message? needs-spec); Enter at line start inserting a statement BETWEEN existing lines; Alt-ArrowUp/Down (defaultKeymap in basicSetup) moving a block opener above/below its body. All tree edits are within-line; no path crosses a line boundary destructively. Layer: e2e.

6. Popup-open matrix incomplete: covered are Tab/Enter-accept, Escape (F3), arrows; missing are typing a NON-MATCHING char while open (popup closes, char inserts cleanly), clicking elsewhere/blur with popup open (dismiss without insert), Backspace while open (filter re-widens), and Enter-vs-newline precedence when the popup is open but nothing is selected (needs-spec). Layer: e2e (keymap precedence burned the suite before — e386b6e).

7. Construct families the grammar styles but no tree path ever types: assignment + Construct `a = new A()` (Equals t.operator, NewKeyword t.keyword — the ad4dc2a self-regression area; only the /new snippet L6/N3 exists, never typed char-by-char); `group Name {` (GroupKeyword + the #806 name slot); typed `while/loop/par/opt/critical/section/frame/ref/else/try-catch-finally` (only `if` has a typed path; R2 asserts only if); `async A->B` (#810 form); `as` keyword color in aliases; `null/undefined/false` (only `true` asserted); Width token (styleTags entry? needs-spec); `@Starter(arg)`. The tree mirrors the styleTags entries it already tests instead of enumerating the grammar's keyword inventory — class #9 at tree-construction level. Layer: unit tag assertions, reuse CORP.

8. `@word` typed INSIDE a message label: completion side IS covered (EXT K7 — which the tree fails to cite; its label branch tries keywords, //, 。, " but never @). Highlight side missing: does `A->B: ping @urgent` color @urgent meta-cobalt or label-green? Exact #805 vector at the highlight layer; expected needs-spec then pin. Layer: unit.

9. Multi-cursor input: CM6 supports multiple selection ranges; typing a full-width char at two cursors — does the cjk transactionFilter map every change range?; typing ( at two cursors — two autopairs? Nothing anywhere. needs-spec whether multi-cursor is supported UX at all. Layer: e2e.

10. CRLF + whitespace boundaries: doc initialized with \r\n (CM normalizes paste, but programmatic setState with CRLF?); trailing spaces after a label (`A->B: hi   ` — inside the green LineContent span or excluded? needs-spec); pasted literal \t in a label; ideographic space U+3000 typed inside a LABEL (the unit suite corrects it between code tokens; the preserve-in-label case is untested). Layer: unit.

11. Scale: 100+ participants / 1000-line doc — CM6 highlights viewport-only; scroll to the bottom and sample colors (late-region incremental highlighting never exercised; every existing test is <20 lines); one 10k-char label line; 15+-deep nesting (indent arithmetic + recovery). Layer: e2e.

12. Undo granularity beyond declared gap 14: undo immediately after autopair (one Mod-Z removes both chars?), undo after snippet insertion (whole template vs last field?), REDO after each (gap 14 says undo only), undo of an accepted completion. Expected: needs-spec (CM defaults exist but are unpinned). Layer: e2e.

13. Computed font-family: 42136b9 shipped a proportional-serif regression and grep confirms still no font assertion in any spec; the tree never mentions font. One e2e: .cm-content resolved font-family is the bundled mono. (Adjacent to highlighting, but the historical class explicitly includes it.)

14. Runtime theme SWITCH on a populated doc: gap 20 covers static resolution of non-ink themes, but no path reconfigures the theme live and re-samples colors (compartment/reconfiguration path distinct from cold init). Layer: e2e smoke.

15. Alias-String enumeration in gap 9: gap 9 pins keyword-in-LABEL color only; #813's lesson was that the Content guard missed Label/String. The color-negative test must enumerate ALL free-text node types (Content/LineContent, TitleContent, Comment, participant Label String, quoted MethodName) or the partial-guard recurrence repeats at the highlight layer. Layer: unit, table-driven over node types.

16. Paste mechanics beyond gap 15: paste must NOT trigger closeBrackets (paste text containing a lone unbalanced { — no injected closer), and paste mid-token (split `Alice` by pasting `->B: hi\nC` inside it). Asserted nowhere. Layer: e2e.

---

### Gap ledger (Highlighting)

GAP leaves, deduplicated and numbered. Layer choice rationale: unit (vitest `highlightedTokens`/classHighlighter) when the signal is a tag/class on a parse of a static string; e2e (Playwright, port 4399) when the signal needs real keymap/autopair/undo/popup machinery or computed colors (jsdom cannot see these — historical class #7 "wrong substrate").

- **TT-H1** — Transient/half-typed highlight states (`A-`, `A->` dangling, `A->B: ` empty content, unmatched `}`) — expected: existing spans keep lexical tags, no flicker to wrong classes, no markers → **unit**: run `highlightedTokens()` over the half-typed corpus states (CORP already enumerates them for participants; reuse for tags). Cheap, and closes inventory gap #16 (conformance covers only the participant projection).
- **TT-H2** — Keyword/identifier seam under LIVE editing: backspace `ifService`→`if` flips neutral→cobalt; retype flips back — expected: deterministic flip both ways → **unit** (two-doc tag compare) + one **e2e** typed variant (incremental-reparse path differs from cold parse; #807 class).
- **TT-H3** — Color token `#FFEBE6` styling — expected (today): base foreground; expected (user): visually distinct or at least deliberate → **unit** pinning whatever is decided; currently NOTHING asserts the hex span (known asymmetry #5).
- **TT-H4** — Stereotype `<<`/`>>` delimiters and inner `<<service>>` Name highlight — expected: today unstyled brackets + className inner name → **unit** (asymmetry #6).
- **TT-H5** — Anonymous operators `>= <= == != && || !` carry NO tag while `+ - * / %` are operator-muted — expected: consistent operator class → **unit** (would be red today; encodes asymmetry #7 as a property instead of mirroring the implementation — historical class #9).
- **TT-H6** — Quoted method name `A."work hard"()` colors string-green, not method-teal — **unit** tag assertion + decide intent (asymmetry #8).
- **TT-H7** — Title line colors (TitleKeyword cobalt, TitleContent green) asserted nowhere — **unit** (classHighlighter: tok-keyword + tok-string spans) ; parse-only coverage exists in GTEST.
- **TT-H8** — Divider: leading `==` marker unstyled; divider text green never asserted beyond tokenization — **unit** for the LineContent tag; optional **e2e** color sample.
- **TT-H9** — Keyword word INSIDE a message label must be label-green, never keyword-cobalt (`A->B: if while`) — **unit**: assert the `if` span carries tok-string and NOT tok-keyword. Negative assertion closes the positive-only class (#803/#813) at the highlight layer, where today only tokenization (GTEST) and completion (Y1/Y2) are pinned.
- **TT-H10** — Label containing ` // ` truncates to a Comment span mid-label — no test pins either behavior, ANTLR parity unverified (inventory gap #14) → **unit** tag test + a corpus/oracle case to decide ground truth first.
- **TT-H11** — Selection type-over (Tree 4 entirely): letter over selected label text, Backspace-delete of selection, CJK char over selection in a free-text region — **e2e** (selection + transactionFilter interplay; the CJK-over-selection case is the 961a221 degenerate-region class with a new entry vector).
- **TT-H12** — Autopair injection behaviors: `(`/`{`/`"` inject closers, type-through over an injected `)`/`}`, and `"`-surround of a selection — **e2e** (closeBrackets machinery, jsdom-invisible; today only the downstream indent/dedent is tested, never the injection itself).
- **TT-H13** — Autopair/surround INSIDE free-text labels injects chars into prose (`A->B: say "` auto-closes) — **e2e**; also a candidate product fix (zone-aware closeBrackets), see DEBATABLE.
- **TT-H14** — Undo/redo: (a) plain undo restores text+highlight atomically; (b) undo of a CJK-autocorrected insertion (transaction was rewritten by a filter — what comes back?) — **e2e** (history + filter interaction = class #8 feature-interaction blindness, sibling of the 09f95e3 userEvent miss).
- **TT-H15** — Multi-line paste: paste a full realistic diagram and sample computed colors across construct types; paste mixing code+label regions over a selection with full-width chars (per-region autocorrect) — **e2e** (only single-line code-position paste is covered in CJK unit; GTEST covers the tree, not the rendered colors).
- **TT-H16** — Snippet-inserted template highlighted in the same transaction (`/sync` → method teal, braces muted) and live re-highlight while typing over field 1 — **e2e** (snippet decorations could mask a missing syntax span; M-area asserts text only).
- **TT-H17** — Keyword typed into a snippet method/name field (`if`) flips the field cobalt + error-recovers — **e2e**; adversarial-identifier class inside tab-stop fields was never probed (#806 class).
- **TT-H18** — Bare-`@` instant (before any letter) — unstyled error-recovery state — **unit**, minor.
- **TT-H19** — Bare Atom identifier in a condition (`if (x)`) → t.variableName class — **unit**, minor (only the MethodName-path variableName is asserted today).
- **TT-H20** — Non-ink themes: no test asserts monokai/dracula/github-light/solarized style ANY DSL tag (stock @uiw themes may not style t.function(t.variableName) or t.meta at all) — **unit** (resolve each theme extension, check rule presence) + one **e2e** smoke per theme; today TTEST pins ink only.
- **TT-H21** — CJK-span computed color in the browser (e.g. `用户->系统: 登录` — endpoints vs green label) — **e2e**, cheap add to W2; closes the i18n-blindness class at the highlight layer.
- **TT-H22** *(critic — full text: Critic additions #1)* — IME COMPOSITION (entire modality absent).
- **TT-H23** *(critic — full text: Critic additions #2)* — Autocorrect→autopair composition: type （ in a code slot — the filter rewrites to ( (mapping confirmed at cjkAutocorrect.ts:35); does closeBrackets still inject )?
- **TT-H24** *(critic — full text: Critic additions #3)* — Backspace through an autopair: cursor between just-injected (), press Backspace — CM6 closeBrackets removes BOTH chars.
- **TT-H25** *(critic — full text: Critic additions #4)* — Deleting structure other lines depend on: (a) delete the { of a populated block — orphan body + stranded } reparse, surviving statements keep lexical tags; (b) delete the @Actor Alice declaration line while Alice->Bob: …
- **TT-H26** *(critic — full text: Critic additions #5)* — Line-join and line-insert mid-document: Backspace at line start joining A->B: hi onto the title line above (merged line — does the title LineContent swallow the message?
- **TT-H27** *(critic — full text: Critic additions #6)* — Popup-open matrix incomplete: covered are Tab/Enter-accept, Escape (F3), arrows; missing are typing a NON-MATCHING char while open (popup closes, char inserts cleanly), clicking elsewhere/blur with popup open (dismiss …
- **TT-H28** *(critic — full text: Critic additions #7)* — Construct families the grammar styles but no tree path ever types: assignment + Construct `a = new A()` (Equals t.operator, NewKeyword t.keyword — the ad4dc2a self-regression area; only the /new snippet L6/N3 exists, …
- **TT-H29** *(critic — full text: Critic additions #8)* — `@word` typed INSIDE a message label: completion side IS covered (EXT K7 — which the tree fails to cite; its label branch tries keywords, //, 。, " but never @).
- **TT-H30** *(critic — full text: Critic additions #9)* — Multi-cursor input: CM6 supports multiple selection ranges; typing a full-width char at two cursors — does the cjk transactionFilter map every change range?; typing ( at two cursors — two autopairs?
- **TT-H31** *(critic — full text: Critic additions #10)* — CRLF + whitespace boundaries: doc initialized with \r\n (CM normalizes paste, but programmatic setState with CRLF?); trailing spaces after a label (`A->B: hi ` — inside the green LineContent span or excluded?
- **TT-H32** *(critic — full text: Critic additions #11)* — Scale: 100+ participants / 1000-line doc — CM6 highlights viewport-only; scroll to the bottom and sample colors (late-region incremental highlighting never exercised; every existing test is <20 lines); one 10k-char …
- **TT-H33** *(critic — full text: Critic additions #12)* — Undo granularity beyond declared gap 14: undo immediately after autopair (one Mod-Z removes both chars?), undo after snippet insertion (whole template vs last field?), REDO after each (gap 14 says undo only), undo of an …
- **TT-H34** *(critic — full text: Critic additions #13)* — Computed font-family: 42136b9 shipped a proportional-serif regression and grep confirms still no font assertion in any spec; the tree never mentions font.
- **TT-H35** *(critic — full text: Critic additions #14)* — Runtime theme SWITCH on a populated doc: gap 20 covers static resolution of non-ink themes, but no path reconfigures the theme live and re-samples colors (compartment/reconfiguration path distinct from cold init).
- **TT-H36** *(critic — full text: Critic additions #15)* — Alias-String enumeration in gap 9: gap 9 pins keyword-in-LABEL color only; #813's lesson was that the Content guard missed Label/String.
- **TT-H37** *(critic — full text: Critic additions #16)* — Paste mechanics beyond gap 15: paste must NOT trigger closeBrackets (paste text containing a lone unbalanced { — no injected closer), and paste mid-token (split `Alice` by pasting `->B: hi\nC` inside it).

---

### Debatable behavior (Highlighting) — needs a product decision, NOT a ratifying test

Places where CURRENT behavior is questionable for real users (some asserted by green tests, some merely latent):

1. Autopair/surround inside free-text (labels, titles): closeBrackets is languageData-global, so typing `"` or `(` in a message label injects a closing char into prose, and typing `"` with prose selected surrounds it. This is the #1 recurring bug class (free-text slot treated as code slot — #805/#813/76bddeb lineage) expressed by the bracket extension instead of the completion source. No test pins it; a zone-aware closeBrackets (suppress in Content/TitleContent/Comment/Label-String) is the user-correct behavior.
2. Label ` // ` truncation (inventory gap #14): `A->B: retry // with backoff` renders half green, half comment-gray, and the renderer's ANTLR treatment is unverified. If ANTLR keeps the whole line as label, the editor is mis-highlighting AND the (future) linter would mis-flag; needs an oracle corpus case before the highlight test.
3. Ink renders t.className/t.typeName/t.number identical to base (#E8EEF7): participant names — the single most important entity in a sequence diagram — are visually plain text in the DEFAULT theme. Deliberate ("calm" palette) and documented, but a user comparing `Alice` to a label word gets zero signal; tests correctly avoid asserting name≠base, which also means nothing prevents the distinction from silently disappearing entirely.
4. `Color` token unstyled while the sibling `@Actor` pops cobalt (asymmetry #5): users typing `#FFEBE6` get no feedback that the editor recognized a color. Arguably should be muted-meta or render a swatch-adjacent hue.
5. Quoted method `A."work hard"()` green vs `A.work()` teal (asymmetry #8): same semantic role, two colors, purely an artifact of styleTags path coverage (`MethodName/String` unmapped).
6. Mixed operator coloring in one expression (asymmetry #7): `x + 1 >= 3` shows `+` muted and `>=` base — reads as a typo to the user. Anonymous literals need named-token promotion or a styleTags entry via NodeProp.
7. Keyword color flip mid-edit: shrinking `ifService`→`if` (or typing `if` into a method slot) flips cobalt because @specialize is purely lexical. Grammar-correct, but combined with NO linter diagnostics (intentionally unwired, modes.ts) the user gets a confusing color change with no explanation. The "graceful degradation, zero diagnostics" stance (inventory §2/§9) is itself debatable: J1/J4/U4 pin "no markers" as a FEATURE, which also guarantees users get no feedback on genuinely broken input — the workaround-ratified-as-property risk flagged in the #810-812 retrospective, in reverse.
8. Mismatched stereotype delimiters `<service>>` parse clean (OpenStereotype `<<|<` and Close `>>|>` are independent; plus the 3× byte-identical Stereotype alternatives, inventory gap #13) — ANTLR parity unverified; the editor may be quietly accepting (and neutrally highlighting) something the renderer rejects.
9. Stale artifacts actively misleading test designers: GTEST's `it.skip('quoted-string method name')` claims #810 is still broken (it is fixed — the skip should be un-skipped and would pass), and the dead `zenumlStream` legacy export + its LTEST suite (with non-existent `for`/`alt` keywords) tests code no product path uses. Both are green-suite noise that misstates current behavior.

---

### Missed-bug history check (Highlighting)

#803 positive-only popup pollution — highlight-layer analog present as declared GAP 9 (keyword-in-label must NOT be tok-keyword); test does not exist yet, so the class is acknowledged but still open. Completion-side negative assertions live outside this subsystem.

#804 message-introduced participants — COVERED: Tree 1 → `A->B` typed path + declare-then-message identity leaf (E2E + CAT G2) model message-first authoring at the highlight layer. The deletion converse (remove the declaration, message remains) is MISSING (missingPaths 4b).

#805 @ inside a label — completion side covered by EXT K7, which the tree does not cite; the tree's own label branch never types `@`, and the highlight analog (color of @word inside Content) is MISSING (missingPaths 8).

#806 keyword leak into name slot — nearest paths are Tree 5 keyword-into-snippet-field (declared gap 17) and Tree 2 ifService seam (gap 2), both still untested; the actual vector — typing `group ` then a keyword-prefix name — is MISSING because the tree contains no `group` path at all (missingPaths 7).

#807 keyword-prefix lexer split — present as Tree 2 → backspace ifService→if leaf, declared gap 2 (test absent). Static converse covered (U6/GTEST).

#808 string participant labels — COVERED: Tree 6 → `as "` leaf (EXT W3 + CORP #808).

#809 CJK names rejected — COVERED: Tree 1 → 用户->系统 leaf (NFP/CORP/W2/CJK); computed-color residue is declared gap 21.

#810/811/812 grammar under-accepts — arg literals, bare return, quoted method: covered or declared (gap 6). But `async A->B`, `loop(N){}`, `@Starter(arg)` have NO typing path in the tree (NFP pins the parse statically only) — MISSING as highlight typing paths (missingPaths 7).

#813 label/alias completion noise (partial guard) — Content half present as declared gap 9; the alias `as "…"` String region is absent from gap 9's enumeration, reproducing the original partial-guard mistake — partially MISSING (missingPaths 15).

CJK 961a221 empty-region first char — COVERED: Tree 1 title-first-char leaf; label-first-char also covered by cjkAutocorrect.test.ts:108 (tree under-cites it). Selection-over-empty-label variant is declared gap 11.

CJK 09f95e3 userEvent drop — COVERED for the autocomplete consumer (Tree 3 → Z4). The same class with closeBrackets as the downstream consumer (（→( auto-close) is MISSING (missingPaths 2). Undo-after-filter is declared gap 14b.

CJK 6eadee8/0588b84 enumeration mirroring — MISSING: neither the tree nor its 21 declared gaps contains an independent Unicode-category enumeration test (iterate fullwidth/CJK punctuation categories, assert each char is either mapped or deliberately preserved); the unit file still mirrors the shipped map one char per test.

76bddeb post-dot suppression — COVERED: Tree 1 → Dot leaf cites the negative E2E ('typing "." does NOT pop the participant popup').

B4/J6 zone-default/boundary — partially present: bare-`/` top-level instant is GAP-UNSURE in Tree 1 (declared gap 18-adjacent); zero-width regions are declared gap 1. Comment-interior trigger as a highlight path is irrelevant; completion side pre-covered.

e386b6e/b05e795 wrong substrate — COVERED structurally: the tree's layer-rationale routes keymap/popup/snippet mechanics to e2e, institutionalizing the lesson.

42136b9 computed-style regression — color half covered (CAT G-series, EXT R-series computed colors); the FONT half is MISSING everywhere — no font-family assertion in any layer and the tree is silent (missingPaths 13).

ad4dc2a head-greedy fabrication + Construct self-regression — parse side covered by the conformance invariant gate; the highlight tree has no typed `a = new A()` path, so Equals/NewKeyword highlighting is MISSING (missingPaths 7).

---

## Autocomplete

# Typing-Path Test Trees — ZenUML DSL Autocomplete (CodeMirror 6)

All file marks are under `/Users/pengxiao/workspaces/zenuml/web-sequence/web/` — `src/editor/*.test.ts` = vitest unit; `e2e/*.spec.ts` = Playwright. Letter-number ids (B1, K7, T4…) are test titles in `e2e/catalog.spec.ts` (A–J) and `e2e/catalog-extended.spec.ts` (K–Z). Marks tagged *(probe-verified)* were confirmed by direct invocation of `zenumlCompletions` against real parsed states (throwaway vite-node script, deleted).

**Suite-contradiction warning (affects marks below):** HEAD `76bddeb` suppresses ALL completion after `Name.`, but 12 e2e tests still assert the pre-fix behavior and would fail at HEAD: `catalog.spec.ts::E1` and `catalog-extended.spec.ts::N9, O1, O3, O5, U6, U10, W1, W9, X1, X2, Z4` (bodies verified — each types `Name.` and expects participant rows). They are NOT cited as coverage anywhere below; behaviors they used to guard are marked GAP/STALE.

---

## Tree 1 — Root: EMPTY document (cursor at 0, zone `top`)

- **Type `/`**
  - Popup opens with all 14 commands (head ∪ block: /participant…/note) [covered: e2e/catalog.spec.ts :: B1 + B4; e2e/editor-language.spec.ts :: "'/' at the document top level offers declaration AND message commands"; src/editor/zenumlAutocomplete.test.ts :: "top-level / offers BOTH declaration and message commands"]
  - **then type `i`** → popup refilters to /if (no re-query, `validFor /^\/\w*$/`)
    - **then Enter or Tab** → accepts; `/i` replaced from the slash position by `if(condition){…}`; field 1 = `condition` selected → continue at Tree 5(b) [covered: e2e/catalog.spec.ts :: B5; e2e/editor-language.spec.ts :: "/if: condition lands in the predicate, Tab moves to the body"; src/editor/zenumlAutocomplete.test.ts :: "replaces the slash + typed name (from is at the slash)"]
  - **then Escape** → popup closes, literal `/` remains in doc (same `closeCompletion` path as the @-popup) [covered: e2e/catalog.spec.ts :: F3 — collapsed: identical code path]
  - **then type digit `2`** → source still RETURNS all 14 commands (`\w` matches digits) *(probe-verified)*; only CodeMirror's client-side fuzzy filter leaves the popup visually empty [GAP — known-gaps #7, no test at either layer]
- **Type letter `t`** → popup: union keywords (title, try, group, as, if…) + zero participants; `title` present [covered: e2e/catalog.spec.ts :: C1; e2e/catalog-extended.spec.ts :: Q9 (`i` at top = head ∪ block); src/editor/zenumlAutocomplete.test.ts :: "STILL offers title/group at statement start"]
  - **then Tab/Enter** → inserts the bare word `title` — no snippet, no trailing space, no template [GAP-UNSURE — no test anywhere accepts a KEYWORD row; mechanics shared with F1/F4 but the inserted artifact is unasserted] [DEBATABLE: bare-word insert vs slash-command template — see debatable #7]
- **Type `@`**
  - Popup: exactly 24 annotations; keywords and participants suppressed [covered: e2e/catalog-extended.spec.ts :: K1; e2e/catalog.spec.ts :: A1; src/editor/zenumlAutocomplete.test.ts :: "offers @-annotations when token starts with '@'" + "offers cloud annotations too"]
  - **then `Da`** → fuzzy Database/DynamoDB, @Actor excluded [covered: A2; K2]
  - **then lowercase `elc`** → @ElastiCache (case-insensitive) [covered: K3]
  - **then Tab** → accepts highlighted row; NO indentation inserted before `@` (outranks indentWithTab) [covered: e2e/catalog.spec.ts :: F1 + A3; e2e/editor-language.spec.ts :: "Tab accepts the highlighted @-annotation"; e2e/catalog-extended.spec.ts :: K5]
  - **then Enter** → accepts (not a newline) [covered: A4; F4; K4]
  - **then Escape** → closes, nothing inserted [covered: F3]
    - **then Ctrl+Space** → popup re-opens [covered: T1]
  - **then ArrowDown** → row 2 highlighted → **Enter** accepts row 2 [covered: T2]; **ArrowDown, ArrowUp, Enter** → row 1 accepted [covered: T3]
  - **then `Foo`** → matches nothing; no crash [covered: K8]
- **Type CJK letter `用` (IME commit)** → word-match is Unicode-aware so the source runs; no participants/keyword matches yet → no visible popup, no crash, no error marker [covered (crash only): src/editor/zenumlAutocomplete.fuzz.test.ts :: "completion never throws"; popup-absence itself GAP-UNSURE]
- **Type full-width `。` as the FIRST char of the empty doc** → code position → autocorrected to `.` [GAP — first-char-of-document boundary; cjkAutocorrect.test.ts covers after-a-participant and first-char-of-label, never offset 0 of an empty doc]
- **Ctrl+Space** → 42-option popup: 24 annotations + 18 union keywords *(probe-verified)* [GAP — known-gaps #14, untested] [DEBATABLE: see debatable #6]
- **Enter** → plain newline; popup does NOT auto-fire on the new line (quiet-on-empty gate) [covered: e2e/catalog.spec.ts :: F5 + J5]
- **Tab** → no popup/snippet → falls through to indentWithTab, inserts indentation [covered: F2; e2e/editor-language.spec.ts :: "Tab still indents when no completion is active"]
- **Message-first authoring (#804 path): type `Alice->Bob: hi`, Enter, then `Bob->`** → popup auto-fires offering Alice (message-introduced, never declared) [covered: e2e/catalog-extended.spec.ts :: O4 (Bob-> + Ctrl+Space) + O5 + X-series X3/X6/X7 (word+Ctrl+Space variants); src/editor/participantManager.test.ts :: message-introduced #804 block]
- **Type `@Actor ifService`, Enter, then `ifSer` on a new line** → `ifService` parses as ONE identifier (no `if`+`Service` split, #807) and is offered [covered (parse): src/editor/conformance/noFalsePositive.test.ts; offering path was only guarded by U6 which is dot-based and now STALE → GAP for the completion-side regression guard]
- **Paste single-line literal text `/sync`** → NO popup, NO template — paste never auto-activates completion; text stays literal [GAP — user-confusion case, untested]
- **Paste multi-line DSL `Alice->Bob: hi\nBob.m()`** → no popup during paste; participants Alice/Bob collected; next typed `A` on a fresh line offers Alice [GAP — every e2e types char-by-char; no paste-then-complete test]
- **Undo (Mod-z) after typing** → char removed; completion does not fire on the undo transaction (not `input`/`paste` userEvent) [GAP — undo/redo never appears in any spec]

---

## Tree 2 — Root: cursor MID-LINE inside existing code (doc: `@Actor Alice\nAlice->Bob: hi` + variants; first-level branch = where the user clicks/arrows to)

- **(a) After `@Actor ` (empty name slot)**
  - **Ctrl+Space** → no `as`/`title`/`group` [covered: src/editor/zenumlAutocomplete.test.ts :: "does NOT offer keywords after a bare annotation with no name yet"; e2e P3]
  - **Type letter `A`** → still no head keywords (naming guard) [covered: C3 + C4; e2e/editor-language.spec.ts :: "typing a name after '@Actor ' does NOT offer the 'as' keyword"; unit :: "does NOT offer 'as'/title/group while typing the name after @Actor"]
  - **Type `w`,`h`,`i` (name colliding with keyword `while`, #806)** → keywords stay suppressed via the regex text-guard's `@\w+` alternation [GAP-UNSURE — P9 tests the `group` alternation, C7/P2 the stereotype one with FRIENDLY names; the `@Actor <keyword-prefix>` combination is untested]
- **(b) After complete name `@Actor Alice |` (modifier slot)**
  - **Type `a`** → `as` is offered again (past the Name node) [covered: C6; P5; unit :: "STILL offers 'as' after a complete participant name"]
- **(c) After `group ` (group name slot)**
  - **Type letter** → no `as`, no `title` [covered: C5; P1; e2e/editor-language.spec.ts :: "typing a name after 'group ' does NOT offer the 'as' keyword"; unit :: "does NOT offer keywords while typing a group name"]
  - **Type `i` (collides with `if`, #806)** → `if` NOT offered [covered: P9]
  - **Type `/`** → slash menu still works in the name slot, offers /group [covered: P8]
- **(d) Fresh statement line start (zone top)**
  - **Type `t`** → `title` offered (bare leading identifier ≠ name slot) [covered: C1; P4; unit :: "STILL offers title/group at statement start"]
  - **Type `Ali` (prefix of a declared name)** → Alice offered; the in-progress token `Ali` itself excluded by TEXT match [covered: E5; unit :: "excludes the participant token currently under the cursor"]
  - NOTE: the half-typed `Ali` is itself swallowed by the Head-greedy grammar and becomes a "participant" offered elsewhere [DEBATABLE — see debatable #11]
- **(e) Immediately after `->`**
  - **(no further key)** → popup auto-fires with participants on the empty word [covered: unit :: "STILL offers participant names after an arrow (A->)"; e2e E4]
  - **Type letter** → participants only; NO keywords, NO annotations (#803 absence asserted) [covered: U9; O2]
  - **Ctrl+Space** → same participant-only set [covered: O4]
  - **Type SPACE SPACE then letter (`A->  i`)** → the 3-char trigger window no longer sees `->` → keywords + `as`/`title` REAPPEAR mixed with participants (20 options) *(probe-verified)* [GAP — known-gaps #6; #803 suppression silently off] [DEBATABLE #3]
- **(f) Immediately after `Alice.` (post-dot method slot — 76bddeb)**
  - **(no further key)** → NO popup of any kind [covered: src/editor/zenumlAutocomplete.test.ts :: "does NOT offer participant names after a 'Name.' method slot" + "suppresses participants right after the dot inside a block (A.m { B. })"; e2e/editor-language.spec.ts :: "typing '.' after a name in a block does NOT pop the participant popup"]
  - **Ctrl+Space** → still NO popup (explicit invoke also suppressed) *(probe-verified null)* [GAP — explicit-after-dot absence asserted nowhere; the 12 STALE tests assert the opposite]
  - **Type method letters** → no popup while typing the free-text method name [covered: unit, same tests — collapsed: same `afterDot` guard]
- **(g) Inside a populated message label (`A->B: hi|`)**
  - **Type `titl` (label word prefixing keyword, #813)** → NO keyword popup [covered: Y1 + Y2; src/editor/zenumlAutocomplete.test.ts :: free-text guard its]
  - **Type a word equal to a participant name** → NOT offered [covered: Y3; U3]
  - **Type `@` (#805)** → NO annotations [covered: K7]
  - **Type `。`** → PRESERVED (no autocorrect in free text) [covered: src/editor/cjkAutocorrect.test.ts :: "。 in message label"; e2e Z2]
  - **Ctrl+Space mid-label** → null [GAP-UNSURE — Y-series all use implicit typing; explicit invoke inside Content untested]
- **(h) At an EMPTY label, right after `A->B: |` (zero-width Content — the 961a221 boundary class)**
  - **Type a letter** → char becomes Content; no popup on subsequent letters *(probe-verified null at one char)* [GAP — degenerate-region boundary never a cursor position in completion tests]
  - **Ctrl+Space** → CURRENTLY OFFERS 18 KEYWORDS inside a free-text slot *(probe-verified)* — the completion null-guard checks Content/LineContent which don't exist yet; only the annotation branch checks AsyncMessage [GAP + DEBATABLE #2 — bug-shaped, exact recurrence of historically-missed class 1+10]
  - **Type `。` as first label char** → PRESERVED (cjkAutocorrect's isFreeTextSpan has the AsyncMessage/Colon fix; completion guard does not) [covered: src/editor/cjkAutocorrect.test.ts :: "。 right after message colon preserved"]
- **(i) After `title |` (empty title text)**
  - **Ctrl+Space** → CURRENTLY OFFERS 42 options (annotations + keywords) inside free text *(probe-verified)* [GAP + DEBATABLE #2 — same degenerate-region class]
  - **Type a letter then more** → LineContent materializes → null *(probe-verified)* [GAP — unasserted]
  - **Type `。` as first title char** → PRESERVED [covered: cjkAutocorrect.test.ts :: "。 first char of title preserved"]
- **(j) Inside a comment `// |`**
  - **Type `/sync`** → no slash menu [covered: J6; U1; unit :: "no slash commands inside a comment"]
  - **Type `whi`** → no keywords [covered: unit :: "no keywords/names inside a comment"]
  - **Type `@`** → nothing [covered: U2]
  - **Ctrl+Space on `// `** → null (Comment node exists from `//`) *(probe-verified)* [GAP-UNSURE — explicit invoke in comment untested but guard verified]
  - **Type `。`** → preserved [covered: cjkAutocorrect.test.ts :: "。 in comment"]
- **(k) Inside an alias string `as "…|"` (#813 second round)**
  - **Type `titl`** → no keyword popup (Label/String guard) [covered: Y5; unit via commit 3480e10]
  - Whole construct parses; name stays collectible [covered: W3 + W4; participantManager.test.ts :: string-label its]
- **(l) Cursor placed MID-token (between `Or|der` of `OrderController`)**
  - **Type a letter** → word match spans only [word.from, cursor]; result/exclusion computed against that partial token [GAP — no test ever places the cursor mid-identifier]
- **(any position) Backspace**
  - With popup open (`@Da|` → Backspace) → popup refilters back to the wider set via validFor; deleting past the trigger/word start closes it [GAP — "Backspace" appears in no spec except X3's rename]
  - Doc-edit recompute: backspacing a name then retyping updates the offered set [covered: X6/X3-style word+Ctrl+Space re-query — X3 itself uses Backspace ×5 and is still valid (arrow-free)]
- **(any position) Delete (forward)** → same docChanged recompute path; popup behavior unasserted [GAP — zero Delete-key tests]
- **(any position) ArrowLeft/Right/Up/Down with popup CLOSED** → pure cursor move; zone re-resolved and emitted to the Hint Bar only on change [covered: V4 + V7; src/editor/CodeEditor.test.tsx :: onZoneChange its]

---

## Tree 3 — Root: cursor INSIDE a block body (`Alice.m() {\n  |\n}`, zone `block`) and 3B group body (zone `head`)

- **Type `/`** → block commands only; /participant and /group absent [covered: B2; L12; unit :: "does NOT offer head commands inside a block"; e2e/editor-language.spec.ts :: "'/' inside a block offers control-flow commands"]
- **Type `i` / `w` / `o` / `cr` / `fr` / `fi` / `as` / `re` / `el` / `t`** → matching BLOCK keywords only, never title/group/as-modifier [covered: D1 + D2; Q1–Q8; unit :: "offers block keywords (if/while/try) inside a block, not head keywords"]
- **Type prefix of a declared participant** → name offered (boost 50) [covered: E2; ordering-above-keywords assertion GAP-UNSURE — boost never asserted by sort position]
- **Type `@`** → NOTHING (annotations zone-gated; keywords/participants suppressed by `@` prefix) [covered: A5; D3; unit :: "does NOT offer annotations when typing '@' inside a block"]
- **Type `B` then `.`** → no popup (post-dot, in-block variant) [covered: e2e/editor-language.spec.ts :: dot test (block); unit :: "(A.m { B. })"]
- **Ctrl+Space on empty block line** → participants, not annotations [covered: O8]
- **Enter** → newline + one indent unit; no popup [covered: H1; S1–S7]
- **Type `}`** → dedents to opener column [covered: H2; S8–S9]
- **3B. Group body `group G { | }` (zone `head` — declaration-only)**
  - **Type `/`** → /participant + /group only; no /if, /sync, /async [covered: B3; L11; unit :: "does NOT offer /if in a group body"]
  - **Type `@`** → annotations ARE offered [covered: K6]
  - **Type `t`** → `title` offered (head keywords live here) [covered: P6]
  - Hint bar shows declaration chips only [covered: V1 + V8]

---

## Tree 4 — Root: SELECTION active (type-over) — doc `Alice->Bob: hi`, `Bob` selected

- **Type letter `C`** → selection replaced; completion queries at the collapsed cursor (endpoint slot) → Alice offered, `C` token excluded [GAP — no spec ever types over a non-snippet selection]
- **Type CJK char over a selection in a code position** → replacement char(s) autocorrect-checked at the selection start [GAP — cjkAutocorrect unit tests insert at a point, never replace a range]
- **Type `{` with a non-empty selection** → closeBrackets default surrounds/replaces the selection [GAP-UNSURE — behavior itself unverified in this editor, untested]
- **Tab with a multi-line selection** → snippet/accept return false → indentWithTab indents the selected lines [GAP-UNSURE — F2 covers caret-only Tab]
- **Paste over selection** → selection replaced; CJK correction decision keyed at selection start [GAP]
- **Backspace/Delete on selection** → deletes; participant set recomputed (e.g. last mention of Bob disappears from later popups) [covered (recompute principle only): participantManager.test.ts :: "removes on deletion"; e2e X3; selection-specific path GAP]
- (Snippet-field selection type-over is Tree 5(b) — M2.)

---

## Tree 5 — Root: JUST-ACCEPTED completion/snippet (popup closed)

- **(a) Just accepted a bare completion (`@Actor` / keyword) — no tab stops**
  - **Space, then letter** → name-slot logic engages (→ Tree 2(a)) [covered: C3 flow]
  - **Tab** → no snippet/popup → indents [covered: F2 — collapsed: same fall-through]
  - **Undo** → acceptance reverted in one step (typed prefix restored) [GAP — undo-after-accept untested]
- **(b) Just accepted a multi-field slash snippet (/sync: field 1 selected)**
  - **Type letters** → selected placeholder replaced by typed text [covered: M2]
  - **Tab** → field 2 [covered: B6; e2e/editor-language.spec.ts :: "/sync: field 1 then Tab to field 2"; M3/M7/M8]
  - **Shift-Tab** → back to field 1; text typed in field 2 survives; outranks indentLess [covered: B7; F6; e2e/editor-language.spec.ts :: Shift-Tab test]
  - **Tab past the last field** → snippet session ends; next Tab indents [covered: M9; T6]
  - **Enter mid-snippet** → newline, NOT a field jump [covered: T5]
  - **Escape mid-snippet** → template text intact [covered: T7]
  - **Type `@` in a head-position field → popup opens over the active snippet**
    - **then Tab** → `hasNextSnippetField` wins → JUMPS FIELD instead of accepting the visible popup [GAP + DEBATABLE #5 — T4 only tests the popup-DISMISSED case]
    - **then Enter** → accepts the popup row inside the snippet [GAP-UNSURE — untested combination]
    - **then Escape** → popup closes, snippet session continues, Tab advances [covered: T4]
  - **ArrowRight/click outside the active field, then Tab** → does field-nav resume or has the session degraded? [GAP — selection-leaves-field behavior untested]
  - **Undo mid-snippet** → template insertion reverted; does the field session survive in a sane state? [GAP]
  - **/try specifics**: first Tab field = `catch(e)` var, final `${0}` = try body [covered: M5; B8] [DEBATABLE #8 — field order]
  - **/return**: single-field, paints no .cm-snippetField [covered: L4]
- **(c) Just accepted /participant** → 3 fields (type/name/color), navigable [covered: L1; M3; M4]; no `as "Label"` slot by design (grammar milestone pending) [documented limitation, not a leaf-gap]

---

## Tree 6 — Root: after the EDITOR auto-inserted something

- **(a) Typed `{` → editor auto-inserted `}` (closeBrackets: true, CodeEditor.tsx:73), cursor between braces**
  - **Enter** → body indented one unit, `}` dedented to opener column [covered: H1 + H2; S1–S9 — all run in a real browser with closeBrackets live]
  - **Type `/`** → zone `block` at the fresh brace (resolveInner −1 bias) → block commands [covered: B2; unit :: resolveZone "'block' inside a StatementBraceBlock"]
  - **Type `}`** → skips over the auto-inserted `}` (no `}}`) [GAP-UNSURE — H2/S8 assert final text (would catch a duplicate) but never assert the skip explicitly]
- **(b) Typed full-width `（` in a code position** → autocorrected to `(` BUT no auto-closed `)` — closeBrackets' inputHandler never saw an ASCII `(`; asymmetric with typing `(` [GAP — asymmetry unasserted; unit/Z-tests always type both `（）`]
- **(c) Typed `。` after a participant name in code** → autocorrected to `.`; at HEAD the popup is then SUPPRESSED (post-dot) — e2e Z4 still asserts a participant popup appears → STALE, fails at HEAD [DEBATABLE #10; the 09f95e3 userEvent-preservation guard currently has no passing observable test]
- **(d) Typed full-width `－＞` → corrected to `->`** → participant popup should auto-fire (userEvent must survive the autocorrect transactionFilter) [GAP — the natural re-grounding of Z4 after 76bddeb; untested]
- **(e) Typed `『` … `』` (corner brackets)** → become `{` `}` with auto-indent composing [covered: Z5; cjkAutocorrect.test.ts :: corner-bracket its]
- **(f) Undo right after an autocorrect** → corrected char removed entirely (full-width original was never committed); the filter must not re-fire on the undo transaction (guarded by isUserEvent input/paste) [GAP — unit covers "NOT on programmatic change" but never an actual undo event]

---

### Critic additions (Autocomplete)

All paths below are ABSENT from the tree (not merely marked GAP in it). Code refs verified against /Users/pengxiao/workspaces/zenuml/web-sequence/web/src/editor/.

1. IME COMPOSITION as an event sequence (compositionstart → updates → commit). The tree models only committed CJK codepoints. cjkAutocorrect.ts:155 gates on `tr.isUserEvent('input')`, which also matches `input.type.compose` — the transactionFilter can rewrite the document MID-composition, which in CM6 aborts/corrupts the active IME session. Expected: needs-spec (defer remap to composition end vs rewrite-is-safe); minimum bar = compose a CJK word, commit full-width punct, assert corrected text AND that a subsequent composition still works. Layer: e2e via CDP Input.imeSetComposition (composition cannot run in jsdom — wrong-substrate class 7); plus a unit asserting the filter's behavior on a `input.type.compose` transaction. Companion branch: does the completion popup open/refilter during active composition? needs-spec.

2. Backspace through an autopair. `{` auto-inserts `}` (Tree 6a), but the Backspace branch is missing: closeBracketsKeymap is live (verified: @uiw basic-setup index.ts:98-99 adds it unless disabled; BASIC_SETUP_BASE doesn't disable), so Backspace between `{|}` runs deleteBracketPair and removes BOTH. Expected: both braces gone in one keypress, one undo restores both. Layer: e2e (keymap substrate). Variant: Backspace after autocorrected `『`→`{` (no auto-`}` was inserted per the 6(b) asymmetry) — does deleteBracketPair misfire on the following user-typed `}`? needs-spec.

3. Deleting the OPENING brace of a populated block. `A.m() {\n if(x){...}\n}` → delete the first `{`: error recovery, zone of body lines flips block→top(?), Hint Bar re-emits, completion still functional, orphan `}` handling. Expected: needs-spec for the zone outcome; minimum = no crash + zone re-emission + completion returns sane sets. Layer: unit (resolveZone/zenumlCompletions on the broken doc) + one e2e.

4. Deleting/renaming a participant DECLARATION while messages still reference it. Delete the `@Actor Alice` line (Mod-Shift-k is live via defaultKeymap) with `Alice->Bob: hi` below: Alice must REMAIN offered (message-introduced, participantManager #804 semantics). Rename declaration `Alice`→`Alicia` by editing the token: popup should offer Alicia AND still Alice (message mentions). Tree only carries the generic "removes on deletion" recompute principle. Layer: unit (cheap, participantManager + completion).

5. Enter MID-LINE splitting an existing statement (`Alice->B|ob: hi` + Enter). Token split → Head-greedy grammar fabricates `B`/`ob` participants; what does the next popup offer? The tree's mid-line root (Tree 2) only places the cursor and types — no structural edit of an intact line ever occurs. Expected: needs-spec (ties to DEBATABLE #11 fabrication). Layer: unit.

6. Popup open + typing a NON-WORD char (space, `(`, `:`). `@Da` popup open, type space: outside validFor `[\p{L}\p{N}_@]*` → re-query → null → popup closes, char inserted literally, nothing accepted. The popup matrix covers Enter/Tab/Escape/arrows but not this, the most common dismissal in real typing. Layer: e2e.

7. Popup open + CLICK ELSEWHERE (blur / cursor relocation). Click into the preview pane or another doc line with the popup open: closeOnBlur/selection change closes it, nothing inserted. Absent from the matrix. Layer: e2e.

8. MOUSE-ACCEPT: clicking a popup row. The only accept path a pointer-first user uses; zero click/mouse popup tests exist (grep-verified across catalog specs). Expected: identical apply to Enter (incl. snippet templates with tab stops via click). Layer: e2e.

9. REDO — entirely absent (the tree's undo branches are gaps, but redo isn't even a node). historyKeymap is live (basic-setup index.ts:108). (a) redo after undo of an accepted snippet: text restored — field session too? needs-spec; (b) redo after undo of an autocorrect: filter must not re-fire (`redo` userEvent fails the input/paste gate — code-read safe at cjkAutocorrect.ts:155, unasserted); (c) undo then TYPE then redo (history fork) around editor-injected text. Layer: unit for (b), e2e for (a)/(c).

10. Undo of an autopair insertion: `{`+auto-`}` land in one transaction, so one undo must remove both. Unasserted anywhere. Layer: unit or e2e light.

11. DIVIDER slot — missing from the per-slot matrix (Tree 2 has label/empty-label/title/comment/alias; no divider). (a) `。` inside `== 分隔 ==` preserved — isFreeTextSpan has an explicit Divider branch (cjkAutocorrect.ts:142) but cjkAutocorrect.test.ts contains ZERO divider tests (grep-verified); (b) EMPTY divider `== ` + Ctrl+Space: populated divider text is LineContent (zenuml.grammar:289-290) so the completion guard covers it, but the zero-width case is a THIRD instance of the degenerate-region class — declared gaps 1/2 enumerate only AsyncMessage-Colon and Title. Layer: unit both.

12. METHOD-NAME slot CJK punctuation — guard DIVERGENCE at HEAD. 76bddeb made post-dot a free-text method name for COMPLETION, but isFreeTextSpan (whose header comment claims it "mirrors the completion guard", cjkAutocorrect.ts:12-13) was not extended: full-width `！？` typed in a method name are still code-corrected while completion treats the slot as free text. Whether method names should preserve CJK punct is needs-spec, but the divergence is the #813 partial-guard class recurring ACROSS FILES. Layer: unit pinning BOTH guards against one shared slot-enumeration fixture (this fixture is also the missing antidote for taxonomy class 1).

13. Full-width LETTERS and mixed CJK+ASCII identifiers. `Ａｌｉｃｅ` is deliberately unmapped (cjkAutocorrect.ts:83-84 says the grammar accepts them) but nothing types one and asserts parse + later offering; mixed identifiers (`订单Service`, `Order服务`) appear in no test. Layer: unit + one e2e.

14. CRLF — zero mentions anywhere in the tree. Paste of multi-line DSL with `\r\n` (and a doc LOADED with CRLF via the import path): does line-splitting, autocorrect iterChanges, and participant collection behave? Expected: needs-spec/normalized. Layer: unit (transaction) + e2e paste.

15. Paste of text CONTAINING `{ }` pairs. closeBrackets must not double braces on paste; pasted indentation kept verbatim (no reindent); then typing `}` after a PASTED `{` must insert literally (skip-over applies only to auto-inserted brackets). Declared gaps 12/13 cover punctuation and popup, not brace mechanics. Layer: e2e.

16. atMessageEndpoint 40-char window escape. zenumlAutocomplete.ts:213 looks back 40 chars; a To-name longer than ~37 chars after `A->` pushes the arrow out of the window and participant offering silently degrades mid-name. Declared gap 3 covers the 3-char beforeWord window and the 80-char isNamingDeclaration lookback but NOT this one. Layer: unit; pin or fix.

17. Scale/boundary set: 100+ participants in one popup (CM6 maxRenderedOptions virtualization + accept correctness), 10+ nested StatementBraceBlocks (resolveZone climb, `}` dedent at depth), trailing whitespace before every trigger. W9 was the only scale test and is stale at HEAD. Layer: unit for resolveZone depth, one e2e for the big popup.

18. MULTI-CURSOR (allowMultipleSelections live via basicSetup). Mod-d/Alt-click a second cursor, then: type a trigger (`@`) — does completion fire/apply at all ranges?; type full-width punct at two positions straddling code AND label — iterChanges decides per-range (cjkAutocorrect.ts:159-170), so corrections should be independent per cursor. Entirely absent; needs-spec for the completion half. Layer: e2e + unit for the autocorrect half.

19. VIM keymap axis (CodeEditor.tsx keymap='vim' is shipped). Popup interaction in vim insert mode — Escape collides (close popup vs exit insert), Tab/Enter accept precedence vs vim bindings. Zero vim nodes in the tree. needs-spec. Layer: e2e (keymap substrate).

20. Snippet template INDENTATION in a nested context. Accept /if inside an indented block body: are the template's continuation lines re-indented to the insertion column or pasted at column 0? Tree 5(b) tests field navigation only, never the inserted text's shape. Layer: e2e.

---

### Gap ledger (Autocomplete)

All paths under `/Users/pengxiao/workspaces/zenuml/web-sequence/web/`. "probe-verified" = confirmed by direct `zenumlCompletions` invocation on real parsed states.

- **TT-A1** — `A->B: ` then Ctrl+Space (EMPTY label, zero-width Content) -> expected NO popup (free-text slot); CURRENT: 18 keywords offered (probe-verified) -> unit (cheap `completeAt(doc,pos,explicit)` state test in src/editor/zenumlAutocomplete.test.ts); this is the exact empty-parse-region class that bit cjkAutocorrect (961a221) — the completion null-guard needs the same AsyncMessage/Colon logic isFreeTextSpan has. Likely a code fix, test-first.
- **TT-A2** — `title ` then Ctrl+Space (empty title text) -> expected NO popup; CURRENT: 42 options (probe-verified) -> unit; same degenerate-region class, Title/TitleKeyword missing from the completion guard.
- **TT-A3** — `A->` then TWO spaces then letter (`A->  i`) -> expected participants only (#803); CURRENT: keywords + `as`/`title` reappear mixed in (probe-verified, 20 options) -> unit; the 3-char trigger window vs 40-char endpoint window asymmetry (known-gaps #6). Also cover the dot variant (3+ spaces after `.`) and the 80-char isNamingDeclaration lookback escape on a very long declaration line.
- **TT-A4** — `foo/i` (slash glued to a word) -> decide + pin: currently pops all 14 commands (probe-verified) despite the code comment claiming stray slashes don't trigger -> unit for source semantics; the comment and the behavior disagree.
- **TT-A5** — `A.b()/2` (slash + digit) -> expected: no visible popup; CURRENT: source RETURNS 14 options and only the client-side fuzzy filter hides them (probe-verified) -> e2e (the user-visible outcome depends on browser-side filtering — wrong-substrate class) plus a unit pinning source intent.
- **TT-A6** — Ctrl+Space on an empty document -> pin expected contents; CURRENT: 42-row union of annotations+keywords (probe-verified, known-gaps #14) -> unit to pin once product-decided.
- **TT-A7** — Ctrl+Space immediately after `Name.` -> expected null (explicit invoke also suppressed, probe-verified) -> unit with explicit=true; currently only implicit suppression is asserted, and 12 stale e2e tests assert the OPPOSITE (see debatable) — flipping them is part of this gap.
- **TT-A8** — Re-ground the 5 behaviors orphaned by 76bddeb on `->`/line-start triggers instead of `.`: #804 first-mention (was U10/X1/X2), #807 ifService offering (was U6), #809 CJK offering (was W1), scale (was W9), receiver-exclusion (was E1) -> e2e rewrites; until then these regression guards are dead.
- **TT-A9** — Full-width arrow `－＞` autocorrects to `->` AND the participant popup auto-fires (userEvent survives the transactionFilter) -> e2e; this is the only remaining observable for the 09f95e3 userEvent-drop class now that Z4's dot premise is invalid (Z4 fails at HEAD).
- **TT-A10** — Full-width `（` in code -> corrected to `(` with NO auto-paired `)` (closeBrackets inputHandler bypassed) -> e2e (inputHandler = browser substrate); pin the asymmetry or fix it.
- **TT-A11** — `。` as the FIRST character of an empty document -> corrected to `.` -> unit; offset-0/empty-doc boundary missing from cjkAutocorrect.test.ts (zone-default/boundary class).
- **TT-A12** — Multi-line paste straddling code AND label regions (e.g. paste `A->B: 你好。\nC。m()` at a code position) -> expected per-region correction; CURRENT: one free-text decision at the paste-START position for the whole block (code-read: iterChanges sees one change) -> unit (transaction test); enumeration/granularity class.
- **TT-A13** — Paste behavior vs popup: (a) pasting literal `/sync` must NOT pop the menu or insert a template; (b) paste-then-type offers pasted-in participants -> e2e; no paste test exists outside the CJK unit run.
- **TT-A14** — Backspace with the popup open (`@Da` -> Backspace -> refilter widens; Backspace past the trigger -> popup closes) -> e2e (popup mechanics are browser-substrate, jsdom-blind per the e386b6e lesson).
- **TT-A15** — Delete (forward) and Backspace-joining-lines around participants/zones -> doc recompute + zone re-emit -> unit for recompute (participantManager) is partially there; popup/zone-emission on these keys untested -> e2e light.
- **TT-A16** — Selection type-over family: letter over a selected endpoint (popup fires at collapsed cursor, replaced token excluded), CJK char over a selection in code (corrected), Tab with multi-line selection (indents), `{` with selection (closeBrackets surround) -> e2e for keymap/popup parts + unit for the autocorrect-over-range part; no spec types over a non-snippet selection today.
- **TT-A17** — Undo/redo: after accepting a snippet (single-step revert restoring the typed `/cmd`), mid-snippet-session, and after an autocorrect (filter must skip the undo userEvent) -> unit for the autocorrect/no-refire part, e2e for snippet/undo interaction.
- **TT-A18** — Popup open INSIDE an active snippet field: Tab currently field-jumps instead of accepting (keymap order), Enter accepts the row -> e2e to pin the decided behavior; T4 only covers the popup-dismissed case (also in debatable #5).
- **TT-A19** — Accepting a KEYWORD row (Tab/Enter on `title`/`if`) inserts the bare word -> no test accepts a keyword anywhere -> unit + one e2e; also the boost-50 ordering (participants sorted above keywords in a mixed popup) is never asserted by position -> e2e (client-side sort).
- **TT-A20** — Keyword-colliding name behind the `@\w+` marker (`@Actor whi|`) -> keywords stay suppressed (#806 regex alternation) -> unit; P9 covers only the `group` alternation, stereotype tests use friendly names (adversarial-identifier class).
- **TT-A21** — Cursor placed MID-identifier (`Or|der`) then typing -> completion spans [word-start, cursor]; exclusion uses the partial token -> unit; no test ever puts the cursor mid-word.
- **TT-A22** — CJK mapping completeness: cjkAutocorrect.test.ts still one-test-per-mapped-char (mirrors the implementation table — the exact 6eadee8 class); add an independent enumeration test deriving expected mappings from Unicode categories (Po/Ps/Pe fullwidth/CJK ranges) -> unit.
- **TT-A23** — Ctrl+Space explicitly inside populated Content / Comment free-text -> null (probe-verified for comment) -> unit; all current free-text suppression tests are implicit-typing only (positive-only-assertion residue).
- **TT-A24** *(critic — full text: Critic additions #1)* — IME COMPOSITION as an event sequence (compositionstart → updates → commit).
- **TT-A25** *(critic — full text: Critic additions #2)* — Backspace through an autopair.
- **TT-A26** *(critic — full text: Critic additions #3)* — Deleting the OPENING brace of a populated block.
- **TT-A27** *(critic — full text: Critic additions #4)* — Deleting/renaming a participant DECLARATION while messages still reference it.
- **TT-A28** *(critic — full text: Critic additions #5)* — Enter MID-LINE splitting an existing statement (`Alice->B|ob: hi` + Enter).
- **TT-A29** *(critic — full text: Critic additions #6)* — Popup open + typing a NON-WORD char (space, `(`, `:`).
- **TT-A30** *(critic — full text: Critic additions #7)* — Popup open + CLICK ELSEWHERE (blur / cursor relocation).
- **TT-A31** *(critic — full text: Critic additions #8)* — MOUSE-ACCEPT: clicking a popup row.
- **TT-A32** *(critic — full text: Critic additions #9)* — REDO — entirely absent (the tree's undo branches are gaps, but redo isn't even a node).
- **TT-A33** *(critic — full text: Critic additions #10)* — Undo of an autopair insertion: `{`+auto-`}` land in one transaction, so one undo must remove both.
- **TT-A34** *(critic — full text: Critic additions #11)* — DIVIDER slot — missing from the per-slot matrix (Tree 2 has label/empty-label/title/comment/alias; no divider).
- **TT-A35** *(critic — full text: Critic additions #12)* — METHOD-NAME slot CJK punctuation — guard DIVERGENCE at HEAD.
- **TT-A36** *(critic — full text: Critic additions #13)* — Full-width LETTERS and mixed CJK+ASCII identifiers.
- **TT-A37** *(critic — full text: Critic additions #14)* — CRLF — zero mentions anywhere in the tree.
- **TT-A38** *(critic — full text: Critic additions #15)* — Paste of text CONTAINING `{ }` pairs.
- **TT-A39** *(critic — full text: Critic additions #16)* — atMessageEndpoint 40-char window escape.
- **TT-A40** *(critic — full text: Critic additions #17)* — Scale/boundary set: 100+ participants in one popup (CM6 maxRenderedOptions virtualization + accept correctness), 10+ nested StatementBraceBlocks (resolveZone climb, `}` dedent at depth), trailing whitespace before every …
- **TT-A41** *(critic — full text: Critic additions #18)* — MULTI-CURSOR (allowMultipleSelections live via basicSetup).
- **TT-A42** *(critic — full text: Critic additions #19)* — VIM keymap axis (CodeEditor.tsx keymap='vim' is shipped).
- **TT-A43** *(critic — full text: Critic additions #20)* — Snippet template INDENTATION in a nested context.

---

### Debatable behavior (Autocomplete) — needs a product decision, NOT a ratifying test

1. **12 e2e tests assert the pre-76bddeb dot behavior and fail at HEAD**: `e2e/catalog.spec.ts::E1` and `e2e/catalog-extended.spec.ts::N9, O1, O3, O5, U6, U10, W1, W9, X1, X2, Z4` (bodies verified: each types `Name.` and expects participant rows; E1 even expects the receiver itself — the exact noise 76bddeb removed). 76bddeb touched only editor-language.spec.ts + unit (git show confirmed). The suite currently encodes BOTH designs simultaneously — the strongest live instance of the "green tests defend the bug" class; whichever way the design question lands, these must be flipped or re-grounded (gaps #7–#9).

2. **Total silence after `Name.`** (current design): the user typing `Bob.` gets no popup at all — no method-name hints, no signal that the slot is free text. Silence beats the old self-suggest noise, but zero affordance in the single most common authoring position is itself debatable; a method-name-history or ghost-hint source may be the real answer. The design flipped once already; it deserves an explicit ADR-level decision, not just flipped assertions.

3. **`A->` + two spaces resurrects keyword/annotation noise** (probe-verified, 20 options): from the user's keyboard, one extra space silently turns #803 protection off. No user would expect spacing to change WHAT is offered. Current behavior is wrong-for-users even though no test asserts it either way.

4. **Empty-label / empty-title Ctrl+Space offers keywords** (probe-verified, gaps #1–2): a user who hits Ctrl+Space right after `A->B: ` is asking "what goes here?" and gets `if/while/title` — all of which would be swallowed as literal label text if accepted. Bug-shaped; the recurring free-text-as-code class at its zero-width boundary.

5. **Tab with a popup open inside an active snippet field jumps fields instead of accepting** (keymap order: hasNextSnippetField first): F1/A3 train users that Tab = accept; inside a snippet the same key silently means "next field" while the popup is staring at them. Enter accepts, Tab doesn't — inconsistent muscle memory in the flow (slash snippets) that most invites completion use. T4 sidesteps it by dismissing the popup first.

6. **Explicit Ctrl+Space union noise** (probe-verified, 42 rows on an empty doc/`title `-adjacent positions): 24 AWS/core annotations + 18 keywords + participants in one list. Power-user feature or wall of noise — undecided and untested (known-gaps #14).

7. **Keyword rows insert bare words while slash commands insert full templates**: accepting keyword `if` yields `if`; accepting `/if` yields `if(condition){…}` with tab stops. Two ergonomics for the same intent, undocumented; users who learn one are surprised by the other (known-gaps #10).

8. **/try field order**: first Tab lands in `catch(e)`, the FINAL cursor is the try body — every other block command puts the body last. Asserted as-is by M5, so the suite ratifies what looks like an oversight (known-gaps #11).

9. **Keyword/slash catalog mismatch**: `frame`/`opt`/`critical` keywords have no slash command; no `/title` at all; `/note` is block-only though comments are valid in head. A user who discovers features through `/` sees a different language than one who types letters (known-gaps #9).

10. **Z4's premise is now impossible**: "full-width dot still triggers the popup" cannot pass post-76bddeb, so the userEvent-preservation regression (09f95e3 — autocorrect silently killing autocomplete) is currently unguarded by any passing test. Needs re-grounding on `－＞` (gap #9) before anything touches the transactionFilter again.

11. **Head-greedy fabrication is load-bearing in tests**: a half-typed top-level word becomes a "participant" offered elsewhere (known-gaps #2), and the unit exclusion test deliberately exploits it (`Ali` genuinely in the source set). When the grammar milestone closes the gap, that test silently loses its premise — it should assert its own precondition.

12. **`a = new A()` offers nothing** (participantManager.ts:78): the renderer draws `a:A`, but neither `a` nor `A` is ever completable — asymmetric with anonymous `new X()` and invisible to the user as a rule (known-gaps #3).

13. **closeBrackets autopair is entirely incidental coverage**: every H/S indentation test runs with autopair live but no test asserts pair-insert, type-over-skip, or the full-width `（` no-pair asymmetry (gap #10). The editor injects characters users didn't type, and nothing pins when it does.

---

### Missed-bug history check (Autocomplete)

#803 keyword/annotation pollution after triggers — COVERED: Tree 2(e) "Type letter → participants only; NO keywords, NO annotations" (e2e U9/O2 + unit). The 2-space escape variant is in-tree as declared gap 3.

#804 message-introduced participants — COVERED: Tree 1 "Message-first authoring (#804 path)" (O4/O5, X3/X6/X7 + participantManager unit). Caveat: the original dot-trigger guards (U10/X1/X2) are dead at HEAD; arrow re-grounding is declared gap 8 — until written, only the line-start/Ctrl+Space variants hold the line.

#805 @ inside a label — COVERED for populated labels: Tree 2(g) "Type @ → NO annotations" (K7). The EMPTY-label variant is declared gap 1 and is bug-shaped at HEAD (keywords leak) — the class would recur there today.

#806 keyword leak in name slot — COVERED for the group alternation: Tree 2(c) "Type i → if NOT offered" (P9). The `@Actor <keyword-prefix>` alternation is declared gap 20 (GAP-UNSURE in tree).

#807 keyword-prefixed names split — PARTIAL: parse side covered at Tree 1 "@Actor ifService" (conformance/noFalsePositive.test.ts); the completion-OFFERING side is unguarded at HEAD (U6 stale) — declared gap 8. Live regression guard: MISSING until re-grounded.

#808 string participant labels — COVERED: Tree 2(k) (W3/W4 + participantManager string-label units).

#809 CJK names rejected — PARTIAL: grammar/parse covered by conformance; completion-side unit regexes exist, but the only e2e offering guard (W1) is stale at HEAD → live browser coverage MISSING (declared gap 8). The composition-EVENT half of IME reality was never covered at all (missingPaths #1).

#810/#811/#812 grammar under-accepts — MISSING from this tree: guarded outside it by noFalsePositive.test.ts (renderer-as-oracle invariant), but no typing path in the tree types quoted methods / `async A->B` / `loop(N)` / arg literals / bare `return` and asserts completion/zone behavior on top of those constructs.

#813 free-text completion noise — COVERED for the two known node types: Tree 2(g) Y1/Y2 and Tree 2(k) Y5. The class ANTIDOTE (an enumeration test of all free-text node types shared by both guards) is MISSING — proven live by the divider slot (missingPaths #11) and the post-dot method-slot guard divergence (missingPaths #12), exactly the predicted recurrence mode.

CJK-1 (961a221 empty-region boundary) — COVERED on the autocorrect side: Tree 2(h)/(i) first-char-preserved tests. Same class on the COMPLETION side is declared gaps 1/2 (bug-shaped at HEAD); the divider instance of the class is MISSING entirely (not even declared).

CJK-2 (09f95e3 userEvent drop) — MISSING at HEAD: the only observable test (Z4) asserts the dead dot premise and fails; declared gap 9 names the replacement (full-width `－＞`) but until written this interaction class has zero passing coverage.

CJK-3 (6eadeu8/0588b84 mapping-table mirroring) — MISSING: declared gap 22; cjkAutocorrect.test.ts still tests one-per-mapped-char, structurally unable to find an unmapped variant.

76bddeb post-dot suppression — COVERED: Tree 2(f) implicit suppression (unit + e2e editor-language dot test). Explicit-invoke variant is declared gap 7, and 12 stale e2e tests still assert the OLD behavior — until flipped, the suite actively contradicts the fix.

B4/J6 zone-default/boundary — COVERED: Tree 1 "/" (B1/B4) and Tree 2(j) comment paths (J6/U1).

e386b6e Tab-accept + b05e795 snippet Tab (wrong substrate) — COVERED: Tree 1 @→Tab (F1/A3/K5) and Tree 5(b) field nav (B6/M3/M7-M9), all browser e2e per the catalog policy.

42136b9 computed-style/visual — MISSING: the tree has no computed-style branch; for autocomplete specifically nothing asserts the popup's rendered properties (row font, selected-row highlight visibility), so this class would recur invisibly inside the popup.

ad4dc2a Head-greedy fabrication — covered OUTSIDE the tree by the conformance subset-invariant gate (cd5e0fb); inside the tree it appears only as the DEBATABLE #11 note on Tree 2(d). As an asserted typing path: MISSING (acceptable if the invariant gate is considered part of the suite, but the tree should cite it as coverage rather than a debatable).

---

## Indentation & typing mechanics

# Typing-Path Test Trees — INDENTATION subsystem (DSL editor, CM6)

All paths relative to `/Users/pengxiao/workspaces/zenuml/web-sequence/web/`. Marks: `[covered: …]`, `[covered-indirect: …]` (behavior is load-bearing in a passing test but never directly asserted), `[GAP]`, `[GAP-UNSURE]`, `[DEBATABLE: …]`.

---

## Tree 1 — ROOT: empty document (post-`clearEditor`, zone 'top', cursor at 0)

- **Type letter `A`** → plain insert; no popup fires (quiescent gate) [covered: e2e/catalog.spec.ts :: J5 — quiescent editor shows no completion popup]
  - **Type `.run` then `(` (next char = EOL)** → autopairs to `()`, cursor between [covered-indirect: e2e/catalog.spec.ts :: H2 — exact `toBe('A.run() {\n  B->C: hi\n}')` would fail if pairing misfired; never directly asserted]
    - **Type `)`** → type-over: skips the auto-closer, no duplicate `)` [covered-indirect: same H2 `toBe`; every spec typing `X() {` relies on it]
    - **Backspace (cursor between `()`)** → deletes BOTH chars (deleteBracketPair) [GAP — library-verified only; known-gap 10]
    - **Type letter** → plain insert inside parens `(x)` [covered-indirect: L/M snippet flows]
  - **Type ` {` at EOL** → autopairs `{}`, cursor between → continue at Tree 6A
- **Type `"` (next char = EOL)** → autopairs `""`, cursor between [GAP — known-gap 10: no quote-pairing test anywhere]
  - **Type `"` again** → type-over the auto-inserted closer (same-char pair, `closedBracketAt` path) [GAP]
- **Type `[`** → inserts bare `[` only — `[` deliberately excluded from DSL closeBrackets (`zenumlLanguage.ts:137`) [GAP — exclusion never asserted]
- **Enter** → newline, NO indent at top level [covered: e2e/catalog.spec.ts :: F5 — `toBe('abc\nx')`, no leading whitespace on `x`]
- **Tab (no popup, no snippet)** → falls through Prec.highest chain to indentWithTab → line indents one unit (2 spaces) [covered: e2e/catalog.spec.ts :: F2; e2e/editor-language.spec.ts :: 'Tab still indents when no completion is active' — both with text on the line; Tab on a fully EMPTY doc itself: GAP-UNSURE, same indentMore path]
- **Shift-Tab (no snippet)** → snippet binding returns false → falls through to indentLess (no-op at col 0; dedents an indented line) [GAP — the fall-through to indentLess is asserted only as a code comment (`zenumlAutocomplete.ts:373-375`); no test dedents a line via Shift-Tab]
- **Type full-width `＠`** → corrected to `@` (code position) AND annotation popup still opens (userEvent re-attached) [covered: transform by unit map (cjkAutocorrect.ts:64); popup-survival proven for `。` at e2e/catalog-extended.spec.ts :: Z4 — `＠`-specific composition GAP-UNSURE but same filter path]
- **Type `→` (U+2192, IME arrow suggestion)** → NOT corrected; unparseable char stays in the doc [GAP — known-gap 7; no mapping exists]
- **Paste single-line `。b（）` at code position** → whole pasted run corrected to `.b()` [covered: src/editor/cjkAutocorrect.test.ts :: 'corrects a whole pasted run of full-width punctuation in code' — unit only; ZERO browser paste tests exist]
- **Paste multi-line MIXED chunk `A->B: 你好。\nC。d()` at code position** → ENTIRE chunk remapped by insertion point → the pasted LABEL's `。` is corrupted to `.` [GAP — known-gap 1] [DEBATABLE: current behavior silently corrupts pasted CJK labels; classification should be per-line/per-span, not insertion-point-only]
- **Paste multi-line ASCII block (`A.a() {\n    B.b()\n}` with foreign indent)** → inserted verbatim; NO re-indent on paste (CM default) [GAP] [DEBATABLE: modern editors re-indent pasted blocks to cursor depth; current default keeps wrong indentation]
- **Undo / Redo (nothing typed)** → no-op [trivial, not worth a test]

---

## Tree 2 — ROOT: cursor mid-line inside existing code (e.g. doc `A.run()` / `  B->C: hi`)

- **Type `{` directly before a word char** (cursor before `run`) → bare `{` inserted, NO autopair (closeBefore guard: next must be EOL/ws/`)]}:;>`) [GAP — guard verified only in installed library source]
- **Type `{` directly before `)`** → autopairs (`)` is in the closeBefore set) [GAP-UNSURE]
- **Type `}` at EOL after other text** (line `  B->C: hi`) → plain insert, NO re-indent — `indentOnInput` regex `/^\s*[{}]$/` requires only-whitespace-then-brace (`zenumlLanguage.ts:139`) [GAP — only the fires-branch is tested (H2/S8); the does-NOT-fire branch never]
- **Enter mid-statement** (cursor inside `B->C: hi` on a body line) → line splits; continuation line indented to block-body level (delimitedIndent computes from context) [GAP]
- **Tab mid-line, no popup** → indentMore: whole line gains one unit at line start (cursor mapped), NOT spaces at cursor [covered: e2e/catalog.spec.ts :: F2 — same indentMore code path regardless of column; mid-line variant itself unasserted] [DEBATABLE: a user pressing Tab mid-label/mid-comment to align text gets the whole line pushed right instead of spacing at the cursor]
- **Mod-]** → indentMore / **Mod-[** → indentLess [covered: e2e/catalog-extended.spec.ts :: T9]
- **Mod-/** → toggles `// ` line comment (DSL commentTokens) [covered: e2e/catalog-extended.spec.ts :: T8]
- **Backspace between HAND-typed adjacent `()`** → deletes both (deleteBracketPair is not gated on auto-insertion) [GAP]
- **Backspace between `[` and `]`** → deletes only the `[` (`[` not in DSL bracket list) [GAP — known-gap 6 asymmetry never pinned]
- **Type full-width `（` mid-line in code** → corrected to `(`, NO auto-paired `)` — the rewrite bypasses closeBrackets entirely [covered-indirect: e2e/catalog-extended.spec.ts :: Z1/Z3 exact `toBe` would fail with an extra `)`] [DEBATABLE: CJK-IME users get no autopair affordance for the same logical keystroke ASCII users get; Z1/Z3/Z5 ratify the asymmetry]
- **Type keyword-colliding opener `ifService.run() {` then Enter** → body still indents one unit (parse must yield StatementBraceBlock despite the keyword prefix, #807) [GAP-UNSURE — U6 covers completion after `ifService.`, nothing covers its block's indentation]
- **Arrow keys (no popup)** → plain cursor movement, no indent side effects [trivial]

---

## Tree 3 — ROOT: cursor inside a block body (e.g. `par {` + Enter → indented empty body line, zone 'block')

- **Press Enter (again, empty indented line)** → next line CONTINUES at body indent [GAP — see gaps #9: every existing test immediately overwrites this line with `}` or a nested opener, so a keep-indent regression to col 0 would pass H2/S8 unchanged]
- **Type statement `B->C: hi`, then Enter** → new line continues at body indent (2 spaces) [GAP — same blind spot; the e2e asserts only the FIRST post-`{` Enter (` {2}$`) and the FINAL `}`-dedented state]
- **Type `}` as the only non-ws char on the line** → indentOnInput re-indents the line to the opener's column [covered: e2e/catalog.spec.ts :: H2; e2e/editor-language.spec.ts :: 'Enter inside a block indents one unit; typing `}` dedents'; e2e/catalog-extended.spec.ts :: S8 (across 3 depths, exact `toBe`), S9 (GroupBraceBlock closer)]
- **Type nested opener `B.b() {` (auto-paired), Enter** → depth-2 body at 4 spaces; depth-aware, not copy-previous [covered: e2e/catalog.spec.ts :: H3; e2e/editor-language.spec.ts :: 'nested block body indents one unit per depth'; e2e/catalog-extended.spec.ts :: S7 (2/4/6), U5 (+ zero markers)]
- **Same per opener kind** — `group Name {` / `group {` / `while(x) {` / `opt {` / `try {` / `critical {` bodies all indent one unit [covered: e2e/catalog-extended.spec.ts :: S1–S6]; `if(ready) {` [covered: e2e/catalog.spec.ts :: H4; e2e/editor-language.spec.ts :: 'if-block body indents one unit']
- **Author UNCLOSED nesting** (Delete each auto-closer, then Enter at depth ≥2) → behavior unspecified: Lezer error recovery may not produce nested StatementBraceBlock nodes, so depth-aware indent can degrade [GAP — known-gap 9; the nested e2e explicitly avoids this ('do NOT delete the auto-pair here'); single-level unclosed IS covered: e2e/editor-language.spec.ts journey 6 and e2e/catalog-extended.spec.ts :: Z5]
- **Over-indent the line (Tab, Tab), then type `{` as only char** → indentOnInput re-indents the line back to context indent (the `{` half of `/^\s*[{}]$/`) [GAP — known-gap 10, explicitly named untested]
- **Type `if(x) {`…`}` then ` else {` + Enter** → `}` dedents at typing time, ` else {` appends, else-body indents one unit [GAP — no else-chain authoring test]
- **Type `｝` or `』` as only char on the line** → corrected to `}` AND indentOnInput dedent still fires (userEvent re-attachment makes the rewritten tr count as input) [covered: e2e/catalog-extended.spec.ts :: Z5 — final `toBe` has the corrected `}` at col 0]
- **Type `@`** → no annotation popup in block (autocomplete guard, included as cross-check) [covered: e2e/catalog.spec.ts :: A5, D3]
- **Ctrl+Space on the empty body line** → participants/block keywords, never annotations [covered: e2e/catalog-extended.spec.ts :: O8 — autocomplete subsystem]
- **Backspace at start-of-text on the indented empty line** → deletes indentation (CM6 deleteCharBackward in indentation context) [GAP-UNSURE — exact CM6 semantics (whole unit vs single space) unverified, no test]
- **Paste a statement carrying deeper/foreign indentation** → pasted verbatim, no re-indent to context [GAP]

---

## Tree 4 — ROOT: selection active (type-over)

- **Select a word, type `(`** → WRAPS selection: `(word)` [GAP — known-gap 10]
- **Select a word, type `{`** → wraps `{word}` [GAP]
- **Select a word, type `"`** → wraps `"word"` [GAP]
- **Select a word, type `[`** → REPLACES the selection with `[` (no wrap — `[` not in bracket set) [GAP — user-visible consequence of the exclusion, never pinned]
- **Select a word, type a letter** → replaces selection (CM default) [GAP-UNSURE — trivial, no explicit test]
- **Select multiple lines, Tab** → indentMore on every selected line [GAP]
- **Select multiple lines, Shift-Tab** → indentLess on every selected line [GAP]
- **Selection active, Backspace** → deletes selection only — deleteBracketPair requires an EMPTY selection [GAP-UNSURE]
- **Select text inside a LABEL, type `。`** → replacement classified by the selection's start (`fromA`) = free text → `。` preserved [GAP — replacement-(non-empty-range)-path of the filter untested; unit tests insert at empty cursors only]
- **Select text in CODE, type `。`** → corrected to `.` [GAP — same untested path]
- **Two cursors (multi-cursor), one in code + one in a label, type `。`** → per-change classification: code cursor corrected, label cursor preserved within ONE transaction (`cjkAutocorrect.ts:159-170`) [GAP — code supports it, zero tests]
- **Two cursors each between `{}` pairs, Backspace** → all-or-nothing deleteBracketPair (fires only if EVERY cursor qualifies) [GAP]

---

## Tree 5 — ROOT: just-accepted completion/snippet (popup closed)

### 5A. `/sync` accepted in a block (2 numbered fields, field 1 active)
- **Tab** → jumps to field 2 — snippet nav outranks indent (Prec.highest chain step 1) [covered: e2e/catalog.spec.ts :: B6; e2e/editor-language.spec.ts :: '/sync field 1 then Tab to field 2'; field count ≥1 guards the basicSetup-identity regression]
- **Shift-Tab (in field 2)** → back to field 1; field-2 text survives [covered: e2e/catalog.spec.ts :: B7, F6; e2e/editor-language.spec.ts :: Shift-Tab journey]
- **Type into a field, popup opens, Escape, then Tab** → popup dismissed, snippet still active, Tab advances field [covered: e2e/catalog-extended.spec.ts :: T4]
- **Tab past the last field** → snippet session ends [covered: e2e/catalog-extended.spec.ts :: M9]
  - **Tab again** (no field, no popup) → falls through to indentMore [covered: e2e/catalog-extended.spec.ts :: T6 — final-stop-only `/par` snippet]
- **Enter inside the active snippet** → newline + auto-indent (4-space continuation asserted), NOT a field jump [covered: e2e/catalog-extended.spec.ts :: T5]
- **Escape (twice)** → popups closed, template text fully intact [covered: e2e/catalog-extended.spec.ts :: T7]
- **Arrow the cursor OUT of the active field, then Tab** → does field navigation still fire / target the right field? [GAP-UNSURE — no test moves the cursor away from a field before Tab]
- **Undo immediately after snippet insert** → whole template removed in one step? [GAP-UNSURE — history granularity of snippet apply untested]

### 5B. `@` + Tab accepted `@Actor` (no snippet)
- Doc is exactly `@Actor` — Tab accepted, did NOT indent (no leading whitespace) [covered: e2e/editor-language.spec.ts :: 'Tab accepts the highlighted @-annotation'; e2e/catalog.spec.ts :: F1, A3 — absence-asserting, the right pattern]
- **Tab again** (popup closed, no snippet) → falls through to line indent [GAP-UNSURE — post-accept fall-through composition untested; same indentMore path as F2]
- **ArrowDown/ArrowUp while popup was open (before accept)** → row navigation, Enter accepts the highlighted row [covered: e2e/catalog-extended.spec.ts :: T2, T3]

---

## Tree 6 — ROOT: after the editor auto-inserted something

### 6A. just typed `{` at EOL → doc `…{|}` (auto-paired, cursor between)
- **Enter** → three-line split: opener line / indented empty body line (cursor) / closer on its own line
  - body line indented one unit [covered: e2e/catalog.spec.ts :: H1 (via enterParBlock), H4; e2e/editor-language.spec.ts :: if-block test]
  - auto-closer lands on its own line AT THE OPENER'S COLUMN [GAP — never asserted: H1/H3/H4/S7/U5 all regex-match only the opener/body prefix; the closer's final column after a split has zero coverage at any depth]
- **Type `}`** (cursor directly before the auto-closer) → type-over: skips it, no duplicate [GAP — unlike `)`, no test path ever types `}` against a pending auto-closer]
- **Backspace** → deletes BOTH braces [GAP — known-gap 10]
- **Delete** → removes only the auto-closer, leaving a bare opener [covered-indirect: helper `openBlockWithoutAutoClose` (e2e/helpers/editor.ts:134-137) is load-bearing in H2, S1–S6, S8, S9]
- **Type a letter** → inserts between the braces `{x}` [trivial]

### 6B. just typed `(` → `(|)`
- **Type `)`** → type-over [covered-indirect: every `X() {` typing path; exact `toBe` in e2e/catalog.spec.ts :: H2]
- **Backspace** → deletes both [GAP]

### 6C. just typed `"` → `"|"`
- **Type `"`** → type-over (auto-inserted closer / `closedBracketAt`) [GAP]
- **Type label text inside** → plain insert; the String span is free text for CJK autocorrect [covered: src/editor/cjkAutocorrect.test.ts :: 'keeps （ inside a quoted string label']

### 6D. the editor just AUTOCORRECTED a full-width char
- **`。`→`.` after a participant name** → completion popup still opens (userEvent re-attached to the rewritten transaction) [covered: e2e/catalog-extended.spec.ts :: Z4; mechanism at cjkAutocorrect.ts:172-184]
- **`（`→`(`** → NO auto-paired `)` (rewrite bypasses closeBrackets) [covered-indirect: Z1/Z3 exact `toBe`] [DEBATABLE — see Tree 2]
- **`『`/`｛`→`{`** → NO autopair; subsequent Enter still indents one unit; later `』`→`}` still dedents via indentOnInput [covered: e2e/catalog-extended.spec.ts :: Z5 end-to-end; unit '『』 → {} opening a block', '｛ → { opening a block']
- **`【`→`[`** → corrected but `[` never pairs and Backspace won't eat `[]` [GAP — known-gap 6] [DEBATABLE: map-vs-bracket-set inconsistency]
- **Undo right after a corrected char** → one history step removes the corrected char; the ORIGINAL full-width char is NOT restored [GAP] [DEBATABLE: autocorrect convention (Word/iOS) restores the literal typed char on undo; here a user who WANTS `。` in a code position has no escape hatch]
- **Redo** → re-applies the corrected char (history stores the rewritten transaction) [GAP-UNSURE]
- **Full-width char typed in free text** (label / title / comment / string / divider / FIRST char of an empty label or right after the colon) → preserved verbatim; no indentation machinery fires [covered: src/editor/cjkAutocorrect.test.ts :: 'preserves…' suite + 'empty free-text regions' suite; e2e/catalog-extended.spec.ts :: Z2]
- **Programmatic dispatch / undo / redo containing full-width chars** → never corrected (userEvent gate) [covered: src/editor/cjkAutocorrect.test.ts :: 'does NOT correct a programmatic (non-user) change']

### 6E. mode/shell interactions on any of the above
- **Toggle Vim mode, then replay Tab/snippet/autopair/indent paths** → compartment reconfigure must not reorder the Prec.highest chain or break autopair [GAP — known-gap 10; zero vim-interaction tests]
- **CSS editor variant**: default bracket set (`( [ { ' "` all pair), Emmet abbreviationTracker on Tab vs indent precedence [GAP — no CSS-editor typing test]

---

### Critic additions (Indentation & typing mechanics)

Paths absent from BOTH the tree and its 26 declared gaps. Sources verified in /Users/pengxiao/workspaces/zenuml/web-sequence/web/src/editor/ and web/e2e/.

1. TRUE IME COMPOSITION EVENTS — an entire input-channel dimension is absent. Every Z-test uses Playwright keyboard.type, which commits text WITHOUT compositionstart/update/end; cjkAutocorrect.ts:17 claims transactionFilter robustness to composition but nothing exercises it. Variants: (a) compose-and-commit `。` after a participant name in code → on commit, autocorrect fires AND popup opens (the composition twin of Z4); (b) compose `｝` as the only char on a whitespace-only body line → after compositionend, correction + indentOnInput dedent (CM6 defers transactions during composition — does the deferred commit still carry userEvent 'input.type'?); (c) Enter/Tab pressed mid-composition → needs-spec. Layer: e2e via CDP Input.imeSetComposition (Playwright keyboard alone is the wrong substrate — taxonomy class 7 recurring one level deeper, on the feature whose entire constituency is IME users).

2. FULL-WIDTH PUNCT IN THE METHOD-NAME AND METHOD-ARG SLOTS — the tree's slot inventory (label/title/comment/string/divider) omits MethodName and args. isFreeTextSpan (cjkAutocorrect.ts:111-145) does NOT list MethodName, so `A.支付。()` gets the `。` corrected to `.` — yet completion (76bddeb) treats post-dot as a free-text method slot, and the renderer accepts quoted/arbitrary method text (#808/#810). Autocorrect and autocomplete classify the SAME slot oppositely. needs-spec (is MethodName free text?), then unit. Same question for bare vs quoted args: `A.b(你好。)` vs `A.b("你好。")`.

3. CJK-IDENTIFIER BLOCK OPENER INDENT — `订单服务.保存() {` + Enter → body indents one unit. Every indentation test (H/S/U series) uses ASCII openers; the #809 fix must extend through indentNodeProp/delimitedIndent. e2e, cheap S-series clone.

4. POPUP OPEN INSIDE AN ACTIVE SNIPPET FIELD: (a) Tab → per zenumlAutocomplete.ts:370 hasNextSnippetField runs BEFORE acceptCompletion, so Tab field-jumps and abandons the popup — never tested, arguably needs-spec (which should win is a UX decision); (b) Enter → acceptCompletion wins over newline — never tested. T4 deliberately presses Escape first, sidestepping both. e2e.

5. POPUP-OPEN x AUTOPAIR/INDENT — with the popup open, type a non-matching opener: `{` at EOL (popup closes/refilters; autopair must STILL fire), and from the O8 state (Ctrl+Space on an empty body line) type `}` (popup closes; indentOnInput dedent must still fire). The popup-open interaction matrix in the tree covers only Enter/Tab/Escape/Arrows — never 'type a structural char'. e2e.

6. POPUP OPEN, CLICK ELSEWHERE — popup closes, nothing inserted, no indent side effect. e2e (minor; also the click-out-of-snippet-field twin of tree 5A's arrow-out GAP-UNSURE).

7. PASTE OVER A SELECTION — replacement classified by fromA (cjkAutocorrect.ts:161): select label text, paste code containing `（）` → preserved (start-of-range in label) even though the content is code; converse for code selections. Gaps 14/15/17 cover paste-at-cursor and TYPE-over-selection, not paste-over-selection. unit.

8. PASTE TEXT CONTAINING `{ } ( )` PAIRS — closeBrackets must NOT double them and indentOnInput must NOT re-indent on paste (both are typed-input-gated). Never pinned; one e2e alongside gap 16.

9. CRLF — paste `A.a() {\r\n  b\r\n}` → CM normalizes to LF; assert no `\r` survives (note `/^\s*[{}]$/` would still match `  }` with a stray `\r` via `\s`, so pin the normalization, not the regex). Also a doc loaded from persistence with CRLF. e2e or unit. The string "CRLF" appears nowhere in the tree or gaps.

10. PASTE METADATA TWIN OF 09f95e3 — when the transactionFilter rewrites a PASTE, assert the rebuilt transaction retains userEvent 'input.paste' (Z4 proves re-attachment for typing only; the paste unit test asserts text, not metadata). unit.

11. DRAG-AND-DROP — 'input.drop' matches isUserEvent('input') at cjkAutocorrect.ts:155, so dragging label text containing `。` onto a code position remaps it (same corruption class as gap 14); dragging code into a label preserves it raw. needs-spec + unit; drop appears nowhere in the tree.

12. MULTI-LINE PASTE INTO AN ACTIVE SNIPPET FIELD — does the field mapping/session survive? needs-spec, e2e.

13. STRUCTURAL DELETION — (a) delete the OPENING `{` of a populated closed block → body lines keep stale indent (pin the CM no-reindent default), and the next Enter inside the former body computes indent from the error-recovered tree (exploratory, like gap 13); (b) Backspace at column 0 of an indented body line → joins onto the line above, indent whitespace becomes embedded mid-line spaces. e2e. (The prompt's 'delete a participant name other lines reference' is a participant/completion-tree concern — X3 covers the rename half there; it has no indentation effect and is correctly out of this tree's scope.)

14. UNDO/REDO BEYOND GAP 18 — (a) undo after a `}`-triggered indentOnInput re-indent: one step must revert BOTH the `}` and the re-indent (a half-revert strands an over-indented line); (b) redo after undoing an autopair: is the restored closer still type-over-able, or does the next `)` now double? (closeBrackets' pending-closer state vs history — needs-spec); (c) undo after Tab-accepting `@Actor`: removes the whole inserted label, not the completion minus the typed prefix. e2e (history granularity is metadata-class, browser-only).

15. SNIPPET TEMPLATE RE-INDENT AT DEPTH — accept /try at depth >= 1: the `} catch(e) {` middle line and final `}` must land at the opener's column (snippet() re-indents template lines; B5/B6/B8 are toContain-only, T5/T6 pin only the body line). /try is the only template whose closer columns are produced by snippet(), not delimitedIndent. e2e. Note: T5 already pins the /if body line at 4 spaces — the tree never lists template re-indent as a path at all.

16. INDENTATION INVARIANT GATE (ad4dc2a antidote, absent for this subsystem) — property-style check over generated docs: for every opener kind x depth 1-4, body indent == opener + 1 unit AND closer column == opener column. The whole tree is example-based; the historical record (ad4dc2a, cd5e0fb) shows invariant gates catch what examples miss. Unit-feasible (indent queries run against the language facet without a browser) + one e2e spot-check.

17. KEYWORD-PREFIX x OPENER ENUMERATION — gap 21 has only `ifService`; class-5's lesson is that the equivalence class needs enumeration: `whileSvc(x) {`, `parX() {`, `optY`, `tryZ`, `elseHandler`, etc., each + Enter → body indents. Cheap loop, unit at indent-computation level or e2e.

18. TRAILING-WHITESPACE INDENT MATH — `par { ` (trailing space) + Enter → body still indents; whitespace-only body line with trailing spaces, then `}` → still dedents. U7 covers trailing-ws only for participant collection. e2e, minor.

---

### Gap ledger (Indentation & typing mechanics)

- **TT-I1** — Backspace with cursor between adjacent `{}` / `()` / `""` (auto- OR hand-typed) → deletes both chars → e2e — keymap mechanics don't run faithfully in jsdom (taxonomy class 7: wrong substrate); today guaranteed only by reading the installed library.
- **TT-I2** — Backspace between `[` and `]` → deletes only `[` (deliberate exclusion from the bracket set) → e2e, same spec as #1 — pins the asymmetry so a future "add [ to brackets" change is a conscious decision.
- **TT-I3** — Cursor before a pending auto-paired `}`, type `}` → type-over, no duplicate → e2e — the `)` twin is implicitly load-bearing in every `X() {` test, but the `}` variant is exercised nowhere; a regression would double every hand-closed block.
- **TT-I4** — Type `"` at EOL → autopairs `""`; type `"` again → type-over → e2e — quotes are a configured DSL pair (`zenumlLanguage.ts:137`) with zero coverage; quoted labels/method names (#808/#810) make this a real authoring path.
- **TT-I5** — Selection + opener: select a word, type `(` / `{` / `"` → wraps selection; type `[` → replaces it → e2e — selection-wrap is a distinct closeBrackets branch (handleOpen non-empty-range) with no coverage.
- **TT-I6** — Type `{` directly before a word char → bare `{`, NO autopair (closeBefore guard) → e2e — the only autopair-suppression branch; users hit it when retro-wrapping existing code.
- **TT-I7** — Type `}` at EOL after other text on the line → NO re-indent (indentOnInput regex only-whitespace guard, `zenumlLanguage.ts:139`) → e2e — only the fires-branch (H2/S8) is tested; the negative branch protects labels/statements from spurious re-indent.
- **TT-I8** — Over-indent a body line (Tab Tab), then type `{` as the only char → line re-indents to context (the `{` half of `/^\s*[{}]$/`) → e2e — explicitly named untested in the code inventory.
- **TT-I9** — Enter after a COMPLETED statement on an indented body line → next line continues at body indent → e2e — the single most consequential indent gap: every existing test overwrites this intermediate line (with `}` or a nested opener), so a regression where Enter dropped to column 0 would keep H2/S8/S9 green while breaking every multi-statement block a user types.
- **TT-I10** — Enter between an auto-paired `{}` → the auto-closer lands on its own line at the OPENER's column (incl. at depth ≥2) → e2e — extend H1: only the body-line indent is asserted today; a closer left at body indent or glued to the body line is invisible to the current regexes.
- **TT-I11** — Enter mid-statement (cursor inside `B->C: hi` on a body line) → continuation line indented to body level → e2e — line-splitting is a daily editing action with no coverage.
- **TT-I12** — Shift-Tab with no snippet active → falls through to indentLess and dedents the line → e2e — asserted only by a source comment; F6 tests the snippet branch, T9 tests Mod-[, nothing tests plain Shift-Tab dedent.
- **TT-I13** — Unclosed nested openers (Delete each auto-closer), then Enter at depth ≥2 → pin the actual behavior under Lezer error recovery → e2e (exploratory first, then assert) — known-gap 9; the nested e2e deliberately avoids it, yet incremental top-down authoring (taxonomy class 6) hits it constantly.
- **TT-I14** — Paste a multi-line MIXED chunk (`A->B: 你好。\nC。d()`) at a code position → today the pasted label's `。` is corrupted → unit first (transactionFilter is pure; fix needs per-line/per-span classification) + one browser paste journey — known-gap 1, and there is currently NO paste test in any browser.
- **TT-I15** — Paste full-width-punctuation code at a FREE-TEXT position → left verbatim (currently broken-by-design via insertion-point classification) → unit — the paste×free-text quadrant of the gate matrix is untested (only paste×code exists).
- **TT-I16** — Paste a multi-line ASCII block carrying foreign indentation → inserted verbatim, no auto-reindent → e2e — pins the CM-default behavior (or motivates reindent-on-paste); doubles as the only ASCII paste test.
- **TT-I17** — Selection-replacement and multi-cursor CJK classification: select label text and type `。` (preserved), select code and type `。` (corrected), two cursors straddling code+label in one transaction → unit — `iterChanges` per-change logic (`cjkAutocorrect.ts:159-170`) has zero non-empty-range or multi-cursor tests.
- **TT-I18** — Undo granularity: after an autocorrected char (corrected char removed — original NOT restored), after an autopair (both chars removed in one step), after Enter-indent (newline+indent as one step) → e2e — history composition with the transactionFilter is exactly the metadata-blindness class (taxonomy 8) that shipped the userEvent-drop bug.
- **TT-I19** — `→` (U+2192) and other arrow-like IME outputs → currently unmapped/unparseable; decide mapping, then unit-test by enumerating the Unicode arrow/punct category INDEPENDENTLY of the shipped map (taxonomy class 9: don't mirror the implementation's table) — known-gap 7.
- **TT-I20** — Multi-line selection + Tab / Shift-Tab → indentMore/indentLess applied per selected line → e2e — block re-indentation is a core editing gesture with no coverage.
- **TT-I21** — Keyword-colliding opener `ifService.run() {` + Enter → body indents one unit (StatementBraceBlock must survive the #807 seam) → e2e — U6 covers completion after `ifService.` but nothing covers indentation of its block (taxonomy class 5).
- **TT-I22** — if/else authoring: `if(x) {` Enter body Enter `}` ` else {` Enter → `}` dedents, else-body indents → e2e — multi-clause control flow is typed daily; only single-block openers are covered.
- **TT-I23** — Vim mode ON × the whole Tab/snippet/autopair/indent chain → e2e — compartment reconfigure could reorder Prec precedence (the exact failure mode of e386b6e/b05e795); known-gap 10.
- **TT-I24** — CSS editor: default bracket set pairs `[` and `'`; Emmet abbreviationTracker Tab expansion vs indent precedence → e2e — the CSS variant has zero typing-mechanics coverage.
- **TT-I25** — Backspace at start-of-text on an indented empty body line → GAP-UNSURE whether CM6 deletes a full indent unit or one space → e2e to pin whichever is true.
- **TT-I26** — Tab on a completely empty document/line → indents the empty line one unit → e2e (cheap add-on to F2) — boundary-position class (taxonomy 10).
- **TT-I27** *(critic — full text: Critic additions #1)* — TRUE IME COMPOSITION EVENTS — an entire input-channel dimension is absent.
- **TT-I28** *(critic — full text: Critic additions #2)* — FULL-WIDTH PUNCT IN THE METHOD-NAME AND METHOD-ARG SLOTS — the tree's slot inventory (label/title/comment/string/divider) omits MethodName and args.
- **TT-I29** *(critic — full text: Critic additions #3)* — CJK-IDENTIFIER BLOCK OPENER INDENT — `订单服务.保存() {` + Enter → body indents one unit.
- **TT-I30** *(critic — full text: Critic additions #4)* — POPUP OPEN INSIDE AN ACTIVE SNIPPET FIELD: (a) Tab → per zenumlAutocomplete.ts:370 hasNextSnippetField runs BEFORE acceptCompletion, so Tab field-jumps and abandons the popup — never tested, arguably needs-spec (which …
- **TT-I31** *(critic — full text: Critic additions #5)* — POPUP-OPEN x AUTOPAIR/INDENT — with the popup open, type a non-matching opener: `{` at EOL (popup closes/refilters; autopair must STILL fire), and from the O8 state (Ctrl+Space on an empty body line) type `}` (popup …
- **TT-I32** *(critic — full text: Critic additions #6)* — POPUP OPEN, CLICK ELSEWHERE — popup closes, nothing inserted, no indent side effect.
- **TT-I33** *(critic — full text: Critic additions #7)* — PASTE OVER A SELECTION — replacement classified by fromA (cjkAutocorrect.ts:161): select label text, paste code containing `（）` → preserved (start-of-range in label) even though the content is code; converse for code …
- **TT-I34** *(critic — full text: Critic additions #8)* — PASTE TEXT CONTAINING `{ } ( )` PAIRS — closeBrackets must NOT double them and indentOnInput must NOT re-indent on paste (both are typed-input-gated).
- **TT-I35** *(critic — full text: Critic additions #9)* — CRLF — paste `A.a() {\r\n b\r\n}` → CM normalizes to LF; assert no `\r` survives (note `/^\s*[{}]$/` would still match ` }` with a stray `\r` via `\s`, so pin the normalization, not the regex).
- **TT-I36** *(critic — full text: Critic additions #10)* — PASTE METADATA TWIN OF 09f95e3 — when the transactionFilter rewrites a PASTE, assert the rebuilt transaction retains userEvent 'input.paste' (Z4 proves re-attachment for typing only; the paste unit test asserts text, …
- **TT-I37** *(critic — full text: Critic additions #11)* — DRAG-AND-DROP — 'input.drop' matches isUserEvent('input') at cjkAutocorrect.ts:155, so dragging label text containing `。` onto a code position remaps it (same corruption class as gap 14); dragging code into a label …
- **TT-I38** *(critic — full text: Critic additions #12)* — MULTI-LINE PASTE INTO AN ACTIVE SNIPPET FIELD — does the field mapping/session survive?
- **TT-I39** *(critic — full text: Critic additions #13)* — STRUCTURAL DELETION — (a) delete the OPENING `{` of a populated closed block → body lines keep stale indent (pin the CM no-reindent default), and the next Enter inside the former body computes indent from the …
- **TT-I40** *(critic — full text: Critic additions #14)* — UNDO/REDO BEYOND GAP 18 — (a) undo after a `}`-triggered indentOnInput re-indent: one step must revert BOTH the `}` and the re-indent (a half-revert strands an over-indented line); (b) redo after undoing an autopair: is …
- **TT-I41** *(critic — full text: Critic additions #15)* — SNIPPET TEMPLATE RE-INDENT AT DEPTH — accept /try at depth >= 1: the `} catch(e) {` middle line and final `}` must land at the opener's column (snippet() re-indents template lines; B5/B6/B8 are toContain-only, T5/T6 pin …
- **TT-I42** *(critic — full text: Critic additions #16)* — INDENTATION INVARIANT GATE (ad4dc2a antidote, absent for this subsystem) — property-style check over generated docs: for every opener kind x depth 1-4, body indent == opener + 1 unit AND closer column == opener column.
- **TT-I43** *(critic — full text: Critic additions #17)* — KEYWORD-PREFIX x OPENER ENUMERATION — gap 21 has only `ifService`; class-5's lesson is that the equivalence class needs enumeration: `whileSvc(x) {`, `parX() {`, `optY`, `tryZ`, `elseHandler`, etc., each + Enter → body …
- **TT-I44** *(critic — full text: Critic additions #18)* — TRAILING-WHITESPACE INDENT MATH — `par { ` (trailing space) + Enter → body still indents; whitespace-only body line with trailing spaces, then `}` → still dedents.

---

### Debatable behavior (Indentation & typing mechanics) — needs a product decision, NOT a ratifying test

1. Undo after a CJK autocorrect deletes the corrected char and NEVER restores the typed original (`。`). Every mainstream autocorrect (Word, iOS, Google Docs) reverts the correction to the literal typed character on undo, giving the user an escape hatch. Here a CJK user who intentionally wants full-width punctuation in a code-classified slot (e.g. a CJK method name — see item 4) has no way to keep it. Currently untested in either direction, so the behavior could be fixed without flipping any test.

2. Autocorrected full-width openers (`（ ｛ 『`) do not autopair, while their ASCII twins do. The rewrite happens in a transactionFilter after closeBrackets has already passed on the (non-bracket) full-width char, so a CJK-IME user typing the same logical keystroke gets a strictly worse affordance: no auto-closer, no type-over, no Backspace-pair. Worse, Z1/Z3/Z5's exact `toBe` assertions RATIFY this asymmetry — the implementation-as-oracle trap (taxonomy 2): if someone later makes corrected openers pair (arguably the right UX), three green tests will fight the fix.

3. `【】〔〕→[]` and `‘’→'` are in the autocorrect map, but `[` and `'` are excluded from the DSL closeBrackets list. So the editor actively steers users INTO characters it then refuses to pair or pair-delete. Either the map should not produce `[`/`'` (if they're not meaningful DSL chars) or the bracket set should include them; the current half-measure is incoherent and no comment reconciles it (known-gap 6).

4. The after-dot slot is classified OPPOSITELY by two subsystems: autocomplete treats `Name.|` as a free-text METHOD name (suppresses all completions, 76bddeb), while CJK autocorrect treats the identical position as CODE (`A.save` + `（）` → corrected). Probably intentional — `订单服务。save（）` should become `.save()` — but a CJK method name with deliberate full-width punctuation gets silently rewritten, and the divergence is undocumented. At minimum a reconciling comment + a test naming the asymmetry as intended.

5. Tab with no popup/snippet and the cursor mid-line indents the WHOLE line (indentMore) rather than inserting spacing at the cursor. F2 asserts the line-indent outcome (cursor at Home, where both interpretations coincide), so the mid-line behavior is technically unpinned. A user pressing Tab inside a message label to align text gets the entire statement pushed right — semantically meaningless indentation on a single-line-statement DSL where leading whitespace carries no meaning outside blocks.

6. Paste performs no re-indentation: a block copied from depth 2 and pasted at depth 0 (or from chat/docs with foreign indentation) keeps its source indent. CM's default, but VS Code-class editors re-indent on paste; in a DSL where users assemble diagrams by pasting snippets, wrong indentation on every paste is friction. Untested today (gap #16), so the decision is still free.

7. The indent unit is the hard-coded CM6 default (2 spaces) with no `indentUnit`/`tabSize` setting and no way to use tab characters. Fine as a deliberate house style for a DSL, but it is currently an accident of "no override exists" (`zenumlLanguage.ts:119-120` comment) rather than a decision — and the e2e suite's ` {2}` regexes would all break if anyone ever adds the setting, which is either a useful tripwire or 20 tests encoding an unmade decision, depending on intent.

---

### Missed-bug history check (Indentation & typing mechanics)

Per generalized taxonomy class (with named incidents folded in):

1. FREE-TEXT-AS-CODE (#805, #813 x2, J6, CJK empty-label, 76bddeb): PARTIAL. Tree 6D's preservation suite + Tree 4 'select label text, type 。' + Tree 1 mixed-paste path carry the class, and 961a221's empty-first-char edge is covered (6D, unit). BUT the slot enumeration omits MethodName/method-args (missingPaths #2) — exactly the #813 recurrence mode ('fixing one node type doesn't fix the class; the enumeration itself needed a test'). The next miss in this class is already visible in cjkAutocorrect.ts:111.

2. DESIGNED-BUT-WRONG / IMPLEMENTATION-AS-ORACLE (#808, #810-812, ad4dc2a, 76bddeb): PARTIAL. The tree's [DEBATABLE] flags (paste corrupts CJK labels; CJK users get no autopair; Tab mid-line pushes the whole line) are the right user-lens instrument and explicitly say Z1/Z3/Z5 'ratify the asymmetry'. But the structural antidote that ended ad4dc2a — an external invariant gate — has no indentation analog (missingPaths #16); every assertion mirrors what delimitedIndent currently computes.

3. IME/NON-ASCII (#809, CJK series): PARTIAL. Tree 1 ＠, Tree 3 ｝/』 (Z5), 6D unit suite cover committed text; MISSING: any true composition-event path (missingPaths #1) and CJK-identifier openers feeding the indenter (#3). The Z tests run keyboard.type — the same wrong-substrate failure mode as e386b6e, one level deeper.

4. POSITIVE-ONLY ASSERTIONS (#803): COVERED. Tree 5B asserts absence ('no leading whitespace', F1/A3), gap 7 is the does-NOT-fire branch of indentOnInput, Tree 2 lists the no-autopair-before-word-char guard. The tree consciously tests negatives.

5. ADVERSARIAL IDENTIFIERS (#806, #807): PARTIAL. Tree 2 `ifService.run() {` + gap 21 names the path, but with a single exemplar; the class's lesson demands enumerating every keyword prefix x opener (missingPaths #17).

6. AUTHORING-STYLE GAP (#804, X1): COVERED-AS-DECLARED. Gaps 9 (Enter-continuation) and 13 (unclosed nested authoring) are the right paths, still unimplemented. Correction: gap 9 overstates — T5 already pins Enter-after-completed-statement continuation at 4 spaces ('X.y()\n    Z.z()') inside a snippet-built closed block; the live hole is narrower (typed flow with the auto-paired closer).

7. WRONG SUBSTRATE (e386b6e, b05e795): COVERED for keymap/snippet/popup — institutionalized (all such paths routed to browser e2e; F1/A3 cover the e386b6e Tab-accept precedence, 5A's field-count guards the b05e795 identity regression). EXCEPT: composition is the next substrate cliff and is uncovered (missingPaths #1).

8. METADATA/FEATURE-INTERACTION BLINDNESS (09f95e3): PARTIAL. Z4 covers userEvent re-attachment for typing (Tree 6D); gap 18 covers history composition. MISSING: the paste-path userEvent twin (missingPaths #10) and redo-vs-pending-closer state (#14b) — both are precisely transaction-metadata class.

9. MIRROR-THE-IMPLEMENTATION ENUMERATION (6eadee8/0588b84): COVERED-AS-DECLARED. Gap 19 explicitly prescribes enumerating the Unicode category independently of the shipped map. Until implemented, the unit suite still mirrors the table.

10. ZONE-DEFAULT/BOUNDARY (B4/J6, EOF clamps): COVERED-AS-DECLARED for empty-doc (Tree 1 root, gap 26); MISSING boundaries: CRLF (missingPaths #9) and EOF-without-trailing-newline closer typing.

Named incidents not mapped above: 42136b9 (computed styles) — out of this tree's scope by design; the catalog's G/R series owns it; no indentation analog needed. #803/#804/B4 completion-side specifics — owned by the autocomplete tree, correctly cross-referenced here only where they gate indentation (A5, D3, O8).

---

## Status updates (2026-06-10, same day as authoring)

First implementation tranche landed (unit: `npx vitest run src/editor/`; e2e: `typing-mechanics.spec.ts`):

- **Implemented → covered**: TT-H1, TT-H9/H36 (free-text keyword-color suite, `zenumlLanguage.test.ts`); TT-A22 (anti-mirroring enumeration, `cjkAutocorrect.test.ts`); TT-I42 (indent invariant gate, NEW `indentInvariant.test.ts` — `group` covered at depth 1 only, head-level by grammar); TT-I1, I3, I9, I10, I11, I12, I20 (NEW `e2e/typing-mechanics.spec.ts`, 7 tests).
- **Confirmed bugs, filed + documented as `it.fails`**: TT-A1/TT-A2/TT-A34 → [#814](https://github.com/ZenUml/web-sequence/issues/814) (empty free-text regions leak completions); TT-A22 disagreements (`＇ ［ ］ ＿`) → [#815](https://github.com/ZenUml/web-sequence/issues/815).
- **Stale-test reconciliation after 76bddeb (TT-A7/TT-A8)**: 15 catalog tests (not 12 — N1/U7/U8 were also dot-vehicle) reconciled: 5 flipped to assert post-dot suppression (E1, N9, O1, O3, Z4), 10 re-grounded on `->`/line-start triggers preserving their original guard concern (N1, O5, U6, U7, U8, U10, W1, W9, X1, X2).

### Update 2 (2026-06-10, later): #814 + #815 FIXED, `→` feature shipped

- **#814 closed** — zenumlCompletions now uses the shared `isFreeTextSpan` classifier; the
  3 `it.fails` flipped to green (TT-A1/A2/A34 → covered). One source of truth for
  "is this slot free text?" across completion + autocorrect.
- **#815 closed** — `＇ ［ ］ ＿` joined the map; the TT-A22 enumeration now holds with no
  exclusions (`it.fails` flipped).
- **Feature (gap 19 class)**: `→` U+2192 → `->` — the map's first 1→2 replacement, with
  explicit selection remap (cursor lands after `->`); userEvent preserved so the endpoint
  popup auto-fires. Label `→` preserved. +5 unit.
- All verified three ways: unit (333), Playwright e2e (213/213 on a fresh build), and
  **live agent-browser journeys** (popup JSON + corrected-text evals + screenshots).
  agent-browser caveat discovered: its `press Control+Space` emits a malformed keydown
  (`key:"", ctrlKey:false`) — explicit-invoke journeys must dispatch a synthetic
  `KeyboardEvent` instead, with a positive control proving the trigger fires.

## Priority shortlist (top 25)

Consolidated from all three gap ledgers (124 items: TT-H1–37, TT-A1–43, TT-I1–44), ordered by value = (likelihood a real user hits it daily) × (severity if regressed) ÷ cost. Unit-feasible items rank above e2e at equal value (cheaper to run forever). Items marked **needs-spec-first** have genuinely undecided expected behavior and must NOT be implemented as tests until the product decision lands.

1. **TT-I9** — In a block body, Enter after a completed statement → next line continues at body indent (typed flow; today only the first post-`{` Enter and the final `}` are pinned, so a regression to column 0 stays green) — e2e
2. **TT-A1** — `A->B: ` then Ctrl+Space (empty label, zero-width Content) → NO popup; today 18 keywords leak (probe-verified, bug-shaped at HEAD) — unit (test-first fix)
3. **TT-I1** — Backspace with the cursor between auto-paired `{}` / `()` / `""` → deletes both chars (deleteBracketPair) — e2e
4. **TT-I3** — Typing `}` against a pending auto-paired closer → type-over, no doubled brace — e2e
5. **TT-A7** — Ctrl+Space immediately after `Name.` → null (explicit invoke also suppressed) + flip the 12 stale e2e tests that assert the pre-76bddeb behavior — unit + e2e maintenance
6. **TT-A8** — Re-ground the 5 regression guards orphaned by 76bddeb (#804 first-mention, #807 ifService, #809 CJK offering, scale, receiver-exclusion) on `->`/line-start triggers — e2e
7. **TT-H9** — Keyword word inside a message label (`A->B: if while`) → label-green, NEVER keyword-cobalt; extend per TT-H36 to ALL free-text node types (Content, TitleContent, Comment, Label String, quoted MethodName) — unit
8. **TT-I10** — Enter between auto-paired `{}` → the auto-closer lands on its own line at the OPENER's column (incl. depth ≥ 2) — e2e
9. **TT-A9** — Full-width `－＞` → corrected to `->` AND the participant popup auto-fires (userEvent survives the transactionFilter; the only live observable for the 09f95e3 class) — e2e
10. **TT-I14** — Multi-line mixed paste (`A->B: 你好。\nC。d()`) at a code position → per-region correction; today the pasted label's `。` is corrupted (same bug as TT-A12) — unit first, then one e2e paste journey
11. **TT-I11** — Enter mid-statement on a body line → continuation line indented to body level — e2e
12. **TT-A2** — `title ` then Ctrl+Space (empty title text) → NO popup; today 42 options (probe-verified; same degenerate-region class as TT-A1) — unit
13. **TT-A14** — Backspace with the popup open → refilter widens; Backspace past the trigger closes the popup — e2e
14. **TT-I42** — Indentation invariant gate: every opener kind × depth 1–4 → body indent = opener + 1 unit AND closer column = opener column (property-style, ad4dc2a antidote) — unit
15. **TT-A22** — Independent Unicode-category enumeration of the CJK autocorrect map (each fullwidth/CJK punct char either mapped or deliberately preserved; anti-mirroring, 6eadee8 class) — unit
16. **TT-H1** — Transient half-typed states (`A-`, `A->` dangling, `A->B: ` empty content, unmatched `}`) → existing spans keep lexical tags, no flicker, no markers — unit over the half-typed corpus
17. **TT-A34** — Divider slot: `。` inside `== 分隔 ==` preserved + empty-divider `== ` Ctrl+Space null (third instance of the degenerate-region class) — unit
18. **TT-I12** — Plain Shift-Tab (no snippet active) → falls through to indentLess and dedents the line — e2e
19. **TT-A19** — Accepting a keyword row (Tab/Enter on `title`/`if`) → bare word inserted; participants sort above keywords in a mixed popup (boost 50) — unit + e2e
20. **TT-I20** — Multi-line selection + Tab / Shift-Tab → indentMore/indentLess applied to every selected line — e2e
21. **TT-A16** — Selection type-over family: letter over a selected endpoint (popup at collapsed cursor, replaced token excluded), CJK char over a selection in code (corrected), `{`-surround, Tab on a multi-line selection — e2e + unit for the autocorrect-over-range part
22. **TT-H14** — Undo restores text + highlight atomically; undo of a CJK-autocorrected insertion — e2e (plain-undo half testable now; what undo restores after an autocorrect is **needs-spec-first**, see indentation Debatable #1)
23. **TT-H34** — `.cm-content` resolved font-family is the bundled mono (42136b9 shipped a proportional-serif regression; still no font assertion in any spec) — e2e
24. **TT-A31** — Mouse click accepts a popup row (identical apply to Enter, incl. snippet templates with tab stops; zero mouse popup tests exist) — e2e
25. **TT-A24** — IME composition modality (compose → commit CJK / full-width punct; the filter fires on `input.type.compose`; cancelled composition) — **needs-spec-first** (correct-during vs correct-on-commit undecided), then e2e via CDP `Input.imeSetComposition`; do NOT implement as tests yet

# ZenUML Editor — Domain Context

Vocabulary and decisions for the editor language intelligence layer.
Scope: `web/` rewrite + `@zenuml/codemirror-extensions` package.

---

## Glossary

### Editor Extension Package
`@zenuml/codemirror-extensions` (repo: `ZenUml/codemirror-extensions`). Owned by the ZenUML
team. Provides CodeMirror 6 language support for the ZenUML DSL: Lezer grammar, syntax
highlighting, participant tracking, autocomplete, linter, and slash commands. The `web/`
rewrite consumes it as a dependency.

### Lezer Grammar
The source of truth for DSL structure in the editor layer (`src/grammar/zenuml.grammar`).
Compiled to `zenuml-parser.js` via `lezer-generator`. The ANTLR grammar
(`zenuml-core/src/g4/`) remains the authoritative grammar for the renderer; the Lezer
grammar is a parallel port for editor tooling only. Both must stay in sync when the DSL
evolves.

### Syntax Tree
The incremental parse tree produced by the Lezer grammar on each document change.
Accessed via `syntaxTree(state)` from `@codemirror/language`. **All** extension components
(highlighter, participant manager, linter, autocomplete context detector) must share this
single tree — no component should call `parser.parse()` independently.

### Participant
A named actor in a sequence diagram, declared in the Head section. Full declaration
syntax: `[ParticipantType] [Stereotype] Name [Width] [Label] [Color]`. Example:
`@Actor Client #FFEBE6`. Participant names extracted from the syntax tree are the
primary source for name autocompletion inside message statements.

### Head Section
The top of a ZenUML document before the first message statement. Contains participant
declarations, group blocks, and (deprecated) `@Starter`. The Lezer tree node is `Head`.
Slash commands available here: `/participant`, `/group`.

### Block Zone
Any position inside a `StatementBraceBlock` `{ }` — i.e., the body of a sync message,
`if`, `while`, `par`, `try`, etc. This is where message statements, control flow, and
return forms are written. Slash commands available here: all message and structural
commands (see Slash Command Set below).

### Completion Context
The parse-tree-derived state that determines which completions and hint bar entries to
show. Derived by resolving the cursor position against the syntax tree and walking up
to the nearest named ancestor node. Two primary contexts: **Head** and **Block**.
Finer sub-contexts (e.g. "after `->` in a FromToPart") drive participant-name-only
completions.

### Hint Bar
Replaces the legacy `Toolbox` snippet-button grid. A read-only, context-sensitive strip
above the DSL editor showing the slash commands available at the current cursor position.
Entries are informational (label + trigger string) — clicking one inserts the snippet,
but the primary affordance is keyboard-driven slash commands. Updates on cursor movement
by reading the Completion Context.

### Slash Command
A `/`-triggered snippet insertion. Detected when the user types `/` at a position where
a statement could start (Block zone) or a participant declaration could start (Head zone).
Shows a filtered completion popup; selecting an entry replaces the `/…` token with a
tab-stop template.

### Sync Message
A method call that implies a synchronous return. Grammar node: `Message`.
Slash command: `/sync`. Template: `${1:A}.${2:method}() {\n  $0\n}`.
Assignment prefix (`result = A.method()`) is a user-typed prefix, not a separate command.

### Async Message
A fire-and-forget message with free-form content. Grammar node: `AsyncMessage`.
Slash command: `/async`. Template: `${1:A}->${2:B}: ${3:message}`.
Assignment prefix (`result = A->B: message`) is user-typed, not a separate command.

### Return (keyword form)
`return value` — used inside a sync call block when the return target is implied by
the call stack. Grammar node: `Return` / `ReturnKeyword`. Slash command: `/return`.
Template: `return ${1:value}`. Hint: "Return a value to the caller."

### Reply (async return annotation)
`@Return B->A: value` (aliases: `@return`, `@Reply`, `@reply`) — used when the return
target cannot be inferred and must be named explicitly. Typically in async flows.
Grammar node: `Return` / `ReturnAnnotation`. Slash command: `/reply`.
Template: `@Return ${1:B}->${2:A}: ${3:value}`. Hint: "Return to a specific participant."

The distinction the user cares about: **"does the diagram know where I'm returning to?"**
If yes → `/return`. If no, or to be explicit → `/reply`. This framing belongs in hint
bar copy and onboarding, not in grammar documentation.

---

## Slash Command Set

### Head zone (`/` at participant-declaration position)

| Command | Template | Description |
|---|---|---|
| `/participant` | `${1:@Actor} ${2:Name} #${3:FFEBE6}` | Declare a participant (type + color). No `as "Label"` slot — see grammar gap below |
| `/group` | `group ${1:Name} {\n  $0\n}` | Group participants under a named box |

### Block zone (`/` at statement-start position inside `{}`)

| Command | Template | Description |
|---|---|---|
| `/sync` | `${1:A}.${2:method}() {\n  $0\n}` | Sync method call |
| `/async` | `${1:A}->${2:B}: ${3:message}` | Async message |
| `/return` | `return ${1:value}` | Return to implied caller |
| `/reply` | `@Return ${1:B}->${2:A}: ${3:value}` | Return to named participant |
| `/new` | `${1:a} = new ${2:A}()` | Create a new instance |
| `/if` | `if(${1:condition}) {\n  $0\n}` | Conditional block |
| `/while` | `while(${1:condition}) {\n  $0\n}` | Loop block |
| `/par` | `par {\n  $0\n}` | Parallel block |
| `/try` | `try {\n  $0\n} catch(${1:e}) {\n}` | Try/catch block |
| `/section` | `section(${1:name}) {\n  $0\n}` | Section / frame |
| `/ref` | `ref(${1:A}, ${2:B})` | Reference to another diagram |
| `/note` | `// ${1:comment}` | Comment / note |

---

## Implementation Workflow

Build first in `web/src/editor/` (the `rewrite/web-foundation` branch), then port to
`@zenuml/codemirror-extensions`. Rationale: joint debugging with the renderer in the
running app catches integration problems that a standalone package demo cannot. The
`codemirror-extensions` repo receives the proven, stable code — not a first draft.

File targets in `web/`:
- `src/editor/grammar/` — Lezer grammar + generated parser (local copy, fixed)
- `src/editor/zenumlLanguage.ts` — rewritten to `LRLanguage` wrapping the grammar
- `src/editor/participantManager.ts` — rewritten to use `syntaxTree()`
- `src/editor/zenumlAutocomplete.ts` — new, context-aware + slash commands
- `src/editor/zenumlLinter.ts` — new, Lezer error node walker
- `src/components/HintBar.tsx` — replaces `Toolbox.tsx`

---

## Architecture Decisions

### Single shared syntax tree
All CM6 extension components use `syntaxTree(state)` from `@codemirror/language`.
No component calls `parser.parse()` directly. Rationale: the language extension
maintains an incremental tree; independent re-parses double the work and diverge
on partially-typed input.

### Known grammar gaps (Lezer ↔ renderer divergence) — deferred milestone
Surfaced by renderer-in-the-loop verification. The Lezer editor grammar is NARROWER than
the renderer's ANTLR grammar in three places; each is valid ZenUML the renderer accepts but
the editor's linter flags (or silently mis-parses). These need a dedicated, test-first grammar
milestone — NOT hurried precedence edits (attempted; the Head/participant disambiguation is
multi-faceted: bare vs quoted labels conflict differently, and `label`-vs-`participant`
precedence has global blast radius).

1. **Participant with both label AND color.** `@Type Name as "Label" #color` mis-parses: the
   optional `Label` content does not bind greedily, so `Name as` closes an empty `Label` and the
   label text + color split off as a second `Participant` (bare form) or a hard error (quoted
   form). ANTLR `label : AS name`, `name : ID | CSTRING | USTRING` accepts both. Until fixed,
   the `/participant` template omits the label (emits `@Type Name #color`, which parses clean).
2. **Quoted method names.** `A."Get order by id"()` — ANTLR `methodName : name` accepts CSTRING;
   Lezer `MethodName { Identifier }` does not. Used by the shipped blue/black-white templates.
3. **Head greedily absorbs the declare-then-message shape — HIGHEST PRIORITY.**
   `@Actor Alice` then `Alice->Bob: Hello` does NOT parse as a message: `Head { (Participant ST?)+ }`
   swallows the message line, mis-parsing `Bob`/`Hello` as further Participants. Proven (adversarial
   Playwright + direct `parser.parse()`) to degrade THREE runtime behaviours on the single most
   common diagram shape — and they all look fine in screenshots because the RENDERER (ANTLR) draws
   it correctly while the editor's Lezer layer is wrong underneath:
   - **Highlighting goes flat.** Async content is green only for a lone `A->B: msg`; once any
     declaration precedes it, `Hello` is mis-tagged `Participant/Name/Identifier` → base `#E8EEF7`
     (the message structure isn't recognized at all). 4/4 reproducible.
   - **Participant set is contaminated.** `@Actor Alice` + `Alice->Bob: Hello` collects
     `["Alice","Alice","Bob","HelloMsg"]` — message labels + undeclared targets wrongly collected,
     real names duplicated. Autocomplete "works" only because the real name happens to survive in
     the polluted set.
   - **First-mention participants** (`A.method()`, no declaration) never reach autocomplete.
   This single Head/Statement disambiguation is the root of all three. It needs a dedicated,
   test-first grammar milestone — NOT a hurried precedence edit (the `label`-vs-`participant`
   precedence reorder was attempted and reverted; it has global blast radius and the bare-vs-quoted
   cases conflict differently). This is the next grammar work to schedule.

### Extensions layer rewrite (grammar kept)
The Lezer grammar is sound and kept as-is (minor fixes for `Content` node and `Divider`
free-text). The extension code (`zenuml-highlighter.ts`, `zenuml-participant-manager.ts`,
`zenuml-autocomplete.ts`, `zenuml-linter.ts`) is rewritten because:
- Highlighter has dead `styleTags` rules referencing non-existent node names.
- Participant manager calls `parser.parse()` independently (double-parse).
- Linter instantiates `new Zenuml(document.createElement('div'))` — pulls the full Vue
  renderer into the editor bundle.
- Autocomplete is context-blind (same list at every cursor position).

### Toolbox repurposed as Hint Bar
The `Toolbox` snippet-button grid is replaced by a context-sensitive Hint Bar.
Rationale: slash commands cover every insertion the toolbar offered; maintaining two
insertion paths creates drift. The Hint Bar provides discoverability without duplication.

### Slash commands as a CM6 autocomplete source
Slash commands live in `@zenuml/codemirror-extensions` (not in the `web/` app layer)
because they are grammar-aware: available commands depend on the completion context
(Head vs Block), which is derived from the syntax tree. The app layer only consumes
the extension.

### `/reply` for async return
The annotation form `@Return B->A: value` is exposed as `/reply` (not `/return-to` or
`/async-return`) because `@reply` is a real grammar alias and the word maps to the
user's mental model: "I'm replying to someone." The `/return` vs `/reply` distinction
is surfaced in hint bar copy as: "Return to the caller" vs "Return to a specific participant."

### `@Starter` deprecated
The `@Starter` / `@starter` annotation is not included in the slash command set and
will not appear in autocomplete suggestions. It remains parseable (grammar unchanged)
but is not promoted.

### Assignment is not a command
`result = A.method()` (sync) and `result = A->B: message` (async) are user-typed
prefixes, not slash commands. The hint bar may note "prefix with `result = ` to capture
the return value" as contextual guidance, but no `/assign` command exists.

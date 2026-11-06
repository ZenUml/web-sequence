// Slash command catalog for the ZenUML DSL editor.
//
// Pure data — the single source of truth shared by the autocomplete source
// (`zenumlAutocomplete.ts`, which turns these into a `/`-triggered completion
// source (the in-editor '/' popup; the former HintBar strip was removed at
// the cursor's current zone). Keep this JSX-free and dependency-free.
//
// `template` uses CodeMirror's snippet syntax (`@codemirror/autocomplete`'s
// `snippet()`): `${1:placeholder}` are tab stops, `${}` / `$0` is the final
// cursor. The autocomplete source compiles `template` via `snippet()`.
//
// `zone` gates where a command is offered, derived from the Lezer parse context:
//   - 'head'  → cursor in a declaration-only context (a `group { }` body, or
//               within an existing participant declaration)
//   - 'block' → cursor inside a StatementBraceBlock (message/control-flow body)
//   - 'top'   → the document top level, where BOTH participant declarations AND
//               statements (messages, control flow) are valid — so it offers the
//               UNION of head + block commands. (ZenUML's top level is a sequence
//               that permits declarations and messages interleaved.)
// Each SlashCommand declares only 'head' or 'block'; 'top' is a resolved zone that
// maps to head ∪ block. See CONTEXT.md → "Slash Command Set".

export type SlashZone = 'head' | 'block' | 'top';

export interface SlashCommand {
  /** Trigger token typed after `/` (e.g. "if" for `/if`). Unique. */
  name: string;
  /** Where this command is authored (the resolved 'top' zone maps to head ∪ block). */
  zone: 'head' | 'block';
  /** Human label for the completion popup + hint bar. */
  label: string;
  /** One-line guidance — carries the cognitive load (esp. return vs reply). */
  detail: string;
  /** CodeMirror snippet template with ${n:placeholder} tab stops. */
  template: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // ---- Head zone ----
  {
    // NOTE: no `as "Label"` slot. A participant with BOTH a label and a color
    // (`@Type Name as "Label" #color`) does not yet parse cleanly — the grammar's
    // Head/Label/Color disambiguation splits it into two participants (tracked as
    // the participant-label-color grammar milestone). `@Type Name #color` parses
    // clean and matches the real demo form (`@Actor Client #FFEBE6`).
    name: 'participant',
    zone: 'head',
    label: 'participant',
    detail: 'Declare a participant (type + color placeholders)',
    template: '${1:@Actor} ${2:Name} #${3:FFEBE6}',
  },
  {
    name: 'group',
    zone: 'head',
    label: 'group',
    detail: 'Group participants under a named box',
    template: 'group ${1:Name} {\n  ${0}\n}',
  },

  // ---- Block zone ----
  {
    name: 'sync',
    zone: 'block',
    label: 'sync message',
    detail: 'Synchronous method call (prefix `x = ` to capture the result)',
    template: '${1:A}.${2:method}() {\n  ${0}\n}',
  },
  {
    name: 'async',
    zone: 'block',
    label: 'async message',
    detail: 'Fire-and-forget message (prefix `x = ` to capture the result)',
    template: '${1:A}->${2:B}: ${3:message}',
  },
  {
    name: 'return',
    zone: 'block',
    label: 'return',
    detail: 'Return a value to the caller (target inferred from context)',
    template: 'return ${1:value}',
  },
  {
    name: 'reply',
    zone: 'block',
    label: 'reply',
    detail: 'Return to a specific participant (explicit target)',
    template: '@Return ${1:B}->${2:A}: ${3:value}',
  },
  {
    name: 'new',
    zone: 'block',
    label: 'new instance',
    detail: 'Create a new instance',
    template: '${1:a} = new ${2:A}()',
  },
  {
    name: 'if',
    zone: 'block',
    label: 'if / alt',
    detail: 'Conditional block',
    template: 'if(${1:condition}) {\n  ${0}\n}',
  },
  {
    name: 'while',
    zone: 'block',
    label: 'while / loop',
    detail: 'Loop block',
    template: 'while(${1:condition}) {\n  ${0}\n}',
  },
  {
    name: 'par',
    zone: 'block',
    label: 'par',
    detail: 'Parallel block',
    template: 'par {\n  ${0}\n}',
  },
  {
    name: 'try',
    zone: 'block',
    label: 'try / catch',
    detail: 'Try / catch block',
    template: 'try {\n  ${0}\n} catch(${1:e}) {\n}',
  },
  {
    name: 'section',
    zone: 'block',
    label: 'section / frame',
    detail: 'Named section / frame',
    template: 'section(${1:name}) {\n  ${0}\n}',
  },
  {
    name: 'ref',
    zone: 'block',
    label: 'ref',
    detail: 'Reference to another diagram',
    template: 'ref(${1:A}, ${2:B})',
  },
  {
    name: 'note',
    zone: 'block',
    label: 'note',
    detail: 'Comment / note line',
    template: '// ${1:comment}',
  },
];

/** Commands available in a given parse zone, in catalog order. */
export function commandsForZone(zone: SlashZone): SlashCommand[] {
  // 'top' (document top level) offers declarations ∪ statements.
  if (zone === 'top') return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.zone === zone);
}

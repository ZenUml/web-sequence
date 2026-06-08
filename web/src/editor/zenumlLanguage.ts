import { LRLanguage, LanguageSupport, type StreamParser } from '@codemirror/language'
import { styleTags, tags as t } from '@lezer/highlight'
import { parser } from './grammar/zenuml-parser.js'

// Authoritative node names verified against zenuml-parser.terms.js.
// DO NOT add any name not present in that file — the reference impl's mistake
// was mapping ParticipantKeyword, ActorKeyword, Arrow, etc. which don't exist.
//
// Modifier note: t.function(t.variableName) is semantically distinct from plain
// t.variableName — app themes like `ink` style them differently (teal vs neutral).
// However, classHighlighter (used in tests) collapses modifiers to their base
// class; both emit "tok-variableName". The distinction matters for real themes.
const zenumlHighlighting = styleTags({
  // ── Comments ──────────────────────────────────────────────────────────────
  Comment: t.lineComment,

  // ── String / Number ───────────────────────────────────────────────────────
  String: t.string,
  Number: t.number,

  // ── Free-text label spans ─────────────────────────────────────────────────
  // LineContent backs async-message Content (`A->B: Hello`), TitleContent, and
  // Divider text — all human-readable labels. Without this the most common diagram
  // shape (async messages) rendered fully flat: names neutral, arrow muted, and the
  // message label unstyled. Style it string-like (green in the ink theme) so the
  // label a user actually reads is legible.
  LineContent: t.string,

  // ── Annotations (participant role markers + async return) ─────────────────
  // @Actor, @Database, @Starter, @Return — the @-prefixed marker that leads most
  // participant lines. Previously unmapped → neutral, indistinguishable from text.
  // t.meta renders cobalt in the ink theme (the keyword/marker signal family).
  Annotation: t.meta,
  StarterAnnotation: t.meta,
  ReturnAnnotation: t.meta,

  // ── Booleans ──────────────────────────────────────────────────────────────
  TrueKeyword: t.bool,
  FalseKeyword: t.bool,

  // ── Null-like ─────────────────────────────────────────────────────────────
  // t.null is a sub-tag of t.keyword; classHighlighter emits "tok-keyword".
  // Themes can still target t.null explicitly (ink targets [t.bool, t.null]).
  NullKeyword: t.null,
  UndefinedKeyword: t.null,

  // ── Control-flow keywords ─────────────────────────────────────────────────
  // t.controlKeyword is a sub-tag of t.keyword; classHighlighter emits "tok-keyword".
  // Themes distinguish them (e.g. ink targets both t.keyword and t.controlKeyword).
  IfKeyword: t.controlKeyword,
  ElseKeyword: t.controlKeyword,
  WhileKeyword: t.controlKeyword,
  ParKeyword: t.controlKeyword,
  OptKeyword: t.controlKeyword,
  CriticalKeyword: t.controlKeyword,
  SectionKeyword: t.controlKeyword,
  FrameKeyword: t.controlKeyword,
  RefKeyword: t.controlKeyword,
  TryKeyword: t.controlKeyword,
  CatchKeyword: t.controlKeyword,
  FinallyKeyword: t.controlKeyword,

  // ── Other keywords ────────────────────────────────────────────────────────
  NewKeyword: t.keyword,
  ReturnKeyword: t.keyword,
  GroupKeyword: t.keyword,
  AsKeyword: t.keyword,
  TitleKeyword: t.keyword,
  AsyncKeyword: t.keyword,

  // ── Operators ─────────────────────────────────────────────────────────────
  ArrowOp: t.operator,
  Equals: t.operator,
  PlusOp: t.operator,
  MinusOp: t.operator,
  MultiplyOp: t.operator,
  DivideOp: t.operator,
  ModuloOp: t.operator,

  // ── Punctuation ───────────────────────────────────────────────────────────
  // t.bracket is a sub-tag of t.punctuation; classHighlighter emits "tok-punctuation"
  // for both. Themes can distinguish them.
  Dot: t.punctuation,
  Colon: t.punctuation,
  SemiColon: t.punctuation,
  Comma: t.separator,
  OpenParen: t.bracket,
  CloseParen: t.bracket,
  OpenBrace: t.bracket,
  CloseBrace: t.bracket,

  // ── Named identifiers — context paths for semantic distinction ─────────────
  // t.function(t.variableName): method calls — ink theme styles these teal.
  // The old StreamLanguage couldn't reach this tag; LRLanguage + context paths fix it.
  // Note: classHighlighter collapses t.function(t.variableName) to "tok-variableName"
  // (same as plain t.variableName). The tag is semantically meaningful to real themes.
  'MethodName/Identifier': t.function(t.variableName),
  // t.className: participant/constructor names — distinct from plain identifiers.
  'Name/Identifier': t.className,
  'Construct/Identifier': t.className,
  // t.typeName: type annotations in declarations.
  'Type/Identifier': t.typeName,
  // Plain identifiers (Assignee, bare Atom, etc.) — neutral.
  Identifier: t.variableName,
})

export const zenumlLanguage = LRLanguage.define({
  name: 'zenuml',
  parser: parser.configure({ props: [zenumlHighlighting] }),
  languageData: {
    commentTokens: { line: '//' },
    // CodeMirror's closeBrackets extension (enabled by basicSetup) reads this
    // to auto-close pairs in the DSL editor.
    closeBrackets: { brackets: ['(', '{', '"'] },
    // Re-indent when the user types `{` or `}`.
    indentOnInput: /^\s*[{}]$/,
  },
})

// LanguageSupport bundles the language with any companion extensions.
// Highlight styling is supplied by the app's existing per-theme Extension
// (resolveTheme in themes.ts) — we do not ship a standalone HighlightStyle
// here to avoid duplication and ensure the ink / monokai / etc. theme colours
// always win. The styleTags above register semantic tags on the tree; the theme
// decides what CSS to emit.
export function zenumlSupport(): LanguageSupport {
  return new LanguageSupport(zenumlLanguage)
}

// ── Legacy export ─────────────────────────────────────────────────────────────
// Kept so that modes.ts (which imports `zenumlStream`) compiles until the
// controller integrates `zenumlSupport()` into the languageExtension() call.
// TODO (controller): replace `StreamLanguage.define(zenumlStream)` in modes.ts
// with `zenumlSupport()` and drop this export.
const KEYWORDS = /^(if|else|while|for|par|opt|alt|loop|return|new|try|catch|finally|group)\b/

export const zenumlStream: StreamParser<unknown> = {
  token(stream) {
    if (stream.match(/^\s+/)) return null
    if (stream.match(/^\/\/.*/)) return 'comment'
    if (stream.match(KEYWORDS)) return 'keyword'
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string'
    if (stream.match(/^->|^-->|^=|^\.|^:/)) return 'operator'
    if (stream.match(/^[A-Za-z_][\w]*(?=\s*\()/)) return 'function'
    if (stream.match(/^[A-Za-z_][\w]*/)) return 'variableName'
    stream.next()
    return null
  },
  tokenTable: {
    function: t.function(t.variableName),
    variableName: t.variableName,
  },
}

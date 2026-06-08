// Shim for `ramda/src/replace` used only when bundling the ANTLR oracle.
// StringUtil.ts calls the curried 2-arg form: replace(regexp, replacement)(str).
// See scripts/gen-antlr-oracle.mjs.
export default (re, sub) => (s) => s.replace(re, sub)

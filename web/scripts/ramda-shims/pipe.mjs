// Shim for `ramda/src/pipe` used only when bundling the ANTLR oracle
// (zenuml-core-25/src/utils/StringUtil.ts imports it). ramda is not a web/
// dependency; left-to-right function composition is trivial to inline.
// See scripts/gen-antlr-oracle.mjs.
export default (...fns) => (x) => fns.reduce((v, f) => f(v), x)

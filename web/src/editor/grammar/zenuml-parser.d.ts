// Hand-written type declaration for the lezer-generated parser (zenuml-parser.js).
// The generated .js carries no types, so importing it gives an implicit-any error
// under `strict`. This sibling .d.ts gives `parser` its real `LRParser` type
// without editing the generated file. Regenerating the parser
// (`yarn build:grammar`) does NOT overwrite this file.
import type { LRParser } from '@lezer/lr'

export const parser: LRParser

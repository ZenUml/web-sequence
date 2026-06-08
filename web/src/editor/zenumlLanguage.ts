import { StreamLanguage, type StreamParser } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const KEYWORDS = /^(if|else|while|for|par|opt|alt|loop|return|new|try|catch|finally|group)\b/;

// Lightweight ZenUML DSL highlighter (regex tokens, not a grammar port).
export const zenumlStream: StreamParser<unknown> = {
  token(stream) {
    if (stream.match(/^\s+/)) return null;
    if (stream.match(/^\/\/.*/)) return 'comment';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(/^"(?:[^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^->|^-->|^=|^\.|^:/)) return 'operator';
    if (stream.match(/^[A-Za-z_][\w]*(?=\s*\()/)) return 'function';
    if (stream.match(/^[A-Za-z_][\w]*/)) return 'variableName';
    stream.next();
    return null;
  },
  // 'function' is NOT a built-in stream-token name, so without this map it resolves to
  // no highlight tag and method calls (validate(), authorize()) render neutral despite
  // the theme defining a teal `t.function(t.variableName)` style. Map our custom token
  // names to lezer tags so the theme styles reach them. (variableName is mapped
  // explicitly for determinism; the theme keeps it neutral by design.)
  tokenTable: {
    function: t.function(t.variableName),
    variableName: t.variableName,
  },
};

export const zenumlLanguage = StreamLanguage.define(zenumlStream);

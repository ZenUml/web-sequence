import { StreamLanguage, type StreamParser } from '@codemirror/language';

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
};

export const zenumlLanguage = StreamLanguage.define(zenumlStream);

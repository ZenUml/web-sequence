import { describe, expect, it } from 'vitest';
import { defaultParseSearch } from '@tanstack/react-router';
import { parseAppSearch, parseLocationSearch } from './urlParams';
import { indexRoute } from './router';
import { detectRuntimeMode } from './runtimeMode';

// What the router hands validateSearch: TanStack's default parseSearch
// JSON-decodes each value.
const routed = (query: string) => parseAppSearch(defaultParseSearch(query));

describe('parseAppSearch', () => {
  it('keeps a numeric id a string (TanStack decodes ?id=1729000000000 to a number)', () => {
    expect((defaultParseSearch('?id=1729000000000') as Record<string, unknown>).id).toBe(1729000000000);
    expect(routed('?id=1729000000000').id).toBe('1729000000000');
  });

  it('reads the id the app itself writes for numeric-looking ids (?id=%22…%22)', () => {
    expect(routed('?id=%221729000000000%22').id).toBe('1729000000000');
  });

  it('maps the legacy aliases itemId and token', () => {
    expect(routed('?itemId=X&token=Y')).toMatchObject({ id: 'X', 'share-token': 'Y' });
    expect(routed('?id=A&itemId=X&share-token=B&token=Y')).toMatchObject({ id: 'A', 'share-token': 'B' });
  });

  it('takes the first value of a repeated key, like URLSearchParams.get', () => {
    expect(routed('?id=a&id=b').id).toBe('a');
  });

  it('treats a present embed key as true, with or without a value', () => {
    expect(routed('?embed').embed).toBe(true);
    expect(routed('?embed=1').embed).toBe(true);
    expect(routed('?id=x').embed).toBeUndefined();
    // navigate({ search: (prev) => ({ embed: undefined, ... }) }) hands the
    // object to validateSearch directly: a key set to undefined is absent.
    expect(parseAppSearch({ id: 'x', embed: undefined }).embed).toBeUndefined();
  });

  it('gives JSON embed code back as JSON text that parses to the same item', () => {
    const item = { js: 'A.b', css: '', title: 'T' };
    const code = routed(`?embed&code=${encodeURIComponent(JSON.stringify(item))}`).code;
    expect(typeof code).toBe('string');
    expect(JSON.parse(code!)).toEqual(item);
  });

  it('keeps plain DSL embed code as written', () => {
    expect(routed(`?code=${encodeURIComponent('A.b()')}`).code).toBe('A.b()');
  });

  it('parses view, title and stickyOffset; drops empty and unknown values', () => {
    expect(routed('?view=diagrams&title=Hello&stickyOffset=12&other=1')).toEqual({
      view: 'diagrams', title: 'Hello', stickyOffset: 12,
    });
    expect(routed('?id=&stickyOffset=abc')).toEqual({});
  });
});

describe('router and runtimeMode read the same values', () => {
  const validate = indexRoute.options.validateSearch as (s: Record<string, unknown>) => Record<string, unknown>;
  const runtime = (search: string) => detectRuntimeMode({ search, isExtension: false, isDesktop: false });

  it.each([
    '?itemId=X&token=Y',
    '?id=1729000000000&share-token=tok',
    '?id=%221729000000000%22',
    '?embed&id=abc&share-token=tok',
    '?embed&code=A.b()&title=My%20diagram',
  ])('%s', (query) => {
    const router = validate(defaultParseSearch(query));
    const r = runtime(query);
    expect(r.itemId).toBe(router.id ?? null);
    expect(r.shareToken).toBe(router['share-token'] ?? null);
    expect(r.isEmbed).toBe(router.embed === true);
    expect(r.embedCode).toBe(router.code ?? null);
    expect(r.embedTitle).toBe(router.title ?? null);
  });

  it('the alias form is a shared item for both', () => {
    expect(runtime('?itemId=X&token=Y').isShared).toBe(true);
    expect(validate(defaultParseSearch('?itemId=X&token=Y'))).toMatchObject({ id: 'X', 'share-token': 'Y' });
  });

  it('parseLocationSearch is the runtime entry point over a raw query string', () => {
    expect(parseLocationSearch('?itemId=X')).toMatchObject({ id: 'X' });
  });
});

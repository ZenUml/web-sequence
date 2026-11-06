import { describe, it, expect } from 'vitest';
import { indexRoute } from './router';

describe('indexRoute.validateSearch', () => {
  const validate = indexRoute.options.validateSearch as (s: Record<string, unknown>) => Record<string, unknown>;

  it('parses view=diagrams into the search shape', () => {
    expect(validate({ view: 'diagrams' }).view).toBe('diagrams');
  });

  it('leaves view undefined when absent (bare /)', () => {
    expect(validate({}).view).toBeUndefined();
  });

  it('still parses the existing id param', () => {
    expect(validate({ id: 'abc' }).id).toBe('abc');
  });
});

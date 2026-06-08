import { describe, it, expect } from 'vitest';
import { semverCompare } from './semver';

describe('semverCompare', () => {
  it('returns 1 when a > b', () => {
    expect(semverCompare('1.1.0', '1.0.9')).toBe(1);
    expect(semverCompare('2.0.0', '1.9.9')).toBe(1);
  });
  it('returns -1 when a < b', () => {
    expect(semverCompare('1.0.0', '1.0.1')).toBe(-1);
    expect(semverCompare('1.0.25', '2.0.0')).toBe(-1);
  });
  it('returns 0 when equal', () => {
    expect(semverCompare('1.2.3', '1.2.3')).toBe(0);
  });
  it('treats a missing component as less than a present one', () => {
    expect(semverCompare('1.0', '1.0.1')).toBe(-1);
    expect(semverCompare('1.0.1', '1.0')).toBe(1);
  });
});

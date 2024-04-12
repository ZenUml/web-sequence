import until from '../common/until';

describe('until', () => {
  test('Collect until something happens', () => {
    const res = until([1, 2, 3, 1, 2, 3], (i) => i > 2);
    expect(res.length).toBe(2);
    expect(res[0]).toBe(1);
    expect(res[1]).toBe(2);
  });
});

import codeService from '../services/code_service'

describe('Test cases for code service', () => {
  test('Add code to the end - empty empty', () => {
    const result = codeService.addCode('', '');
    expect(result).toBe('');
  });
  test('Add code to the end - something something', () => {
    const result = codeService.addCode('A', 'B');
    expect(result).toBe('A\nB');
  });
  test('Add code to the end - empty something', () => {
    const result = codeService.addCode('', 'B');
    expect(result).toBe('B');
  });
  test('Add code to the end - something empty', () => {
    const result = codeService.addCode('A', '');
    expect(result).toBe('A');
  });
  test('Add Participant - to empty', () => {
    const result = codeService.addCode('', 'NewParticipant');
    expect(result).toBe('NewParticipant');
  });
  test('Add Participant - to A', () => {
    const result = codeService.addCode('A', 'NewParticipant');
    expect(result).toBe('NewParticipant\nA');
  });

  test('Add Participant - to A\n\nB', () => {
    const result = codeService.addCode('A\n\nB', 'NewParticipant');
    expect(result).toBe('NewParticipant\nA\n\nB');
  });

  test('Add Participant - to // comments', () => {
    const result = codeService.addCode('// comments', 'NewParticipant');
    expect(result).toBe('// comments\nNewParticipant');
  });

  test('Add Participant - to \n// comments', () => {
    const result = codeService.addCode('\n// comments', 'NewParticipant');
    expect(result).toBe('\n// comments\nNewParticipant');
  });
  test('Add Participant - to multi-line comments', () => {
    const result = codeService.addCode('// comments1\n// comments2', 'NewParticipant');
    expect(result).toBe('// comments1\n// comments2\nNewParticipant');
  });
  test('Add Participant - to multi-line comments', () => {
    const result = codeService.addCode('// comments1\n\n// comments2', 'NewParticipant');
    expect(result).toBe('// comments1\n\n// comments2\nNewParticipant');
  });
  test('Add Participant - to multi-line comments', () => {
    const result = codeService.addCode('// comments1\nA\n// comments2', 'NewParticipant');
    expect(result).toBe('// comments1\nNewParticipant\nA\n// comments2');
  });
});

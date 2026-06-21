import { describe, it, expect } from 'vitest';
import { MAX_FILE_BYTES, isAccepted, validateFile } from './acceptedTypes';

/** Minimal File stub — validation only reads `name` and `size`. */
function fakeFile(name: string, size = 1024): File {
  return { name, size } as unknown as File;
}

describe('isAccepted', () => {
  it('matches accepted extensions, case-insensitive', () => {
    expect(isAccepted(fakeFile('data.CSV'))).toBe(true);
    expect(isAccepted(fakeFile('server.log'))).toBe(true);
    expect(isAccepted(fakeFile('sheet.xlsx'))).toBe(false);
  });
});

describe('validateFile', () => {
  it('accepts a supported type within the size cap', () => {
    expect(validateFile(fakeFile('data.csv'))).toEqual({ ok: true });
  });

  it('rejects an unsupported type with a reason', () => {
    const result = validateFile(fakeFile('data.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Unsupported file type/);
  });

  it('rejects a file over the size cap with a reason', () => {
    const result = validateFile(fakeFile('huge.csv', MAX_FILE_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too large/);
  });

  it('accepts a file exactly at the size cap', () => {
    expect(validateFile(fakeFile('edge.csv', MAX_FILE_BYTES))).toEqual({ ok: true });
  });
});

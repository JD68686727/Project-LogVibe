export const ACCEPTED = ['.csv', '.tsv', '.log', '.txt'] as const;

/** Hard cap before parsing — very large files can crash the browser tab. */
export const MAX_FILE_BYTES = 250 * 1024 * 1024; // 250 MB

export type FileValidation = { ok: true } | { ok: false; reason: string };

export function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED.some((ext) => lower.endsWith(ext));
}

/** Validates type and size; returns a user-facing reason when rejected. */
export function validateFile(file: File): FileValidation {
  if (!isAccepted(file)) {
    return {
      ok: false,
      reason: `Unsupported file type. Accepted: ${ACCEPTED.join(', ')}`,
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
    return { ok: false, reason: `File is too large (max ${mb} MB).` };
  }
  return { ok: true };
}

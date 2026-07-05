import { splitAppended } from './splitAppended';

/** The subset of a FileSystemFileHandle we use — keeps this pure + testable. */
export interface FileLike {
  getFile(): Promise<File>;
}

export interface TailReadState {
  /** Byte offset already consumed. */
  offset: number;
  /** Partial trailing line carried across reads. */
  remainder: string;
}

export interface TailReadResult {
  lines: string[];
  state: TailReadState;
}

/**
 * Reads the bytes appended to a file since `state.offset` and returns the new
 * complete lines plus the advanced state. Handles rotation/truncation (a file
 * that shrank restarts from 0) and partial trailing lines (buffered in
 * `remainder`). Pure given the injected `decode`, so the whole tail loop is
 * unit-testable with a fake handle — no File System Access API needed.
 */
export async function readAppended(
  handle: FileLike,
  state: TailReadState,
  decode: (buf: ArrayBuffer) => string,
): Promise<TailReadResult> {
  const file = await handle.getFile();
  let { offset, remainder } = state;

  if (file.size < offset) {
    // File was truncated or rotated — start over.
    offset = 0;
    remainder = '';
  }
  if (file.size <= offset) {
    return { lines: [], state: { offset: file.size, remainder } };
  }

  const buf = await file.slice(offset).arrayBuffer();
  const { lines, remainder: nextRemainder } = splitAppended(remainder, decode(buf));
  return { lines, state: { offset: file.size, remainder: nextRemainder } };
}

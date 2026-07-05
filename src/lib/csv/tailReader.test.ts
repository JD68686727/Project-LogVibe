import { describe, it, expect } from 'vitest';
import { readAppended, type FileLike } from './tailReader';

const decode = (buf: ArrayBuffer) => new TextDecoder('utf-8').decode(buf);

/** A fake handle whose file content the test can grow between reads. */
function growingHandle(getContent: () => string): FileLike {
  return { getFile: async () => new File([getContent()], 'log.txt') };
}

describe('readAppended', () => {
  it('reads only newly appended lines and buffers a partial trailing line', async () => {
    let content = 'a\nb\n';
    const h = growingHandle(() => content);

    const r1 = await readAppended(h, { offset: 0, remainder: '' }, decode);
    expect(r1.lines).toEqual(['a', 'b']);

    content += 'c\nd'; // 'd' has no newline yet
    const r2 = await readAppended(h, r1.state, decode);
    expect(r2.lines).toEqual(['c']);

    content += 'e\n'; // completes 'd' → 'de'
    const r3 = await readAppended(h, r2.state, decode);
    expect(r3.lines).toEqual(['de']);
  });

  it('returns nothing when the file has not grown', async () => {
    const h = growingHandle(() => 'a\nb\n');
    const r1 = await readAppended(h, { offset: 0, remainder: '' }, decode);
    const r2 = await readAppended(h, r1.state, decode);
    expect(r2.lines).toEqual([]);
  });

  it('restarts from the beginning when the file is truncated/rotated', async () => {
    let content = 'old1\nold2\n';
    const h = growingHandle(() => content);
    const r1 = await readAppended(h, { offset: 0, remainder: '' }, decode);
    expect(r1.lines).toEqual(['old1', 'old2']);

    content = 'fresh\n'; // rotated: smaller than the previous offset
    const r2 = await readAppended(h, r1.state, decode);
    expect(r2.lines).toEqual(['fresh']);
  });
});

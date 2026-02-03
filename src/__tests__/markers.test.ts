import { describe, expect, it } from 'vitest';
import { upsertManagedBlock, wrapManagedBlock } from '../markers.js';

describe('markers', () => {
  it('wrapManagedBlock wraps content with begin/end markers', () => {
    const out = wrapManagedBlock('x', 'hello');
    expect(out).toContain('<!-- gh-scaffold:begin x -->');
    expect(out).toContain('hello');
    expect(out).toContain('<!-- gh-scaffold:end x -->');
  });

  it('upsertManagedBlock appends block if missing', () => {
    const out = upsertManagedBlock('A\n', 'k', 'B');
    expect(out).toContain('A');
    expect(out).toContain('gh-scaffold:begin k');
    expect(out).toContain('B');
  });

  it('upsertManagedBlock replaces existing block', () => {
    const before = [
      'top',
      '<!-- gh-scaffold:begin sec -->',
      'old',
      '<!-- gh-scaffold:end sec -->',
      'bottom',
      '',
    ].join('\n');

    const out = upsertManagedBlock(before, 'sec', 'new');
    expect(out).toContain('top');
    expect(out).toContain('new');
    expect(out).toContain('bottom');
    expect(out).not.toContain('\nold\n');
  });
});

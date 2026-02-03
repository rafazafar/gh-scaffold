const BEGIN = 'gh-scaffold:begin';
const END = 'gh-scaffold:end';

export function wrapManagedBlock(id: string, content: string): string {
  return `<!-- ${BEGIN} ${id} -->\n${content.trimEnd()}\n<!-- ${END} ${id} -->\n`;
}

export function upsertManagedBlock(existing: string, id: string, newContent: string): string {
  const begin = `<!-- ${BEGIN} ${id} -->`;
  const end = `<!-- ${END} ${id} -->`;

  const pattern = new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'm');
  const block = wrapManagedBlock(id, newContent);

  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }

  // append block to end
  return existing.trimEnd() + '\n\n' + block;
}

function escapeRegExp(s: string) {
  // Escape regex metacharacters, including literal `]` and `\`.
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

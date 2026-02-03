import { describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { makeTempDir } from './helpers.js';
import { resolveTemplatesDir, templateNameFor, licenseTemplateName } from '../templates.js';

describe('templates', () => {
  it('templateNameFor switches issue template extension for forms', () => {
    expect(templateNameFor('ISSUE_TEMPLATE_BUG', 'markdown')).toContain('bug_report.md');
    expect(templateNameFor('ISSUE_TEMPLATE_BUG', 'forms')).toContain('bug_report.yml');
  });

  it('licenseTemplateName maps license types', () => {
    expect(licenseTemplateName('none')).toBe(null);
    expect(licenseTemplateName('mit')).toContain('LICENSE_MIT');
    expect(licenseTemplateName('apache-2.0')).toContain('LICENSE_APACHE_2_0');
    expect(licenseTemplateName('gpl-3.0')).toContain('LICENSE_GPL_3_0');
  });

  it('templateNameFor returns null for unknown keys', () => {
    expect(templateNameFor('NOPE', 'markdown')).toBe(null);
  });

  it('resolveTemplatesDir uses custom directory if it exists', async () => {
    const repo = await makeTempDir();
    const dir = path.resolve(repo, 'tpl');
    await fs.ensureDir(dir);
    const out = await resolveTemplatesDir(repo, { templatesDir: 'tpl' } as any);
    expect(out).toBe(dir);
  });

  it('resolveTemplatesDir falls back to builtin if custom dir missing', async () => {
    const repo = await makeTempDir();
    const out = await resolveTemplatesDir(repo, { templatesDir: 'nope' } as any);
    expect(out).not.toContain('nope');
  });
});

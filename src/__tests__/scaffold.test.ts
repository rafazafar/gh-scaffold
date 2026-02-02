import { describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { scanRepo, applyScaffold } from '../scaffold.js';

import { makeTempDir, readRepoFile, writeRepoFile } from './helpers.js';

describe('scaffold', () => {
  it('scanRepo reports missing essentials', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, '.git'));
    await fs.writeFile(path.resolve(repo, '.git/config'), '[remote "origin"]\n\turl = https://github.com/acme/demo.git\n', 'utf8');

    const scan = await scanRepo(repo);
    expect(scan.meta.ownerRepo).toBe('acme/demo');
    expect(scan.missing).toContain('CONTRIBUTING');
    expect(scan.missing).toContain('SECURITY');
  });

  it('applyScaffold dry-run does not write files', async () => {
    const repo = await makeTempDir();
    const res = await applyScaffold({ repoPath: repo, preset: 'minimal', dryRun: true, diff: true });
    expect(res.written.length).toBeGreaterThan(0);
    expect(res.diffs.length).toBeGreaterThan(0);
    expect(await fs.pathExists(path.resolve(repo, 'CONTRIBUTING.md'))).toBe(false);
  });

  it('applyScaffold writes minimal preset files', async () => {
    const repo = await makeTempDir();
    const res = await applyScaffold({ repoPath: repo, preset: 'minimal' });
    expect(res.written).toContain('CONTRIBUTING.md');
    expect(await fs.pathExists(path.resolve(repo, 'CONTRIBUTING.md'))).toBe(true);
    expect(await fs.pathExists(path.resolve(repo, '.github/PULL_REQUEST_TEMPLATE.md'))).toBe(true);
  });

  it('diff and print work (and skipped is reported when file exists)', async () => {
    const repo = await makeTempDir();
    await writeRepoFile(repo, 'CONTRIBUTING.md', 'EXISTING\n');

    let printed = '';
    const orig = process.stdout.write;
    // @ts-expect-error
    process.stdout.write = (chunk: any) => {
      printed += String(chunk);
      return true;
    };

    try {
      const res = await applyScaffold({
        repoPath: repo,
        preset: 'minimal',
        diff: true,
        print: true,
        dryRun: true,
        only: ['CONTRIBUTING'],
      });
      expect(res.skipped).toContain('CONTRIBUTING.md');
      expect(res.diffs.length).toBe(0);
      expect(printed).not.toContain('===== CONTRIBUTING.md =====');

      // now force overwrite and ensure diff/print happen
      printed = '';
      const res2 = await applyScaffold({
        repoPath: repo,
        preset: 'minimal',
        force: true,
        diff: true,
        print: true,
        dryRun: true,
        only: ['CONTRIBUTING'],
      });
      expect(res2.skipped.length).toBe(0);
      expect(res2.diffs.length).toBe(1);
      expect(printed).toContain('===== CONTRIBUTING.md =====');
    } finally {
      // @ts-expect-error
      process.stdout.write = orig;
    }
  });

  it('forms issue templates produce .yml files', async () => {
    const repo = await makeTempDir();
    const res = await applyScaffold({ repoPath: repo, preset: 'standard', issueTemplates: 'forms' });
    expect(res.written.some(p => p.endsWith('bug_report.yml'))).toBe(true);
    expect(await fs.pathExists(path.resolve(repo, '.github/ISSUE_TEMPLATE/bug_report.yml'))).toBe(true);
  });

  it('custom templatesDir is used', async () => {
    const repo = await makeTempDir();
    const tdir = path.resolve(repo, 'my-templates');
    await fs.ensureDir(path.resolve(tdir, 'ISSUE_TEMPLATE'));
    await fs.writeFile(path.resolve(tdir, 'CONTRIBUTING.md'), 'CUSTOM CONTRIBUTING\n', 'utf8');
    await fs.writeFile(path.resolve(tdir, 'SECURITY.md'), 'CUSTOM SECURITY\n', 'utf8');
    await fs.writeFile(path.resolve(tdir, 'PULL_REQUEST_TEMPLATE.md'), 'CUSTOM PR\n', 'utf8');
    await fs.writeFile(path.resolve(tdir, 'ISSUE_TEMPLATE/bug_report.md'), 'BUG\n', 'utf8');
    await fs.writeFile(path.resolve(tdir, 'ISSUE_TEMPLATE/feature_request.md'), 'FEATURE\n', 'utf8');

    await applyScaffold({ repoPath: repo, preset: 'standard', templatesDir: tdir, only: ['CONTRIBUTING', 'SECURITY', 'PULL_REQUEST_TEMPLATE', 'ISSUE_TEMPLATE_BUG', 'ISSUE_TEMPLATE_FEATURE'] });

    expect(await readRepoFile(repo, 'CONTRIBUTING.md')).toContain('CUSTOM CONTRIBUTING');
    expect(await readRepoFile(repo, 'SECURITY.md')).toContain('CUSTOM SECURITY');
  });

  it('warns when a required template is missing in custom templatesDir', async () => {
    const repo = await makeTempDir();
    const tdir = path.resolve(repo, 'broken-templates');
    await fs.ensureDir(tdir);

    const res = await applyScaffold({ repoPath: repo, preset: 'minimal', templatesDir: tdir, dryRun: true });
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('update mode inserts managed block without overwriting whole file', async () => {
    const repo = await makeTempDir();
    await writeRepoFile(repo, 'SECURITY.md', '# Security\n\nUser intro\n');

    const res = await applyScaffold({ repoPath: repo, preset: 'minimal', update: true, only: ['SECURITY'] });
    expect(res.written[0]).toContain('SECURITY.md');

    const updated = await readRepoFile(repo, 'SECURITY.md');
    expect(updated).toContain('User intro');
    expect(updated).toContain('gh-scaffold:begin security');
  });

  it('update mode replaces existing managed block', async () => {
    const repo = await makeTempDir();
    await writeRepoFile(
      repo,
      'SECURITY.md',
      [
        '# Security',
        '',
        '<!-- gh-scaffold:begin security -->',
        'OLD',
        '<!-- gh-scaffold:end security -->',
        '',
      ].join('\n')
    );

    await applyScaffold({ repoPath: repo, preset: 'minimal', update: true, only: ['SECURITY'] });
    const updated = await readRepoFile(repo, 'SECURITY.md');
    expect(updated).not.toContain('\nOLD\n');
    expect(updated).toContain('Security Policy');
  });

  it('strict preset writes extra files (license/changelog/etc)', async () => {
    const repo = await makeTempDir();
    const res = await applyScaffold({ repoPath: repo, preset: 'strict', only: ['CHANGELOG', 'LICENSE_MIT', 'GOVERNANCE', 'MAINTAINERS'] });
    expect(res.written).toContain('CHANGELOG.md');
    expect(res.written).toContain('LICENSE');
    expect(await fs.pathExists(path.resolve(repo, 'LICENSE'))).toBe(true);
  });

  it('config can fill CODEOWNERS and FUNDING', async () => {
    const repo = await makeTempDir();
    await fs.writeFile(
      path.resolve(repo, 'gh-scaffold.yml'),
      [
        'preset: strict',
        'ownership:',
        '  defaultOwners: ["@acme/maintainers"]',
        'funding:',
        '  github: "acme"',
        '  custom: ["https://example.com/sponsor"]',
        '',
      ].join('\n'),
      'utf8'
    );

    await applyScaffold({ repoPath: repo, preset: 'strict', only: ['CODEOWNERS', 'FUNDING'] });

    const codeowners = await readRepoFile(repo, '.github/CODEOWNERS');
    expect(codeowners).toContain('* @acme/maintainers');

    const funding = await readRepoFile(repo, '.github/FUNDING.yml');
    expect(funding).toContain('github:');
    expect(funding).toContain('custom:');
    expect(funding).toContain('https://example.com/sponsor');
  });

  it('scope=packages applies to packages/* directories', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, 'packages/a'));
    await fs.ensureDir(path.resolve(repo, 'packages/b'));
    await fs.writeFile(path.resolve(repo, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }), 'utf8');

    const res = await applyScaffold({ repoPath: repo, preset: 'minimal', scopeMode: 'packages' });
    // should write into each package
    expect(res.written.some(p => p.includes('packages'))).toBe(true);
    expect(await fs.pathExists(path.resolve(repo, 'packages/a/CONTRIBUTING.md'))).toBe(true);
    expect(await fs.pathExists(path.resolve(repo, 'packages/b/SECURITY.md'))).toBe(true);
  });

  it('scope=all includes root + packages', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, 'packages/a'));
    await fs.writeFile(path.resolve(repo, 'package.json'), JSON.stringify({ workspaces: ['packages/*'] }), 'utf8');

    const res = await applyScaffold({ repoPath: repo, preset: 'minimal', scopeMode: 'all' });
    expect(await fs.pathExists(path.resolve(repo, 'CONTRIBUTING.md'))).toBe(true);
    expect(await fs.pathExists(path.resolve(repo, 'packages/a/CONTRIBUTING.md'))).toBe(true);
    expect(res.summary).toContain('scope=all');
  });

  it('skip/only filters work', async () => {
    const repo = await makeTempDir();
    const res = await applyScaffold({ repoPath: repo, preset: 'strict', only: ['CHANGELOG'], skip: ['CHANGELOG'] });
    expect(res.written.length).toBe(0);
  });
});

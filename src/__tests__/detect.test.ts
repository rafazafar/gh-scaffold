import { describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { detectRepoMeta } from '../detect.js';
import { makeTempDir } from './helpers.js';

describe('detectRepoMeta', () => {
  it('detects name/description and workspaces from package.json', async () => {
    const repo = await makeTempDir();
    await fs.writeJson(path.resolve(repo, 'package.json'), {
      name: 'demo',
      description: 'desc',
      workspaces: ['packages/*'],
    });

    const meta = await detectRepoMeta(repo);
    expect(meta.name).toBe('demo');
    expect(meta.description).toBe('desc');
    expect(meta.isMonorepo).toBe(true);
    expect(meta.workspaceGlobs).toEqual(['packages/*']);
  });

  it('handles invalid package.json gracefully', async () => {
    const repo = await makeTempDir();
    await fs.writeFile(path.resolve(repo, 'package.json'), '{not json', 'utf8');
    const meta = await detectRepoMeta(repo);
    expect(meta.name).toBeUndefined();
  });

  it('handles missing git config gracefully', async () => {
    const repo = await makeTempDir();
    const meta = await detectRepoMeta(repo);
    expect(meta.ownerRepo).toBeUndefined();
  });

  it('parses owner/repo from https origin url', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, '.git'));
    await fs.writeFile(
      path.resolve(repo, '.git/config'),
      '[remote "origin"]\n\turl = https://github.com/acme/myrepo.git\n',
      'utf8'
    );
    const meta = await detectRepoMeta(repo);
    expect(meta.ownerRepo).toBe('acme/myrepo');
  });

  it('parses owner/repo from ssh origin url', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, '.git'));
    await fs.writeFile(
      path.resolve(repo, '.git/config'),
      '[remote "origin"]\n\turl = git@github.com:acme/myrepo.git\n',
      'utf8'
    );
    const meta = await detectRepoMeta(repo);
    expect(meta.ownerRepo).toBe('acme/myrepo');
  });
});

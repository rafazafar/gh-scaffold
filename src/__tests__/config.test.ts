import { describe, expect, it } from 'vitest';
import fs from 'fs-extra';
import path from 'node:path';
import { loadConfig, mergeConfig } from '../config.js';
import { makeTempDir } from './helpers.js';

describe('config', () => {
  it('mergeConfig deep merges nested fields', () => {
    const base = { preset: 'standard', contacts: { supportUrl: 'a' }, behavior: { update: false } };
    const overlay = { contacts: { securityEmail: 'sec@x.com' }, behavior: { update: true } };
    const out = mergeConfig(base as any, overlay as any);
    expect(out.preset).toBe('standard');
    expect(out.contacts?.supportUrl).toBe('a');
    expect(out.contacts?.securityEmail).toBe('sec@x.com');
    expect(out.behavior?.update).toBe(true);
  });

  it('loadConfig returns defaults when no file exists', async () => {
    const repo = await makeTempDir();
    const r = await loadConfig(repo);
    expect(r.path).toBe(null);
    expect(r.config.preset).toBe('standard');
  });

  it('loadConfig loads from gh-scaffold.yml', async () => {
    const repo = await makeTempDir();
    await fs.writeFile(
      path.resolve(repo, 'gh-scaffold.yml'),
      'preset: strict\ncontacts:\n  securityEmail: security@example.com\n',
      'utf8'
    );
    const r = await loadConfig(repo);
    expect(r.path).toContain('gh-scaffold.yml');
    expect(r.config.preset).toBe('strict');
    expect(r.config.contacts?.securityEmail).toBe('security@example.com');
  });

  it('loadConfig loads from .github/gh-scaffold.yml', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, '.github'));
    await fs.writeFile(
      path.resolve(repo, '.github/gh-scaffold.yml'),
      'preset: minimal\n',
      'utf8'
    );
    const r = await loadConfig(repo);
    expect(r.path).toContain('.github');
    expect(r.config.preset).toBe('minimal');
  });

  it('loadConfig can load from an explicit path', async () => {
    const repo = await makeTempDir();
    await fs.ensureDir(path.resolve(repo, '.github'));
    await fs.writeFile(
      path.resolve(repo, '.github/custom.yml'),
      'preset: minimal\nissueTemplates: forms\n',
      'utf8'
    );
    const r = await loadConfig(repo, '.github/custom.yml');
    expect(r.path).toContain('custom.yml');
    expect(r.config.preset).toBe('minimal');
    expect(r.config.issueTemplates).toBe('forms');
  });
});

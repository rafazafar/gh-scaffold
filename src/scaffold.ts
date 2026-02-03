import path from 'node:path';
import fs from 'fs-extra';
import fg from 'fast-glob';
import { createPatch } from 'diff';
import { detectRepoMeta } from './detect.js';
import { loadConfig } from './config.js';
import type { PresetName, GhScaffoldConfig } from './config.js';
import { resolveTemplatesDir, templateNameFor } from './templates.js';
import { upsertManagedBlock, wrapManagedBlock } from './markers.js';

export type ScanResult = {
  repoPath: string;
  configPath: string | null;
  meta: Awaited<ReturnType<typeof detectRepoMeta>>;
  files: Record<string, { exists: boolean; path: string }>;
  missing: string[];
};

export type ApplyOptions = {
  repoPath: string;
  configPath?: string;
  force?: boolean;
  dryRun?: boolean;
  minimal?: boolean;
  preset?: PresetName;
  only?: string[];
  skip?: string[];
  print?: boolean;
  diff?: boolean;
  update?: boolean;
  issueTemplates?: 'markdown' | 'forms';
  templatesDir?: string;
  scopeMode?: 'root' | 'packages' | 'all' | undefined;
};

export type ApplyResult = {
  summary: string;
  written: string[];
  skipped: string[];
  warnings: string[];
  diffs: Array<{ path: string; patch: string }>;
};

const COMMUNITY_FILES: Array<{ key: string; relPath: string; essential: boolean; preset: PresetName }> = [
  { key: 'CONTRIBUTING', relPath: 'CONTRIBUTING.md', essential: true, preset: 'minimal' },
  { key: 'SECURITY', relPath: 'SECURITY.md', essential: true, preset: 'minimal' },

  { key: 'PULL_REQUEST_TEMPLATE', relPath: '.github/PULL_REQUEST_TEMPLATE.md', essential: true, preset: 'minimal' },
  // issue templates are part of standard by default
  { key: 'ISSUE_TEMPLATE_BUG', relPath: '.github/ISSUE_TEMPLATE/bug_report', essential: true, preset: 'standard' },
  { key: 'ISSUE_TEMPLATE_FEATURE', relPath: '.github/ISSUE_TEMPLATE/feature_request', essential: true, preset: 'standard' },
  { key: 'ISSUE_TEMPLATE_CONFIG', relPath: '.github/ISSUE_TEMPLATE/config.yml', essential: false, preset: 'standard' },

  { key: 'CODE_OF_CONDUCT', relPath: 'CODE_OF_CONDUCT.md', essential: false, preset: 'standard' },
  { key: 'SUPPORT', relPath: 'SUPPORT.md', essential: false, preset: 'standard' },

  { key: 'FUNDING', relPath: '.github/FUNDING.yml', essential: false, preset: 'strict' },
  { key: 'CODEOWNERS', relPath: '.github/CODEOWNERS', essential: false, preset: 'strict' },
  { key: 'GOVERNANCE', relPath: 'GOVERNANCE.md', essential: false, preset: 'strict' },
  { key: 'MAINTAINERS', relPath: 'MAINTAINERS.md', essential: false, preset: 'strict' },
  { key: 'CHANGELOG', relPath: 'CHANGELOG.md', essential: false, preset: 'strict' },
  { key: 'LICENSE_MIT', relPath: 'LICENSE', essential: false, preset: 'strict' },
];

function abs(repoPath: string, rel: string) {
  return path.resolve(repoPath, rel);
}

function presetRank(p: PresetName): number {
  return p === 'minimal' ? 0 : p === 'standard' ? 1 : 2;
}

function chooseTargetFiles(preset: PresetName, minimalFlag?: boolean): typeof COMMUNITY_FILES {
  if (minimalFlag) return COMMUNITY_FILES.filter(f => f.preset === 'minimal');
  return COMMUNITY_FILES.filter(f => presetRank(f.preset) <= presetRank(preset));
}

function normalizeKeys(keys?: string[]): string[] {
  if (!keys || keys.length === 0) return [];
  return keys.map(k => k.trim()).filter(Boolean);
}

function keyMatches(fileKey: string, only: string[], skip: string[]): boolean {
  if (skip.includes(fileKey)) return false;
  if (!only.length) return true;
  return only.includes(fileKey);
}

function issueExt(format: 'markdown' | 'forms', key: string): string {
  if (key === 'ISSUE_TEMPLATE_BUG' || key === 'ISSUE_TEMPLATE_FEATURE') {
    if (format === 'forms') return 'yml';
    return 'md';
  }
  return '';
}

function resolveIssueRelPath(base: string, format: 'markdown' | 'forms', key: string): string {
  // base is .../bug_report or .../feature_request
  const ext = issueExt(format, key);
  return ext ? `${base}.${ext}` : base;
}

async function listPackageRoots(repoPath: string, config: GhScaffoldConfig): Promise<string[]> {
  const globs = config.scope?.packagesGlobs?.length ? config.scope.packagesGlobs : ['packages/*', 'apps/*'];
  const matches = await fg(globs, { cwd: repoPath, onlyDirectories: true, deep: 2 });
  return matches.map(m => path.resolve(repoPath, m));
}

export async function scanRepo(repoPath = '.', configPath?: string): Promise<ScanResult> {
  const resolved = path.resolve(repoPath);
  const { path: foundConfigPath, config } = await loadConfig(resolved, configPath);
  const meta = await detectRepoMeta(resolved);

  const files: ScanResult['files'] = {};
  const issueFormat = config.issueTemplates ?? 'markdown';

  for (const f of COMMUNITY_FILES) {
    const rel = f.key === 'ISSUE_TEMPLATE_BUG' || f.key === 'ISSUE_TEMPLATE_FEATURE'
      ? resolveIssueRelPath(f.relPath, issueFormat, f.key)
      : f.relPath;

    const p = abs(resolved, rel);
    const exists = await fs.pathExists(p);
    files[f.key] = { exists, path: rel };
  }

  const missing = Object.entries(files)
    .filter(([, v]) => !v.exists)
    .map(([k]) => k);

  return { repoPath: resolved, configPath: foundConfigPath, meta, files, missing };
}

export function formatScanReport(r: ScanResult): string {
  const lines: string[] = [];
  lines.push(`gh-scaffold scan: ${r.repoPath}`);
  if (r.configPath) lines.push(`config: ${r.configPath}`);
  if (r.meta.ownerRepo) lines.push(`remote: ${r.meta.ownerRepo}`);
  lines.push('');

  for (const f of COMMUNITY_FILES) {
    const v = r.files[f.key];
    if (!v) continue;
    lines.push(`${v.exists ? '✓' : '✗'} ${f.key.padEnd(22)} ${v.path}`);
  }
  lines.push('');

  const essentialsMissing = COMMUNITY_FILES.filter(f => f.essential)
    .map(f => f.key)
    .filter(k => r.missing.includes(k));
  lines.push('Missing essentials: ' + (essentialsMissing.length ? essentialsMissing.join(', ') : 'none'));
  lines.push('');
  return lines.join('\n') + '\n';
}

function substituteCommonPlaceholders(text: string, config: GhScaffoldConfig): string {
  let out = text;
  if (config.contacts?.securityEmail) {
    out = out.replace(/<INSERT SECURITY EMAIL>/g, config.contacts.securityEmail);
  }
  if (config.contacts?.cocContact) {
    out = out.replace(/<INSERT CONTACT METHOD \(email, issue form, etc\.\)>/g, config.contacts.cocContact);
  }
  if (config.contacts?.supportUrl) {
    out = out.replace(/https:\/\/github\.com\b/g, config.contacts.supportUrl);
  }
  return out;
}

function applyCodeownersTemplate(text: string, config: GhScaffoldConfig): string {
  const owners = config.ownership?.defaultOwners?.length ? config.ownership.defaultOwners : [];
  if (!owners.length) return text;

  const header = '# Generated by gh-scaffold. Edit as needed.';
  const lines: string[] = [header, `* ${owners.join(' ')}`];
  for (const p of config.ownership?.patterns ?? []) {
    lines.push(`${p.pattern} ${p.owners.join(' ')}`);
  }
  return lines.join('\n') + '\n';
}

function applyFundingTemplate(text: string, config: GhScaffoldConfig): string {
  // If no funding config, leave as skeleton
  if (!config.funding) return text;
  const lines: string[] = [];

  if (config.funding.github) {
    const g = Array.isArray(config.funding.github) ? config.funding.github : [config.funding.github];
    lines.push(`github: [${g.join(', ')}]`);
  }
  if (config.funding.ko_fi) lines.push(`ko_fi: ${config.funding.ko_fi}`);
  if (config.funding.open_collective) lines.push(`open_collective: ${config.funding.open_collective}`);
  if (config.funding.custom?.length) {
    lines.push('custom:');
    for (const u of config.funding.custom) lines.push(`  - ${u}`);
  }

  return lines.length ? lines.join('\n') + '\n' : text;
}

async function readTemplate(templatesDir: string, name: string): Promise<string> {
  return fs.readFile(path.resolve(templatesDir, name), 'utf8');
}

async function buildFileContent(
  templatesDir: string,
  key: string,
  config: GhScaffoldConfig
): Promise<string> {
  const tpl = templateNameFor(key, config.issueTemplates ?? 'markdown');
  if (!tpl) throw new Error(`No template for ${key}`);

  let content = await readTemplate(templatesDir, tpl);
  content = substituteCommonPlaceholders(content, config);

  if (key === 'CODEOWNERS') content = applyCodeownersTemplate(content, config);
  if (key === 'FUNDING') content = applyFundingTemplate(content, config);

  return content;
}

function computePatch(filePath: string, before: string, after: string): string {
  return createPatch(filePath, before, after, 'before', 'after');
}

async function applyToSingleRepo(repoPath: string, opts: ApplyOptions, config: GhScaffoldConfig): Promise<ApplyResult> {
  const scan = await scanRepo(repoPath, opts.configPath);

  const force = !!opts.force;
  const dryRun = !!opts.dryRun;
  const print = !!opts.print;
  const showDiff = !!opts.diff;
  const update = opts.update ?? config.behavior?.update ?? false;

  const preset: PresetName = opts.preset ?? (opts.minimal ? 'minimal' : (config.preset ?? 'standard'));

  const only = normalizeKeys(opts.only);
  const skip = normalizeKeys(opts.skip);

  const templatesDir = await resolveTemplatesDir(repoPath, {
    ...config,
    ...(opts.issueTemplates ? { issueTemplates: opts.issueTemplates } : {}),
    ...(opts.templatesDir ? { templatesDir: opts.templatesDir } : {}),
  });

  const written: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];
  const diffs: ApplyResult['diffs'] = [];

  const targets = chooseTargetFiles(preset, opts.minimal);

  for (const f of targets) {
    if (!keyMatches(f.key, only, skip)) continue;

    const rel = f.key === 'ISSUE_TEMPLATE_BUG' || f.key === 'ISSUE_TEMPLATE_FEATURE'
      ? resolveIssueRelPath(f.relPath, (opts.issueTemplates ?? config.issueTemplates ?? 'markdown'), f.key)
      : f.relPath;

    const destAbs = abs(repoPath, rel);
    const exists = await fs.pathExists(destAbs);

    // Build desired content
    let desired: string;
    try {
      desired = await buildFileContent(templatesDir, f.key, {
        ...config,
        ...(opts.issueTemplates ? { issueTemplates: opts.issueTemplates } : {}),
      });
    } catch (e: any) {
      warnings.push(String(e?.message ?? e));
      continue;
    }

    const isMarkdown = /\.md$/i.test(rel);

    if (exists && update && !force) {
      // Update mode: managed markers are Markdown-only.
      if (!isMarkdown) {
        skipped.push(rel + ' (update skipped: non-markdown)');
        continue;
      }

      // Only touches managed block. If file has no managed block, append one.
      const current = await fs.readFile(destAbs, 'utf8');
      const next = upsertManagedBlock(current, f.key.toLowerCase(), desired);

      if (showDiff) diffs.push({ path: rel, patch: computePatch(rel, current, next) });
      if (print) {
        process.stdout.write(`\n===== ${rel} =====\n`);
        process.stdout.write(next + (next.endsWith('\n') ? '' : '\n'));
      }

      if (dryRun) {
        written.push(rel + ' (update; dry-run)');
      } else {
        await fs.writeFile(destAbs, next, 'utf8');
        written.push(rel + ' (update)');
      }
      continue;
    }

    if (!exists && update && !force && isMarkdown) {
      // When creating a new Markdown file in update mode, create it already wrapped.
      desired = wrapManagedBlock(f.key.toLowerCase(), desired);
    }

    if (exists && !force) {
      skipped.push(rel);
      continue;
    }

    if (showDiff) {
      const before = exists ? await fs.readFile(destAbs, 'utf8') : '';
      diffs.push({ path: rel, patch: computePatch(rel, before, desired) });
    }

    if (print) {
      process.stdout.write(`\n===== ${rel} =====\n`);
      process.stdout.write(desired + (desired.endsWith('\n') ? '' : '\n'));
    }

    if (dryRun) {
      written.push(rel + ' (dry-run)');
      continue;
    }

    await fs.ensureDir(path.dirname(destAbs));
    await fs.writeFile(destAbs, desired, 'utf8');
    written.push(rel);
  }

  const summary = `Applied gh-scaffold to ${repoPath}. Wrote ${written.length}, skipped ${skipped.length}.`;
  return { summary, written, skipped, warnings, diffs };
}

export async function applyScaffold(opts: ApplyOptions): Promise<ApplyResult> {
  const repoPath = path.resolve(opts.repoPath);
  const { config } = await loadConfig(repoPath, opts.configPath);

  // override scope
  const scopeMode = opts.scopeMode ?? config.scope?.mode ?? 'root';

  if (scopeMode === 'root') {
    return applyToSingleRepo(repoPath, opts, config);
  }

  const roots: string[] = [repoPath];
  if (scopeMode === 'packages' || scopeMode === 'all') {
    const pkgs = await listPackageRoots(repoPath, config);
    roots.splice(0, roots.length, ...(scopeMode === 'packages' ? pkgs : [repoPath, ...pkgs]));
  }

  const agg: ApplyResult = { summary: '', written: [], skipped: [], warnings: [], diffs: [] };

  for (const root of roots) {
    const r = await applyToSingleRepo(root, opts, config);
    agg.written.push(...r.written.map(p => path.relative(repoPath, path.resolve(root, p))));
    agg.skipped.push(...r.skipped.map(p => path.relative(repoPath, path.resolve(root, p))));
    agg.warnings.push(...r.warnings.map(w => `[${path.relative(repoPath, root)}] ${w}`));
    agg.diffs.push(...r.diffs.map(d => ({ path: path.relative(repoPath, path.resolve(root, d.path)), patch: d.patch })));
  }

  agg.summary = `Applied gh-scaffold to ${repoPath} (scope=${scopeMode}). Wrote ${agg.written.length}, skipped ${agg.skipped.length}.`;
  return agg;
}

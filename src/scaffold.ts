import path from 'node:path';
import fs from 'fs-extra';

export type ScanResult = {
  repoPath: string;
  files: Record<string, { exists: boolean; path: string }>;
  missing: string[];
};

export type ApplyOptions = {
  repoPath: string;
  scan?: ScanResult;
  force?: boolean;
  dryRun?: boolean;
  minimal?: boolean;
};

export type ApplyResult = {
  summary: string;
  written: string[];
  skipped: string[];
  warnings: string[];
};

const COMMUNITY_FILES: Array<{ key: string; relPath: string; essential: boolean }> = [
  { key: 'CONTRIBUTING', relPath: 'CONTRIBUTING.md', essential: true },
  { key: 'CODE_OF_CONDUCT', relPath: 'CODE_OF_CONDUCT.md', essential: false },
  { key: 'SECURITY', relPath: 'SECURITY.md', essential: true },
  { key: 'SUPPORT', relPath: 'SUPPORT.md', essential: false },
  { key: 'PULL_REQUEST_TEMPLATE', relPath: '.github/PULL_REQUEST_TEMPLATE.md', essential: true },
  { key: 'ISSUE_TEMPLATE_BUG', relPath: '.github/ISSUE_TEMPLATE/bug_report.md', essential: true },
  { key: 'ISSUE_TEMPLATE_FEATURE', relPath: '.github/ISSUE_TEMPLATE/feature_request.md', essential: true },
  { key: 'ISSUE_TEMPLATE_CONFIG', relPath: '.github/ISSUE_TEMPLATE/config.yml', essential: false },
  { key: 'FUNDING', relPath: '.github/FUNDING.yml', essential: false },
  { key: 'CODEOWNERS', relPath: '.github/CODEOWNERS', essential: false },
];

function abs(repoPath: string, rel: string) {
  return path.resolve(repoPath, rel);
}

export async function scanRepo(repoPath = '.'): Promise<ScanResult> {
  const resolved = path.resolve(repoPath);
  const files: ScanResult['files'] = {};

  for (const f of COMMUNITY_FILES) {
    const p = abs(resolved, f.relPath);
    const exists = await fs.pathExists(p);
    files[f.key] = { exists, path: f.relPath };
  }

  const missing = Object.entries(files)
    .filter(([, v]) => !v.exists)
    .map(([k]) => k);

  return { repoPath: resolved, files, missing };
}

export function formatScanReport(r: ScanResult): string {
  const lines: string[] = [];
  lines.push(`gh-scaffold scan: ${r.repoPath}`);
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
  if (essentialsMissing.length) {
    lines.push('Missing essentials: ' + essentialsMissing.join(', '));
  } else {
    lines.push('Missing essentials: none');
  }
  lines.push('');
  return lines.join('\n') + '\n';
}

import { fileURLToPath } from 'node:url';

function templatePath(name: string) {
  const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
  return path.resolve(templatesDir, name);
}

async function readTemplate(name: string): Promise<string> {
  const p = templatePath(name);
  return fs.readFile(p, 'utf8');
}

const TEMPLATE_MAP: Record<string, string> = {
  CONTRIBUTING: 'CONTRIBUTING.md',
  CODE_OF_CONDUCT: 'CODE_OF_CONDUCT.md',
  SECURITY: 'SECURITY.md',
  SUPPORT: 'SUPPORT.md',
  PULL_REQUEST_TEMPLATE: 'PULL_REQUEST_TEMPLATE.md',
  ISSUE_TEMPLATE_BUG: 'ISSUE_TEMPLATE/bug_report.md',
  ISSUE_TEMPLATE_FEATURE: 'ISSUE_TEMPLATE/feature_request.md',
  ISSUE_TEMPLATE_CONFIG: 'ISSUE_TEMPLATE/config.yml',
  FUNDING: 'FUNDING.yml',
  CODEOWNERS: 'CODEOWNERS',
};

export async function applyScaffold(opts: ApplyOptions): Promise<ApplyResult> {
  const repoPath = path.resolve(opts.repoPath);
  const scan = opts.scan ?? (await scanRepo(repoPath));
  const force = !!opts.force;
  const dryRun = !!opts.dryRun;
  const minimal = !!opts.minimal;

  const written: string[] = [];
  const skipped: string[] = [];
  const warnings: string[] = [];

  const targets = COMMUNITY_FILES.filter(f => !minimal || f.essential);

  for (const f of targets) {
    const info = scan.files[f.key];
    if (!info) {
      warnings.push(`Internal error: missing scan info for ${f.key}`);
      continue;
    }

    const destAbs = abs(repoPath, info.path);

    if (info.exists && !force) {
      skipped.push(info.path);
      continue;
    }

    const tplName = TEMPLATE_MAP[f.key];
    if (!tplName) {
      warnings.push(`No template mapped for ${f.key}`);
      continue;
    }

    const content = await readTemplate(tplName);

    if (dryRun) {
      written.push(info.path + ' (dry-run)');
      continue;
    }

    await fs.ensureDir(path.dirname(destAbs));
    await fs.writeFile(destAbs, content, 'utf8');
    written.push(info.path);
  }

  const summary = `Applied gh-scaffold to ${repoPath}. Wrote ${written.length}, skipped ${skipped.length}.`;
  return { summary, written, skipped, warnings };
}

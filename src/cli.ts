#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import { scanRepo, applyScaffold, formatScanReport } from './scaffold.js';
import { loadConfig, mergeConfig } from './config.js';
import type { GhScaffoldConfig } from './config.js';

const program = new Command();

program
  .name('gh-scaffold')
  .description('Scan a repo and generate missing GitHub community health files (.github templates, CONTRIBUTING, SECURITY, etc.)')
  .version('0.2.0');

function csv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

program
  .command('scan')
  .description('Scan a repository and print what is missing')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .option('--json', 'Output JSON', false)
  .action(async (opts) => {
    const result = await scanRepo(opts.repo, opts.config);
    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write(formatScanReport(result));
    }
  });

program
  .command('init')
  .description('Interactive setup (creates missing files with your chosen options)')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .action(async (opts) => {
    const repoPath = opts.repo;
    const loaded = await loadConfig(repoPath, opts.config);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'preset',
        message: 'Preset:',
        choices: [
          { name: 'minimal (CONTRIBUTING, SECURITY, PR template)', value: 'minimal' },
          { name: 'standard (+ issue templates, CoC, SUPPORT)', value: 'standard' },
          { name: 'strict (+ CODEOWNERS, FUNDING, GOVERNANCE, LICENSE, etc.)', value: 'strict' },
        ],
        default: loaded.config.preset ?? 'standard',
      },
      {
        type: 'list',
        name: 'issueTemplates',
        message: 'Issue templates format:',
        choices: [
          { name: 'Markdown (.md)', value: 'markdown' },
          { name: 'Issue Forms (.yml)', value: 'forms' },
        ],
        default: loaded.config.issueTemplates ?? 'markdown',
      },
      {
        type: 'input',
        name: 'supportUrl',
        message: 'Support URL (e.g. Discussions link) (optional):',
        default: loaded.config.contacts?.supportUrl ?? '',
      },
      {
        type: 'input',
        name: 'securityEmail',
        message: 'Security email (optional):',
        default: loaded.config.contacts?.securityEmail ?? '',
      },
      {
        type: 'input',
        name: 'cocContact',
        message: 'Code of Conduct contact (email/url) (optional):',
        default: loaded.config.contacts?.cocContact ?? '',
      },
      {
        type: 'input',
        name: 'codeowners',
        message: 'Default CODEOWNERS owners (comma-separated, optional):',
        default: (loaded.config.ownership?.defaultOwners ?? []).join(', '),
      },
      {
        type: 'confirm',
        name: 'dryRun',
        message: 'Dry run (preview without writing files)?',
        default: true,
      },
      {
        type: 'confirm',
        name: 'diff',
        message: 'Show diffs?',
        default: true,
      },
    ]);

    const overlay: GhScaffoldConfig = {
      preset: answers.preset,
      issueTemplates: answers.issueTemplates,
      contacts: {
        supportUrl: answers.supportUrl || undefined,
        securityEmail: answers.securityEmail || undefined,
        cocContact: answers.cocContact || undefined,
      },
      ownership: {
        defaultOwners: csv(answers.codeowners),
      },
    };

    const config = mergeConfig(loaded.config, overlay);

    const res = await applyScaffold({
      repoPath,
      preset: (config.preset ?? 'standard') as any,
      issueTemplates: (config.issueTemplates ?? 'markdown') as any,
      diff: answers.diff,
      dryRun: answers.dryRun,
      scopeMode: config.scope?.mode,
    });

    process.stdout.write(res.summary + '\n');
    if (res.diffs.length) {
      process.stdout.write('\nDiffs:\n');
      for (const d of res.diffs) process.stdout.write(d.patch + '\n');
    }
  });

program
  .command('apply')
  .description('Generate missing files into the repo (safe by default)')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .option('--preset <preset>', 'Preset: minimal|standard|strict')
  .option('--issue-templates <format>', 'Issue templates format: markdown|forms')
  .option('--templates <path>', 'Custom templates directory')
  .option('--scope <mode>', 'Scope mode: root|packages|all')
  .option('--force', 'Overwrite existing files', false)
  .option('--update', 'Update mode (managed markers, no overwrite)', false)
  .option('--dry-run', 'Show what would be written, without writing', false)
  .option('--print', 'Print generated file contents to stdout', false)
  .option('--diff', 'Show unified diffs', false)
  .option('--minimal', 'Only create essential files (legacy flag; same as preset=minimal)', false)
  .option('--only <keys>', 'Comma-separated keys to include (e.g. SECURITY,CONTRIBUTING)', '')
  .option('--skip <keys>', 'Comma-separated keys to skip (e.g. FUNDING,CODEOWNERS)', '')
  .action(async (opts) => {
    const res = await applyScaffold({
      repoPath: opts.repo,
      configPath: opts.config,
      force: !!opts.force,
      update: !!opts.update,
      dryRun: !!opts.dryRun,
      print: !!opts.print,
      diff: !!opts.diff,
      minimal: !!opts.minimal,
      preset: opts.preset,
      issueTemplates: opts.issueTemplates,
      templatesDir: opts.templates,
      scopeMode: opts.scope,
      only: csv(opts.only),
      skip: csv(opts.skip),
    });

    process.stdout.write(res.summary + '\n');

    if (res.warnings.length) {
      process.stdout.write('\nWarnings:\n' + res.warnings.map((w) => `- ${w}`).join('\n') + '\n');
    }
    if (res.written.length) {
      process.stdout.write('\nWritten:\n' + res.written.map((w) => `- ${w}`).join('\n') + '\n');
    }
    if (res.skipped.length) {
      process.stdout.write('\nSkipped:\n' + res.skipped.map((w) => `- ${w}`).join('\n') + '\n');
    }
    if (res.diffs.length) {
      process.stdout.write('\nDiffs:\n');
      for (const d of res.diffs) process.stdout.write(d.patch + '\n');
    }
  });

program
  .command('doctor')
  .description('Validate placeholders/links and GitHub detection compatibility (basic)')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .action(async (opts) => {
    const scan = await scanRepo(opts.repo, opts.config);
    const problems: string[] = [];

    const maybePaths = Object.values(scan.files)
      .filter((f) => f.exists)
      .map((f) => f.path);

    for (const rel of maybePaths) {
      const p = new URL(`file://${scan.repoPath.replace(/\\/g, '/')}/${rel}`);
      try {
        const content = await (await import('fs/promises')).readFile(p, 'utf8');
        if (content.includes('<INSERT SECURITY EMAIL>')) problems.push(`${rel}: contains <INSERT SECURITY EMAIL>`);
        if (content.includes('<INSERT CONTACT METHOD')) problems.push(`${rel}: contains <INSERT CONTACT METHOD ...>`);
      } catch {
        // ignore
      }
    }

    if (!problems.length) {
      process.stdout.write('doctor: ok\n');
      return;
    }

    process.stdout.write('doctor: issues found\n');
    for (const p of problems) process.stdout.write(`- ${p}\n`);
    process.exitCode = 1;
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});

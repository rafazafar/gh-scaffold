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
  .version('1.0.0')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .option('--json', 'Output JSON (scan mode)', false)
  .option('--scan', 'Force non-interactive scan (legacy default)', false)
  .option('--non-interactive', 'Disable prompts (CI-friendly)', false)
  .option('-w, --write', 'Write missing files (apply mode)', false)
  .option('--preset <preset>', 'Preset (apply mode): minimal|standard|strict', 'standard')
  .option('--issue-templates <format>', 'Issue templates (apply mode): markdown|forms', 'markdown')
  .option('--templates <path>', 'Custom templates directory (apply mode)')
  .option('--scope <mode>', 'Scope mode (apply mode): root|packages|all')
  .option('--license <type>', 'License (apply mode): none|mit|apache-2.0|gpl-3.0', 'none')
  .option('--force', 'Overwrite existing files (apply mode)', false)
  .option('--update', 'Update mode (apply mode; managed markers for markdown only)', false)
  .option('--dry-run', 'Do not write files (apply mode)', false)
  .option('--print', 'Print generated file contents to stdout (apply mode)', false)
  .option('--diff', 'Show unified diffs (apply mode)', false)
  .option('--only <keys>', 'Comma-separated keys to include (apply mode)', '')
  .option('--skip <keys>', 'Comma-separated keys to skip (apply mode)', '')
  .option('-i, --interactive', 'Interactive mode (prompts; default when TTY and no flags)', false)
  .action(async (opts) => {
    const isTTY = !!process.stdout.isTTY && !!process.stdin.isTTY;
    const wantsInteractive = (opts.interactive || (isTTY && !opts.nonInteractive && !opts.scan && !opts.json && !opts.write));

    if (wantsInteractive) {
      const scan = await scanRepo(opts.repo, opts.config);

      // Always start by showing the scan result (quick context)
      process.stdout.write(formatScanReport(scan));

      if (!scan.missing.length) return;

      const loaded = await loadConfig(opts.repo, opts.config);

      const choices = scan.missing.map((k) => {
        const p = scan.files[k]?.path ?? '';
        return { name: p ? `${k}  (${p})` : k, value: k, checked: true };
      });

      const answers = await inquirer.prompt([
        {
          type: 'checkbox',
          name: 'only',
          message: 'Select missing items to generate:',
          choices,
          validate: (arr: string[]) => (arr?.length ? true : 'Select at least one item.'),
        },
        {
          type: 'list',
          name: 'issueTemplates',
          message: 'Issue templates format:',
          choices: [
            { name: 'Markdown (.md)', value: 'markdown' },
            { name: 'Issue Forms (.yml)', value: 'forms' },
          ],
          default: loaded.config.issueTemplates ?? opts.issueTemplates ?? 'markdown',
          when: (a) => a.only.includes('ISSUE_TEMPLATE_BUG') || a.only.includes('ISSUE_TEMPLATE_FEATURE') || a.only.includes('ISSUE_TEMPLATE_CONFIG'),
        },
        {
          type: 'list',
          name: 'license',
          message: 'License file:',
          choices: [
            { name: 'none (skip LICENSE)', value: 'none' },
            { name: 'MIT', value: 'mit' },
            { name: 'Apache-2.0', value: 'apache-2.0' },
            { name: 'GPL-3.0', value: 'gpl-3.0' },
          ],
          default: loaded.config.license ?? opts.license ?? 'none',
          when: (a) => a.only.includes('LICENSE'),
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
        {
          type: 'confirm',
          name: 'force',
          message: 'Overwrite existing files if present?',
          default: false,
        },
      ]);

      const res = await applyScaffold({
        repoPath: opts.repo,
        configPath: opts.config,
        // use strict so any selected keys are in-scope; selection is controlled via --only
        preset: 'strict',
        issueTemplates: answers.issueTemplates ?? loaded.config.issueTemplates ?? opts.issueTemplates,
        license: answers.license ?? loaded.config.license ?? opts.license,
        templatesDir: opts.templates,
        scopeMode: opts.scope,
        force: !!answers.force,
        update: !!opts.update,
        dryRun: !!answers.dryRun,
        diff: !!answers.diff,
        print: !!opts.print,
        only: answers.only,
        skip: csv(opts.skip),
      });

      process.stdout.write(res.summary + '\n');
      if (res.warnings.length) process.stdout.write('\nWarnings:\n' + res.warnings.map((w: string) => `- ${w}`).join('\n') + '\n');
      if (res.written.length) process.stdout.write('\nWritten:\n' + res.written.map((w: string) => `- ${w}`).join('\n') + '\n');
      if (res.skipped.length) process.stdout.write('\nSkipped:\n' + res.skipped.map((w: string) => `- ${w}`).join('\n') + '\n');
      if (res.diffs.length) {
        process.stdout.write('\nDiffs:\n');
        for (const d of res.diffs) process.stdout.write(d.patch + '\n');
      }
      return;
    }

    // Non-interactive default: scan unless -w/--write.
    if (!opts.write || opts.scan || opts.json) {
      const result = await scanRepo(opts.repo, opts.config);
      if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      else process.stdout.write(formatScanReport(result));
      return;
    }

    // Write mode: apply
    const res = await applyScaffold({
      repoPath: opts.repo,
      configPath: opts.config,
      preset: opts.preset,
      issueTemplates: opts.issueTemplates,
      license: opts.license,
      templatesDir: opts.templates,
      scopeMode: opts.scope,
      force: !!opts.force,
      update: !!opts.update,
      dryRun: !!opts.dryRun,
      print: !!opts.print,
      diff: !!opts.diff,
      only: csv(opts.only),
      skip: csv(opts.skip),
    });

    process.stdout.write(res.summary + '\n');

    if (res.warnings.length) {
      process.stdout.write('\nWarnings:\n' + res.warnings.map((w: string) => `- ${w}`).join('\n') + '\n');
    }
    if (res.written.length) {
      process.stdout.write('\nWritten:\n' + res.written.map((w: string) => `- ${w}`).join('\n') + '\n');
    }
    if (res.skipped.length) {
      process.stdout.write('\nSkipped:\n' + res.skipped.map((w: string) => `- ${w}`).join('\n') + '\n');
    }
    if (res.diffs.length) {
      process.stdout.write('\nDiffs:\n');
      for (const d of res.diffs) process.stdout.write(d.patch + '\n');
    }
  });

function csv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Back-compat alias (deprecated): `gh-scaffold scan`.
program
  .command('scan')
  .description('[deprecated] Scan a repository and print what is missing (default command is now scan)')
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
        message: 'Default preset for non-interactive runs (-w/--write):',
        choices: [
          { name: 'minimal', value: 'minimal' },
          { name: 'standard', value: 'standard' },
          { name: 'strict', value: 'strict' },
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
        type: 'list',
        name: 'license',
        message: 'License file:',
        choices: [
          { name: 'none (do not generate LICENSE)', value: 'none' },
          { name: 'MIT', value: 'mit' },
          { name: 'Apache-2.0', value: 'apache-2.0' },
          { name: 'GPL-3.0', value: 'gpl-3.0' },
        ],
        default: loaded.config.license ?? 'none',
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
      license: answers.license,
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
      license: (config.license ?? 'none') as any,
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

// Back-compat alias (deprecated): `gh-scaffold apply`.
program
  .command('apply')
  .description('[deprecated] Generate missing files (use `-w/--write` instead)')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('-c, --config <path>', 'Path to config file (default: auto-detect)')
  .option('--preset <preset>', 'Preset: minimal|standard|strict', 'standard')
  .option('--issue-templates <format>', 'Issue templates format: markdown|forms', 'markdown')
  .option('--templates <path>', 'Custom templates directory')
  .option('--scope <mode>', 'Scope mode: root|packages|all')
  .option('--force', 'Overwrite existing files', false)
  .option('--update', 'Update mode (managed markers for markdown only)', false)
  .option('--dry-run', 'Show what would be written, without writing', false)
  .option('--print', 'Print generated file contents to stdout', false)
  .option('--diff', 'Show unified diffs', false)
  .option('--only <keys>', 'Comma-separated keys to include', '')
  .option('--skip <keys>', 'Comma-separated keys to skip', '')
  .action(async (opts) => {
    const res = await applyScaffold({
      repoPath: opts.repo,
      configPath: opts.config,
      force: !!opts.force,
      update: !!opts.update,
      dryRun: !!opts.dryRun,
      print: !!opts.print,
      diff: !!opts.diff,
      preset: opts.preset,
      issueTemplates: opts.issueTemplates,
      templatesDir: opts.templates,
      scopeMode: opts.scope,
      only: csv(opts.only),
      skip: csv(opts.skip),
    });

    process.stdout.write(res.summary + '\n');
    if (res.warnings.length) process.stdout.write('\nWarnings:\n' + res.warnings.map((w: string) => `- ${w}`).join('\n') + '\n');
    if (res.written.length) process.stdout.write('\nWritten:\n' + res.written.map((w: string) => `- ${w}`).join('\n') + '\n');
    if (res.skipped.length) process.stdout.write('\nSkipped:\n' + res.skipped.map((w: string) => `- ${w}`).join('\n') + '\n');
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

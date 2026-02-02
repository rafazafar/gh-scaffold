#!/usr/bin/env node
import { Command } from 'commander';
import { scanRepo, applyScaffold, formatScanReport } from './scaffold.js';

const program = new Command();

program
  .name('gh-scaffold')
  .description('Scan a repo and generate missing GitHub community health files (.github templates, CONTRIBUTING, SECURITY, etc.)')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a repository and print what is missing')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('--json', 'Output JSON', false)
  .action(async (opts) => {
    const result = await scanRepo(opts.repo);
    if (opts.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
      process.stdout.write(formatScanReport(result));
    }
  });

program
  .command('apply')
  .description('Generate missing files into the repo (safe by default)')
  .option('-r, --repo <path>', 'Path to repo (default: current directory)', '.')
  .option('--force', 'Overwrite existing files', false)
  .option('--dry-run', 'Show what would be written, without writing', false)
  .option('--minimal', 'Only create essential files (CONTRIBUTING, SECURITY, issue/PR templates)', false)
  .action(async (opts) => {
    const scan = await scanRepo(opts.repo);
    const res = await applyScaffold({
      repoPath: opts.repo,
      scan,
      force: !!opts.force,
      dryRun: !!opts.dryRun,
      minimal: !!opts.minimal,
    });

    process.stdout.write(res.summary + '\n');
    if (res.warnings.length) {
      process.stdout.write('\nWarnings:\n' + res.warnings.map(w => `- ${w}`).join('\n') + '\n');
    }
    if (res.written.length) {
      process.stdout.write('\nWritten:\n' + res.written.map(w => `- ${w}`).join('\n') + '\n');
    }
    if (res.skipped.length) {
      process.stdout.write('\nSkipped:\n' + res.skipped.map(w => `- ${w}`).join('\n') + '\n');
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});

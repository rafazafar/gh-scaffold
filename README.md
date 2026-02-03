# gh-scaffold

`gh-scaffold` is a CLI that **scans a repository** and helps you **generate missing GitHub “community health” files** (CONTRIBUTING, SECURITY, issue/PR templates, etc.).

It’s designed to be:
- **Safe by default** (no overwrites unless you ask)
- **Repeatable** (idempotent)
- **Configurable** (presets + optional config file)

## What it can generate
Depending on preset/flags:
- `CONTRIBUTING.md`
- `SECURITY.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/bug_report.(md|yml)`
- `.github/ISSUE_TEMPLATE/feature_request.(md|yml)`
- `.github/ISSUE_TEMPLATE/config.yml`
- `CODE_OF_CONDUCT.md`
- `SUPPORT.md`

Strict preset also includes:
- `.github/CODEOWNERS`
- `.github/FUNDING.yml`
- `GOVERNANCE.md`
- `MAINTAINERS.md`
- `CHANGELOG.md`
- `LICENSE` (MIT template)

## Install

### npm (planned)
```bash
npm i -g gh-scaffold
```

### From source
```bash
git clone https://github.com/rafazafar/gh-scaffold
cd gh-scaffold
npm i
npm run build
node dist/cli.js --help
```

## Quick start

Scan current directory:
```bash
gh-scaffold scan
```

Generate files (safe: skips existing):
```bash
gh-scaffold apply
```

Interactive init:
```bash
gh-scaffold init
```

## Common usage

Dry run + diff:
```bash
gh-scaffold apply --dry-run --diff
```

Overwrite existing:
```bash
gh-scaffold apply --force
```

Presets:
```bash
gh-scaffold apply --preset minimal
gh-scaffold apply --preset standard
gh-scaffold apply --preset strict
```

Issue templates format:
```bash
gh-scaffold apply --issue-templates markdown
gh-scaffold apply --issue-templates forms
```

Update mode (Markdown-only managed markers; doesn’t touch non-markdown files):
```bash
gh-scaffold apply --update --diff
```

Monorepo scope:
```bash
gh-scaffold apply --scope root
gh-scaffold apply --scope packages
gh-scaffold apply --scope all
```

Only/skip certain targets:
```bash
gh-scaffold apply --only SECURITY,CONTRIBUTING
gh-scaffold apply --skip FUNDING,CODEOWNERS
```

## Config file

Optional config locations:
- `gh-scaffold.yml`
- `.github/gh-scaffold.yml`

Example:
```yml
preset: strict
issueTemplates: forms
contacts:
  supportUrl: https://github.com/OWNER/REPO/discussions
  securityEmail: security@example.com
  cocContact: community@example.com
ownership:
  defaultOwners: ["@org/team"]
funding:
  github: orgname
  custom:
    - https://example.com/sponsor
```

## CI enforcement
This repo includes an example workflow that fails PRs if essential files are missing:
- `.github/workflows/check-community-health.yml`

## Notes
- Templates are intentionally generic; customize to your project.
- Prefer committing generated files and reviewing diffs in PRs.

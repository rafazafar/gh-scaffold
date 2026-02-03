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
- `LICENSE` (MIT/Apache/GPL)

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

Interactive (default): scan → choose missing files → preview/write
```bash
npx gh-scaffold
```

Non-interactive scan:
```bash
npx gh-scaffold --scan
# or machine-readable:
npx gh-scaffold --scan --json
```

Non-interactive write:
```bash
npx gh-scaffold -w
# preview:
npx gh-scaffold -w --dry-run --diff
```

Interactive init (writes a config file too):
```bash
npx gh-scaffold init
```

## Common usage

Preview what would change:
```bash
gh-scaffold -w --dry-run --diff
```

Overwrite existing:
```bash
gh-scaffold -w --force
```

Presets:
```bash
gh-scaffold -w --preset minimal
gh-scaffold -w --preset standard
gh-scaffold -w --preset strict
```

License selection:
```bash
gh-scaffold -w --preset strict --license mit
gh-scaffold -w --preset strict --license apache-2.0
gh-scaffold -w --preset strict --license gpl-3.0
```

Issue templates format:
```bash
gh-scaffold -w --issue-templates markdown
gh-scaffold -w --issue-templates forms
```

Update mode (Markdown-only managed markers; doesn’t touch non-markdown files):
```bash
gh-scaffold -w --update --diff
```

Monorepo scope:
```bash
gh-scaffold -w --scope root
gh-scaffold -w --scope packages
gh-scaffold -w --scope all
```

Only/skip certain targets:
```bash
gh-scaffold -w --only SECURITY,CONTRIBUTING
gh-scaffold -w --skip FUNDING,CODEOWNERS
```

## Config file

Optional config locations:
- `gh-scaffold.yml`
- `.github/gh-scaffold.yml`

Example:
```yml
preset: strict
issueTemplates: forms
license: mit
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

## Backward compatibility
- `gh-scaffold scan` still works (deprecated).
- `gh-scaffold apply` still works (deprecated).

## Notes
- Templates are intentionally generic; customize to your project.
- Prefer committing generated files and reviewing diffs in PRs.

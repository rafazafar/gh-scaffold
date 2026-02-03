# gh-scaffold

A CLI that **scans a repository** and generates missing GitHub “community health” files:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`
- `SUPPORT.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/*`
- `.github/FUNDING.yml`
- `.github/CODEOWNERS`

## Install

### npm (planned)
```bash
npm i -g gh-scaffold
```

### from source
```bash
git clone https://github.com/rafazafar/gh-scaffold
cd gh-scaffold
npm i
npm run build
```

## Usage

Scan current directory:
```bash
gh-scaffold scan
```

Interactive init:
```bash
gh-scaffold init
```

Apply missing files (no overwrites):
```bash
gh-scaffold apply
```

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
gh-scaffold apply --issue-templates forms
```

Update mode (managed markers):
```bash
gh-scaffold apply --update --diff
```

Monorepo scope:
```bash
gh-scaffold apply --scope packages
```

## Notes
- Defaults are generic; customize them to your project.
- This tool writes files into your repo; review changes before committing.

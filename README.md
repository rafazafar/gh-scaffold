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

Apply missing files (no overwrites):
```bash
gh-scaffold apply
```

Dry run:
```bash
gh-scaffold apply --dry-run
```

Overwrite existing:
```bash
gh-scaffold apply --force
```

Minimal set only:
```bash
gh-scaffold apply --minimal
```

## Notes
- Defaults are generic; customize them to your project.
- This tool writes files into your repo; review changes before committing.

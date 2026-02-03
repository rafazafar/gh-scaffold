import path from 'node:path';
import fs from 'fs-extra';
import { fileURLToPath } from 'node:url';
import { GhScaffoldConfig, IssueTemplateFormat } from './config.js';
import type { LicenseType } from './config.js';

export function builtinTemplatesDir(): string {
  return fileURLToPath(new URL('../templates/', import.meta.url));
}

export async function resolveTemplatesDir(repoPath: string, config: GhScaffoldConfig): Promise<string> {
  if (config.templatesDir) {
    const p = path.isAbsolute(config.templatesDir)
      ? config.templatesDir
      : path.resolve(repoPath, config.templatesDir);
    if (await fs.pathExists(p)) return p;
  }
  return builtinTemplatesDir();
}

export function licenseTemplateName(license: LicenseType): string | null {
  switch (license) {
    case 'mit':
      return 'LICENSE_MIT';
    case 'apache-2.0':
      return 'LICENSE_APACHE_2_0';
    case 'gpl-3.0':
      return 'LICENSE_GPL_3_0';
    default:
      return null;
  }
}

export function templateNameFor(key: string, issueFormat: IssueTemplateFormat): string | null {
  // map internal key -> template file name under templates/
  const mapMarkdown: Record<string, string> = {
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
    GOVERNANCE: 'GOVERNANCE.md',
    MAINTAINERS: 'MAINTAINERS.md',
    CHANGELOG: 'CHANGELOG.md',
    LICENSE: 'LICENSE_MIT',
  };

  const mapForms: Record<string, string> = {
    ...mapMarkdown,
    ISSUE_TEMPLATE_BUG: 'ISSUE_TEMPLATE/bug_report.yml',
    ISSUE_TEMPLATE_FEATURE: 'ISSUE_TEMPLATE/feature_request.yml',
  };

  const chosen = issueFormat === 'forms' ? mapForms : mapMarkdown;
  return chosen[key] ?? null;
}

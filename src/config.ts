import path from 'node:path';
import fs from 'fs-extra';
import YAML from 'yaml';

export type PresetName = 'minimal' | 'standard' | 'strict';

export type IssueTemplateFormat = 'markdown' | 'forms';

export type LicenseType = 'none' | 'mit' | 'apache-2.0' | 'gpl-3.0';

export type GhScaffoldConfig = {
  preset?: PresetName;
  issueTemplates?: IssueTemplateFormat;
  license?: LicenseType;
  contacts?: {
    supportUrl?: string;
    securityEmail?: string;
    cocContact?: string;
  };
  ownership?: {
    defaultOwners?: string[]; // e.g. ["@org/team", "@alice"]
    patterns?: Array<{ pattern: string; owners: string[] }>;
  };
  funding?: {
    github?: string | string[];
    ko_fi?: string;
    open_collective?: string;
    custom?: string[];
  };
  behavior?: {
    update?: boolean; // managed markers mode
    managedMarkers?: boolean;
  };
  templatesDir?: string; // overrides bundled templates
  scope?: {
    mode?: 'root' | 'packages' | 'all';
    packagesGlobs?: string[]; // e.g. ["packages/*", "apps/*"]
  };
};

export type LoadedConfig = {
  path: string | null;
  config: GhScaffoldConfig;
};

const DEFAULT_CONFIG: GhScaffoldConfig = {
  preset: 'standard',
  issueTemplates: 'markdown',
  license: 'none',
  behavior: { update: false, managedMarkers: true },
  scope: { mode: 'root', packagesGlobs: ['packages/*', 'apps/*'] },
};

export function mergeConfig(base: GhScaffoldConfig, overlay: GhScaffoldConfig): GhScaffoldConfig {
  // simple deep-ish merge for our shape
  return {
    ...base,
    ...overlay,
    contacts: { ...base.contacts, ...overlay.contacts },
    ownership: { ...base.ownership, ...overlay.ownership },
    funding: { ...base.funding, ...overlay.funding },
    behavior: { ...base.behavior, ...overlay.behavior },
    scope: { ...base.scope, ...overlay.scope },
  };
}

export async function loadConfig(repoPath: string, explicitPath?: string): Promise<LoadedConfig> {
  const candidates = explicitPath
    ? [path.resolve(repoPath, explicitPath)]
    : [
        path.resolve(repoPath, 'gh-scaffold.yml'),
        path.resolve(repoPath, 'gh-scaffold.yaml'),
        path.resolve(repoPath, '.github/gh-scaffold.yml'),
        path.resolve(repoPath, '.github/gh-scaffold.yaml'),
      ];

  for (const p of candidates) {
    if (await fs.pathExists(p)) {
      const raw = await fs.readFile(p, 'utf8');
      const parsed = YAML.parse(raw) as GhScaffoldConfig;
      return { path: p, config: mergeConfig(DEFAULT_CONFIG, parsed ?? {}) };
    }
  }

  return { path: null, config: DEFAULT_CONFIG };
}

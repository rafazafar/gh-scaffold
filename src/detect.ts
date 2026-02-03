import path from 'node:path';
import fs from 'fs-extra';

export type RepoMeta = {
  name?: string;
  description?: string;
  ownerRepo?: string; // owner/repo
  defaultBranch?: string;
  isMonorepo?: boolean;
  workspaceGlobs?: string[];
};

async function tryReadJson(p: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function detectRepoMeta(repoPath: string): Promise<RepoMeta> {
  const meta: RepoMeta = {};

  const pkg = await tryReadJson(path.resolve(repoPath, 'package.json'));
  if (pkg) {
    meta.name = pkg.name;
    meta.description = pkg.description;
    if (pkg.workspaces) {
      meta.isMonorepo = true;
      meta.workspaceGlobs = Array.isArray(pkg.workspaces)
        ? pkg.workspaces
        : Array.isArray(pkg.workspaces.packages)
          ? pkg.workspaces.packages
          : undefined;
    }
  }

  // best-effort parse origin url
  try {
    const gitConfig = await fs.readFile(path.resolve(repoPath, '.git/config'), 'utf8');
    const m = gitConfig.match(/\[remote \"origin\"\][\s\S]*?url\s*=\s*(.+)/);
    const url = m?.[1]?.trim();
    if (url) {
      // supports https://github.com/owner/repo(.git) and git@github.com:owner/repo(.git)
      const cleaned = url.replace(/\.git$/, '');
      const https = cleaned.match(/github\.com\/(.+?)\/(.+)$/);
      const ssh = cleaned.match(/github\.com:(.+?)\/(.+)$/);
      const owner = https?.[1] ?? ssh?.[1];
      const repo = https?.[2] ?? ssh?.[2];
      if (owner && repo) meta.ownerRepo = `${owner}/${repo}`;
    }
  } catch {
    // ignore
  }

  return meta;
}

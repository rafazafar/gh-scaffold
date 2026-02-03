import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

export async function makeTempDir(prefix = 'gh-scaffold-'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  return dir;
}

export async function writeRepoFile(repoPath: string, rel: string, content: string) {
  const abs = path.resolve(repoPath, rel);
  await fs.ensureDir(path.dirname(abs));
  await fs.writeFile(abs, content, 'utf8');
}

export async function readRepoFile(repoPath: string, rel: string) {
  return fs.readFile(path.resolve(repoPath, rel), 'utf8');
}

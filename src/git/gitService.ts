import { execSync } from 'child_process';
import * as path from 'path';

export interface GitInfo {
  hasGit: boolean;
  commit: string | null;
  branch: string | null;
}

function exec(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

export function getGitInfo(filePath: string): GitInfo {
  const dir = path.dirname(filePath);
  try {
    exec('git rev-parse --git-dir', dir);
  } catch {
    return { hasGit: false, commit: null, branch: null };
  }

  let commit: string | null = null;
  let branch: string | null = null;

  try {
    commit = exec('git rev-parse HEAD', dir);
  } catch {
    commit = null;
  }

  try {
    branch = exec('git rev-parse --abbrev-ref HEAD', dir);
  } catch {
    branch = null;
  }

  return { hasGit: true, commit, branch };
}

export function getProjectRoot(filePath: string): string | null {
  const dir = path.dirname(filePath);
  try {
    return exec('git rev-parse --show-toplevel', dir);
  } catch {
    return null;
  }
}

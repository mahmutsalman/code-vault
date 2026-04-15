export interface RelatedClass {
  id: string;
  fileSnapshot: string;   // full file content at time of adding
  language: string;
  filePath: string;
  fileName: string;
  gitCommit: string | null;
  gitBranch: string | null;
  addedAt: string;
}

export interface Snippet {
  id: string;
  title: string;
  code: string;           // only the selected lines
  fileSnapshot: string;   // full file content at save time
  language: string;
  filePath: string;
  fileName: string;
  startLine: number;      // 0-indexed
  endLine: number;        // 0-indexed, inclusive
  projectName: string;
  projectPath: string;
  gitCommit: string | null;
  gitBranch: string | null;
  hasGit: boolean;
  tags: string[];
  relatedClasses: RelatedClass[];
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  snippets: Snippet[];
  version: number;
}

export interface PendingSnippetData {
  code: string;
  fileSnapshot: string;
  language: string;
  filePath: string;
  fileName: string;
  startLine: number;
  endLine: number;
  projectName: string;
  projectPath: string;
  gitCommit: string | null;
  gitBranch: string | null;
  hasGit: boolean;
  suggestedTitle: string;
}

export interface PendingRelatedClassData {
  fileSnapshot: string;
  language: string;
  filePath: string;
  fileName: string;
  gitCommit: string | null;
  gitBranch: string | null;
}

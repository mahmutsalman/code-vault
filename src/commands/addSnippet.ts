import * as vscode from 'vscode';
import * as path from 'path';
import { VaultViewProvider } from '../providers/vaultViewProvider';
import { getGitInfo, getProjectRoot } from '../git/gitService';
import { PendingSnippetData } from '../types';

export function registerAddSnippetCommand(
  context: vscode.ExtensionContext,
  provider: VaultViewProvider
): void {
  const cmd = vscode.commands.registerCommand('codeVault.addSnippet', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Code Vault: No active editor.');
      return;
    }
    if (editor.selection.isEmpty) {
      vscode.window.showWarningMessage('Code Vault: Please select some code first.');
      return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const filePath = document.fileName;
    const fileName = path.basename(filePath);
    const language = document.languageId;

    const startLine = selection.start.line;
    const endLine = selection.end.line;
    const selectedCode = document.getText(selection);
    const fileSnapshot = document.getText();

    const gitInfo = getGitInfo(filePath);
    const projectRoot = gitInfo.hasGit ? getProjectRoot(filePath) : null;
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectPath = projectRoot
      ?? workspaceFolders?.[0]?.uri.fsPath
      ?? path.dirname(filePath);
    const projectName = path.basename(projectPath);

    // Suggest title from first non-empty line of selection
    const firstLine = selectedCode.split('\n').find(l => l.trim()) ?? selectedCode.slice(0, 60);
    const suggestedTitle = firstLine.trim().slice(0, 80);

    const data: PendingSnippetData = {
      code: selectedCode,
      fileSnapshot,
      language,
      filePath,
      fileName,
      startLine,
      endLine,
      projectName,
      projectPath,
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch,
      hasGit: gitInfo.hasGit,
      suggestedTitle
    };

    provider.showAddSnippetForm(data);
  });

  context.subscriptions.push(cmd);
}

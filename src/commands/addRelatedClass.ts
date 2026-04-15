import * as vscode from 'vscode';
import * as path from 'path';
import { VaultViewProvider } from '../providers/vaultViewProvider';
import { getGitInfo } from '../git/gitService';
import { PendingRelatedClassData } from '../types';

export function registerAddRelatedClassCommand(
  context: vscode.ExtensionContext,
  provider: VaultViewProvider
): void {
  const cmd = vscode.commands.registerCommand('codeVault.addRelatedClass', () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Code Vault: No active editor.');
      return;
    }

    const document = editor.document;
    const filePath = document.fileName;
    const fileName = path.basename(filePath);
    const language = document.languageId;
    const fileSnapshot = document.getText();

    const gitInfo = getGitInfo(filePath);

    const data: PendingRelatedClassData = {
      fileSnapshot,
      language,
      filePath,
      fileName,
      gitCommit: gitInfo.commit,
      gitBranch: gitInfo.branch
    };

    provider.showLinkRelatedClassForm(data);
  });

  context.subscriptions.push(cmd);
}

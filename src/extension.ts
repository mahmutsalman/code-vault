import * as vscode from 'vscode';
import { SnippetStore } from './storage/store';
import { SnippetContentProvider } from './providers/snippetContentProvider';
import { VaultViewProvider } from './providers/vaultViewProvider';
import { registerAddSnippetCommand } from './commands/addSnippet';
import { registerAddRelatedClassCommand } from './commands/addRelatedClass';

export function activate(context: vscode.ExtensionContext): void {
  const store = new SnippetStore(context);
  const contentProvider = new SnippetContentProvider();
  const vaultProvider = new VaultViewProvider(store, contentProvider, context.extensionUri);

  // Register virtual document providers
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      SnippetContentProvider.scheme,
      contentProvider
    ),
    vscode.workspace.registerTextDocumentContentProvider(
      SnippetContentProvider.relatedScheme,
      contentProvider
    )
  );

  // Register webview panel
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(VaultViewProvider.viewId, vaultProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );

  // Register commands
  registerAddSnippetCommand(context, vaultProvider);
  registerAddRelatedClassCommand(context, vaultProvider);
}

export function deactivate(): void {}

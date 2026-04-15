import * as vscode from 'vscode';

interface ContentEntry {
  content: string;
  startLine: number;
  endLine: number;
}

export class SnippetContentProvider implements vscode.TextDocumentContentProvider {
  static readonly scheme = 'codevault-snippet';
  static readonly relatedScheme = 'codevault-related';

  private snippetContents = new Map<string, ContentEntry>();
  private relatedContents = new Map<string, string>();

  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  registerSnippet(id: string, content: string, startLine: number, endLine: number): void {
    this.snippetContents.set(id, { content, startLine, endLine });
  }

  registerRelated(key: string, content: string): void {
    this.relatedContents.set(key, content);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    if (uri.scheme === SnippetContentProvider.scheme) {
      const id = uri.authority;
      return this.snippetContents.get(id)?.content ?? '// Content not available';
    }
    if (uri.scheme === SnippetContentProvider.relatedScheme) {
      const key = uri.authority;
      return this.relatedContents.get(key) ?? '// Content not available';
    }
    return '';
  }

  getSnippetEntry(id: string): ContentEntry | undefined {
    return this.snippetContents.get(id);
  }

  static snippetUri(snippetId: string, fileName: string): vscode.Uri {
    const ext = fileName.split('.').pop() ?? 'txt';
    return vscode.Uri.parse(`${SnippetContentProvider.scheme}://${snippetId}/snapshot.${ext}`);
  }

  static relatedUri(snippetId: string, relatedId: string, fileName: string): vscode.Uri {
    const ext = fileName.split('.').pop() ?? 'txt';
    const key = `${snippetId}-${relatedId}`;
    return vscode.Uri.parse(`${SnippetContentProvider.relatedScheme}://${key}/snapshot.${ext}`);
  }
}

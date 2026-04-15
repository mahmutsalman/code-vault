import * as vscode from 'vscode';
import { SnippetStore } from '../storage/store';
import { Snippet, PendingSnippetData, PendingRelatedClassData } from '../types';
import { SnippetContentProvider } from './snippetContentProvider';
import { randomUUID } from 'crypto';

export class VaultViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'codeVault.mainView';

  private view?: vscode.WebviewView;
  private pendingSnippet: PendingSnippetData | null = null;
  private pendingRelatedClass: PendingRelatedClassData | null = null;

  constructor(
    private readonly store: SnippetStore,
    private readonly contentProvider: SnippetContentProvider,
    private readonly extensionUri: vscode.Uri
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this.buildHtml();
    webviewView.webview.onDidReceiveMessage(msg => this.handleMessage(msg));
  }

  showAddSnippetForm(data: PendingSnippetData): void {
    this.pendingSnippet = data;
    this.focusView();
    this.view?.webview.postMessage({ type: 'showAddForm', data });
  }

  showLinkRelatedClassForm(data: PendingRelatedClassData): void {
    this.pendingRelatedClass = data;
    this.focusView();
    const snippets = this.store.getAllSnippets();
    this.view?.webview.postMessage({ type: 'showLinkForm', data, snippets });
  }

  private focusView(): void {
    vscode.commands.executeCommand('codeVault.mainView.focus');
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'ready':
        this.sendAllSnippets();
        break;
      case 'search':
        this.handleSearch(msg.query as string, msg.tags as string[]);
        break;
      case 'saveSnippet':
        this.handleSaveSnippet(msg.title as string, msg.tags as string[]);
        break;
      case 'cancelAdd':
        this.pendingSnippet = null;
        break;
      case 'linkRelatedClass':
        this.handleLinkRelatedClass(msg.snippetId as string);
        break;
      case 'cancelLink':
        this.pendingRelatedClass = null;
        break;
      case 'openSnippet':
        this.handleOpenSnippet(msg.id as string);
        break;
      case 'openRelatedClass':
        this.handleOpenRelatedClass(msg.snippetId as string, msg.relatedId as string);
        break;
      case 'addTag':
        this.handleAddTag(msg.snippetId as string, msg.tag as string);
        break;
      case 'removeTag':
        this.handleRemoveTag(msg.snippetId as string, msg.tag as string);
        break;
      case 'updateTitle':
        this.handleUpdateTitle(msg.snippetId as string, msg.title as string);
        break;
      case 'deleteSnippet':
        this.handleDeleteSnippet(msg.id as string);
        break;
    }
  }

  private sendAllSnippets(): void {
    const snippets = this.store.getAllSnippets();
    this.view?.webview.postMessage({ type: 'allSnippets', snippets });
  }

  private handleSearch(query: string, tags: string[]): void {
    const snippets = this.store.search(query, tags);
    this.view?.webview.postMessage({ type: 'searchResults', snippets });
  }

  private handleSaveSnippet(title: string, tags: string[]): void {
    if (!this.pendingSnippet) { return; }
    const now = new Date().toISOString();
    const snippet: Snippet = {
      id: randomUUID(),
      title: title || this.pendingSnippet.suggestedTitle,
      code: this.pendingSnippet.code,
      fileSnapshot: this.pendingSnippet.fileSnapshot,
      language: this.pendingSnippet.language,
      filePath: this.pendingSnippet.filePath,
      fileName: this.pendingSnippet.fileName,
      startLine: this.pendingSnippet.startLine,
      endLine: this.pendingSnippet.endLine,
      projectName: this.pendingSnippet.projectName,
      projectPath: this.pendingSnippet.projectPath,
      gitCommit: this.pendingSnippet.gitCommit,
      gitBranch: this.pendingSnippet.gitBranch,
      hasGit: this.pendingSnippet.hasGit,
      tags,
      relatedClasses: [],
      createdAt: now,
      updatedAt: now
    };
    this.store.addSnippet(snippet);
    this.pendingSnippet = null;
    this.view?.webview.postMessage({ type: 'snippetSaved', snippet });
    vscode.window.showInformationMessage(`Code Vault: "${snippet.title}" saved.`);
  }

  private handleLinkRelatedClass(snippetId: string): void {
    if (!this.pendingRelatedClass) { return; }
    const related = {
      id: randomUUID(),
      fileSnapshot: this.pendingRelatedClass.fileSnapshot,
      language: this.pendingRelatedClass.language,
      filePath: this.pendingRelatedClass.filePath,
      fileName: this.pendingRelatedClass.fileName,
      gitCommit: this.pendingRelatedClass.gitCommit,
      gitBranch: this.pendingRelatedClass.gitBranch,
      addedAt: new Date().toISOString()
    };
    const updated = this.store.addRelatedClass(snippetId, related);
    this.pendingRelatedClass = null;
    if (updated) {
      this.view?.webview.postMessage({ type: 'snippetUpdated', snippet: updated });
      vscode.window.showInformationMessage(
        `Code Vault: "${related.fileName}" linked to "${updated.title}".`
      );
    }
  }

  private handleOpenSnippet(id: string): void {
    const snippet = this.store.getSnippet(id);
    if (!snippet) { return; }

    this.contentProvider.registerSnippet(
      id,
      snippet.fileSnapshot,
      snippet.startLine,
      snippet.endLine
    );

    const uri = SnippetContentProvider.snippetUri(id, snippet.fileName);
    vscode.workspace.openTextDocument(uri).then(doc => {
      vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false
      }).then(editor => {
        const start = new vscode.Position(snippet.startLine, 0);
        const endLineText = doc.lineAt(Math.min(snippet.endLine, doc.lineCount - 1)).text;
        const end = new vscode.Position(snippet.endLine, endLineText.length);
        editor.selection = new vscode.Selection(start, end);
        editor.revealRange(
          new vscode.Range(start, end),
          vscode.TextEditorRevealType.InCenter
        );
      });
    });
  }

  private handleOpenRelatedClass(snippetId: string, relatedId: string): void {
    const snippet = this.store.getSnippet(snippetId);
    if (!snippet) { return; }
    const related = snippet.relatedClasses.find(r => r.id === relatedId);
    if (!related) { return; }

    const key = `${snippetId}-${relatedId}`;
    this.contentProvider.registerRelated(key, related.fileSnapshot);

    const uri = SnippetContentProvider.relatedUri(snippetId, relatedId, related.fileName);
    vscode.workspace.openTextDocument(uri).then(doc => {
      vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false
      });
    });
  }

  private handleAddTag(snippetId: string, tag: string): void {
    const trimmed = tag.trim().toLowerCase().replace(/\s+/g, '-');
    if (!trimmed) { return; }
    const updated = this.store.addTag(snippetId, trimmed);
    if (updated) {
      this.view?.webview.postMessage({ type: 'snippetUpdated', snippet: updated });
    }
  }

  private handleRemoveTag(snippetId: string, tag: string): void {
    const updated = this.store.removeTag(snippetId, tag);
    if (updated) {
      this.view?.webview.postMessage({ type: 'snippetUpdated', snippet: updated });
    }
  }

  private handleUpdateTitle(snippetId: string, title: string): void {
    if (!title.trim()) { return; }
    const updated = this.store.updateTitle(snippetId, title.trim());
    if (updated) {
      this.view?.webview.postMessage({ type: 'snippetUpdated', snippet: updated });
    }
  }

  private handleDeleteSnippet(id: string): void {
    const snippet = this.store.getSnippet(id);
    if (!snippet) { return; }
    vscode.window.showWarningMessage(
      `Delete "${snippet.title}"?`,
      { modal: true },
      'Delete'
    ).then(choice => {
      if (choice === 'Delete') {
        this.store.deleteSnippet(id);
        this.view?.webview.postMessage({ type: 'snippetDeleted', id });
      }
    });
  }

  private buildHtml(): string {
    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .search-bar {
    padding: 8px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, #333);
    background: var(--vscode-sideBar-background);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .search-input {
    width: 100%;
    padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    outline: none;
    font-size: 13px;
  }
  .search-input:focus {
    border-color: var(--vscode-focusBorder);
  }
  .tag-filters {
    padding: 4px 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 0;
  }
  .tag-filters:empty { display: none; }
  .filter-tag {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: default;
  }
  .filter-tag .remove { cursor: pointer; opacity: 0.7; }
  .filter-tag .remove:hover { opacity: 1; }
  .snippets-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }
  .empty-state {
    padding: 32px 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-size: 12px;
    line-height: 1.6;
  }
  .snippet-card {
    padding: 8px 10px;
    border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border, #2d2d2d);
    cursor: pointer;
    transition: background 0.1s;
  }
  .snippet-card:hover { background: var(--vscode-list-hoverBackground); }
  .card-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }
  .snippet-title {
    font-size: 12px;
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lang-badge {
    font-size: 10px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 5px;
    border-radius: 2px;
    flex-shrink: 0;
    opacity: 0.8;
  }
  .card-meta {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .git-ref {
    font-family: monospace;
    font-size: 10px;
    opacity: 0.7;
  }
  .no-git-warning {
    font-size: 10px;
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    align-items: center;
  }
  .tag {
    font-size: 10px;
    background: var(--vscode-textBlockQuote-background, #2d2d2d);
    color: var(--vscode-textLink-foreground);
    padding: 1px 5px;
    border-radius: 2px;
    cursor: pointer;
  }
  .tag:hover { opacity: 0.8; }
  .tag-remove {
    font-size: 10px;
    background: var(--vscode-textBlockQuote-background, #2d2d2d);
    color: var(--vscode-textLink-foreground);
    padding: 1px 5px;
    border-radius: 2px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .tag-remove .x {
    opacity: 0.6;
    cursor: pointer;
    font-size: 9px;
  }
  .tag-remove .x:hover { opacity: 1; color: #f44; }
  .add-tag-inline {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 1px 4px;
    border-radius: 2px;
    border: 1px dashed var(--vscode-input-border, #444);
  }
  .add-tag-inline:hover { border-color: var(--vscode-focusBorder); }
  .related-classes {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .related-chip {
    font-size: 10px;
    background: var(--vscode-textBlockQuote-background, #2d2d2d);
    color: var(--vscode-descriptionForeground);
    padding: 1px 5px;
    border-radius: 2px;
    cursor: pointer;
    border: 1px solid var(--vscode-input-border, #444);
  }
  .related-chip:hover { color: var(--vscode-textLink-foreground); }
  .card-actions {
    display: none;
    margin-top: 5px;
    gap: 6px;
  }
  .snippet-card:hover .card-actions { display: flex; }
  .action-btn {
    font-size: 10px;
    background: transparent;
    border: 1px solid var(--vscode-input-border, #444);
    color: var(--vscode-descriptionForeground);
    padding: 2px 7px;
    border-radius: 2px;
    cursor: pointer;
  }
  .action-btn:hover { color: var(--vscode-foreground); border-color: var(--vscode-focusBorder); }
  .action-btn.danger:hover { color: #f44747; border-color: #f44747; }

  /* MODAL OVERLAY */
  .modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 100;
    overflow-y: auto;
  }
  .modal-overlay.active { display: block; }
  .modal {
    margin: 16px;
    background: var(--vscode-editor-background);
    border: 1px solid var(--vscode-input-border, #444);
    border-radius: 4px;
    padding: 16px;
  }
  .modal h2 {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 14px;
    color: var(--vscode-foreground);
  }
  .form-group { margin-bottom: 12px; }
  .form-group label {
    display: block;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .form-input {
    width: 100%;
    padding: 5px 8px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    font-size: 12px;
    outline: none;
  }
  .form-input:focus { border-color: var(--vscode-focusBorder); }
  .tag-input-row {
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
  }
  .tag-input-row .form-input { flex: 1; }
  .tags-area {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    min-height: 24px;
  }
  .form-tag {
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .form-tag .rm {
    cursor: pointer;
    opacity: 0.7;
    font-size: 10px;
  }
  .form-tag .rm:hover { opacity: 1; }
  .code-preview {
    background: var(--vscode-textBlockQuote-background, #1e1e1e);
    border: 1px solid var(--vscode-input-border, #444);
    border-radius: 3px;
    padding: 8px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    overflow: auto;
    max-height: 120px;
    white-space: pre;
    color: var(--vscode-editor-foreground);
  }
  .git-info-box {
    background: var(--vscode-textBlockQuote-background, #1e1e1e);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    font-family: monospace;
  }
  .no-git-box {
    background: var(--vscode-inputValidation-warningBackground, #3e2c00);
    border: 1px solid var(--vscode-editorWarning-foreground, #cca700);
    border-radius: 3px;
    padding: 6px 8px;
    font-size: 11px;
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .btn-row {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }
  .btn {
    padding: 5px 14px;
    border-radius: 3px;
    font-size: 12px;
    cursor: pointer;
    border: none;
  }
  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground, #3d3d3d);
    color: var(--vscode-button-secondaryForeground, #ccc);
  }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, #4d4d4d); }
  .link-snippet-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    margin-bottom: 4px;
  }
  .link-snippet-item:hover { border-color: var(--vscode-input-border, #444); }
  .link-snippet-item.selected {
    border-color: var(--vscode-focusBorder);
    background: var(--vscode-list-activeSelectionBackground);
  }
  .link-snippet-item input[type=radio] { accent-color: var(--vscode-focusBorder); }
  .link-item-info { flex: 1; }
  .link-item-title { font-size: 12px; font-weight: 600; }
  .link-item-meta { font-size: 11px; color: var(--vscode-descriptionForeground); }
  .inline-tag-input {
    display: none;
    position: absolute;
    z-index: 50;
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 3px;
    padding: 4px 6px;
    font-size: 11px;
    color: var(--vscode-input-foreground);
    width: 120px;
    outline: none;
  }
  .title-edit {
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 2px;
    font-size: 12px;
    font-weight: 600;
    width: 100%;
    padding: 2px 4px;
    outline: none;
    display: none;
  }
</style>
</head>
<body>
<div class="search-bar">
  <input class="search-input" id="searchInput" type="text" placeholder="Search snippets or paste #tag..." autocomplete="off" />
</div>
<div class="tag-filters" id="tagFilters"></div>
<div class="snippets-list" id="snippetsList"></div>

<!-- ADD SNIPPET MODAL -->
<div class="modal-overlay" id="addOverlay">
  <div class="modal">
    <h2>Save Snippet</h2>
    <div class="form-group">
      <label>Title</label>
      <input class="form-input" id="addTitle" type="text" placeholder="Snippet title..." />
    </div>
    <div class="form-group">
      <label>Tags</label>
      <div class="tag-input-row">
        <input class="form-input" id="addTagInput" type="text" placeholder="Type tag, press Enter..." />
      </div>
      <div class="tags-area" id="addTagsArea"></div>
    </div>
    <div class="form-group">
      <label>Code Preview</label>
      <pre class="code-preview" id="addCodePreview"></pre>
    </div>
    <div class="form-group" id="addGitInfo"></div>
    <div class="btn-row">
      <button class="btn btn-primary" id="saveSnippetBtn">Save Snippet</button>
      <button class="btn btn-secondary" id="cancelAddBtn">Cancel</button>
    </div>
  </div>
</div>

<!-- LINK RELATED CLASS MODAL -->
<div class="modal-overlay" id="linkOverlay">
  <div class="modal">
    <h2>Link Related Class</h2>
    <div class="form-group">
      <label>File to link</label>
      <div class="git-info-box" id="linkFileInfo"></div>
    </div>
    <div class="form-group">
      <label>Link to snippet</label>
      <div id="linkSnippetsList"></div>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" id="confirmLinkBtn">Link</button>
      <button class="btn btn-secondary" id="cancelLinkBtn">Cancel</button>
    </div>
  </div>
</div>

<input class="inline-tag-input" id="inlineTagInput" type="text" placeholder="tag name..." />

<script>
  const vscode = acquireVsCodeApi();
  let allSnippets = [];
  let activeFilters = [];
  let addPendingTags = [];
  let selectedLinkSnippetId = null;

  // ──────────────────────────────────────────
  // SEARCH
  // ──────────────────────────────────────────
  const searchInput = document.getElementById('searchInput');
  let searchTimer = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const val = searchInput.value;
    if (val.startsWith('#')) {
      const tag = val.slice(1).trim();
      if (tag && tag.endsWith(' ')) {
        addFilter(tag.trim());
        searchInput.value = '';
      }
      return;
    }
    searchTimer = setTimeout(() => doSearch(), 200);
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = searchInput.value;
      if (val.startsWith('#')) {
        const tag = val.slice(1).trim();
        if (tag) { addFilter(tag); searchInput.value = ''; }
      } else {
        doSearch();
      }
    }
  });

  function addFilter(tag) {
    if (!activeFilters.includes(tag)) {
      activeFilters.push(tag);
      renderFilters();
      doSearch();
    }
  }

  function removeFilter(tag) {
    activeFilters = activeFilters.filter(t => t !== tag);
    renderFilters();
    doSearch();
  }

  function renderFilters() {
    const el = document.getElementById('tagFilters');
    el.innerHTML = activeFilters.map(t =>
      '<span class="filter-tag">#' + esc(t) + '<span class="remove" data-tag="' + esc(t) + '">✕</span></span>'
    ).join('');
    el.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', () => removeFilter(btn.dataset.tag));
    });
  }

  function doSearch() {
    const query = searchInput.value.trim();
    if (!query && activeFilters.length === 0) {
      renderSnippets(allSnippets);
      return;
    }
    vscode.postMessage({ type: 'search', query, tags: activeFilters });
  }

  // ──────────────────────────────────────────
  // RENDER SNIPPETS
  // ──────────────────────────────────────────
  function renderSnippets(snippets) {
    const list = document.getElementById('snippetsList');
    if (snippets.length === 0) {
      list.innerHTML = '<div class="empty-state">No snippets yet.<br><br>Select code in your editor,<br>right-click → <b>Code Vault: Add Selection as Snippet</b></div>';
      return;
    }
    list.innerHTML = snippets.map(s => renderCard(s)).join('');
    attachCardListeners();
  }

  function renderCard(s) {
    const tags = s.tags.map(t =>
      '<span class="tag-remove"><span class="tag-text" data-filter="' + esc(t) + '">#' + esc(t) + '</span><span class="x" data-snippet="' + s.id + '" data-tag="' + esc(t) + '">✕</span></span>'
    ).join('');
    const related = s.relatedClasses.map(r =>
      '<span class="related-chip" data-snippet="' + s.id + '" data-related="' + r.id + '">' + esc(r.fileName) + '</span>'
    ).join('');
    const gitMeta = s.hasGit
      ? '<span class="git-ref">' + esc(s.gitBranch || '') + (s.gitCommit ? ' @' + s.gitCommit.slice(0,7) : '') + '</span>'
      : '<span class="no-git-warning">⚠ no git</span>';

    return '<div class="snippet-card" data-id="' + s.id + '">' +
      '<div class="card-header">' +
        '<span class="snippet-title" title="' + esc(s.title) + '" data-snippet-title="' + s.id + '">' + esc(s.title) + '</span>' +
        '<span class="lang-badge">' + esc(s.language) + '</span>' +
      '</div>' +
      '<div class="card-meta">' +
        '<span>' + esc(s.projectName) + '</span>' +
        gitMeta +
      '</div>' +
      '<div class="card-tags">' +
        tags +
        '<span class="add-tag-inline" data-snippet="' + s.id + '">+ tag</span>' +
      '</div>' +
      (s.relatedClasses.length > 0 ? '<div class="related-classes">' + related + '</div>' : '') +
      '<div class="card-actions">' +
        '<button class="action-btn" data-open="' + s.id + '">Open</button>' +
        '<button class="action-btn danger" data-delete="' + s.id + '">Delete</button>' +
      '</div>' +
    '</div>';
  }

  function attachCardListeners() {
    document.querySelectorAll('.snippet-card').forEach(card => {
      card.addEventListener('click', e => {
        const target = e.target;
        const snippetId = card.dataset.id;

        if (target.dataset.open) {
          vscode.postMessage({ type: 'openSnippet', id: target.dataset.open });
          return;
        }
        if (target.dataset.delete) {
          vscode.postMessage({ type: 'deleteSnippet', id: target.dataset.delete });
          return;
        }
        if (target.classList.contains('x') && target.dataset.snippet) {
          e.stopPropagation();
          vscode.postMessage({ type: 'removeTag', snippetId: target.dataset.snippet, tag: target.dataset.tag });
          return;
        }
        if (target.dataset.filter) {
          addFilter(target.dataset.filter);
          return;
        }
        if (target.classList.contains('add-tag-inline')) {
          e.stopPropagation();
          showInlineTagInput(target, snippetId);
          return;
        }
        if (target.classList.contains('related-chip')) {
          e.stopPropagation();
          vscode.postMessage({ type: 'openRelatedClass', snippetId: target.dataset.snippet, relatedId: target.dataset.related });
          return;
        }
        if (target.dataset.snippetTitle) {
          e.stopPropagation();
          startTitleEdit(target, snippetId);
          return;
        }
        // default: open snippet
        vscode.postMessage({ type: 'openSnippet', id: snippetId });
      });
    });
  }

  // ──────────────────────────────────────────
  // INLINE TAG INPUT
  // ──────────────────────────────────────────
  const inlineTagInput = document.getElementById('inlineTagInput');
  let inlineTagSnippetId = null;

  function showInlineTagInput(anchor, snippetId) {
    inlineTagSnippetId = snippetId;
    const rect = anchor.getBoundingClientRect();
    inlineTagInput.style.display = 'block';
    inlineTagInput.style.top = (rect.bottom + window.scrollY + 2) + 'px';
    inlineTagInput.style.left = rect.left + 'px';
    inlineTagInput.value = '';
    inlineTagInput.focus();
  }

  inlineTagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && inlineTagSnippetId) {
      const tag = inlineTagInput.value.trim().toLowerCase().replace(/\\s+/g, '-');
      if (tag) {
        vscode.postMessage({ type: 'addTag', snippetId: inlineTagSnippetId, tag });
      }
      hideInlineTagInput();
    }
    if (e.key === 'Escape') { hideInlineTagInput(); }
  });

  document.addEventListener('click', e => {
    if (e.target !== inlineTagInput) { hideInlineTagInput(); }
  });

  function hideInlineTagInput() {
    inlineTagInput.style.display = 'none';
    inlineTagSnippetId = null;
  }

  // ──────────────────────────────────────────
  // INLINE TITLE EDIT
  // ──────────────────────────────────────────
  function startTitleEdit(titleEl, snippetId) {
    const input = document.createElement('input');
    input.className = 'title-edit';
    input.style.display = 'block';
    input.value = titleEl.textContent;
    titleEl.replaceWith(input);
    input.focus();
    input.select();
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        vscode.postMessage({ type: 'updateTitle', snippetId, title: input.value });
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        vscode.postMessage({ type: 'ready' });
      }
    });
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        vscode.postMessage({ type: 'updateTitle', snippetId, title: input.value });
      }
    });
  }

  // ──────────────────────────────────────────
  // ADD SNIPPET FORM
  // ──────────────────────────────────────────
  document.getElementById('addTagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const tag = e.target.value.trim().toLowerCase().replace(/\\s+/g, '-');
      if (tag && !addPendingTags.includes(tag)) {
        addPendingTags.push(tag);
        renderAddTags();
        e.target.value = '';
      }
    }
  });

  document.getElementById('saveSnippetBtn').addEventListener('click', () => {
    const title = document.getElementById('addTitle').value.trim();
    vscode.postMessage({ type: 'saveSnippet', title, tags: addPendingTags });
    closeAddModal();
  });

  document.getElementById('cancelAddBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'cancelAdd' });
    closeAddModal();
  });

  function openAddModal(data) {
    addPendingTags = [];
    document.getElementById('addTitle').value = data.suggestedTitle || '';
    document.getElementById('addCodePreview').textContent = data.code;
    renderAddTags();

    const gitEl = document.getElementById('addGitInfo');
    if (data.hasGit) {
      gitEl.innerHTML = '<div class="git-info-box">Branch: <b>' + esc(data.gitBranch || '?') + '</b>  Commit: <b>' + esc((data.gitCommit || '').slice(0,7)) + '</b></div>';
    } else {
      gitEl.innerHTML = '<div class="no-git-box">⚠ This file is not in a git repository. The snapshot is saved but may become stale if the file changes.</div>';
    }

    document.getElementById('addOverlay').classList.add('active');
    document.getElementById('addTitle').focus();
    document.getElementById('addTitle').select();
  }

  function closeAddModal() {
    document.getElementById('addOverlay').classList.remove('active');
    addPendingTags = [];
  }

  function renderAddTags() {
    const area = document.getElementById('addTagsArea');
    area.innerHTML = addPendingTags.map(t =>
      '<span class="form-tag">#' + esc(t) + '<span class="rm" data-tag="' + esc(t) + '">✕</span></span>'
    ).join('');
    area.querySelectorAll('.rm').forEach(btn => {
      btn.addEventListener('click', () => {
        addPendingTags = addPendingTags.filter(t => t !== btn.dataset.tag);
        renderAddTags();
      });
    });
  }

  // ──────────────────────────────────────────
  // LINK RELATED CLASS FORM
  // ──────────────────────────────────────────
  document.getElementById('confirmLinkBtn').addEventListener('click', () => {
    if (!selectedLinkSnippetId) {
      return;
    }
    vscode.postMessage({ type: 'linkRelatedClass', snippetId: selectedLinkSnippetId });
    closeLinkModal();
  });

  document.getElementById('cancelLinkBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'cancelLink' });
    closeLinkModal();
  });

  function openLinkModal(data, snippets) {
    selectedLinkSnippetId = null;
    document.getElementById('linkFileInfo').textContent = data.fileName + (data.gitBranch ? ' (' + data.gitBranch + ')' : '');

    const list = document.getElementById('linkSnippetsList');
    if (snippets.length === 0) {
      list.innerHTML = '<div style="font-size:12px;color:var(--vscode-descriptionForeground)">No snippets saved yet. Save a snippet first.</div>';
    } else {
      list.innerHTML = snippets.map(s =>
        '<div class="link-snippet-item" data-id="' + s.id + '">' +
          '<input type="radio" name="linkTarget" value="' + s.id + '" />' +
          '<div class="link-item-info">' +
            '<div class="link-item-title">' + esc(s.title) + '</div>' +
            '<div class="link-item-meta">' + esc(s.projectName) + ' · ' + esc(s.language) + '</div>' +
          '</div>' +
        '</div>'
      ).join('');
      list.querySelectorAll('.link-snippet-item').forEach(item => {
        item.addEventListener('click', () => {
          list.querySelectorAll('.link-snippet-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          item.querySelector('input[type=radio]').checked = true;
          selectedLinkSnippetId = item.dataset.id;
        });
      });
    }

    document.getElementById('linkOverlay').classList.add('active');
  }

  function closeLinkModal() {
    document.getElementById('linkOverlay').classList.remove('active');
    selectedLinkSnippetId = null;
  }

  // ──────────────────────────────────────────
  // MESSAGES FROM EXTENSION
  // ──────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data;
    switch (msg.type) {
      case 'allSnippets':
        allSnippets = msg.snippets;
        renderSnippets(allSnippets);
        break;
      case 'searchResults':
        renderSnippets(msg.snippets);
        break;
      case 'showAddForm':
        openAddModal(msg.data);
        break;
      case 'showLinkForm':
        openLinkModal(msg.data, msg.snippets);
        break;
      case 'snippetSaved':
        allSnippets.unshift(msg.snippet);
        renderSnippets(searchInput.value || activeFilters.length ? null : allSnippets);
        if (!searchInput.value && activeFilters.length === 0) {
          renderSnippets(allSnippets);
        } else {
          doSearch();
        }
        break;
      case 'snippetUpdated':
        allSnippets = allSnippets.map(s => s.id === msg.snippet.id ? msg.snippet : s);
        renderSnippets(searchInput.value || activeFilters.length ? allSnippets.filter(s => s.id === msg.snippet.id || true) : allSnippets);
        doSearch();
        if (!searchInput.value && activeFilters.length === 0) {
          renderSnippets(allSnippets);
        }
        break;
      case 'snippetDeleted':
        allSnippets = allSnippets.filter(s => s.id !== msg.id);
        if (!searchInput.value && activeFilters.length === 0) {
          renderSnippets(allSnippets);
        } else {
          doSearch();
        }
        break;
    }
  });

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Signal ready
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

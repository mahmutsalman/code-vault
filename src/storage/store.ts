import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { Snippet, Store, RelatedClass } from '../types';
import { randomUUID } from 'crypto';

export { randomUUID };

export class SnippetStore {
  private storePath: string;
  private store: Store;

  constructor(context: vscode.ExtensionContext) {
    const storageDir = context.globalStorageUri.fsPath;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.storePath = path.join(storageDir, 'snippets.json');
    this.store = this.load();
  }

  private load(): Store {
    if (fs.existsSync(this.storePath)) {
      try {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        return JSON.parse(raw) as Store;
      } catch {
        return { snippets: [], version: 1 };
      }
    }
    return { snippets: [], version: 1 };
  }

  private save(): void {
    fs.writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8');
  }

  addSnippet(snippet: Snippet): void {
    this.store.snippets.unshift(snippet);
    this.save();
  }

  updateSnippet(snippet: Snippet): void {
    const idx = this.store.snippets.findIndex(s => s.id === snippet.id);
    if (idx !== -1) {
      this.store.snippets[idx] = snippet;
      this.save();
    }
  }

  deleteSnippet(id: string): void {
    this.store.snippets = this.store.snippets.filter(s => s.id !== id);
    this.save();
  }

  getSnippet(id: string): Snippet | undefined {
    return this.store.snippets.find(s => s.id === id);
  }

  getAllSnippets(): Snippet[] {
    return this.store.snippets;
  }

  search(query: string, tags: string[]): Snippet[] {
    let results = [...this.store.snippets];

    if (tags.length > 0) {
      results = results.filter(s => tags.every(tag => s.tags.includes(tag)));
    }

    if (!query.trim()) {
      return results;
    }

    const q = query.toLowerCase();

    // Score each snippet: metadata matches rank higher than code content matches
    const scored = results
      .map(s => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const tagMatch = s.tags.some(t => t.toLowerCase().includes(q));
        const fileMatch = s.fileName.toLowerCase().includes(q);
        const projectMatch = s.projectName.toLowerCase().includes(q);
        const codeMatch = s.code.toLowerCase().includes(q);

        // 3 = title/tag hit, 2 = file/project hit, 1 = code-only hit, 0 = no match
        let score = 0;
        if (titleMatch || tagMatch) { score = 3; }
        else if (fileMatch || projectMatch) { score = 2; }
        else if (codeMatch) { score = 1; }

        return { snippet: s, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map(({ snippet }) => snippet);
  }

  addRelatedClass(snippetId: string, relatedClass: RelatedClass): Snippet | undefined {
    const snippet = this.store.snippets.find(s => s.id === snippetId);
    if (snippet) {
      snippet.relatedClasses.push(relatedClass);
      snippet.updatedAt = new Date().toISOString();
      this.save();
      return snippet;
    }
    return undefined;
  }

  addTag(snippetId: string, tag: string): Snippet | undefined {
    const snippet = this.store.snippets.find(s => s.id === snippetId);
    if (snippet && !snippet.tags.includes(tag)) {
      snippet.tags.push(tag);
      snippet.updatedAt = new Date().toISOString();
      this.save();
      return snippet;
    }
    return snippet;
  }

  removeTag(snippetId: string, tag: string): Snippet | undefined {
    const snippet = this.store.snippets.find(s => s.id === snippetId);
    if (snippet) {
      snippet.tags = snippet.tags.filter(t => t !== tag);
      snippet.updatedAt = new Date().toISOString();
      this.save();
      return snippet;
    }
    return undefined;
  }

  updateTitle(snippetId: string, title: string): Snippet | undefined {
    const snippet = this.store.snippets.find(s => s.id === snippetId);
    if (snippet) {
      snippet.title = title;
      snippet.updatedAt = new Date().toISOString();
      this.save();
      return snippet;
    }
    return undefined;
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.store.snippets.forEach(s => s.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }
}

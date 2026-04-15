# Code Vault

A VS Code extension to save, tag, search, and version your code snippets across all projects.

## Why

Ever forgotten how you wrote a Rust iterator, a specific SQL query, or a tricky regex? Code Vault lets you save those snippets once and find them instantly later — across every project you work in.

Each snippet is frozen to the exact git commit it came from, so the code never changes even if the original file is deleted or rewritten.

---

## Features

### Save Snippets from Any File
Select code in your editor → right-click → **Code Vault: Add Selection as Snippet**

- Auto-generates a title from the first line (editable)
- Stores the full file snapshot at save time — read-only view always shows the original context
- Captures current git branch and commit hash so you know exactly when and where it came from
- Works on files without git too (with a warning that the snapshot may become stale)

### Link Related Classes
Open any file → right-click → **Code Vault: Add Current File as Related Class**

- Attach any file to an existing snippet for full context
- The entire file is snapshotted at link time with its git info
- Related files are listed newest-first per snippet, with a live filter input

### Search
- **Keyword mode** — searches title, code content, filename, tags, and project name; results ranked by relevance (title/tag matches first, code-body matches last)
- **Tag mode** — click the `#` toggle button, type to get live tag autocomplete with usage counts, select tags to stack as AND filters

### Read-Only Viewing
Clicking any snippet or related class opens a frozen read-only document in the editor with the snippet lines selected and centered — even if the original file has since changed or been deleted.

### Other
- Inline title editing — click a snippet title to rename it
- Inline tag editing — click `+ tag` on any card, type, press Enter
- Refresh button (↻) to reload snippets from disk
- Delete snippets with confirmation dialog

---

## Installation

**From source:**

```bash
git clone https://github.com/mahmutsalman/code-vault
cd code-vault
npm install
npm run package
code --install-extension code-vault-1.0.0.vsix
```

Then reload VS Code (`Cmd+Shift+P` → `Developer: Reload Window`).

---

## Usage

| Action | How |
|--------|-----|
| Save a snippet | Select code → right-click → *Add Selection as Snippet* |
| Open a snippet | Click any card in the sidebar |
| Link a related class | Open file → right-click → *Add Current File as Related Class* |
| Search by keyword | Type in the search bar |
| Search by tag | Click `#` toggle → type tag name → select from dropdown |
| Add a tag | Hover a card → click `+ tag` |
| Edit title | Click the title text on any card |
| Filter related classes | Type in the `filter classes...` input on a card |
| Refresh | Click ↻ in the search bar |

---

## Architecture

| File | Purpose |
|------|---------|
| `src/extension.ts` | Entry point — wires providers and commands |
| `src/types.ts` | `Snippet`, `RelatedClass`, pending data types |
| `src/storage/store.ts` | JSON store in VS Code `globalStorageUri`; relevance-scored search |
| `src/git/gitService.ts` | Reads branch + commit hash via `git` CLI |
| `src/providers/snippetContentProvider.ts` | Serves frozen snapshots as virtual read-only documents |
| `src/providers/vaultViewProvider.ts` | Sidebar webview UI (search, cards, modals) |
| `src/commands/addSnippet.ts` | Captures selection + snapshot + git info |
| `src/commands/addRelatedClass.ts` | Captures open file snapshot + git info |

**Storage:** Plain JSON file in VS Code's global storage (`~/.vscode/...`) — no native dependencies, works on all platforms.

**Search scoring:** title/tag match = 3 · filename/project match = 2 · code-body-only match = 1 — semantically named snippets surface above raw content matches.

---

## Development

```bash
npm install       # install dependencies
npm run compile   # compile TypeScript → out/
npm run package   # build .vsix
```

Reload VS Code after each install to pick up changes.

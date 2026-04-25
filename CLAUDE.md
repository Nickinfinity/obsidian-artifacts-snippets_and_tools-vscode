# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run compile        # One-off TypeScript build
npm run watch          # Watch mode for development (preferred during active dev)
npm run lint           # ESLint check
npm run test           # Compile + lint + run tests
```

Press **F5** in VS Code to launch the Extension Development Host.

## What This Extension Does

"Obsidian Notes & Snippets" lets developers access their Obsidian vault's notes and snippets from within VS Code, and create new ones directly from the editor. The extension is early-stage (v0.0.1).

## Architecture

**Entry point:** `src/extension.ts` — exports `activate()` and `deactivate()`. TypeScript compiles to `out/extension.js`, which is the runtime entry (`"main"` in package.json).

**Activation flow:**
1. `activate()` registers the command `obsidian-notes-and-snippets.config` ("AI Obsidian S&T: Config").
2. The command opens a `WebviewPanel` titled "AI Obsidian Snippets & Tools - CONFIG".
3. `getNonce()` generates a CSP nonce for the webview's HTML content.
4. `getWebviewContent()` is defined but currently commented out — the webview body is not yet rendering.

**No runtime dependencies** — only the VS Code API is used.

## Key Config Files

- `tsconfig.json` — strict mode, `ES2022` target, `Node16` module resolution, output to `out/`
- `eslint.config.mjs` — enforces naming conventions, curly braces, `===` equality, semicolons
- `.vscode/launch.json` — debug launch with `--extensionDevelopmentPath`; other extensions disabled in the host
- `.vscode/tasks.json` — `npm watch` is the default build task (runs automatically on F5)

## VS Code Extension Notes

- `activationEvents` is `[]` in package.json — the extension is not lazily activated; update this when commands stabilise.
- The compiled `out/` directory is hidden in the VS Code file explorer (`.vscode/settings.json`) but is tracked by Git for distribution — do not add it to `.gitignore`.
- Packaging excludes `src/`, config files, and tests via `.vscodeignore`.

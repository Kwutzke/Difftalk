# difftalk

Terminal UI for reviewing AI-generated code diffs with inline Claude conversations.

Browse diffs hunk-by-hunk, leave comments, discuss changes with Claude, and apply inline fixes — all without leaving the terminal.

## Install

```bash
bun install
```

Requires [Node.js](https://nodejs.org) 18+ and [Bun](https://bun.sh) (for package management and tests).

## Usage

```bash
# Review unstaged changes
bun run start

# Review a specific commit or ref
bun run start HEAD~1
bun run start abc1234

# Resume a previous session
bun run start --resume

# Export comments as markdown
bun run start --export review.md
bun run start --export              # writes difftalk-review.md

# Use GitButler diff instead of git
bun run start --but
```

## Keyboard shortcuts

| Key       | Action                              |
| --------- | ----------------------------------- |
| `Tab`     | Cycle focus: file list ↔ diff view  |
| `j` / `k` | Navigate files or hunks             |
| `c`       | Add a comment on the current hunk   |
| `d`       | Discuss the current hunk with Claude |
| `f`       | Ask Claude to fix the current hunk  |
| `Esc`     | Close chat panel                    |
| `q`       | Quit (auto-saves session)           |

## Configuration

Create `~/.config/difftalk/config.toml`:

```toml
# Default git ref when none is passed on the CLI
defaultRef = "HEAD~1"

# Syntax highlighter: "bat" or "plain"
highlighter = "bat"

# Claude model to use
claudeModel = "claude-sonnet-4-20250514"

# Max conversation turns per discussion
maxTurns = 5
```

## Session persistence

Sessions auto-save to `.difftalk/session.json` on exit. Use `--resume` to pick up where you left off, or `--export` to dump all comments as a markdown review file.

## Development

```bash
bun run dev          # Run in development mode
bun run typecheck    # Type-check with tsc
bun test             # Run tests (90 tests)
bun run format       # Format with prettier
bun run format:check # Check formatting
```

## Architecture

```
src/
  index.tsx                 # CLI entry point, arg parsing, session management
  types.ts                  # Shared type definitions
  components/
    App.tsx                 # Root layout, focus & key management
    FileList.tsx            # Sidebar file list with comment badges
    DiffView.tsx            # Syntax-highlighted hunk viewer
    ChatPanel.tsx           # Claude conversation panel
  lib/
    diff.ts                 # Git diff fetching & parsing
    comments.ts             # In-memory comment store
    highlight.ts            # bat/plain ANSI syntax highlighting
    export.ts               # Markdown export
    config.ts               # TOML config loader
    session-store.ts        # Session persistence
    claude/
      session.ts            # Claude hunk discussions
      executor.ts           # Claude inline fix executor
      handoff.ts            # Full session handoff to Claude Code
```

## License

MIT

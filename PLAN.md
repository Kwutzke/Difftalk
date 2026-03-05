# difftalk — Implementation Plan (Phase 1: Core)

## Key Decisions

### SDK package name
The spec references `@anthropic-ai/claude-code-sdk` but the actual package is `@anthropic-ai/claude-agent-sdk`. The `query()` function returns an async iterator yielding `SDKMessage` types (not just `"assistant"` — it's `"SDKAssistantMessage"`). The plan uses the correct API.

### Bun + Ink compatibility
Bun has known issues with Ink's `useInput` hook (GitHub oven-sh/bun#6862). Two options:
- **Option A**: Use Bun as package manager but run with Node (`node --import tsx`)
- **Option B**: Use Bun runtime and work around stdin issues

**Decision**: Use **Bun as package manager** + **Node as runtime** via `tsx`. This avoids Ink stdin bugs while keeping fast installs. The `bun run` script will invoke `node --import tsx src/index.tsx`.

### bat availability
`bat` is not installed in this environment. The plain ANSI fallback must work perfectly as the primary path. `bat` highlighting is a nice-to-have.

---

## Step-by-step Implementation

### Step 1: Project scaffolding
- `bun init` + configure `package.json` with scripts
- `tsconfig.json` with JSX support (`"jsx": "react-jsx"`, `"jsxImportSource": "react"`)
- Install deps: `ink`, `react`, `parse-diff`, `@anthropic-ai/claude-agent-sdk`, `tsx`
- Install dev deps: `@types/react`, `typescript`
- Create directory structure: `src/`, `src/components/`, `src/lib/`, `src/lib/claude/`
- Add `src/types.ts` with `Hunk`, `Message`, `Comment`, `DiffFile` types

### Step 2: Diff loading & hunk parsing (`src/lib/diff.ts`)
- `getDiff(ref?: string)`: runs `git diff` (or `git show <ref>`) via `child_process.execSync`
- `parseDiff(raw: string)`: wraps `parse-diff` to produce `DiffFile[]` and `Hunk[]`
- Each hunk gets an ID like `"filename:startLine"`
- Extract surrounding context lines for Claude prompts

### Step 3: Syntax highlighting (`src/lib/highlight.ts`)
- `checkBatAvailable()`: checks if `bat` or `batcat` exists
- `highlight(content, filename)`: spawns `bat` if available, otherwise `plainAnsi()`
- `plainAnsi(content)`: colors `+` lines green, `-` lines red, `@@` lines cyan
- All functions are async, returns ANSI-colored strings

### Step 4: Comment store (`src/lib/comments.ts`)
- In-memory store: `Map<string, Comment[]>` keyed by hunk ID
- `addComment(hunkId, text)`: creates Comment with empty thread
- `getComments(hunkId)`: returns comments for a hunk
- `getAllComments()`: returns all comments (for handoff)
- `getCommentCount(file)`: returns count for file badge display

### Step 5: FileList component (`src/components/FileList.tsx`)
- Vertical list of changed files from diff
- Shows comment count badge (e.g., `3●`) per file
- `j/k` navigation when focused
- Highlights selected file
- Calls `onSelectFile(filename)` on selection change

### Step 6: DiffView component (`src/components/DiffView.tsx`)
- Displays hunks for selected file with ANSI-colored diff lines
- `j/k` navigation between hunks (when focused)
- Shows comment markers `[n]` next to commented hunks
- Shows hunk headers (`@@ ... @@`)
- Scrollable within terminal height constraints
- Highlights the currently selected hunk with a border/indicator

### Step 7: ChatPanel component (`src/components/ChatPanel.tsx`)
- Slides up from bottom when `d` is pressed
- Shows thread for current hunk's comment
- Text input at bottom for new messages
- Streams Claude responses incrementally
- `f` key triggers inline fix (executor)
- `esc` closes panel
- Shows "streaming..." indicator during Claude responses

### Step 8: App component & layout (`src/components/App.tsx`)
- Three-region layout: FileList (left) | DiffView (right) | ChatPanel (bottom, conditional)
- Focus management: `tab` cycles FileList ↔ DiffView, `d` focuses ChatPanel
- Global key bindings: `c` (comment), `d` (discuss), `f` (fix), `p` (plan), `q` (quit)
- State: selected file, selected hunk, comments, chat panel open/closed
- Passes callbacks to children

### Step 9: Entry point (`src/index.tsx`)
- Parse CLI args: optional git ref (defaults to unstaged `git diff`)
- Load diff, parse hunks
- `render(<App />)` via Ink
- Handle exit cleanup

### Step 10: Claude session integration (`src/lib/claude/session.ts`)
- `askAboutHunk(hunk, comment, userMessage, onChunk)`: streams Claude response
- Uses `query()` from `@anthropic-ai/claude-agent-sdk`
- `allowedTools: []` (read-only discussion, no tool use)
- `abortController` for cancellation when user closes panel
- Appends response to comment thread

### Step 11: Wire everything together & test manually
- Ensure `bun run dev` launches the TUI
- Test with a real git repo that has diffs
- Verify navigation, commenting, and Claude discussions work
- Test plain ANSI fallback (no bat)

---

## Dependency List

**Runtime deps:**
- `ink` — Terminal UI React renderer
- `react` — Required by Ink
- `parse-diff` — Unified diff parser
- `@anthropic-ai/claude-agent-sdk` — Claude Code SDK
- `tsx` — TypeScript execution for Node

**Dev deps:**
- `@types/react` — React type definitions
- `typescript` — TypeScript compiler

---

## Files to Create

```
src/
  index.tsx
  types.ts
  components/
    App.tsx
    FileList.tsx
    DiffView.tsx
    ChatPanel.tsx
  lib/
    diff.ts
    highlight.ts
    comments.ts
    claude/
      session.ts
package.json
tsconfig.json
```

**Not in Phase 1** (deferred to Phase 2):
- `src/lib/claude/executor.ts` — inline fix
- `src/lib/claude/handoff.ts` — full session handoff

---

## Order of Implementation

```
1. Scaffolding + deps          (no UI yet, just builds)
2. types.ts                    (shared types)
3. lib/diff.ts                 (can test standalone)
4. lib/highlight.ts            (can test standalone)
5. lib/comments.ts             (can test standalone)
6. components/FileList.tsx     (renders with mock data)
7. components/DiffView.tsx     (renders with mock data)
8. components/App.tsx          (wires FileList + DiffView)
9. index.tsx                   (entry point, loads real diff)
10. --- milestone: navigation works ---
11. components/ChatPanel.tsx   (comment input + display)
12. lib/claude/session.ts      (SDK integration)
13. Wire chat into App.tsx     (full Phase 1 complete)
```

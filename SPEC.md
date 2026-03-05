# difftalk

A terminal UI tool for reviewing AI-generated code diffs with inline Claude Code conversations, comment threads, inline fixes, and a full-session handoff for plan synthesis and execution.

-----

## Project Overview

difftalk is a lazygit-style TUI that lets you:

1. Browse diffs (git diff output)
1. Anchor comments to specific hunks
1. Have inline Claude Code conversations per hunk
1. Fix individual hunks right away via an executor subagent
1. Submit all comments to a full Claude Code session for clarification → plan → execution

Everything routes through the Claude Code CLI (via official SDK) to stay on the Max subscription. No direct Anthropic API calls.

-----

## Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **TUI**: Ink (React-based terminal UI)
- **Diff parsing**: `parse-diff` npm package
- **Syntax highlighting**: `bat` subprocess (`--color=always --style=plain`)
- **Claude Code**: `@anthropic-ai/claude-code-sdk` (official)
- **Git**: `Bun.spawn` wrapping `git diff` / `git show`

-----

## Architecture

```
difftalk/
├── src/
│   ├── index.tsx          # Entry point, root Ink render
│   ├── components/
│   │   ├── App.tsx        # Root component, layout, focus management
│   │   ├── FileList.tsx   # Left pane: file list with comment counts
│   │   ├── DiffView.tsx   # Right pane: highlighted diff with comment markers
│   │   └── ChatPanel.tsx  # Bottom slide-up: streaming conversation + fix button
│   ├── lib/
│   │   ├── diff.ts        # git diff/show → parsed hunks
│   │   ├── highlight.ts   # bat subprocess wrapper, fallback to plain ANSI
│   │   ├── comments.ts    # Comment store, anchoring logic
│   │   └── claude/
│   │       ├── session.ts   # Per-hunk conversation session
│   │       ├── executor.ts  # Inline single-hunk fix subagent
│   │       └── handoff.ts   # Full session jumpoff on plan submission
│   └── types.ts           # Shared types
├── package.json
└── tsconfig.json
```

-----

## Two Distinct Flows

### Flow 1: Inline hunk fix

For when you want a specific hunk fixed right away during review.

```
Chat panel → [f]ix → executor subagent scoped to that hunk → changes applied in working dir
```

- Stays inside difftalk
- Scoped strictly to the hunk in question
- Claude has Read + Write + Bash (restricted to relevant files)
- Does not commit — leaves changes for user or GitButler hooks

### Flow 2: Full review submission

For when you're done reviewing and want Claude Code to take over.

```
[p]lan → difftalk suspends → Claude Code session launches with all comments as context
```

- difftalk hands terminal control to Claude Code via `Bun.spawn` with `stdio: "inherit"`
- Claude Code receives a structured prompt with all comments and threads
- Claude Code handles clarification, planning, and execution interactively
- No orchestrator, no JSON parsing — Claude Code owns the full loop

-----

## UI Layout

lazygit-inspired. Single focus at a time.

```
┌─ Files ──────────┐┌─ Diff ──────────────────────────────┐
│                  ││ file: internal/sync/handler.go       │
│ handler.go    3● ││                                      │
│ parser.go     1● ││ @@ -42,7 +42,9 @@                   │
│                  ││   func handleSync() error {          │
│                  ││+  if err := validate(ctx); err !=   │ ← [1]
│                  ││+    return fmt.Errorf("invalid: %w"  │
│                  ││   }                                  │
└──────────────────┘└─────────────────────────────────────┘
┌─ [c]omment  [d]iscuss  [f]ix  [p]lan  [q]uit ──────────┐
│ [1] why did you add validation here? (2 messages)        │
└──────────────────────────────────────────────────────────┘
```

Chat panel slides up on `[d]`:

```
┌─ Diff (dimmed) ─────────────────────────────────────────┐
│ ...                                                      │
└──────────────────────────────────────────────────────────┘
┌─ Discussion: handler.go:44 ─────────────────────────────┐
│                                                          │
│ You: why did you add validation here?                    │
│                                                          │
│ Claude: The SAP sync handler was previously allowing     │
│ malformed payloads through...                            │
│                                                          │
│ [f]ix this hunk                    > _                   │
└──────────────────────────────────────────────────────────┘
```

-----

## Key Bindings

|Key    |Action                                               |
|-------|-----------------------------------------------------|
|`j/k`  |Navigate hunks                                       |
|`c`    |Add comment to current hunk                          |
|`d`    |Open/close discussion panel                          |
|`f`    |Fix current hunk inline (executor subagent)          |
|`p`    |Submit all comments → jump off to Claude Code session|
|`tab`  |Switch focus between panes                           |
|`esc`  |Close chat panel / cancel                            |
|`enter`|Send message in chat                                 |
|`q`    |Quit                                                 |

-----

## Types

```ts
// types.ts

export interface Hunk {
  id: string         // "file:startLine"
  file: string
  startLine: number
  endLine: number
  content: string    // raw unified diff hunk
  context: string    // surrounding lines for Claude context
}

export interface Message {
  role: "user" | "assistant"
  content: string
}

export interface Comment {
  id: string
  hunkId: string
  text: string
  thread: Message[]
  createdAt: Date
}
```

-----

## Syntax Highlighting

```ts
// lib/highlight.ts

const hasBat = await checkBatAvailable()

export async function highlight(content: string, filename: string): Promise<string> {
  if (!hasBat) return plainAnsi(content)

  const ext = filename.split(".").pop() ?? "txt"
  const proc = Bun.spawn(
    ["bat", "--color=always", "--style=plain", "--language", ext],
    { stdin: "pipe", stdout: "pipe" }
  )
  proc.stdin.write(content)
  proc.stdin.end()
  return await new Response(proc.stdout).text()
}

function plainAnsi(content: string): string {
  return content
    .split("\n")
    .map(line => {
      if (line.startsWith("+")) return `\x1b[32m${line}\x1b[0m`
      if (line.startsWith("-")) return `\x1b[31m${line}\x1b[0m`
      return line
    })
    .join("\n")
}
```

-----

## Claude Code SDK Usage

### Hunk conversation session

```ts
// lib/claude/session.ts
import { query } from "@anthropic-ai/claude-code-sdk"

export async function askAboutHunk(
  hunk: Hunk,
  comment: Comment,
  userMessage: string,
  onChunk: (text: string) => void
): Promise<void> {
  const systemPrompt = `You are reviewing AI-generated code changes.
If the comment is ambiguous, ask a clarifying question before suggesting a fix.

Hunk:
${hunk.context}

Comment: ${comment.text}
Previous discussion:
${comment.thread.map(m => `${m.role}: ${m.content}`).join("\n")}`

  for await (const message of query({
    prompt: userMessage,
    options: { systemPrompt, allowedTools: [] }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") onChunk(block.text)
      }
    }
  }
}
```

### Inline fix executor

```ts
// lib/claude/executor.ts

export async function fixHunk(
  hunk: Hunk,
  comment: Comment,
  cwd: string,
  onChunk: (text: string) => void
): Promise<void> {
  const prompt = `Fix the following code hunk based on this review comment and discussion.

Hunk (${hunk.file} lines ${hunk.startLine}-${hunk.endLine}):
${hunk.context}

Comment: ${comment.text}
Discussion:
${comment.thread.map(m => `${m.role}: ${m.content}`).join("\n")}

Make only the changes needed to address the comment. Do not commit.`

  for await (const message of query({
    prompt,
    options: {
      cwd,
      allowedTools: ["Read", "Write"],
      systemPrompt: "You are fixing a specific code hunk based on a review comment. Make minimal, focused changes only.",
    }
  })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") onChunk(block.text)
      }
    }
  }
}
```

### Full session handoff

```ts
// lib/claude/handoff.ts

export function buildHandoffPrompt(comments: Comment[]): string {
  const commentSummary = comments.map((c, i) => `
[${i + 1}] ${c.hunkId}
Comment: ${c.text}
Discussion:
${c.thread.map(m => `  ${m.role}: ${m.content}`).join("\n")}
`).join("\n---\n")

  return `You are starting a coding session based on a completed code review.

Review comments:
${commentSummary}

Before implementing anything:
1. Review all comments and ask for clarification on anything ambiguous
2. Once everything is clear, propose an ordered implementation plan
3. Wait for approval before making any changes

Start by summarizing what you understand from the review and asking any clarifying questions.`
}

export async function jumpOffToClaudeCode(comments: Comment[], cwd: string): Promise<void> {
  const prompt = buildHandoffPrompt(comments)

  // Hand terminal control entirely to Claude Code
  const proc = Bun.spawn(
    ["claude", "--print", prompt],
    { cwd, stdio: ["inherit", "inherit", "inherit"] }
  )
  await proc.exited
}
```

-----

## Implementation Phases

### Phase 1 — Core

- [ ] Project setup (Bun + Ink + TypeScript)
- [ ] Diff loading and hunk parsing (`git diff` / `git show`)
- [ ] FileList + DiffView components with navigation
- [ ] Syntax highlighting via bat (with plain ANSI fallback)
- [ ] Comment anchoring to hunks
- [ ] ChatPanel with streaming Claude Code responses

### Phase 2 — Fix & Submit

- [ ] Inline hunk fix via executor subagent (`[f]ix`)
- [ ] Full session handoff on `[p]lan` → launches Claude Code with all comments
- [ ] GitButler `but` CLI integration (branch-per-executor fix)

### Phase 3 — Polish

- [ ] Session resume (continue a previous review)
- [ ] Export comments as markdown
- [ ] `but diff` as input source
- [ ] Config file (`~/.config/difftalk/config.toml`)

-----

## Development Notes

- Keep Ink components small — extract all logic into `lib/`
- All Claude sessions must support AbortController cancellation
- Stream responses incrementally — never wait for full response before rendering
- bat is optional — always test the plain ANSI fallback path
- No git commits from within the tool — leave that to the user or GitButler hooks
- Phase 1 has no persistence — comments are in-memory only
- The handoff prompt is the most important output of the tool — keep it well structured

-----

## Out of Scope

- Web UI
- GitHub PR integration
- Multi-repo support
- Collaborative review
- Authentication / accounts

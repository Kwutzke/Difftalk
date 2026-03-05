import React from "react"
import { render } from "ink"
import { writeFileSync } from "node:fs"
import { getDiff, getButDiff, hasButCli, parseDiffOutput } from "./lib/diff.js"
import { loadConfig } from "./lib/config.js"
import { loadSession, saveSession } from "./lib/session-store.js"
import type { UIState } from "./lib/session-store.js"
import { restoreComments, getAllComments } from "./lib/comments.js"
import { exportCommentsAsMarkdown } from "./lib/export.js"
import { setHighlighterMode } from "./lib/highlight.js"
import App from "./components/App.js"

function printHelp() {
  console.log(`difftalk — review diffs with inline Claude conversations

Usage: difftalk [git-ref] [options]

Options:
  --but          Use GitButler diff instead of git
  --resume       Resume a previous session
  --export FILE  Export comments as markdown (default: difftalk-review.md)
  --help, -h     Show this help

Keys: [c]omment [d]iscuss [f]ix [p]lan [tab] switch [q]uit`)
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  let ref: string | undefined
  let useBut = false
  let resume = false
  let exportPath: string | undefined
  let help = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--but") {
      useBut = true
    } else if (arg === "--resume") {
      resume = true
    } else if (arg === "--export") {
      exportPath = args[++i] ?? "difftalk-review.md"
    } else if (arg === "--help" || arg === "-h") {
      help = true
    } else if (!arg.startsWith("-")) {
      ref = arg
    }
  }

  return { ref, useBut, resume, exportPath, help }
}

function main() {
  const config = loadConfig()
  setHighlighterMode(config.highlighter)
  const { ref: argRef, useBut, resume, exportPath, help } = parseArgs(process.argv)
  const cwd = process.cwd()

  if (help) {
    printHelp()
    process.exit(0)
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "Warning: ANTHROPIC_API_KEY not set. Claude features (discuss, fix, plan) will not work."
    )
  }

  // Export mode: dump saved comments as markdown and exit
  if (exportPath) {
    const session = loadSession(cwd)
    if (!session || session.comments.length === 0) {
      console.error("No saved session to export. Run a review first.")
      process.exit(1)
    }
    const md = exportCommentsAsMarkdown(session.comments)
    writeFileSync(exportPath, md, "utf-8")
    console.log(`Exported ${session.comments.length} comments to ${exportPath}`)
    process.exit(0)
  }

  const ref = argRef ?? config.defaultRef

  // Resume mode: restore previous session's comments and UI state
  let initialUIState: UIState | undefined
  if (resume) {
    const session = loadSession(cwd)
    if (!session) {
      console.error("No saved session found. Start a new review instead.")
      process.exit(1)
    }
    restoreComments(session.comments)
    initialUIState = session.uiState
    console.error(`Resumed session with ${session.comments.length} comments`)
  }

  // Get diff
  let raw: string
  try {
    if (useBut) {
      if (!hasButCli()) {
        console.error(
          "GitButler CLI (but) not found. Install it or use git diff instead."
        )
        process.exit(1)
      }
      raw = getButDiff()
    } else {
      raw = getDiff(ref)
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Failed to get diff: ${msg}`)
    console.error(
      ref
        ? `Usage: difftalk [git-ref] [--but] [--resume] [--export <file>]`
        : `No unstaged changes found. Try: difftalk HEAD~1`
    )
    process.exit(1)
  }

  if (!raw.trim()) {
    console.error(
      ref ? `No diff output for ref: ${ref}` : `No unstaged changes. Try: difftalk HEAD~1`
    )
    process.exit(0)
  }

  const files = parseDiffOutput(raw)

  if (files.length === 0) {
    console.error("No files found in diff output.")
    process.exit(0)
  }

  // Track UI state for session persistence
  let currentUIState: UIState = initialUIState ?? {
    selectedFileIndex: 0,
    selectedHunkIndex: 0,
  }
  const handleUIStateChange = (state: UIState) => {
    currentUIState = state
  }

  // Auto-save on exit
  const handleExit = () => {
    const comments = getAllComments()
    if (comments.length > 0) {
      saveSession(cwd, comments, ref, currentUIState)
    }
  }
  process.on("exit", handleExit)
  process.on("SIGINT", () => {
    handleExit()
    process.exit(0)
  })

  render(
    <App
      files={files}
      config={config}
      initialUIState={initialUIState}
      onUIStateChange={handleUIStateChange}
    />
  )
}

main()

import React from "react"
import { render } from "ink"
import { getDiff, parseDiffOutput } from "./lib/diff.js"
import App from "./components/App.js"

function main() {
  const ref = process.argv[2] // optional: git ref or commit hash

  let raw: string
  try {
    raw = getDiff(ref)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`Failed to get diff: ${msg}`)
    console.error(
      ref
        ? `Usage: difftalk [git-ref]`
        : `No unstaged changes found. Try: difftalk HEAD~1`
    )
    process.exit(1)
  }

  if (!raw.trim()) {
    console.error(
      ref
        ? `No diff output for ref: ${ref}`
        : `No unstaged changes. Try: difftalk HEAD~1`
    )
    process.exit(0)
  }

  const files = parseDiffOutput(raw)

  if (files.length === 0) {
    console.error("No files found in diff output.")
    process.exit(0)
  }

  render(<App files={files} />)
}

main()

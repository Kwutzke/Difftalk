import { execSync, execFileSync } from "node:child_process"
import parseDiff from "parse-diff"
import type { DiffFile, Hunk } from "../types.js"

function validateRef(ref: string): void {
  // Reject shell metacharacters to prevent command injection
  if (/[;&|`$(){}!<>'"\\]/.test(ref)) {
    throw new Error(`Invalid git ref: ${ref}`)
  }
}

export function getDiff(ref?: string): string {
  if (ref) {
    validateRef(ref)
    return execFileSync("git", ["show", ref, "--format="], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    })
  }
  return execFileSync("git", ["diff"], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  })
}

export function getButDiff(): string {
  return execSync("but diff", { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 })
}

export function hasButCli(): boolean {
  try {
    execSync("which but", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

export function parseDiffOutput(raw: string): DiffFile[] {
  const files = parseDiff(raw)

  return files.map((file) => {
    const filename = file.to ?? file.from ?? "unknown"

    const hunks: Hunk[] = file.chunks.map((chunk) => {
      const lines = chunk.changes
        .map((c) => c.content)
        .join("\n")

      const startLine = chunk.newStart
      const endLine = chunk.newStart + chunk.newLines - 1
      const id = `${filename}:${startLine}`

      return {
        id,
        file: filename,
        startLine,
        endLine,
        content: lines,
        context: `${chunk.content}\n${lines}`,
        header: chunk.content,
      }
    })

    return {
      from: file.from ?? "/dev/null",
      to: file.to ?? "/dev/null",
      filename,
      hunks,
    }
  })
}

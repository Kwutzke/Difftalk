import { execSync } from "node:child_process"
import { spawn } from "node:child_process"
import type { Comment } from "../../types.js"

export function buildHandoffPrompt(comments: Comment[]): string {
  const commentSummary = comments
    .map(
      (c, i) => `
[${i + 1}] ${c.hunkId}
Comment: ${c.text}
Discussion:
${c.thread.map((m) => `  ${m.role}: ${m.content}`).join("\n")}`
    )
    .join("\n\n---\n")

  return `You are starting a coding session based on a completed code review.

Review comments:
${commentSummary}

Before implementing anything:
1. Review all comments and ask for clarification on anything ambiguous
2. Once everything is clear, propose an ordered implementation plan
3. Wait for approval before making any changes

Start by summarizing what you understand from the review and asking any clarifying questions.`
}

export function findClaudeBinary(): string {
  try {
    return execSync("which claude", { encoding: "utf-8" }).trim()
  } catch {
    return "claude"
  }
}

export async function jumpOffToClaudeCode(
  comments: Comment[],
  cwd: string
): Promise<number> {
  const prompt = buildHandoffPrompt(comments)
  const claudeBin = findClaudeBinary()

  // Hand terminal control entirely to Claude Code
  const child = spawn(claudeBin, ["--print", prompt], {
    cwd,
    stdio: "inherit",
  })

  return new Promise((resolve, reject) => {
    child.on("close", (code) => resolve(code ?? 0))
    child.on("error", reject)
  })
}

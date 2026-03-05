import { query } from "@anthropic-ai/claude-agent-sdk"
import type { Comment, Hunk } from "../../types.js"

export interface FixOptions {
  maxTurns?: number
  model?: string
}

export async function fixHunk(
  hunk: Hunk,
  comment: Comment,
  cwd: string,
  onChunk: (text: string) => void,
  abortController?: AbortController,
  fixOpts?: FixOptions
): Promise<string> {
  const prompt = `Fix the following code hunk based on this review comment and discussion.

Hunk (${hunk.file} lines ${hunk.startLine}-${hunk.endLine}):
${hunk.context}

Comment: ${comment.text}
Discussion:
${comment.thread.map((m) => `${m.role}: ${m.content}`).join("\n")}

Make only the changes needed to address the comment. Do not commit.`

  let fullResponse = ""

  try {
    for await (const message of query({
      prompt,
      options: {
        cwd,
        allowedTools: ["Read", "Write", "Edit"],
        permissionMode: "acceptEdits",
        maxTurns: fixOpts?.maxTurns ?? 3,
        ...(fixOpts?.model ? { model: fixOpts.model } : {}),
        systemPrompt:
          "You are fixing a specific code hunk based on a review comment. Make minimal, focused changes only. Do not commit.",
        abortController,
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") {
            fullResponse += block.text
            onChunk(fullResponse)
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Claude fix failed: ${msg}`)
  }

  return fullResponse
}

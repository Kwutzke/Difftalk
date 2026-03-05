import { query } from "@anthropic-ai/claude-agent-sdk"
import type { Comment, Hunk } from "../../types.js"

export async function fixHunk(
  hunk: Hunk,
  comment: Comment,
  cwd: string,
  onChunk: (text: string) => void,
  abortController?: AbortController
): Promise<string> {
  const prompt = `Fix the following code hunk based on this review comment and discussion.

Hunk (${hunk.file} lines ${hunk.startLine}-${hunk.endLine}):
${hunk.context}

Comment: ${comment.text}
Discussion:
${comment.thread.map((m) => `${m.role}: ${m.content}`).join("\n")}

Make only the changes needed to address the comment. Do not commit.`

  let fullResponse = ""

  for await (const message of query({
    prompt,
    options: {
      cwd,
      allowedTools: ["Read", "Write", "Edit"],
      permissionMode: "acceptEdits",
      maxTurns: 3,
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

  return fullResponse
}

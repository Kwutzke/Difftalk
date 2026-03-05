import { query } from "@anthropic-ai/claude-agent-sdk"
import type { Comment, Hunk } from "../../types.js"

export async function askAboutHunk(
  hunk: Hunk,
  comment: Comment,
  userMessage: string,
  onChunk: (text: string) => void,
  abortController?: AbortController
): Promise<string> {
  const systemPrompt = `You are reviewing AI-generated code changes.
If the comment is ambiguous, ask a clarifying question before suggesting a fix.
Keep responses concise and focused on the code.

Hunk (${hunk.file} lines ${hunk.startLine}-${hunk.endLine}):
${hunk.context}

Comment: ${comment.text}
Previous discussion:
${comment.thread.map((m) => `${m.role}: ${m.content}`).join("\n")}`

  let fullResponse = ""

  for await (const message of query({
    prompt: userMessage,
    options: {
      systemPrompt,
      allowedTools: [],
      maxTurns: 1,
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

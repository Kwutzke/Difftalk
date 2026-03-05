import { query } from "@anthropic-ai/claude-agent-sdk"
import type { Comment, Hunk } from "../../types.js"

export interface AskOptions {
  maxTurns?: number
  model?: string
}

export async function askAboutHunk(
  hunk: Hunk,
  comment: Comment,
  userMessage: string,
  onChunk: (text: string) => void,
  abortController?: AbortController,
  askOpts?: AskOptions
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

  try {
    for await (const message of query({
      prompt: userMessage,
      options: {
        systemPrompt,
        allowedTools: [],
        maxTurns: askOpts?.maxTurns ?? 1,
        ...(askOpts?.model ? { model: askOpts.model } : {}),
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
    throw new Error(`Claude query failed: ${msg}`)
  }

  return fullResponse
}

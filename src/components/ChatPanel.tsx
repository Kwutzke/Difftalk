import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { Comment, Hunk } from "../types.js"

const MAX_VISIBLE_MESSAGES = 6

interface Props {
  hunk: Hunk | null
  comment: Comment | null
  streamingText: string
  isStreaming: boolean
  isActive: boolean
  onSendMessage: (text: string) => void
  onFix: () => void
  onClose: () => void
}

export default function ChatPanel({
  hunk,
  comment,
  streamingText,
  isStreaming,
  isActive,
  onSendMessage,
  onFix,
  onClose,
}: Props) {
  const [input, setInput] = useState("")

  useInput(
    (ch, key) => {
      if (key.escape) {
        onClose()
        return
      }
      if (key.ctrl && ch === "f") {
        onFix()
        return
      }
      if (key.return && input.trim()) {
        onSendMessage(input.trim())
        setInput("")
        return
      }
      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1))
        return
      }
      if (ch && !key.ctrl && !key.meta) {
        setInput((prev) => prev + ch)
      }
    },
    { isActive }
  )

  if (!hunk) return null

  const title = comment
    ? `Discussion: ${hunk.file}:${hunk.startLine}`
    : `Comment: ${hunk.file}:${hunk.startLine}`

  const thread = comment?.thread ?? []
  const hiddenCount = Math.max(0, thread.length - MAX_VISIBLE_MESSAGES)
  const visibleMessages = hiddenCount > 0 ? thread.slice(-MAX_VISIBLE_MESSAGES) : thread

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={1}
      height={16}
    >
      <Box marginBottom={1}>
        <Text bold color="blue">
          {title}
        </Text>
        <Text dimColor> (esc to close)</Text>
      </Box>

      {/* Hidden messages indicator */}
      {hiddenCount > 0 && (
        <Box>
          <Text dimColor>... {hiddenCount} earlier message{hiddenCount > 1 ? "s" : ""}</Text>
        </Box>
      )}

      {/* Thread messages */}
      {visibleMessages.map((msg, i) => (
        <Box key={i} marginBottom={0}>
          <Text color={msg.role === "user" ? "green" : "cyan"} bold>
            {msg.role === "user" ? "You" : "Claude"}:{" "}
          </Text>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
      ))}

      {/* Streaming response */}
      {streamingText && (
        <Box marginBottom={0}>
          <Text color="cyan" bold>
            Claude:{" "}
          </Text>
          <Text wrap="wrap">{streamingText}</Text>
          {isStreaming && <Text color="yellow">▊</Text>}
        </Box>
      )}

      {isStreaming && !streamingText && (
        <Box>
          <Text color="yellow">Thinking...</Text>
        </Box>
      )}

      {/* Input line */}
      <Box marginTop={1}>
        <Text color="green" bold>
          {">"}{" "}
        </Text>
        <Text>{input}</Text>
        {!isStreaming && <Text color="gray">▊</Text>}
      </Box>

      {/* Help bar */}
      <Box>
        <Text dimColor>[enter] send [ctrl+f] fix [esc] close</Text>
      </Box>
    </Box>
  )
}

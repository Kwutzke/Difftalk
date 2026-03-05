import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import type { Comment, Hunk } from "../types.js"

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
      if (ch === "f" && !input) {
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

      {/* Thread messages */}
      {comment?.thread.map((msg, i) => (
        <Box key={i} marginBottom={0}>
          <Text color={msg.role === "user" ? "green" : "cyan"} bold>
            {msg.role === "user" ? "You" : "Claude"}:{" "}
          </Text>
          <Text wrap="wrap">{msg.content}</Text>
        </Box>
      ))}

      {/* Streaming response */}
      {isStreaming && streamingText && (
        <Box marginBottom={0}>
          <Text color="cyan" bold>
            Claude:{" "}
          </Text>
          <Text wrap="wrap">{streamingText}</Text>
          <Text color="yellow">▊</Text>
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
        <Text dimColor>
          [enter] send  [f] fix hunk  [esc] close
        </Text>
      </Box>
    </Box>
  )
}

import React from "react"
import { Box, Text, useInput } from "ink"
import type { Hunk } from "../types.js"
import { plainAnsi } from "../lib/highlight.js"

interface Props {
  filename: string
  hunks: Hunk[]
  selectedHunkIndex: number
  onSelectHunk: (index: number) => void
  commentMarkers: Map<string, number> // hunkId -> comment count
  isFocused: boolean
}

export default function DiffView({
  filename,
  hunks,
  selectedHunkIndex,
  onSelectHunk,
  commentMarkers,
  isFocused,
}: Props) {
  useInput(
    (input, key) => {
      if (input === "j" || key.downArrow) {
        onSelectHunk(Math.min(selectedHunkIndex + 1, hunks.length - 1))
      } else if (input === "k" || key.upArrow) {
        onSelectHunk(Math.max(selectedHunkIndex - 1, 0))
      }
    },
    { isActive: isFocused }
  )

  if (hunks.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        flexGrow={1}
        paddingX={1}
      >
        <Text dimColor>No hunks to display</Text>
      </Box>
    )
  }

  const selectedHunk = hunks[selectedHunkIndex]

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? "blue" : "gray"}
      flexGrow={1}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={isFocused ? "blue" : "white"}>
          {filename}
        </Text>
        <Text dimColor>
          {" "}
          ({selectedHunkIndex + 1}/{hunks.length})
        </Text>
      </Box>

      {/* Compact hunk list */}
      {hunks.map((hunk, i) => {
        const isSelected = i === selectedHunkIndex
        const commentCount = commentMarkers.get(hunk.id) ?? 0
        return (
          <Box key={hunk.id}>
            <Text color={isSelected ? "blue" : "gray"}>
              {isSelected ? "▸ " : "  "}
            </Text>
            <Text color="cyan" dimColor={!isSelected}>
              {hunk.header}
            </Text>
            {commentCount > 0 && <Text color="yellow"> [{commentCount}]</Text>}
          </Box>
        )
      })}

      {/* Expanded selected hunk */}
      {selectedHunk && (
        <Box flexDirection="column" marginTop={1}>
          {selectedHunk.content.split("\n").map((line, li) => (
            <Text key={li}>{plainAnsi(line)}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}

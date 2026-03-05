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
      {hunks.map((hunk, i) => {
        const isSelected = i === selectedHunkIndex
        const commentCount = commentMarkers.get(hunk.id) ?? 0
        return (
          <Box key={hunk.id} flexDirection="column" marginBottom={1}>
            <Box>
              <Text color="cyan" dimColor={!isSelected}>
                {hunk.header}
              </Text>
              {commentCount > 0 && (
                <Text color="yellow"> [{commentCount}]</Text>
              )}
              {isSelected && isFocused && (
                <Text color="blue"> ◀</Text>
              )}
            </Box>
            <Box flexDirection="column">
              {hunk.content.split("\n").map((line, li) => (
                <Text key={li} dimColor={!isSelected}>
                  {colorLine(line)}
                </Text>
              ))}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

function colorLine(line: string): string {
  if (line.startsWith("+")) return `\x1b[32m${line}\x1b[0m`
  if (line.startsWith("-")) return `\x1b[31m${line}\x1b[0m`
  return line
}

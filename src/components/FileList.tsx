import React from "react"
import { Box, Text, useFocus, useInput } from "ink"
import type { DiffFile } from "../types.js"

interface Props {
  files: DiffFile[]
  selectedIndex: number
  onSelect: (index: number) => void
  commentCounts: Map<string, number>
  isFocused: boolean
}

export default function FileList({
  files,
  selectedIndex,
  onSelect,
  commentCounts,
  isFocused,
}: Props) {
  useInput(
    (input, key) => {
      if (input === "j" || key.downArrow) {
        onSelect(Math.min(selectedIndex + 1, files.length - 1))
      } else if (input === "k" || key.upArrow) {
        onSelect(Math.max(selectedIndex - 1, 0))
      }
    },
    { isActive: isFocused }
  )

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? "blue" : "gray"}
      width={30}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color={isFocused ? "blue" : "white"}>
          Files
        </Text>
      </Box>
      {files.map((file, i) => {
        const isSelected = i === selectedIndex
        const count = commentCounts.get(file.filename) ?? 0
        return (
          <Box key={file.filename}>
            <Text
              color={isSelected ? "blue" : undefined}
              bold={isSelected}
              inverse={isSelected && isFocused}
            >
              {" "}
              {file.filename.split("/").pop()}
            </Text>
            {count > 0 && (
              <Text color="yellow"> {count}●</Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

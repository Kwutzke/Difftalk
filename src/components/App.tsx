import React, { useState, useCallback, useRef, useEffect } from "react"
import { Box, Text, useApp, useInput } from "ink"
import type { DiffFile, Comment, Hunk } from "../types.js"
import type { DifftalkConfig } from "../lib/config.js"
import type { UIState } from "../lib/session-store.js"
import {
  addComment,
  getComments,
  getCommentCountForFile,
  getLatestComment,
  appendToThread,
  getAllComments,
} from "../lib/comments.js"
import { askAboutHunk } from "../lib/claude/session.js"
import { fixHunk } from "../lib/claude/executor.js"
import { jumpOffToClaudeCode } from "../lib/claude/handoff.js"
import FileList from "./FileList.js"
import DiffView from "./DiffView.js"
import ChatPanel from "./ChatPanel.js"

type Pane = "files" | "diff" | "chat"
type InputMode = "normal" | "comment" | "chat"

interface Props {
  files: DiffFile[]
  config?: DifftalkConfig
  initialUIState?: UIState
  onUIStateChange?: (state: UIState) => void
}

export default function App({ files, config, initialUIState, onUIStateChange }: Props) {
  const { exit } = useApp()
  const [selectedFileIndex, setSelectedFileIndex] = useState(
    initialUIState?.selectedFileIndex ?? 0
  )
  const [selectedHunkIndex, setSelectedHunkIndex] = useState(
    initialUIState?.selectedHunkIndex ?? 0
  )
  const [focusedPane, setFocusedPane] = useState<Pane>("files")
  const [chatOpen, setChatOpen] = useState(false)
  const [inputMode, setInputMode] = useState<InputMode>("normal")
  const [commentInput, setCommentInput] = useState("")
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeComment, setActiveComment] = useState<Comment | null>(null)
  const [isFixing, setIsFixing] = useState(false)
  const [confirmingPlan, setConfirmingPlan] = useState(false)
  const [, forceUpdate] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const cwd = process.cwd()

  useEffect(() => {
    onUIStateChange?.({ selectedFileIndex, selectedHunkIndex })
  }, [selectedFileIndex, selectedHunkIndex, onUIStateChange])

  const currentFile = files[selectedFileIndex]
  const currentHunks = currentFile?.hunks ?? []
  const currentHunk = currentHunks[selectedHunkIndex] ?? null

  const commentCounts = new Map<string, number>()
  for (const file of files) {
    const count = getCommentCountForFile(file.filename)
    if (count > 0) commentCounts.set(file.filename, count)
  }

  const hunkCommentMarkers = new Map<string, number>()
  for (const hunk of currentHunks) {
    const comments = getComments(hunk.id)
    if (comments.length > 0) hunkCommentMarkers.set(hunk.id, comments.length)
  }

  const handleSelectFile = useCallback((index: number) => {
    setSelectedFileIndex(index)
    setSelectedHunkIndex(0)
  }, [])

  const startClaude = useCallback(
    async (comment: Comment, message: string) => {
      if (!currentHunk) return
      setIsStreaming(true)
      setStreamingText("")
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const response = await askAboutHunk(
          currentHunk,
          comment,
          message,
          (text) => setStreamingText(text),
          controller,
          { maxTurns: config?.maxTurns, model: config?.claudeModel }
        )
        appendToThread(comment.id, { role: "assistant", content: response })
        setStreamingText("")
        forceUpdate((n) => n + 1)
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setStreamingText(`Error: ${err.message}`)
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [currentHunk]
  )

  const handleComment = useCallback(() => {
    if (!currentHunk) return
    setInputMode("comment")
    setCommentInput("")
  }, [currentHunk])

  const handleDiscuss = useCallback(() => {
    if (!currentHunk) return
    const comment = getLatestComment(currentHunk.id)
    if (!comment) {
      // No comment yet — start one first
      handleComment()
      return
    }
    setActiveComment(comment)
    setChatOpen(true)
    setFocusedPane("chat")
  }, [currentHunk, handleComment])

  const handleChatMessage = useCallback(
    (text: string) => {
      if (!activeComment || !currentHunk) return
      appendToThread(activeComment.id, { role: "user", content: text })
      forceUpdate((n) => n + 1)
      startClaude(activeComment, text)
    },
    [activeComment, currentHunk, startClaude]
  )

  const handleCloseChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setChatOpen(false)
    setActiveComment(null)
    setFocusedPane("diff")
    setIsStreaming(false)
    setIsFixing(false)
    setStreamingText("")
  }, [])

  const handleFix = useCallback(async () => {
    if (!currentHunk || !activeComment || isFixing) return
    setIsFixing(true)
    setIsStreaming(true)
    setStreamingText("")
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const response = await fixHunk(
        currentHunk,
        activeComment,
        cwd,
        (text) => setStreamingText(text),
        controller,
        { maxTurns: config?.maxTurns, model: config?.claudeModel }
      )
      appendToThread(activeComment.id, {
        role: "assistant",
        content: `[fix applied]\n${response}`,
      })
      setStreamingText("")
      forceUpdate((n) => n + 1)
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setStreamingText(`Fix error: ${err.message}`)
      }
    } finally {
      setIsStreaming(false)
      setIsFixing(false)
      abortRef.current = null
    }
  }, [currentHunk, activeComment, isFixing, cwd])

  const handlePlan = useCallback(async () => {
    const comments = getAllComments()
    if (comments.length === 0) return
    // Suspend TUI and hand off to Claude Code
    exit()
    // Small delay to let Ink clean up
    await new Promise((r) => setTimeout(r, 100))
    const code = await jumpOffToClaudeCode(comments, cwd)
    process.exit(code)
  }, [cwd, exit])

  // Global key handling
  useInput(
    (input, key) => {
      if (inputMode === "comment") {
        if (key.escape) {
          setInputMode("normal")
          setCommentInput("")
          return
        }
        if (key.return && commentInput.trim() && currentHunk) {
          const comment = addComment(currentHunk.id, commentInput.trim())
          setCommentInput("")
          setInputMode("normal")
          setActiveComment(comment)
          setChatOpen(true)
          setFocusedPane("chat")
          forceUpdate((n) => n + 1)
          startClaude(comment, commentInput.trim())
          return
        }
        if (key.backspace || key.delete) {
          setCommentInput((prev) => prev.slice(0, -1))
          return
        }
        if (input && !key.ctrl && !key.meta) {
          setCommentInput((prev) => prev + input)
        }
        return
      }

      if (focusedPane === "chat") return // ChatPanel handles its own input

      if (input === "q") {
        exit()
        return
      }
      if (key.tab) {
        setFocusedPane((p) => (p === "files" ? "diff" : "files"))
        return
      }
      if (input === "c") {
        handleComment()
        return
      }
      if (input === "d") {
        handleDiscuss()
        return
      }
      if (input === "f") {
        // Quick fix: open discuss panel if needed, then trigger fix
        if (!currentHunk) return
        const comment = getLatestComment(currentHunk.id)
        if (!comment) return // need a comment first
        setActiveComment(comment)
        setChatOpen(true)
        setFocusedPane("chat")
        // Trigger fix after state update
        setTimeout(() => handleFix(), 0)
        return
      }
      if (confirmingPlan) {
        if (input === "y" || input === "p") {
          setConfirmingPlan(false)
          handlePlan()
        } else {
          setConfirmingPlan(false)
        }
        return
      }
      if (input === "p") {
        setConfirmingPlan(true)
        return
      }
    },
    { isActive: !chatOpen || inputMode === "comment" }
  )

  const allComments = getAllComments()

  return (
    <Box flexDirection="column" height="100%">
      {/* Main area */}
      <Box flexGrow={1}>
        <FileList
          files={files}
          selectedIndex={selectedFileIndex}
          onSelect={handleSelectFile}
          commentCounts={commentCounts}
          isFocused={focusedPane === "files" && inputMode === "normal"}
        />
        <DiffView
          filename={currentFile?.filename ?? ""}
          hunks={currentHunks}
          selectedHunkIndex={selectedHunkIndex}
          onSelectHunk={setSelectedHunkIndex}
          commentMarkers={hunkCommentMarkers}
          isFocused={focusedPane === "diff" && inputMode === "normal"}
        />
      </Box>

      {/* Comment input bar */}
      {inputMode === "comment" && (
        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>
            Comment:{" "}
          </Text>
          <Text>{commentInput}</Text>
          <Text color="gray">▊</Text>
          <Text dimColor> (enter to submit, esc to cancel)</Text>
        </Box>
      )}

      {/* Chat panel */}
      {chatOpen && (
        <ChatPanel
          hunk={currentHunk}
          comment={activeComment}
          streamingText={streamingText}
          isStreaming={isStreaming}
          isActive={focusedPane === "chat" && inputMode === "normal"}
          onSendMessage={handleChatMessage}
          onFix={handleFix}
          onClose={handleCloseChat}
        />
      )}

      {/* Status bar */}
      {!chatOpen && inputMode === "normal" && (
        <Box paddingX={1}>
          {confirmingPlan ? (
            <Text color="yellow" bold>Hand off to Claude Code? [y]es / any key to cancel</Text>
          ) : (
            <>
              <Text dimColor>[c]omment [d]iscuss [f]ix [p]lan [tab] switch pane [q]uit</Text>
              {allComments.length > 0 && (
                <Text color="yellow"> ({allComments.length} comments)</Text>
              )}
            </>
          )}
        </Box>
      )}
    </Box>
  )
}

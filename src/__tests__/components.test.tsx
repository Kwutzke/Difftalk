import React from "react"
import { describe, it, expect } from "bun:test"
import { renderToString } from "ink"
import FileList from "../components/FileList.js"
import DiffView from "../components/DiffView.js"
import ChatPanel from "../components/ChatPanel.js"
import type { DiffFile, Hunk, Comment } from "../types.js"

const mockFiles: DiffFile[] = [
  {
    from: "a/handler.go",
    to: "handler.go",
    filename: "handler.go",
    hunks: [
      {
        id: "handler.go:42",
        file: "handler.go",
        startLine: 42,
        endLine: 50,
        content: "+  if err := validate(ctx); err != nil {\n+    return err\n   }",
        context: "@@ -42,6 +42,8 @@\n+  if err := validate(ctx); err != nil {",
        header: "@@ -42,6 +42,8 @@ func handleSync()",
      },
    ],
  },
  {
    from: "a/parser.go",
    to: "parser.go",
    filename: "parser.go",
    hunks: [],
  },
]

const mockHunk: Hunk = mockFiles[0].hunks[0]

const mockComment: Comment = {
  id: "1",
  hunkId: "handler.go:42",
  text: "why validation here?",
  thread: [
    { role: "user", content: "why validation here?" },
    { role: "assistant", content: "To prevent malformed payloads." },
  ],
  createdAt: new Date(),
}

describe("FileList", () => {
  it("renders file names", () => {
    const output = renderToString(
      <FileList
        files={mockFiles}
        selectedIndex={0}
        onSelect={() => {}}
        commentCounts={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("handler.go")
    expect(output).toContain("parser.go")
  })

  it("renders Files header", () => {
    const output = renderToString(
      <FileList
        files={mockFiles}
        selectedIndex={0}
        onSelect={() => {}}
        commentCounts={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("Files")
  })

  it("shows comment count badges", () => {
    const counts = new Map([["handler.go", 3]])
    const output = renderToString(
      <FileList
        files={mockFiles}
        selectedIndex={0}
        onSelect={() => {}}
        commentCounts={counts}
        isFocused={false}
      />
    )
    expect(output).toContain("3●")
  })

  it("does not show badge when count is 0", () => {
    const output = renderToString(
      <FileList
        files={mockFiles}
        selectedIndex={1}
        onSelect={() => {}}
        commentCounts={new Map()}
        isFocused={false}
      />
    )
    expect(output).not.toContain("●")
  })
})

describe("DiffView", () => {
  it("renders filename and hunk count", () => {
    const output = renderToString(
      <DiffView
        filename="handler.go"
        hunks={mockFiles[0].hunks}
        selectedHunkIndex={0}
        onSelectHunk={() => {}}
        commentMarkers={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("handler.go")
    expect(output).toContain("1/1")
  })

  it("renders hunk header", () => {
    const output = renderToString(
      <DiffView
        filename="handler.go"
        hunks={mockFiles[0].hunks}
        selectedHunkIndex={0}
        onSelectHunk={() => {}}
        commentMarkers={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("func handleSync()")
  })

  it("renders diff content lines", () => {
    const output = renderToString(
      <DiffView
        filename="handler.go"
        hunks={mockFiles[0].hunks}
        selectedHunkIndex={0}
        onSelectHunk={() => {}}
        commentMarkers={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("validate(ctx)")
  })

  it("shows comment markers", () => {
    const markers = new Map([["handler.go:42", 2]])
    const output = renderToString(
      <DiffView
        filename="handler.go"
        hunks={mockFiles[0].hunks}
        selectedHunkIndex={0}
        onSelectHunk={() => {}}
        commentMarkers={markers}
        isFocused={false}
      />
    )
    expect(output).toContain("[2]")
  })

  it("shows empty state when no hunks", () => {
    const output = renderToString(
      <DiffView
        filename="empty.go"
        hunks={[]}
        selectedHunkIndex={0}
        onSelectHunk={() => {}}
        commentMarkers={new Map()}
        isFocused={false}
      />
    )
    expect(output).toContain("No hunks")
  })
})

describe("ChatPanel", () => {
  it("renders discussion title with file and line", () => {
    const output = renderToString(
      <ChatPanel
        hunk={mockHunk}
        comment={mockComment}
        streamingText=""
        isStreaming={false}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toContain("Discussion: handler.go:42")
  })

  it("renders thread messages", () => {
    const output = renderToString(
      <ChatPanel
        hunk={mockHunk}
        comment={mockComment}
        streamingText=""
        isStreaming={false}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toContain("why validation here?")
    expect(output).toContain("malformed payloads")
  })

  it("shows streaming indicator", () => {
    const output = renderToString(
      <ChatPanel
        hunk={mockHunk}
        comment={mockComment}
        streamingText="Partial response..."
        isStreaming={true}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toContain("Partial response...")
  })

  it("shows thinking state when streaming with no text", () => {
    const output = renderToString(
      <ChatPanel
        hunk={mockHunk}
        comment={mockComment}
        streamingText=""
        isStreaming={true}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toContain("Thinking...")
  })

  it("renders nothing when hunk is null", () => {
    const output = renderToString(
      <ChatPanel
        hunk={null}
        comment={null}
        streamingText=""
        isStreaming={false}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toBe("")
  })

  it("shows help bar with keybindings", () => {
    const output = renderToString(
      <ChatPanel
        hunk={mockHunk}
        comment={mockComment}
        streamingText=""
        isStreaming={false}
        isActive={false}
        onSendMessage={() => {}}
        onFix={() => {}}
        onClose={() => {}}
      />
    )
    expect(output).toContain("[enter] send")
    expect(output).toContain("[f] fix hunk")
    expect(output).toContain("[esc] close")
  })
})

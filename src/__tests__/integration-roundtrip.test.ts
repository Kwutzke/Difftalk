import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { parseDiffOutput } from "../lib/diff.js"
import {
  addComment,
  getComments,
  getAllComments,
  getCommentCountForFile,
  appendToThread,
  getLatestComment,
  restoreComments,
} from "../lib/comments.js"
import { saveSession, loadSession } from "../lib/session-store.js"
import { exportCommentsAsMarkdown } from "../lib/export.js"
import type { Comment } from "../types.js"

// Realistic unified diff fixture — each file section separated by newline
const DIFF_FIXTURE = [
  "diff --git a/src/handler.go b/src/handler.go",
  "index abc1234..def5678 100644",
  "--- a/src/handler.go",
  "+++ b/src/handler.go",
  "@@ -10,5 +10,9 @@ func HandleRequest(w http.ResponseWriter, r *http.Request) {",
  "     body := r.Body",
  "     defer body.Close()",
  " ",
  "+    if body == nil {",
  '+        http.Error(w, "empty body", http.StatusBadRequest)',
  "+        return",
  "+    }",
  "     data, err := io.ReadAll(body)",
  "     if err != nil {",
  "diff --git a/src/parser.go b/src/parser.go",
  "index 111aaaa..222bbbb 100644",
  "--- a/src/parser.go",
  "+++ b/src/parser.go",
  "@@ -1,5 +1,5 @@",
  " package main",
  " ",
  "-func Parse(input string) (Result, error) {",
  "+func Parse(input string) (*Result, error) {",
  "     tokens := tokenize(input)",
  "     return buildAST(tokens)",
].join("\n")

describe("integration: diff → comment → save → resume → export", () => {
  let tempDir: string
  // Use unique prefix per test run to avoid module-level store collisions
  const prefix = `integ-${Date.now()}`

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "difftalk-integ-"))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("full roundtrip: parse → comment → discuss → save → load → export", () => {
    // Step 1: Parse diff
    const files = parseDiffOutput(DIFF_FIXTURE)
    expect(files).toHaveLength(2)
    expect(files[0].filename).toBe("src/handler.go")
    expect(files[1].filename).toBe("src/parser.go")
    expect(files[0].hunks).toHaveLength(1)
    expect(files[1].hunks).toHaveLength(1)

    const hunk0 = files[0].hunks[0]
    const hunk1 = files[1].hunks[0]

    // Step 2: Add comments on both files
    const comment1 = addComment(hunk0.id, "needs error logging here")
    const comment2 = addComment(hunk1.id, "why pointer return type?")

    expect(getAllComments().length).toBeGreaterThanOrEqual(2)
    expect(getComments(hunk0.id).length).toBeGreaterThanOrEqual(1)
    expect(getCommentCountForFile("src/handler.go")).toBeGreaterThanOrEqual(1)
    expect(getCommentCountForFile("src/parser.go")).toBeGreaterThanOrEqual(1)

    // Step 3: Simulate multi-turn discussion
    appendToThread(comment1.id, {
      role: "assistant",
      content: "Good point. Consider using log.Error() before the http.Error call.",
    })
    appendToThread(comment1.id, {
      role: "user",
      content: "Should we also add a request ID for tracing?",
    })
    appendToThread(comment1.id, {
      role: "assistant",
      content: "Yes, extract from X-Request-ID header.",
    })

    const latest = getLatestComment(hunk0.id)
    expect(latest).toBeDefined()
    expect(latest!.thread).toHaveLength(4) // initial + 3 appended

    // Step 4: Save session with UI state
    const uiState = { selectedFileIndex: 1, selectedHunkIndex: 0 }
    const allComments = getAllComments()
    saveSession(tempDir, allComments, "HEAD~1", uiState)

    // Step 5: Load session (simulates --resume)
    const session = loadSession(tempDir)
    expect(session).not.toBeNull()
    expect(session!.ref).toBe("HEAD~1")
    expect(session!.uiState).toEqual(uiState)
    expect(session!.comments.length).toBe(allComments.length)

    // Verify thread survived serialization
    const restoredComment = session!.comments.find((c) => c.id === comment1.id)
    expect(restoredComment).toBeDefined()
    expect(restoredComment!.thread).toHaveLength(4)
    expect(restoredComment!.thread[1].role).toBe("assistant")
    expect(restoredComment!.thread[3].role).toBe("assistant")

    // Step 6: Restore into comment store
    restoreComments(session!.comments)

    // Verify restored comments are queryable
    const restoredAll = getAllComments()
    expect(restoredAll.length).toBe(session!.comments.length)

    // Step 7: Export to markdown
    const md = exportCommentsAsMarkdown(session!.comments)
    expect(md).toContain("# difftalk review")
    expect(md).toContain("## src/handler.go")
    expect(md).toContain("## src/parser.go")
    expect(md).toContain("needs error logging here")
    expect(md).toContain("why pointer return type?")
    expect(md).toContain("**Discussion:**")
    expect(md).toContain("> **You:** Should we also add a request ID")
    expect(md).toContain("> **Claude:** Yes, extract from X-Request-ID")
  })

  it("save → overwrite → load gets latest", () => {
    const comment = addComment(`${prefix}/overwrite.go:1`, "first version")
    saveSession(tempDir, [comment], "v1")

    // Overwrite with updated comment
    appendToThread(comment.id, {
      role: "assistant",
      content: "updated reply",
    })
    saveSession(tempDir, getAllComments(), "v2")

    const session = loadSession(tempDir)
    expect(session!.ref).toBe("v2")
    const saved = session!.comments.find((c) => c.id === comment.id)
    expect(saved!.thread).toHaveLength(2)
  })

  it("export with no comments produces empty message", () => {
    const md = exportCommentsAsMarkdown([])
    expect(md).toContain("No comments")
    expect(md).not.toContain("##")
  })

  it("validateRef rejects injection attempts", () => {
    // Import inline to test the exported getDiff which calls validateRef
    const { getDiff } = require("../lib/diff.js")
    expect(() => getDiff("HEAD; rm -rf /")).toThrow("Invalid git ref")
    expect(() => getDiff("HEAD`whoami`")).toThrow("Invalid git ref")
    expect(() => getDiff("$(cat /etc/passwd)")).toThrow("Invalid git ref")
    expect(() => getDiff("HEAD|cat")).toThrow("Invalid git ref")
  })

  it("diff parsing handles empty hunks gracefully", () => {
    const emptyDiff = `diff --git a/empty.txt b/empty.txt
new file mode 100644
index 0000000..e69de29
`
    const files = parseDiffOutput(emptyDiff)
    // parse-diff may return file with no chunks for empty new files
    expect(files).toBeDefined()
    expect(Array.isArray(files)).toBe(true)
  })

  it("comment IDs continue after restore", () => {
    const comments: Comment[] = [
      {
        id: "500",
        hunkId: `${prefix}/continue.go:1`,
        text: "old comment",
        thread: [{ role: "user", content: "old comment" }],
        createdAt: new Date(),
      },
    ]
    restoreComments(comments)

    const newComment = addComment(`${prefix}/continue.go:10`, "new comment")
    expect(Number(newComment.id)).toBeGreaterThan(500)
  })

  it("multi-file comment counts stay consistent through save/restore", () => {
    const p = `${prefix}/counts`
    addComment(`${p}/a.go:1`, "a1")
    addComment(`${p}/a.go:2`, "a2")
    addComment(`${p}/b.go:1`, "b1")

    const before = {
      a: getCommentCountForFile(`${p}/a.go`),
      b: getCommentCountForFile(`${p}/b.go`),
    }

    saveSession(tempDir, getAllComments())
    const session = loadSession(tempDir)!
    restoreComments(session.comments)

    const after = {
      a: getCommentCountForFile(`${p}/a.go`),
      b: getCommentCountForFile(`${p}/b.go`),
    }

    expect(after.a).toBe(before.a)
    expect(after.b).toBe(before.b)
  })
})

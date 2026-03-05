import { describe, it, expect } from "bun:test"
import { exportCommentsAsMarkdown } from "../lib/export.js"
import type { Comment } from "../types.js"

function makeComment(
  id: string,
  hunkId: string,
  text: string,
  thread?: { role: "user" | "assistant"; content: string }[]
): Comment {
  return {
    id,
    hunkId,
    text,
    thread: thread ?? [{ role: "user", content: text }],
    createdAt: new Date("2026-01-01"),
  }
}

describe("exportCommentsAsMarkdown", () => {
  it("returns header with no-comments message for empty array", () => {
    const md = exportCommentsAsMarkdown([])
    expect(md).toContain("# difftalk review")
    expect(md).toContain("No comments")
  })

  it("groups comments by file", () => {
    const comments = [
      makeComment("1", "handler.go:42", "fix validation"),
      makeComment("2", "handler.go:60", "remove dead code"),
      makeComment("3", "parser.go:10", "add tests"),
    ]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).toContain("## handler.go")
    expect(md).toContain("## parser.go")
  })

  it("includes comment text", () => {
    const comments = [makeComment("1", "file.go:1", "needs error handling")]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).toContain("**Comment:** needs error handling")
  })

  it("includes hunk location as heading", () => {
    const comments = [makeComment("1", "handler.go:42", "fix this")]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).toContain("### handler.go:42")
  })

  it("includes discussion thread when more than one message", () => {
    const comments = [
      makeComment("1", "file.go:1", "why?", [
        { role: "user", content: "why this change?" },
        { role: "assistant", content: "To handle edge cases." },
      ]),
    ]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).toContain("**Discussion:**")
    expect(md).toContain("> **You:** why this change?")
    expect(md).toContain("> **Claude:** To handle edge cases.")
  })

  it("does not show discussion section for single-message threads", () => {
    const comments = [makeComment("1", "file.go:1", "simple comment")]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).not.toContain("**Discussion:**")
  })

  it("separates comments with horizontal rules", () => {
    const comments = [
      makeComment("1", "file.go:1", "first"),
      makeComment("2", "file.go:10", "second"),
    ]
    const md = exportCommentsAsMarkdown(comments)
    expect(md).toContain("---")
  })
})

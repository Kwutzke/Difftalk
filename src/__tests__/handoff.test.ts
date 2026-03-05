import { describe, it, expect } from "bun:test"
import { buildHandoffPrompt } from "../lib/claude/handoff.js"
import type { Comment } from "../types.js"

describe("buildHandoffPrompt", () => {
  const makeComment = (
    id: string,
    hunkId: string,
    text: string,
    thread: { role: "user" | "assistant"; content: string }[] = []
  ): Comment => ({
    id,
    hunkId,
    text,
    thread: thread.length > 0 ? thread : [{ role: "user", content: text }],
    createdAt: new Date("2026-01-01"),
  })

  it("includes all comments numbered sequentially", () => {
    const comments = [
      makeComment("1", "handler.go:42", "why validation?"),
      makeComment("2", "parser.go:10", "this looks wrong"),
    ]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("[1] handler.go:42")
    expect(prompt).toContain("[2] parser.go:10")
  })

  it("includes comment text", () => {
    const comments = [makeComment("1", "file.go:1", "needs error handling")]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("Comment: needs error handling")
  })

  it("includes discussion thread", () => {
    const comments = [
      makeComment("1", "file.go:1", "why?", [
        { role: "user", content: "why this change?" },
        { role: "assistant", content: "To handle edge cases." },
        { role: "user", content: "makes sense, please fix" },
      ]),
    ]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("user: why this change?")
    expect(prompt).toContain("assistant: To handle edge cases.")
    expect(prompt).toContain("user: makes sense, please fix")
  })

  it("includes instructions for Claude Code", () => {
    const comments = [makeComment("1", "file.go:1", "fix this")]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("Implement all the changes")
    expect(prompt).toContain("separate commit")
  })

  it("separates multiple comments with dividers", () => {
    const comments = [
      makeComment("1", "a.go:1", "comment a"),
      makeComment("2", "b.go:1", "comment b"),
    ]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("---")
  })

  it("handles single comment", () => {
    const comments = [makeComment("1", "file.go:1", "solo comment")]
    const prompt = buildHandoffPrompt(comments)
    expect(prompt).toContain("[1] file.go:1")
    expect(prompt).toContain("solo comment")
    // Should not have divider for single comment
    expect(prompt).toContain("Review comments:")
  })

  it("handles empty comments array", () => {
    const prompt = buildHandoffPrompt([])
    expect(prompt).toContain("Review comments:")
    // Should still have the instruction structure
    expect(prompt).toContain("Implement all the changes")
  })
})

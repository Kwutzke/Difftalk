import { describe, it, expect, beforeEach } from "bun:test"
// We need to re-import fresh each test to reset the module-level store.
// Bun doesn't have jest.resetModules(), so we test the exported functions
// and accept that state persists across tests within a describe block.
// We'll work around this by using unique hunk IDs per test.

import {
  addComment,
  getComments,
  getAllComments,
  getCommentCountForFile,
  appendToThread,
  getLatestComment,
} from "../lib/comments.js"

describe("comments store", () => {
  // Use unique prefixes per test to avoid state leakage
  const prefix = () => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`

  it("addComment creates a comment with initial thread message", () => {
    const hunkId = `${prefix()}/file.go:10`
    const comment = addComment(hunkId, "why this change?")

    expect(comment.id).toBeTruthy()
    expect(comment.hunkId).toBe(hunkId)
    expect(comment.text).toBe("why this change?")
    expect(comment.thread).toHaveLength(1)
    expect(comment.thread[0].role).toBe("user")
    expect(comment.thread[0].content).toBe("why this change?")
    expect(comment.createdAt).toBeInstanceOf(Date)
  })

  it("getComments returns comments for a hunk", () => {
    const hunkId = `${prefix()}/file.go:20`
    addComment(hunkId, "comment 1")
    addComment(hunkId, "comment 2")

    const comments = getComments(hunkId)
    expect(comments).toHaveLength(2)
    expect(comments[0].text).toBe("comment 1")
    expect(comments[1].text).toBe("comment 2")
  })

  it("getComments returns empty array for unknown hunk", () => {
    const comments = getComments(`${prefix()}/nonexistent:999`)
    expect(comments).toHaveLength(0)
  })

  it("getAllComments returns all comments across hunks", () => {
    const id1 = `${prefix()}/a.go:1`
    const id2 = `${prefix()}/b.go:1`
    const before = getAllComments().length

    addComment(id1, "comment a")
    addComment(id2, "comment b")

    const all = getAllComments()
    expect(all.length).toBe(before + 2)
  })

  it("getCommentCountForFile counts comments across hunks of same file", () => {
    const file = `${prefix()}/handler.go`
    addComment(`${file}:10`, "first")
    addComment(`${file}:20`, "second")
    addComment(`${file}:20`, "third")

    const count = getCommentCountForFile(`${file}`)
    expect(count).toBe(3)
  })

  it("getCommentCountForFile returns 0 for file with no comments", () => {
    const count = getCommentCountForFile(`${prefix()}/nocomments.go`)
    expect(count).toBe(0)
  })

  it("appendToThread adds a message to existing comment", () => {
    const hunkId = `${prefix()}/file.go:30`
    const comment = addComment(hunkId, "question?")

    appendToThread(comment.id, {
      role: "assistant",
      content: "Here is the answer.",
    })

    const updated = getComments(hunkId)
    expect(updated[0].thread).toHaveLength(2)
    expect(updated[0].thread[1].role).toBe("assistant")
    expect(updated[0].thread[1].content).toBe("Here is the answer.")
  })

  it("appendToThread is a no-op for nonexistent comment ID", () => {
    // Should not throw
    appendToThread("nonexistent-id-999", {
      role: "user",
      content: "orphan message",
    })
  })

  it("getLatestComment returns the most recent comment for a hunk", () => {
    const hunkId = `${prefix()}/file.go:40`
    addComment(hunkId, "first comment")
    addComment(hunkId, "second comment")

    const latest = getLatestComment(hunkId)
    expect(latest).toBeTruthy()
    expect(latest!.text).toBe("second comment")
  })

  it("getLatestComment returns undefined for hunk with no comments", () => {
    const latest = getLatestComment(`${prefix()}/empty:1`)
    expect(latest).toBeUndefined()
  })

  it("each comment gets a unique ID", () => {
    const hunkId = `${prefix()}/file.go:50`
    const c1 = addComment(hunkId, "a")
    const c2 = addComment(hunkId, "b")
    expect(c1.id).not.toBe(c2.id)
  })
})

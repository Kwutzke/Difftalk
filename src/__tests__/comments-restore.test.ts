import { describe, it, expect } from "bun:test"
import {
  addComment,
  getComments,
  getAllComments,
  restoreComments,
} from "../lib/comments.js"
import type { Comment } from "../types.js"

describe("restoreComments", () => {
  const prefix = () =>
    `restore-${Date.now()}-${Math.random().toString(36).slice(2)}`

  it("restores comments into the store", () => {
    const hunkId = `${prefix()}/file.go:10`
    const comments: Comment[] = [
      {
        id: "100",
        hunkId,
        text: "restored comment",
        thread: [{ role: "user", content: "restored comment" }],
        createdAt: new Date(),
      },
    ]

    restoreComments(comments)

    const result = getComments(hunkId)
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe("restored comment")
    expect(result[0].id).toBe("100")
  })

  it("new comments after restore get higher IDs", () => {
    const hunkId = `${prefix()}/file.go:20`
    restoreComments([
      {
        id: "50",
        hunkId,
        text: "old",
        thread: [{ role: "user", content: "old" }],
        createdAt: new Date(),
      },
    ])

    const newComment = addComment(`${prefix()}/file.go:30`, "new comment")
    expect(Number(newComment.id)).toBeGreaterThan(50)
  })

  it("restores multiple comments across different hunks", () => {
    const p = prefix()
    const comments: Comment[] = [
      {
        id: "200",
        hunkId: `${p}/a.go:1`,
        text: "a",
        thread: [{ role: "user", content: "a" }],
        createdAt: new Date(),
      },
      {
        id: "201",
        hunkId: `${p}/b.go:1`,
        text: "b",
        thread: [{ role: "user", content: "b" }],
        createdAt: new Date(),
      },
    ]

    restoreComments(comments)

    expect(getComments(`${p}/a.go:1`)).toHaveLength(1)
    expect(getComments(`${p}/b.go:1`)).toHaveLength(1)
  })
})

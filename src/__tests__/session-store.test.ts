import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  saveSession,
  loadSession,
  hasSession,
  clearSession,
} from "../lib/session-store.js"
import type { Comment } from "../types.js"

describe("session-store", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "difftalk-test-"))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  const makeComment = (id: string, hunkId: string, text: string): Comment => ({
    id,
    hunkId,
    text,
    thread: [{ role: "user", content: text }],
    createdAt: new Date("2026-01-15T10:30:00Z"),
  })

  it("hasSession returns false when no session exists", () => {
    expect(hasSession(tempDir)).toBe(false)
  })

  it("saveSession creates session file", () => {
    const comments = [makeComment("1", "file.go:10", "fix this")]
    saveSession(tempDir, comments, "HEAD~1")
    expect(hasSession(tempDir)).toBe(true)
  })

  it("loadSession restores saved comments", () => {
    const comments = [
      makeComment("1", "file.go:10", "fix this"),
      makeComment("2", "file.go:20", "remove this"),
    ]
    saveSession(tempDir, comments, "abc123")

    const session = loadSession(tempDir)
    expect(session).not.toBeNull()
    expect(session!.comments).toHaveLength(2)
    expect(session!.comments[0].text).toBe("fix this")
    expect(session!.comments[1].text).toBe("remove this")
    expect(session!.ref).toBe("abc123")
  })

  it("loadSession restores Date objects", () => {
    const comments = [makeComment("1", "file.go:10", "test")]
    saveSession(tempDir, comments)

    const session = loadSession(tempDir)
    expect(session!.comments[0].createdAt).toBeInstanceOf(Date)
    expect(session!.comments[0].createdAt.toISOString()).toBe("2026-01-15T10:30:00.000Z")
  })

  it("loadSession preserves thread messages", () => {
    const comment: Comment = {
      id: "1",
      hunkId: "file.go:10",
      text: "why?",
      thread: [
        { role: "user", content: "why?" },
        { role: "assistant", content: "because..." },
      ],
      createdAt: new Date(),
    }
    saveSession(tempDir, [comment])

    const session = loadSession(tempDir)
    expect(session!.comments[0].thread).toHaveLength(2)
    expect(session!.comments[0].thread[1].role).toBe("assistant")
  })

  it("loadSession returns null when no session exists", () => {
    expect(loadSession(tempDir)).toBeNull()
  })

  it("clearSession removes the session file", () => {
    saveSession(tempDir, [makeComment("1", "f:1", "x")])
    expect(hasSession(tempDir)).toBe(true)
    clearSession(tempDir)
    expect(hasSession(tempDir)).toBe(false)
  })

  it("clearSession is safe when no session exists", () => {
    expect(() => clearSession(tempDir)).not.toThrow()
  })

  it("saveSession includes savedAt timestamp", () => {
    saveSession(tempDir, [makeComment("1", "f:1", "x")])
    const session = loadSession(tempDir)
    expect(session!.savedAt).toBeTruthy()
    // Should be a valid ISO date
    expect(new Date(session!.savedAt).toISOString()).toBe(session!.savedAt)
  })

  it("saveSession with no ref stores undefined", () => {
    saveSession(tempDir, [makeComment("1", "f:1", "x")])
    const session = loadSession(tempDir)
    expect(session!.ref).toBeUndefined()
  })
})

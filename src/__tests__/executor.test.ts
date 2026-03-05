import { describe, it, expect } from "bun:test"
// executor.ts imports the Claude Agent SDK which we can't run in tests
// without a real API key. We test the module structure and ensure it exports
// the expected function signature. The actual SDK call is tested via
// integration testing.

describe("executor module", () => {
  it("exports fixHunk function", async () => {
    const mod = await import("../lib/claude/executor.js")
    expect(typeof mod.fixHunk).toBe("function")
  })

  it("fixHunk has correct parameter count", async () => {
    const mod = await import("../lib/claude/executor.js")
    // function(hunk, comment, cwd, onChunk, abortController?)
    expect(mod.fixHunk.length).toBe(5) // hunk, comment, cwd, onChunk, abortController
  })
})

describe("session module", () => {
  it("exports askAboutHunk function", async () => {
    const mod = await import("../lib/claude/session.js")
    expect(typeof mod.askAboutHunk).toBe("function")
  })

  it("askAboutHunk has correct parameter count", async () => {
    const mod = await import("../lib/claude/session.js")
    // function(hunk, comment, userMessage, onChunk, abortController?)
    expect(mod.askAboutHunk.length).toBe(5) // hunk, comment, userMessage, onChunk, abortController
  })
})

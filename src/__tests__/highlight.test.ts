import { describe, it, expect } from "bun:test"
import { plainAnsi } from "../lib/highlight.js"

describe("plainAnsi", () => {
  it("colors added lines green", () => {
    const result = plainAnsi("+added line")
    expect(result).toContain("\x1b[32m")
    expect(result).toContain("+added line")
    expect(result).toContain("\x1b[0m")
  })

  it("colors removed lines red", () => {
    const result = plainAnsi("-removed line")
    expect(result).toContain("\x1b[31m")
    expect(result).toContain("-removed line")
    expect(result).toContain("\x1b[0m")
  })

  it("colors hunk headers cyan", () => {
    const result = plainAnsi("@@ -1,3 +1,4 @@ func main()")
    expect(result).toContain("\x1b[36m")
    expect(result).toContain("@@ -1,3 +1,4 @@")
    expect(result).toContain("\x1b[0m")
  })

  it("leaves context lines uncolored", () => {
    const result = plainAnsi(" context line")
    expect(result).toBe(" context line")
    expect(result).not.toContain("\x1b[")
  })

  it("handles multi-line input", () => {
    const input = [
      "@@ -1,3 +1,4 @@",
      " context",
      "-old",
      "+new",
      " more context",
    ].join("\n")
    const result = plainAnsi(input)
    const lines = result.split("\n")
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain("\x1b[36m") // cyan header
    expect(lines[1]).toBe(" context") // plain context
    expect(lines[2]).toContain("\x1b[31m") // red removed
    expect(lines[3]).toContain("\x1b[32m") // green added
    expect(lines[4]).toBe(" more context") // plain context
  })

  it("handles empty input", () => {
    const result = plainAnsi("")
    expect(result).toBe("")
  })
})

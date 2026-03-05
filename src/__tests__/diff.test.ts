import { describe, it, expect } from "bun:test"
import { parseDiffOutput } from "../lib/diff.js"

const sampleDiff = `diff --git a/src/handler.go b/src/handler.go
index 1234567..abcdefg 100644
--- a/src/handler.go
+++ b/src/handler.go
@@ -42,6 +42,8 @@ func handleSync() error {
   existing := getHandler()
   if existing == nil {
     return nil
+  if err := validate(ctx); err != nil {
+    return fmt.Errorf("invalid: %w", err)
   }
   return existing.Process()
 }
@@ -100,3 +102,4 @@ func cleanup() {
   defer mu.Unlock()
   handlers = nil
+  log.Info("cleanup complete")
 }
`

const newFileDiff = `diff --git a/newfile.txt b/newfile.txt
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/newfile.txt
@@ -0,0 +1,3 @@
+line one
+line two
+line three
`

const multiFileDiff = `diff --git a/a.txt b/a.txt
index 1111111..2222222 100644
--- a/a.txt
+++ b/a.txt
@@ -1,3 +1,4 @@
 hello
+world
 foo
 bar
diff --git a/b.txt b/b.txt
index 3333333..4444444 100644
--- a/b.txt
+++ b/b.txt
@@ -1,2 +1,2 @@
-old line
+new line
 unchanged
`

describe("parseDiffOutput", () => {
  it("parses a single file with multiple hunks", () => {
    const files = parseDiffOutput(sampleDiff)
    expect(files).toHaveLength(1)
    expect(files[0].filename).toBe("src/handler.go")
    expect(files[0].hunks).toHaveLength(2)
  })

  it("extracts correct hunk IDs", () => {
    const files = parseDiffOutput(sampleDiff)
    const hunks = files[0].hunks
    expect(hunks[0].id).toBe("src/handler.go:42")
    expect(hunks[1].id).toBe("src/handler.go:102")
  })

  it("extracts hunk headers", () => {
    const files = parseDiffOutput(sampleDiff)
    expect(files[0].hunks[0].header).toContain("func handleSync()")
    expect(files[0].hunks[1].header).toContain("func cleanup()")
  })

  it("preserves +/- prefixes in content lines", () => {
    const files = parseDiffOutput(sampleDiff)
    const content = files[0].hunks[0].content
    expect(content).toContain("+  if err := validate(ctx)")
    expect(content).toContain(" existing := getHandler()")
  })

  it("builds context including header and lines", () => {
    const files = parseDiffOutput(sampleDiff)
    const ctx = files[0].hunks[0].context
    expect(ctx).toContain("func handleSync()")
    expect(ctx).toContain("+  if err := validate(ctx)")
  })

  it("sets correct start and end lines", () => {
    const files = parseDiffOutput(sampleDiff)
    const hunk = files[0].hunks[0]
    expect(hunk.startLine).toBe(42)
    expect(hunk.file).toBe("src/handler.go")
  })

  it("handles new file diffs", () => {
    const files = parseDiffOutput(newFileDiff)
    expect(files).toHaveLength(1)
    expect(files[0].filename).toBe("newfile.txt")
    expect(files[0].from).toBe("/dev/null")
    expect(files[0].hunks).toHaveLength(1)
    expect(files[0].hunks[0].content).toContain("+line one")
  })

  it("parses multiple files", () => {
    const files = parseDiffOutput(multiFileDiff)
    expect(files).toHaveLength(2)
    expect(files[0].filename).toBe("a.txt")
    expect(files[1].filename).toBe("b.txt")
  })

  it("handles added and removed lines in multi-file diff", () => {
    const files = parseDiffOutput(multiFileDiff)
    const bContent = files[1].hunks[0].content
    expect(bContent).toContain("-old line")
    expect(bContent).toContain("+new line")
  })

  it("returns empty array for empty input", () => {
    const files = parseDiffOutput("")
    expect(files).toHaveLength(0)
  })
})

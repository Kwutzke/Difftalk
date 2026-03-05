import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { execSync } from "node:child_process"
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

// Project root for resolving tsx and the entry point
const PROJECT_ROOT = join(__dirname, "..", "..")

// Helper to run difftalk CLI in a subprocess
function run(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {}
): { stdout: string; stderr: string; exitCode: number } {
  const entryPoint = join(PROJECT_ROOT, "src", "index.tsx")
  const tsxBin = join(PROJECT_ROOT, "node_modules", ".bin", "tsx")
  // Shell-escape each arg to prevent metacharacter interpretation
  const escaped = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`)
  const cmd = `${tsxBin} ${entryPoint} ${escaped.join(" ")} 2>&1`
  try {
    const output = execSync(cmd, {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf-8",
      env: { ...process.env, ...opts.env },
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    })
    return { stdout: output, stderr: output, exitCode: 0 }
  } catch (err: unknown) {
    const e = err as {
      stdout?: string
      stderr?: string
      status?: number
    }
    const output = e.stdout ?? e.stderr ?? ""
    return {
      stdout: output,
      stderr: output,
      exitCode: e.status ?? 1,
    }
  }
}

describe("integration: CLI", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "difftalk-cli-"))
    // Create a minimal git repo
    execSync("git init", {
      cwd: tempDir,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@test.com",
      },
    })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("exits 0 with no unstaged changes", () => {
    // No changes in fresh repo → empty diff → exit 0
    const result = run([], { cwd: tempDir })
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toContain("No unstaged changes")
  })

  it("exits 1 with invalid ref", () => {
    const result = run(["NONEXISTENT_REF_abc123"], { cwd: tempDir })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("Failed to get diff")
  })

  it("rejects refs with shell metacharacters", () => {
    const result = run(["HEAD;whoami"], { cwd: tempDir })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("Invalid git ref")
  })

  it("--export fails with no saved session", () => {
    const exportFile = join(tempDir, "review.md")
    const result = run(["--export", exportFile], { cwd: tempDir })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("No saved session to export")
  })

  it("--export writes markdown when session exists", () => {
    // Create a fake session file
    const sessionDir = join(tempDir, ".difftalk")
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(
      join(sessionDir, "session.json"),
      JSON.stringify({
        ref: "HEAD~1",
        comments: [
          {
            id: "1",
            hunkId: "file.go:10",
            text: "fix this",
            thread: [{ role: "user", content: "fix this" }],
            createdAt: new Date().toISOString(),
          },
        ],
        savedAt: new Date().toISOString(),
        uiState: { selectedFileIndex: 0, selectedHunkIndex: 0 },
      }),
      "utf-8"
    )

    const exportFile = join(tempDir, "review.md")
    const result = run(["--export", exportFile], { cwd: tempDir })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Exported 1 comments")

    const md = readFileSync(exportFile, "utf-8")
    expect(md).toContain("# difftalk review")
    expect(md).toContain("fix this")
    expect(md).toContain("## file.go")
  })

  it("--resume fails with no saved session", () => {
    const result = run(["--resume"], { cwd: tempDir })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("No saved session found")
  })

  it("--export defaults filename when none given", () => {
    // --export with no following arg should use default name
    const sessionDir = join(tempDir, ".difftalk")
    mkdirSync(sessionDir, { recursive: true })
    writeFileSync(
      join(sessionDir, "session.json"),
      JSON.stringify({
        comments: [
          {
            id: "1",
            hunkId: "x.go:1",
            text: "test",
            thread: [{ role: "user", content: "test" }],
            createdAt: new Date().toISOString(),
          },
        ],
        savedAt: new Date().toISOString(),
      }),
      "utf-8"
    )

    const result = run(["--export"], { cwd: tempDir })
    expect(result.exitCode).toBe(0)
    // Default export file is "difftalk-review.md"
    const defaultFile = join(tempDir, "difftalk-review.md")
    expect(existsSync(defaultFile)).toBe(true)
  })

  it("shows diff for a real commit", () => {
    // Create a file, commit, then modify → use commit ref
    writeFileSync(join(tempDir, "hello.txt"), "hello\n", "utf-8")
    execSync("git add . && git -c commit.gpgsign=false commit -m 'init'", {
      cwd: tempDir,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@test.com",
      },
    })
    writeFileSync(join(tempDir, "hello.txt"), "hello world\n", "utf-8")
    execSync("git add . && git -c commit.gpgsign=false commit -m 'update'", {
      cwd: tempDir,
      stdio: "ignore",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@test.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@test.com",
      },
    })

    // Running with HEAD should attempt to render TUI (which will exit
    // since stdin is /dev/null), but shouldn't crash
    const result = run(["HEAD"], { cwd: tempDir })
    // May exit 0 (rendered) or non-zero (TUI can't attach) — the
    // key assertion is it doesn't crash with "Failed to get diff"
    expect(result.stderr).not.toContain("Failed to get diff")
  })
})

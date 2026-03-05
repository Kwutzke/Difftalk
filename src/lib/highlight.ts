import { execSync, spawnSync } from "node:child_process"

let batCmd: string | null = null
let batChecked = false
let forcePlain = false

export function setHighlighterMode(mode: "bat" | "plain" | undefined): void {
  if (mode === "plain") forcePlain = true
}

function checkBatAvailable(): string | null {
  if (forcePlain) return null
  if (batChecked) return batCmd
  batChecked = true
  for (const cmd of ["bat", "batcat"]) {
    try {
      execSync(`which ${cmd}`, { stdio: "ignore" })
      batCmd = cmd
      return batCmd
    } catch {
      // not found
    }
  }
  return null
}

export function highlight(content: string, filename: string): string {
  const cmd = checkBatAvailable()
  if (!cmd) return plainAnsi(content)

  const ext = filename.split(".").pop() ?? "txt"
  try {
    const result = spawnSync(
      cmd,
      ["--color=always", "--style=plain", "--language", ext],
      { input: content, encoding: "utf-8", timeout: 5000 }
    )
    if (result.status === 0 && result.stdout) return result.stdout
  } catch {
    // fallback
  }
  return plainAnsi(content)
}

export function plainAnsi(content: string): string {
  return content
    .split("\n")
    .map((line) => {
      if (line.startsWith("@@")) return `\x1b[36m${line}\x1b[0m`
      if (line.startsWith("+")) return `\x1b[32m${line}\x1b[0m`
      if (line.startsWith("-")) return `\x1b[31m${line}\x1b[0m`
      return line
    })
    .join("\n")
}

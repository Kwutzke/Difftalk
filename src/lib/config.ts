import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

export interface DifftalkConfig {
  defaultRef?: string
  highlighter?: "bat" | "plain"
  claudeModel?: string
  maxTurns?: number
}

const CONFIG_PATH = join(homedir(), ".config", "difftalk", "config.toml")

export function loadConfig(): DifftalkConfig {
  if (!existsSync(CONFIG_PATH)) return {}

  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8")
    return parseSimpleToml(raw)
  } catch {
    return {}
  }
}

// Minimal TOML parser for flat key=value config
// Supports: strings (quoted), numbers, booleans
function parseSimpleToml(raw: string): DifftalkConfig {
  const config: Record<string, string | number | boolean> = {}

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("[")) continue

    const eqIndex = trimmed.indexOf("=")
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value: string | number | boolean = trimmed.slice(eqIndex + 1).trim()

    // Strip inline comments
    const commentIdx = value.indexOf(" #")
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim()

    // Parse value type
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      config[key] = value.slice(1, -1)
    } else if (value === "true") {
      config[key] = true
    } else if (value === "false") {
      config[key] = false
    } else if (!isNaN(Number(value))) {
      config[key] = Number(value)
    } else {
      config[key] = value
    }
  }

  return {
    defaultRef: config["default_ref"] as string | undefined,
    highlighter: config["highlighter"] as "bat" | "plain" | undefined,
    claudeModel: config["claude_model"] as string | undefined,
    maxTurns: config["max_turns"] as number | undefined,
  }
}

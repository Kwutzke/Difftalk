import { describe, it, expect } from "bun:test"
// We can't easily test loadConfig() since it reads from ~/.config/difftalk/config.toml
// Instead we test the parsing logic by importing and calling the module,
// and verify the default behavior (empty config when no file exists).

import { loadConfig } from "../lib/config.js"

describe("loadConfig", () => {
  it("returns empty config when no config file exists", () => {
    const config = loadConfig()
    expect(config).toBeDefined()
    expect(config.defaultRef).toBeUndefined()
    expect(config.highlighter).toBeUndefined()
    expect(config.claudeModel).toBeUndefined()
    expect(config.maxTurns).toBeUndefined()
  })

  it("returns an object with expected shape", () => {
    const config = loadConfig()
    const keys = Object.keys(config)
    // Should only have known keys (or be empty)
    for (const key of keys) {
      expect(["defaultRef", "highlighter", "claudeModel", "maxTurns"]).toContain(
        key
      )
    }
  })
})

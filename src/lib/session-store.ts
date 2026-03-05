import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { Comment } from "../types.js"

interface SessionData {
  ref?: string
  comments: Comment[]
  savedAt: string
}

function getSessionDir(cwd: string): string {
  return join(cwd, ".difftalk")
}

function getSessionFile(cwd: string): string {
  return join(getSessionDir(cwd), "session.json")
}

export function saveSession(
  cwd: string,
  comments: Comment[],
  ref?: string
): void {
  const dir = getSessionDir(cwd)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const data: SessionData = {
    ref,
    comments,
    savedAt: new Date().toISOString(),
  }

  writeFileSync(getSessionFile(cwd), JSON.stringify(data, null, 2), "utf-8")
}

export function loadSession(cwd: string): SessionData | null {
  const file = getSessionFile(cwd)
  if (!existsSync(file)) return null

  try {
    const raw = readFileSync(file, "utf-8")
    const data = JSON.parse(raw) as SessionData
    // Restore Date objects
    data.comments = data.comments.map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
    }))
    return data
  } catch {
    return null
  }
}

export function hasSession(cwd: string): boolean {
  return existsSync(getSessionFile(cwd))
}

export function clearSession(cwd: string): void {
  const file = getSessionFile(cwd)
  if (existsSync(file)) {
    const { unlinkSync } = require("node:fs")
    unlinkSync(file)
  }
}

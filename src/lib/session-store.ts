import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs"
import { join } from "node:path"
import type { Comment } from "../types.js"

export interface UIState {
  selectedFileIndex: number
  selectedHunkIndex: number
}

export interface SessionData {
  ref?: string
  comments: Comment[]
  savedAt: string
  uiState?: UIState
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
  ref?: string,
  uiState?: UIState
): void {
  const dir = getSessionDir(cwd)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const data: SessionData = {
    ref,
    comments,
    savedAt: new Date().toISOString(),
    uiState,
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
    unlinkSync(file)
  }
}

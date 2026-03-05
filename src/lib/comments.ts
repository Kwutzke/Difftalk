import type { Comment, Message } from "../types.js"

let nextId = 1
const store = new Map<string, Comment[]>()
const fileCountCache = new Map<string, number>()

function extractFile(hunkId: string): string {
  return hunkId.split(":")[0]
}

function incrementFileCount(hunkId: string): void {
  const file = extractFile(hunkId)
  fileCountCache.set(file, (fileCountCache.get(file) ?? 0) + 1)
}

export function addComment(hunkId: string, text: string): Comment {
  const comment: Comment = {
    id: String(nextId++),
    hunkId,
    text,
    thread: [{ role: "user", content: text }],
    createdAt: new Date(),
  }
  const existing = store.get(hunkId) ?? []
  existing.push(comment)
  store.set(hunkId, existing)
  incrementFileCount(hunkId)
  return comment
}

export function getComments(hunkId: string): Comment[] {
  return store.get(hunkId) ?? []
}

export function getAllComments(): Comment[] {
  const all: Comment[] = []
  for (const comments of store.values()) {
    all.push(...comments)
  }
  return all
}

export function getCommentCountForFile(filename: string): number {
  return fileCountCache.get(filename) ?? 0
}

export function appendToThread(commentId: string, message: Message): void {
  for (const comments of store.values()) {
    const comment = comments.find((c) => c.id === commentId)
    if (comment) {
      comment.thread.push(message)
      return
    }
  }
}

export function getLatestComment(hunkId: string): Comment | undefined {
  const comments = store.get(hunkId)
  if (!comments || comments.length === 0) return undefined
  return comments[comments.length - 1]
}

export function restoreComments(comments: Comment[]): void {
  store.clear()
  fileCountCache.clear()
  let maxId = 0
  for (const comment of comments) {
    const existing = store.get(comment.hunkId) ?? []
    existing.push(comment)
    store.set(comment.hunkId, existing)
    incrementFileCount(comment.hunkId)
    const numId = Number(comment.id)
    if (!isNaN(numId) && numId > maxId) maxId = numId
  }
  nextId = maxId + 1
}

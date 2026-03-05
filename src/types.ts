export interface DiffFile {
  from: string
  to: string
  filename: string
  hunks: Hunk[]
}

export interface Hunk {
  id: string // "file:startLine"
  file: string
  startLine: number
  endLine: number
  content: string // raw unified diff hunk
  context: string // surrounding lines for Claude context
  header: string // @@ line
}

export interface Message {
  role: "user" | "assistant"
  content: string
}

export interface Comment {
  id: string
  hunkId: string
  text: string
  thread: Message[]
  createdAt: Date
}

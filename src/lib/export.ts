import type { Comment } from "../types.js"

export function exportCommentsAsMarkdown(comments: Comment[]): string {
  if (comments.length === 0) return "# difftalk review\n\nNo comments.\n"

  const lines: string[] = ["# difftalk review", ""]

  // Group by file
  const byFile = new Map<string, Comment[]>()
  for (const comment of comments) {
    const file = comment.hunkId.split(":")[0]
    const existing = byFile.get(file) ?? []
    existing.push(comment)
    byFile.set(file, existing)
  }

  for (const [file, fileComments] of byFile) {
    lines.push(`## ${file}`, "")

    for (const comment of fileComments) {
      const location = comment.hunkId
      lines.push(`### ${location}`, "")
      lines.push(`**Comment:** ${comment.text}`, "")

      if (comment.thread.length > 1) {
        lines.push("**Discussion:**", "")
        for (const msg of comment.thread) {
          const role = msg.role === "user" ? "You" : "Claude"
          lines.push(`> **${role}:** ${msg.content}`, "")
        }
      }

      lines.push("---", "")
    }
  }

  return lines.join("\n")
}

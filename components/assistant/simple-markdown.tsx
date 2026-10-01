// Minimal, safe Markdown for answer text: paragraphs, "- " bullets,
// "1. " numbered lists and **bold**. No HTML is ever injected.

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  )
}

type Block = { kind: "p"; lines: string[] } | { kind: "ul"; items: string[] } | { kind: "ol"; items: string[] }

export function SimpleMarkdown({ text }: { text: string }) {
  const blocks: Block[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    const last = blocks.at(-1)
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    if (!line) {
      blocks.push({ kind: "p", lines: [] })
    } else if (bullet) {
      if (last?.kind === "ul") last.items.push(bullet[1])
      else blocks.push({ kind: "ul", items: [bullet[1]] })
    } else if (numbered) {
      if (last?.kind === "ol") last.items.push(numbered[1])
      else blocks.push({ kind: "ol", items: [numbered[1]] })
    } else if (last?.kind === "p") {
      last.lines.push(line)
    } else {
      blocks.push({ kind: "p", lines: [line] })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => {
        if (b.kind === "ul")
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted-foreground">
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </ul>
          )
        if (b.kind === "ol")
          return (
            <ol key={i} className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground">
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </ol>
          )
        return b.lines.length ? <p key={i}>{inline(b.lines.join(" "))}</p> : null
      })}
    </div>
  )
}

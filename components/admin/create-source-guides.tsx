"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { Library, LoaderCircle } from "lucide-react"
import { generateSourceGuides } from "@/app/admin/knowledge/actions"
import { Button } from "@/components/ui/button"

export function CreateSourceGuides({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  return (
    <div className="mt-6 flex flex-col items-start gap-3 rounded-lg border bg-background p-5">
      <div>
        <h2 className="font-semibold">Create guides from this source</h2>
        <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">Reuse the extracted sections below. Matching topics are merged, and existing guides are skipped. Every new guide starts as a draft for review.</p>
      </div>
      <Button size="lg" disabled={pending} onClick={() => startTransition(async () => {
        setMessage(null)
        try {
          const result = await generateSourceGuides(documentId)
          setMessage(result.ok
            ? { error: false, text: `${result.created} draft ${result.created === 1 ? "guide" : "guides"} created. ${result.skipped} existing ${result.skipped === 1 ? "topic" : "topics"} skipped.` }
            : { error: true, text: result.error })
        } catch { setMessage({ error: true, text: "Guide creation was interrupted. Check the Knowledge Base before retrying; saved topics will be skipped." }) }
      })}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Library aria-hidden="true" />}
        {pending ? "Creating draft guides…" : "Create Knowledge Base guides"}
      </Button>
      {message && <p role={message.error ? "alert" : "status"} className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}
      {message && <Link href={`/admin/knowledge?source=${documentId}`} className="text-sm font-medium text-primary underline">Review source guides</Link>}
    </div>
  )
}

"use client"

import { ChevronRight, FileUp, PenLine, Plus } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { SourceUploader } from "@/components/admin/source-uploader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import type { UploadSourceType } from "@/lib/sources"

const optionClass =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left outline-none transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/50"

/**
 * "+ Add source" for a collection: choose Upload PDF (the upload modal) or Create
 * text source (its own page). Both create a source in the same collection.
 */
export function AddSourceButton({ collectionId, collectionType }: { collectionId: string | null; collectionType: UploadSourceType | null }) {
  const [choosing, setChoosing] = useState(false)
  const [uploading, setUploading] = useState(false)

  return (
    <>
      <Dialog open={choosing} onOpenChange={setChoosing}>
        <DialogTrigger render={<Button size="lg" />}>
          <Plus aria-hidden="true" />
          Add source
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add source</DialogTitle>
            <DialogDescription className="sr-only">Choose how to add a source to this collection.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <button type="button" className={optionClass} onClick={() => { setChoosing(false); setUploading(true) }}>
              <FileUp className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Upload PDF</span>
                <span className="block text-sm text-muted-foreground">Upload an official PDF and let Campus Agent extract knowledge for review.</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <Link href={`/admin/knowledge/new${collectionId ? `?collection=${collectionId}` : ""}`} className={optionClass} onClick={() => setChoosing(false)}>
              <PenLine className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Create text source</span>
                <span className="block text-sm text-muted-foreground">Write or paste verified information manually.</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        </DialogContent>
      </Dialog>
      <SourceUploader collectionId={collectionId} collectionType={collectionType} open={uploading} onOpenChange={setUploading} />
    </>
  )
}

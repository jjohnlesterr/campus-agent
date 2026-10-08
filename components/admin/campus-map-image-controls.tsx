"use client"

import { FileUp, LoaderCircle, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { discardCampusMapUpload, removeCampusMapImage, setCampusMapImage } from "@/app/admin/campus-map/map-image-actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"

const MAX_MAP_BYTES = 15 * 1024 * 1024
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" }

/**
 * Upload / Replace / Remove the campus map image. The image is stored for the Campus Map
 * module only — it never becomes a Knowledge Library source — and changing it never
 * touches buildings, offices or the legend.
 */
export function CampusMapImageControls({ hasMap }: { hasMap: boolean }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  function upload(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    const ext = TYPES[file.type]
    if (!ext) return setMessage({ error: true, text: "Choose a PNG, JPG or WebP image of the campus map." })
    if (file.size === 0 || file.size > MAX_MAP_BYTES) return setMessage({ error: true, text: "The map image must be under 15 MB." })
    setMessage(null)
    startTransition(async () => {
      const filePath = `campus-map/${crypto.randomUUID()}.${ext}`
      try {
        const { error } = await createClient().storage.from("documents").upload(filePath, file, { contentType: file.type === "image/jpg" ? "image/jpeg" : file.type, upsert: false })
        if (error) return setMessage({ error: true, text: "The image could not be uploaded. Please try again." })
        const result = await setCampusMapImage({ filePath, fileSize: file.size })
        if (!result.ok) return setMessage({ error: true, text: result.error })
        setMessage({ error: false, text: hasMap ? "Map replaced. Buildings, offices and the legend are unchanged." : "Map uploaded." })
        router.refresh()
      } catch {
        await discardCampusMapUpload(filePath).catch(() => {})
        setMessage({ error: true, text: "The upload could not be completed. The current map is unchanged." })
      }
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await removeCampusMapImage()
      setConfirmRemove(false)
      if (!result.ok) return setMessage({ error: true, text: result.error })
      setMessage({ error: false, text: "Map image removed. Buildings, offices and the legend are unchanged." })
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files?.[0])} />
      <Button variant={hasMap ? "outline" : "default"} size={hasMap ? "default" : "lg"} disabled={pending} onClick={() => inputRef.current?.click()}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : hasMap ? <FileUp aria-hidden="true" /> : <Upload aria-hidden="true" />}
        {pending ? "Saving…" : hasMap ? "Replace map" : "Upload map"}
      </Button>
      {hasMap && (
        <Button variant="ghost" disabled={pending} onClick={() => setConfirmRemove(true)}>
          <Trash2 aria-hidden="true" />
          Remove map
        </Button>
      )}
      {message && <p role={message.error ? "alert" : "status"} className={`basis-full text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}

      <Dialog open={confirmRemove} onOpenChange={(open) => { if (!pending) setConfirmRemove(open) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Remove the campus map image?</DialogTitle>
            <DialogDescription>
              Only the picture is removed. Buildings, offices and the legend stay, and Campus Agent keeps answering location questions from them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirmRemove(false)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending} onClick={remove}>{pending ? "Removing…" : "Remove map"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

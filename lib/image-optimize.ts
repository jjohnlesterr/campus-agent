// Client-side image optimization before upload (browser only: canvas + createImageBitmap).
// Large images are scaled down to fit `maxDimension` (aspect ratio kept, never upscaled)
// and re-encoded until they are under `maxBytes`. WebP keeps PNG transparency; browsers
// that can't encode WebP fall back to PNG (transparent sources) or JPEG.

import { detectMimeType } from "@/lib/sources"

export type OptimizeResult = { ok: true; file: File; type: string } | { ok: false; error: string }

const SUPPORTED = ["image/png", "image/jpeg", "image/webp"]

function encode(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function optimizeImage(file: File, { maxDimension = 1024, maxBytes = 1024 * 1024 }: { maxDimension?: number; maxBytes?: number } = {}): Promise<OptimizeResult> {
  // The real type, from the file's first bytes (never the extension or the browser's guess).
  const type = detectMimeType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))
  if (!type || !SUPPORTED.includes(type)) return { ok: false, error: "Choose a PNG, JPG or WebP image." }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return { ok: false, error: "This image couldn't be read. Try saving it again as PNG or JPG." }
  }
  const scale = Math.min(1, maxDimension / bitmap.width, maxDimension / bitmap.height)
  // Small enough already: upload the original, untouched.
  if (scale === 1 && file.size <= maxBytes) {
    bitmap.close()
    return { ok: true, file, type }
  }

  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return { ok: false, error: "This image couldn't be processed in this browser." }
  }
  context.imageSmoothingQuality = "high"
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  // WebP first (small, keeps transparency); lossless PNG for transparent images if WebP is
  // unavailable; JPEG otherwise. Quality steps down until the file fits.
  const fallback = type === "image/jpeg" ? "image/jpeg" : "image/png"
  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    const webp = await encode(canvas, "image/webp", quality)
    const blob = webp?.type === "image/webp" ? webp : await encode(canvas, fallback, quality)
    if (blob && blob.size <= maxBytes && SUPPORTED.includes(blob.type)) {
      const name = file.name.replace(/\.[^.]+$/, "") + (blob.type === "image/webp" ? ".webp" : blob.type === "image/png" ? ".png" : ".jpg")
      return { ok: true, file: new File([blob], name, { type: blob.type }), type: blob.type }
    }
    if (blob?.type === "image/png") break // lossless: a lower quality wouldn't help
  }
  return { ok: false, error: "This image is too large even after optimizing. Try a smaller or simpler image." }
}

"use client"

import { cn } from "cn"
import { CircleCheck, ImageIcon, Info, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"

import { type SettingsInput, saveSettings, setBrandingImage } from "@/app/admin/settings/actions"
import { Field, fieldAria, selectClass } from "@/components/shared/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { optimizeImage } from "@/lib/image-optimize"
import { BRANDING_BUCKET, BRANDING_IMAGE_EXTENSIONS, BRANDING_MAX_DIMENSION, BRANDING_UPLOAD_TARGET_BYTES, type BrandingImage, MAX_BRANDING_SOURCE_BYTES, RESPONSE_LANGUAGES, type ResponseLanguage } from "@/lib/settings"
import { createClient } from "@/lib/supabase/client"

export type SettingsValues = {
  university_name: string
  university_short_name: string
  timezone: string
  response_language: ResponseLanguage
  show_source_references: boolean
}

const card = "flex flex-col overflow-hidden rounded-lg border bg-background"
const header = "border-b px-5 py-3"

/**
 * The whole Settings page: General information and School branding side by side (stacked
 * on smaller screens), AI preferences below, and one Save changes for every field. Save
 * is enabled only when something changed. The school logo saves on its own, right away.
 */
export function SettingsForm({ initial, timezones, logo }: { initial: SettingsValues; timezones: string[]; logo: React.ReactNode }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const dirty = (Object.keys(values) as (keyof SettingsValues)[]).some((key) => values[key] !== saved[key])

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }))
    setResult(null)
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dirty || pending) return
    const next: SettingsInput = values
    startTransition(async () => {
      try {
        const response = await saveSettings(next)
        if (!response.ok) {
          setErrors(response.fieldErrors ?? {})
          return setResult({ ok: false, text: response.error })
        }
        setErrors({})
        setSaved(values)
        setResult({ ok: true, text: "Settings updated." })
        router.refresh()
      } catch {
        setResult({ ok: false, text: "The settings could not be saved. Please try again." })
      }
    })
  }

  return (
    <form onSubmit={submit} className="mt-6 flex max-w-5xl flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="general-heading" className={card}>
          <div className={header}>
            <h2 id="general-heading" className="text-sm font-semibold">General information</h2>
          </div>
          <div className="flex flex-col gap-4 p-5">
            <Field id="university_name" label="University name" error={errors.university_name}>
              <Input id="university_name" value={values.university_name} onChange={(e) => set("university_name", e.target.value)} maxLength={150} required disabled={pending} {...fieldAria("university_name", errors.university_name)} />
            </Field>
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field id="university_short_name" label="University short name" error={errors.university_short_name}>
                <Input id="university_short_name" value={values.university_short_name} onChange={(e) => set("university_short_name", e.target.value)} maxLength={20} required disabled={pending} {...fieldAria("university_short_name", errors.university_short_name)} />
              </Field>
              <Field id="timezone" label="Timezone" error={errors.timezone}>
                <select id="timezone" value={values.timezone} onChange={(e) => set("timezone", e.target.value)} disabled={pending} className={selectClass} {...fieldAria("timezone", errors.timezone)}>
                  {timezones.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </section>

        <section aria-labelledby="branding-heading" className={card}>
          <div className={header}>
            <h2 id="branding-heading" className="text-sm font-semibold">School branding</h2>
          </div>
          <div className="flex-1 p-5">{logo}</div>
        </section>
      </div>

      <section aria-labelledby="ai-heading" className={card}>
        <div className={header}>
          <h2 id="ai-heading" className="text-sm font-semibold">AI preferences</h2>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <p className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Campus Agent answers from published Knowledge Library content.
          </p>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Field id="response_language" label="Default response language" hint="Auto replies in the language of each question." error={errors.response_language}>
              <select id="response_language" value={values.response_language} onChange={(e) => set("response_language", e.target.value as ResponseLanguage)} disabled={pending} className={selectClass} {...fieldAria("response_language", errors.response_language, true)}>
                {RESPONSE_LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={values.show_source_references} onChange={(e) => set("show_source_references", e.target.checked)} disabled={pending} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary" />
            <span>
              <span className="block text-sm font-medium">Show source references in answers</span>
              <span className="block text-sm text-muted-foreground">Lists the handbook or announcement each answer comes from.</span>
            </span>
          </label>
        </div>
      </section>

      {/* One save for the page, bottom-right; the result sits beside it. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {result && !pending && (
          <p role={result.ok ? "status" : "alert"} className={cn("flex items-center gap-1.5 text-sm", result.ok ? "text-[var(--success)]" : "text-destructive")}>
            {result.ok && <CircleCheck className="size-4" aria-hidden="true" />}
            {result.text}
          </p>
        )}
        {dirty && !pending && !result && <p className="text-sm text-muted-foreground">You have unsaved changes.</p>}
        <Button type="submit" disabled={!dirty || pending}>{pending ? "Saving…" : "Save changes"}</Button>
      </div>
    </form>
  )
}

/**
 * The school logo: a large, uncropped preview with Upload / Replace and Remove. Each change
 * is saved right away. Large images are optimized in the browser before upload.
 */
export function SchoolLogo({ url }: { url: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"optimizing" | "saving" | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const field: BrandingImage = "university_logo_url"

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setMessage({ ok: false, text: result.error })
        setMessage({ ok: true, text: done })
        router.refresh()
      } catch {
        setMessage({ ok: false, text: "The logo could not be saved. Please try again." })
      } finally {
        setBusy(null)
      }
    })
  }

  function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (file.size === 0 || file.size > MAX_BRANDING_SOURCE_BYTES) return setMessage({ ok: false, text: "Choose an image up to 25 MB." })
    run(async () => {
      setBusy("optimizing")
      const optimized = await optimizeImage(file, { maxDimension: BRANDING_MAX_DIMENSION, maxBytes: BRANDING_UPLOAD_TARGET_BYTES })
      if (!optimized.ok) return { ok: false, error: optimized.error }
      setBusy("saving")
      const path = `branding/${crypto.randomUUID()}.${BRANDING_IMAGE_EXTENSIONS[optimized.type]}`
      const { error } = await createClient().storage.from(BRANDING_BUCKET).upload(path, optimized.file, { contentType: optimized.type, upsert: false })
      if (error) return { ok: false, error: "The logo could not be uploaded. Please try again." }
      return setBrandingImage(field, path)
    }, url ? "Logo replaced." : "Logo uploaded.")
  }

  const working = pending || busy !== null
  return (
    <div className="flex h-full flex-col gap-3">
      {/* A logo, not a cover: always shown whole, centered, never cropped. */}
      <div className="relative flex min-h-44 flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
        {url
          // eslint-disable-next-line @next/next/no-img-element -- public storage URL
          ? <img src={url} alt="University logo preview" className="absolute inset-0 size-full object-contain object-center p-6" />
          : (
            <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="size-6 text-muted-foreground/60" aria-hidden="true" />
              No logo yet
            </span>
          )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => choose(e.target.files?.[0])} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={working} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />
          {busy === "optimizing" ? "Optimizing…" : busy === "saving" || pending ? "Saving…" : url ? "Replace logo" : "Upload logo"}
        </Button>
        {url && (
          <Button type="button" variant="ghost" disabled={working} onClick={() => run(() => setBrandingImage(field, null), "Logo removed.")}>
            <X aria-hidden="true" />
            Remove
          </Button>
        )}
      </div>
      <p className={message ? (message.ok ? "text-sm text-[var(--success)]" : "text-sm text-destructive") : "text-xs text-muted-foreground"} role={message ? (message.ok ? "status" : "alert") : undefined}>
        {message?.text ?? "PNG, JPG or WebP. Large images are resized and compressed automatically; transparent backgrounds are kept."}
      </p>
    </div>
  )
}

"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { selectClass } from "@/components/shared/form-field"
import { cn } from "cn"

// Rows-per-page for paginated admin tables. Applies on change (back to page 1).
export function RowsPerPage({ value, options, id }: { value: number; options: number[]; id: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs whitespace-nowrap text-muted-foreground">
        Rows per page
      </label>
      <select
        id={id}
        value={value}
        aria-busy={pending}
        onChange={(e) => {
          const per = e.target.value
          startTransition(() => router.replace(`${pathname}?per=${per}&page=1`, { scroll: false }))
        }}
        className={cn(selectClass, "h-8 w-auto min-h-0 bg-background pr-7 text-sm", pending && "opacity-70")}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </div>
  )
}

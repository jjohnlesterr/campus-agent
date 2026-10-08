"use client"

import { cn } from "cn"
import { Loader2 } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { selectClass } from "@/components/shared/form-field"

// Admin department filter. Applies on change via ?dept= — no Apply button.
//   all | university | <department code>
export function AdminDepartmentFilter({
  value,
  departments,
  allLabel = "All",
  showUniversity = true,
}: {
  value: string
  departments: { code: string; name: string }[]
  allLabel?: string
  /** Offers a "University-wide" option (unused by Users: every user belongs to a department). */
  showUniversity?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto" aria-busy={pending}>
      <label htmlFor="admin-department-filter" className="text-sm whitespace-nowrap text-muted-foreground">
        Department
      </label>
      <select
        id="admin-department-filter"
        value={value}
        onChange={(e) => {
          const next = e.target.value
          const href = next === "all" ? pathname : `${pathname}?dept=${encodeURIComponent(next)}`
          startTransition(() => router.replace(href, { scroll: false }))
        }}
        className={cn(selectClass, "h-9 min-w-0 flex-1 bg-background pr-8 sm:w-60 sm:flex-none", pending && "opacity-70")}
      >
        <option value="all">{allLabel}</option>
        {showUniversity && <option value="university">University-wide</option>}
        <optgroup label="Departments">
          {departments.map((d) => (
            <option key={d.code} value={d.code} title={d.name}>
              {d.code} — {d.name}
            </option>
          ))}
        </optgroup>
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Filtering" />}
    </div>
  )
}

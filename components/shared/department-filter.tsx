"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"

import { selectClass } from "@/components/shared/form-field"
import { cn } from "cn"

// Switches the department view via the ?dept= search param.
export function DepartmentFilterSelect({
  value,
  myDepartmentCode,
  departments,
}: {
  value: string
  myDepartmentCode: string | null
  departments: { code: string; name: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <label htmlFor="department-filter" className="text-sm whitespace-nowrap text-muted-foreground">
        Show
      </label>
      <select
        id="department-filter"
        value={value}
        onChange={(e) => {
          const next = e.target.value
          startTransition(() => router.push(`${pathname}?dept=${encodeURIComponent(next)}`))
        }}
        aria-busy={pending}
        className={cn(selectClass, "h-9 min-w-0 flex-1 bg-background pr-8 sm:w-64 sm:flex-none", pending && "opacity-70")}
      >
        {myDepartmentCode && <option value="mine">My department ({myDepartmentCode})</option>}
        <option value="all">All departments</option>
        <option value="university">University-wide</option>
        <optgroup label="Departments">
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}

import Link from "next/link"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { Wordmark } from "@/components/shared/wordmark"

export function AppHeader({
  href,
  label,
  email,
}: {
  href: string
  label: string
  email: string | null
}) {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href={href} className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Wordmark name={label} className="text-[0.95rem]" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {email && <span className="hidden truncate text-sm text-muted-foreground sm:inline">{email}</span>}
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}

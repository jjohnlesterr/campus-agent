import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { Logo } from "@/components/shared/logo"

// Sign in and first-login Change Password share this centered card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page flex flex-1 flex-col items-center justify-center bg-[var(--canvas)] px-4 py-10 sm:py-16">
      <div className="w-full max-w-[440px]">
        <div className="rounded-xl border bg-background px-6 py-8 shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05),0_12px_32px_-18px_oklch(0.3_0.05_260/0.18)] sm:px-9 sm:py-10">
          <Link href="/" aria-label="Campus Agent home" className="inline-block rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo className="h-7 w-auto" priority />
          </Link>
          <div className="mt-8">{children}</div>
        </div>
        <Link
          href="/"
          className="mx-auto mt-6 flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </main>
  )
}

import Link from "next/link"

import { Wordmark } from "@/components/shared/wordmark"
import { getBranding } from "@/lib/branding"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { assistantName } = await getBranding()

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4 py-12">
      <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Wordmark name={assistantName} />
      </Link>
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-[0_1px_2px_oklch(0.22_0.025_262/0.05),0_12px_32px_-16px_oklch(0.22_0.025_262/0.16)] sm:p-8">
        {children}
      </div>
    </main>
  )
}

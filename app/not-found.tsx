import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"

// Unknown pages and missing records (notFound()) show this instead of the default 404.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-1 text-lg font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">This page doesn&apos;t exist, or the item was removed or isn&apos;t published.</p>
      <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-6" })}>Go to home</Link>
    </main>
  )
}

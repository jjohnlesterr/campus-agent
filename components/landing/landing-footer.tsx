import { Logo } from "@/components/shared/logo"

// Footer for the public pages (landing page and public guides).
export function LandingFooter({ assistantName }: { assistantName: string }) {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="h-5 w-auto self-start sm:self-auto" />
        <p>
          © {new Date().getFullYear()} {assistantName}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

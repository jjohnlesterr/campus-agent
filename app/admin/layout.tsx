import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

// Admin access is decided by profiles.role on the server. Students are sent to
// /app; signed-out visitors to /login. Pages repeat the check because layouts
// don't re-run on client-side navigation.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [profile, { assistantName }] = await Promise.all([requireAdmin(), getBranding()])

  return (
    <div className="flex min-h-dvh flex-1 bg-muted/60">
      <AdminSidebar assistantName={assistantName} userName={profile.full_name ?? profile.email ?? "Admin"} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}

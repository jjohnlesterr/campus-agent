import { AdminShell } from "@/components/admin/admin-shell"
import "./admin.css"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

// Admin access is decided by profiles.role on the server. Students are sent to
// /app; signed-out visitors to /login. Pages repeat the check because layouts
// don't re-run on client-side navigation.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const [profile, { assistantName }] = await Promise.all([requireAdmin(), getBranding()])

  return (
    <AdminShell assistantName={assistantName} userName={profile.full_name?.trim() || profile.email || "Admin"} userEmail={profile.email ?? ""}>
      {children}
    </AdminShell>
  )
}

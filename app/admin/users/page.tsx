import { CircleCheck, UserPlus, Users } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { createClient } from "@/lib/supabase/server"

// Admin › Users: the directory of regular accounts (role "user"): name, email, joined date,
// status. Administrator accounts are not listed here; the signed-in admin appears in the
// sidebar. Older profile columns (college, program, student ID…) are not read.
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin()
  const [supabase, { timezone }, { deleted }] = await Promise.all([createClient(), getBranding(), searchParams])
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, must_change_password, deactivated_at, created_at")
    .eq("role", "user")
    .order("created_at", { ascending: false })

  return (
    <>
      <PageHeader title="Users" description="Manage Campus Agent user accounts and profile information.">
        <Link href="/admin/users/new" className={buttonVariants({ variant: "outline", size: "lg" })}>
          <UserPlus aria-hidden="true" />
          Create account manually
        </Link>
      </PageHeader>

      {deleted === "1" && (
        <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          Account deleted.
        </p>
      )}

      {users && users.length > 0 && (
        <p className="mt-6 text-xs text-muted-foreground" aria-live="polite">
          {users.length} {users.length === 1 ? "user" : "users"}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border bg-background">
        {error ? (
          <p role="alert" className="px-4 py-6 text-sm text-destructive">
            Users could not be loaded. Please refresh this page.
          </p>
        ) : users && users.length > 0 ? (
          <div role="region" aria-label="Users table" tabIndex={0} className="admin-table-region overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary hover:underline">
                        {u.full_name ?? <span className="text-muted-foreground">No name</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDate(u.created_at, timezone, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {u.deactivated_at ? (
                        <StatusBadge status="cancelled" label="Deactivated" />
                      ) : u.must_change_password ? (
                        <StatusBadge status="draft" label="Awaiting first login" />
                      ) : (
                        <StatusBadge status="published" label="Active" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                        View / Edit<span className="sr-only"> {u.full_name ?? u.email}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-2">
            <EmptyState icon={Users} title="No registered users yet." description="Accounts appear here once people sign up for Campus Agent." />
          </div>
        )}
      </div>
    </>
  )
}

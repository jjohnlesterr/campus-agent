import { notFound } from "next/navigation"
import { z } from "zod"

import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { AccountActions, DeleteAccount } from "@/components/admin/user-account-actions"
import { EditUserForm } from "@/components/admin/user-form"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireAdmin } from "@/lib/auth"
import { getBranding } from "@/lib/branding"
import { formatDate } from "@/lib/datetime"
import { hasServiceRoleKey } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

// Admin › Users › one regular account (role "user"): account information, account access
// (password reset link, deactivate/reactivate) and a danger zone (delete). Only role "user"
// accounts open here, so no role is shown; email is read-only. The server actions refuse
// admins, including the one signed in.
export default async function EditUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin()
  const { id } = await params
  if (!z.uuid().safeParse(id).success || id === me.id) notFound()

  const supabase = await createClient()
  const [{ data: user }, { timezone }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, must_change_password, deactivated_at, created_at")
      .eq("id", id)
      .eq("role", "user")
      .maybeSingle(),
    getBranding(),
  ])
  if (!user) notFound()
  const configured = hasServiceRoleKey()
  const deactivated = Boolean(user.deactivated_at)
  // Accounts an admin invited, until the user sets a password from the invitation link.
  const awaitingFirstLogin = user.must_change_password && !deactivated
  const account = { id: user.id, name: user.full_name ?? user.email ?? "This user", email: user.email ?? "", deactivated, awaitingFirstLogin }
  const date = (iso: string) => formatDate(iso, timezone, { month: "short", day: "numeric", year: "numeric" })

  const card = "overflow-hidden rounded-lg border bg-background"
  const cardHeader = "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-3"

  return (
    <>
      <PageHeader title={user.full_name ?? user.email ?? "User"} description="User account">
        {deactivated ? (
          <StatusBadge status="cancelled" label="Deactivated" />
        ) : awaitingFirstLogin ? (
          <StatusBadge status="draft" label="Awaiting first login" />
        ) : (
          <StatusBadge status="published" label="Active" />
        )}
      </PageHeader>
      {!configured && <AccountsNotConfigured />}

      <div className="mt-6 flex max-w-3xl flex-col gap-5">
        <section aria-labelledby="account-heading" className={card}>
          <div className={cardHeader}>
            <h2 id="account-heading" className="text-sm font-semibold">Account information</h2>
            <p className="text-xs text-muted-foreground">
              Joined <time dateTime={user.created_at}>{date(user.created_at)}</time>
              {user.deactivated_at && <> · Deactivated <time dateTime={user.deactivated_at}>{date(user.deactivated_at)}</time></>}
            </p>
          </div>
          <div className="p-5">
            <EditUserForm disabled={!configured} user={{ id: user.id, full_name: user.full_name ?? "", email: user.email ?? "" }} />
          </div>
        </section>

        <section aria-labelledby="access-heading" className={card}>
          <div className={cardHeader}>
            <h2 id="access-heading" className="text-sm font-semibold">Account access</h2>
          </div>
          <AccountActions account={account} disabled={!configured} />
        </section>

        <section aria-labelledby="danger-heading" className="overflow-hidden rounded-lg border border-destructive/30 bg-destructive/[0.03]">
          <div className="border-b border-destructive/20 px-5 py-3">
            <h2 id="danger-heading" className="text-sm font-semibold text-destructive">Danger zone</h2>
          </div>
          <DeleteAccount account={account} disabled={!configured} />
        </section>
      </div>
    </>
  )
}

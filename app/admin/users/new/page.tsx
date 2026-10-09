import { AccountsNotConfigured } from "@/components/admin/accounts-not-configured"
import { InviteUserForm } from "@/components/admin/user-form"
import { PageHeader } from "@/components/shared/page-header"
import { requireAdmin } from "@/lib/auth"
import { hasServiceRoleKey } from "@/lib/supabase/admin"

// Secondary path: people normally create their own accounts through public sign-up. Here an
// admin creates one by invitation; the user sets their own password from the email link.
export default async function NewUserPage() {
  await requireAdmin()
  const configured = hasServiceRoleKey()

  return (
    <>
      <PageHeader
        title="Create account manually"
        description="Create an account for a user. They will receive a secure email invitation to set their password."
      />
      {!configured && <AccountsNotConfigured />}
      <div className="mt-6 max-w-3xl rounded-lg border bg-background p-5">
        <InviteUserForm disabled={!configured} />
      </div>
    </>
  )
}

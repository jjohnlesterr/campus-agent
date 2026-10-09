"use client"

import { CircleCheck, Mail, Send, Trash2, UserCheck, UserX } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { type AccountActionResult, deleteAccount, resendInvitation, sendPasswordReset, setAccountActive } from "@/app/admin/users/actions"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type Account = { id: string; name: string; email: string; deactivated: boolean; awaitingFirstLogin?: boolean }
type Feedback = { ok: boolean; text: string } | null

/** Runs an account action and keeps its success or error message for display. */
function useAccountAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<Feedback>(null)
  function run(action: () => Promise<AccountActionResult>, onDone?: () => void) {
    setFeedback(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) return setFeedback({ ok: false, text: result.error })
        onDone?.()
        setFeedback({ ok: true, text: result.message })
        router.refresh()
      } catch {
        setFeedback({ ok: false, text: "The request could not be completed. Refresh the page to check the current state." })
      }
    })
  }
  return { pending, feedback, setFeedback, run, router }
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return feedback.ok ? (
    <p role="status" className="flex items-center gap-2 text-sm text-[var(--success)]">
      <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
      {feedback.text}
    </p>
  ) : (
    <p role="alert" className="text-sm text-destructive">{feedback.text}</p>
  )
}

/** One action row: label and description on the left, the action on the right (stacked on mobile). */
function ActionRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

/** Account access rows: password reset email, and Deactivate / Reactivate with a confirmation. */
export function AccountActions({ account, disabled }: { account: Account; disabled?: boolean }) {
  const { pending, feedback, setFeedback, run } = useAccountAction()
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="divide-y">
      {account.awaitingFirstLogin && (
        <ActionRow title="Invitation" description="This user hasn't set a password yet. Send the secure invitation email again.">
          <Button variant="outline" disabled={disabled || pending} onClick={() => run(() => resendInvitation(account.id))}>
            <Send aria-hidden="true" />
            Resend invite
          </Button>
        </ActionRow>
      )}
      <ActionRow
        title="Password reset"
        description={account.deactivated ? "Reactivate the account to send a password reset link." : "Send a secure password reset link to this user's email."}
      >
        <Button variant="outline" disabled={disabled || pending || account.deactivated} onClick={() => run(() => sendPasswordReset(account.id))}>
          <Mail aria-hidden="true" />
          Send reset link
        </Button>
      </ActionRow>

      <ActionRow
        title="Account status"
        description={account.deactivated
          ? "Deactivated: this user can't sign in. Their account and data are kept."
          : "Prevent this user from signing in until the account is reactivated."}
      >
        {account.deactivated ? (
          <Button variant="outline" disabled={disabled || pending} onClick={() => run(() => setAccountActive(account.id, true))}>
            <UserCheck aria-hidden="true" />
            Reactivate account
          </Button>
        ) : (
          <Button variant="outline" disabled={disabled || pending} onClick={() => { setFeedback(null); setConfirming(true) }}>
            <UserX aria-hidden="true" />
            Deactivate account
          </Button>
        )}
      </ActionRow>

      {!confirming && feedback && <div className="px-5 py-3"><FeedbackLine feedback={feedback} /></div>}

      <Dialog open={confirming} onOpenChange={(next) => { if (!pending) setConfirming(next) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Deactivate {account.name}?</DialogTitle>
            <DialogDescription>
              {account.email} will no longer be able to sign in or use Campus Agent until the account is reactivated. Their
              account and profile data are kept.
            </DialogDescription>
          </DialogHeader>
          {feedback && !feedback.ok && <p role="alert" className="text-sm text-destructive">{feedback.text}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
            <Button size="lg" disabled={pending} onClick={() => run(() => setAccountActive(account.id, false), () => setConfirming(false))}>
              {pending ? "Deactivating…" : "Deactivate account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Permanent deletion, behind a confirmation that names the account. */
export function DeleteAccount({ account, disabled }: { account: Account; disabled?: boolean }) {
  const { pending, feedback, setFeedback, run, router } = useAccountAction()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <ActionRow title="Delete account" description="Permanently removes this account and related user data. This cannot be undone.">
        <Button variant="destructive" disabled={disabled || pending} onClick={() => { setFeedback(null); setConfirming(true) }}>
          <Trash2 aria-hidden="true" />
          Delete account
        </Button>
      </ActionRow>

      <Dialog open={confirming} onOpenChange={(next) => { if (!pending) setConfirming(next) }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete this account permanently?</DialogTitle>
            <DialogDescription>
              The sign-in account, profile and conversations will be deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-1 rounded-md border bg-muted/40 px-3 py-2.5 text-sm">
            <dt className="sr-only">Name</dt>
            <dd className="font-medium">{account.name}</dd>
            <dt className="sr-only">Email</dt>
            <dd className="break-all text-muted-foreground">{account.email}</dd>
          </dl>
          {feedback && !feedback.ok && <p role="alert" className="text-sm text-destructive">{feedback.text}</p>}
          <DialogFooter>
            <Button variant="outline" size="lg" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="destructive" size="lg" disabled={pending} onClick={() => run(() => deleteAccount(account.id), () => router.push("/admin/users?deleted=1"))}>
              {pending ? "Deleting…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

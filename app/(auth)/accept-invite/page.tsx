import { AcceptInvite } from "@/components/auth/accept-invite"

// Landing page for the Supabase invitation email (Admin › Users › Create account manually).
// The link carries a one-time session in the URL fragment, which only the browser can read:
// the client component signs the user in, then /change-password asks for their new password.
export default function AcceptInvitePage() {
  return <AcceptInvite />
}

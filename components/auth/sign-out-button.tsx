import { logout } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}

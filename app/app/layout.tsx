import { requireProfile } from "@/lib/auth"

// Any signed-in account may use /app (invited accounts that haven't set a password are
// sent to /change-password first). Pages repeat the check because layouts
// don't re-run on client-side navigation.
export default async function StudentLayout({ children }: LayoutProps<"/app">) {
  await requireProfile()
  return children
}

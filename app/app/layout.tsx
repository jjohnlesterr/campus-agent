import { requireProfile } from "@/lib/auth"

// Any signed-in account may use /app (accounts with a temporary password are
// sent to /change-password first). Pages repeat the check because layouts
// don't re-run on client-side navigation.
export default async function StudentLayout({ children }: LayoutProps<"/app">) {
  await requireProfile()
  return children
}

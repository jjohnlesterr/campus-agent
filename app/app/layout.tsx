import { requireProfile } from "@/lib/auth"

// Any signed-in account may use /app. The (shell) layout adds the sidebar;
// onboarding sits outside it. Pages repeat the check because layouts don't
// re-run on client-side navigation.
export default async function StudentLayout({ children }: LayoutProps<"/app">) {
  await requireProfile()
  return children
}

import { redirect } from "next/navigation"

// Sources are part of the Knowledge Library. Keep old links (including
// ?upload=1 from bookmarks) working.
export default async function SourcesPage({ searchParams }: PageProps<"/admin/documents">) {
  const { upload } = await searchParams
  redirect(upload === "1" ? "/admin/knowledge?upload=1" : "/admin/knowledge?tab=pdf")
}

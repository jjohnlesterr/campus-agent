import { BookOpen } from "lucide-react"

import { StudentPlaceholderPage } from "@/components/student/student-page"

export default function GuidesPage() {
  return (
    <StudentPlaceholderPage
      title="School Guides"
      description="Step-by-step procedures reviewed by university staff — enrollment, INC grades, clearance, graduation and more."
      emptyIcon={BookOpen}
      emptyTitle="No published guides yet."
      emptyDescription="Guides appear here once the university publishes them. You can still ask a question from New conversation."
    />
  )
}

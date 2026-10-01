import { Building2, Clock, MapPin, UserRound } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export default async function OfficesPage() {
  await requireProfile()
  const supabase = await createClient()
  const { data: offices } = await supabase
    .from("offices")
    .select("id, name, head_name, office_hours, campus_locations(name)")
    .order("name")

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:py-10">
      <PageHeader
        title="Offices"
        description="Who handles what: office heads, hours and where to find each office."
      />

      {offices && offices.length > 0 ? (
        <ul className="mt-6 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
          {offices.map((o) => (
            <li key={o.id} className="bg-background p-5 sm:[&:last-child:nth-child(odd)]:col-span-2">
              <h2 className="font-semibold">{o.name}</h2>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <Detail icon={UserRound} label="Office head" value={o.head_name} />
                <Detail icon={Clock} label="Office hours" value={o.office_hours} />
                <Detail icon={MapPin} label="Location" value={o.campus_locations?.name} />
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8">
          <EmptyState
            icon={Building2}
            title="No offices listed yet."
            description="The office directory will appear here once it has been added by the university."
          />
        </div>
      )}
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className={value ? "" : "text-muted-foreground"}>{value ?? "Not listed yet"}</dd>
    </div>
  )
}

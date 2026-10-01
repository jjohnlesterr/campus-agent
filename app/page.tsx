import { BookOpen, Building2, CalendarDays, FileCheck2, ListChecks, MapPin, ShieldCheck, UserRound } from "lucide-react"
import Link from "next/link"

import { ExampleAnswer } from "@/components/landing/example-answer"
import { LandingNav } from "@/components/landing/landing-nav"
import { PublicAsk } from "@/components/landing/public-ask"
import { Logo } from "@/components/shared/logo"
import { HowItWorksSteps } from "@/components/shared/how-it-works-steps"
import { getBranding } from "@/lib/branding"

// Public questions for applicants, incoming students, transferees and visitors.
// Current-student topics (INC, grades, clearance…) live in the signed-in app.
const SUGGESTIONS = [
  "How do I enroll?",
  "What are the admission requirements?",
  "Where is the Registrar?",
  "What programs are offered?",
]

const SOURCES = [
  { icon: BookOpen, name: "Student Handbook", use: "Academic rules, policies and procedures" },
  { icon: FileCheck2, name: "Official Memos and Policies", use: "Updated processes, reviewed by university staff" },
  { icon: Building2, name: "Campus / Office Information", use: "Which office handles what, and where it is" },
  { icon: CalendarDays, name: "Academic Calendar", use: "Enrollment, exams and university dates" },
]

const ABOUT_POINTS = [
  { icon: ShieldCheck, title: "Verified information", body: "Uses university-approved sources." },
  { icon: ListChecks, title: "Clear guidance", body: "Turns complex procedures into understandable steps." },
  { icon: MapPin, title: "Campus navigation", body: "Helps you find offices, buildings and essential university information." },
]

export default async function LandingPage() {
  const { assistantName, universityName } = await getBranding()

  return (
    <div className="landing-page flex flex-1 flex-col bg-background">
      <LandingNav />

      <main className="flex-1">
        {/* Hero: centered headline and the public ask box */}
        <section className="border-b bg-[var(--canvas)]">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-16 pb-20 text-center sm:px-6 lg:pt-24 lg:pb-24">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">Your campus AI assistant</p>
            <h1 className="mt-4 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.5rem]">
              Know what to do next <br className="hidden sm:block" />
              on campus.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {assistantName} turns {universityName ? `${universityName}'s` : "your university's"} handbook, policies, memos,
              and campus information into clear guidance so you can find the right process, office, and official source.
            </p>

            <div className="mt-9 w-full text-left">
              <PublicAsk suggestions={SUGGESTIONS} />
            </div>

            <p className="mt-6 flex max-w-xl items-start gap-2.5 rounded-lg border bg-background/70 px-4 py-3 text-left text-sm leading-relaxed text-muted-foreground">
              <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>
                Public guidance covers general university information for applicants, incoming students and visitors.
                Current students can{" "}
                <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                  sign in
                </Link>{" "}
                for full access.
              </span>
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Built to guide, not to guess</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                School processes are spread across handbooks, memos and office notices. {assistantName} brings them
                together and answers with structure.
              </p>
            </div>
            <HowItWorksSteps
              className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8"
              askExample="“How do I enroll?” or “Where is the Registrar?”"
            />
            <div className="mx-auto mt-14 max-w-xl">
              <ExampleAnswer />
            </div>
          </div>
        </section>

        {/* Verified sources */}
        <section id="sources" className="scroll-mt-20 border-t bg-[var(--canvas)]">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight">Verified sources</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                University staff decide what {assistantName} knows. Guides are reviewed before they are published, and
                every school-specific answer shows where it came from.
              </p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SOURCES.map(({ icon: Icon, name, use }) => (
                <li key={name} className="rounded-lg border bg-background p-5 shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)]">
                  <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-medium">{name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{use}</p>
                </li>
              ))}
            </ul>
            <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
              When no verified source exists, it says so:{" "}
              <span className="text-foreground">“I couldn&apos;t find a verified university source for this yet.”</span>
            </p>
          </div>
        </section>

        {/* About */}
        <section id="about" className="scroll-mt-20 border-t">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16 lg:py-24">
            <div>
              <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">About</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">About {assistantName}</h2>
              <p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">
                {assistantName} helps students and future students navigate university information through verified
                school sources. It turns policies, procedures, campus information and official references into clear
                guidance that is easier to understand and follow.
              </p>
            </div>
            <ul className="divide-y rounded-lg border bg-background shadow-[0_1px_2px_oklch(0.3_0.05_260/0.05)]">
              {ABOUT_POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-4 px-5 py-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo className="h-5 w-auto self-start sm:self-auto" />
          <p>
            © {new Date().getFullYear()} {assistantName}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

import { BookOpen, Building2, CalendarDays, FileCheck2, MapPin, ShieldCheck } from "lucide-react"
import Link from "next/link"

import { QuestionComposer } from "@/components/assistant/question-composer"
import { ExampleAnswer } from "@/components/landing/example-answer"
import { HowItWorksSteps } from "@/components/shared/how-it-works-steps"
import { Wordmark } from "@/components/shared/wordmark"
import { buttonVariants } from "@/components/ui/button"
import { getCurrentProfile, homePathFor } from "@/lib/auth"
import { getBranding } from "@/lib/branding"

const SUGGESTIONS = [
  "How do I enroll?",
  "What are the Dean's List requirements?",
  "Where is the Registrar?",
  "What are the admission requirements?",
]

const SOURCES = [
  { icon: BookOpen, name: "Student handbook", use: "Policies, academic rules and procedures" },
  { icon: FileCheck2, name: "Official memos and guidelines", use: "Updated processes, reviewed by staff" },
  { icon: Building2, name: "Office directory", use: "Who handles what, office heads and hours" },
  { icon: CalendarDays, name: "Calendar of activities", use: "Events, exams and university dates" },
  { icon: MapPin, name: "Campus map", use: "Where each office and building is" },
]


export default async function LandingPage() {
  const [{ assistantName, universityName }, profile] = await Promise.all([
    getBranding(),
    getCurrentProfile(),
  ])

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Wordmark name={assistantName} className="text-[0.95rem]" />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a
              href="#how-it-works"
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              How it works
            </a>
            <a
              href="#sources"
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Verified sources
            </a>
            {profile ? (
              <Link href={homePathFor(profile.role)} className={buttonVariants({ size: "lg" })}>
                Open {assistantName}
              </Link>
            ) : (
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "lg" })}>
                Student sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: the question box next to what an answer looks like */}
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-20 lg:pb-28">
          <div className="flex flex-col gap-8">
            <div>
              <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl lg:text-[3.4rem]">
                The next step, the right office, and the official source.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                {assistantName} turns {universityName ?? "your university"}&apos;s handbook, memos and
                office directory into clear, step-by-step guidance — so you know what to do and where
                to go.
              </p>
            </div>

            <QuestionComposer
              size="large"
              placeholder="Ask about enrollment, school procedures, or campus services…"
              suggestions={SUGGESTIONS}
              notConnectedMessage="Public answers are coming soon. Students can sign in to see what's available today."
            />

            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Public answers use only information the university has marked public. Sign in with your
              school account for guidance tailored to your college and program.
            </p>
          </div>

          <ExampleAnswer />
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-t bg-muted/50">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight">
              Built to guide, not to guess
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              School processes are spread across handbooks, memos and office notices. {assistantName}{" "}
              brings them together and answers with structure.
            </p>

            <HowItWorksSteps className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8" />
          </div>
        </section>

        {/* Verified sources */}
        <section id="sources" className="scroll-mt-20 border-t">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">Answers from official sources only</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                University staff decide what {assistantName} knows. Guides are reviewed before they are
                published, and every school-specific answer shows where it came from.
              </p>
              <blockquote className="mt-8 border-l border-border pl-4 text-sm leading-relaxed text-muted-foreground">
                When no verified source exists, it says so:
                <span className="mt-2 block text-foreground">
                  “I couldn&apos;t find a verified university source for this yet. You may contact the
                  Office of the Registrar for confirmation.”
                </span>
              </blockquote>
            </div>

            <ul className="divide-y rounded-xl border">
              {SOURCES.map(({ icon: Icon, name, use }) => (
                <li key={name} className="flex items-center gap-4 px-5 py-4">
                  <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">{name}</p>
                    <p className="text-sm text-muted-foreground">{use}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Students */}
        <section className="border-t bg-ink text-ink-foreground">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight">Enrolled student?</h2>
              <p className="mt-2 leading-relaxed text-ink-muted">
                Sign in with your school account to save your conversations and see announcements and
                events from your college first.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className={buttonVariants({
                  size: "lg",
                  className: "bg-ink-foreground px-4 text-ink hover:bg-ink-foreground/90",
                })}
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Wordmark name={assistantName} className="text-sm text-foreground" />
          <p>{assistantName} explains university processes. It does not submit requests or official transactions.</p>
        </div>
      </footer>
    </div>
  )
}
